import { NextResponse } from "next/server";
import { BASE_URL } from "@/lib/constants/app";

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Domainstack</ShortName>
  <Description>Open a Domainstack report for a given domain name</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${BASE_URL}/favicon.ico</Image>
  <Url type="text/html" template="${BASE_URL}/{searchTerms}" />
  <Url type="application/opensearchdescription+xml" rel="self" template="${BASE_URL}/opensearch.xml" />
</OpenSearchDescription>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/opensearchdescription+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
