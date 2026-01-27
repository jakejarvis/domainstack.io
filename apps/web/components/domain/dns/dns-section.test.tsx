import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/mocks/react";
import { DnsSection } from "./dns-section";

vi.mock("@/components/domain/dns/dns-group", () => ({
  DnsGroup: ({
    title,
    count,
    children,
  }: {
    title: string;
    count: number;
    children: React.ReactNode;
  }) => (
    <div>
      <div>{title}</div>
      <div>count:{count}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/domain/dns/dns-record-list", () => ({
  DnsRecordList: ({ type }: { type: string }) => <div>list:{type}</div>,
}));

describe("DnsSection", () => {
  it("renders groups for each type and passes counts", () => {
    const records = [
      { type: "A", name: "a", value: "1.2.3.4" },
      { type: "AAAA", name: "aaaa", value: "::1" },
      { type: "MX", name: "mx", value: "mx.test.invalid", priority: 10 },
      { type: "TXT", name: "txt", value: "v=spf1" },
      { type: "NS", name: "ns", value: "ns1.test.invalid" },
    ] as unknown as import("@domainstack/types").DnsRecord[];

    render(<DnsSection data={{ records, resolver: null }} />);

    expect(screen.getByText("A Records")).toBeInTheDocument();
    const counts = screen.getAllByText("count:1");
    expect(counts.length).toBe(5);
    expect(screen.getByText("MX Records")).toBeInTheDocument();
  });

  it("shows empty state when no records", () => {
    render(<DnsSection data={{ records: [], resolver: null }} />);
    expect(screen.getByText(/No DNS records found/i)).toBeInTheDocument();
  });
});
