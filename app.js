// app.js
// ---------- Safety checks ----------
if (typeof cytoscape === "undefined") {
  throw new Error("Cytoscape is not loaded. Check the script tag in index.html.");
}
if (typeof KG_NODES === "undefined" || typeof KG_EDGES === "undefined") {
  throw new Error("KG_NODES / KG_EDGES not found. Check that data.js loads BEFORE app.js.");
}
if (typeof CASE_LIBRARY === "undefined") {
  throw new Error("CASE_LIBRARY not found. Check data.js.");
}

// ---------- Graph setup (Cytoscape) ----------
const cy = cytoscape({
  container: document.getElementById("cy"),
  elements: [...KG_NODES, ...KG_EDGES],
  style: [
    {
      selector: "node",
      style: {
        "label": "data(label)",
        "font-size": 12,
        "text-wrap": "wrap",
        "text-max-width": 150,
        "text-valign": "center",
        "text-halign": "center",
        "border-width": 2,
        "border-color": "#333",
        "background-color": "#f9fafb",
        "width": 70,
        "height": 70,
        "padding": 10
      }
    },
    {
      selector: 'node[type="icop"]',
      style: {
        "shape": "round-rectangle",
        "background-color": "#dbeafe",
        "border-color": "#2563eb",
        "width": 95,
        "height": 70
      }
    },
    {
      selector: 'node[type="symptom"]',
      style: {
        "shape": "ellipse",
        "background-color": "#fef3c7",
        "border-color": "#f59e0b",
        "width": 78,
        "height": 78
      }
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "width": 2,
        "line-color": "#cfcfcf",
        "target-arrow-shape": "triangle",
        "target-arrow-color": "#cfcfcf",
        "label": "data(rel)",
        "font-size": 9,
        "text-rotation": "autorotate",
        "text-margin-y": -6,
        "color": "#777"
      }
    },
    {
      selector: ".hlNode",
      style: {
        "border-width": 4,
        "border-color": "#000",
        "background-color": "#86efac"
      }
    },
    {
      selector: ".hlEdge",
      style: {
        "line-color": "#000",
        "target-arrow-color": "#000",
        "width": 4
      }
    },
    {
      selector: ".dim",
      style: { "opacity": 0.20 }
    }
  ],
  layout: {
    name: "breadthfirst",
    directed: true,
    padding: 60,
    spacingFactor: 1.6,
    animate: false
  }
});

// ---------- Highlight helpers ----------
function resetHighlights() {
  cy.elements().removeClass("hlNode hlEdge dim");
}

function highlightDiagnosisPathAndSymptoms(diagnosisNodeId) {
  resetHighlights();
  cy.elements().addClass("dim");

  const diag = cy.getElementById(diagnosisNodeId);
  if (!diag || diag.empty()) return;

  diag.removeClass("dim").addClass("hlNode");

  let current = diag;
  while (true) {
    const incomingParentEdges = current.incomers('edge[rel="parent_of"]');
    if (incomingParentEdges.length === 0) break;

    const e = incomingParentEdges[0];
    const parentNode = e.source();

    e.removeClass("dim").addClass("hlEdge");
    parentNode.removeClass("dim").addClass("hlNode");
    current = parentNode;
  }

  const symptomEdges = diag.outgoers('edge[rel="has_symptom"]');
  symptomEdges.removeClass("dim").addClass("hlEdge");
  symptomEdges.targets().removeClass("dim").addClass("hlNode");

  const highlighted = cy.elements(".hlNode, .hlEdge");
  if (highlighted.length > 0) cy.fit(highlighted, 70);
}

// ---------- TF-IDF + cosine similarity ----------
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t && t.length > 2);
}

function buildVocab(docsTokens) {
  const vocab = new Map();
  for (const tokens of docsTokens) {
    for (const t of tokens) if (!vocab.has(t)) vocab.set(t, vocab.size);
  }
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

function toPercent(x) {
  return Math.round(x * 1000) / 10;
}

// ---------- Utility ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function prettyDx(nodeId) {
  const map = {
    icop_l3_myalgia: "ICOP L3: Myalgia",
    icop_l3_arthralgia: "ICOP L3: Arthralgia",
    icop_l3_disc: "ICOP L3: Disc displacement (w/ reduction)"
  };
  return map[nodeId] || nodeId || "(none)";
}

// =========================
// Assessment (Mode A)
// =========================
let CURRENT_DEMO_CASE = null;

function showFeedback(html) {
  const box = document.getElementById("feedbackBox");
  if (!box) return;
  box.innerHTML = html;
}

function renderSymptomChecklist() {
  const box = document.getElementById("symptomChecklist");
  if (!box) return;

  if (typeof SYMPTOM_OPTIONS === "undefined") {
    box.innerHTML = `<div class="muted">SYMPTOM_OPTIONS not found in data.js</div>`;
    return;
  }

  box.innerHTML = "";
  for (const s of SYMPTOM_OPTIONS) {
    const id = `chk_${s.id}`;
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    row.style.cursor = "pointer";

    row.innerHTML = `
      <input type="checkbox" id="${id}" data-symptom="${s.id}" />
      <span>${escapeHtml(s.label)}</span>
    `;
    box.appendChild(row);
  }
}

function getSelectedSymptoms() {
  const box = document.getElementById("symptomChecklist");
  if (!box) return [];
  const checks = box.querySelectorAll('input[type="checkbox"][data-symptom]');
  const selected = [];
  checks.forEach(ch => { if (ch.checked) selected.push(ch.getAttribute("data-symptom")); });
  return selected;
}

function setSelectedSymptoms(symptomIds) {
  const box = document.getElementById("symptomChecklist");
  if (!box) return;
  const set = new Set(symptomIds || []);
  const checks = box.querySelectorAll('input[type="checkbox"][data-symptom]');
  checks.forEach(ch => {
    const sid = ch.getAttribute("data-symptom");
    ch.checked = set.has(sid);
  });
}

function symptomLabel(symptomId) {
  if (typeof SYMPTOM_OPTIONS === "undefined") return symptomId;
  const hit = SYMPTOM_OPTIONS.find(s => s.id === symptomId);
  return hit ? hit.label : symptomId;
}

function scoreSymptoms(selected, gold) {
  const sel = new Set(selected || []);
  const g = new Set(gold || []);
  const overlap = [...sel].filter(x => g.has(x)).length;

  const precision = sel.size === 0 ? 0 : overlap / sel.size;
  const recall = g.size === 0 ? 0 : overlap / g.size;
  const f1 = (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const missing = [...g].filter(x => !sel.has(x));
  const extra = [...sel].filter(x => !g.has(x));

  return { overlap, precision, recall, f1, missing, extra };
}

function jaccardSimilarity(a, b) {
  const A = new Set(a || []);
  const B = new Set(b || []);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

function getDiagnosisSymptomSet(dxNodeId) {
  const dx = cy.getElementById(dxNodeId);
  if (!dx || dx.empty()) return [];
  const edges = dx.outgoers('edge[rel="has_symptom"]');
  return edges.targets().map(n => n.id());
}

function suggestConfusableAlternative(selectedSymptoms, goldDx) {
  const candidates = ["icop_l3_myalgia", "icop_l3_arthralgia", "icop_l3_disc"]
    .filter(x => x !== goldDx);

  let best = null;
  for (const dx of candidates) {
    const expected = getDiagnosisSymptomSet(dx);
    const score = jaccardSimilarity(selectedSymptoms, expected);
    if (!best || score > best.score) best = { dx, score, expected };
  }

  if (!best || best.score === 0) {
    const fallback = (typeof CONFUSABLE_MAP !== "undefined" && CONFUSABLE_MAP[goldDx]) ? CONFUSABLE_MAP[goldDx] : null;
    return fallback ? { dx: fallback, score: 0, expected: getDiagnosisSymptomSet(fallback) } : null;
  }

  return best;
}

function logAttempt(record) {
  const key = "icop_assessment_log_v1";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  existing.push(record);
  localStorage.setItem(key, JSON.stringify(existing));
}

function csvCell(val) {
  const s = String(val ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const key = "icop_assessment_log_v1";
  const rows = JSON.parse(localStorage.getItem(key) || "[]");
  if (rows.length === 0) {
    alert("No assessment logs found yet.");
    return;
  }

  const headers = [
    "timestamp",
    "studentId",
    "caseId",
    "caseTitle",
    "studentDiagnosis",
    "goldDiagnosis",
    "diagnosisCorrect",
    "symptomPrecision",
    "symptomRecall",
    "symptomF1",
    "selectedSymptoms",
    "goldSymptoms",
    "missingSymptoms",
    "extraSymptoms",
    "justification"
  ];

  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => csvCell(r[h])).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "icop_clinical_reasoning_assessment_log.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setCurrentDemoCaseById(demoId) {
  if (typeof DEMO_NOTES === "undefined") return;
  CURRENT_DEMO_CASE = DEMO_NOTES.find(x => x.id === demoId) || null;

  // reset assessment fields
  const dxSel = document.getElementById("studentDiagnosis");
  const just = document.getElementById("justification");
  if (dxSel) dxSel.value = "";
  if (just) just.value = "";
  setSelectedSymptoms([]);
  showFeedback("");
}

function submitAssessment() {
  if (!CURRENT_DEMO_CASE) {
    alert("Please choose a case from the dropdown first.");
    return;
  }

  const studentId = (document.getElementById("studentId")?.value || "").trim();
  const studentDx = document.getElementById("studentDiagnosis")?.value || "";
  const justification = (document.getElementById("justification")?.value || "").trim();
  const selectedSymptoms = getSelectedSymptoms();

  if (!studentDx) { alert("Please select a diagnosis."); return; }
  if (selectedSymptoms.length === 0) { alert("Please select at least 1 key feature."); return; }
  if (justification.length < 10) { alert("Please write a short justification (at least ~1 sentence)."); return; }

  const goldDx = CURRENT_DEMO_CASE.goldDiagnosisNodeId;
  const goldSymptoms = CURRENT_DEMO_CASE.goldSymptoms || [];

  const dxCorrect = (studentDx === goldDx);
  const sym = scoreSymptoms(selectedSymptoms, goldSymptoms);

  // Log record
  const record = {
    timestamp: new Date().toISOString(),
    studentId,
    caseId: CURRENT_DEMO_CASE.id,
    caseTitle: CURRENT_DEMO_CASE.title,
    studentDiagnosis: studentDx,
    goldDiagnosis: goldDx,
    diagnosisCorrect: dxCorrect,
    symptomPrecision: sym.precision.toFixed(3),
    symptomRecall: sym.recall.toFixed(3),
    symptomF1: sym.f1.toFixed(3),
    selectedSymptoms: selectedSymptoms.join("|"),
    goldSymptoms: goldSymptoms.join("|"),
    missingSymptoms: sym.missing.join("|"),
    extraSymptoms: sym.extra.join("|"),
    justification
  };
  logAttempt(record);

  // Formative confusable alternative
  const conf = suggestConfusableAlternative(selectedSymptoms, goldDx);
  const missingNice = sym.missing.map(symptomLabel);
  const extraNice = sym.extra.map(symptomLabel);

  let confHtml = "";
  if (conf && conf.dx) {
    const confExpected = conf.expected || [];
    const overlap = selectedSymptoms.filter(x => confExpected.includes(x)).map(symptomLabel);
    confHtml = `
      <div style="margin-top:10px;">
        <div><strong>Confusable alternative:</strong> ${prettyDx(conf.dx)}</div>
        <div class="muted">
          Why it’s plausible: you selected ${overlap.length ? `<strong>${overlap.join(", ")}</strong>` : "features that overlap with this diagnosis"}.
        </div>
        <div class="muted">
          Tip: compare what distinguishes <strong>${prettyDx(goldDx)}</strong> vs <strong>${prettyDx(conf.dx)}</strong> (missing discriminators matter).
        </div>
      </div>
    `;
  }

  const scoreMsg = `
    <div style="padding:10px;border:1px solid #eee;border-radius:10px;">
      <div><strong>Diagnosis:</strong> ${dxCorrect ? "✅ Correct" : "❌ Not correct"}</div>
      <div class="muted">Your diagnosis: <strong>${prettyDx(studentDx)}</strong></div>
      <div class="muted">Expected: <strong>${prettyDx(goldDx)}</strong></div>

      <div style="margin-top:8px;"><strong>Key feature match:</strong></div>
      <div class="muted">Precision: ${(sym.precision*100).toFixed(1)}% • Recall: ${(sym.recall*100).toFixed(1)}% • F1: ${(sym.f1*100).toFixed(1)}%</div>

      ${missingNice.length
        ? `<div class="muted" style="margin-top:6px;"><strong>Missing key feature(s):</strong> ${missingNice.join(", ")}</div>`
        : `<div class="muted" style="margin-top:6px;"><strong>Missing key feature(s):</strong> None ✅</div>`
      }

      ${extraNice.length
        ? `<div class="muted"><strong>Extra selected (less discriminating):</strong> ${extraNice.join(", ")}</div>`
        : ""
      }

      ${confHtml}

      <div class="muted" style="margin-top:10px;">Saved to local log. Use <strong>Export CSV</strong> to download.</div>
    </div>
  `;
  showFeedback(scoreMsg);

  // Mode A: show correct path after submission
  highlightDiagnosisPathAndSymptoms(goldDx);
}

function initAssessmentUI() {
  renderSymptomChecklist();

  const submitBtn = document.getElementById("submitAssessmentBtn");
  const exportBtn = document.getElementById("exportCsvBtn");

  if (submitBtn) submitBtn.addEventListener("click", submitAssessment);
  if (exportBtn) exportBtn.addEventListener("click", exportCsv);
}

// ---------- UI: buttons ----------
document.getElementById("resetBtn").addEventListener("click", () => {
  resetHighlights();
  document.getElementById("results").innerHTML = "";
  showFeedback("");
});

// Optional: Run similarity + highlight (teaching mode)
document.getElementById("runBtn").addEventListener("click", () => {
  const note = document.getElementById("note").value.trim();

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

  const top = scored.slice(0, 3);
  renderResults(top);

  if (top.length > 0) highlightDiagnosisPathAndSymptoms(top[0].diagnosisNodeId);
});

// ---------- Results renderer ----------
function renderResults(topCases) {
  const div = document.getElementById("results");
  if (!topCases || topCases.length === 0) {
    div.innerHTML = "<div class='muted'>No results.</div>";
    return;
  }

  const rows = topCases.map((c, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>
        <div style="font-weight:600">${escapeHtml(c.title)}</div>
        <div class="muted">${escapeHtml(c.text)}</div>
        <div class="muted" style="margin-top:6px;">
          Diagnosis node: <span class="pill">${escapeHtml(c.diagnosisNodeId)}</span>
        </div>
      </td>
      <td style="white-space:nowrap; font-weight:700;">${toPercent(c.sim)}%</td>
      <td><button data-diag="${c.diagnosisNodeId}">Highlight</button></td>
    </tr>
  `).join("");

  div.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Retrieved case</th>
          <th>Similarity</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  div.querySelectorAll("button[data-diag]").forEach(btn => {
    btn.addEventListener("click", () => {
      highlightDiagnosisPathAndSymptoms(btn.getAttribute("data-diag"));
    });
  });
}

// ---------- Case selector ----------
function populateCaseSelector() {
  const sel = document.getElementById("caseSelect");
  if (!sel) return;

  if (typeof DEMO_NOTES === "undefined") {
    console.warn("DEMO_NOTES not found. Ensure data.js loads before app.js.");
    return;
  }

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

    document.getElementById("note").value = chosen.note;
    resetHighlights();
    document.getElementById("results").innerHTML = "";
    showFeedback("");

    // ✅ critical: link assessment answer key to selected case
    setCurrentDemoCaseById(sel.value);
  });
}

// Run after DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  populateCaseSelector();
  initAssessmentUI();
});
