import {
  IconArrowUp,
  IconCertificateOff,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { Fragment, useState } from "react";

import { CertificateAlert } from "@/components/domain/certificate-alert";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { RelativeAgeString } from "@/components/domain/relative-age";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ReportSection } from "@/components/domain/report-section";
import { ProviderLogo } from "@/components/icons/provider-logo";
import { sections } from "@/lib/constants/sections";
import type { Certificate, CertificatesResponse } from "@domainstack/types";
import { Badge } from "@domainstack/ui/badge";
import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { cn } from "@domainstack/ui/utils";
import { formatDate, formatDateTimeUtc } from "@domainstack/utils";

function CertificateCard({ cert }: { cert: Certificate }) {
  const sans = Array.isArray(cert.altNames)
    ? cert.altNames.filter((n) => !equalHostname(n, cert.subject))
    : [];

  return (
    <div className="relative overflow-hidden rounded-xl border bg-background/60 p-3 backdrop-blur-lg">
      <KeyValueGrid colsDesktop={2}>
        <KeyValue
          label="Issuer"
          value={cert.issuer}
          leading={
            cert.caProvider?.id ? (
              <ProviderLogo providerId={cert.caProvider.id} providerName={cert.caProvider.name} />
            ) : undefined
          }
          suffix={
            cert.caProvider?.name ? (
              <span className="text-[11px] text-muted-foreground">{cert.caProvider.name}</span>
            ) : undefined
          }
        />

        <KeyValue
          label="Subject"
          value={cert.subject}
          suffix={
            sans.length > 0 ? (
              <ResponsiveTooltip>
                <ResponsiveTooltipTrigger
                  nativeButton={false}
                  render={
                    <Badge
                      variant="outline"
                      className="gap-0 border-muted-foreground/35 px-1.5 font-mono text-[11px] text-muted-foreground/85 select-none"
                    >
                      <span>+</span>
                      <span className="px-[1px]">{sans.length}</span>
                    </Badge>
                  }
                />
                <ResponsiveTooltipContent className="max-w-[80vw] break-words whitespace-pre-wrap md:max-w-[40rem]">
                  {sans.join(", ")}
                </ResponsiveTooltipContent>
              </ResponsiveTooltip>
            ) : undefined
          }
        />

        <KeyValue
          label="Valid from"
          value={formatDate(cert.validFrom)}
          valueTooltip={formatDateTimeUtc(cert.validFrom)}
          suffix={
            <span className="text-[11px] leading-none text-muted-foreground">
              <RelativeAgeString from={cert.validFrom} />
            </span>
          }
        />

        <KeyValue
          label="Valid to"
          value={formatDate(cert.validTo)}
          valueTooltip={formatDateTimeUtc(cert.validTo)}
          suffix={
            <span className="text-[11px] leading-none text-muted-foreground">
              <RelativeExpiryString to={cert.validTo} dangerDays={7} warnDays={21} />
            </span>
          }
        />
      </KeyValueGrid>
    </div>
  );
}

export function CertificatesSection({
  data,
}: {
  domain?: string;
  data?: CertificatesResponse | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const certificates = data?.certificates ?? [];
  const error = data?.error;

  const firstCert = certificates.length > 0 ? certificates[0] : null;
  const remainingCerts = certificates.length > 1 ? certificates.slice(1) : [];

  return (
    <ReportSection {...sections.certificates}>
      {error ? (
        <CertificateAlert error={error} />
      ) : firstCert ? (
        <>
          <CertificateCard cert={firstCert} />

          {remainingCerts.length > 0 && !showAll && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={false}
                onClick={() => setShowAll(true)}
                className="text-[13px]"
              >
                <IconChevronDown className="size-4" aria-hidden />
                <span>Show Chain</span>
              </Button>
            </div>
          )}

          {remainingCerts.length > 0 && (
            <div
              className={cn(
                "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                showAll ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
              inert={!showAll}
              aria-hidden={!showAll}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="my-3 flex justify-center">
                  <IconArrowUp className="size-4 text-muted-foreground/60" aria-hidden />
                </div>
                {remainingCerts.map((cert, index) => (
                  <Fragment key={`cert-${cert.subject}-${cert.validFrom}-${cert.validTo}`}>
                    <CertificateCard cert={cert} />

                    {index < remainingCerts.length - 1 && (
                      <div className="my-3 flex justify-center">
                        <IconArrowUp className="size-4 text-muted-foreground/60" aria-hidden />
                      </div>
                    )}
                  </Fragment>
                ))}
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAll(false)}
                    className="text-[13px]"
                    aria-expanded
                  >
                    <IconChevronUp className="size-4" aria-hidden />
                    <span>Hide Chain</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconCertificateOff />
            </EmptyMedia>
            <EmptyTitle>No certificates found</EmptyTitle>
            <EmptyDescription>
              We couldn&apos;t retrieve a TLS certificate chain for this site. Ensure the domain
              resolves and serves HTTPS on port 443.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </ReportSection>
  );
}

export function equalHostname(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
