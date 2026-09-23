import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@domainstack/ui/accordion";

export function FaqSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <Accordion className="w-full rounded-lg border bg-card/60">{children}</Accordion>
    </section>
  );
}

export function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <AccordionItem
      value={question}
      className="border-b border-border px-4 last:border-none [&>h3]:m-0"
    >
      <AccordionTrigger className="not-prose text-left tracking-[0.01em] text-foreground decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
        {question}
      </AccordionTrigger>
      <AccordionContent className="pt-1 text-foreground/90 *:first:mt-1 *:last:mb-1">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
