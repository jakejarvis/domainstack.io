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
import { PLAN_QUOTAS } from "@/lib/constants/plan-quotas";

type ProWelcomeEmailProps = {
  userName: string;
};

export function ProWelcomeEmail({ userName }: ProWelcomeEmailProps) {
  const previewText = "Get the most out of Domainstack Pro";

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>Getting Started with Pro</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        Thanks again for joining Domainstack Pro! Here are a few tips to help
        you get the most out of your subscription.
      </EmailText>

      <EmailBox variant="tip">
        <EmailBoxText variant="tip" strong>
          1. Add Your Domains
        </EmailBoxText>
        <EmailBoxText variant="tip">
          You can now track up to {PLAN_QUOTAS.pro} domains. Add them from your
          dashboard and verify ownership to start receiving alerts.
        </EmailBoxText>
      </EmailBox>

      <EmailBox variant="tip">
        <EmailBoxText variant="tip" strong>
          2. Set Up Notifications
        </EmailBoxText>
        <EmailBoxText variant="tip">
          Customize when you receive alerts for domain expiration, SSL
          certificate expiry, and verification status changes.
        </EmailBoxText>
      </EmailBox>

      <EmailBox variant="tip">
        <EmailBoxText variant="tip" strong>
          3. Stay Organized
        </EmailBoxText>
        <EmailBoxText variant="tip">
          Archive domains you&apos;re not actively monitoring. They won&apos;t
          count against your limit and you can restore them anytime.
        </EmailBoxText>
      </EmailBox>

      <EmailText>
        Have questions or feedback? Just reply to this email — we&apos;d love to
        hear from you.
      </EmailText>

      <EmailButton href={`${BASE_URL}/dashboard`}>Open Dashboard</EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you upgraded to Pro on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. Manage
        your subscription in your{" "}
        <EmailLink href={`${BASE_URL}/settings`}>account settings</EmailLink>.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
ProWelcomeEmail.PreviewProps = {
  userName: "Jake",
} as ProWelcomeEmailProps;

export default ProWelcomeEmail;
