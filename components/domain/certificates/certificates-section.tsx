"use client";

import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ShieldQuestionMark,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState } from "react";
import { Favicon } from "@/components/domain/favicon";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { RelativeAgeString } from "@/components/domain/relative-age";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { Section } from "@/components/domain/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { sections } from "@/lib/constants/sections";
import { formatDate, formatDateTimeUtc } from "@/lib/format";
import type { Certificate } from "@/lib/schemas";

export function CertificatesSection({
  data,
}: {
  domain?: string;
  data?: Certificate[] | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const firstCert = data && data.length > 0 ? data[0] : null;
  const remainingCerts = data && data.length > 1 ? data.slice(1) : [];
  const hasExpiredCert = data?.some((cert) => cert.expired) ?? false;

  return (
    <Section {...sections.certificates}>
      {firstCert ? (
        <>
          {hasExpiredCert && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle />
              <AlertTitle>Certificate Expired</AlertTitle>
              <AlertDescription>
                This domain&apos;s SSL/TLS certificate has expired. Browsers
                will show security warnings when visitors try to access this
                site over HTTPS. Renew the certificate as soon as possible to
                restore secure connections.
              </AlertDescription>
            </Alert>
          )}

          <Fragment
            key={`cert-${firstCert.subject}-${firstCert.validFrom}-${firstCert.validTo}`}
          >
            <div className="relative mb-0 overflow-hidden rounded-2xl border border-black/5 bg-background/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/40 dark:border-white/5">
              <KeyValueGrid colsDesktop={2}>
                <KeyValue
                  label="Issuer"
                  value={firstCert.issuer}
                  leading={
                    firstCert.caProvider?.domain ? (
                      <Favicon
                        domain={firstCert.caProvider.domain}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="select-none gap-0 border-muted-foreground/35 px-1.5 font-mono text-[11px] text-muted-foreground/85"
                          >
                            <span>+</span>
                            <span className="px-[1px]">{sans.length}</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[80vw] whitespace-pre-wrap break-words md:max-w-[40rem]">
                          {sans.join(", ")}
                        </TooltipContent>
                      </Tooltip>
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
                className="cursor-pointer text-[13px]"
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
                      <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-background/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/40 dark:border-white/5">
                        <KeyValueGrid colsDesktop={2}>
                          <KeyValue
                            label="Issuer"
                            value={c.issuer}
                            leading={
                              c.caProvider?.domain ? (
                                <Favicon
                                  domain={c.caProvider.domain}
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
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="select-none gap-0 border-muted-foreground/35 px-1.5 font-mono text-[11px] text-muted-foreground/85"
                                    >
                                      <span>+</span>
                                      <span className="px-[1px]">
                                        {sans.length}
                                      </span>
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[80vw] whitespace-pre-wrap break-words md:max-w-[40rem]">
                                    {sans.join(", ")}
                                  </TooltipContent>
                                </Tooltip>
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
    </Section>
  );
}

export function equalHostname(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
