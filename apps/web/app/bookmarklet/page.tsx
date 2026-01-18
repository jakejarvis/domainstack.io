import { BookmarksSimpleIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { BookmarkletContent } from "@/components/bookmarklet/bookmarklet-content";
import { StaticBackground } from "@/components/layout/static-background";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bookmarklet",
  description: "Discover shortcuts to investigate domains from anywhere.",
};

export default function BookmarkletPage() {
  return (
    <div className="relative flex-1">
      <StaticBackground />

      <div className="container mx-auto flex max-w-lg flex-col py-20">
        <div className="mb-8 space-y-1">
          <h1 className="flex items-center gap-2 font-bold text-xl">
            <BookmarksSimpleIcon className="size-6" />
            Bookmarklet
          </h1>
          <p className="text-muted-foreground">
            Use these shortcuts to investigate domains from anywhere.
          </p>
        </div>

        <Card
          className={cn(
            "w-full overflow-hidden rounded-3xl p-6",
            "border-black/15 bg-background/75 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 dark:border-white/8 dark:bg-background/65 dark:ring-white/5 dark:supports-[backdrop-filter]:bg-background/55",
          )}
        >
          <BookmarkletContent />
        </Card>
      </div>
    </div>
  );
}
