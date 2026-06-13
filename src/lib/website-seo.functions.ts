import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parse, type HTMLElement } from "node-html-parser";
import { promises as dns } from "node:dns";
import net from "node:net";

export type CheckStatus = "good" | "warn" | "bad";

export interface Check {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface WebsiteSeoResult {
  url: string;
  score: number;
  checks: Check[];
  issues: string[];
  fixGuide: string[];
  keywords: { word: string; count: number; density: string }[];
  stats: {
    internalLinks: number;
    externalLinks: number;
    images: number;
    imagesMissingAlt: number;
  };
}

const STOPWORDS = new Set(
  "a an the and or but if then else of in on at to for with from by is are was were be been being have has had do does did this that these those i you he she it we they them his her its our their your my me as not no so can will just about more most other some any all into out over under up down".split(
    /\s+/,
  ),
);

const SEVERITY: Record<CheckStatus, number> = { bad: 0, warn: 1, good: 2 };

function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] >= 224) return true; // multicast/reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7));
    return false;
  }
  return false;
}

async function assertPublicUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  const hostname = u.hostname.replace(/^\[|\]$/g, "");
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal") ||
    lower === "metadata.google.internal"
  ) {
    throw new Error("Host is not allowed");
  }
  let addrs: string[] = [];
  if (net.isIP(hostname)) {
    addrs = [hostname];
  } else {
    try {
      const results = await dns.lookup(hostname, { all: true });
      addrs = results.map((r) => r.address);
    } catch {
      throw new Error("Could not resolve hostname");
    }
  }
  if (addrs.length === 0) throw new Error("Could not resolve hostname");
  for (const a of addrs) {
    if (isPrivateIp(a)) throw new Error("URL resolves to a private or internal address");
  }
}

function getMeta(root: HTMLElement, name: string): string | null {
  const el =
    root.querySelector(`meta[name="${name}"]`) ||
    root.querySelector(`meta[property="${name}"]`);
  return el?.getAttribute("content")?.trim() || null;
}

export const analyzeWebsite = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      url: z
        .string()
        .min(1)
        .transform((u) => (u.startsWith("http") ? u : `https://${u}`))
        .pipe(z.string().url()),
    }),
  )
  .handler(async ({ data }): Promise<WebsiteSeoResult> => {
    await assertPublicUrl(data.url);
    let html: string;
    let finalUrl = data.url;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(data.url, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SEOAnalyzerBot/1.0; +https://lovable.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timeout);
      let current = res;
      let currentUrl = data.url;
      let hops = 0;
      while (current.status >= 300 && current.status < 400 && hops < 5) {
        const loc = current.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, currentUrl).toString();
        await assertPublicUrl(next);
        currentUrl = next;
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 10_000);
        current = await fetch(next, {
          signal: c2.signal,
          redirect: "manual",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; SEOAnalyzerBot/1.0; +https://lovable.dev)",
            Accept: "text/html,application/xhtml+xml",
          },
        });
        clearTimeout(t2);
        hops++;
      }
      finalUrl = currentUrl;
      if (!current.ok) {
        throw new Error(`Site returned status ${current.status}`);
      }
      html = await current.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach the URL";
      throw new Error(`Could not fetch the page: ${msg}`);
    }

    const root = parse(html);
    const checks: Check[] = [];

    // Title
    const title = root.querySelector("title")?.text?.trim() || "";
    if (!title) {
      checks.push({
        key: "title",
        label: "Meta Title",
        status: "bad",
        detail: "No <title> tag found.",
      });
    } else if (title.length >= 50 && title.length <= 60) {
      checks.push({
        key: "title",
        label: "Meta Title",
        status: "good",
        detail: `${title.length} characters — perfect length. "${title}"`,
      });
    } else if (title.length >= 30 && title.length <= 70) {
      checks.push({
        key: "title",
        label: "Meta Title",
        status: "warn",
        detail: `${title.length} characters — aim for 50–60. "${title}"`,
      });
    } else {
      checks.push({
        key: "title",
        label: "Meta Title",
        status: "bad",
        detail: `${title.length} characters — way off ideal 50–60. "${title}"`,
      });
    }

    // Description
    const desc = getMeta(root, "description") || "";
    if (!desc) {
      checks.push({
        key: "description",
        label: "Meta Description",
        status: "bad",
        detail: "No meta description found.",
      });
    } else if (desc.length >= 150 && desc.length <= 160) {
      checks.push({
        key: "description",
        label: "Meta Description",
        status: "good",
        detail: `${desc.length} characters — perfect.`,
      });
    } else if (desc.length >= 120 && desc.length <= 180) {
      checks.push({
        key: "description",
        label: "Meta Description",
        status: "warn",
        detail: `${desc.length} characters — aim for 150–160.`,
      });
    } else {
      checks.push({
        key: "description",
        label: "Meta Description",
        status: "bad",
        detail: `${desc.length} characters — should be 150–160.`,
      });
    }

    // H1
    const h1s = root.querySelectorAll("h1");
    if (h1s.length === 1) {
      checks.push({
        key: "h1",
        label: "H1 Tag",
        status: "good",
        detail: `One H1 found: "${h1s[0].text.trim().slice(0, 80)}"`,
      });
    } else if (h1s.length === 0) {
      checks.push({
        key: "h1",
        label: "H1 Tag",
        status: "bad",
        detail: "No H1 tag found. Every page needs exactly one H1.",
      });
    } else {
      checks.push({
        key: "h1",
        label: "H1 Tag",
        status: "bad",
        detail: `${h1s.length} H1 tags found. There should be only one.`,
      });
    }

    // H2/H3 hierarchy
    const h2s = root.querySelectorAll("h2");
    const h3s = root.querySelectorAll("h3");
    const headings = root.querySelectorAll("h1,h2,h3,h4,h5,h6");
    let badHierarchy = false;
    let prevLevel = 0;
    for (const h of headings) {
      const level = parseInt(h.tagName.substring(1), 10);
      if (prevLevel && level > prevLevel + 1) badHierarchy = true;
      prevLevel = level;
    }
    if (h2s.length === 0 && h3s.length === 0) {
      checks.push({
        key: "headings",
        label: "Heading Structure",
        status: "warn",
        detail: "No H2 or H3 subheadings. Use them to organize content.",
      });
    } else if (badHierarchy) {
      checks.push({
        key: "headings",
        label: "Heading Structure",
        status: "warn",
        detail: `Heading levels skip (e.g., H1 → H3). Use them in order.`,
      });
    } else {
      checks.push({
        key: "headings",
        label: "Heading Structure",
        status: "good",
        detail: `${h2s.length} H2s, ${h3s.length} H3s, properly nested.`,
      });
    }

    // Images alt
    const imgs = root.querySelectorAll("img");
    const missingAlt = imgs.filter(
      (i) => !(i.getAttribute("alt")?.trim()),
    ).length;
    if (imgs.length === 0) {
      checks.push({
        key: "images",
        label: "Image Alt Text",
        status: "good",
        detail: "No images on this page.",
      });
    } else if (missingAlt === 0) {
      checks.push({
        key: "images",
        label: "Image Alt Text",
        status: "good",
        detail: `All ${imgs.length} images have alt text.`,
      });
    } else if (missingAlt / imgs.length < 0.3) {
      checks.push({
        key: "images",
        label: "Image Alt Text",
        status: "warn",
        detail: `${missingAlt} of ${imgs.length} images missing alt text.`,
      });
    } else {
      checks.push({
        key: "images",
        label: "Image Alt Text",
        status: "bad",
        detail: `${missingAlt} of ${imgs.length} images missing alt text.`,
      });
    }

    // Links
    let host = "";
    try {
      host = new URL(finalUrl).hostname;
    } catch {}
    const links = root.querySelectorAll("a[href]");
    let internal = 0;
    let external = 0;
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
        continue;
      try {
        const u = new URL(href, finalUrl);
        if (u.hostname === host) internal++;
        else external++;
      } catch {
        internal++;
      }
    }
    if (internal >= 3 && external >= 1) {
      checks.push({
        key: "links",
        label: "Links",
        status: "good",
        detail: `${internal} internal, ${external} external links — good mix.`,
      });
    } else if (internal + external === 0) {
      checks.push({
        key: "links",
        label: "Links",
        status: "bad",
        detail: "No links found on the page.",
      });
    } else {
      checks.push({
        key: "links",
        label: "Links",
        status: "warn",
        detail: `${internal} internal, ${external} external. Add more for context.`,
      });
    }

    // Open Graph
    const og = {
      title: getMeta(root, "og:title"),
      description: getMeta(root, "og:description"),
      image: getMeta(root, "og:image"),
      twitter: getMeta(root, "twitter:card"),
    };
    const ogPresent = Object.values(og).filter(Boolean).length;
    if (ogPresent === 4) {
      checks.push({
        key: "og",
        label: "Open Graph / Social",
        status: "good",
        detail: "All key social-sharing tags present.",
      });
    } else if (ogPresent >= 2) {
      const missing = Object.entries(og)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ");
      checks.push({
        key: "og",
        label: "Open Graph / Social",
        status: "warn",
        detail: `Missing: ${missing}.`,
      });
    } else {
      checks.push({
        key: "og",
        label: "Open Graph / Social",
        status: "bad",
        detail: "No (or almost no) social-sharing tags. Links will look bare.",
      });
    }

    // Keyword density
    root.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
    const text = root.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
    const total = text.length || 1;
    const freq = new Map<string, number>();
    for (const w of text) freq.set(w, (freq.get(w) || 0) + 1);
    const keywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word, count]) => ({
        word,
        count,
        density: ((count / total) * 100).toFixed(2) + "%",
      }));

    // Score
    const weights: Record<string, number> = {
      title: 18,
      description: 16,
      h1: 14,
      headings: 10,
      images: 12,
      links: 10,
      og: 12,
    };
    let score = 0;
    let totalWeight = 0;
    for (const c of checks) {
      const w = weights[c.key] ?? 0;
      totalWeight += w;
      const factor = c.status === "good" ? 1 : c.status === "warn" ? 0.55 : 0.1;
      score += w * factor;
    }
    // keyword presence bonus
    if (keywords.length >= 3) score += 8;
    totalWeight += 8;
    score = Math.round((score / totalWeight) * 100);

    const issues = checks
      .filter((c) => c.status !== "good")
      .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status])
      .map((c) => `${c.label}: ${c.detail}`);

    const FIXES: Record<string, string> = {
      title:
        "Open your page's HTML and update the <title> tag to a clear, descriptive sentence of 50–60 characters that includes your main keyword.",
      description:
        "Add or edit the <meta name=\"description\"> tag in the <head>. Write a compelling summary of 150–160 characters that invites a click.",
      h1: "Make sure your page has exactly one <h1> tag near the top that clearly states what the page is about.",
      headings:
        "Use <h2> tags for main sections and <h3> for sub-sections. Don't skip levels (no jumping from H1 straight to H3).",
      images:
        "Add a short, descriptive alt=\"...\" attribute to every <img> tag. It helps screen readers and search engines understand the picture.",
      links:
        "Add a few internal links to related pages on your own site, plus at least one link to a credible external source.",
      og: "Add Open Graph tags in the <head>: og:title, og:description, og:image, and twitter:card. They control how your link previews look on social media.",
    };
    const fixGuide = checks
      .filter((c) => c.status !== "good")
      .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status])
      .map((c) => FIXES[c.key])
      .filter(Boolean);

    return {
      url: finalUrl,
      score,
      checks,
      issues,
      fixGuide,
      keywords,
      stats: {
        internalLinks: internal,
        externalLinks: external,
        images: imgs.length,
        imagesMissingAlt: missingAlt,
      },
    };
  });