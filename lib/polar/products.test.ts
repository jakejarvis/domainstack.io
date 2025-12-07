import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  getProduct,
  getProductsForCheckout,
  getProductsForTier,
  getProTierInfo,
  getTierForProductId,
  POLAR_PRODUCTS,
  PRO_TIER_INFO,
} from "./products";

// Stub required Polar product IDs before accessing them
beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID", "test-monthly-id");
  vi.stubEnv("NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID", "test-yearly-id");
});

describe("getProduct", () => {
  it("returns pro-monthly product by slug", () => {
    const product = getProduct("pro-monthly");
    expect(product.slug).toBe("pro-monthly");
    expect(product.tier).toBe("pro");
  });

  it("returns pro-yearly product by slug", () => {
    const product = getProduct("pro-yearly");
    expect(product.slug).toBe("pro-yearly");
    expect(product.tier).toBe("pro");
  });
});

describe("getProductsForCheckout", () => {
  it("returns array of products with productId and slug", () => {
    const products = getProductsForCheckout();
    expect(products).toBeInstanceOf(Array);
    expect(products.length).toBeGreaterThan(0);

    for (const product of products) {
      expect(product).toHaveProperty("productId");
      expect(product).toHaveProperty("slug");
      expect(typeof product.productId).toBe("string");
      expect(typeof product.slug).toBe("string");
    }
  });

  it("includes both pro-monthly and pro-yearly", () => {
    const products = getProductsForCheckout();
    const slugs = products.map((p) => p.slug);
    expect(slugs).toContain("pro-monthly");
    expect(slugs).toContain("pro-yearly");
  });
});

describe("getProductsForTier", () => {
  it("returns all products for pro tier", () => {
    const products = getProductsForTier("pro");
    expect(products.length).toBe(2);
    expect(products.every((p) => p.tier === "pro")).toBe(true);
  });

  it("returns empty array for free tier (no products)", () => {
    const products = getProductsForTier("free");
    expect(products).toEqual([]);
  });
});

describe("getTierForProductId", () => {
  it("returns pro tier for pro-monthly product ID", () => {
    const productId = POLAR_PRODUCTS["pro-monthly"].productId;
    const tier = getTierForProductId(productId);
    expect(tier).toBe("pro");
  });

  it("returns pro tier for pro-yearly product ID", () => {
    const productId = POLAR_PRODUCTS["pro-yearly"].productId;
    const tier = getTierForProductId(productId);
    expect(tier).toBe("pro");
  });

  it("returns null for unknown product ID", () => {
    const tier = getTierForProductId("unknown-product-id");
    expect(tier).toBeNull();
  });

  it("returns null for empty string", () => {
    const tier = getTierForProductId("");
    expect(tier).toBeNull();
  });
});

describe("PRO_TIER_INFO", () => {
  it("has correct name", () => {
    expect(PRO_TIER_INFO.name).toBe("Pro");
  });

  it("references monthly and yearly products", () => {
    expect(PRO_TIER_INFO.monthly).toBe(POLAR_PRODUCTS["pro-monthly"]);
    expect(PRO_TIER_INFO.yearly).toBe(POLAR_PRODUCTS["pro-yearly"]);
  });
});

describe("getProTierInfo", () => {
  it("returns tier info with dynamic domain limit", () => {
    const tierInfo = getProTierInfo(50);
    expect(tierInfo.name).toBe("Pro");
    expect(tierInfo.description).toContain("50");
  });

  it("has features array with domain limit", () => {
    const tierInfo = getProTierInfo(100);
    expect(tierInfo.features).toBeInstanceOf(Array);
    expect(tierInfo.features.length).toBeGreaterThan(0);
    expect(tierInfo.features[0]).toContain("100");
  });

  it("includes monthly and yearly product info", () => {
    const tierInfo = getProTierInfo(50);
    expect(tierInfo.monthly).toBe(POLAR_PRODUCTS["pro-monthly"]);
    expect(tierInfo.yearly).toBe(POLAR_PRODUCTS["pro-yearly"]);
  });
});
