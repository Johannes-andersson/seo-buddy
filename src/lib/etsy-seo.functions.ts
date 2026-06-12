import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type CheckStatus = "good" | "warn" | "bad";

export interface EtsyCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface EtsySeoResult {
  score: number;
  checks: EtsyCheck[];
  issues: string[];
  fixGuide: string[];
  optimizedTitle: string;
  optimizedDescription: string;
  optimizedTags: string[];
}

const SEVERITY: Record<CheckStatus, number> = { bad: 0, warn: 1, good: 2 };

export const analyzeEtsy = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().trim().min(1, "Title is required").max(140),
      description: z.string().trim().min(1, "Description is required").max(5000),
      tags: z.string().trim().min(1, "Tags are required").max(500),
      keyword: z.string().trim().max(60).optional().default(""),
    }),
  )
  .handler(async ({ data }): Promise<EtsySeoResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please try again later.");

    const tagsList = data.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const keyword = data.keyword.toLowerCase();
    const checks: EtsyCheck[] = [];

    // Title checks
    const titleLen = data.title.length;
    if (titleLen >= 70 && titleLen <= 140) {
      checks.push({
        key: "title-length",
        label: "Title Length",
        status: "good",
        detail: `${titleLen} characters — uses available space well.`,
      });
    } else if (titleLen >= 40) {
      checks.push({
        key: "title-length",
        label: "Title Length",
        status: "warn",
        detail: `${titleLen} characters — use closer to 140 for more keywords.`,
      });
    } else {
      checks.push({
        key: "title-length",
        label: "Title Length",
        status: "bad",
        detail: `${titleLen} characters — way too short for Etsy SEO.`,
      });
    }

    if (data.title === data.title.toUpperCase() && data.title.length > 10) {
      checks.push({
        key: "title-caps",
        label: "Title Caps",
        status: "bad",
        detail: "Title is all caps — Etsy buyers and search dislike it.",
      });
    }

    if (keyword) {
      const firstChunk = data.title.toLowerCase().slice(0, 40);
      if (firstChunk.includes(keyword)) {
        checks.push({
          key: "title-keyword",
          label: "Keyword in Title",
          status: "good",
          detail: `Main keyword "${data.keyword}" appears early in the title.`,
        });
      } else if (data.title.toLowerCase().includes(keyword)) {
        checks.push({
          key: "title-keyword",
          label: "Keyword in Title",
          status: "warn",
          detail: `Keyword appears, but not in the first 40 characters.`,
        });
      } else {
        checks.push({
          key: "title-keyword",
          label: "Keyword in Title",
          status: "bad",
          detail: `Main keyword "${data.keyword}" is missing from the title.`,
        });
      }
    }

    // Description
    const descLen = data.description.length;
    if (descLen >= 160) {
      checks.push({
        key: "desc-length",
        label: "Description Length",
        status: descLen >= 400 ? "good" : "warn",
        detail: `${descLen} characters${descLen < 400 ? " — aim for 400+ to give buyers detail." : "."}`,
      });
    } else {
      checks.push({
        key: "desc-length",
        label: "Description Length",
        status: "bad",
        detail: `Only ${descLen} characters — too short to rank or convert.`,
      });
    }

    if (keyword) {
      const firstSentence = data.description.split(/[.!?\n]/)[0]?.toLowerCase() || "";
      if (firstSentence.includes(keyword)) {
        checks.push({
          key: "desc-keyword",
          label: "Keyword in Description",
          status: "good",
          detail: "Main keyword appears in the first sentence — perfect.",
        });
      } else if (data.description.toLowerCase().includes(keyword)) {
        checks.push({
          key: "desc-keyword",
          label: "Keyword in Description",
          status: "warn",
          detail: "Keyword is in the description, but not the first sentence.",
        });
      } else {
        checks.push({
          key: "desc-keyword",
          label: "Keyword in Description",
          status: "bad",
          detail: `Main keyword "${data.keyword}" is missing from the description.`,
        });
      }
    }

    if (!data.description.includes("\n") && descLen > 300) {
      checks.push({
        key: "desc-format",
        label: "Description Format",
        status: "warn",
        detail: "One giant paragraph. Break into short paragraphs and bullet points.",
      });
    }

    // Tags
    if (tagsList.length === 13) {
      checks.push({
        key: "tag-count",
        label: "Tag Count",
        status: "good",
        detail: "Using all 13 tags — perfect.",
      });
    } else {
      checks.push({
        key: "tag-count",
        label: "Tag Count",
        status: tagsList.length >= 10 ? "warn" : "bad",
        detail: `${tagsList.length} of 13 tags used. Always use all 13.`,
      });
    }

    const tooLong = tagsList.filter((t) => t.length > 20);
    if (tooLong.length) {
      checks.push({
        key: "tag-len",
        label: "Tag Length",
        status: "bad",
        detail: `${tooLong.length} tag(s) exceed Etsy's 20-character limit.`,
      });
    }

    const dupes = tagsList.length - new Set(tagsList.map((t) => t.toLowerCase())).size;
    if (dupes > 0) {
      checks.push({
        key: "tag-dupe",
        label: "Duplicate Tags",
        status: "bad",
        detail: `${dupes} duplicate tag(s) — every tag should be unique.`,
      });
    }

    const singleWord = tagsList.filter((t) => !/\s/.test(t)).length;
    if (singleWord > tagsList.length / 2) {
      checks.push({
        key: "tag-multi",
        label: "Multi-word Tags",
        status: "warn",
        detail: `Most tags are single words. Multi-word phrases rank better on Etsy.`,
      });
    }

    // Score
    const weights: Record<string, number> = {
      "title-length": 12,
      "title-caps": 5,
      "title-keyword": 12,
      "desc-length": 10,
      "desc-keyword": 10,
      "desc-format": 6,
      "tag-count": 15,
      "tag-len": 10,
      "tag-dupe": 8,
      "tag-multi": 12,
    };
    let score = 0;
    let totalWeight = 0;
    for (const c of checks) {
      const w = weights[c.key] ?? 5;
      totalWeight += w;
      const f = c.status === "good" ? 1 : c.status === "warn" ? 0.55 : 0.1;
      score += w * f;
    }
    // implicit credit for unmentioned checks (assume good)
    for (const k of Object.keys(weights)) {
      if (!checks.find((c) => c.key === k)) {
        totalWeight += weights[k];
        score += weights[k];
      }
    }
    score = Math.round((score / totalWeight) * 100);

    const issues = checks
      .filter((c) => c.status !== "good")
      .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status])
      .map((c) => `${c.label}: ${c.detail}`);

    // AI rewrites
    const gateway = createLovableAiGatewayProvider(apiKey);
    const schema = z.object({
      optimizedTitle: z.string(),
      optimizedDescription: z.string(),
      optimizedTags: z.array(z.string()),
      fixGuide: z.array(z.string()),
    });

    let aiResult: z.infer<typeof schema>;
    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system:
          'You are an expert Etsy SEO optimizer. Reply ONLY with a valid JSON object — no markdown, no commentary — matching this shape: {"optimizedTitle": string (<=140 chars), "optimizedDescription": string (400-800 chars with line breaks), "optimizedTags": string[] (exactly 13 unique, lowercase, each <=20 chars, multi-word preferred, no punctuation), "fixGuide": string[] (3-8 plain-English step-by-step instructions)}.',
        prompt: `Optimize this Etsy listing.

CURRENT TITLE:
${data.title}

CURRENT DESCRIPTION:
${data.description}

CURRENT TAGS (${tagsList.length}): ${tagsList.join(", ")}

MAIN KEYWORD TO RANK FOR: ${data.keyword || "(not specified — infer from listing)"}

ISSUES FOUND:
${issues.length ? issues.map((i, n) => `${n + 1}. ${i}`).join("\n") : "Generally healthy, but make it stronger."}

Return ONLY the JSON object — no prose, no \`\`\` fences.`,
      });
      aiResult = schema.parse(extractJson(text));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      if (msg.includes("429")) throw new Error("AI is busy right now — please try again in a moment.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
      throw new Error(`AI request failed: ${msg}`);
    }

    return {
      score,
      checks,
      issues,
      fixGuide: aiResult.fixGuide,
      optimizedTitle: aiResult.optimizedTitle.slice(0, 140),
      optimizedDescription: aiResult.optimizedDescription,
      optimizedTags: normalizeTags(aiResult.optimizedTags, tagsList),
    };
  });

function normalizeTags(aiTags: string[], fallback: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const t = raw.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().slice(0, 20);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  aiTags.forEach(add);
  fallback.forEach(add);
  return out.slice(0, 13);
}

function extractJson(text: string): unknown {
  let s = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = s.search(/[\{\[]/);
  const end = s.lastIndexOf(s[start] === "[" ? "]" : "}");
  if (start === -1 || end === -1) throw new Error("No JSON in response");
  s = s.substring(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return JSON.parse(s.replace(/,\s*([}\]])/g, "$1").replace(/[\x00-\x1F\x7F]/g, ""));
  }
}