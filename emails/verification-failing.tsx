import { EmailBox, EmailBoxText } from "@/components/email/email-box";
import { EmailButton } from "@/components/email/email-button";
import { EmailLayout } from "@/components/email/email-layout";
import {
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLink,
  EmailText,
} from "@/components/email/email-shared";
import { BASE_URL } from "@/lib/constants/app";
import type { VerificationMethod } from "@/lib/schemas";

type VerificationFailingEmailProps = {
  userName: string;
  domainName: string;
  verificationMethod: VerificationMethod;
  gracePeriodDays: number;
};

const METHOD_DESCRIPTIONS: Record<VerificationMethod, string> = {
  dns_txt: "DNS TXT record",
  html_file: "HTML verification file",
  meta_tag: "meta tag",
};

export function VerificationFailingEmail({
  userName,
  domainName,
  verificationMethod,
  gracePeriodDays,
}: VerificationFailingEmailProps) {
  const methodDescription = METHOD_DESCRIPTIONS[verificationMethod];
  const previewText = `We couldn't verify your ownership of ${domainName}`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>⚠️ Verification Failing</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        We couldn&apos;t verify your ownership of <strong>{domainName}</strong>{" "}
        during our daily check. The {methodDescription} we&apos;re looking for
        appears to be missing or incorrect.
      </EmailText>

      <EmailBox variant="warning">
        <EmailBoxText variant="warning">
          <strong>Action Required:</strong> You have{" "}
          <strong>{gracePeriodDays} days</strong> to restore verification before
          your domain is removed from tracking.
        </EmailBoxText>
      </EmailBox>

      <EmailText>
        Please check that your {methodDescription} is still in place. If you
        intentionally removed it, you can re-verify ownership from your
        dashboard.
      </EmailText>

      <EmailButton href={`${BASE_URL}/dashboard`}>View Dashboard</EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you&apos;re tracking {domainName} on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. You
        can manage your notification settings in your{" "}
        <EmailLink href={`${BASE_URL}/settings`}>dashboard</EmailLink>.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
VerificationFailingEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  verificationMethod: "dns_txt",
  gracePeriodDays: 7,
} as VerificationFailingEmailProps;

export default VerificationFailingEmail;
