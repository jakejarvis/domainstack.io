/* @vitest-environment node */
import { HttpResponse, http } from "msw";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { server } from "@/mocks/server";

// Mock storage
const storageMock = vi.hoisted(() => ({
  storeImage: vi.fn().mockResolvedValue({
    url: "https://blob.vercel-storage.com/favicon-test.webp",
    pathname: "favicon-test.webp",
  }),
}));

vi.mock("@/lib/storage", () => storageMock);

// Mock image processing
const imageMock = vi.hoisted(() => ({
  convertBufferToImageCover: vi.fn().mockResolvedValue(Buffer.from("webp")),
}));

vi.mock("@/lib/image", () => imageMock);

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
  vi.clearAllMocks();
});

afterEach(async () => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

// Create a simple 1x1 PNG for testing
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe("faviconWorkflow", () => {
  describe("fetchIconFromSources step", () => {
    it("fetches favicon from DuckDuckGo", async () => {
      server.use(
        http.get("https://icons.duckduckgo.com/ip3/example.com.ico", () => {
          return new HttpResponse(TEST_PNG, {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        }),
      );

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "example.com" });

      expect(result.success).toBe(true);
      expect(result.data.url).toBe(
        "https://blob.vercel-storage.com/favicon-test.webp",
      );
    });

    it("falls back to Google when DuckDuckGo fails", async () => {
      server.use(
        http.get("https://icons.duckduckgo.com/ip3/fallback.com.ico", () => {
          return new HttpResponse(null, { status: 404 });
        }),
        http.get("https://www.google.com/s2/favicons", () => {
          return new HttpResponse(TEST_PNG, {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        }),
      );

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "fallback.com" });

      expect(result.success).toBe(true);
      expect(result.data.url).toBe(
        "https://blob.vercel-storage.com/favicon-test.webp",
      );
    });

    it("handles fallback when first source fails", async () => {
      // DuckDuckGo returns network error, Google succeeds
      server.use(
        http.get("https://icons.duckduckgo.com/ip3/fallback2.com.ico", () => {
          return HttpResponse.error();
        }),
        http.get("https://www.google.com/s2/favicons", () => {
          return new HttpResponse(TEST_PNG, {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        }),
      );

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "fallback2.com" });

      // Should still succeed with Google fallback
      expect(result.success).toBe(true);
      expect(result.data.url).toBe(
        "https://blob.vercel-storage.com/favicon-test.webp",
      );
    });
  });

  describe("processIcon step", () => {
    it("converts image to WebP format", async () => {
      server.use(
        http.get("https://icons.duckduckgo.com/ip3/process.com.ico", () => {
          return new HttpResponse(TEST_PNG, {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        }),
      );

      const { faviconWorkflow } = await import("./workflow");
      await faviconWorkflow({ domain: "process.com" });

      // Verify image processing was called
      expect(imageMock.convertBufferToImageCover).toHaveBeenCalled();
    });

    it("returns failure when image processing fails", async () => {
      imageMock.convertBufferToImageCover.mockResolvedValueOnce(null);

      server.use(
        http.get("https://icons.duckduckgo.com/ip3/badfavicon.com.ico", () => {
          return new HttpResponse(TEST_PNG, {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        }),
      );

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "badfavicon.com" });

      expect(result.success).toBe(false);
      expect(result.data.url).toBeNull();
    });
  });

  describe("storeAndPersist step", () => {
    it("stores favicon to Vercel Blob and persists to database", async () => {
      server.use(
        http.get("https://icons.duckduckgo.com/ip3/persist.test.ico", () => {
          return new HttpResponse(TEST_PNG, {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        }),
      );

      const { faviconWorkflow } = await import("./workflow");
      await faviconWorkflow({ domain: "persist.test" });

      // Verify storage was called
      expect(storageMock.storeImage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "favicon",
          domain: "persist.test",
          width: 32,
          height: 32,
        }),
      );

      // Verify database persistence
      const { findDomainByName } = await import("@/lib/db/repos/domains");
      const domain = await findDomainByName("persist.test");
      expect(domain).toBeTruthy();

      const { db } = await import("@/lib/db/client");
      const { favicons } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const stored = await db
        .select()
        .from(favicons)
        .where(eq(favicons.domainId, domain?.id))
        .limit(1);

      expect(stored.length).toBe(1);
      expect(stored[0].url).toBe(
        "https://blob.vercel-storage.com/favicon-test.webp",
      );
      expect(stored[0].source).toBe("duckduckgo");
      expect(stored[0].notFound).toBe(false);
    });
  });

  describe("persistFailure step", () => {
    it("persists failure when image processing fails", async () => {
      // Image processing fails, triggering persistFailure
      imageMock.convertBufferToImageCover.mockResolvedValueOnce(null);

      server.use(
        http.get(
          "https://icons.duckduckgo.com/ip3/processfail.test.ico",
          () => {
            return new HttpResponse(TEST_PNG, {
              status: 200,
              headers: { "content-type": "image/png" },
            });
          },
        ),
      );

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "processfail.test" });

      expect(result.success).toBe(false);

      // Verify database persistence with url=null
      const { findDomainByName } = await import("@/lib/db/repos/domains");
      const domain = await findDomainByName("processfail.test");
      expect(domain).toBeTruthy();

      const { db } = await import("@/lib/db/client");
      const { favicons } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const stored = await db
        .select()
        .from(favicons)
        .where(eq(favicons.domainId, domain?.id))
        .limit(1);

      expect(stored.length).toBe(1);
      expect(stored[0].url).toBeNull();
    });
  });
});
