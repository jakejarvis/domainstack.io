import {
  ArrowUpIcon,
  CaretDownIcon,
  CaretUpIcon,
  SealQuestionIcon,
} from "@phosphor-icons/react/ssr";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState } from "react";
import { CertificateAlert } from "@/components/domain/certificate-alert";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { RelativeAgeString } from "@/components/domain/relative-age";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ReportSection } from "@/components/domain/report-section";
import { ProviderIcon } from "@/components/icons/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { sections } from "@/lib/constants/sections";
import { formatDate, formatDateTimeUtc } from "@/lib/format";
import type {
  Certificate,
  CertificatesResponse,
} from "@/lib/types/domain/certificates";

function CertificateCard({ cert }: { cert: Certificate }) {
  const sans = Array.isArray(cert.altNames)
    ? cert.altNames.filter((n) => !equalHostname(n, cert.subject))
    : [];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/65 bg-background/40 p-3 backdrop-blur-lg dark:border-border/50">
      <KeyValueGrid colsDesktop={2}>
        <KeyValue
          label="Issuer"
          value={cert.issuer}
          leading={
            cert.caProvider?.id ? (
              <ProviderIcon
                providerId={cert.caProvider.id}
                providerName={cert.caProvider.name}
                providerDomain={cert.caProvider.domain}
              />
            ) : undefined
          }
          suffix={
            cert.caProvider?.name ? (
              <span className="text-[11px] text-muted-foreground">
                {cert.caProvider.name}
              </span>
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
                      className="select-none gap-0 border-muted-foreground/35 px-1.5 font-mono text-[11px] text-muted-foreground/85"
                    >
                      <span>+</span>
                      <span className="px-[1px]">{sans.length}</span>
                    </Badge>
                  }
                />
                <ResponsiveTooltipContent className="max-w-[80vw] whitespace-pre-wrap break-words md:max-w-[40rem]">
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
            <span className="text-[11px] text-muted-foreground leading-none">
              <RelativeAgeString from={cert.validFrom} />
            </span>
          }
        />

        <KeyValue
          label="Valid to"
          value={formatDate(cert.validTo)}
          valueTooltip={formatDateTimeUtc(cert.validTo)}
          suffix={
            <span className="text-[11px] text-muted-foreground leading-none">
              <RelativeExpiryString
                to={cert.validTo}
                dangerDays={7}
                warnDays={21}
              />
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
                <CaretDownIcon className="size-4" aria-hidden />
                <span>Show Chain</span>
              </Button>
            </div>
          )}

          {remainingCerts.length > 0 && (
            <AnimatePresence initial={false}>
              {showAll && (
                <motion.div
                  key="cert-chain"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="my-3 flex justify-center">
                    <ArrowUpIcon
                      className="size-4 text-muted-foreground/60"
                      aria-hidden
                    />
                  </div>
                  {remainingCerts.map((cert, index) => (
                    <Fragment
                      key={`cert-${cert.subject}-${cert.validFrom}-${cert.validTo}`}
                    >
                      <CertificateCard cert={cert} />

                      {index < remainingCerts.length - 1 && (
                        <div className="my-3 flex justify-center">
                          <ArrowUpIcon
                            className="size-4 text-muted-foreground/60"
                            aria-hidden
                          />
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
                      <CaretUpIcon className="size-4" aria-hidden />
                      <span>Hide Chain</span>
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SealQuestionIcon />
            </EmptyMedia>
            <EmptyTitle>No certificates found</EmptyTitle>
            <EmptyDescription>
              We couldn&apos;t retrieve a TLS certificate chain for this site.
              Ensure the domain resolves and serves HTTPS on port 443.
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
