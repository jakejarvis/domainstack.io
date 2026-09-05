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

type RegistrationChanges = RegistrationChangeEmailProps["changes"];

function formatTransferLock(value: boolean | null | undefined): string {
  if (value === null) return "Unknown";
  return value ? "Enabled" : "Disabled";
}

function NameserverList({
  label,
  nameservers,
  keyPrefix,
}: {
  label: string;
  nameservers?: Array<{ host: string }>;
  keyPrefix: string;
}) {
  if (!nameservers || nameservers.length === 0) return null;

  return (
    <>
      <strong>{label}:</strong>
      <br />
      {nameservers.map((ns) => (
        <span key={`${keyPrefix}-${ns.host}`}>
          • {ns.host}
          <br />
        </span>
      ))}
      <br />
    </>
  );
}

function RegistrarChangeBlock({ changes }: { changes: RegistrationChanges }) {
  return (
    <>
      <EmailSubheading>Registrar Changed</EmailSubheading>
      <EmailBox variant="warning">
        <EmailBoxText variant="warning">
          <strong>Previous:</strong> {changes.previousRegistrar || "Unknown"}
          <br />
          <strong>New:</strong> {changes.newRegistrar || "Unknown"}
        </EmailBoxText>
      </EmailBox>
    </>
  );
}

function NameserverChangeBlock({ changes }: { changes: RegistrationChanges }) {
  return (
    <>
      <EmailSubheading>Nameservers Changed</EmailSubheading>
      <EmailBox variant="warning">
        <EmailBoxText variant="warning">
          <NameserverList
            label="Previous"
            nameservers={changes.previousNameservers}
            keyPrefix="prev"
          />
          <NameserverList label="New" nameservers={changes.newNameservers} keyPrefix="new" />
        </EmailBoxText>
      </EmailBox>
    </>
  );
}

function TransferLockChangeBlock({ changes }: { changes: RegistrationChanges }) {
  return (
    <>
      <EmailSubheading>Transfer Lock Changed</EmailSubheading>
      <EmailBox variant="warning">
        <EmailBoxText variant="warning">
          <strong>Previous:</strong> {formatTransferLock(changes.previousTransferLock)}
          <br />
          <strong>New:</strong> {formatTransferLock(changes.newTransferLock)}
        </EmailBoxText>
      </EmailBox>
    </>
  );
}

function StatusesChangeBlock({ changes }: { changes: RegistrationChanges }) {
  if (!changes.previousStatuses || !changes.newStatuses) return null;

  return (
    <>
      <EmailSubheading>Domain Statuses Changed</EmailSubheading>
      <EmailBox variant="warning">
        <EmailBoxText variant="warning">
          <strong>Previous:</strong> {changes.previousStatuses.join(", ") || "None"}
          <br />
          <strong>New:</strong> {changes.newStatuses.join(", ") || "None"}
        </EmailBoxText>
      </EmailBox>
    </>
  );
}

function RegistrationChangeRiskBanner({ changes }: { changes: RegistrationChanges }) {
  if (changes.registrarChanged || changes.transferLockChanged) {
    return (
      <EmailBox variant="danger">
        <EmailBoxText variant="danger">
          <strong>Action Required:</strong> If you didn&apos;t make these changes, your domain may
          have been compromised. Contact your registrar immediately.
        </EmailBoxText>
      </EmailBox>
    );
  }

  if (changes.nameserversChanged || changes.statusesChanged) {
    return (
      <EmailBox variant="info">
        <EmailBoxText variant="info">
          <strong>Note:</strong> If you didn&apos;t authorize these changes, contact your registrar
          to investigate.
        </EmailBoxText>
      </EmailBox>
    );
  }

  return null;
}

function RegistrationChangeEmail({
  userName,
  domainName,
  changes,
  baseUrl,
}: RegistrationChangeEmailProps) {
  const previewText = `Registration changes detected for ${domainName}`;
  const changeCount =
    Number(changes.registrarChanged) +
    Number(changes.nameserversChanged) +
    Number(changes.transferLockChanged) +
    Number(changes.statusesChanged);

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>⚠️ Registration Change Detected</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        We detected {changeCount === 1 ? "a change" : `${changeCount} changes`} to the registration
        details for <strong>{domainName}</strong>.
      </EmailText>

      {changes.registrarChanged ? <RegistrarChangeBlock changes={changes} /> : null}
      {changes.nameserversChanged ? <NameserverChangeBlock changes={changes} /> : null}
      {changes.transferLockChanged ? <TransferLockChangeBlock changes={changes} /> : null}
      {changes.statusesChanged ? <StatusesChangeBlock changes={changes} /> : null}

      <RegistrationChangeRiskBanner changes={changes} />

      <EmailButton href={`${baseUrl}/${domainName}`}>View Domain Details</EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you&apos;re tracking {domainName} on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. You can manage your
        notification settings in your <EmailLink href={`${baseUrl}/settings`}>dashboard</EmailLink>.
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
    previousNameservers: [{ host: "ns1.godaddy.com" }, { host: "ns2.godaddy.com" }],
    newNameservers: [{ host: "ns1.cloudflare.com" }, { host: "ns2.cloudflare.com" }],
  },
  baseUrl: "https://domainstack.io",
} as RegistrationChangeEmailProps;

export default RegistrationChangeEmail;
