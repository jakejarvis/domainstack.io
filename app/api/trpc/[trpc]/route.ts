import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/trpc/init";

const handler = async (req: Request) => {
  const ctx = await createContext({ req });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ctx,
    onError: async ({ path, error }) => {
      // Use logger for unhandled errors
      const { logger } = await import("@/lib/logger/server");
      logger.error({ err: error, source: "trpc", path }, "unhandled error");
    },
  });
};

export { handler as GET, handler as POST };
