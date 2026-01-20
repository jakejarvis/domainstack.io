import { StaticBackground } from "@/components/layout/static-background";
import { cn } from "@/lib/utils";

export default function StaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex-1">
      <StaticBackground />

      <div className="container mx-auto px-3 py-8 md:px-5 md:py-12">
        {/* Glassmorphism card container */}
        <div className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-background/80 px-6 py-10 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:px-10 dark:border-white/10">
          <article
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "prose-headings:font-semibold prose-strong:font-semibold",
              "prose-a:decoration-muted-foreground/90 prose-a:hover:text-foreground/70",
              // External link icons
              "prose-a:[&_svg]:mr-0.5 prose-a:[&_svg]:ml-1 prose-a:[&_svg]:inline-block prose-a:[&_svg]:size-3.5 prose-a:[&_svg]:-translate-y-0.5 prose-a:[&_svg]:text-foreground/70",
              "[&_[data-slot=code-block]]:my-4",
              "[&>header]:mb-6 [&>header]:border-border/50 [&>header]:border-b [&>header]:pb-6",
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
