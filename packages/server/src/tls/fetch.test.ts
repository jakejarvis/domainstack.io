/* @vitest-environment node */
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConnect = vi.fn();

// Mock node:tls before importing the module under test
vi.mock("node:tls", () => ({
  default: {
    connect: mockConnect,
  },
  connect: mockConnect,
}));

// Import after mocking
import { fetchCertificateChain } from "./fetch";

describe("fetchCertificateChain", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockSocket(options: {
    peerCertificate?: Record<string, unknown>;
    errorOnConnect?: Error;
    shouldTimeout?: boolean;
  }) {
    const socket = new EventEmitter() as EventEmitter & {
      setTimeout: ReturnType<typeof vi.fn>;
      getPeerCertificate: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };

    socket.setTimeout = vi.fn((_ms: number, callback?: () => void) => {
      if (options.shouldTimeout && callback) {
        // Simulate timeout by calling the callback which will call destroy
        setImmediate(callback);
      }
    });

    socket.getPeerCertificate = vi.fn(() => options.peerCertificate ?? {});
    socket.end = vi.fn();
    // When destroy is called with an error, emit the error event
    socket.destroy = vi.fn((err?: Error) => {
      if (err) {
        setImmediate(() => socket.emit("error", err));
      }
    });

    return socket;
  }

  it("returns success with certificate chain", async () => {
    const mockCert = {
      issuer: { CN: "Test CA" },
      subject: { CN: "example.com" },
      subjectaltname: "DNS:example.com, DNS:www.example.com",
      valid_from: "2024-01-01T00:00:00Z",
      valid_to: "2025-01-01T00:00:00Z",
      issuerCertificate: null,
    };

    const socket = createMockSocket({ peerCertificate: mockCert });

    mockConnect.mockImplementation((...args: unknown[]) => {
      const callback = args[1] as (() => void) | undefined;
      setImmediate(() => callback?.());
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.chain).toHaveLength(1);
      expect(result.chain[0]?.subject).toBe("example.com");
      expect(result.chain[0]?.issuer).toBe("Test CA");
      expect(result.chain[0]?.altNames).toContain("example.com");
      expect(result.chain[0]?.altNames).toContain("www.example.com");
    }
  });

  it("traverses issuer chain correctly", async () => {
    const rootCert = {
      issuer: { CN: "Root CA" },
      subject: { CN: "Root CA" },
      valid_from: "2020-01-01T00:00:00Z",
      valid_to: "2030-01-01T00:00:00Z",
      issuerCertificate: null,
    };

    const intermediateCert = {
      issuer: { CN: "Root CA" },
      subject: { CN: "Intermediate CA" },
      valid_from: "2022-01-01T00:00:00Z",
      valid_to: "2027-01-01T00:00:00Z",
      issuerCertificate: rootCert,
    };

    const leafCert = {
      issuer: { CN: "Intermediate CA" },
      subject: { CN: "example.com" },
      valid_from: "2024-01-01T00:00:00Z",
      valid_to: "2025-01-01T00:00:00Z",
      issuerCertificate: intermediateCert,
    };

    const socket = createMockSocket({ peerCertificate: leafCert });

    mockConnect.mockImplementation((...args: unknown[]) => {
      const callback = args[1] as (() => void) | undefined;
      setImmediate(() => callback?.());
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.chain).toHaveLength(3);
      expect(result.chain[0]?.subject).toBe("example.com");
      expect(result.chain[1]?.subject).toBe("Intermediate CA");
      expect(result.chain[2]?.subject).toBe("Root CA");
    }
  });

  it("stops traversal on self-signed certificate (issuer === current)", async () => {
    const selfSignedCert: Record<string, unknown> = {
      issuer: { CN: "Self Signed" },
      subject: { CN: "Self Signed" },
      valid_from: "2024-01-01T00:00:00Z",
      valid_to: "2025-01-01T00:00:00Z",
    };
    // Self-referencing
    selfSignedCert.issuerCertificate = selfSignedCert;

    const socket = createMockSocket({ peerCertificate: selfSignedCert });

    mockConnect.mockImplementation((...args: unknown[]) => {
      const callback = args[1] as (() => void) | undefined;
      setImmediate(() => callback?.());
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (result.success) {
      // Should only have one cert, not infinite loop
      expect(result.chain).toHaveLength(1);
      expect(result.chain[0]?.subject).toBe("Self Signed");
    }
  });

  it("returns dns_error for ENOTFOUND", async () => {
    const socket = createMockSocket({});
    const error = new Error("getaddrinfo ENOTFOUND example.invalid");
    (error as NodeJS.ErrnoException).code = "ENOTFOUND";

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.invalid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("dns_error");
    }
  });

  it("returns dns_error for EAI_AGAIN", async () => {
    const socket = createMockSocket({});
    const error = new Error("getaddrinfo EAI_AGAIN example.com");
    (error as NodeJS.ErrnoException).code = "EAI_AGAIN";

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("dns_error");
    }
  });

  it("returns tls_error for certificate errors", async () => {
    const socket = createMockSocket({});
    const error = new Error("unable to verify the first certificate");
    (error as NodeJS.ErrnoException).code = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("tls_error");
    }
  });

  it("returns tls_error for CERT_HAS_EXPIRED", async () => {
    const socket = createMockSocket({});
    const error = new Error("certificate has expired");
    (error as NodeJS.ErrnoException).code = "CERT_HAS_EXPIRED";

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("tls_error");
    }
  });

  it("returns fetch_error for ECONNREFUSED (connection refused before TLS)", async () => {
    const socket = createMockSocket({});
    const error = new Error("connect ECONNREFUSED");
    (error as NodeJS.ErrnoException).code = "ECONNREFUSED";

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      // ECONNREFUSED is a network error, not a TLS error
      expect(result.error).toBe("fetch_error");
    }
  });

  it("returns timeout for socket timeout", async () => {
    const socket = createMockSocket({ shouldTimeout: true });

    mockConnect.mockImplementation(() => socket);

    const result = await fetchCertificateChain("slow.example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("timeout");
    }
  });

  it("returns fetch_error for unknown errors", async () => {
    const socket = createMockSocket({});
    const error = new Error("Unknown error occurred");

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("fetch_error");
    }
  });

  it("respects custom port option", async () => {
    const mockCert = {
      issuer: { CN: "Test CA" },
      subject: { CN: "example.com" },
      valid_from: "2024-01-01T00:00:00Z",
      valid_to: "2025-01-01T00:00:00Z",
      issuerCertificate: null,
    };

    const socket = createMockSocket({ peerCertificate: mockCert });
    let capturedPort = 0;

    mockConnect.mockImplementation((...args: unknown[]) => {
      const options = args[0] as { port?: number };
      const callback = args[1] as (() => void) | undefined;
      capturedPort = options.port ?? 0;
      setImmediate(() => callback?.());
      return socket;
    });

    await fetchCertificateChain("example.com", { port: 8443 });

    expect(capturedPort).toBe(8443);
  });

  it("uses default port 443", async () => {
    const mockCert = {
      issuer: { CN: "Test CA" },
      subject: { CN: "example.com" },
      valid_from: "2024-01-01T00:00:00Z",
      valid_to: "2025-01-01T00:00:00Z",
      issuerCertificate: null,
    };

    const socket = createMockSocket({ peerCertificate: mockCert });
    let capturedPort = 0;

    mockConnect.mockImplementation((...args: unknown[]) => {
      const options = args[0] as { port?: number };
      const callback = args[1] as (() => void) | undefined;
      capturedPort = options.port ?? 0;
      setImmediate(() => callback?.());
      return socket;
    });

    await fetchCertificateChain("example.com");

    expect(capturedPort).toBe(443);
  });
});
