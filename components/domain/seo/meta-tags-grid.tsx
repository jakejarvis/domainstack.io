import { ExternalLink } from "lucide-react";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { PillCount } from "@/components/domain/pill-count";

export function MetaTagsGrid({
  metaTagValues,
}: {
  metaTagValues: { label: string; value?: string | null }[];
}) {
  const count = metaTagValues.filter((t) => t.value != null).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-foreground/70 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
        <span>Meta Tags</span>
        <PillCount count={count} color="orange" />
      </div>
      <KeyValueGrid colsDesktop={2}>
        {metaTagValues
          .filter((t) => t.value != null)
          .map((t) => (
            <KeyValue
              key={t.label}
              label={t.label}
              value={String(t.value)}
              suffix={
                String(t.value).startsWith("http://") ||
                String(t.value).startsWith("https://") ? (
                  <a
                    href={String(t.value)}
                    target="_blank"
                    rel="noopener"
                    className="text-muted-foreground hover:text-foreground"
                    title="Open URL in new tab"
                  >
                    <ExternalLink
                      className="!h-3.5 !w-3.5"
                      aria-hidden="true"
                    />
                  </a>
                ) : null
              }
              copyable
            />
          ))}
      </KeyValueGrid>
    </div>
  );
}
