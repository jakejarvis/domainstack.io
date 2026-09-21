import type { DnssecChange } from "@domainstack/types";

import {
  EmailBox,
  EmailBoxText,
  EmailButton,
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLayout,
  EmailLink,
  EmailText,
} from "../components";

export type DnssecChangeEmailProps = {
  userName: string;
  domainName: string;
  changes: DnssecChange;
  baseUrl: string;
};

const CONTENT = {
  enabled: {
    heading: "🔐 DNSSEC Enabled",
    variant: "success",
    summary: "DNSSEC validation is now active",
    guidance:
      "Resolvers that validate DNSSEC can now verify that DNS answers for this domain are authentic.",
  },
  disabled: {
    heading: "⚠️ DNSSEC Disabled",
    variant: "warning",
    summary: "The domain is no longer DNSSEC-signed",
    guidance:
      "If you didn’t expect this, check that the DS records at your registrar are still in place and that your DNS host still signs the zone. A change of DNS provider often removes signing.",
  },
  broken: {
    heading: "🚨 DNSSEC Validation Failing",
    variant: "danger",
    summary: "The domain has DNSSEC records, but validation fails",
    guidance:
      "Validating resolvers (including Cloudflare and Google Public DNS) may refuse to answer, making the domain unreachable for many visitors. This usually means the DS records at your registrar don’t match the keys your DNS host is signing with. Fix the mismatch, or remove the DS records at your registrar to turn DNSSEC off.",
  },
  recovered: {
    heading: "✅ DNSSEC Validation Recovered",
    variant: "success",
    summary: "The domain no longer fails DNSSEC validation",
    guidance: "Validating resolvers can resolve this domain again.",
  },
} as const satisfies Record<
  DnssecChange["kind"],
  { heading: string; variant: "success" | "warning" | "danger"; summary: string; guidance: string }
>;

function DnssecChangeEmail({ userName, domainName, changes, baseUrl }: DnssecChangeEmailProps) {
  const content = CONTENT[changes.kind];

  return (
    <EmailLayout previewText={`${content.summary}: ${domainName}`}>
      <EmailHeading>{content.heading}</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        {content.summary} for <strong>{domainName}</strong>.
      </EmailText>

      <EmailBox variant={content.variant}>
        <EmailBoxText variant={content.variant}>{content.guidance}</EmailBoxText>
      </EmailBox>

      <EmailButton href={`${baseUrl}/${domainName}`}>View Domain Details</EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you&apos;re tracking {domainName} on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. You can manage your
        notification settings in your <EmailLink href={`${baseUrl}/settings`}>dashboard</EmailLink>.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
DnssecChangeEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  changes: { kind: "broken", previousStatus: "secure", newStatus: "bogus" },
  baseUrl: "https://domainstack.io",
} satisfies DnssecChangeEmailProps;

export default DnssecChangeEmail;
