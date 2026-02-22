// app.js
// ---------- Graph setup (Cytoscape) ----------

// Safety check: make errors obvious in console
if (typeof cytoscape === "undefined") {
  throw new Error("Cytoscape is not loaded. Check the script tag in index.html.");
}
if (typeof KG_NODES === "undefined" || typeof KG_EDGES === "undefined") {
  throw new Error("KG_NODES / KG_EDGES not found. Check that data.js is loaded BEFORE app.js.");
}

const cy = cytoscape({
  container: document.getElementById("cy"),

  elements: [
    ...KG_NODES,
    ...KG_EDGES
  ],

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

    // Highlight styles
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
      style: {
        "opacity": 0.20
      }
    }
  ],

  layout: {
    name: "breadthfirst",
    directed: true,
    padding: 60,
    spacingFactor: 1.6,
    // NOTE: some Cytoscape layouts ignore levelSeparation/nodeSpacing;
    // they won't crash, but may have no effect.
    animate: false
  }
});

function resetHighlights() {
  cy.elements().removeClass("hlNode hlEdge dim");
}

document.getElementById("resetBtn").addEventListener("click", () => {
  resetHighlights();
  document.getElementById("results").innerHTML = "";
});

// ---------- Simple TF-IDF + cosine similarity (browser-only) ----------
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
  for (const [t, c] of df.entries()) {
    idf.set(t, Math.log((n + 1) / (c + 1)) + 1);
  }
  return idf;
}

function vectorize(tokens, vocab, idf) {
  const tf = termFreq(tokens);
  const vec = new Float64Array(vocab.size);
  for (const [t, tfv] of tf.entries()) {
    const idx = vocab.get(t);
    if (idx === undefined) continue;
    const idfv = idf.get(t) || 0;
    vec[idx] = tfv * idfv;
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

// ---------- KG highlight logic ----------
function highlightDiagnosisPathAndSymptoms(diagnosisNodeId) {
  resetHighlights();
  cy.elements().addClass("dim");

  const diag = cy.getElementById(diagnosisNodeId);
  if (!diag || diag.empty()) return;

  diag.removeClass("dim").addClass("hlNode");

  // Parent chain: follow incoming parent_of edges
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

  // Symptom edges (outgoing has_symptom)
  const symptomEdges = diag.outgoers('edge[rel="has_symptom"]');
  symptomEdges.removeClass("dim").addClass("hlEdge");
  symptomEdges.targets().removeClass("dim").addClass("hlNode");

  const highlighted = cy.elements(".hlNode, .hlEdge");
  if (highlighted.length > 0) cy.fit(highlighted, 70);
}

// ---------- Run demo ----------
document.getElementById("runBtn").addEventListener("click", () => {
  const note = document.getElementById("note").value.trim();

  const caseTokens = CASE_LIBRARY.map(c => tokenize(c.text));
  const queryTokens = tokenize(note);

  const allDocs = [...caseTokens, queryTokens];
  const vocab = buildVocab(allDocs);
  const idf = invDocFreq(allDocs);

  const caseVecs = CASE_LIBRARY.map((c, i) => vectorize(caseTokens[i], vocab, idf));
  const queryVec = vectorize(queryTokens, vocab, idf);

  const scored = CASE_LIBRARY.map((c, i) => {
    const sim = cosine(queryVec, caseVecs[i]);
    return { ...c, sim };
  }).sort((a, b) => b.sim - a.sim);

  const top = scored.slice(0, 3);
  renderResults(top);

  if (top.length > 0) {
    highlightDiagnosisPathAndSymptoms(top[0].diagnosisNodeId);
  }
});

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
      <td>
        <button data-diag="${c.diagnosisNodeId}">Highlight</button>
      </td>
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
      const diag = btn.getAttribute("data-diag");
      highlightDiagnosisPathAndSymptoms(diag);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}
