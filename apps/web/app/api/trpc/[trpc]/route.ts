import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createContext } from "@/trpc/init";
import { appRouter } from "@domainstack/api";

const handler = async (req: Request) => {
  const ctx = await createContext({ req });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ctx,
  });
};

export { handler as GET, handler as POST };
