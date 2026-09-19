import { StaticBackground } from "@/components/layout/static-background";
import { cn } from "@domainstack/ui/utils";

export default function StaticLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1">
      <StaticBackground />

      <div className="container mx-auto px-3 py-8 md:px-5 md:py-12">
        {/* Glassmorphism card container */}
        <div className="mx-auto max-w-3xl rounded-xl border border-black/10 bg-background/80 p-6 shadow-xl backdrop-blur-xl sm:p-8 md:p-10 dark:border-white/10">
          <article
            className={cn(
              "prose prose-sm max-w-none dark:prose-invert",
              "prose-headings:font-semibold prose-strong:font-semibold",
              "prose-a:decoration-muted-foreground/90 prose-a:hover:text-foreground/70",
              "[&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24",
              "[&_[data-slot=code-block]]:my-4",
              // Inline code (fenced blocks render through CodeBlock)
              "[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5",
            )}
          >
            {children}
          </article>
        </div>
      </div>
    </div>
  );
}
