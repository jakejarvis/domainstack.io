import { IconFlag, IconSearch } from "@tabler/icons-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RedirectedAlert({
  domain,
  finalUrl,
  ...props
}: React.ComponentProps<typeof Alert> & {
  domain: string;
  finalUrl?: string | null;
}) {
  try {
    if (!finalUrl) return null;
    const dest = new URL(finalUrl).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
    const src = domain.replace(/^www\./i, "").toLowerCase();
    if (dest === src) return null;
    return (
      <Alert {...props}>
        <IconFlag aria-hidden />
        <AlertDescription>
          <p className="text-[13px]">
            We followed a redirect to{" "}
            <Link
              href={`/${encodeURIComponent(dest)}`}
              prefetch={false}
              className="inline-flex items-center gap-1 text-foreground/90 underline underline-offset-3 hover:text-muted-foreground"
              title={`View report for ${dest}`}
            >
              <span className="font-medium">{dest}</span>
              <IconSearch className="!size-3.5" aria-hidden />
            </Link>
            {"."}
          </p>
        </AlertDescription>
      </Alert>
    );
  } catch {
    return null;
  }
}
