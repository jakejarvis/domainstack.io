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

type ProUpgradeSuccessEmailProps = {
  userName: string;
};

function ProUpgradeSuccessEmail({ userName }: ProUpgradeSuccessEmailProps) {
  const previewText = "Welcome to Domainstack Pro!";

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>🎉 Welcome to Pro!</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        Thank you for upgrading to <strong>Domainstack Pro</strong>! Your
        payment has been confirmed and your account has been upgraded.
      </EmailText>

      <EmailBox variant="success">
        <EmailBoxText variant="success" strong>
          Your Pro benefits are now active:
        </EmailBoxText>
        <EmailBoxText variant="success">
          • Track up to {PLAN_QUOTAS.pro} domains
        </EmailBoxText>
        <EmailBoxText variant="success">
          • Priority email notifications
        </EmailBoxText>
        <EmailBoxText variant="success">
          • Support ongoing development
        </EmailBoxText>
      </EmailBox>

      <EmailText>
        Head to your dashboard to start tracking more domains and customize your
        notification preferences.
      </EmailText>

      <EmailButton variant="success" href={`${BASE_URL}/dashboard`}>
        Go to Dashboard
      </EmailButton>

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
ProUpgradeSuccessEmail.PreviewProps = {
  userName: "Jake",
} as ProUpgradeSuccessEmailProps;

export default ProUpgradeSuccessEmail;
