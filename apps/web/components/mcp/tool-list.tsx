import { tools } from "@/components/mcp/tools";
import { Badge } from "@domainstack/ui/badge";

export function McpToolList() {
  return (
    <div className="mt-6 space-y-6">
      {tools.map((tool) => (
        <div key={tool.name} className="not-prose space-y-3 rounded-lg border bg-muted/20 p-4">
          <h3 className="font-mono text-[15px]">{tool.name}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
          <div>
            <span className="text-xs font-medium tracking-wide text-foreground/75 uppercase">
              Parameters
            </span>
            <ul className="mt-2 space-y-1 pl-2 [&_li]:list-none">
              {tool.parameters.map((param) => (
                <li key={param.name} className="space-x-2">
                  <span className="font-mono text-[13px] text-foreground">{param.name}</span>
                  <Badge variant="outline" className="text-xs leading-4 lowercase">
                    {param.type}
                  </Badge>
                  {param.required && (
                    <Badge variant="destructive" className="text-xs leading-4 lowercase">
                      Required
                    </Badge>
                  )}
                  {"description" in param && (
                    <span className="font-sans text-xs text-muted-foreground">
                      {param.description}
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
