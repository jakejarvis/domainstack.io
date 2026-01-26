import { SCROLL_PADDING, SECTION_NAV_HEIGHT } from "@/lib/constants/layout";

export default function DomainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="container mx-auto max-w-4xl px-4 py-6"
      style={
        {
          "--section-nav-height": `${SECTION_NAV_HEIGHT}px`,
          "--scroll-padding": `${SCROLL_PADDING}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
