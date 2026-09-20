import { buildLlmsTxt } from "@/lib/llms-txt";

export function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  return new Response(buildLlmsTxt(baseUrl), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
