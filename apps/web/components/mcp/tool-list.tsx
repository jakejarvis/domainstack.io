import { z } from "zod";

import { MCP_TOOLS } from "@/lib/constants/mcp-tools";
import { Badge } from "@domainstack/ui/badge";

type ParameterSchema = {
  type: string;
  items?: { type: string };
  description?: string;
};

export function McpToolList() {
  return (
    <div className="mt-6 space-y-6">
      {MCP_TOOLS.map((tool) => (
        <div key={tool.name} className="not-prose space-y-3 rounded-lg border bg-muted/20 p-4">
          <h3 className="font-mono text-[15px]">{tool.name}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
          <div>
            <span className="text-xs font-medium tracking-wide text-foreground/75 uppercase">
              Parameters
            </span>
            <ul className="mt-2 space-y-1 pl-2 [&_li]:list-none">
              {Object.entries(
                z.toJSONSchema(tool.inputSchema).properties as Record<string, ParameterSchema>,
              ).map(([name, property]) => (
                <li key={name} className="space-x-2">
                  <span className="font-mono text-[13px] text-foreground">{name}</span>
                  <Badge variant="outline" className="text-xs leading-4 lowercase">
                    {property.type === "array" ? `${property.items?.type}[]` : property.type}
                  </Badge>
                  {name === "domain" && (
                    <Badge variant="destructive" className="text-xs leading-4 lowercase">
                      Required
                    </Badge>
                  )}
                  {property.description && (
                    <span className="font-sans text-xs text-muted-foreground">
                      {property.description}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
