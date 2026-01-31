import {
  EmailBox,
  EmailBoxText,
  EmailButton,
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLayout,
  EmailLink,
  EmailSubheading,
  EmailText,
} from "../components";

export type RegistrationChangeEmailProps = {
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
  baseUrl: string;
};

function RegistrationChangeEmail({
  userName,
  domainName,
  changes,
  baseUrl,
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

      {/* Show danger warning for high-risk changes (registrar or transfer lock) */}
      {(changes.registrarChanged || changes.transferLockChanged) && (
        <EmailBox variant="danger">
          <EmailBoxText variant="danger">
            <strong>Action Required:</strong> If you didn&apos;t make these
            changes, your domain may have been compromised. Contact your
            registrar immediately.
          </EmailBoxText>
        </EmailBox>
      )}

      {/* Show info notice for lower-risk changes (nameservers or statuses only) */}
      {!changes.registrarChanged &&
        !changes.transferLockChanged &&
        (changes.nameserversChanged || changes.statusesChanged) && (
          <EmailBox variant="info">
            <EmailBoxText variant="info">
              <strong>Note:</strong> If you didn&apos;t authorize these changes,
              contact your registrar to investigate.
            </EmailBoxText>
          </EmailBox>
        )}

      <EmailButton href={`${baseUrl}/${domainName}`}>
        View Domain Details
      </EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you&apos;re tracking {domainName} on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. You
        can manage your notification settings in your{" "}
        <EmailLink href={`${baseUrl}/settings`}>dashboard</EmailLink>.
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
  baseUrl: "https://domainstack.io",
} as RegistrationChangeEmailProps;

export default RegistrationChangeEmail;
