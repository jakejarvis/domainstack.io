import { cn } from "@domainstack/ui/utils";

export default function StaticLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1">
      <div className="container mx-auto px-4 py-8 md:px-5 md:py-12">
        <div className="mx-auto max-w-3xl sm:rounded-xl sm:border sm:bg-background sm:p-8 sm:shadow-sm md:p-10">
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
