import { EmailBox, EmailBoxText } from "@/components/email/email-box";
import { EmailButton } from "@/components/email/email-button";
import { EmailLayout } from "@/components/email/email-layout";
import {
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLink,
  EmailSubheading,
  EmailText,
} from "@/components/email/email-shared";
import { BASE_URL } from "@/lib/constants/app";

type RegistrationChangeEmailProps = {
  userName: string;
  domainName: string;
  changes: {
    registrarChanged: boolean;
    nameserversChanged: boolean;
    transferLockChanged: boolean;
    statusesChanged: boolean;
    previousRegistrar?: string;
    newRegistrar?: string;
    previousNameservers?: Array<{ host: string }>;
    newNameservers?: Array<{ host: string }>;
    previousTransferLock?: boolean | null;
    newTransferLock?: boolean | null;
    previousStatuses?: string[];
    newStatuses?: string[];
  };
};

export function RegistrationChangeEmail({
  userName,
  domainName,
  changes,
}: RegistrationChangeEmailProps) {
  const previewText = `Registration changes detected for ${domainName}`;

  const changeCount =
    (changes.registrarChanged ? 1 : 0) +
    (changes.nameserversChanged ? 1 : 0) +
    (changes.transferLockChanged ? 1 : 0) +
    (changes.statusesChanged ? 1 : 0);

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>⚠️ Registration Change Detected</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        We detected {changeCount === 1 ? "a change" : `${changeCount} changes`}{" "}
        to the registration details for <strong>{domainName}</strong>.
      </EmailText>

      {changes.registrarChanged && (
        <>
          <EmailSubheading>Registrar Changed</EmailSubheading>
          <EmailBox variant="warning">
            <EmailBoxText variant="warning">
              <strong>Previous:</strong>{" "}
              {changes.previousRegistrar || "Unknown"}
              <br />
              <strong>New:</strong> {changes.newRegistrar || "Unknown"}
            </EmailBoxText>
          </EmailBox>
        </>
      )}

      {changes.nameserversChanged && (
        <>
          <EmailSubheading>Nameservers Changed</EmailSubheading>
          <EmailBox variant="warning">
            <EmailBoxText variant="warning">
              {changes.previousNameservers &&
                changes.previousNameservers.length > 0 && (
                  <>
                    <strong>Previous:</strong>
                    <br />
                    {changes.previousNameservers.map((ns, idx) => (
                      <span key={`prev-${idx}-${ns.host}`}>
                        • {ns.host}
                        <br />
                      </span>
                    ))}
                    <br />
                  </>
                )}
              {changes.newNameservers && changes.newNameservers.length > 0 && (
                <>
                  <strong>New:</strong>
                  <br />
                  {changes.newNameservers.map((ns, idx) => (
                    <span key={`new-${idx}-${ns.host}`}>
                      • {ns.host}
                      <br />
                    </span>
                  ))}
                </>
              )}
            </EmailBoxText>
          </EmailBox>
        </>
      )}

      {changes.transferLockChanged && (
        <>
          <EmailSubheading>Transfer Lock Changed</EmailSubheading>
          <EmailBox variant="warning">
            <EmailBoxText variant="warning">
              <strong>Previous:</strong>{" "}
              {changes.previousTransferLock === null
                ? "Unknown"
                : changes.previousTransferLock
                  ? "Enabled"
                  : "Disabled"}
              <br />
              <strong>New:</strong>{" "}
              {changes.newTransferLock === null
                ? "Unknown"
                : changes.newTransferLock
                  ? "Enabled"
                  : "Disabled"}
            </EmailBoxText>
          </EmailBox>
        </>
      )}

      {changes.statusesChanged &&
        changes.previousStatuses &&
        changes.newStatuses && (
          <>
            <EmailSubheading>Domain Statuses Changed</EmailSubheading>
            <EmailBox variant="warning">
              <EmailBoxText variant="warning">
                <strong>Previous:</strong>{" "}
                {changes.previousStatuses.join(", ") || "None"}
                <br />
                <strong>New:</strong> {changes.newStatuses.join(", ") || "None"}
              </EmailBoxText>
            </EmailBox>
          </>
        )}

      <EmailBox variant="danger">
        <EmailBoxText variant="danger">
          <strong>Action Required:</strong> If you didn&apos;t make these
          changes, your domain may have been compromised. Contact your registrar
          immediately.
        </EmailBoxText>
      </EmailBox>

      <EmailButton href={`${BASE_URL}/${domainName}`}>
        View Domain Details
      </EmailButton>

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
RegistrationChangeEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  changes: {
    registrarChanged: true,
    nameserversChanged: true,
    transferLockChanged: false,
    statusesChanged: false,
    previousRegistrar: "GoDaddy",
    newRegistrar: "Cloudflare",
    previousNameservers: [
      { host: "ns1.godaddy.com" },
      { host: "ns2.godaddy.com" },
    ],
    newNameservers: [
      { host: "ns1.cloudflare.com" },
      { host: "ns2.cloudflare.com" },
    ],
  },
} as RegistrationChangeEmailProps;

export default RegistrationChangeEmail;
