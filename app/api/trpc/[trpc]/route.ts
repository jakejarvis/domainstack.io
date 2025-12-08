import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { CORRELATION_ID_HEADER } from "@/lib/logger/correlation";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/trpc/init";

const handler = async (req: Request) => {
  // Extract correlation ID from context to add to response headers
  const ctx = await createContext({ req });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ctx,
    onError: async ({ path, error }) => {
      // Use logger for unhandled errors
      const { logger } = await import("@/lib/logger/server");
      logger.error("unhandled error", error, { source: "trpc", path });
    },
    responseMeta: () => {
      // Echo correlation ID back in response header (standard practice)
      if (ctx.correlationId) {
        return {
          headers: {
            [CORRELATION_ID_HEADER]: ctx.correlationId,
          },
        };
      }
      return {};
    },
  });
};

export { handler as GET, handler as POST };
