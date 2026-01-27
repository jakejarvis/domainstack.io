import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";

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

// biome-ignore lint/suspicious/noExplicitAny: Jotai atoms can be any type
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
 * Test wrapper that provides QueryClientProvider and JotaiProvider with fresh
 * instances for each test. Ensures test isolation.
 */
function createWrapper(
  queryClient: QueryClient,
  initialAtomValues: AtomTuple[] = [],
) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <HydrateAtoms initialValues={initialAtomValues}>
            {children}
          </HydrateAtoms>
        </JotaiProvider>
      </QueryClientProvider>
    );
  };
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
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
 * import { render, screen } from '@/lib/test-utils'
 *
 * it('renders component with React Query', () => {
 *   render(<MyComponent />)
 *   expect(screen.getByText('Hello')).toBeInTheDocument()
 * })
 *
 * // With custom QueryClient
 * it('uses prefilled cache', () => {
 *   const queryClient = createTestQueryClient()
 *   queryClient.setQueryData(['key'], { data: 'value' })
 *   render(<MyComponent />, { queryClient })
 * })
 * ```
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/testing
 */
function customRender(ui: React.ReactElement, options?: CustomRenderOptions) {
  const {
    queryClient = createTestQueryClient(),
    initialAtomValues = [],
    ...renderOptions
  } = options ?? {};

  return {
    ...render(ui, {
      wrapper: createWrapper(queryClient, initialAtomValues),
      ...renderOptions,
    }),
    queryClient,
  };
}

// Re-export everything from @testing-library/react
export * from "@testing-library/react";

// Override render with our custom version
export { customRender as render };
