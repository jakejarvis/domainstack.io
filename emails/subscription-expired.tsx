import { EmailBox, EmailBoxText } from "@/components/email/email-box";
import { EmailButton } from "@/components/email/email-button";
import { EmailLayout } from "@/components/email/email-layout";
import {
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLink,
  EmailSection,
  EmailText,
} from "@/components/email/email-shared";
import { BASE_URL } from "@/lib/constants/app";

type SubscriptionExpiredEmailProps = {
  userName: string;
  archivedCount: number;
  freeMaxDomains: number;
  proMaxDomains: number;
};

export function SubscriptionExpiredEmail({
  userName,
  archivedCount,
  freeMaxDomains,
  proMaxDomains,
}: SubscriptionExpiredEmailProps) {
  const previewText = "Your Pro subscription has ended";

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>Pro Subscription Ended</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        Your <strong>Domainstack Pro</strong> subscription has ended and your
        account has been switched to the free tier.
      </EmailText>

      {archivedCount > 0 && (
        <EmailBox variant="info">
          <EmailBoxText variant="info">
            <strong>
              {archivedCount} domain
              {archivedCount === 1 ? " was" : "s were"} archived
            </strong>{" "}
            to fit within the free tier limit. Don&apos;t worry — your domains
            and their data are safe. You can view them in the Archived tab on
            your dashboard.
          </EmailBoxText>
        </EmailBox>
      )}

      <EmailText>
        You can continue using Domainstack with the free tier, which includes
        tracking up to {freeMaxDomains} domains.
      </EmailText>

      <EmailText>
        Miss Pro? You can resubscribe anytime to unlock all your domains and get
        back to tracking up to {proMaxDomains} domains.
      </EmailText>

      <EmailButton variant="success" href={`${BASE_URL}/settings`}>
        Resubscribe to Pro
      </EmailButton>

      <EmailSection variant="secondaryButton">
        <EmailButton variant="secondary" href={`${BASE_URL}/dashboard`}>
          View Dashboard
        </EmailButton>
      </EmailSection>

      <EmailHr />

      <EmailFooter>
        You received this email because your Pro subscription ended on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. If you
        have any questions, just reply to this email.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
SubscriptionExpiredEmail.PreviewProps = {
  userName: "Jake",
  archivedCount: 12,
  freeMaxDomains: 5,
  proMaxDomains: 50,
} as SubscriptionExpiredEmailProps;

export default SubscriptionExpiredEmail;
