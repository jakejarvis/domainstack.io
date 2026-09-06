import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { type ComponentRenderOptions, render as baseRender } from "vitest-browser-react";

/**
 * Creates a QueryClient configured for testing.
 *
 * Configuration follows TanStack Query testing best practices:
 * - retry: false - Prevents test timeouts on failed queries
 * - gcTime: Infinity - Prevents "Jest did not exit" warnings
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/testing
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Turn off retries to prevent test timeouts
        retry: false,
        // Set gcTime to Infinity to prevent cleanup warnings
        gcTime: Number.POSITIVE_INFINITY,
      },
      mutations: {
        // Turn off retries for mutations too
        retry: false,
      },
    },
  });
}

type AtomTuple = readonly [any, any];

/**
 * Helper component to hydrate Jotai atoms with initial values for testing.
 */
function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: AtomTuple[];
  children: React.ReactNode;
}) {
  useHydrateAtoms(initialValues);
  return children;
}

/**
 * Test wrapper that provides QueryClient, Jotai, and Motion with a fresh
 * instance for each test. `reducedMotion="always"` skips enter/exit so
 * `m.*` components don't stay stuck at `opacity: 0`.
 */
function createWrapper(queryClient: QueryClient, initialAtomValues: AtomTuple[] = []) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <MotionConfig reducedMotion="always">
            <LazyMotion features={domMax}>
              <HydrateAtoms initialValues={initialAtomValues}>{children}</HydrateAtoms>
            </LazyMotion>
          </MotionConfig>
        </JotaiProvider>
      </QueryClientProvider>
    );
  };
}

interface CustomRenderOptions extends Omit<ComponentRenderOptions, "wrapper"> {
  /**
   * Optional QueryClient instance. If not provided, a new one will be created
   * using createTestQueryClient().
   */
  queryClient?: QueryClient;
  /**
   * Optional initial values for Jotai atoms. Each tuple is [atom, initialValue].
   * @example [[myAtom, 'initial value'], [anotherAtom, 42]]
   */
  initialAtomValues?: AtomTuple[];
}

/**
 * Custom render function that wraps components with QueryClientProvider.
 *
 * Usage:
 * ```tsx
 * import { page } from "vitest/browser"
 * import { render } from "@/mocks/react"
 *
 * it("renders component with React Query", async () => {
 *   await render(<MyComponent />)
 *   await expect.element(page.getByText("Hello")).toBeInTheDocument()
 * })
 * ```
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/testing
 */
export async function render(ui: React.ReactNode, options?: CustomRenderOptions) {
  const {
    queryClient = createTestQueryClient(),
    initialAtomValues = [],
    ...renderOptions
  } = options ?? {};

  const screen = await baseRender(ui, {
    wrapper: createWrapper(queryClient, initialAtomValues),
    ...renderOptions,
  });

  return {
    ...screen,
    queryClient,
  };
}

export { renderHook } from "vitest-browser-react";
