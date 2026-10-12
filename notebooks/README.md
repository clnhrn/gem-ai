# Evaluation notebooks

| Notebook | What it is |
|---|---|
| `rag-evaluation-v2.ipynb` | **Current evaluation.** Tests the RAG pipeline as the app runs it: compares the structure-aware chunker against a plain character splitter, compares `gpt-4o-mini` with `gpt-4.1-mini`, and checks the live app's decision to search or not. |
| `rag-evaluation.ipynb` | v1, kept as the record of how the prose chunk size (800/100) and `topK: 8` were chosen. Out of date; see the note at its top. You don't need to re-run it. |

## What v2 does

| Part | |
|---|---|
| 0 | Loads keys from `.env.local` and reads the app's configuration from `app/api/chat/route.ts`: model, temperature, system prompt, tool description, source titles, `topK`, `maxTokens`. Nothing is duplicated in the notebook, so it always tests what the app runs. |
| 1 | Builds two sets of chunks: **A**, `RecursiveCharacterTextSplitter(800, 100)` on PyMuPDF pages, and **B**, the app's own chunks from `npx tsx lib/seed.ts --dry-run`. |
| 2 | 19 hand-checked questions with reference answers and expected source pages, uploaded as a LangSmith dataset. |
| 3 | Reproduces the app's answer step: system prompt → question → `getInformation` tool call → numbered passages → answer. |
| 4 | Five metrics: correctness, helpfulness, groundedness (judged against the retrieved passages), citation accuracy, retrieval hit. |
| 5 | Chunking: A at k=8, B at k=8, B at k=4. |
| 5b | Model: `gpt-4o-mini` vs `gpt-4.1-mini`, with everything else fixed. |
| 6 | Sends greetings, an off-topic question and gem questions to the running app and checks whether it searched. |
| 7 | Conclusion. |

Each experiment runs twice (`N_REPS = 2`) so run-to-run noise is visible.

## Setup

From the repository root:

```bash
# 1. Node dependencies (Part 1 runs the TypeScript chunker)
npm install

# 2. Python environment (Python 3.11+)
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r notebooks/requirements.txt

# 3. Keys: in .env.local (see .env.example)
#   OPENAI_API_KEY      answers, embeddings and the gpt-4.1 judge
#   LANGCHAIN_API_KEY   LangSmith (datasets, experiments, tracing)
```

Any key missing from `.env.local` is asked for when the notebook starts.

Part 6 also needs the app running. Start it in another terminal with `npm run dev`; the notebook expects `http://localhost:3000`. To test another address, such as a Vercel preview, set `APP_URL` before starting the notebook. If the app can't be reached, Part 6 prints a message and the rest of the notebook still runs.

## Running

**Interactively:** open `rag-evaluation-v2.ipynb` in VS Code or Jupyter, select the `.venv` kernel, and run all cells. `requirements.txt` includes the kernel but not the Jupyter UI; for the browser UI, `pip install jupyterlab` and run `jupyter lab`.

**Headless,** saving outputs into the notebook:

```bash
cd notebooks
jupyter-execute --inplace --timeout=1800 rag-evaluation-v2.ipynb
```

A full run takes about 10 minutes.

## Cost

A full run makes roughly 150 answer calls and 600 judge calls. Estimated from token counts, it costs about **$3**, almost all of it the `gpt-4.1` judge ($2 / $8 per 1M input / output tokens). The answers themselves (`gpt-4.1-mini` and `gpt-4o-mini`) and embeddings cost cents. Don't run it in a loop.

## Results in LangSmith

- **Dataset:** `GemAI Eval v2 (<hash>)`. The hash comes from the questions in Part 2, so re-running reuses the same dataset, and editing the questions creates a new one instead of mixing results.
- **Experiments:** `A-old-splitter-k8-…`, `B-app-chunker-k8-…`, `B-app-chunker-k4-…`, `M-gpt-4o-mini-…`, all under that dataset, so they can be compared side by side in LangSmith.
- **Traces:** project `GemAI-Eval-v2` (set `LANGCHAIN_PROJECT` to change it).

The notebook's own tables (Parts 5, 5b and 6) are computed from the same results.

## Changing things

| To change | Do this |
|---|---|
| The app's model, prompt, `topK`, temperature | Edit `app/api/chat/route.ts` and re-run; the notebook picks the changes up. |
| Chunking | Edit `lib/seed.ts` and re-run (Part 1 calls its `--dry-run`). Re-seed the live index separately with `npm run seed`. |
| Questions | Edit `test_data` in Part 2. Check reference answers against the PDFs; a new dataset is created automatically. |
| Number of runs | `N_REPS` in Part 5. |
| The model compared against | `BASELINE_MODEL` in Part 5b (must differ from the app's model). |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Part 1 fails running `npx tsx lib/seed.ts --dry-run` | Run `npm install` at the repository root. |
| `401` / authentication errors from LangSmith | Check `LANGCHAIN_API_KEY` in `.env.local`. |
| Part 6: "App not reachable" | Start the app with `npm run dev`, or set `APP_URL`. |
| Part 6: `429 Too many requests` | The app allows 10 requests per minute per IP. Wait a minute; the notebook already pauses 7 seconds between requests. |
| Part 5b: "the app already uses the baseline model" | The app's model and `BASELINE_MODEL` are the same; change one of them. |
