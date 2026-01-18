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
              "[--text-base:0.925rem] [&>footer]:mt-12 [&>header]:mb-6 [&>header]:border-border/50 [&>header]:border-b [&>header]:pb-6",
              "[&>section+section]:mt-6 [&>section]:scroll-mt-24 [&>section]:space-y-4",
              "[&_a]:text-foreground/95 [&_a]:underline [&_a]:decoration-muted-foreground/90 [&_a]:underline-offset-2 [&_a]:hover:text-foreground/70",
              "[&_a]:[&_svg]:ml-1 [&_a]:[&_svg]:inline-block [&_a]:[&_svg]:size-3.5 [&_a]:[&_svg]:-translate-y-0.5 [&_a]:[&_svg]:text-foreground/70",
              "[&_h1]:font-semibold [&_h1]:text-2xl [&_h1]:tracking-tight",
              "[&_h2]:font-semibold [&_h2]:text-lg [&_h2]:tracking-tight md:[&_h2]:text-xl",
              "[&_h3]:font-medium [&_h3]:text-base [&_h3]:tracking-tight",
              "[&_li]:text-base [&_li]:leading-relaxed [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:text-muted-foreground",
              "[&_p]:text-base [&_p]:text-foreground/80 [&_p]:leading-relaxed",
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
