import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import type { ContactDetails, RegistrantView } from "@domainstack/utils/registrant";

const KIND_LABELS: Partial<Record<NonNullable<ContactDetails["kind"]>, string>> = {
  individual: "Individual",
  org: "Organization",
  group: "Group",
  location: "Location",
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

// Registries often repeat values; dedupe so they can serve as React keys.
const unique = <T,>(values: T[]): T[] => [...new Set(values)];

/** Dial string for a `tel:` link: drops formatting and any trailing extension. */
function toTelHref(phone: string): string {
  return phone.split(/\s*(?:ext\.?|x)\s*\d+$/i)[0].replace(/[^\d+]/g, "");
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-background/90">{children}</dd>
    </div>
  );
}

function ContactFields({ contact }: { contact: ContactDetails }) {
  const person = [contact.name, contact.organization, ...contact.organizationUnits].filter(Boolean);
  const kind = contact.kind ? KIND_LABELS[contact.kind] : undefined;
  const roles = [contact.title, contact.role].filter(Boolean);

  return (
    <dl className="space-y-1">
      {person.length > 0 && (
        <ContactRow label="Identity">
          {unique(person).map((p) => (
            <span key={p} className="block font-medium break-words">
              {p}
            </span>
          ))}
        </ContactRow>
      )}
      {kind && <ContactRow label="Type">{kind}</ContactRow>}
      {roles.length > 0 && (
        <ContactRow label="Role">
          {unique(roles).map((role) => (
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
          {unique(contact.email).map((email) => (
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
          {unique(contact.phone).map((phone) => (
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
          {unique(contact.fax).map((fax) => (
            <span key={fax} className="block break-all">
              {fax}
            </span>
          ))}
        </ContactRow>
      )}
    </dl>
  );
}

function ContactSection({ contact, showLabel }: { contact: ContactDetails; showLabel: boolean }) {
  return (
    <section className="space-y-1" aria-label={`${CONTACT_LABELS[contact.type]} contact`}>
      {showLabel && (
        <h3 className="text-[11px] font-medium tracking-wide text-muted uppercase">
          {CONTACT_LABELS[contact.type]}
        </h3>
      )}
      <ContactFields contact={contact} />
    </section>
  );
}

/**
 * Wraps the registrant summary in a tooltip (popover on touch) with the full
 * contact details. Renders children unwrapped when there is nothing more to show.
 */
export function RegistrantTooltip({
  view,
  children,
}: {
  view: RegistrantView;
  children: React.ReactNode;
}) {
  if (!view.hasDetails) return <>{children}</>;

  return (
    <ResponsiveTooltip>
      <ResponsiveTooltipTrigger className="inline-flex max-w-full min-w-0 cursor-pointer [touch-action:manipulation] rounded-sm text-left underline decoration-muted-foreground/60 decoration-dotted underline-offset-4 transition-colors outline-none hover:decoration-foreground/60 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
        <span className="truncate">{children}</span>
        <span className="sr-only">, show registrant details</span>
      </ResponsiveTooltipTrigger>
      <ResponsiveTooltipContent
        align="start"
        className="max-h-[min(70vh,32rem)] w-64 overflow-y-auto overscroll-contain"
      >
        <div className="space-y-2 py-1">
          <h2 className="border-b border-muted/30 pb-2 font-medium">Registrant details</h2>
          <div className="space-y-2.5">
            {view.registrant && (
              <ContactSection contact={view.registrant} showLabel={view.others.length > 0} />
            )}
            {view.others.map((contact, index) => (
              <ContactSection
                // oxlint-disable-next-line react/no-array-index-key -- static, order-stable list
                key={`${contact.type}-${index}`}
                contact={contact}
                showLabel
              />
            ))}
          </div>
        </div>
      </ResponsiveTooltipContent>
    </ResponsiveTooltip>
  );
}
