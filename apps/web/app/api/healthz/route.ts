import { connection, NextResponse } from "next/server";

export async function GET() {
  await connection();

  return new NextResponse("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
