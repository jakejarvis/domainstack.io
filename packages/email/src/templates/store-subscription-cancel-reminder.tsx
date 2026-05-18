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

export type StoreSubscriptionCancelReminderEmailProps = {
  userName: string;
  baseUrl: string;
};

const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
const GOOGLE_SUBSCRIPTIONS_URL = "https://play.google.com/store/account/subscriptions";

function StoreSubscriptionCancelReminderEmail({
  userName,
}: StoreSubscriptionCancelReminderEmailProps) {
  const previewText = "Cancel your App Store or Google Play subscription";

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>One Last Step: Cancel Your Subscription</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        Your <strong>Domainstack</strong> account has been deleted. There&apos;s one thing we
        can&apos;t do for you: your Pro subscription was purchased through the Apple App Store or
        Google Play, and only you can cancel it from your store account.
      </EmailText>

      <EmailBox variant="warning">
        <EmailBoxText variant="warning" strong>
          You may keep being charged until you cancel it yourself.
        </EmailBoxText>
        <EmailBoxText variant="warning">
          Deleting your Domainstack account does not cancel an App Store or Google Play subscription
          — Apple and Google manage that billing, not Domainstack.
        </EmailBoxText>
      </EmailBox>

      <EmailText>
        <strong>iPhone or iPad:</strong> open <strong>Settings</strong> → tap your name →{" "}
        <strong>Subscriptions</strong> → <strong>Domainstack</strong> →{" "}
        <strong>Cancel Subscription</strong>.
      </EmailText>

      <EmailButton href={APPLE_SUBSCRIPTIONS_URL}>Manage App Store Subscriptions</EmailButton>

      <EmailText>
        <strong>Android:</strong> open the <strong>Google Play Store</strong> → tap your profile →{" "}
        <strong>Payments &amp; subscriptions</strong> → <strong>Subscriptions</strong> →{" "}
        <strong>Domainstack</strong> → <strong>Cancel subscription</strong>.
      </EmailText>

      <EmailSection variant="secondaryButton">
        <EmailButton variant="secondary" href={GOOGLE_SUBSCRIPTIONS_URL}>
          Manage Google Play Subscriptions
        </EmailButton>
      </EmailSection>

      <EmailHr />

      <EmailFooter>
        You received this email because your{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink> account was deleted while a
        store subscription was still active. If you have any questions, just reply to this email.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
StoreSubscriptionCancelReminderEmail.PreviewProps = {
  userName: "Jake",
  baseUrl: "https://domainstack.io",
} as StoreSubscriptionCancelReminderEmailProps;

export default StoreSubscriptionCancelReminderEmail;
