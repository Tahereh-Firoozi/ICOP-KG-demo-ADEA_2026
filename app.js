// app.js (multi-page safe)
// Requires: KG_NODES, KG_EDGES, CASE_LIBRARY
// Optional: DEMO_NOTES, CONFUSABLE_MAP

if (typeof cytoscape === "undefined") {
  throw new Error("Cytoscape is not loaded.");
}
if (typeof KG_NODES === "undefined" || typeof KG_EDGES === "undefined") {
  throw new Error("KG_NODES / KG_EDGES not found. Ensure data.js loads BEFORE app.js.");
}
if (typeof CASE_LIBRARY === "undefined") {
  throw new Error("CASE_LIBRARY not found. Ensure data.js loads BEFORE app.js.");
}

window.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // ---------- Cytoscape init (only if #cy exists) ----------
  const cyContainer = $("cy");
  const cy = cyContainer
    ? cytoscape({
        container: cyContainer,
        elements: [...KG_NODES, ...KG_EDGES],
        style: [
          { selector: "node", style: {
              label: "data(label)",
              "text-wrap": "wrap",
              "text-max-width": 260,
              "text-valign": "center",
              "text-halign": "center",
              "font-size": 16,
              "font-weight": 700,
              "border-width": 3,
              "border-color": "#0f172a",
              color: "#0f172a",
              "background-color": "#fff",
              width: 180,
              height: 120,
              padding: 14
          }},
          { selector: 'node[type="icop"]', style: { shape: "round-rectangle", "border-width": 4 } },
          { selector: 'node[type="icop"][level = 1]', style: { "background-color": "#e0f2fe", "border-color": "#0284c7", "font-size": 22, width: 260, height: 150 } },
          { selector: 'node[type="icop"][level = 2]', style: { "background-color": "#dcfce7", "border-color": "#16a34a", "font-size": 20, width: 240, height: 140 } },
          { selector: 'node[type="icop"][level = 3]', style: { "background-color": "#fef9c3", "border-color": "#ca8a04", "font-size": 18, width: 225, height: 135 } },
          { selector: 'node[type="icop"][level = 4]', style: { "background-color": "#fae8ff", "border-color": "#a855f7", "font-size": 17, width: 215, height: 132 } },
          { selector: 'node[type="icop"][level >= 5]', style: { "background-color": "#ffe4e6", "border-color": "#e11d48", "font-size": 16, width: 210, height: 128 } },

          { selector: 'node[type="symptom"]', style: {
              shape: "ellipse",
              "background-color": "#fff7ed",
              "border-color": "#fb923c",
              "border-width": 3,
              width: 155,
              height: 155,
              "font-size": 15,
              "font-weight": 700
          }},

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

          { selector: ".hlNode", style: { "border-width": 7, "border-color": "#000", "background-color": "#86efac" } },
          { selector: ".hlEdge", style: { "line-color": "#000", "target-arrow-color": "#000", width: 7 } },
          { selector: ".dim", style: { opacity: 0.15 } }
        ],
        layout: { name: "breadthfirst", directed: true, padding: 90, spacingFactor: 2.3, animate: false }
      })
    : null;

  // ---------- Helpers ----------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  function nodeLabel(id) {
    if (!cy) return id;
    const n = cy.getElementById(id);
    return (!n || n.empty()) ? id : (n.data("label") || id).replace(/\n/g, " ");
  }

  function resetHighlights() {
    if (!cy) return;
    cy.elements().removeClass("hlNode hlEdge dim");
  }

  function highlightDiagnosisPathAndFeatures(dxNodeId) {
    if (!cy) return;
    resetHighlights();
    cy.elements().addClass("dim");

    const dx = cy.getElementById(dxNodeId);
    if (!dx || dx.empty()) return;

    dx.removeClass("dim").addClass("hlNode");

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

    const feats = dx.outgoers('edge[rel="has_symptom"], edge[rel="risk_factor"]');
    feats.removeClass("dim").addClass("hlEdge");
    feats.targets().removeClass("dim").addClass("hlNode");

    const highlighted = cy.elements(".hlNode, .hlEdge");
    if (highlighted.length > 0) cy.fit(highlighted, 90);
  }

  // ---------- KPIs ----------
  function setKpi(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  if (cy) {
    setKpi("kpiNodes", String(cy.nodes().length));
    setKpi("kpiEdges", String(cy.edges().length));
  }
  setKpi("kpiTopSim", "—");
  setKpi("kpiDx", "—");

  $("fitBtn")?.addEventListener("click", () => {
    if (!cy) return;
    cy.fit(cy.elements(), 80);
  });

  // ---------- Dx + feature lists ----------
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

  // ---------- Similarity retrieval (for KPI + gold dx proxy) ----------
  function tokenize(text) {
    return String(text || "")
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

  // ---------- Scenario selectors ----------
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
      // reset KPIs when switching scenario
      setKpi("kpiTopSim", "—");
      setKpi("kpiDx", "—");
      resetHighlights();
    });
  }

  // ---------- AI feedback (rubric-based) ----------
  function scoreJustification(justText, expectedFeatureLabels) {
    const t = String(justText || "").trim();
    if (!t) return { score: 0, flags: ["No justification provided."], tips: ["Add 1–3 sentences linking findings → diagnosis."] };

    const wordCount = t.split(/\s+/).filter(Boolean).length;
    const hasCausal = /\b(because|therefore|thus|since|suggests|consistent with|given)\b/i.test(t);
    const hasContrast = /\b(however|but|although|whereas|rule out|differential)\b/i.test(t);

    // crude “mentions features” by matching a few feature label keywords
    const lower = t.toLowerCase();
    let featureMentions = 0;
    for (const lbl of expectedFeatureLabels.slice(0, 8)) {
      const key = String(lbl).toLowerCase().split(/[\/(),]/)[0].trim();
      if (key && key.length >= 4 && lower.includes(key)) featureMentions += 1;
    }

    let score = 0;
    if (wordCount >= 10) score += 1;
    if (wordCount >= 20) score += 1;
    if (hasCausal) score += 1;
    if (featureMentions >= 1) score += 1;
    if (featureMentions >= 2) score += 1;
    if (hasContrast) score += 1;

    const tips = [];
    if (!hasCausal) tips.push("Use causal language (e.g., “because / consistent with / suggests”).");
    if (featureMentions === 0) tips.push("Explicitly reference 1–2 key features from the scenario.");
    if (!hasContrast) tips.push("Briefly mention a differential or why alternatives are less likely (optional but strong).");
    if (wordCount < 10) tips.push("Add one more sentence to connect findings → diagnosis.");

    const flags = [];
    if (wordCount > 80) flags.push("Justification is long. Aim for 1–3 crisp sentences.");

    return { score, flags, tips };
  }

  function renderAiFeedback({ correctDx, featureCoverage, missingLabels, extraLabels, confusableDxLabel, justificationEval }) {
    const box = $("aiFeedbackBox");
    if (!box) return;

    const covPct = Math.round(featureCoverage * 100);
    const grade =
      (correctDx && covPct >= 70 && justificationEval.score >= 4) ? "Strong" :
      (covPct >= 50 && justificationEval.score >= 3) ? "Adequate" :
      "Needs improvement";

    const tags = [];
    tags.push(`<span class="tag"><strong>Overall:</strong> ${grade}</span>`);
    tags.push(`<span class="tag"><strong>Feature coverage:</strong> ${covPct}%</span>`);
    tags.push(`<span class="tag"><strong>Justification:</strong> ${justificationEval.score}/6</span>`);
    tags.push(`<span class="tag"><strong>Dx match:</strong> ${correctDx ? "✅" : "❌"}</span>`);

    const list = (arr) => (arr.length ? arr.map(x => `<span class="tag">${escapeHtml(x)}</span>`).join(" ") : `<span class="tag">None</span>`);

    box.innerHTML = `
      <div style="font-weight:800;margin-bottom:6px;">AI feedback summary</div>
      <div>${tags.join(" ")}</div>

      <div style="margin-top:10px;">
        <div style="font-weight:700;">What you did well</div>
        <div class="muted">
          ${correctDx ? "Your diagnosis matches the retrieved ICOP mapping." : "You selected a different diagnosis than the retrieved ICOP mapping."}
          ${covPct >= 60 ? " You captured many expected key features." : " Try to select more of the key features expected for this diagnosis."}
        </div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:700;">Missing key feature(s)</div>
        <div>${list(missingLabels)}</div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:700;">Potentially irrelevant / extra feature(s)</div>
        <div>${list(extraLabels)}</div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:700;">Confusable alternative (differential to consider)</div>
        <div class="muted">${confusableDxLabel ? escapeHtml(confusableDxLabel) : "(none identified)"}</div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:700;">Justification coaching</div>
        <div class="muted">
          ${justificationEval.flags.length ? `<div>${justificationEval.flags.map(escapeHtml).join("<br/>")}</div>` : ""}
          <ul style="margin:6px 0 0 18px;">
            ${justificationEval.tips.map(t => `<li>${escapeHtml(t)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  }

  // ---------- Attempts log + CSV ----------
  function logAttempt(record) {
    const key = "icop_demo_attempts";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    prev.push(record);
    localStorage.setItem(key, JSON.stringify(prev));
  }

  function exportAttemptsCsv() {
    const key = "icop_demo_attempts";
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    if (!rows.length) {
      alert("No attempts saved yet.");
      return;
    }

    const header = [
      "timestamp",
      "student_id",
      "scenario_id",
      "scenario_note",
      "retrieved_top_dx",
      "top_similarity",
      "student_dx",
      "correct",
      "selected_features",
      "missing_features",
      "extra_features",
      "confusable_dx",
      "justification"
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

  // ---------- Main page buttons (index.html) ----------
  $("runBtn")?.addEventListener("click", () => {
    const note = ($("note")?.value || "").trim();
    const top = retrieveTopCases(note, 3);

    if (top.length) {
      setKpi("kpiTopSim", `${Math.round(top[0].sim * 100)}%`);
      setKpi("kpiDx", nodeLabel(top[0].diagnosisNodeId));
      highlightDiagnosisPathAndFeatures(top[0].diagnosisNodeId);
    } else {
      setKpi("kpiTopSim", "—");
      setKpi("kpiDx", "—");
      resetHighlights();
    }
  });

  $("resetBtn")?.addEventListener("click", () => {
    resetHighlights();
    setKpi("kpiTopSim", "—");
    setKpi("kpiDx", "—");
  });

  // ---------- Assessment submit ----------
  $("submitAssessmentBtn")?.addEventListener("click", () => {
    // Read scenario from assessment page if present, else from main
    const scenarioNote = ($("noteAssess")?.value || $("note")?.value || "").trim();
    const scenarioId = ($("caseSelectAssess")?.value || $("caseSelect")?.value || "").trim();

    if (!scenarioNote) {
      const box = $("aiFeedbackBox");
      if (box) box.textContent = "Please select or paste a scenario note first.";
      return;
    }

    const studentDx = ($("studentDiagnosis")?.value || "").trim();
    if (!studentDx) {
      const box = $("aiFeedbackBox");
      if (box) box.textContent = "Please select a student diagnosis.";
      return;
    }

    const selected = getSelectedSymptoms();

    // Retrieve top cases from scenario note → proxy “gold”
    const top = retrieveTopCases(scenarioNote, 3);
    const goldDx = top.length ? top[0].diagnosisNodeId : null;
    const topSim = top.length ? top[0].sim : null;

    if (!goldDx) {
      const box = $("aiFeedbackBox");
      if (box) box.textContent = "Could not retrieve a matching case from the scenario note.";
      return;
    }

    setKpi("kpiTopSim", `${Math.round(topSim * 100)}%`);
    setKpi("kpiDx", nodeLabel(goldDx));
    highlightDiagnosisPathAndFeatures(goldDx);

    const expected = getDiagnosisFeatureSet(goldDx);
    const missing = expected.filter(x => !selected.includes(x));
    const extra = selected.filter(x => !expected.includes(x));

    const featureCoverage = expected.length ? (expected.length - missing.length) / expected.length : 0;
    const correctDx = (studentDx === goldDx);

    const missingLabels = missing.map(nodeLabel);
    const extraLabels = extra.map(nodeLabel);

    const confusable = findConfusableAlternative(selected, goldDx);
    const confusableDxLabel = confusable?.dx ? nodeLabel(confusable.dx) : "";

    const expectedLabels = expected.map(nodeLabel);
    const justification = ($("justification")?.value || "").trim();
    const justificationEval = scoreJustification(justification, expectedLabels);

    renderAiFeedback({
      correctDx,
      featureCoverage,
      missingLabels,
      extraLabels,
      confusableDxLabel,
      justificationEval
    });

    logAttempt({
      timestamp: new Date().toISOString(),
      student_id: ($("studentId")?.value || "").trim(),
      scenario_id: scenarioId,
      scenario_note: scenarioNote,
      retrieved_top_dx: goldDx,
      top_similarity: topSim == null ? "" : String(topSim),
      student_dx: studentDx,
      correct: String(correctDx),
      selected_features: selected.join(";"),
      missing_features: missing.join(";"),
      extra_features: extra.join(";"),
      confusable_dx: confusable?.dx || "",
      justification
    });
  });

  // ---------- Initialize UI ----------
  populateDiagnosisSelect();
  populateSymptomChecklist();

  // Populate scenario selectors on both pages if present
  populateCaseSelector("caseSelect", "note");
  populateCaseSelector("caseSelectAssess", "noteAssess");

  if (cy) cy.fit(cy.elements(), 80);
});
