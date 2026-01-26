import type { Metadata } from "next";
import { BookmarkletContent } from "@/components/bookmarklet/bookmarklet-content";

export const metadata: Metadata = {
  title: "Bookmarklets",
  description: "Discover shortcuts to investigate domains from anywhere.",
};

export default function BookmarkletsPage() {
  return (
    <>
      <header className="not-prose">
        <h1 className="flex items-center gap-2.5 font-semibold text-2xl tracking-tight">
          Bookmarklets
        </h1>
        <p className="mt-2 text-muted-foreground">
          Use these shortcuts to investigate domains from anywhere.
        </p>
      </header>

      <BookmarkletContent />
    </>
  );
}
