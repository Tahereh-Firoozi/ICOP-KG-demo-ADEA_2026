// app.js
// Works with BOTH pages:
//  - index.html (main graph + similarity demo)
//  - assessment.html (assessment form + optional graph)
//
// Safe if some elements are missing (it checks existence before using).
//
// Requires data.js globals:
// KG_NODES, KG_EDGES, CASE_LIBRARY
// Optional: DEMO_NOTES, CONFUSABLE_MAP

// ---------- Safety checks ----------
if (typeof cytoscape === "undefined") {
  throw new Error("Cytoscape is not loaded. Check the Cytoscape script tag in your HTML.");
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
          // Base
          {
            selector: "node",
            style: {
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
            }
          },

          // ICOP nodes
          {
            selector: 'node[type="icop"]',
            style: {
              shape: "round-rectangle",
              "border-width": 4
            }
          },

          // Level-based colors
          { selector: 'node[type="icop"][level = 1]', style: { "background-color": "#e0f2fe", "border-color": "#0284c7", "font-size": 22, width: 260, height: 150 } },
          { selector: 'node[type="icop"][level = 2]', style: { "background-color": "#dcfce7", "border-color": "#16a34a", "font-size": 20, width: 240, height: 140 } },
          { selector: 'node[type="icop"][level = 3]', style: { "background-color": "#fef9c3", "border-color": "#ca8a04", "font-size": 18, width: 225, height: 135 } },
          { selector: 'node[type="icop"][level = 4]', style: { "background-color": "#fae8ff", "border-color": "#a855f7", "font-size": 17, width: 215, height: 132 } },
          { selector: 'node[type="icop"][level >= 5]', style: { "background-color": "#ffe4e6", "border-color": "#e11d48", "font-size": 16, width: 210, height: 128 } },

          // Symptoms
          {
            selector: 'node[type="symptom"]',
            style: {
              shape: "ellipse",
              "background-color": "#fff7ed",
              "border-color": "#fb923c",
              "border-width": 3,
              width: 155,
              height: 155,
              "font-size": 15,
              "font-weight": 700
            }
          },

          // Edges
          {
            selector: "edge",
            style: {
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
            }
          },
          { selector: 'edge[rel="parent_of"]', style: { width: 5, "line-color": "#94a3b8", "target-arrow-color": "#94a3b8" } },
          { selector: 'edge[rel="has_symptom"]', style: { "line-style": "dashed", "line-dash-pattern": [6, 6] } },
          { selector: 'edge[rel="risk_factor"]', style: { "line-style": "dotted" } },

          // Highlighting
          { selector: ".hlNode", style: { "border-width": 7, "border-color": "#000", "background-color": "#86efac" } },
          { selector: ".hlEdge", style: { "line-color": "#000", "target-arrow-color": "#000", width: 7 } },
          { selector: ".dim", style: { opacity: 0.15 } }
        ],
        layout: {
          name: "breadthfirst",
          directed: true,
          padding: 90,
          spacingFactor: 2.3,
          animate: false
        }
      })
    : null;

  // ---------- Helpers (safe even if cy is null) ----------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
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

    // features (symptoms + risk)
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

  // ---------- Fit button ----------
  $("fitBtn")?.addEventListener("click", () => {
    if (!cy) return;
    cy.fit(cy.elements(), 80);
  });

  // ---------- Diagnosis + symptom lists (assessment) ----------
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
    const dxList = getAssessableDxNodes();

    for (const d of dxList) {
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

    const items = getAllFeatureNodes();
    box.innerHTML = "";

    for (const it of items) {
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

  // ---------- Similarity retrieval ----------
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

  // We still compute and store top similarity KPI, even though results/chart are hidden on index.html
  function setTopSimilarityKpi(sim) {
    const val = (sim == null) ? "—" : `${Math.round(sim * 100)}%`;
    setKpi("kpiTopSim", val);
  }

  // ---------- Case selector (main page) ----------
  function populateCaseSelector() {
    const sel = $("caseSelect");
    const noteBox = $("note");
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

      noteBox.value = chosen.note;
      resetHighlights();
      setTopSimilarityKpi(null);
      setKpi("kpiDx", "—");
      const fb = $("feedbackBox");
      if (fb) fb.innerHTML = "";
    });
  }

  // ---------- Assessment (Formative) ----------
  let lastTop1Dx = null;

  const DEMO_GOLD_MAP = {
    demo_001: "icop_3_2_2",
    demo_002: "icop_2_1_2",
    demo_003: "icop_3_2_2_1_1"
  };

  function computeGoldDx() {
    if (lastTop1Dx) return lastTop1Dx;
    const sel = $("caseSelect");
    if (sel && sel.value && DEMO_GOLD_MAP[sel.value]) return DEMO_GOLD_MAP[sel.value];
    return null;
  }

  function showFeedback(html) {
    const box = $("feedbackBox");
    if (!box) return;
    box.innerHTML = html;
  }

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
      "gold_dx",
      "student_dx",
      "correct",
      "selected_features",
      "missing_features",
      "confusable_dx",
      "justification",
      "note_text"
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

  // Submit assessment (only if button exists on this page)
  $("submitAssessmentBtn")?.addEventListener("click", () => {
    const goldDx = computeGoldDx();
    if (!goldDx) {
      showFeedback(`<div><strong>Gold diagnosis not available.</strong><br/>
      Run similarity first, or define a gold mapping for the selected case.</div>`);
      return;
    }

    const studentDx = $("studentDiagnosis")?.value || "";
    if (!studentDx) {
      showFeedback(`<div><strong>Please select a diagnosis.</strong></div>`);
      return;
    }

    const selected = getSelectedSymptoms();
    const expected = getDiagnosisFeatureSet(goldDx);

    const missing = expected.filter(x => !selected.includes(x));
    const correct = (studentDx === goldDx);

    const confusable = findConfusableAlternative(selected, goldDx);

    const fb = `
      <div style="padding:10px;border:1px solid #eee;border-radius:10px;background:#fff;">
        <div><strong>Result:</strong> ${correct ? "✅ Correct diagnosis" : "❌ Incorrect diagnosis"}</div>
        <div style="margin-top:6px;"><strong>Gold diagnosis:</strong> ${escapeHtml(nodeLabel(goldDx))}</div>
        <div><strong>Your diagnosis:</strong> ${escapeHtml(nodeLabel(studentDx))}</div>

        <div style="margin-top:10px;"><strong>Missing key feature(s):</strong>
          ${missing.length ? missing.map(id => `<span class="pill">${escapeHtml(nodeLabel(id))}</span>`).join(" ") : "<span class='pill'>None</span>"}
        </div>

        <div style="margin-top:10px;"><strong>Confusable alternative:</strong>
          ${confusable?.dx ? `<span class="pill">${escapeHtml(nodeLabel(confusable.dx))}</span>` : "<span class='pill'>(none)</span>"}
        </div>

        <div style="margin-top:10px;" class="muted">
          Tip: Compare your selected features with the highlighted feature nodes for the gold diagnosis.
        </div>
      </div>
    `;
    showFeedback(fb);

    // Highlight gold dx (if graph exists on this page)
    highlightDiagnosisPathAndFeatures(goldDx);
    setKpi("kpiDx", nodeLabel(goldDx));

    logAttempt({
      timestamp: new Date().toISOString(),
      student_id: ($("studentId")?.value || "").trim(),
      gold_dx: goldDx,
      student_dx: studentDx,
      correct: String(correct),
      selected_features: selected.join(";"),
      missing_features: missing.join(";"),
      confusable_dx: confusable?.dx || "",
      justification: ($("justification")?.value || "").trim(),
      note_text: ($("note")?.value || "").trim()
    });
  });

  $("exportCsvBtn")?.addEventListener("click", exportAttemptsCsv);

  // ---------- Main page buttons (only if they exist) ----------
  $("resetBtn")?.addEventListener("click", () => {
    resetHighlights();
    lastTop1Dx = null;
    setTopSimilarityKpi(null);
    setKpi("kpiDx", "—");

    const fb = $("feedbackBox");
    if (fb) fb.innerHTML = "";
  });

  $("runBtn")?.addEventListener("click", () => {
    const note = ($("note")?.value || "").trim();

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

    // Update KPI top similarity even if we don't show the table/chart
    setTopSimilarityKpi(top.length ? top[0].sim : null);

    if (top.length > 0) {
      lastTop1Dx = top[0].diagnosisNodeId;
      highlightDiagnosisPathAndFeatures(lastTop1Dx);
      setKpi("kpiDx", nodeLabel(lastTop1Dx));
    } else {
      lastTop1Dx = null;
      setKpi("kpiDx", "—");
    }
  });

  // ---------- Initialize ----------
  populateCaseSelector();
  populateDiagnosisSelect();
  populateSymptomChecklist();

  // Fit the whole graph once on load (if present)
  if (cy) cy.fit(cy.elements(), 80);
});
