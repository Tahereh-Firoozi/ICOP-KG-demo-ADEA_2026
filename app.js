// app.js

// ---------- Safety checks ----------
if (typeof cytoscape === "undefined") {
  throw new Error("Cytoscape is not loaded. Check the script tag in index.html.");
}
if (typeof KG_NODES === "undefined" || typeof KG_EDGES === "undefined") {
  throw new Error("KG_NODES / KG_EDGES not found. Ensure data.js loads BEFORE app.js.");
}
if (typeof CASE_LIBRARY === "undefined") {
  throw new Error("CASE_LIBRARY not found. Ensure data.js loads BEFORE app.js.");
}

// ---------- Build graph after DOM is ready ----------
window.addEventListener("DOMContentLoaded", () => {
  // ---------- Cytoscape setup ----------
  const cy = cytoscape({
    container: document.getElementById("cy"),
    elements: [...KG_NODES, ...KG_EDGES],

    style: [
      // Base node style
      {
        selector: "node",
        style: {
          "label": "data(label)",
          "font-size": 16,
          "text-wrap": "wrap",
          "text-max-width": 240,
          "text-valign": "center",
          "text-halign": "center",
          "border-width": 3,
          "border-color": "#0f172a",
          "color": "#0f172a",
          "background-color": "#ffffff",
          "width": 160,
          "height": 105,
          "padding": 14
        }
      },

      // ICOP nodes
      {
        selector: 'node[type="icop"]',
        style: {
          "shape": "round-rectangle",
          "border-width": 4,
          "width": 190,
          "height": 115,
          "font-weight": 700
        }
      },

      // Level styles (requires data(level))
      { selector: 'node[type="icop"][level = 1]', style: { "background-color": "#e0f2fe", "border-color": "#0284c7", "width": 250, "height": 135, "font-size": 22 } },
      { selector: 'node[type="icop"][level = 2]', style: { "background-color": "#dcfce7", "border-color": "#16a34a", "width": 230, "height": 125, "font-size": 20 } },
      { selector: 'node[type="icop"][level = 3]', style: { "background-color": "#fef9c3", "border-color": "#ca8a04", "width": 215, "height": 120, "font-size": 18 } },
      { selector: 'node[type="icop"][level = 4]', style: { "background-color": "#fae8ff", "border-color": "#a855f7", "width": 205, "height": 118, "font-size": 17 } },
      { selector: 'node[type="icop"][level >= 5]', style: { "background-color": "#ffe4e6", "border-color": "#e11d48", "width": 200, "height": 116, "font-size": 16 } },

      // Symptom nodes
      {
        selector: 'node[type="symptom"]',
        style: {
          "shape": "ellipse",
          "background-color": "#fff7ed",
          "border-color": "#fb923c",
          "border-width": 3,
          "width": 150,
          "height": 150,
          "font-size": 16,
          "font-weight": 700
        }
      },

      // Edges
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "width": 2,
          "line-color": "#cbd5e1",
          "target-arrow-shape": "triangle",
          "target-arrow-color": "#cbd5e1",
          "label": "data(rel)",
          "font-size": 12,
          "text-rotation": "autorotate",
          "text-margin-y": -10,
          "color": "#64748b"
        }
      },

      // Make hierarchy edges bolder
      {
        selector: 'edge[rel="parent_of"]',
        style: {
          "width": 4,
          "line-color": "#94a3b8",
          "target-arrow-color": "#94a3b8"
        }
      },

      // Symptoms vs risk factors
      {
        selector: 'edge[rel="has_symptom"]',
        style: {
          "width": 3,
          "line-style": "dashed",
          "line-dash-pattern": [6, 6]
        }
      },
      {
        selector: 'edge[rel="risk_factor"]',
        style: {
          "width": 3,
          "line-style": "dotted"
        }
      },

      // Highlight
      {
        selector: ".hlNode",
        style: { "border-width": 7, "border-color": "#000", "background-color": "#86efac" }
      },
      {
        selector: ".hlEdge",
        style: { "line-color": "#000", "target-arrow-color": "#000", "width": 7 }
      },
      { selector: ".dim", style: { "opacity": 0.15 } }
    ],

    layout: {
      name: "breadthfirst",
      directed: true,
      padding: 90,
      spacingFactor: 2.3,
      animate: false
    }
  });

  // Optional: separate the two main trees into left/right columns
  // (only if these nodes exist)
  if (!cy.getElementById("icop_2").empty() && !cy.getElementById("icop_3").empty()) {
    cy.getElementById("icop_2").position({ x: 250, y: 120 });
    cy.getElementById("icop_3").position({ x: 1050, y: 120 });
    cy.getElementById("icop_2").lock();
    cy.getElementById("icop_3").lock();

    cy.layout({ name: "breadthfirst", directed: true, padding: 90, spacingFactor: 2.3, animate: false }).run();
  }

  // ---------- Highlight helpers ----------
  function resetHighlights() {
    cy.elements().removeClass("hlNode hlEdge dim");
  }

  function highlightDiagnosisPathAndFeatures(dxNodeId) {
    resetHighlights();
    cy.elements().addClass("dim");

    const dx = cy.getElementById(dxNodeId);
    if (!dx || dx.empty()) return;

    dx.removeClass("dim").addClass("hlNode");

    // Parent chain (incoming parent_of edges)
    let current = dx;
    while (true) {
      const incomingParentEdges = current.incomers('edge[rel="parent_of"]');
      if (incomingParentEdges.length === 0) break;

      const e = incomingParentEdges[0];
      const parentNode = e.source();

      e.removeClass("dim").addClass("hlEdge");
      parentNode.removeClass("dim").addClass("hlNode");

      current = parentNode;
    }

    // Highlight clinical features + risk factors
    const featureEdges = dx.outgoers('edge[rel="has_symptom"], edge[rel="risk_factor"]');
    featureEdges.removeClass("dim").addClass("hlEdge");
    featureEdges.targets().removeClass("dim").addClass("hlNode");

    const highlighted = cy.elements(".hlNode, .hlEdge");
    if (highlighted.length > 0) cy.fit(highlighted, 90);
  }

  // ---------- TF-IDF + cosine similarity ----------
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
      for (const t of tokens) {
        if (!vocab.has(t)) vocab.set(t, vocab.size);
      }
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
    return Math.round(x * 1000) / 10; // 1 decimal
  }

  // ---------- UI: buttons ----------
  const resetBtn = document.getElementById("resetBtn");
  const runBtn = document.getElementById("runBtn");

  resetBtn?.addEventListener("click", () => {
    resetHighlights();
    const results = document.getElementById("results");
    if (results) results.innerHTML = "";
  });

  runBtn?.addEventListener("click", () => {
    const note = (document.getElementById("note")?.value || "").trim();

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

    if (top.length > 0) highlightDiagnosisPathAndFeatures(top[0].diagnosisNodeId);
  });

  // ---------- Results renderer ----------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function renderResults(topCases) {
    const div = document.getElementById("results");
    if (!div) return;

    if (!topCases || topCases.length === 0) {
      div.innerHTML = "<div class='muted'>No results.</div>";
      return;
    }

    const rows = topCases.map((c, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div style="font-weight:700">${escapeHtml(c.title)}</div>
          <div class="muted">${escapeHtml(c.text)}</div>
          <div class="muted" style="margin-top:6px;">
            Diagnosis node: <span class="pill">${escapeHtml(c.diagnosisNodeId)}</span>
          </div>
        </td>
        <td style="white-space:nowrap; font-weight:800;">${toPercent(c.sim)}%</td>
        <td><button data-diag="${escapeHtml(c.diagnosisNodeId)}">Highlight</button></td>
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
        highlightDiagnosisPathAndFeatures(btn.getAttribute("data-diag"));
      });
    });
  }

  // ---------- Case selector (dropdown -> textarea) ----------
  function populateCaseSelector() {
    const sel = document.getElementById("caseSelect");
    if (!sel) return;
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

      const noteEl = document.getElementById("note");
      if (noteEl) noteEl.value = chosen.note;

      resetHighlights();
      const results = document.getElementById("results");
      if (results) results.innerHTML = "";
    });
  }

  populateCaseSelector();
});
