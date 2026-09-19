import { MCP_SECTION_TOOLS } from "@/lib/constants/mcp-tools";
import { SECTION_IDS } from "@domainstack/constants";

export const tools = [
  ...SECTION_IDS.map((section) => ({
    name: MCP_SECTION_TOOLS[section].name,
    description: MCP_SECTION_TOOLS[section].description,
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
