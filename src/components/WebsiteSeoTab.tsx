import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { analyzeWebsite } from "@/lib/website-seo.functions";
import type { WebsiteSeoResult } from "@/lib/website-seo.functions";
import { SeoScore } from "./SeoScore";
import { CheckList } from "./CheckList";

export function WebsiteSeoTab() {
  const run = useServerFn(analyzeWebsite);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebsiteSeoResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Please enter a website URL.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await run({ data: { url: url.trim() } });
      setResult(r);
      setTimeout(
        () => document.getElementById("ws-results")?.scrollIntoView({ behavior: "smooth" }),
        80,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            placeholder="https://yourwebsite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="h-12 text-base"
          />
          <Button
            type="submit"
            disabled={loading}
            className="h-12 px-6 bg-accent-red text-accent-red-foreground hover:bg-accent-red/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" /> Analyze
              </>
            )}
          </Button>
        </form>
      </Card>

      {result && (
        <div id="ws-results" className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-1">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Overall SEO Score
            </h2>
            <div className="flex flex-col items-center gap-4">
              <SeoScore score={result.score} />
              <p className="text-center text-xs text-muted-foreground break-all">
                {result.url}
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Internal links" value={result.stats.internalLinks} />
              <Stat label="External links" value={result.stats.externalLinks} />
              <Stat label="Images" value={result.stats.images} />
              <Stat
                label="Missing alt"
                value={result.stats.imagesMissingAlt}
                bad={result.stats.imagesMissingAlt > 0}
              />
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              SEO Breakdown
            </h2>
            <CheckList items={result.checks} />
          </Card>

          {result.issues.length > 0 && (
            <Card className="p-6 lg:col-span-2">
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

          {result.keywords.length > 0 && (
            <Card className="p-6 lg:col-span-3">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Top Keywords on Page
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map((k) => (
                  <span
                    key={k.word}
                    className="rounded-full bg-muted px-3 py-1 text-sm"
                  >
                    {k.word}{" "}
                    <span className="text-muted-foreground">
                      ({k.count} · {k.density})
                    </span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold ${bad ? "text-status-bad" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}