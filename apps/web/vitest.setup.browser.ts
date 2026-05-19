// Shim process for Next.js components
// @ts-expect-error
globalThis.process = {
  env: { NODE_ENV: "test" },
  cwd: () => "/",
};

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock fetch to prevent network requests
globalThis.fetch = vi.fn<typeof fetch>(() => {
  throw new Error("Network requests are not allowed in tests. Please mock fetch.");
});

vi.mock("@domainstack/analytics/client", () => ({
  analytics: {
    track: vi.fn<(...args: unknown[]) => void>(),
    trackException: vi.fn<(...args: unknown[]) => void>(),
  },
  useAnalytics: () => ({
    track: vi.fn<(...args: unknown[]) => void>(),
    trackException: vi.fn<(...args: unknown[]) => void>(),
  }),
}));

// Mock logger to avoid noise in tests
type MockLogger = Record<
  "log" | "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "child",
  ReturnType<typeof vi.fn>
>;

const createMockLogger = (): MockLogger => ({
  log: vi.fn<(...args: unknown[]) => void>(),
  trace: vi.fn<(...args: unknown[]) => void>(),
  debug: vi.fn<(...args: unknown[]) => void>(),
  info: vi.fn<(...args: unknown[]) => void>(),
  warn: vi.fn<(...args: unknown[]) => void>(),
  error: vi.fn<(...args: unknown[]) => void>(),
  fatal: vi.fn<(...args: unknown[]) => void>(),
  child: vi.fn<(...args: unknown[]) => MockLogger>(() => createMockLogger()),
});

vi.mock("@/lib/logger/client", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn<(...args: unknown[]) => ReturnType<typeof createMockLogger>>(() =>
    createMockLogger(),
  ),
}));

// Lingui macros are compiled away by the SWC plugin in the real Next build,
// but web vitest (`@vitejs/plugin-react`) does NOT run that transform — the
// `/macro` entrypoints would throw `printError` at runtime. Replace them with
// identity shims so component tests render the English source text (which is
// what the existing assertions expect) without needing an I18nProvider.
const cookMessage = (input: unknown, ...values: unknown[]): string => {
  if (Array.isArray(input)) {
    // Tagged-template form: t`Foo ${x} bar`
    return (input as readonly string[]).reduce(
      (acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""),
      "",
    );
  }
  if (input && typeof input === "object") {
    const desc = input as { message?: string; id?: string };
    return desc.message ?? desc.id ?? "";
  }
  return String(input ?? "");
};

type PluralProps = {
  value: number;
  one?: string;
  other?: string;
} & Record<string, unknown>;

const renderPlural = ({ value, one, other, ...rest }: PluralProps): string => {
  const exact = rest[`_${value}`] as string | undefined;
  const template = exact ?? (value === 1 ? one : other) ?? other ?? "";
  return String(template).replace(/#/g, String(value));
};

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children,
  Plural: (props: PluralProps) => renderPlural(props),
  useLingui: () => ({
    t: cookMessage,
    i18n: { _: cookMessage, locale: "en" },
  }),
}));

vi.mock("@lingui/core/macro", () => ({
  t: cookMessage,
  msg: cookMessage,
  defineMessage: cookMessage,
  plural: (value: number, opts: Record<string, string>) =>
    renderPlural({ value, ...opts } as PluralProps),
  select: (_value: string, opts: Record<string, string>) => opts.other ?? "",
  selectOrdinal: (value: number, opts: Record<string, string>) =>
    renderPlural({ value, ...opts } as PluralProps),
  ph: (value: unknown) => value,
}));
