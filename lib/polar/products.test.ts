import { describe, expect, it } from "vitest";
import {
  getProduct,
  getProductsForCheckout,
  getProductsForTier,
  getTierForProductId,
  POLAR_PRODUCTS,
  PRO_TIER_INFO,
} from "./products";

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
  it("has correct name and description", () => {
    expect(PRO_TIER_INFO.name).toBe("Pro");
    expect(PRO_TIER_INFO.description).toBeDefined();
  });

  it("has features array", () => {
    expect(PRO_TIER_INFO.features).toBeInstanceOf(Array);
    expect(PRO_TIER_INFO.features.length).toBeGreaterThan(0);
  });

  it("references monthly and yearly products", () => {
    expect(PRO_TIER_INFO.monthly).toBe(POLAR_PRODUCTS["pro-monthly"]);
    expect(PRO_TIER_INFO.yearly).toBe(POLAR_PRODUCTS["pro-yearly"]);
  });
});
