import {
  EmailBox,
  EmailBoxText,
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLayout,
  EmailLink,
  EmailText,
} from "../components";

export type EmailChangedNoticeEmailProps = {
  userName: string;
  baseUrl: string;
};

function EmailChangedNoticeEmail({ userName, baseUrl }: EmailChangedNoticeEmailProps) {
  const previewText = "The email address on your Domainstack account was changed";

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>Your Email Address Was Changed</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        The email address on your Domainstack account was just changed. Alerts and account emails
        now go to the new address, and this one will no longer receive them.
      </EmailText>

      <EmailBox variant="warning">
        <EmailBoxText variant="warning">
          Didn&apos;t make this change? Sign in with your login provider, change the address back
          under Settings → Account, and contact us at{" "}
          <EmailLink href={`${baseUrl}/help#contact`}>domainstack.io/help</EmailLink>.
        </EmailBoxText>
      </EmailBox>

      <EmailText>If you made this change, there&apos;s nothing to do.</EmailText>

      <EmailHr />

      <EmailFooter>
        You received this because the email on your{" "}
        <EmailLink href={baseUrl}>Domainstack</EmailLink> account changed.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
EmailChangedNoticeEmail.PreviewProps = {
  userName: "Jake",
  baseUrl: "https://domainstack.io",
};

export default EmailChangedNoticeEmail;
