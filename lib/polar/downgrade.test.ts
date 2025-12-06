import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the dependencies
vi.mock("@/lib/db/repos/tracked-domains", () => ({
  archiveOldestActiveDomains: vi.fn(),
  countActiveTrackedDomainsForUser: vi.fn(),
}));

vi.mock("@/lib/db/repos/user-subscription", () => ({
  updateUserTier: vi.fn(),
}));

vi.mock("@/lib/edge-config", () => ({
  getMaxDomainsForTier: vi.fn(),
}));

import {
  archiveOldestActiveDomains,
  countActiveTrackedDomainsForUser,
} from "@/lib/db/repos/tracked-domains";
import { updateUserTier } from "@/lib/db/repos/user-subscription";
import { getMaxDomainsForTier } from "@/lib/edge-config";
import { handleDowngrade } from "./downgrade";

describe("handleDowngrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates user tier to free", async () => {
    vi.mocked(getMaxDomainsForTier).mockResolvedValue(5);
    vi.mocked(countActiveTrackedDomainsForUser).mockResolvedValue(3);

    await handleDowngrade("user-123");

    expect(updateUserTier).toHaveBeenCalledWith("user-123", "free");
  });

  it("does not archive domains when under limit", async () => {
    vi.mocked(getMaxDomainsForTier).mockResolvedValue(5);
    vi.mocked(countActiveTrackedDomainsForUser).mockResolvedValue(3);

    await handleDowngrade("user-123");

    expect(archiveOldestActiveDomains).not.toHaveBeenCalled();
  });

  it("does not archive domains when at limit", async () => {
    vi.mocked(getMaxDomainsForTier).mockResolvedValue(5);
    vi.mocked(countActiveTrackedDomainsForUser).mockResolvedValue(5);

    await handleDowngrade("user-123");

    expect(archiveOldestActiveDomains).not.toHaveBeenCalled();
  });

  it("archives excess domains when over limit", async () => {
    vi.mocked(getMaxDomainsForTier).mockResolvedValue(5);
    vi.mocked(countActiveTrackedDomainsForUser).mockResolvedValue(8);
    vi.mocked(archiveOldestActiveDomains).mockResolvedValue(3);

    await handleDowngrade("user-123");

    expect(archiveOldestActiveDomains).toHaveBeenCalledWith("user-123", 3);
  });

  it("archives correct number of domains (activeCount - freeLimit)", async () => {
    vi.mocked(getMaxDomainsForTier).mockResolvedValue(5);
    vi.mocked(countActiveTrackedDomainsForUser).mockResolvedValue(50);
    vi.mocked(archiveOldestActiveDomains).mockResolvedValue(45);

    await handleDowngrade("user-456");

    // 50 active domains - 5 free limit = 45 to archive
    expect(archiveOldestActiveDomains).toHaveBeenCalledWith("user-456", 45);
  });

  it("handles edge case of exactly one domain over limit", async () => {
    vi.mocked(getMaxDomainsForTier).mockResolvedValue(5);
    vi.mocked(countActiveTrackedDomainsForUser).mockResolvedValue(6);
    vi.mocked(archiveOldestActiveDomains).mockResolvedValue(1);

    await handleDowngrade("user-789");

    expect(archiveOldestActiveDomains).toHaveBeenCalledWith("user-789", 1);
  });
});
