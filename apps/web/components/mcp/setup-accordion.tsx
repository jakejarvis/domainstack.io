import { IconBook2, IconExternalLink } from "@tabler/icons-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@domainstack/ui/accordion";

export function SetupAccordion({ children }: { children: React.ReactNode }) {
  return (
    <Accordion className="not-prose w-full rounded-lg border bg-muted/20">{children}</Accordion>
  );
}

export function SetupItem({
  id,
  icon,
  label,
  docsUrl,
  docsLabel,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  docsUrl: string;
  docsLabel: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={id} className="border-b border-border px-4 last:border-none">
      <AccordionTrigger className="text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
        <span className="flex items-center gap-2.5 [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {label}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pt-1 text-foreground/90">
        {children}
        <p className="mt-2 flex items-center gap-1 text-xs leading-relaxed text-muted-foreground">
          <IconBook2 className="mr-[1px] size-3" />
          Need help?
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            {docsLabel}
            <IconExternalLink className="size-3 -translate-y-[1px]" />
          </a>
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}
