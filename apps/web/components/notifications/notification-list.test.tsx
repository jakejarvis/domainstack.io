import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { NotificationList } from "@/components/notifications/notification-list";
import { makeNotification } from "@/components/notifications/test-fixtures";
import { render } from "@/mocks/react";

const items = [
  makeNotification({ id: "notif-alpha" }),
  makeNotification({ id: "notif-beta", title: "beta.com expires in 7 days" }),
];

describe("NotificationList", () => {
  it("keeps loaded items and offers an inline retry when loading more fails", async () => {
    const onRetryNextPage = vi.fn<() => void>();
    await render(
      <NotificationList
        notifications={items}
        isLoading={false}
        isError={false}
        view="inbox"
        hasNextPage
        isFetchNextPageError
        onRetryNextPage={onRetryNextPage}
      />,
    );

    await expect.element(page.getByText("alpha.com expires in 7 days")).toBeInTheDocument();
    await expect.element(page.getByText("beta.com expires in 7 days")).toBeInTheDocument();
    await expect
      .element(page.getByText("Couldn't load more notifications.", { exact: false }))
      .toBeInTheDocument();

    await page.getByRole("button", { name: "Retry" }).click();
    expect(onRetryNextPage).toHaveBeenCalledOnce();
  });

  it("hides the retry row while the next page is being fetched", async () => {
    await render(
      <NotificationList
        notifications={items}
        isLoading={false}
        isError={false}
        view="inbox"
        hasNextPage
        isFetchNextPageError
        isFetchingNextPage
      />,
    );

    await expect.element(page.getByText("alpha.com expires in 7 days")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows the full error only when there is nothing to list", async () => {
    await render(<NotificationList notifications={[]} isLoading={false} isError view="inbox" />);

    await expect.element(page.getByText("Failed to load notifications")).toBeInTheDocument();
  });
});
