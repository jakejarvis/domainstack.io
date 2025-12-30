"use client";

import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ShieldQuestionMark,
} from "lucide-react";
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
import type { CertificatesResponse } from "@/lib/schemas";

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
          <Fragment
            key={`cert-${firstCert.subject}-${firstCert.validFrom}-${firstCert.validTo}`}
          >
            <div className="relative overflow-hidden rounded-2xl border border-border/65 bg-background/40 p-3 backdrop-blur-lg dark:border-border/50">
              <KeyValueGrid colsDesktop={2}>
                <KeyValue
                  label="Issuer"
                  value={firstCert.issuer}
                  leading={
                    firstCert.caProvider?.id ? (
                      <ProviderIcon
                        providerId={firstCert.caProvider.id}
                        providerName={firstCert.caProvider.name}
                        providerDomain={firstCert.caProvider.domain}
                        size={16}
                        className="rounded"
                      />
                    ) : undefined
                  }
                  suffix={
                    firstCert.caProvider?.name ? (
                      <span className="text-[11px] text-muted-foreground">
                        {firstCert.caProvider.name}
                      </span>
                    ) : undefined
                  }
                />

                <KeyValue
                  label="Subject"
                  value={firstCert.subject}
                  suffix={(() => {
                    const subjectName = firstCert.subject;
                    const sans = Array.isArray(firstCert.altNames)
                      ? firstCert.altNames.filter(
                          (n) => !equalHostname(n, subjectName),
                        )
                      : [];
                    return sans.length > 0 ? (
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
                    ) : undefined;
                  })()}
                />

                <KeyValue
                  label="Valid from"
                  value={formatDate(firstCert.validFrom)}
                  valueTooltip={formatDateTimeUtc(firstCert.validFrom)}
                  suffix={
                    <span className="text-[11px] text-muted-foreground leading-none">
                      <RelativeAgeString from={firstCert.validFrom} />
                    </span>
                  }
                />

                <KeyValue
                  label="Valid to"
                  value={formatDate(firstCert.validTo)}
                  valueTooltip={formatDateTimeUtc(firstCert.validTo)}
                  suffix={
                    <span className="text-[11px] text-muted-foreground leading-none">
                      <RelativeExpiryString
                        to={firstCert.validTo}
                        dangerDays={7}
                        warnDays={21}
                      />
                    </span>
                  }
                />
              </KeyValueGrid>
            </div>
          </Fragment>

          {remainingCerts.length > 0 && !showAll && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={false}
                onClick={() => setShowAll(true)}
                className="text-[13px]"
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
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
                  <div className="my-3 flex justify-center" aria-hidden>
                    <ArrowUp className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                  {remainingCerts.map((c, idx) => (
                    <Fragment
                      key={`cert-${c.subject}-${c.validFrom}-${c.validTo}`}
                    >
                      <div className="relative overflow-hidden rounded-2xl border border-border/65 bg-background/40 p-3 backdrop-blur-lg dark:border-border/50">
                        <KeyValueGrid colsDesktop={2}>
                          <KeyValue
                            label="Issuer"
                            value={c.issuer}
                            leading={
                              c.caProvider?.id ? (
                                <ProviderIcon
                                  providerId={c.caProvider.id}
                                  providerName={c.caProvider.name}
                                  providerDomain={c.caProvider.domain}
                                  size={16}
                                  className="rounded"
                                />
                              ) : undefined
                            }
                            suffix={
                              c.caProvider?.name ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {c.caProvider.name}
                                </span>
                              ) : undefined
                            }
                          />

                          <KeyValue
                            label="Subject"
                            value={c.subject}
                            suffix={(() => {
                              const subjectName = c.subject;
                              const sans = Array.isArray(c.altNames)
                                ? c.altNames.filter(
                                    (n) => !equalHostname(n, subjectName),
                                  )
                                : [];
                              return sans.length > 0 ? (
                                <ResponsiveTooltip>
                                  <ResponsiveTooltipTrigger
                                    nativeButton={false}
                                    render={
                                      <Badge
                                        variant="outline"
                                        className="select-none gap-0 border-muted-foreground/35 px-1.5 font-mono text-[11px] text-muted-foreground/85"
                                      >
                                        <span>+</span>
                                        <span className="px-[1px]">
                                          {sans.length}
                                        </span>
                                      </Badge>
                                    }
                                  />
                                  <ResponsiveTooltipContent className="max-w-[80vw] whitespace-pre-wrap break-words md:max-w-[40rem]">
                                    {sans.join(", ")}
                                  </ResponsiveTooltipContent>
                                </ResponsiveTooltip>
                              ) : undefined;
                            })()}
                          />

                          <KeyValue
                            label="Valid from"
                            value={formatDate(c.validFrom)}
                            valueTooltip={formatDateTimeUtc(c.validFrom)}
                            suffix={
                              <span className="text-[11px] text-muted-foreground leading-none">
                                <RelativeAgeString from={c.validFrom} />
                              </span>
                            }
                          />

                          <KeyValue
                            label="Valid to"
                            value={formatDate(c.validTo)}
                            valueTooltip={formatDateTimeUtc(c.validTo)}
                            suffix={
                              <span className="text-[11px] text-muted-foreground leading-none">
                                <RelativeExpiryString
                                  to={c.validTo}
                                  dangerDays={7}
                                  warnDays={21}
                                />
                              </span>
                            }
                          />
                        </KeyValueGrid>
                      </div>

                      {idx < remainingCerts.length - 1 && (
                        <div className="my-3 flex justify-center" aria-hidden>
                          <ArrowUp className="h-4 w-4 text-muted-foreground/60" />
                        </div>
                      )}
                    </Fragment>
                  ))}
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={true}
                      onClick={() => setShowAll(false)}
                      className="text-[13px]"
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden />
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
              <ShieldQuestionMark />
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
