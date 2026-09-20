import { Badge } from "@domainstack/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@domainstack/ui/popover";
import type { ContactDetails, RegistrantView } from "@domainstack/utils/registrant";

const KIND_LABELS: Partial<Record<NonNullable<ContactDetails["kind"]>, string>> = {
  individual: "Individual",
  org: "Organization",
  group: "Group",
  location: "Location",
};

const FIELD_LABELS: Record<NonNullable<ContactDetails["redactedFields"]>[number], string> = {
  name: "name",
  organization: "organization",
  email: "email",
  phone: "phone",
  fax: "fax",
  street: "street",
  city: "city",
  state: "state",
  postalCode: "postal code",
  poBox: "PO box",
  country: "country",
};

const CONTACT_LABELS: Record<ContactDetails["type"], string> = {
  registrant: "Registrant",
  admin: "Administrative",
  tech: "Technical",
  billing: "Billing",
  abuse: "Abuse",
  registrar: "Registrar",
  reseller: "Reseller",
  unknown: "Other",
};

/** Dial string for a `tel:` link: drops formatting and any trailing extension. */
function toTelHref(phone: string): string {
  return phone.split(/\s*(?:ext\.?|x)\s*\d+$/i)[0].replace(/[^\d+]/g, "");
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 py-1.5 first:pt-0 last:pb-0">
      <dt className="text-[11px] leading-5 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[13px] leading-5 text-foreground/95">{children}</dd>
    </div>
  );
}

function ContactFields({ contact }: { contact: ContactDetails }) {
  const person = [contact.name, contact.organization, ...contact.organizationUnits].filter(Boolean);
  const kind = contact.kind ? KIND_LABELS[contact.kind] : undefined;
  const roles = [contact.title, contact.role].filter(Boolean);

  return (
    <dl>
      {person.length > 0 && (
        <ContactRow label="Identity">
          {person.map((p) => (
            <span key={p} className="block font-medium break-words">
              {p}
            </span>
          ))}
        </ContactRow>
      )}
      {kind && <ContactRow label="Type">{kind}</ContactRow>}
      {roles.length > 0 && (
        <ContactRow label="Role">
          {roles.map((role) => (
            <span key={role} className="block break-words">
              {role}
            </span>
          ))}
        </ContactRow>
      )}
      {contact.address.length > 0 && (
        <ContactRow label="Address">
          {contact.address.map((line) => (
            <span key={line} className="block break-words">
              {line}
            </span>
          ))}
        </ContactRow>
      )}
      {contact.email.length > 0 && (
        <ContactRow label="Email">
          {contact.email.map((email) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="block break-all underline underline-offset-2"
            >
              {email}
            </a>
          ))}
        </ContactRow>
      )}
      {contact.phone.length > 0 && (
        <ContactRow label="Phone">
          {contact.phone.map((phone) => (
            <a
              key={phone}
              href={`tel:${toTelHref(phone)}`}
              className="block break-all underline underline-offset-2"
            >
              {phone}
            </a>
          ))}
        </ContactRow>
      )}
      {contact.fax.length > 0 && (
        <ContactRow label="Fax">
          {contact.fax.map((fax) => (
            <span key={fax} className="block break-all">
              {fax}
            </span>
          ))}
        </ContactRow>
      )}
      {contact.redactedFields.length > 0 && (
        <ContactRow label="Withheld">
          <span className="text-muted-foreground">
            {contact.redactedFields.map((field) => FIELD_LABELS[field]).join(", ")}
          </span>
        </ContactRow>
      )}
    </dl>
  );
}

function ContactSection({ contact }: { contact: ContactDetails }) {
  return (
    <section className="px-4 py-3" aria-label={`${CONTACT_LABELS[contact.type]} contact`}>
      <h3 className="mb-2 text-[12px] font-medium text-foreground/80">
        {CONTACT_LABELS[contact.type]}
      </h3>
      <ContactFields contact={contact} />
    </section>
  );
}

/**
 * Wraps the registrant summary in a popover with the full contact details.
 * Renders children unwrapped when there is nothing more to show.
 */
export function RegistrantDetailsPopover({
  view,
  children,
}: {
  view: RegistrantView;
  children: React.ReactNode;
}) {
  if (!view.hasDetails) return <>{children}</>;

  const status = view.registrant?.privacyService
    ? "Privacy service"
    : view.state === "redacted"
      ? "Redacted"
      : undefined;

  return (
    <Popover>
      <PopoverTrigger className="inline-flex max-w-full min-w-0 cursor-pointer [touch-action:manipulation] rounded-sm text-left underline decoration-muted-foreground/60 decoration-dotted underline-offset-4 transition-colors outline-none hover:decoration-foreground/60 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
        <span className="truncate">{children}</span>
        <span className="sr-only">, show registrant details</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="max-h-[min(70vh,32rem)] w-80 max-w-[calc(100vw-1rem)] gap-0 overflow-hidden bg-background p-0"
      >
        <PopoverHeader className="flex-row items-center justify-between border-b border-border bg-card/60 px-4 py-3">
          <PopoverTitle className="text-[13px] font-semibold">Registrant details</PopoverTitle>
          {status && <Badge variant="secondary">{status}</Badge>}
        </PopoverHeader>
        <div className="min-h-0 divide-y divide-border/70 overflow-y-auto overscroll-contain">
          {view.registrant && <ContactSection contact={view.registrant} />}
          {view.others.map((contact, index) => (
            <ContactSection
              // oxlint-disable-next-line react/no-array-index-key -- static, order-stable list
              key={`${contact.type}-${index}`}
              contact={contact}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
