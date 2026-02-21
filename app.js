// ---------- Graph setup (Cytoscape) ----------
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
        "font-size": 11,
        "text-wrap": "wrap",
        "text-max-width": 140,
        "text-valign": "center",
        "text-halign": "center",
        "border-width": 1,
        "border-color": "#bbb",
        "background-color": "#f3f3f3",
        "width": 48,
        "height": 48,
        "padding": 6
      }
    },
    {
      selector: 'node[type="icop"]',
      style: {
        "shape": "round-rectangle",
        "background-color": "#eef6ff",
        "border-color": "#8ab4f8"
      }
    },
    {
      selector: 'node[type="symptom"]',
      style: {
        "shape": "ellipse",
        "background-color": "#fff7ed",
        "border-color": "#fdba74"
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
        "border-color": "#111",
        "background-color": "#d1fae5"
      }
    },
    {
      selector: ".hlEdge",
      style: {
        "line-color": "#111",
        "target-arrow-color": "#111",
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
    padding: 30,
    spacingFactor: 1.2
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
    .filter(t => t && t.length > 2); // drop tiny tokens
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
  // normalize
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
    // smooth
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

  // Dim everything first
  cy.elements().addClass("dim");

  // Highlight diagnosis node
  const diag = cy.getElementById(diagnosisNodeId);
  diag.removeClass("dim").addClass("hlNode");

  // Highlight parents up to L1 (reverse direction: child -> parent)
  // Our edges are parent_of: source(parent)->target(child)
  // So to find parents: incoming edges with rel=parent_of
  let current = diag;
  while (true) {
    const incomingParentEdges = current.incomers('edge[rel="parent_of"]');
    if (incomingParentEdges.length === 0) break;
    const e = incomingParentEdges[0]; // demo assumes single parent
    const parentNode = e.source();

    e.removeClass("dim").addClass("hlEdge");
    parentNode.removeClass("dim").addClass("hlNode");

    current = parentNode;
  }

  // Highlight symptom edges and symptom nodes
  const symptomEdges = diag.outgoers('edge[rel="has_symptom"]');
  symptomEdges.removeClass("dim").addClass("hlEdge");
  symptomEdges.targets().removeClass("dim").addClass("hlNode");

  // Fit viewport to highlighted set
  const highlighted = cy.elements(".hlNode, .hlEdge");
  if (highlighted.length > 0) cy.fit(highlighted, 70);
}

// ---------- Run demo ----------
document.getElementById("runBtn").addEventListener("click", () => {
  const note = document.getElementById("note").value.trim();

  // Build documents: cases + query
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

  // Highlight top diagnosis path
  if (top.length > 0) {
    highlightDiagnosisPathAndSymptoms(top[0].diagnosisNodeId);
  }
});

function renderResults(topCases) {
  const div = document.getElementById("results");
  if (topCases.length === 0) {
    div.innerHTML = "<div class='muted'>No results.</div>";
    return;
  }

  const rows = topCases.map((c, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>
        <div style="font-weight:600">${c.title}</div>
        <div class="muted">${escapeHtml(c.text)}</div>
        <div class="muted" style="margin-top:6px;">
          Diagnosis node: <span class="pill">${c.diagnosisNodeId}</span>
        </div>
      </td>
      <td style="white-space:nowrap; font-weight:700;">${toPercent(c.sim)}%</td>
      <td>
        <button data-diag="${c.diagnosisNodeId}" data-case="${c.id}">Highlight</button>
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
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}
