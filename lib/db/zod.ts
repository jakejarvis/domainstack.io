import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";
import {
  certificates,
  dnsRecords,
  dnsRecordType,
  domains,
  hosting,
  httpHeaders,
  providers,
  registrationNameservers,
  registrations,
  seo,
} from "@/lib/db/schema";

// Factories: strict for reads; coerce dates for writes
const zRead = createSchemaFactory({ zodInstance: z });
const zWrite = createSchemaFactory({ zodInstance: z, coerce: { date: true } });

// Enums
export const DnsRecordTypeDbSchema = zRead.createSelectSchema(dnsRecordType);

// Providers
export const ProviderSelect = zRead.createSelectSchema(providers);
export const ProviderInsert = zWrite.createInsertSchema(providers);
export const ProviderUpdate = zWrite.createUpdateSchema(providers);

// Domains
export const DomainSelect = zRead.createSelectSchema(domains);
export const DomainInsert = zWrite.createInsertSchema(domains);
export const DomainUpdate = zWrite.createUpdateSchema(domains);

// Registrations
export const RegistrationSelect = zRead.createSelectSchema(registrations);
export const RegistrationInsert = zWrite.createInsertSchema(registrations);
export const RegistrationUpdate = zWrite.createUpdateSchema(registrations);

// Registration nameservers
export const RegistrationNameserverSelect = zRead.createSelectSchema(
  registrationNameservers,
);
export const RegistrationNameserverInsert = zWrite.createInsertSchema(
  registrationNameservers,
);
export const RegistrationNameserverUpdate = zWrite.createUpdateSchema(
  registrationNameservers,
);

// DNS records
export const DnsRecordSelect = zRead.createSelectSchema(dnsRecords);
export const DnsRecordInsert = zWrite.createInsertSchema(dnsRecords);
export const DnsRecordUpdate = zWrite.createUpdateSchema(dnsRecords);

// Certificates
export const CertificateSelect = zRead.createSelectSchema(certificates);
export const CertificateInsert = zWrite.createInsertSchema(certificates);
export const CertificateUpdate = zWrite.createUpdateSchema(certificates);

// HTTP headers
export const HttpHeaderRowSelect = zRead.createSelectSchema(httpHeaders);
export const HttpHeaderRowInsert = zWrite.createInsertSchema(httpHeaders);
export const HttpHeaderRowUpdate = zWrite.createUpdateSchema(httpHeaders);

// Hosting
export const HostingRowSelect = zRead.createSelectSchema(hosting);
export const HostingRowInsert = zWrite.createInsertSchema(hosting);
export const HostingRowUpdate = zWrite.createUpdateSchema(hosting);

// SEO
export const SeoRowSelect = zRead.createSelectSchema(seo);
export const SeoRowInsert = zWrite.createInsertSchema(seo);
export const SeoRowUpdate = zWrite.createUpdateSchema(seo);
