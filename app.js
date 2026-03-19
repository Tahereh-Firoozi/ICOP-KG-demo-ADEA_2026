// app.js — UAlberta Green + Gold visualization (Option 3 feedback; GitHub Pages safe)
// Requires: KG_NODES, KG_EDGES, CASE_LIBRARY
// Optional: DEMO_NOTES, CONFUSABLE_MAP

// ── Backend URL ──────────────────────────────────────────────────────
// This file supports 3 common setups:
// 1) Local dev (FastAPI serves the static files): use same-origin ("")
// 2) Render (FastAPI serves the static files): use same-origin ("")
// 3) GitHub Pages static frontend: call the Render backend URL
//
// You can always override in the browser console before app loads via:
//   window.__ICOP_BACKEND_URL__ = "https://...";   // (no trailing slash)
function resolveBackendUrl() {
  const override = (typeof window !== "undefined" && window.__ICOP_BACKEND_URL__) ? String(window.__ICOP_BACKEND_URL__) : "";
  if (override) return override.replace(/\/+$/, "");

  const host = (typeof window !== "undefined" && window.location && window.location.hostname) ? window.location.hostname : "";
  // Same-origin when served by FastAPI (localhost or onrender.com custom domain)
  if (host === "localhost" || host === "127.0.0.1") return "";
  if (host.endsWith(".onrender.com")) return "";

  // If you're hosting only the static frontend (e.g., GitHub Pages), point to Render:
  if (host.endsWith(".github.io")) return "https://icop-kg-demo-adea-2026.onrender.com";

  // Default: same-origin.
  return "";
}
const BACKEND_URL = resolveBackendUrl();

if (typeof cytoscape === "undefined") throw new Error("Cytoscape is not loaded.");
if (typeof KG_NODES === "undefined" || typeof KG_EDGES === "undefined") throw new Error("KG_NODES / KG_EDGES not found.");
if (typeof CASE_LIBRARY === "undefined") throw new Error("CASE_LIBRARY not found.");

window.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // ---------- Cytoscape init ----------
  const cyContainer = $("cy");
  const cy = cyContainer
    ? cytoscape({
        container: cyContainer,
        elements: [...KG_NODES, ...KG_EDGES],
        style: [
          // Base nodes
          { selector: "node", style: {
              label: "data(label)",
              "text-wrap": "wrap",
              "text-max-width": 260,
              "text-valign": "center",
              "text-halign": "center",
              "font-size": 16,
              "font-weight": 800,
              "border-width": 3,
              "border-color": "#0f172a",
              color: "#0f172a",
              "background-color": "#ffffff",
              width: 180, height: 120, padding: 14
          }},

          // ICOP nodes
          { selector: 'node[type="icop"]', style: { shape: "round-rectangle", "border-width": 4 } },

          // ICOP level continuum (green ramp)
          // L1 darkest → L5 lightest
          { selector: 'node[type="icop"][level = 1]', style: { "background-color": "#005c31", "border-color": "#004a27", "color": "#ffffff", "font-size": 22, "width": 270, "height": 160 } },
          { selector: 'node[type="icop"][level = 2]', style: { "background-color": "#007C41", "border-color": "#006b37", "color": "#ffffff", "font-size": 20, "width": 255, "height": 150 } },
          { selector: 'node[type="icop"][level = 3]', style: { "background-color": "#1aa35a", "border-color": "#148a4c", "color": "#0f172a", "font-size": 18, "width": 240, "height": 145 } },
          { selector: 'node[type="icop"][level = 4]', style: { "background-color": "#6fd1a3", "border-color": "#2fb579", "color": "#0f172a", "font-size": 17, "width": 230, "height": 140 } },
          { selector: 'node[type="icop"][level >= 5]', style: { "background-color": "#cfeee0", "border-color": "#6fd1a3", "color": "#0f172a", "font-size": 16, "width": 220, "height": 135 } },

          // Symptoms (gold ramp)
          { selector: 'node[type="symptom"]', style: {
              shape: "ellipse",
              "background-color": "#FFB81C",
              "border-color": "#D39A00",
              "border-width": 3,
              width: 155, height: 155,
              "font-size": 15,
              "font-weight": 900,
              color: "#0f172a"
          }},
          // Optional: if you tag some symptom levels later, you can color them.
          { selector: 'node[type="symptom"][level = 2]', style: { "background-color": "#FFD770", "border-color": "#D39A00" } },
          { selector: 'node[type="symptom"][level >= 3]', style: { "background-color": "#FFF1C7", "border-color": "#D39A00" } },

          // Edges
          { selector: "edge", style: {
              "curve-style": "bezier",
              width: 3,
              "line-color": "#cbd5e1",
              "target-arrow-shape": "triangle",
              "target-arrow-color": "#cbd5e1",
              label: "data(rel)",
              "font-size": 12,
              "text-rotation": "autorotate",
              "text-margin-y": -10,
              color: "#64748b"
          }},
          { selector: 'edge[rel="parent_of"]', style: { width: 5, "line-color": "#94a3b8", "target-arrow-color": "#94a3b8" } },
          { selector: 'edge[rel="has_symptom"]', style: { "line-style": "dashed", "line-dash-pattern": [6, 6] } },
          { selector: 'edge[rel="risk_factor"]', style: { "line-style": "dotted" } },

          // Highlight: GOLD glow + GOLD edges (premium look)
          { selector: ".hlNode", style: {
              "border-width": 8,
              "border-color": "#0f172a",
              "overlay-color": "#FFB81C",
              "overlay-opacity": 0.18
          }},
          { selector: ".hlEdge", style: {
              "line-color": "#FFB81C",
              "target-arrow-color": "#FFB81C",
              width: 8
          }},
          { selector: ".dim", style: { opacity: 0.12 } }
        ],
        layout: { name: "breadthfirst", directed: true, padding: 90, spacingFactor: 2.3, animate: false }
      })
    : null;

  // ---------- Utils ----------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  // Minimal, safe formatting for AI output:
  // - escape HTML first
  // - support **bold** and *italic* (in case the model still outputs markdown)
  // - preserve newlines
  function renderSafeInlineMarkdown(text) {
    const escaped = escapeHtml(text || "");
    const bolded = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const ital = bolded.replace(/\*(.+?)\*/g, "<em>$1</em>");
    return ital.replace(/\n/g, "<br>");
  }
  function setKpi(id, value) { const el = $(id); if (el) el.textContent = value; }
  function nodeLabel(id) {
    if (!cy) return id;
    const n = cy.getElementById(id);
    return (!n || n.empty()) ? id : (n.data("label") || id).replace(/\n/g, " ");
  }

  function resetHighlights() { if (cy) cy.elements().removeClass("hlNode hlEdge dim"); }

  function highlightDiagnosisPathAndFeatures(dxNodeId) {
    if (!cy) return;
    resetHighlights();
    cy.elements().addClass("dim");

    const dx = cy.getElementById(dxNodeId);
    if (!dx || dx.empty()) return;

    dx.removeClass("dim").addClass("hlNode");

    // parent chain
    let current = dx;
    while (true) {
      const incoming = current.incomers('edge[rel="parent_of"]');
      if (incoming.length === 0) break;
      const e = incoming[0];
      const parent = e.source();
      e.removeClass("dim").addClass("hlEdge");
      parent.removeClass("dim").addClass("hlNode");
      current = parent;
    }

    // features
    const feats = dx.outgoers('edge[rel="has_symptom"], edge[rel="risk_factor"]');
    feats.removeClass("dim").addClass("hlEdge");
    feats.targets().removeClass("dim").addClass("hlNode");

    const highlighted = cy.elements(".hlNode, .hlEdge");
    if (highlighted.length > 0) cy.fit(highlighted, 90);
  }

  $("fitBtn")?.addEventListener("click", () => { if (cy) cy.fit(cy.elements(), 80); });

  // ---------- Populate diagnosis & symptoms ----------
  function getAssessableDxNodes() {
    if (!cy) return [];
    const icopNodes = cy.nodes('node[type="icop"]');
    const dx = [];
    icopNodes.forEach(n => {
      const out = n.outgoers('edge[rel="has_symptom"], edge[rel="risk_factor"]');
      if (out && out.length > 0) dx.push({ id: n.id(), label: n.data("label") });
    });
    dx.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
    return dx;
  }

  function populateDiagnosisSelect() {
    const sel = $("studentDiagnosis");
    if (!sel || !cy) return;
    sel.innerHTML = `<option value="">Select diagnosis…</option>`;
    for (const d of getAssessableDxNodes()) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = (d.label || d.id).replace(/\n/g, " ");
      sel.appendChild(opt);
    }
  }

  function getAllFeatureNodes() {
    if (!cy) return [];
    const nodes = cy.nodes('node[type="symptom"]');
    const list = [];
    nodes.forEach(n => list.push({ id: n.id(), label: n.data("label") }));
    list.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
    return list;
  }

  function populateSymptomChecklist() {
    const box = $("symptomChecklist");
    if (!box || !cy) return;
    box.innerHTML = "";
    for (const it of getAllFeatureNodes()) {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <input type="checkbox" value="${escapeHtml(it.id)}" />
        <span>${escapeHtml((it.label || it.id)).replace(/\n/g, " ")}</span>
      `;
      box.appendChild(row);
    }
  }

  function getSelectedSymptoms() {
    const box = $("symptomChecklist");
    if (!box) return [];
    return Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
  }

  function getDiagnosisFeatureSet(dxNodeId) {
    if (!cy) return [];
    const dx = cy.getElementById(dxNodeId);
    if (!dx || dx.empty()) return [];
    const edges = dx.outgoers('edge[rel="has_symptom"], edge[rel="risk_factor"]');
    return edges.targets().map(n => n.id());
  }

  // ---------- Similarity retrieval (TF-IDF cosine) ----------
  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(t => t && t.length > 2);
  }

  function buildVocab(docsTokens) {
    const vocab = new Map();
    for (const tokens of docsTokens) for (const t of tokens) if (!vocab.has(t)) vocab.set(t, vocab.size);
    return vocab;
  }

  function termFreq(tokens) {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    const max = Math.max(...tf.values(), 1);
    for (const [k, v] of tf.entries()) tf.set(k, v / max);
    return tf;
  }

  function invDocFreq(docsTokens) {
    const df = new Map();
    const n = docsTokens.length;
    for (const tokens of docsTokens) {
      const seen = new Set(tokens);
      for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
    }
    const idf = new Map();
    for (const [t, c] of df.entries()) idf.set(t, Math.log((n + 1) / (c + 1)) + 1);
    return idf;
  }

  function vectorize(tokens, vocab, idf) {
    const tf = termFreq(tokens);
    const vec = new Float64Array(vocab.size);
    for (const [t, tfv] of tf.entries()) {
      const idx = vocab.get(t);
      if (idx === undefined) continue;
      vec[idx] = tfv * (idf.get(t) || 0);
    }
    return vec;
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function retrieveTopCases(noteText, k = 3) {
    const note = String(noteText || "").trim();
    const caseTokens = CASE_LIBRARY.map(c => tokenize(c.text));
    const queryTokens = tokenize(note);

    const allDocs = [...caseTokens, queryTokens];
    const vocab = buildVocab(allDocs);
    const idf = invDocFreq(allDocs);

    const caseVecs = CASE_LIBRARY.map((c, i) => vectorize(caseTokens[i], vocab, idf));
    const queryVec = vectorize(queryTokens, vocab, idf);

    const scored = CASE_LIBRARY
      .map((c, i) => ({ ...c, sim: cosine(queryVec, caseVecs[i]) }))
      .sort((a, b) => b.sim - a.sim);

    return scored.slice(0, k);
  }

  // ---------- Scenario dropdowns ----------
  function populateCaseSelector(selectId, noteId) {
    const sel = $(selectId);
    const noteBox = $(noteId);
    if (!sel || !noteBox) return;
    if (typeof DEMO_NOTES === "undefined") return;

    sel.innerHTML = `<option value="">Choose a case…</option>`;
    for (const item of DEMO_NOTES) {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.title;
      sel.appendChild(opt);
    }

    sel.addEventListener("change", () => {
      const chosen = DEMO_NOTES.find(x => x.id === sel.value);
      if (!chosen) return;
      noteBox.value = chosen.note || "";
      setKpi("kpiTopSim", "—");
      setKpi("kpiDx", "—");
      resetHighlights();
      const ai = $("aiFeedbackBox");
      if (ai) ai.textContent = "Submit to see feedback.";
    });
  }

  // ---------- "AI-like" feedback (rubric-based) ----------
  function scoreJustification(justText, expectedLabels) {
    const t = String(justText || "").trim();
    const words = t.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    const hasCausal = /\b(because|therefore|thus|since|suggests|consistent with|given)\b/i.test(t);
    const hasDiff = /\b(differential|rule out|less likely|alternative|however|but|although)\b/i.test(t);

    const lower = t.toLowerCase();
    let featureMentions = 0;
    for (const lbl of expectedLabels.slice(0, 10)) {
      const key = String(lbl).toLowerCase().split(/[\/(),]/)[0].trim();
      if (key && key.length >= 4 && lower.includes(key)) featureMentions += 1;
    }

    let score = 0;
    if (wordCount >= 10) score += 1;
    if (wordCount >= 20) score += 1;
    if (hasCausal) score += 1;
    if (featureMentions >= 1) score += 1;
    if (featureMentions >= 2) score += 1;
    if (hasDiff) score += 1;

    const tips = [];
    if (wordCount < 10) tips.push("Add one more sentence to connect findings → diagnosis.");
    if (!hasCausal) tips.push("Use causal language (e.g., “consistent with / suggests / because”).");
    if (featureMentions === 0) tips.push("Name 1–2 key features explicitly in your justification.");
    if (!hasDiff) tips.push("Optionally mention one alternative and why it’s less likely.");

    return { score, tips };
  }

  function renderAssessmentResultsAndFeedback(payload) {
    const box = $("aiFeedbackBox");
    if (!box) return;

    const {
      studentDxLabel, goldDxLabel, correctDx,
      selectedFeatureLabels, missingLabels, extraLabels,
      coveragePct, topSimPct, confusableDxLabel, justificationEval,
      aiFeedbackText, showTemplateText
    } = payload;

    const tag = (txt) =>
      `<span style="display:inline-block;padding:2px 8px;border:1px solid rgba(15,23,42,0.12);border-radius:999px;font-size:12px;margin-right:6px;margin-top:6px;background:rgba(255,255,255,0.95);">${escapeHtml(txt)}</span>`;
    const listTags = (arr) => (Array.isArray(arr) && arr.length) ? arr.map(x => tag(x)).join(" ") : tag("None");

    // Original rubric-style results (like the old UI)
    const header = `
      <div style="font-weight:950;">Assessment results</div>
      <div style="margin-top:8px;">
        ${tag(`Top similarity: ${topSimPct}%`)}
        ${tag(`Dx match: ${correctDx ? "✅" : "❌"}`)}
        ${tag(`Feature coverage: ${coveragePct}%`)}
        ${tag(`Justification: ${justificationEval.score}/6`)}
      </div>
    `;

    const yourAnswer = `
      <div style="margin-top:10px;">
        <div style="font-weight:900;">Your answer</div>
        <div style="color:#475569;"><strong>Diagnosis:</strong> ${escapeHtml(studentDxLabel)}</div>
        <div style="color:#475569;"><strong>Selected features:</strong> ${
          selectedFeatureLabels.length
            ? escapeHtml(selectedFeatureLabels.slice(0,6).join(", ")) + (selectedFeatureLabels.length > 6 ? "…" : "")
            : "(none)"
        }</div>
      </div>
    `;

    const icopMatching = `
      <div style="margin-top:10px;">
        <div style="font-weight:900;">ICOP matching</div>
        <div style="color:#475569;"><strong>Matched diagnosis:</strong> ${escapeHtml(goldDxLabel)}</div>
        <div style="color:#475569;"><strong>Confusable alternative:</strong> ${escapeHtml(confusableDxLabel || "(none identified)")}</div>
      </div>
    `;

    const missingExtra = `
      <div style="margin-top:10px;">
        <div style="font-weight:900;">Missing key feature(s)</div>
        <div>${listTags(missingLabels)}</div>
      </div>
      <div style="margin-top:10px;">
        <div style="font-weight:900;">Extra / less relevant feature(s)</div>
        <div>${listTags(extraLabels)}</div>
      </div>
    `;

    const justificationCoaching = `
      <div style="margin-top:10px;">
        <div style="font-weight:900;">Justification coaching</div>
        <ul style="margin:6px 0 0 18px;">
          ${justificationEval.tips.map(t => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </div>
    `;

    const aiSection = aiFeedbackText
      ? `
        <div style="margin-top:12px;">
          <div style="font-weight:950;">AI coaching</div>
          <div style="margin-top:8px;color:#475569;line-height:1.8;">${renderSafeInlineMarkdown(aiFeedbackText)}</div>
        </div>
      `
      : "";

    const templateSection = (!aiFeedbackText && showTemplateText)
      ? `
        <div style="margin-top:12px;">
          <div style="font-weight:950;">Model answer template</div>
          <div style="margin-top:8px;color:#475569;border:1px solid rgba(15,23,42,0.10);border-radius:12px;padding:10px;background:rgba(255,255,255,0.95);white-space:pre-wrap;">
            ${escapeHtml(showTemplateText)}
          </div>
        </div>
      `
      : "";

    box.innerHTML = header + yourAnswer + icopMatching + missingExtra + justificationCoaching + aiSection + templateSection;
  }

  // ---------- Confusable alternative ----------
  function jaccard(a, b) {
    const A = new Set(a || []);
    const B = new Set(b || []);
    const inter = [...A].filter(x => B.has(x)).length;
    const union = new Set([...A, ...B]).size;
    return union === 0 ? 0 : inter / union;
  }

  function findConfusableAlternative(selectedSymptoms, goldDx) {
    const dxList = getAssessableDxNodes().map(d => d.id).filter(id => id !== goldDx);
    let best = null;
    for (const dx of dxList) {
      const expected = getDiagnosisFeatureSet(dx);
      const score = jaccard(selectedSymptoms, expected);
      if (!best || score > best.score) best = { dx, score };
    }
    if ((!best || best.score === 0) && typeof CONFUSABLE_MAP !== "undefined" && CONFUSABLE_MAP[goldDx]) {
      return { dx: CONFUSABLE_MAP[goldDx], score: 0 };
    }
    return best;
  }

  // ---------- CSV logging ----------
  function logAttempt(record) {
    const key = "icop_demo_attempts";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    prev.push(record);
    localStorage.setItem(key, JSON.stringify(prev));
  }

  function exportAttemptsCsv() {
    const key = "icop_demo_attempts";
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    if (!rows.length) return alert("No attempts saved yet.");

    const header = [
      "timestamp","student_id","scenario_id","scenario_note",
      "retrieved_top_dx","top_similarity","student_dx","correct",
      "selected_features","missing_features","extra_features","confusable_dx","justification"
    ];

    const escapeCsv = (v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [
      header.join(","),
      ...rows.map(r => header.map(h => escapeCsv(r[h])).join(","))
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "icop_assessment_attempts.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  $("exportCsvBtn")?.addEventListener("click", exportAttemptsCsv);

  // ---------- Assessment submit ----------
  $("submitAssessmentBtn")?.addEventListener("click", async () => {
    const scenarioNote = ($("noteAssess")?.value || $("note")?.value || "").trim();
    const scenarioId = ($("caseSelectAssess")?.value || $("caseSelect")?.value || "").trim();

    const aiBox = $("aiFeedbackBox");
    if (!scenarioNote) {
      if (aiBox) aiBox.textContent = "Please select or paste a scenario note first.";
      return;
    }

    const studentDx = ($("studentDiagnosis")?.value || "").trim();
    if (!studentDx) {
      if (aiBox) aiBox.textContent = "Please select a student diagnosis.";
      return;
    }

    const selected = getSelectedSymptoms();

    const chosenScenario = (typeof DEMO_NOTES !== "undefined" && scenarioId)
      ? DEMO_NOTES.find(x => x.id === scenarioId)
      : null;
    const goldDx = chosenScenario?.goldDiagnosisNodeId;
    if (!goldDx) {
      if (aiBox) aiBox.textContent = "Missing ground truth diagnosis for this scenario. Please select a scenario from the dropdown.";
      return;
    }

    setKpi("kpiTopSim", "—");
    setKpi("kpiDx", nodeLabel(goldDx));
    highlightDiagnosisPathAndFeatures(goldDx);

    const justification = ($("justification")?.value || "").trim();

    const similarDetails = $("similarCaseDetails");
    const similarBox = $("similarCaseBox");
    if (similarDetails) similarDetails.style.display = "none";
    if (similarBox) similarBox.textContent = "—";

    if (aiBox) aiBox.textContent = "Giving feedback…";

    // Timeout controller — Render free tier can be slow on cold start
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const resp = await fetch(BACKEND_URL + "/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          scenarioId,
          scenarioNote,
          goldDiagnosisNodeId: goldDx,
          studentDiagnosisNodeId: studentDx,
          selectedFeatureNodeIds: selected,
          justification,
          // Ask for more than 2 so the server can skip cases with repeated "[After x days]" tags
          // and still return up to 2 acceptable cases.
          similarK: 8
        })
      });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);
      const api = await resp.json();

      const sim0 = (api?.similarCases && api.similarCases[0]) ? api.similarCases[0] : null;
      if (sim0) setKpi("kpiTopSim", `${Math.round((sim0.score || 0) * 100)}%`);

      // Compute original rubric results client-side (as before)
      const expected = getDiagnosisFeatureSet(goldDx);
      const missing = expected.filter(x => !selected.includes(x));
      const extra = selected.filter(x => !expected.includes(x));
      const coverage = expected.length ? (expected.length - missing.length) / expected.length : 0;
      const correctDx = (studentDx === goldDx);
      const confusable = findConfusableAlternative(selected, goldDx);
      const expectedLabels = expected.map(nodeLabel);
      const justificationEval = scoreJustification(justification, expectedLabels);

      const fb = api?.feedback || {};
      const aiFeedbackText = (fb && typeof fb.text === "string") ? fb.text.trim() : "";
      const showTemplateText = (fb?.type === "template_fallback" && aiFeedbackText) ? aiFeedbackText : "";

      renderAssessmentResultsAndFeedback({
        studentDxLabel: nodeLabel(studentDx),
        goldDxLabel: nodeLabel(goldDx),
        correctDx,
        selectedFeatureLabels: selected.map(nodeLabel),
        missingLabels: missing.map(nodeLabel),
        extraLabels: extra.map(nodeLabel),
        coveragePct: Math.round(coverage * 100),
        topSimPct: sim0 ? Math.round((sim0.score || 0) * 100) : 0,
        confusableDxLabel: confusable?.dx ? nodeLabel(confusable.dx) : "",
        justificationEval,
        aiFeedbackText: (fb?.type === "template_fallback") ? "" : aiFeedbackText,
        showTemplateText: (fb?.type === "template_fallback") ? aiFeedbackText : ""
      });

      // Similar cases collapsible (show top 2 with selector)
      const similarCases = api?.similarCases || [];
      if (similarDetails && similarCases.length > 0) {
        similarDetails.style.display = "";
        similarDetails.open = false;

        const selector = $("similarCaseSelector");
        const similarBox = $("similarCaseBox");

        const maxToShow = Math.min(2, similarCases.length);

        if (selector) {
          selector.innerHTML = "";
          for (let i = 0; i < maxToShow; i++) {
            const opt = document.createElement("option");
            opt.value = String(i);
            opt.textContent = `Case ${i + 1} (similarity: ${Math.round((similarCases[i].score || 0) * 100)}%)`;
            selector.appendChild(opt);
          }
          selector.style.display = (maxToShow >= 2) ? "" : "none";
        }

        const renderSelectedCase = (idx) => {
          if (!similarBox) return;
          const c = similarCases[idx] || similarCases[0];
          const formattedText = (c?.text || "")
            .split("\n")
            .map(line => escapeHtml(line))
            .join("<br>");
          similarBox.innerHTML = `
            <div style="font-weight:900;">Similar case</div>
            <div style="margin-top:6px;line-height:1.6;white-space:pre-wrap;">${formattedText}</div>
            <div style="margin-top:8px;color:var(--muted);font-size:13px;">Similarity: ${Math.round((c?.score || 0) * 100)}%</div>
          `;
        };

        renderSelectedCase(0);

        if (selector && maxToShow >= 2) {
          selector.onchange = (e) => renderSelectedCase(parseInt(e.target.value, 10) || 0);
        }
      }

      logAttempt({
        timestamp: new Date().toISOString(),
        student_id: ($("studentId")?.value || "").trim(),
        scenario_id: scenarioId,
        scenario_note: scenarioNote,
        retrieved_top_dx: goldDx,
        top_similarity: String(sim0?.score ?? ""),
        student_dx: studentDx,
        correct: String(correctDx),
        selected_features: selected.join(";"),
        missing_features: missing.join(";"),
        extra_features: extra.join(";"),
        confusable_dx: confusable?.dx || "",
        justification
      });
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn("Backend unreachable, falling back to client-side rubric results.", e);

      // ── Client-side fallback (no AI feedback, TF-IDF similar cases) ──
      const expected = getDiagnosisFeatureSet(goldDx);
      const missing = expected.filter(x => !selected.includes(x));
      const extra = selected.filter(x => !expected.includes(x));
      const coverage = expected.length ? (expected.length - missing.length) / expected.length : 0;
      const correctDx = (studentDx === goldDx);
      const confusable = findConfusableAlternative(selected, goldDx);
      const expectedLabels = expected.map(nodeLabel);
      const justificationEval = scoreJustification(justification, expectedLabels);

      const goldDxLabel = nodeLabel(goldDx);
      const studentDxLabel = nodeLabel(studentDx);
      const confusableDxLabel = confusable?.dx ? nodeLabel(confusable.dx) : "";

      // Template fallback text (same as server-side fallback)
      const templateText =
        `Given the key findings, this presentation is most consistent with ${goldDxLabel}. ` +
        `This is supported by the core feature pattern; an alternative such as ${confusableDxLabel || "a nearby ICOP category"} ` +
        `is less likely given the overall feature profile.`;

      // No similar-case retrieval in fallback mode (we do NOT use TF-IDF).
      const topSim = 0;
      setKpi("kpiTopSim", "—");

      renderAssessmentResultsAndFeedback({
        studentDxLabel,
        goldDxLabel,
        correctDx,
        selectedFeatureLabels: selected.map(nodeLabel),
        missingLabels: missing.map(nodeLabel),
        extraLabels: extra.map(nodeLabel),
        coveragePct: Math.round(coverage * 100),
        topSimPct: Math.round(topSim * 100),
        confusableDxLabel,
        justificationEval,
        aiFeedbackText: "",
        showTemplateText: templateText
      });

      // Hide similar cases panel in fallback mode
      const similarDetails = $("similarCaseDetails");
      if (similarDetails) similarDetails.style.display = "none";

      // Add a note that AI feedback was unavailable
      const noteDiv = document.createElement("div");
      noteDiv.style.cssText = "margin-top:10px;padding:8px 12px;border-radius:10px;background:rgba(255,184,28,0.12);color:#92400e;font-size:13px;font-weight:700;";
      // noteDiv.textContent = "AI feedback unavailable — showing local rubric results.";
      if (aiBox) aiBox.appendChild(noteDiv);

      logAttempt({
        timestamp: new Date().toISOString(),
        student_id: ($("studentId")?.value || "").trim(),
        scenario_id: scenarioId,
        scenario_note: scenarioNote,
        retrieved_top_dx: goldDx,
        top_similarity: String(topSim),
        student_dx: studentDx,
        correct: String(correctDx),
        selected_features: selected.join(";"),
        missing_features: missing.join(";"),
        extra_features: extra.join(";"),
        confusable_dx: confusable?.dx || "",
        justification
      });
    }
  });

  // ---------- Init ----------
  populateDiagnosisSelect();
  populateSymptomChecklist();

  function populateCaseSelector(selectId, noteId) {
    const sel = $(selectId);
    const noteBox = $(noteId);
    if (!sel || !noteBox) return;
    if (typeof DEMO_NOTES === "undefined") return;

    sel.innerHTML = `<option value="">Choose a case…</option>`;
    for (const item of DEMO_NOTES) {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.title;
      sel.appendChild(opt);
    }

    sel.addEventListener("change", () => {
      const chosen = DEMO_NOTES.find(x => x.id === sel.value);
      if (!chosen) return;
      noteBox.value = chosen.note || "";
      setKpi("kpiTopSim", "—");
      setKpi("kpiDx", "—");
      resetHighlights();
      const ai = $("aiFeedbackBox");
      if (ai) ai.textContent = "Submit to see feedback.";
    });
  }

  populateCaseSelector("caseSelect", "note");
  populateCaseSelector("caseSelectAssess", "noteAssess");

  if (cy) cy.fit(cy.elements(), 80);
});
