import { useRouter as useProgressRouter } from "@bprogress/next/app";

export function useRouter() {
  const router = useProgressRouter();
  return router;
}
