import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import {
  createColumns,
  createUnverifiedLastSorter,
} from "@/components/dashboard/dashboard-table-columns";
import { DASHBOARD_TEST_NOW, makeTrackedDomain } from "@/components/dashboard/test-fixtures";
import { render } from "@/mocks/react";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { TooltipProvider } from "@domainstack/ui/tooltip";

function expirationCell(date: Date | null) {
  const columns = createColumns({
    onVerify: vi.fn<(id: string, method: string | null) => void>(),
    onRemove: vi.fn<(id: string) => void>(),
    onArchive: vi.fn<(id: string) => void>(),
    onMute: vi.fn<(id: string, muted: boolean) => void>(),
    withUnverifiedLast: createUnverifiedLastSorter(() => false),
  });
  const column = columns.find((c) => "accessorKey" in c && c.accessorKey === "expirationDate");
  expect(column?.cell).toBeTypeOf("function");

  const domain = makeTrackedDomain({ expirationDate: date });
  const renderCell = column?.cell as (ctx: {
    row: { original: TrackedDomainWithDetails };
  }) => React.ReactNode;

  return renderCell({ row: { original: domain } });
}

describe("DateCell", () => {
  it("renders a time element for a valid date", async () => {
    await render(<TooltipProvider>{expirationCell(DASHBOARD_TEST_NOW)}</TooltipProvider>);

    const time = document.querySelector("time");
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute("datetime", DASHBOARD_TEST_NOW.toISOString());
  });

  it("does not render a time element when the date is invalid", async () => {
    await render(<TooltipProvider>{expirationCell(new Date(Number.NaN))}</TooltipProvider>);

    expect(document.querySelector("time")).toBeNull();
    await expect.element(page.getByText("-", { exact: true })).toBeInTheDocument();
  });
});
