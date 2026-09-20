import { Badge } from "@domainstack/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@domainstack/ui/popover";
import type { ContactDetails, RegistrantView } from "@domainstack/utils/registrant";

const KIND_LABELS: Partial<Record<NonNullable<ContactDetails["kind"]>, string>> = {
  individual: "Individual",
  org: "Organization",
  group: "Group",
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

function ContactFields({ contact }: { contact: ContactDetails }) {
  const person = [contact.name, contact.organization, ...contact.organizationUnits].filter(Boolean);
  const kind = contact.kind ? KIND_LABELS[contact.kind] : undefined;
  const jobTitle = [contact.title, contact.role].filter(Boolean).join(" · ");
  return (
    <dl className="space-y-1.5 text-[13px]">
      {person.length > 0 && (
        <div>
          <dt className="sr-only">Name</dt>
          {person.map((p) => (
            <dd key={p} className="font-medium break-words">
              {p}
            </dd>
          ))}
        </div>
      )}
      {(kind || jobTitle) && (
        <div>
          <dt className="sr-only">Type</dt>
          <dd className="text-muted-foreground">{[kind, jobTitle].filter(Boolean).join(" · ")}</dd>
        </div>
      )}
      {contact.address.length > 0 && (
        <div>
          <dt className="sr-only">Address</dt>
          <dd className="break-words text-muted-foreground">
            {contact.address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </dd>
        </div>
      )}
      {contact.email.map((e) => (
        <div key={e}>
          <dt className="sr-only">Email</dt>
          <dd className="break-all">
            <a href={`mailto:${e}`} className="underline underline-offset-2">
              {e}
            </a>
          </dd>
        </div>
      ))}
      {contact.phone.map((p) => (
        <div key={p}>
          <dt className="sr-only">Phone</dt>
          <dd>
            <a href={`tel:${toTelHref(p)}`} className="underline underline-offset-2">
              {p}
            </a>
          </dd>
        </div>
      ))}
      {contact.fax.map((f) => (
        <div key={f}>
          <dt className="sr-only">Fax</dt>
          <dd className="text-muted-foreground">Fax: {f}</dd>
        </div>
      ))}
      {contact.redactedFields.length > 0 && (
        <div>
          <dt className="sr-only">Withheld</dt>
          <dd className="text-[12px] text-muted-foreground">
            Withheld by registry: {contact.redactedFields.map((f) => FIELD_LABELS[f]).join(", ")}
          </dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Whether the popover has anything to show beyond the row's summary text.
 */
export function hasRegistrantDetails(view: RegistrantView): boolean {
  return Boolean(view.registrant) || view.others.length > 0;
}

/**
 * Wraps the registrant summary in a popover with the full contact details.
 * Renders children unwrapped when there is nothing more to show.
 */
export function RegistrantDetailsPopover({
  view,
  source,
  children,
}: {
  view: RegistrantView;
  source: "rdap" | "whois" | null | undefined;
  children: React.ReactNode;
}) {
  if (!hasRegistrantDetails(view)) return <>{children}</>;

  return (
    <Popover>
      <PopoverTrigger className="inline-flex max-w-full min-w-0 cursor-pointer [touch-action:manipulation] rounded-sm text-left underline decoration-muted-foreground/60 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="truncate">{children}</span>
        <span className="sr-only">, show registrant details</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-80 max-w-[90vw] gap-3 overflow-y-auto overscroll-contain"
      >
        {view.registrant && (
          <section className="space-y-2" aria-label="Registrant">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                Registrant
              </h3>
              {view.registrant.privacyService ? (
                <Badge variant="secondary">Privacy service</Badge>
              ) : (
                view.state === "redacted" && <Badge variant="secondary">Redacted</Badge>
              )}
            </div>
            <ContactFields contact={view.registrant} />
          </section>
        )}
        {view.state === "redacted" && (
          <p className="text-[12px] text-muted-foreground">
            Registrant details are redacted by the registry or registrar.
          </p>
        )}
        {view.others.map((c, i) => (
          <section
            // oxlint-disable-next-line react/no-array-index-key -- static, order-stable list
            key={`${c.type}-${i}`}
            className="space-y-2 border-t pt-3"
            aria-label={`${CONTACT_LABELS[c.type]} contact`}
          >
            <h3 className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
              {CONTACT_LABELS[c.type]}
            </h3>
            <ContactFields contact={c} />
          </section>
        ))}
        <p className="border-t pt-3 text-[11px] text-muted-foreground">
          From {source === "rdap" ? "RDAP" : "WHOIS"}. See the raw data for the full record.
        </p>
      </PopoverContent>
    </Popover>
  );
}
