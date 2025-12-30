import { RegistrarLinks } from "@/components/domain/registrar-links";
import { NONPUBLIC_TLDS } from "@/lib/constants/domain-validation";

interface DomainUnregisteredCardProps {
  domain: string;
}

export function DomainUnregisteredCard({
  domain,
}: DomainUnregisteredCardProps) {
  const lower = (domain ?? "").toLowerCase();
  const isNonPublicTld = NONPUBLIC_TLDS.some((suffix) =>
    lower.endsWith(suffix),
  );

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-black/10 bg-background/60 p-8 text-center shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/10"
      data-accent="pink"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-16 -top-16 h-40 accent-glow opacity-40 blur-3xl"
      />

      <div className="space-y-4.5">
        <div>
          <h2 className="font-semibold text-2xl tracking-tight sm:text-3xl">
            {domain}
          </h2>

          <p className="mt-2 text-muted-foreground text-sm sm:text-base">
            appears to be unregistered…
          </p>
        </div>

        {!isNonPublicTld ? (
          // CTA component fetches Porkbun pricing and conditionally renders
          <RegistrarLinks domain={domain} />
        ) : null}
      </div>
    </div>
  );
}
