import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/trpc/init";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
    onError: ({ path, error }) => {
      console.error(`[trpc] unhandled error ${path}`, error);
    },
  });

export { handler as GET, handler as POST };
