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
        <div className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-background/80 p-6 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:p-12 dark:border-white/10">
          <article
            className={cn(
              "[&>footer]:mt-12 [&>header]:mb-8",
              "[&>section+section]:mt-8 [&>section]:scroll-mt-24 [&>section]:space-y-4",
              "[&_a]:text-foreground/95 [&_a]:underline [&_a]:decoration-muted-foreground/90 [&_a]:underline-offset-2 [&_a]:hover:text-foreground/70",
              "[&_a]:[&_.lucide-external-link]:ml-1 [&_a]:[&_.lucide-external-link]:inline-block [&_a]:[&_.lucide-external-link]:size-3.5 [&_a]:[&_.lucide-external-link]:-translate-y-0.5 [&_a]:[&_.lucide-external-link]:text-foreground/70",
              "[&_h1]:font-semibold [&_h1]:text-3xl [&_h1]:tracking-tight md:[&_h1]:text-4xl",
              "[&_h2]:font-semibold [&_h2]:text-xl [&_h2]:tracking-tight md:[&_h2]:text-2xl",
              "[&_h3]:font-medium [&_h3]:text-lg [&_h3]:tracking-tight",
              "[&_li]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:text-muted-foreground",
              "[&_p]:text-foreground/80 [&_p]:leading-relaxed",
              "[&_strong]:font-semibold [&_strong]:text-foreground",
            )}
          >
            {children}
          </article>
        </div>
      </div>
    </div>
  );
}
