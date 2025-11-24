/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSectionWithData } from "@/components/domain/create-section-with-data";

// Mock the error boundary to avoid class component complexity in tests
vi.mock("@/components/domain/section-error-boundary", () => ({
  SectionErrorBoundary: ({
    children,
  }: {
    children: React.ReactNode;
    sectionName: string;
  }) => <div>{children}</div>,
}));

describe("createSectionWithData", () => {
  it("should create a component that queries and renders section", () => {
    const testData = { message: "test data" };
    const mockUseQuery = vi.fn(() => ({
      data: testData,
    }));

    const MockSection = vi.fn(({ data }: { data: { message: string } }) => (
      <div data-testid="section">{data.message}</div>
    ));

    const MockSkeleton = vi.fn(() => (
      <div data-testid="skeleton">Loading...</div>
    ));

    const SectionWithData = createSectionWithData(
      mockUseQuery,
      MockSection,
      MockSkeleton,
      "Test Section",
    );

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SectionWithData domain="example.com" />
      </QueryClientProvider>,
    );

    // Verify the section renders with the correct data
    expect(screen.getByTestId("section")).toBeInTheDocument();
    expect(screen.getByText("test data")).toBeInTheDocument();

    // Verify useQuery was called with the domain
    expect(mockUseQuery).toHaveBeenCalledWith("example.com");
  });

  it("should map data correctly to section props", () => {
    const testData = { records: ["A", "AAAA", "MX"] };

    const mockUseQuery = vi.fn(() => ({
      data: testData,
    }));

    const MockSection = vi.fn(
      ({ domain, data }: { domain: string; data: { records: string[] } }) => (
        <div data-testid="section">
          {domain}: {data.records.join(", ")}
        </div>
      ),
    );

    const MockSkeleton = () => <div data-testid="skeleton">Loading...</div>;

    const SectionWithData = createSectionWithData(
      mockUseQuery,
      MockSection,
      MockSkeleton,
      "Test Section",
    );

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SectionWithData domain="example.com" />
      </QueryClientProvider>,
    );

    // Verify the section renders with correctly mapped props
    expect(screen.getByTestId("section")).toBeInTheDocument();
    expect(screen.getByText("example.com: A, AAAA, MX")).toBeInTheDocument();

    // Verify MockSection was called with the correct props
    expect(MockSection).toHaveBeenCalled();
    const callArgs = MockSection.mock.calls[0][0];
    expect(callArgs.domain).toBe("example.com");
    expect(callArgs.data).toEqual(testData);
  });

  it("should pass domain to useQuery hook", () => {
    const mockUseQuery = vi.fn(() => ({
      data: { test: "value" },
    }));

    const MockSection = () => <div>Section</div>;
    const MockSkeleton = () => <div>Loading</div>;

    const SectionWithData = createSectionWithData(
      mockUseQuery,
      MockSection,
      MockSkeleton,
      "Test Section",
    );

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SectionWithData domain="test.com" />
      </QueryClientProvider>,
    );

    // Verify useQuery was called with the correct domain
    expect(mockUseQuery).toHaveBeenCalledWith("test.com");
  });

  it("should support passing both domain and data to section", () => {
    const mockUseQuery = vi.fn(() => ({
      data: { seoData: "meta" },
    }));

    const MockSection = vi.fn(
      ({ domain, data }: { domain: string; data: { seoData: string } }) => (
        <div>
          {domain}: {data.seoData}
        </div>
      ),
    );

    const MockSkeleton = () => <div>Loading</div>;

    const SectionWithData = createSectionWithData(
      mockUseQuery,
      MockSection,
      MockSkeleton,
      "Test Section",
    );

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SectionWithData domain="example.com" />
      </QueryClientProvider>,
    );

    // Verify both domain and data are passed to section
    expect(mockUseQuery).toHaveBeenCalledWith("example.com");
    expect(MockSection).toHaveBeenCalled();
    const callArgs = MockSection.mock.calls[0][0];
    expect(callArgs.domain).toBe("example.com");
    expect(callArgs.data).toEqual({ seoData: "meta" });
  });
});
