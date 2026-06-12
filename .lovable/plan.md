
# SEO Analyzer — Build Plan

## Stack & Setup
- TanStack Start (existing) + Tailwind v4
- Enable **Lovable AI Gateway** for Etsy AI rewrites (Gemini 2.5 Flash, free during promo)
- No database, no auth — fully stateless

## Design
- White background, dark text, red accent `#E53935`
- Add `--accent` token to `src/styles.css`
- Card-based results, mobile responsive, Inter font

## Routes / Files
- `src/routes/index.tsx` — single page with header, tabbed UI, footer
- `src/components/WebsiteSeoTab.tsx` — URL input, results
- `src/components/EtsySeoTab.tsx` — three inputs + optional keyword, results
- `src/components/SeoScore.tsx` — circular/colored score display
- `src/components/IssueList.tsx` — color-coded breakdown + "What's Wrong" + step-by-step fix guide
- `src/lib/website-seo.functions.ts` — `analyzeWebsite(url)` server fn
- `src/lib/etsy-seo.functions.ts` — `analyzeEtsy({title, description, tags, keyword?})` server fn

## Tab 1 — Website SEO (server-side fetch + parse)
Server function:
1. Validate URL (zod), fetch HTML with 10s timeout, browser-like User-Agent
2. Parse with `node-html-parser` (lightweight, edge-compatible)
3. Compute checks:
   - **Title**: present? length 50–60 = green, 30–70 = orange, else red
   - **Meta description**: present? 150–160 = green, 120–180 = orange, else red
   - **H1**: exactly one = green, missing/multiple = red
   - **H2/H3 hierarchy**: H2 exists, no H3-before-H2 jumps
   - **Image alts**: count imgs missing alt
   - **Links**: count internal vs external (compare hostnames)
   - **Keyword density**: tokenize visible text, strip stopwords, top 5 terms with % frequency
   - **Open Graph**: check `og:title`, `og:description`, `og:image`, `twitter:card`
4. Weighted score → 0–100
5. Return: `{ score, checks[], issues[], fixGuide[] }` where each check has `{label, status: 'good'|'warn'|'bad', detail}`
6. Fix guide generated deterministically — sorted by severity (red first), plain-English instructions

## Tab 2 — Etsy SEO (rule-based + AI rewrites)
Server function:
1. Zod-validate inputs (title ≤140, description ≤5000, tags split by comma, each ≤20 chars per Etsy rules)
2. Rule-based scoring:
   - Title: 70–140 chars, keyword in first 40 chars, no ALL CAPS
   - Description: ≥160 chars, keyword in first sentence, has line breaks
   - Tags: count = 13, no duplicates, multi-word preferred, each ≤20 chars, keyword variants present
3. Call **Lovable AI Gateway** (`google/gemini-2.5-flash`) with structured JSON prompt to produce:
   - Optimized title (≤140 chars, keyword-front-loaded)
   - Optimized description (with hook, keyword usage, scannable format)
   - 13 tag suggestions (each ≤20 chars, multi-word, no duplicates, long-tail)
4. Combine rule-based "what's wrong" + AI rewrites + step-by-step fix guide

## UI Behavior
- Loading spinner during analysis (button disabled, spinner inline)
- Error toast (sonner) for: empty fields, invalid URL, unreachable site, AI failure
- Results render in cards below the form; scroll into view on success
- Reset/"Analyze another" button

## Footer
"Built with AI by Johannes | @johannes_ai"

## Header
Title "SEO Analyzer" + tagline "Free SEO tool for websites and Etsy sellers"

## Dependencies to add
- `node-html-parser` (HTML parsing, edge-safe)
- `zod` (likely already present)

## Out of scope
- No saved history, no accounts, no rate limiting
- No screenshot rendering of analyzed sites
- No PageSpeed / Core Web Vitals (would need external API)
