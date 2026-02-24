// app.js — UAlberta Green + Gold visualization (Option 3 feedback; GitHub Pages safe)
// Requires: KG_NODES, KG_EDGES, CASE_LIBRARY
// Optional: DEMO_NOTES, CONFUSABLE_MAP

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

  function renderAiFeedback(payload) {
    const box = $("aiFeedbackBox");
    if (!box) return;

    const {
      studentDxLabel, goldDxLabel, correctDx,
      selectedFeatureLabels, missingLabels, extraLabels,
      coveragePct, topSimPct, confusableDxLabel, justificationEval
    } = payload;

    const actions = [];
    if (!correctDx) actions.push("Re-check your diagnosis selection against the ICOP-matched diagnosis.");
    if (coveragePct < 70) actions.push("Add missing key features that best discriminate this diagnosis.");
    if (justificationEval.score < 4) actions.push("Rewrite justification using: (feature → interpretation → diagnosis) and add a contrast/differential phrase.");
    while (actions.length < 3) actions.push("Keep the justification concise (1–3 sentences) and clinically specific.");

    const modelAnswer =
      `Given the key findings, this presentation is most consistent with ${goldDxLabel}. ` +
      `This is supported by the core feature pattern; an alternative such as ${confusableDxLabel || "a nearby ICOP category"} ` +
      `is less likely given the overall feature profile.`;

    const tag = (txt) =>
      `<span style="display:inline-block;padding:2px 8px;border:1px solid rgba(15,23,42,0.12);border-radius:999px;font-size:12px;margin-right:6px;margin-top:6px;background:rgba(255,255,255,0.95);">${escapeHtml(txt)}</span>`;
    const listTags = (arr) => arr.length ? arr.map(x => tag(x)).join(" ") : tag("None");

    box.innerHTML = `
      <div style="font-weight:950;">AI feedback (rubric-based)</div>

      <div style="margin-top:8px;">
        ${tag(`Top similarity: ${topSimPct}%`)}
        ${tag(`Dx match: ${correctDx ? "✅" : "❌"}`)}
        ${tag(`Feature coverage: ${coveragePct}%`)}
        ${tag(`Justification: ${justificationEval.score}/6`)}
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:900;">Your answer</div>
        <div style="color:#475569;"><strong>Diagnosis:</strong> ${escapeHtml(studentDxLabel)}</div>
        <div style="color:#475569;"><strong>Selected features:</strong> ${
          selectedFeatureLabels.length
            ? escapeHtml(selectedFeatureLabels.slice(0,6).join(", ")) + (selectedFeatureLabels.length>6 ? "…" : "")
            : "(none)"
        }</div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:900;">ICOP matching</div>
        <div style="color:#475569;"><strong>Matched diagnosis:</strong> ${escapeHtml(goldDxLabel)}</div>
        <div style="color:#475569;"><strong>Confusable alternative:</strong> ${escapeHtml(confusableDxLabel || "(none identified)")}</div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:900;">Missing key feature(s)</div>
        <div>${listTags(missingLabels)}</div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:900;">Extra / less relevant feature(s)</div>
        <div>${listTags(extraLabels)}</div>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:900;">Next 3 actions (highest impact)</div>
        <ol style="margin:6px 0 0 18px;">
          ${actions.slice(0,3).map(a => `<li>${escapeHtml(a)}</li>`).join("")}
        </ol>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:900;">Justification coaching</div>
        <ul style="margin:6px 0 0 18px;">
          ${justificationEval.tips.map(t => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </div>

      <div style="margin-top:10px;">
        <div style="font-weight:900;">Model answer template</div>
        <div style="color:#475569;border:1px solid rgba(15,23,42,0.10);border-radius:12px;padding:10px;background:rgba(255,255,255,0.95);">
          ${escapeHtml(modelAnswer)}
        </div>
      </div>
    `;
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
  $("submitAssessmentBtn")?.addEventListener("click", () => {
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

    const top = retrieveTopCases(scenarioNote, 3);
    if (!top.length) {
      if (aiBox) aiBox.textContent = "Could not retrieve a matching case from the scenario note.";
      return;
    }

    const goldDx = top[0].diagnosisNodeId;
    const topSim = top[0].sim;

    setKpi("kpiTopSim", `${Math.round(topSim * 100)}%`);
    setKpi("kpiDx", nodeLabel(goldDx));
    highlightDiagnosisPathAndFeatures(goldDx);

    const expected = getDiagnosisFeatureSet(goldDx);
    const missing = expected.filter(x => !selected.includes(x));
    const extra = selected.filter(x => !expected.includes(x));
    const coverage = expected.length ? (expected.length - missing.length) / expected.length : 0;

    const correctDx = (studentDx === goldDx);

    const confusable = findConfusableAlternative(selected, goldDx);

    const justification = ($("justification")?.value || "").trim();
    const expectedLabels = expected.map(nodeLabel);
    const justificationEval = scoreJustification(justification, expectedLabels);

    renderAiFeedback({
      studentDxLabel: nodeLabel(studentDx),
      goldDxLabel: nodeLabel(goldDx),
      correctDx,
      selectedFeatureLabels: selected.map(nodeLabel),
      missingLabels: missing.map(nodeLabel),
      extraLabels: extra.map(nodeLabel),
      coveragePct: Math.round(coverage * 100),
      topSimPct: Math.round(topSim * 100),
      confusableDxLabel: confusable?.dx ? nodeLabel(confusable.dx) : "",
      justificationEval
    });

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
