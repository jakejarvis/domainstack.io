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
              // External link icons
              "prose-a:[&_svg]:mr-0.5 prose-a:[&_svg]:ml-1 prose-a:[&_svg]:inline-block prose-a:[&_svg]:size-3.5 prose-a:[&_svg]:-translate-y-0.5 prose-a:[&_svg]:text-foreground/70",
              "[&_[data-slot=code-block]]:my-4",
              "[&>header]:mt-1 [&>header]:mb-6 [&>header]:border-b [&>header]:border-border [&>header]:pb-6",
              "[&>section]:scroll-mt-24",
            )}
          >
            {children}
          </article>
        </div>
      </div>
    </div>
  );
}
