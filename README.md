<h1 align="center">💎 GemAI</h1>
<p align="center">A streaming RAG chatbot that answers questions about gemstones using USGS publications and the Smithsonian gem collection.<br>Built with <a href="https://nextjs.org/">Next.js 15</a>, the <a href="https://sdk.vercel.ai/">Vercel AI SDK</a>, and <a href="https://upstash.com/docs/vector">Upstash Vector</a>.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15">
  <img src="https://img.shields.io/badge/Vercel_AI_SDK-4-blue?logo=vercel" alt="Vercel AI SDK">
  <img src="https://img.shields.io/badge/GPT--4o--mini-OpenAI-412991?logo=openai" alt="GPT-4o-mini">
  <img src="https://img.shields.io/badge/Upstash-Vector-00e9a3?logo=upstash" alt="Upstash Vector">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

## Features

- Streaming responses via the Vercel AI SDK (`streamText`)
- RAG implemented as a tool call — the model decides when to retrieve
- Collapsible source citations with page numbers and similarity scores
- Light / dark / system theme toggle
- Suggested prompt chips on the empty state
- Markdown rendering with GFM support
- New-chat confirmation dialog
- Rate limiting (10 req/min per IP) and input validation on the chat API

## What's here

```
gem-ai/
├── app/
│   ├── globals.css
│   ├── layout.tsx                          # Root layout with OG metadata & theme script
│   ├── page.tsx                            # Chat UI — useChat, sources, theme toggle
│   ├── icon.svg
│   └── api/chat/route.ts                   # Route handler — RAG-as-tool-call (gpt-4o-mini)
├── lib/
│   └── seed.ts                             # Chunks & embeds PDFs into Upstash Vector
├── data/
│   ├── usgs-natural-gemstones.pdf          # USGS General Interest Publication
│   ├── usgs-gemstones-mcs-2026.pdf         # USGS Mineral Commodity Summary 2026
│   └── smithsonian-gems.pdf               # Project Gutenberg — Smithsonian gem collection
├── scripts/
│   └── download_pdfs.py                    # Downloads the three source PDFs
├── notebooks/
│   └── rag-evaluation.ipynb               # RAG evaluation notebook
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

# 3. (Optional) Download the source PDFs
pip install tqdm fpdf2
python scripts/download_pdfs.py

# 4. Seed the vector index
npm run seed
```

The seed script reads all PDFs in `data/`, chunks them (~800 chars with 100-char overlap), embeds with `text-embedding-3-small`, and upserts to Upstash Vector. Re-running overwrites the same ids, so it's idempotent.

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

Answers stream into the chat, with a collapsible **Sources** section showing page numbers, similarity scores, and the retrieved chunk text.

## Corpus

The knowledge base consists of three public-domain PDFs about gemstones:

| Document | Source | Pages |
| --- | --- | --- |
| Natural Gemstones | USGS General Interest Publication | ~30 |
| Gemstones MCS 2026 | USGS Mineral Commodity Summary | ~2 |
| Gems & Precious Stones | Smithsonian / Project Gutenberg | ~150 |

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| AI SDK | Vercel AI SDK v4 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) |
| Model | GPT-4o-mini |
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
