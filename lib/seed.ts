/**
 * Seed Upstash Vector with chunks from all PDFs in data/.
 *
 * Run once before starting the chat:
 *   npm run seed
 *
 * Re-run any time you add or replace PDFs in data/.
 * Existing chunks are overwritten by id (we use deterministic ids).
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

// Next.js reads .env.local automatically; this script does not.
loadEnv({ path: path.join(process.cwd(), '.env.local') });
import { Index } from '@upstash/vector';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
// pdf-parse uses CommonJS; default-import the parser fn
import pdfParse from 'pdf-parse';

const DATA_DIR = path.join(process.cwd(), 'data');
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

type Chunk = { text: string; page: number; source: string };

/**
 * Naive but adequate chunker: split text into ~800-char windows with 100-char
 * overlap, attempting to break on sentence boundaries when possible.
 */
function chunkText(text: string, page: number, source: string): Chunk[] {
  const out: Chunk[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + CHUNK_SIZE);
    if (end < text.length) {
      const lookahead = text.slice(end, end + 200);
      const m = lookahead.match(/[.!?]\s/);
      if (m && m.index !== undefined) end += m.index + 1;
    }
    const piece = text.slice(i, end).trim();
    if (piece.length > 0) out.push({ text: piece, page, source });
    if (end >= text.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return out;
}

async function loadAndChunkPdf(filePath: string): Promise<Chunk[]> {
  const source = path.basename(filePath);
  const buf = await fs.readFile(filePath);
  const parsed = await pdfParse(buf);
  const pages = parsed.text.split('\f');
  const chunks: Chunk[] = [];
  pages.forEach((pageText, pageIdx) => {
    if (pageText.trim().length === 0) return;
    chunks.push(...chunkText(pageText.trim(), pageIdx + 1, source));
  });
  return chunks;
}

async function loadAllPdfs(): Promise<Chunk[]> {
  const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.pdf')).sort();
  if (files.length === 0) {
    console.error('No PDF files found in data/. Run the download script first.');
    process.exit(1);
  }
  const allChunks: Chunk[] = [];
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const chunks = await loadAndChunkPdf(filePath);
    console.log(`  ${file}: ${chunks.length} chunks`);
    allChunks.push(...chunks);
  }
  return allChunks;
}

async function main() {
  if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
    console.error('Missing UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN. Set them in .env.local.');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in .env.local.');
    process.exit(1);
  }

  console.log(`Loading and chunking PDFs from ${DATA_DIR}…`);
  const chunks = await loadAllPdfs();
  console.log(`  total: ${chunks.length} chunks from ${new Set(chunks.map(c => c.source)).size} file(s)`);

  console.log('Embedding…');
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: chunks.map((c) => c.text),
  });

  const index = new Index();
  const records = chunks.map((c, i) => ({
    id: `chunk_${i}`,
    vector: embeddings[i],
    metadata: { text: c.text, page: c.page, source: c.source },
  }));

  console.log(`Upserting ${records.length} chunks to Upstash Vector…`);
  // Upstash supports up to 1000 vectors per upsert; chunk if needed.
  const BATCH = 100;
  for (let i = 0; i < records.length; i += BATCH) {
    await index.upsert(records.slice(i, i + BATCH));
  }
  console.log('✅ Done. Run `npm run dev` and chat at http://localhost:3000');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
