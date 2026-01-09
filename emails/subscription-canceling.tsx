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

type SubscriptionCancelingEmailProps = {
  userName: string;
  endDate: string;
};

function SubscriptionCancelingEmail({
  userName,
  endDate,
}: SubscriptionCancelingEmailProps) {
  const previewText = `Your Pro subscription ends on ${endDate}`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>Subscription Canceled</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        We&apos;ve received your cancellation request. Your{" "}
        <strong>Domainstack Pro</strong> subscription will remain active until{" "}
        <strong>{endDate}</strong>.
      </EmailText>

      <EmailBox variant="warning">
        <EmailBoxText variant="warning" strong>
          What happens next:
        </EmailBoxText>
        <EmailBoxText variant="warning">
          • You&apos;ll keep full Pro access until {endDate}
        </EmailBoxText>
        <EmailBoxText variant="warning">
          • After that, your account will switch to the free tier
        </EmailBoxText>
        <EmailBoxText variant="warning">
          • Domains beyond the free limit will be archived (not deleted)
        </EmailBoxText>
      </EmailBox>

      <EmailText>
        Changed your mind? You can resubscribe anytime before {endDate} to keep
        your Pro benefits without interruption.
      </EmailText>

      <EmailButton href={`${BASE_URL}/settings`}>
        Manage Subscription
      </EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you canceled your Pro subscription on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. If you
        have any questions, just reply to this email.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
SubscriptionCancelingEmail.PreviewProps = {
  userName: "Jake",
  endDate: "January 15, 2025",
} as SubscriptionCancelingEmailProps;

export default SubscriptionCancelingEmail;
