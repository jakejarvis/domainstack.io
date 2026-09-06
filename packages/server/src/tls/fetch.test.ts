/* @vitest-environment node */
import type { lookup as dnsLookup } from "node:dns/promises";
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockConnect, mockLookup } = vi.hoisted(() => ({
  mockConnect: vi.fn<(...args: unknown[]) => unknown>(),
  mockLookup: vi.fn<typeof dnsLookup>(),
}));

vi.mock("node:tls", () => ({
  default: {
    connect: mockConnect,
  },
  connect: mockConnect,
}));

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
}));

import { fetchCertificateChain } from "./fetch";
import {
  cyclicChain,
  expiredChain,
  incompleteChain,
  malformedDateCertificate,
  noCertificate,
  selfSignedCertificate,
  validChain,
  wrongHostChain,
} from "./fixtures";

type LookupResult = Awaited<ReturnType<typeof dnsLookup>>;

const PUBLIC_LOOKUP: LookupResult = [
  { address: "93.184.216.34", family: 4 },
] as unknown as LookupResult;

describe("fetchCertificateChain", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLookup.mockResolvedValue(PUBLIC_LOOKUP);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockSocket(options: {
    peerCertificate?: object;
    errorOnConnect?: Error;
    shouldTimeout?: boolean;
    authorized?: boolean;
    authorizationError?: string | Error;
    protocol?: string | null;
    cipher?: { name: string } | null;
  }) {
    const socket = new EventEmitter() as EventEmitter & {
      setTimeout: (ms: number, callback?: () => void) => void;
      getPeerCertificate: () => object;
      getProtocol: () => string | null;
      getCipher: () => { name: string } | undefined;
      authorized: boolean;
      authorizationError?: string | Error;
      end: () => void;
      destroy: (err?: Error) => void;
    };

    socket.setTimeout = vi.fn<(ms: number, callback?: () => void) => void>((_ms, callback) => {
      if (options.shouldTimeout && callback) {
        setImmediate(callback);
      }
    });

    socket.getPeerCertificate = vi.fn<() => object>(() => options.peerCertificate ?? {});
    socket.getProtocol = vi.fn<() => string | null>(() =>
      Object.hasOwn(options, "protocol") ? (options.protocol ?? null) : "TLSv1.3",
    );
    socket.getCipher = vi.fn<() => { name: string } | undefined>(() =>
      Object.hasOwn(options, "cipher")
        ? (options.cipher ?? undefined)
        : { name: "TLS_AES_256_GCM_SHA384" },
    );
    socket.authorized = options.authorized ?? true;
    socket.authorizationError = options.authorizationError;
    socket.end = vi.fn<() => void>();
    socket.destroy = vi.fn<(err?: Error) => void>((err) => {
      if (err) {
        setImmediate(() => socket.emit("error", err));
      }
    });

    return socket;
  }

  function mockSuccessfulConnect(socket: ReturnType<typeof createMockSocket>) {
    mockConnect.mockImplementation((...args: unknown[]) => {
      const callback = args[1] as (() => void) | undefined;
      setImmediate(() => callback?.());
      return socket;
    });
  }

  it("returns success with a valid certificate chain and TLS observation", async () => {
    const socket = createMockSocket({ peerCertificate: validChain() });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.valid).toBe(true);
    expect(result.validationError).toBeNull();
    expect(result.protocol).toBe("TLSv1.3");
    expect(result.cipher).toBe("TLS_AES_256_GCM_SHA384");
    expect(result.publicKeyBits).toBe(256);
    expect(result.chainComplete).toBe(true);
    expect(result.chain).toHaveLength(3);
    expect(result.chain[0]?.subject).toBe("example.com");
    expect(result.chain[0]?.chainPosition).toBe(0);
    expect(result.chain[1]?.chainPosition).toBe(1);
    expect(result.chain[2]?.chainPosition).toBe(2);
    expect(result.chain[0]?.altNames).toContain("example.com");
  });

  it("returns an expired chain with valid: false instead of tls_error", async () => {
    const socket = createMockSocket({
      peerCertificate: expiredChain(),
      authorized: false,
      authorizationError: "CERT_HAS_EXPIRED",
    });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.valid).toBe(false);
    expect(result.validationError).toBe("CERT_HAS_EXPIRED");
    expect(result.chain[0]?.subject).toBe("example.com");
  });

  it("returns hostname-mismatch chains with the original error code", async () => {
    const socket = createMockSocket({
      peerCertificate: wrongHostChain(),
      authorized: false,
      authorizationError: "ERR_TLS_CERT_ALTNAME_INVALID",
    });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.valid).toBe(false);
    expect(result.validationError).toBe("ERR_TLS_CERT_ALTNAME_INVALID");
  });

  it("returns self-signed chains with valid: false and chainComplete true", async () => {
    const socket = createMockSocket({
      peerCertificate: selfSignedCertificate(),
      authorized: false,
      authorizationError: "DEPTH_ZERO_SELF_SIGNED_CERT",
    });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.valid).toBe(false);
    expect(result.validationError).toBe("DEPTH_ZERO_SELF_SIGNED_CERT");
    expect(result.chain).toHaveLength(1);
    expect(result.chainComplete).toBe(true);
  });

  it("marks incomplete chains as chainComplete false", async () => {
    const socket = createMockSocket({
      peerCertificate: incompleteChain(),
      authorized: false,
      authorizationError: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.valid).toBe(false);
    expect(result.validationError).toBe("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(result.chainComplete).toBe(false);
    expect(result.chain).toHaveLength(2);
  });

  it("stops multi-node traversal cycles by fingerprint", async () => {
    const socket = createMockSocket({ peerCertificate: cyclicChain() });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.chain).toHaveLength(2);
    expect(result.chainComplete).toBe(false);
  });

  it("rejects an empty peer certificate as tls_error", async () => {
    const socket = createMockSocket({ peerCertificate: noCertificate() });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result).toEqual({ success: false, error: "tls_error" });
  });

  it("rejects malformed certificate dates as tls_error", async () => {
    const socket = createMockSocket({ peerCertificate: malformedDateCertificate() });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result).toEqual({ success: false, error: "tls_error" });
  });

  it("reads protocol, cipher, and public key size from the socket", async () => {
    const socket = createMockSocket({
      peerCertificate: validChain(),
      protocol: "TLSv1.2",
      cipher: { name: "ECDHE-RSA-AES128-GCM-SHA256" },
    });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.protocol).toBe("TLSv1.2");
    expect(result.cipher).toBe("ECDHE-RSA-AES128-GCM-SHA256");
    expect(result.publicKeyBits).toBe(256);
  });

  it("keeps explicitly null protocol and cipher instead of substituting defaults", async () => {
    const socket = createMockSocket({
      peerCertificate: validChain(),
      protocol: null,
      cipher: null,
    });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.protocol).toBeNull();
    expect(result.cipher).toBeNull();
  });

  it("reads authorizationError from an Error instance", async () => {
    const authorizationError = Object.assign(new Error("certificate has expired"), {
      code: "CERT_HAS_EXPIRED",
    });
    const socket = createMockSocket({
      peerCertificate: expiredChain(),
      authorized: false,
      authorizationError,
    });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.valid).toBe(false);
    expect(result.validationError).toBe("CERT_HAS_EXPIRED");
  });

  it("extracts and normalizes fingerprint256 and serialNumber", async () => {
    const socket = createMockSocket({ peerCertificate: validChain() });
    mockSuccessfulConnect(socket);

    const result = await fetchCertificateChain("example.com");

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected fetchCertificateChain to succeed");
    }
    expect(result.chain[0]?.fingerprint256).toBe("aa".repeat(32));
    expect(result.chain[0]?.serialNumber).toBe("03");
  });

  it("does not call tls.connect when DNS resolves to a private address", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }] as unknown as LookupResult);

    const result = await fetchCertificateChain("internal.example.com");

    expect(result).toEqual({ success: false, error: "fetch_error" });
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("does not call tls.connect when DNS returns mixed public and private addresses", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.1.10", family: 4 },
    ] as unknown as LookupResult);

    const result = await fetchCertificateChain("mixed.example.com");

    expect(result).toEqual({ success: false, error: "fetch_error" });
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("does not call tls.connect for blocked hostnames", async () => {
    const result = await fetchCertificateChain("localhost");

    expect(result).toEqual({ success: false, error: "fetch_error" });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("pins resolved public addresses on tls.connect while keeping SNI as the domain", async () => {
    const socket = createMockSocket({ peerCertificate: validChain() });
    let captured: { host?: string; servername?: string; lookup?: unknown } = {};

    mockConnect.mockImplementation((...args: unknown[]) => {
      captured = args[0] as typeof captured;
      const callback = args[1] as (() => void) | undefined;
      setImmediate(() => callback?.());
      return socket;
    });

    await fetchCertificateChain("example.com");

    expect(captured.host).toBe("example.com");
    expect(captured.servername).toBe("example.com");
    expect(typeof captured.lookup).toBe("function");
  });

  it("returns dns_error for ENOTFOUND", async () => {
    mockLookup.mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOTFOUND example.invalid"), { code: "ENOTFOUND" }),
    );

    const result = await fetchCertificateChain("example.invalid");

    expect(result).toEqual({ success: false, error: "dns_error" });
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("returns dns_error for ENODATA when A records are missing", async () => {
    const socket = createMockSocket({});
    const error = new Error("queryA ENODATA example.com");
    (error as NodeJS.ErrnoException).code = "ENODATA";

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result).toEqual({ success: false, error: "dns_error" });
  });

  it("returns dns_error for EAI_AGAIN", async () => {
    mockLookup.mockRejectedValue(
      Object.assign(new Error("getaddrinfo EAI_AGAIN example.com"), { code: "EAI_AGAIN" }),
    );

    const result = await fetchCertificateChain("example.com");

    expect(result).toEqual({ success: false, error: "dns_error" });
  });

  it("returns tls_error for handshake certificate errors", async () => {
    const socket = createMockSocket({});
    const error = new Error("unable to verify the first certificate");
    (error as NodeJS.ErrnoException).code = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result).toEqual({ success: false, error: "tls_error" });
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

    expect(result).toEqual({ success: false, error: "fetch_error" });
  });

  it("returns timeout for socket timeout", async () => {
    const socket = createMockSocket({ shouldTimeout: true });

    mockConnect.mockImplementation(() => socket);

    const result = await fetchCertificateChain("slow.example.com");

    expect(result).toEqual({ success: false, error: "timeout" });
  });

  it("returns fetch_error for unknown errors", async () => {
    const socket = createMockSocket({});
    const error = new Error("Unknown error occurred");

    mockConnect.mockImplementation(() => {
      setImmediate(() => socket.emit("error", error));
      return socket;
    });

    const result = await fetchCertificateChain("example.com");

    expect(result).toEqual({ success: false, error: "fetch_error" });
  });

  it("respects custom port option", async () => {
    const socket = createMockSocket({ peerCertificate: validChain() });
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
    const socket = createMockSocket({ peerCertificate: validChain() });
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
