/**
 * Seed Upstash Vector with chunks from all PDFs in data/.
 *
 * Run once before starting the chat:
 *   npm run seed
 *
 * Re-run any time you add or replace PDFs in data/.
 * The index is reset before upserting, so each run fully replaces its contents.
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
// 800/100 for prose was chosen in notebooks/rag-evaluation.ipynb: larger chunks
// diluted relevance, and retrieval improved more from topK than chunk size.
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
// Fragments shorter than this (photo captions, scan noise) are not indexed.
const MIN_CHUNK_CHARS = 50;
// A trailing piece shorter than this is folded into the previous chunk.
const MIN_TAIL_CHARS = 200;

type Chunk = { text: string; page: number; pageEnd: number; source: string };

/**
 * A run of the document chunked one way. 'prose' is split into overlapping
 * windows on sentence boundaries; 'records' (fact-sheet entries, catalog rows,
 * tables) is split only between lines, so a row is never cut in half.
 * `label` is prepended to every chunk so it keeps its context on its own.
 */
type Section = { start: number; end: number; kind: 'prose' | 'records'; label?: string };

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

type PageData = {
  pageIndex: number;
  getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }>;
};

/**
 * pdf-parse joins all pages into one string with no page separators, so we
 * capture each page's text via the pagerender hook instead. The line-joining
 * logic mirrors pdf-parse's default renderer.
 */
async function extractPages(buf: Buffer): Promise<string[]> {
  const pages: string[] = [];
  await pdfParse(buf, {
    pagerender: async (pageData: PageData) => {
      const { items } = await pageData.getTextContent();
      let lastY: number | undefined;
      let text = '';
      for (const item of items) {
        text += lastY === undefined || lastY === item.transform[5] ? item.str : '\n' + item.str;
        lastY = item.transform[5];
      }
      pages[pageData.pageIndex] = text;
      return text;
    },
  });
  return pages;
}

/** Re-join words hyphenated across line breaks ("Mon-\ntana" → "Montana"). */
function dehyphenate(text: string): string {
  return text.replace(/(\w)- *\n *([a-z])/g, '$1$2');
}

// ---------------------------------------------------------------------------
// Page tracking
//
// Pages are joined into one string with a marker at the start of each page, so
// chunks can cross page breaks (fact-sheet entries and paragraphs do) while
// still reporting the pages they came from.
// ---------------------------------------------------------------------------

const PAGE_MARKER = /⟦(\d+)⟧/g;

function joinPages(pages: string[]): string {
  return pages.map((text, i) => `⟦${i + 1}⟧${text ?? ''}`).join('\n');
}

function pageRange(doc: string, start: number, end: number): { page: number; pageEnd: number } {
  let page = 1;
  let pageEnd = 1;
  for (const m of doc.matchAll(PAGE_MARKER)) {
    const at = m.index!;
    if (at >= end) break;
    const n = Number(m[1]);
    if (at <= start) page = n;
    // Only count a page as spanned if the chunk has real text on it.
    if (doc.slice(at + m[0].length, end).trim().length > 0) pageEnd = n;
  }
  return { page, pageEnd: Math.max(page, pageEnd) };
}

// ---------------------------------------------------------------------------
// Splitters
// ---------------------------------------------------------------------------

/** Split prose into ~CHUNK_SIZE windows that start and end on sentence boundaries. */
function proseRanges(doc: string, start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  let i = start;
  while (i < end) {
    let e = Math.min(end, i + CHUNK_SIZE);
    if (e < end) {
      const m = doc.slice(e, Math.min(end, e + 200)).match(/[.!?]["”’)]?\s/);
      if (m?.index !== undefined) e += m.index + m[0].length - 1;
    }
    if (end - e < MIN_TAIL_CHARS) e = end;
    out.push([i, e]);
    if (e >= end) break;

    // Back up by about CHUNK_OVERLAP, starting the next chunk at a sentence start
    // if there is one nearby, otherwise at a word boundary.
    const from = e - CHUNK_OVERLAP * 2;
    const window = doc.slice(from, e - 20);
    const boundaries = [...window.matchAll(/[.!?]["”’)]?\s+/g)];
    const last = boundaries.at(-1);
    if (last?.index !== undefined) {
      i = from + last.index + last[0].length;
    } else {
      const space = doc.indexOf(' ', e - CHUNK_OVERLAP);
      i = space > 0 && space < e ? space + 1 : e - CHUNK_OVERLAP;
    }
  }
  return out;
}

/** Split line-oriented content into ~CHUNK_SIZE groups of whole lines. */
function recordRanges(doc: string, start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  let chunkStart = -1;
  let chunkEnd = -1;
  for (const m of doc.slice(start, end).matchAll(/[^\n]+/g)) {
    const lineStart = start + m.index!;
    const lineEnd = lineStart + m[0].length;
    if (chunkStart >= 0 && lineEnd - chunkStart > CHUNK_SIZE) {
      out.push([chunkStart, chunkEnd]);
      chunkStart = -1;
    }
    if (chunkStart < 0) chunkStart = lineStart;
    chunkEnd = lineEnd;
  }
  if (chunkStart >= 0) {
    // Fold a short trailing group into the previous one rather than leave a stub.
    if (out.length > 0 && chunkEnd - chunkStart < MIN_TAIL_CHARS) out[out.length - 1][1] = chunkEnd;
    else out.push([chunkStart, chunkEnd]);
  }
  return out;
}

function cleanText(raw: string, kind: Section['kind']): string {
  const text = raw.replace(PAGE_MARKER, '');
  if (kind === 'prose') return text.replace(/\s+/g, ' ').trim();
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Per-document structure
// ---------------------------------------------------------------------------

/**
 * USGS "Natural Gemstones": general prose plus a fact sheet of 20 gem groups
 * ("Beryl (hardness: 7.5-8 Mohs)" followed by formula, specific gravity and
 * varieties). Each entry becomes its own chunk so a gem's properties are never
 * split or mixed with the next gem's.
 */
function usgsNaturalGemstones(pages: string[]): { doc: string; sections: Section[] } {
  const cleaned = pages.map((page) => {
    const lines = dehyphenate(page ?? '').split('\n');
    // Pages open with a photo caption ("Aquamarine, Brazil."); drop it.
    if (/^[^\n]{3,120}, [A-Z][\w .]+\.\s*$/.test(lines[0] ?? '')) lines.shift();
    // Bare page numbers.
    return lines.filter((line) => !/^\s*\d+\s*$/.test(line)).join('\n');
  });
  const doc = joinPages(cleaned);

  // Entry headers, and the headings of the sections that follow each group of entries.
  // Names can be two words or carry an alias: "Lapis lazuli", "Peridot [Olivine]".
  const entries = [...doc.matchAll(/^(?:⟦\d+⟧)?([A-Z][a-z]+(?: [a-z]+| \[[A-Z][a-z]+\])?) \(hardness:/gm)];
  const stops = [...doc.matchAll(/^(?:⟦\d+⟧)?(Birthstones|Buyer beware)\s*$/gm)].map((m) => m.index!);

  const sections: Section[] = [];
  let cursor = 0;
  entries.forEach((m, i) => {
    const start = m.index!;
    const nextEntry = entries[i + 1]?.index ?? doc.length;
    const end = Math.min(nextEntry, ...stops.filter((s) => s > start));
    if (start > cursor) sections.push({ start: cursor, end: start, kind: 'prose' });
    sections.push({ start, end, kind: 'records', label: `USGS gemstone fact sheet: ${m[1]}` });
    cursor = end;
  });
  sections.push({ start: cursor, end: doc.length, kind: 'prose' });
  return { doc, sections };
}

/**
 * "Gems in the Smithsonian Institution": prose chapters under all-caps
 * headings (one per gem species), followed by a properties table and a catalog
 * of the collection grouped by species ("44.5, blue (The Hope), India (3551,
 * Winston)"). Chunks carry their heading so a catalog row still says which gem
 * it is, and what its numbers mean.
 */
// All-caps lines that are labels on the star-sapphire diagram (p.16), not headings.
const SMITHSONIAN_FIGURE_LABELS = [
  'CRYSTAL AXIS',
  'POSITION STONE MUST TAKE TO SHOW STAR',
  'THE CRYSTAL',
  'ROUGH SAPPHIRE CRYSTAL',
  'OTHER STAR STONES MAY BE CUT',
];
const SMITHSONIAN_SUBHEADINGS = new Set(['VARIETIES', 'VARIETIES:', 'CRYSTALLINE VARIETIES']);
const SMITHSONIAN_TABLES = new Set(['CHARACTERISTICS OF SOME COMMON GEMS']);
const SMITHSONIAN_CATALOG_START = 'SOME NOTABLE GEMS IN THE COLLECTION';
const SMITHSONIAN_CATALOG_FORMAT =
  'weight in carats, color, origin (catalog number, donor or collection: L = Lea, R = Roebling)';

function smithsonianGems(pages: string[]): { doc: string; sections: Section[] } {
  let doc = joinPages(pages.map((page) => dehyphenate(page ?? '')));
  // Everything after the transcriber's notes is Project Gutenberg boilerplate.
  const notes = doc.indexOf('Transcriber’s Notes');
  if (notes > 0) doc = doc.slice(0, notes);

  const headingRe = /^(?:⟦\d+⟧)?([A-Z][A-Z’'\-,& ]*[A-Z]:?(?::? [A-Z][A-Za-z ]+)?)[ \t]*$/gm;
  const headings = [...doc.matchAll(headingRe)].filter(
    (m) => m[1].length >= 4 && !SMITHSONIAN_FIGURE_LABELS.some((label) => m[1].startsWith(label)),
  );

  const sections: Section[] = [];
  let chapter = '';
  let inCatalog = false;
  if (headings.length > 0) sections.push({ start: 0, end: headings[0].index!, kind: 'prose' });
  headings.forEach((m, i) => {
    const title = m[1];
    const start = m.index! + m[0].length;
    const end = headings[i + 1]?.index ?? doc.length;

    let label: string;
    let kind: Section['kind'] = 'prose';
    if (SMITHSONIAN_SUBHEADINGS.has(title)) {
      label = `${chapter} — ${title.replace(/:$/, '')}`;
    } else if (inCatalog) {
      label = `Smithsonian collection list — ${title} (${SMITHSONIAN_CATALOG_FORMAT})`;
      kind = 'records';
    } else {
      chapter = title;
      label = title;
      if (SMITHSONIAN_TABLES.has(title)) kind = 'records';
    }
    if (title === SMITHSONIAN_CATALOG_START) inCatalog = true;
    sections.push({ start, end, kind, label });
  });
  return { doc, sections };
}

/** Anything without a dedicated handler (the 2-page USGS commodity summary) is chunked as prose. */
function genericDocument(pages: string[]): { doc: string; sections: Section[] } {
  const doc = joinPages(pages.map((page) => dehyphenate(page ?? '')));
  return { doc, sections: [{ start: 0, end: doc.length, kind: 'prose' }] };
}

const DOCUMENT_HANDLERS: Record<string, (pages: string[]) => { doc: string; sections: Section[] }> = {
  'usgs-natural-gemstones.pdf': usgsNaturalGemstones,
  'smithsonian-gems.pdf': smithsonianGems,
};

// ---------------------------------------------------------------------------

async function loadAndChunkPdf(filePath: string): Promise<Chunk[]> {
  const source = path.basename(filePath);
  const pages = await extractPages(await fs.readFile(filePath));
  const { doc, sections } = (DOCUMENT_HANDLERS[source] ?? genericDocument)(pages);

  const chunks: Chunk[] = [];
  for (const section of sections) {
    const split = section.kind === 'prose' ? proseRanges : recordRanges;
    for (const [start, end] of split(doc, section.start, section.end)) {
      const body = cleanText(doc.slice(start, end), section.kind);
      // A labelled record group can be legitimately short (a catalog species
      // with one stone); the label gives it context, so keep it.
      const isLabelledRecord = section.kind === 'records' && section.label;
      if (body.length === 0 || (!isLabelledRecord && body.length < MIN_CHUNK_CHARS)) continue;
      const text = section.label ? `${section.label}\n${body}` : body;
      chunks.push({ text, source, ...pageRange(doc, start, end) });
    }
  }
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
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun && (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN)) {
    console.error('Missing UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN. Set them in .env.local.');
    process.exit(1);
  }
  if (!dryRun && !process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in .env.local.');
    process.exit(1);
  }

  console.log(`Loading and chunking PDFs from ${DATA_DIR}…`);
  const chunks = await loadAllPdfs();
  console.log(`  total: ${chunks.length} chunks from ${new Set(chunks.map(c => c.source)).size} file(s)`);

  if (dryRun) {
    // Inspect chunking without embedding or touching the index.
    const out = path.join(process.cwd(), 'chunks.dry-run.json');
    await fs.writeFile(out, JSON.stringify(chunks, null, 2));
    console.log(`Dry run: wrote ${out}`);
    return;
  }

  console.log('Embedding…');
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: chunks.map((c) => c.text),
  });

  const index = new Index();
  const records = chunks.map((c, i) => ({
    id: `chunk_${i}`,
    vector: embeddings[i],
    metadata: { text: c.text, page: c.page, pageEnd: c.pageEnd, source: c.source },
  }));

  // Clear the index so chunks from a previous seed (e.g. with a different
  // chunk count) don't linger. Done after embedding to keep the empty window short.
  console.log('Resetting index…');
  await index.reset();

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
