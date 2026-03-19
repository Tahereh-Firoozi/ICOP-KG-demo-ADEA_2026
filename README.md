ICOP-KG-demo-ADEA_2026
======================

Interactive ICOP knowledge-graph and assessment demo for teaching clinical reasoning.  
The backend is a FastAPI app that provides AI feedback and similar-case retrieval using Gemini and a precomputed embeddings file; the frontend is a static HTML/JS interface for graph exploration and assessment.

This project can be deployed to **Render** (Python web service) or run **locally on localhost**.

---

## Deploying on Render

The repository already includes `render.yaml` configured for a Python web service:

```yaml
services:
  - type: web
    name: icop-backend
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn server:app --host 0.0.0.0 --port $PORT
```

In this demo, the Render service is available at:

- `https://icop-kg-demo-adea-2026.onrender.com`

To **wake up** the Render service (cold-start warmup) and make it faster for students:

1. First open the Render URL in your browser:  
   - `https://icop-kg-demo-adea-2026.onrender.com`
 2. Once the page loads, then open the GitHub Pages frontend (the UI students should use) in another tab:  
    - `https://tahereh-firoozi.github.io/ICOP-KG-demo-ADEA_2026/assessment.html`

Do **not** use the Render URL UI directly; always use the GitHub Pages frontend.

If you host only the static frontend on GitHub Pages, `app.js` will automatically call the Render backend above; you can override it via:

```js
window.__ICOP_BACKEND_URL__ = "https://your-service.onrender.com";
```

---

## Local setup (localhost)

**Prerequisites**
- Python 3.11
- A Google API key for Gemini (`GOOGLE_API_KEY`)
- Optional: an embeddings pickle file (`embeddings.pkl`) or a URL to download it

**1. Create and activate a virtual environment (recommended)**

```bash
cd ICOP-KG-demo-ADEA_2026
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**2. Embeddings file (local option)**

For local use, the simplest setup is to copy your `embeddings.pkl` into the default path used by `server.py`:

- `data/rag_dataset/embeddings.pkl` (relative to this directory)

If the file exists there, you do **not** need to set `EMBEDDINGS_PKL_PATH` or `EMBEDDINGS_PKL_URL` for local runs.

**3. Configure environment variables**

At minimum:

```bash
export GOOGLE_API_KEY="YOUR_KEY_HERE"
```

For similar-case retrieval, either:
- (Recommended for local) rely on the default path above (`data/rag_dataset/embeddings.pkl`), or:
- Point to a different local file explicitly:

```bash
export EMBEDDINGS_PKL_PATH="/absolute/path/to/embeddings.pkl"
```

**4. Run the backend locally**

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

By default the FastAPI app serves the static files from the same directory, so you can open:
- `http://localhost:8000/` → main graph demo (`index.html`)
- `http://localhost:8000/assessment.html` → assessment / AI feedback page

No separate static server is needed.

---

## Notes

```js
window.__ICOP_BACKEND_URL__ = "https://your-service.onrender.com";
```