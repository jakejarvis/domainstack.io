import type { DomainResponse } from "@domainstack/types";
import { serializeDomainExport } from "@domainstack/utils";

export function exportDomainData(domain: string, data: Partial<DomainResponse>) {
  const payload = serializeDomainExport(domain, data);

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${domain}-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
