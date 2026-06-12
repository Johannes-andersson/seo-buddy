import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { WebsiteSeoTab } from "@/components/WebsiteSeoTab";
import { EtsySeoTab } from "@/components/EtsySeoTab";
import { Globe, Store } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SEO Analyzer — Free SEO tool for websites and Etsy sellers" },
      {
        name: "description",
        content:
          "Free SEO analyzer for websites and Etsy listings. Get a score, find issues, and follow a plain-English step-by-step fix guide.",
      },
      { property: "og:title", content: "SEO Analyzer" },
      {
        property: "og:description",
        content: "Free SEO tool for websites and Etsy sellers.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Toaster richColors position="top-center" />
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-red text-accent-red-foreground font-bold">
            S
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SEO Analyzer</h1>
            <p className="text-xs text-muted-foreground">
              Free SEO tool for websites and Etsy sellers
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Tabs defaultValue="website" className="w-full">
          <TabsList className="mb-6 grid h-12 w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="website" className="gap-2 px-6 py-2">
              <Globe className="h-4 w-4" /> Website SEO
            </TabsTrigger>
            <TabsTrigger value="etsy" className="gap-2 px-6 py-2">
              <Store className="h-4 w-4" /> Etsy SEO
            </TabsTrigger>
          </TabsList>
          <TabsContent value="website" className="mt-0">
            <WebsiteSeoTab />
          </TabsContent>
          <TabsContent value="etsy" className="mt-0">
            <EtsySeoTab />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-muted-foreground">
          Built with AI by Johannes |{" "}
          <span className="font-medium text-foreground">@johannes_ai</span>
        </div>
      </footer>
    </div>
  );
}
