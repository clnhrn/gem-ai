# GemAI

A streaming RAG chatbot that answers questions about gemstones using USGS publications and the Smithsonian gem collection. Built with [Next.js 15](https://nextjs.org/), the [Vercel AI SDK](https://sdk.vercel.ai/), and [Upstash Vector](https://upstash.com/docs/vector).

## Features

- Streaming responses via the Vercel AI SDK (`streamText`)
- RAG implemented as a tool call — the model decides when to retrieve
- Collapsible source citations with page numbers and similarity scores
- Light / dark / system theme toggle
- Suggested prompt chips on the empty state
- Markdown rendering with GFM support
- New-chat confirmation dialog

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
├── docs/
│   ├── graded-project-brief.md
│   └── plan.md
├── steps/                                  # Reference snapshots per workshop step
│   ├── step2-plain-chat/
│   │   ├── page.tsx                        # Step 2: useChat + vanilla streamText
│   │   └── route.ts
│   ├── step4-rag-as-tool/
│   │   └── route.ts                        # Step 4: route handler with retrieval tool
│   └── step5-sources/
│       └── page.tsx                        # Step 5: sources UI
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

## Walk through the steps

The `steps/` folder contains reference snapshots from the workshop. To try them, copy each file over the matching path in `app/`:

| Step | Files to copy | What it shows |
| --- | --- | --- |
| 2 | `steps/step2-plain-chat/page.tsx` → `app/page.tsx` | useChat with vanilla streamText |
|   | `steps/step2-plain-chat/route.ts` → `app/api/chat/route.ts` | (no RAG — verify streaming first) |
| 4 | `steps/step4-rag-as-tool/route.ts` → `app/api/chat/route.ts` | Model decides when to call retrieval |
| 5 | `steps/step5-sources/page.tsx` → `app/page.tsx` | Sources rendered below answers |

## Common errors

| Symptom | Fix |
| --- | --- |
| `Error: missing UPSTASH_VECTOR_REST_URL` | Set `.env.local` and re-run `npm run seed`. |
| Page renders but submitting hangs | Check that `route.ts` returns `toDataStreamResponse()`. |
| Empty answer after a tool call | Set `maxSteps: 3` on `streamText`. |
| `Cannot use useChat in a Server Component` | Add `'use client'` at the top of `page.tsx`. |
| Build error: type mismatch | Run `npx tsc --noEmit` for the full error. |
| `vercel --prod` fails on missing env vars | `vercel env add ...` and pick **Production**. |
