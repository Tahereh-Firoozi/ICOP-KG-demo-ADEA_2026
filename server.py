import json
import logging
import os
import pickle
import re
import string
import urllib.request
import urllib.error
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from google import genai
from google.genai import types


HERE = Path(__file__).resolve().parent
DATA_BACKEND_JSON = HERE / "data_backend.json"
EMBEDDINGS_PKL_DEFAULT = HERE / "data" / "rag_dataset" / "embeddings.pkl"
DEBUG_DIR = HERE / "debug_gemini_logs"
DEBUG_DIR.mkdir(exist_ok=True)

EMBEDDING_MODEL = "models/gemini-embedding-001"
GENERATION_MODEL = "gemini-3-flash-preview"


# Basic logging setup – adjust level via LOG_LEVEL env var if needed.
log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("icop_server")


def setup_client() -> genai.Client:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not set")
    return genai.Client(api_key=api_key)


def _ascii_sanitize(text: str) -> str:
    # Keep printable ASCII to avoid weird tokenization / encoding issues
    printable = set(string.printable)
    return "".join(ch for ch in (text or "") if ch in printable).strip()


def get_gemini_embedding(client: genai.Client, text: str) -> List[float]:
    safe = _ascii_sanitize(text)
    resp = client.models.embed_content(model=EMBEDDING_MODEL, contents=[safe])
    if hasattr(resp, "embeddings") and resp.embeddings:
        return list(resp.embeddings[0].values)
    raise RuntimeError("No embedding returned")


def cosine_similarity_vec(query: np.ndarray, mat: np.ndarray) -> np.ndarray:
    # query shape: (d,), mat shape: (n,d)
    qn = np.linalg.norm(query)
    mn = np.linalg.norm(mat, axis=1)
    denom = (qn * mn)
    denom = np.where(denom == 0, 1e-12, denom)
    return (mat @ query) / denom


def count_after_days_phrases(text: str) -> int:
    # Matches patterns like: [After 3 days]
    return len(re.findall(r"\[\s*after\s+\d+\s+days\s*\]", text or "", flags=re.I))


@dataclass(frozen=True)
class BackendData:
    node_label: Dict[str, str]
    edges: List[Dict[str, Any]]

    def label(self, node_id: str) -> str:
        return self.node_label.get(node_id, node_id)

    def expected_features_for_dx(self, dx_node_id: str) -> List[str]:
        feats = []
        for e in self.edges:
            if e.get("source") == dx_node_id and e.get("rel") in ("has_symptom", "risk_factor"):
                tgt = e.get("target")
                if tgt:
                    feats.append(tgt)
        return feats


def load_backend_data() -> BackendData:
    if not DATA_BACKEND_JSON.exists():
        raise RuntimeError(f"Missing {DATA_BACKEND_JSON}")
    raw = json.loads(DATA_BACKEND_JSON.read_text(encoding="utf-8"))
    node_label = {n["id"]: n.get("label", n["id"]) for n in raw.get("KG_NODES", [])}
    edges = raw.get("KG_EDGES", [])
    return BackendData(node_label=node_label, edges=edges)


@dataclass(frozen=True)
class TrainEmbeddings:
    docs: List[Dict[str, Any]]  # only type == "train"
    matrix: np.ndarray          # shape (n_train, d)


def _maybe_download_embeddings(dest_path: Path) -> Optional[Path]:
    """
    Render free tier has no persistent disk. If EMBEDDINGS_PKL_URL is set, download the file
    to a local ephemeral path (e.g., /tmp/embeddings.pkl) at startup.

    Env vars:
      - EMBEDDINGS_PKL_URL: required to download
      - EMBEDDINGS_PKL_URL_BEARER: optional Bearer token for auth
      - EMBEDDINGS_PKL_SHA256: optional hex digest to verify integrity
    """
    url = os.environ.get("EMBEDDINGS_PKL_URL")
    if not url:
        logger.info("EMBEDDINGS_PKL_URL not set; skipping embeddings download.")
        return None

    bearer = os.environ.get("EMBEDDINGS_PKL_URL_BEARER")
    expected_sha = (os.environ.get("EMBEDDINGS_PKL_SHA256") or "").strip().lower()

    logger.info(
        "Attempting to download embeddings from EMBEDDINGS_PKL_URL to %s (has bearer: %s, has sha256: %s)",
        dest_path,
        bool(bearer),
        bool(expected_sha),
    )

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    headers = {}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        logger.info("Successfully downloaded embeddings (size: %d bytes).", len(data))
    except urllib.error.URLError as e:
        logger.error("Failed to download embeddings from EMBEDDINGS_PKL_URL: %s", e)
        raise RuntimeError(f"Failed to download embeddings from EMBEDDINGS_PKL_URL: {e}") from e

    if expected_sha:
        got = sha256(data).hexdigest().lower()
        if got != expected_sha:
            logger.error(
                "Embeddings SHA256 mismatch: expected %s, got %s", expected_sha, got
            )
            raise RuntimeError(
                f"Embeddings SHA256 mismatch: expected {expected_sha}, got {got}"
            )
        logger.info("Embeddings SHA256 verified successfully.")

    dest_path.write_bytes(data)
    logger.info("Embeddings written to %s", dest_path)
    return dest_path


def load_train_embeddings() -> TrainEmbeddings:
    p = os.environ.get("EMBEDDINGS_PKL_PATH")
    embeddings_path = Path(p).expanduser().resolve() if p else EMBEDDINGS_PKL_DEFAULT
    logger.info(
        "Initializing train embeddings. EMBEDDINGS_PKL_PATH=%s, resolved path=%s",
        p,
        embeddings_path,
    )
    if not embeddings_path.exists():
        logger.warning(
            "Embeddings file not found at %s. Attempting download via EMBEDDINGS_PKL_URL.",
            embeddings_path,
        )
        # Try downloading to ephemeral storage if a URL is configured (Render free tier friendly).
        downloaded = _maybe_download_embeddings(Path("/tmp/embeddings.pkl"))
        if downloaded and downloaded.exists():
            logger.info("Using downloaded embeddings from %s", downloaded)
            embeddings_path = downloaded
        else:
            logger.error(
                "Unable to locate or download embeddings. "
                "Set EMBEDDINGS_PKL_PATH or EMBEDDINGS_PKL_URL."
            )
            raise RuntimeError(
                f"Missing embeddings file at {embeddings_path}. "
                f"Set EMBEDDINGS_PKL_PATH or EMBEDDINGS_PKL_URL."
            )
    with embeddings_path.open("rb") as f:
        docs_all = pickle.load(f)
    logger.info("Loaded embeddings.pkl with %d documents.", len(docs_all))
    train_docs = [d for d in docs_all if d.get("type") == "train"]
    if not train_docs:
        logger.error("No train docs found in embeddings.pkl (path=%s).", embeddings_path)
        raise RuntimeError("No train docs found in embeddings.pkl")
    mat = np.array([d["embedding"] for d in train_docs], dtype=np.float64)
    logger.info(
        "Train embeddings initialized. n_train=%d, dimension=%d",
        mat.shape[0],
        mat.shape[1] if mat.ndim == 2 else -1,
    )
    return TrainEmbeddings(docs=train_docs, matrix=mat)


class AssessRequest(BaseModel):
    scenarioId: Optional[str] = None
    scenarioNote: str = Field(min_length=1)
    goldDiagnosisNodeId: str = Field(min_length=1)
    studentDiagnosisNodeId: str = Field(min_length=1)
    selectedFeatureNodeIds: List[str] = Field(default_factory=list)
    justification: str = ""
    similarK: int = 3


class SimilarCase(BaseModel):
    id: str
    title: str
    text: str
    diagnosisNodeId: str
    score: float


def _extract_json(text: str) -> Dict[str, Any]:
    # Try direct parse first
    t = (text or "").strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    # Try to find first JSON object in the response
    m = re.search(r"\{[\s\S]*\}", t)
    if not m:
        raise ValueError("No JSON object found in model response")
    return json.loads(m.group(0))


def clean_text(text):
    # Normalize common non-ASCII characters
    replacements = {
        "\u2013": "-",  # en-dash
        "\u2014": "--", # em-dash
        "\u2018": "'",  # left single quote
        "\u2019": "'",  # right single quote
        "\u201c": '"',  # left double quote
        "\u201d": '"',  # right double quote
        "\u2026": "...", # ellipsis
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)

    # Remove YAML markers
    text = text.replace("```yaml", "").replace("```", "")
    
    # Remove text before "Visit Type: Initial consultation"
    marker = "Visit Type: Initial consultation"
    if marker.lower() in text.lower():
        idx = text.lower().find(marker.lower())
        text = text[idx:]

    # Remove dates / years (de-identification / normalization)
    # - years like 1998, 2024
    text = re.sub(r"\b(19|20)\d{2}\b", "", text)
    # - common numeric date formats: 03/11/2026, 2026-03-11, 3-11-26
    text = re.sub(r"\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b", "", text)
    # - month-name dates: Mar 11, March 11 2026, 11 Mar 2026
    month = r"(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)"
    text = re.sub(rf"\b{month}\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,\s*\d{{2,4}})?\b", "", text, flags=re.I)
    text = re.sub(rf"\b\d{{1,2}}\s+{month}(?:\s+\d{{2,4}})?\b", "", text, flags=re.I)
    # - remove lines explicitly containing Date/DOB
    text = re.sub(r"(?im)^(date|dob|date of birth)\s*:\s*.*$", "", text)

    # Clean up extra spaces/blank lines introduced by removals
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
        
    return text.strip()


def build_feedback_prompt(payload: AssessRequest, data: BackendData, computed: Dict[str, Any]) -> str:
    gold_dx_label = data.label(payload.goldDiagnosisNodeId)
    student_dx_label = data.label(payload.studentDiagnosisNodeId)
    expected_feats = data.expected_features_for_dx(payload.goldDiagnosisNodeId)

    expected_feat_labels = [data.label(x) for x in expected_feats]
    selected_feat_labels = [data.label(x) for x in payload.selectedFeatureNodeIds]
    missing_feat_labels = [data.label(x) for x in computed.get("missingFeatureNodeIds", [])]
    extra_feat_labels = [data.label(x) for x in computed.get("extraFeatureNodeIds", [])]
    coverage_pct = computed.get("coveragePct", 0)
    match = payload.studentDiagnosisNodeId == payload.goldDiagnosisNodeId

    return f"""
You are an assessor for an ICOP clinical reasoning exercise.
Provide constructive, rubric-based feedback in natural language.

Hard rules:
- Do NOT use markdown (no **, *, #, bullet list markdown). Use plain text only.
- Keep it concise: 1–2 short paragraphs + 2–3 short action items.

1. Diagnosis selection: Was the student's diagnosis correct? If not, what was the correct diagnosis and why?
2. Key feature selection: Which expected features were missing? Which selected features were less relevant? What is the feature coverage percentage?
3. Justification quality: Evaluate the student's justification (1-3 sentences). What are the strengths? What needs improvement?
4. Overall coaching: Provide 2-3 specific, actionable next steps for the student.

Write your feedback as clear, supportive sentences suitable for a learner. Be specific and reference the actual diagnoses and features mentioned.

Scenario note:
{payload.scenarioNote.strip()}

Assessment results:
- Student diagnosis: {student_dx_label} ({payload.studentDiagnosisNodeId})
- Ground truth diagnosis: {gold_dx_label} ({payload.goldDiagnosisNodeId})
- Diagnosis match: {"✅ Correct" if match else "❌ Incorrect"}

- Expected key features: {", ".join(expected_feat_labels) if expected_feat_labels else "(none)"}
- Selected key features: {", ".join(selected_feat_labels) if selected_feat_labels else "(none)"}
- Missing key features: {", ".join(missing_feat_labels) if missing_feat_labels else "(none)"}
- Extra/less relevant features: {", ".join(extra_feat_labels) if extra_feat_labels else "(none)"}
- Feature coverage: {coverage_pct}%

- Student justification: {payload.justification.strip() or "(none provided)"}

Provide your feedback now:
""".strip()


def score_justification_locally(justification: str, expected_labels: List[str]) -> int:
    t = (justification or "").strip()
    words = [w for w in re.split(r"\s+", t) if w]
    wc = len(words)
    has_causal = bool(re.search(r"\b(because|therefore|thus|since|suggests|consistent with|given)\b", t, re.I))
    has_diff = bool(re.search(r"\b(differential|rule out|less likely|alternative|however|but|although)\b", t, re.I))
    lower = t.lower()
    feature_mentions = 0
    for lbl in expected_labels[:10]:
        key = re.split(r"[\/(),]", str(lbl).lower())[0].strip()
        if key and len(key) >= 4 and key in lower:
            feature_mentions += 1
    score = 0
    if wc >= 10:
        score += 1
    if wc >= 20:
        score += 1
    if has_causal:
        score += 1
    if feature_mentions >= 1:
        score += 1
    if feature_mentions >= 2:
        score += 1
    if has_diff:
        score += 1
    return int(score)


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("Starting ICOP FastAPI server initialization.")
_backend_data = load_backend_data()
logger.info("Loaded backend data with %d nodes and %d edges.", len(_backend_data.node_label), len(_backend_data.edges))
_train_embeddings: Optional[TrainEmbeddings] = None
try:
    _train_embeddings = load_train_embeddings()
    logger.info("Similar-case retrieval enabled (embeddings loaded).")
except Exception as e:
    # Allow server to start without embeddings (public frontend can still run; AI feedback still works).
    _train_embeddings = None
    logger.warning("Similar-case retrieval disabled: %s", e)

@app.get("/")
def root() -> RedirectResponse:
    # Serve the UI from the same origin as the API for convenience.
    return RedirectResponse(url="/assessment.html")

@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/assess")
def assess(req: AssessRequest) -> Dict[str, Any]:
    try:
        client = setup_client()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    cleaned_note = clean_text(req.scenarioNote)

    similar_cases: List[Dict[str, Any]] = []
    if _train_embeddings is not None:
        # Similar cases via precomputed embeddings.pkl (default K=3; UI shows top 2)
        k = int(req.similarK or 3)
        k = max(2, min(k, 10))
        q_emb = np.array(get_gemini_embedding(client, cleaned_note), dtype=np.float64)
        scores = cosine_similarity_vec(q_emb, _train_embeddings.matrix)
        ranked_idx = np.argsort(scores)[::-1]

        # Choose acceptable cases (<= 1 "[After x days]" phrase); otherwise keep searching.
        for i in ranked_idx:
            c = _train_embeddings.docs[int(i)]
            raw_id = c.get("id", f"train_{i}")
            cleaned_text = clean_text(c.get("text", ""))

            if count_after_days_phrases(cleaned_text) > 1:
                continue

            similar_cases.append(
                {
                    "id": raw_id,
                    "title": "Similar case",
                    "text": cleaned_text,
                    "diagnosisNodeId": "",
                    "score": float(scores[int(i)]),
                }
            )
            if len(similar_cases) >= k:
                break

    # Compute deterministic key-feature comparison (used both for rendering + prompt grounding)
    expected_feats = _backend_data.expected_features_for_dx(req.goldDiagnosisNodeId)
    selected = list(dict.fromkeys(req.selectedFeatureNodeIds or []))  # de-dupe, preserve order
    missing = [x for x in expected_feats if x not in selected]
    extra = [x for x in selected if x not in expected_feats]
    coverage = (len(expected_feats) - len(missing)) / len(expected_feats) if expected_feats else 0.0

    computed = {
        "expectedFeatureNodeIds": expected_feats,
        "missingFeatureNodeIds": missing,
        "extraFeatureNodeIds": extra,
        "coveragePct": int(round(coverage * 100)),
    }

    # Gemini feedback (using cleaned scenario note inside payload as well)
    req_for_prompt = req.copy()
    req_for_prompt.scenarioNote = cleaned_note
    prompt = build_feedback_prompt(req_for_prompt, _backend_data, computed)
    
    # Save prompt for debugging
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prompt_file = DEBUG_DIR / f"prompt_{timestamp}.txt"
    prompt_file.write_text(prompt, encoding="utf-8")
    
    model_text = ""
    response_file = None
    try:
        resp = client.models.generate_content(
            model=GENERATION_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=4096  # Increased to avoid truncation
            ),
        )
        # Extract text from response - try resp.text first (most common)
        model_text = ""
        try:
            if hasattr(resp, "text"):
                model_text = str(resp.text) if resp.text else ""
        except Exception:
            pass
        
        # Fallback to candidates if text attribute didn't work
        if not model_text and hasattr(resp, "candidates") and resp.candidates:
            try:
                candidate = resp.candidates[0]
                if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                    parts_text = []
                    for part in candidate.content.parts:
                        if hasattr(part, "text") and part.text:
                            parts_text.append(str(part.text))
                    model_text = "".join(parts_text)
            except Exception:
                pass
        
        # If still empty, raise error to trigger fallback
        if not model_text or not model_text.strip():
            raise ValueError(f"Empty or invalid response from Gemini. Response type: {type(resp)}")
        
        # Save raw response for debugging (including full response object structure)
        response_file = DEBUG_DIR / f"response_{timestamp}.txt"
        debug_info = [
            f"=== Full Response Object Debug ===",
            f"Response type: {type(resp)}",
            f"Response dir: {dir(resp)}",
            f"\n=== Extracted Text ===",
            model_text,
            f"\n=== Full Response Object (repr) ===",
            repr(resp)[:2000],  # Limit repr to avoid huge files
        ]
        response_file.write_text("\n".join(debug_info), encoding="utf-8")
        
        # Return natural language feedback (not JSON)
        feedback_text = model_text.strip() if model_text else ""
        if not feedback_text:
            # If we got an empty response, use fallback
            raise ValueError("Gemini returned empty response")
        feedback = {"text": feedback_text, "type": "natural_language"}
    except Exception as e:
        # Save error info
        error_file = DEBUG_DIR / f"error_{timestamp}.txt"
        error_details = [
            f"Error: {str(e)}",
            f"Error type: {type(e).__name__}",
            f"\nPrompt saved to: {prompt_file}",
            f"Response saved to: {response_file if response_file else 'N/A'}",
            f"\nRaw response text:\n{model_text if model_text else 'N/A'}",
        ]
        error_file.write_text("\n".join(error_details), encoding="utf-8")
        # If Gemini fails, return fallback to old template format
        expected_labels = [_backend_data.label(x) for x in expected_feats]
        gold_dx_label = _backend_data.label(req.goldDiagnosisNodeId)
        student_dx_label = _backend_data.label(req.studentDiagnosisNodeId)
        confusable_dx_label = ""
        dx_list = [n["id"] for n in _backend_data.node_label.items() if n[0] != req.goldDiagnosisNodeId]
        for dx_id in dx_list[:5]: 
            dx_feats = _backend_data.expected_features_for_dx(dx_id)
            if dx_feats:
                confusable_dx_label = _backend_data.label(dx_id)
                break
        
        model_answer = (
            f"Given the key findings, this presentation is most consistent with {gold_dx_label}. "
            f"This is supported by the core feature pattern; an alternative such as {confusable_dx_label or 'a nearby ICOP category'} "
            f"is less likely given the overall feature profile."
        )
        feedback = {
            "text": model_answer,
            "type": "template_fallback"
        }

    return {
        "similarCases": similar_cases,
        "computed": computed,
        "feedback": feedback,
    }


app.mount("/", StaticFiles(directory=str(HERE), html=True), name="static")

