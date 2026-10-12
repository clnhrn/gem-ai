<h1 align="center">💎 GemAI</h1>
<p align="center">A streaming RAG chatbot that answers questions about gemstones using USGS publications and the Smithsonian gem collection.<br>Built with <a href="https://nextjs.org/">Next.js 15</a>, the <a href="https://sdk.vercel.ai/">Vercel AI SDK</a>, and <a href="https://upstash.com/docs/vector">Upstash Vector</a>.</p>

<p align="center"><strong><a href="https://gem-ai-five.vercel.app">▶ Try the live app: gem-ai-five.vercel.app</a></strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15">
  <img src="https://img.shields.io/badge/Vercel_AI_SDK-4-blue?logo=vercel" alt="Vercel AI SDK">
  <img src="https://img.shields.io/badge/GPT--4.1--mini-OpenAI-412991?logo=openai" alt="GPT-4.1-mini">
  <img src="https://img.shields.io/badge/Upstash-Vector-00e9a3?logo=upstash" alt="Upstash Vector">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

## Features

- Streaming responses via the Vercel AI SDK (`streamText`)
- RAG implemented as a tool call — the model decides when to retrieve
- Numbered inline citations linked to source cards showing document title, page number, and passage text
- Light / dark / system theme toggle
- Suggested prompt chips on the empty state
- Markdown rendering with GFM support
- New-chat confirmation dialog
- Rate limiting (10 req/min per IP) and input validation on the chat API

## Stretch features

1. **Evaluation harness** — [`notebooks/rag-evaluation-v2.ipynb`](notebooks/rag-evaluation-v2.ipynb) evaluates the pipeline as the app runs it (model, prompt, tool description and `topK` are read from `route.ts`) on 19 hand-checked questions in LangSmith. It compares the structure-aware chunker with a plain character splitter and `gpt-4o-mini` with `gpt-4.1-mini`, runs each experiment twice to expose noise, and checks the live app's decision to search. See [Evaluation](#evaluation).
2. **Suggested-prompt chips** — the empty state offers four example questions (Hope Diamond, sapphire identification, Montana gems, gem vs mineral) that fill the input with one click.

## What's here

```
gem-ai/
├── app/
│   ├── globals.css
│   ├── layout.tsx                          # Root layout with OG metadata & theme script
│   ├── page.tsx                            # Chat UI — useChat, sources, theme toggle
│   ├── icon.svg
│   ├── opengraph-image.tsx                 # Generated Open Graph preview image
│   └── api/chat/route.ts                   # Route handler — RAG-as-tool-call (gpt-4.1-mini)
├── lib/
│   └── seed.ts                             # Chunks & embeds PDFs into Upstash Vector
├── data/
│   ├── usgs-natural-gemstones.pdf          # USGS General Interest Publication
│   ├── usgs-gemstones-mcs-2026.pdf         # USGS Mineral Commodity Summary 2026
│   └── smithsonian-gems.pdf               # Project Gutenberg — Smithsonian gem collection
├── scripts/
│   └── download_pdfs.py                    # Downloads the three source PDFs
├── notebooks/
│   ├── README.md                           # How to set up and run the evaluation
│   ├── requirements.txt                    # Python dependencies for the notebooks
│   ├── rag-evaluation.ipynb               # v1: chose chunk size 800/100 and topK 8
│   └── rag-evaluation-v2.ipynb            # v2: chunking and model comparisons, search decision
├── .github/workflows/
│   └── build.yml                           # CI build check on PRs
├── package.json
├── tsconfig.json
├── next.config.mjs
├── postcss.config.mjs
├── tailwind.config.ts
├── .env.example
└── README.md
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Environment variables
cp .env.example .env.local
# Fill in your keys:
#   OPENAI_API_KEY
#   UPSTASH_VECTOR_REST_URL
#   UPSTASH_VECTOR_REST_TOKEN
#   LANGCHAIN_API_KEY   (only for the evaluation notebooks)

# 3. (Optional) Download the source PDFs
pip install tqdm fpdf2
python scripts/download_pdfs.py

# 4. Seed the vector index
npm run seed
```

The seed script reads all PDFs in `data/`, chunks them according to each document's structure, embeds with `text-embedding-3-small`, and upserts to Upstash Vector with the start and end page in each chunk's metadata. The index is reset before upserting, so each run fully replaces its contents. Run `npx tsx lib/seed.ts --dry-run` to write the chunks to `chunks.dry-run.json` for inspection without embedding anything.

Chunking:

- **Prose** is split into ~800-character windows with ~100-character overlap, starting and ending on sentence boundaries. Chunks can cross page breaks.
- **USGS fact sheet:** each of the 20 gem entries (hardness, formula, specific gravity, varieties) is its own chunk, so a gem's properties are never split or mixed with another gem's.
- **Smithsonian book:** each chunk is prefixed with its section heading (e.g. `CORUNDUM — VARIETIES`). The collection catalog and properties table are split only between rows, and each catalog chunk names its gem and explains the columns, so a row like `44.5, blue (The Hope), India` stays meaningful.
- **Cleanup:** words hyphenated across lines are re-joined; photo captions, page numbers and Project Gutenberg boilerplate are dropped.

## Run

```bash
npm run dev
# open http://localhost:3000
```

Try asking:

- *"What is the Hope Diamond?"*
- *"How do you identify a sapphire?"*
- *"What gemstones are found in Montana?"*
- *"What makes a mineral a gemstone?"*

Answers stream into the chat with inline citations like [1]. The passages the answer cites are listed under it with their document title and page number; the remaining retrieved passages are in a collapsible section.

## Evaluation

[`notebooks/rag-evaluation-v2.ipynb`](notebooks/rag-evaluation-v2.ipynb) — setup and running instructions are in [`notebooks/README.md`](notebooks/README.md). 19 questions, two runs per experiment, judged by `gpt-4.1`:

| Experiment | Correctness | Groundedness | Retrieval hit |
| --- | --- | --- | --- |
| Old character splitter, k=8 | 0.95 | 0.95 | 0.94 |
| **App: structure-aware chunker, k=8, gpt-4.1-mini** | **1.00** | **0.95** | **1.00** |
| Structure-aware chunker, k=4 | 0.95 | 0.89 | 1.00 |
| Structure-aware chunker, k=8, gpt-4o-mini | 0.95 | 0.82 | 1.00 |

- The structure-aware chunker answers catalog lookups the character splitter misses ("largest topaz in the collection").
- k=4 misses a table lookup (US diamond import sources), so the app uses k=8.
- `gpt-4.1-mini` declines questions the corpus doesn't cover; `gpt-4o-mini` answered "Where is tanzanite mined?" from its own knowledge. It costs about $1.39 vs $0.52 per 1,000 questions at this app's token use.
- The live app chose correctly whether to search in 12/12 checks (greetings and off-topic questions: no search).

[`notebooks/rag-evaluation.ipynb`](notebooks/rag-evaluation.ipynb) (v1) is the earlier evaluation that chose the 800/100 prose chunk size and `topK: 8`.

## Corpus

The knowledge base consists of three public-domain PDFs about gemstones:

| Document | Source | Pages |
| --- | --- | --- |
| Natural Gemstones | USGS General Interest Publication | 20 |
| Mineral Commodity Summaries 2026: Gemstones | USGS | 2 |
| Gems in the Smithsonian Institution (Paul E. Desautels, 1965) | Smithsonian, via Project Gutenberg | 39 |

61 pages in total. The Smithsonian PDF is generated from the Project Gutenberg text by `scripts/download_pdfs.py`, so its page numbers (used in citations) are those of the generated PDF, not the printed book.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| AI SDK | Vercel AI SDK v4 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) |
| Model | GPT-4.1-mini (temperature 0) |
| Embeddings | text-embedding-3-small |
| Vector DB | Upstash Vector |
| Styling | Tailwind CSS + `@tailwindcss/typography` |
| Markdown | react-markdown + remark-gfm |

## Deploy to Vercel

```bash
npm i -g vercel
vercel
vercel env add OPENAI_API_KEY
vercel env add UPSTASH_VECTOR_REST_URL
vercel env add UPSTASH_VECTOR_REST_TOKEN
vercel --prod
```

The seed step is local — you only need to seed once per index, regardless of where the app is hosted.

## Common errors

| Symptom | Fix |
| --- | --- |
| `Error: missing UPSTASH_VECTOR_REST_URL` | Set `.env.local` and re-run `npm run seed`. |
| Page renders but submitting hangs | Check that `route.ts` returns `toDataStreamResponse()`. |
| Empty answer after a tool call | Set `maxSteps: 3` on `streamText`. |
| `Cannot use useChat in a Server Component` | Add `'use client'` at the top of `page.tsx`. |
| Build error: type mismatch | Run `npx tsc --noEmit` for the full error. |
| `vercel --prod` fails on missing env vars | `vercel env add ...` and pick **Production**. |
| Preview deployment fails with `UPSTASH_VECTOR_REST_TOKEN is missing!` | The env vars are scoped to Production or to one preview branch. In Vercel → Settings → Environment Variables, set them for **all Preview branches**. |
