import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { analyzeEtsy } from "@/lib/etsy-seo.functions";
import type { EtsySeoResult } from "@/lib/etsy-seo.functions";
import { SeoScore } from "./SeoScore";
import { CheckList } from "./CheckList";

export function EtsySeoTab() {
  const run = useServerFn(analyzeEtsy);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EtsySeoResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !tags.trim()) {
      toast.error("Please fill in title, description, and tags.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await run({
        data: {
          title: title.trim(),
          description: description.trim(),
          tags: tags.trim(),
          keyword: keyword.trim(),
        },
      });
      setResult(r);
      setTimeout(
        () => document.getElementById("etsy-results")?.scrollIntoView({ behavior: "smooth" }),
        80,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${what} copied!`),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="etsy-title">Listing Title</Label>
            <Input
              id="etsy-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Handmade Ceramic Coffee Mug…"
              maxLength={140}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">{title.length} / 140</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="etsy-desc">Listing Description</Label>
            <Textarea
              id="etsy-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell buyers about your product…"
              rows={6}
              maxLength={5000}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">{description.length} / 5000</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="etsy-tags">Current Tags (comma separated)</Label>
            <Textarea
              id="etsy-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ceramic mug, coffee cup, handmade gift, …"
              rows={2}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="etsy-kw">
              Main keyword <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="etsy-kw"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ceramic coffee mug"
              maxLength={60}
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full bg-accent-red text-accent-red-foreground hover:bg-accent-red/90 sm:w-auto sm:px-8"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Optimizing…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Optimize Listing
              </>
            )}
          </Button>
        </form>
      </Card>

      {result && (
        <div id="etsy-results" className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-1">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Current SEO Score
            </h2>
            <div className="flex justify-center">
              <SeoScore score={result.score} />
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              SEO Breakdown
            </h2>
            <CheckList items={result.checks} />
          </Card>

          {result.issues.length > 0 && (
            <Card className="p-6 lg:col-span-3">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                What's Wrong
              </h2>
              <ul className="space-y-2 text-sm">
                {result.issues.map((i, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-accent-red">•</span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-6 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Optimized Title
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(result.optimizedTitle, "Title")}
              >
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            </div>
            <p className="rounded-md bg-muted p-3 text-sm">{result.optimizedTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {result.optimizedTitle.length} / 140 characters
            </p>
          </Card>

          <Card className="p-6 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Optimized Description
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(result.optimizedDescription, "Description")}
              >
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm font-sans">
              {result.optimizedDescription}
            </pre>
          </Card>

          <Card className="p-6 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                13 Optimized Tags
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(result.optimizedTags.join(", "), "Tags")}
              >
                <Copy className="mr-1 h-3 w-3" /> Copy all
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.optimizedTags.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border bg-background px-3 py-1 text-sm"
                >
                  {t}
                </span>
              ))}
            </div>
          </Card>

          {result.fixGuide.length > 0 && (
            <Card className="p-6 lg:col-span-3">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Step-by-Step Fix Guide
              </h2>
              <ol className="space-y-3">
                {result.fixGuide.map((step, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-red text-sm font-bold text-accent-red-foreground">
                      {idx + 1}
                    </span>
                    <span className="pt-1 text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}