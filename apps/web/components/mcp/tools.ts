import { MCP_SECTION_TOOLS } from "@/lib/constants/mcp-tools";

export const tools = [
  ...MCP_SECTION_TOOLS.map(({ name, description }) => ({
    name,
    description,
    parameters: [{ name: "domain", type: "string", required: true }],
  })),
  {
    name: "domain_report",
    description:
      "Get a comprehensive domain report combining multiple data sources in a single call. Use the sections parameter to request only specific data.",
    parameters: [
      { name: "domain", type: "string", required: true },
      {
        name: "sections",
        type: "string[]",
        required: false,
        description:
          'Array of section(s) to compile: "dns", "registration", "hosting", "certificates", "headers", "seo". Defaults to all.',
      },
    ],
  },
];
