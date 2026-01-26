import type { Metadata } from "next";
import { BookmarkletContent } from "@/components/bookmarklet/bookmarklet-content";
import { StaticBackground } from "@/components/layout/static-background";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bookmarklets",
  description: "Discover shortcuts to investigate domains from anywhere.",
};

export default function BookmarkletsPage() {
  return (
    <div className="relative flex-1">
      <StaticBackground />

      <div className="container mx-auto flex max-w-lg flex-col py-20">
        <div className="mb-8 space-y-1">
          <h1 className="flex items-center gap-2 font-bold text-xl">
            Bookmarklets
          </h1>
          <p className="text-muted-foreground">
            Use these shortcuts to investigate domains from anywhere.
          </p>
        </div>

        <Card
          className={cn(
            "w-full overflow-hidden rounded-xl p-6",
            "border-black/15 bg-background/70 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl dark:border-white/8 dark:bg-background/60 dark:ring-white/5",
          )}
        >
          <BookmarkletContent />
        </Card>
      </div>
    </div>
  );
}
