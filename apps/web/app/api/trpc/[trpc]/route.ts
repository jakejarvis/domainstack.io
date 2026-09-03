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
    onError: ({ path, error }) => {
      void (async () => {
        const { logger } = await import("@domainstack/logger");
        logger.error({ err: error, source: "trpc", path });
      })();
    },
  });
};

export { handler as GET, handler as POST };
