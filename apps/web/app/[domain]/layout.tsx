import { SCROLL_PADDING, SECTION_NAV_HEIGHT } from "@/lib/constants/layout";

export default function DomainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
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
