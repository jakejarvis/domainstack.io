import { PLAN_QUOTAS } from "@domainstack/constants";
import {
  EmailBox,
  EmailBoxText,
  EmailButton,
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLayout,
  EmailLink,
  EmailSection,
  EmailText,
} from "../components";

export type SubscriptionExpiredEmailProps = {
  userName: string;
  archivedCount: number;
  baseUrl: string;
};

function SubscriptionExpiredEmail({
  userName,
  archivedCount,
  baseUrl,
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
        tracking up to {PLAN_QUOTAS.free} domains.
      </EmailText>

      <EmailText>
        Miss Pro? You can resubscribe anytime to unlock all your domains and get
        back to tracking up to {PLAN_QUOTAS.pro} domains.
      </EmailText>

      <EmailButton variant="success" href={`${baseUrl}/settings`}>
        Resubscribe to Pro
      </EmailButton>

      <EmailSection variant="secondaryButton">
        <EmailButton variant="secondary" href={`${baseUrl}/dashboard`}>
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
  baseUrl: "https://domainstack.io",
} as SubscriptionExpiredEmailProps;

export default SubscriptionExpiredEmail;
