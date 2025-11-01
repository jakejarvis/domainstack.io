/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainReportView } from "./domain-report-view";

// Mock all required modules
vi.mock("@/lib/analytics/client", () => ({
  captureClient: vi.fn(),
}));

vi.mock("@/lib/json-export", () => ({
  exportDomainData: vi.fn(),
}));

vi.mock("@/lib/trpc/client", () => ({
  useTRPC: () => ({
    domain: {
      registration: {
        queryOptions: (input: { domain: string }) => ({
          queryKey: ["registration", input],
        }),
      },
      dns: {
        queryOptions: (input: { domain: string }) => ({
          queryKey: ["dns", input],
        }),
      },
      hosting: {
        queryOptions: (input: { domain: string }) => ({
          queryKey: ["hosting", input],
        }),
      },
      certificates: {
        queryOptions: (input: { domain: string }) => ({
          queryKey: ["certificates", input],
        }),
      },
      headers: {
        queryOptions: (input: { domain: string }) => ({
          queryKey: ["headers", input],
        }),
      },
      seo: {
        queryOptions: (input: { domain: string }) => ({
          queryKey: ["seo", input],
        }),
      },
    },
  }),
}));

// Mock implementation for useRegistrationQuery
const mockUseRegistrationQuery = vi.fn((domain: string) => ({
  data: {
    isRegistered: true,
    domain,
    source: "rdap" as "rdap" | "whois" | null,
  },
}));

vi.mock("@/hooks/use-domain-queries", () => ({
  useRegistrationQuery: (domain: string) => mockUseRegistrationQuery(domain),
  useDnsQuery: vi.fn(() => ({ data: { records: [] } })),
  useHostingQuery: vi.fn(() => ({ data: null })),
  useCertificatesQuery: vi.fn(() => ({ data: [] })),
  useHeadersQuery: vi.fn(() => ({ data: [] })),
  useSeoQuery: vi.fn(() => ({ data: null })),
}));

vi.mock("@/hooks/use-domain-history", () => ({
  useDomainHistory: vi.fn(),
}));

vi.mock("@/components/domain/domain-unregistered-state", () => ({
  DomainUnregisteredState: () => <div>Unregistered</div>,
}));

vi.mock("@/components/domain/export-button", () => ({
  ExportButton: ({
    onExportAction,
    disabled,
  }: {
    onExportAction: () => void;
    disabled: boolean;
  }) => (
    <button type="button" onClick={onExportAction} disabled={disabled}>
      Export
    </button>
  ),
}));

vi.mock("@/components/favicon", () => ({
  Favicon: () => <div>Favicon</div>,
}));

vi.mock("@/components/domain/screenshot-tooltip", () => ({
  ScreenshotTooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/domain/tools-dropdown", () => ({
  ToolsDropdown: () => <div>Tools</div>,
}));

vi.mock(
  "@/components/domain/registration/registration-section-with-data",
  () => ({
    RegistrationSectionWithData: () => <div>Registration</div>,
  }),
);

vi.mock("@/components/domain/hosting/hosting-section-with-data", () => ({
  HostingSectionWithData: () => <div>Hosting</div>,
}));

vi.mock("@/components/domain/dns/dns-section-with-data", () => ({
  DnsSectionWithData: () => <div>DNS</div>,
}));

vi.mock(
  "@/components/domain/certificates/certificates-section-with-data",
  () => ({
    CertificatesSectionWithData: () => <div>Certificates</div>,
  }),
);

vi.mock("@/components/domain/headers/headers-section-with-data", () => ({
  HeadersSectionWithData: () => <div>Headers</div>,
}));

vi.mock("@/components/domain/seo/seo-section-with-data", () => ({
  SeoSectionWithData: () => <div>SEO</div>,
}));

describe("DomainReportView Export", () => {
  beforeEach(() => {
    // Reset to default mock implementation
    mockUseRegistrationQuery.mockImplementation((domain: string) => ({
      data: {
        isRegistered: true,
        domain,
        source: "rdap",
      },
    }));
  });
  it("calls exportDomainData with cached query data when Export button is clicked", async () => {
    const { exportDomainData } = await import("@/lib/json-export");
    const { captureClient } = await import("@/lib/analytics/client");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    // Pre-populate cache with test data
    const domain = "example.com";
    queryClient.setQueryData(["registration", { domain }], {
      isRegistered: true,
      domain: "example.com",
    });
    queryClient.setQueryData(["dns", { domain }], { records: [] });
    queryClient.setQueryData(["hosting", { domain }], { provider: "test" });
    queryClient.setQueryData(["certificates", { domain }], []);
    queryClient.setQueryData(["headers", { domain }], []);
    queryClient.setQueryData(["seo", { domain }], { title: "Test" });

    render(
      <QueryClientProvider client={queryClient}>
        <DomainReportView domain={domain} />
      </QueryClientProvider>,
    );

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText("example.com")).toBeInTheDocument();
    });

    // Wait for export button to be enabled (all data loaded)
    const exportButton = screen.getByText("Export");
    await waitFor(() => {
      expect(exportButton).not.toBeDisabled();
    });

    // Click export button
    await userEvent.click(exportButton);

    // Verify analytics was captured
    expect(captureClient).toHaveBeenCalledWith("export_json_clicked", {
      domain,
    });

    // Verify exportDomainData was called with aggregated data
    expect(exportDomainData).toHaveBeenCalledWith(domain, {
      registration: { isRegistered: true, domain: "example.com" },
      dns: { records: [] },
      hosting: { provider: "test" },
      certificates: [],
      headers: [],
      seo: { title: "Test" },
    });
  });

  it("disables export button until all data is loaded", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const domain = "example.com";

    // Only set registration data initially
    queryClient.setQueryData(["registration", { domain }], {
      isRegistered: true,
      domain: "example.com",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DomainReportView domain={domain} />
      </QueryClientProvider>,
    );

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText("example.com")).toBeInTheDocument();
    });

    // Export button should be disabled when not all data is loaded
    const exportButton = screen.getByText("Export");
    expect(exportButton).toBeDisabled();
  });

  it("supports testing different domains via domain-aware mock", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const domain = "test-domain.org";

    // Pre-populate cache with test data for different domain
    queryClient.setQueryData(["registration", { domain }], {
      isRegistered: true,
      domain,
      source: "whois",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DomainReportView domain={domain} />
      </QueryClientProvider>,
    );

    // Wait for component to render with the correct domain
    await waitFor(() => {
      expect(screen.getByText("test-domain.org")).toBeInTheDocument();
    });

    // Verify mock was called with the correct domain
    expect(mockUseRegistrationQuery).toHaveBeenCalledWith(domain);
  });

  it("can test unregistered domains using mockImplementation", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Number.POSITIVE_INFINITY,
        },
      },
    });

    const domain = "unregistered-domain.test";

    // Customize mock to return unregistered state
    // Note: source must be non-null to trigger unregistered state view
    mockUseRegistrationQuery.mockImplementation((d: string) => ({
      data: {
        isRegistered: false,
        domain: d,
        source: "rdap",
      },
    }));

    // Pre-populate cache with unregistered data
    queryClient.setQueryData(["registration", { domain }], {
      isRegistered: false,
      domain,
      source: "rdap",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DomainReportView domain={domain} />
      </QueryClientProvider>,
    );

    // Wait for unregistered state to render
    await waitFor(() => {
      expect(screen.getByText("Unregistered")).toBeInTheDocument();
    });
  });
});
