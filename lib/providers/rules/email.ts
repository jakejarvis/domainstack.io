import type { Provider } from "@/lib/schemas";

/**
 * A registry of known email providers. The detection algorithm will iterate
 * through this list to identify the email provider from MX records.
 */
export const EMAIL_PROVIDERS: Array<
  Omit<Provider, "category"> & { category: "email" }
> = [
  {
    name: "Google Workspace",
    domain: "google.com",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "smtp.google.com" },
        { kind: "mxSuffix", suffix: "aspmx.l.google.com" },
        { kind: "mxSuffix", suffix: "googlemail.com" },
      ],
    },
  },
  {
    name: "Microsoft 365",
    domain: "office.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "protection.outlook.com" },
  },
  {
    name: "Zoho",
    domain: "zoho.com",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "mx.zoho.com" },
        { kind: "mxSuffix", suffix: "mx.zoho.eu" },
      ],
    },
  },
  {
    name: "Proton Mail",
    domain: "proton.me",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "mail.protonmail.ch" },
        { kind: "mxSuffix", suffix: "mailsec.protonmail.ch" },
        { kind: "mxSuffix", suffix: "alias.proton.me" },
        { kind: "mxSuffix", suffix: "simplelogin.co" },
      ],
    },
  },
  {
    name: "Fastmail",
    domain: "fastmail.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "messagingengine.com" },
  },
  {
    name: "Cloudflare Email Routing",
    domain: "cloudflare.com",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "mx.cloudflare.net" },
        { kind: "mxSuffix", suffix: "inbound.cf-emailsecurity.net" },
      ],
    },
  },
  {
    name: "Yahoo Mail",
    domain: "yahoo.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "yahoodns.net" },
  },
  {
    name: "Yandex 360",
    domain: "yandex.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "mx.yandex.net" },
  },
  {
    name: "ImprovMX",
    domain: "improvmx.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "improvmx.com" },
  },
  {
    name: "Forward Email",
    domain: "forwardemail.net",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "forwardemail.net" },
  },
  {
    name: "Migadu",
    domain: "migadu.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "migadu.com" },
  },
  {
    name: "iCloud Mail",
    domain: "icloud.com",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "mail.icloud.com" },
        { kind: "mxSuffix", suffix: "apple.com" },
      ],
    },
  },
  {
    name: "Mailgun",
    domain: "mailgun.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "mailgun.org" },
  },
  {
    name: "SendGrid",
    domain: "sendgrid.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "sendgrid.net" },
  },
  {
    name: "Mailjet",
    domain: "mailjet.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "mailjet.com" },
  },
  {
    name: "Postmark",
    domain: "postmarkapp.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "postmarkapp.com" },
  },
  {
    name: "Rackspace Email",
    domain: "rackspace.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "emailsrvr.com" },
  },
  {
    name: "Proofpoint",
    domain: "proofpoint.com",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "pphosted.com" },
        { kind: "mxSuffix", suffix: "ppe-hosted.com" },
      ],
    },
  },
  {
    name: "Barracuda Email Essentials",
    domain: "barracuda.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "ess.barracudanetworks.com" },
  },
  {
    name: "Panda Security",
    domain: "pandasecurity.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "mep.pandasecurity.com" },
  },
  {
    name: "Hornetsecurity",
    domain: "hornetsecurity.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "hornetsecurity.com" },
  },
  {
    name: "Trend Micro Email Security",
    domain: "trendmicro.com",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "tmes.trendmicro.com" },
        { kind: "mxSuffix", suffix: "tmes.trendmicro.eu" },
        { kind: "mxSuffix", suffix: "tmes-anz.trendmicro.com" },
        { kind: "mxSuffix", suffix: "tmems-jp.trendmicro.com" },
        { kind: "mxSuffix", suffix: "tmes-sg.trendmicro.com" },
        { kind: "mxSuffix", suffix: "tmes-in.trendmicro.com" },
        { kind: "mxSuffix", suffix: "tmes-uae.trendmicro.com" },
      ],
    },
  },
  {
    name: "Amazon WorkMail",
    domain: "aws.amazon.com",
    category: "email",
    rule: {
      kind: "mxRegex",
      pattern: "^inbound-smtp\\.[a-z]{2}-[a-z0-9-]+-\\d\\.amazonaws\\.com$",
      flags: "i",
    },
  },
  {
    name: "Titan Email",
    domain: "titan.email",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "titan.email" },
  },
  {
    name: "IONOS Mail",
    domain: "ionos.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "ionos.com" },
  },
  {
    name: "Mimecast",
    domain: "mimecast.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "mimecast.com" },
  },
  {
    name: "GoDaddy",
    domain: "godaddy.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "secureserver.net" },
  },
  {
    name: "Namecheap",
    domain: "namecheap.com",
    category: "email",
    rule: {
      any: [
        { kind: "mxSuffix", suffix: "registrar-servers.com" },
        { kind: "mxSuffix", suffix: "privateemail.com" },
        { kind: "mxSuffix", suffix: "jellyfish.systems" },
      ],
    },
  },
  {
    name: "Spacemail",
    domain: "spacemail.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "spacemail.com" },
  },
  {
    name: "WordPress.com",
    domain: "wordpress.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "wordpress.com" },
  },
  {
    name: "Cisco Secure Email",
    domain: "cisco.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "iphmx.com" },
  },
  {
    name: "MailRoute",
    domain: "mailroute.net",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "mailroute.net" },
  },
  {
    name: "easyDNS easyMAIL",
    domain: "easydns.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "easymail.ca" },
  },
  {
    name: "HEY.com",
    domain: "hey.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "hey.com" },
  },
  {
    name: "Symantec Email Security",
    domain: "broadcom.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "messagelabs.com" },
  },
  {
    name: "Tuta",
    domain: "tuta.com",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "tutanota.de" },
  },
  {
    name: "Mailbox.org",
    domain: "mailbox.org",
    category: "email",
    rule: { kind: "mxSuffix", suffix: "mailbox.org" },
  },
];
