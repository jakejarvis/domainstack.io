import { IconDotsVertical, IconPlus } from "@tabler/icons-react";

import { Favicon } from "@/components/icons/favicon";
import { EXTERNAL_TOOLS, REPOSITORY_SLUG } from "@domainstack/constants";
import { Button } from "@domainstack/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";
import { cn } from "@domainstack/ui/utils";

type ToolsDropdownProps = {
  domain: string;
  enabled?: boolean;
};

const SUGGEST_TOOL_ISSUE_URL = (() => {
  const url = new URL(`https://github.com/${REPOSITORY_SLUG}/issues/new`);
  url.searchParams.set("labels", "suggestion");
  url.searchParams.set("title", "Add [TOOL] to tools dropdown");
  url.searchParams.set(
    "body",
    "I suggest adding the following tool to the tools dropdown:\n\n[Add the name, URL, and a brief description of the tool here]",
  );
  return url.toString();
})();

export function ToolsDropdown({ domain, enabled = true }: ToolsDropdownProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <DropdownMenuTrigger
          nativeButton={false}
          render={
            <TooltipTrigger
              render={
                <div className={cn("pointer-events-auto", !enabled && "cursor-not-allowed")}>
                  <Button variant="outline" size="icon" aria-label="Open menu" disabled={!enabled}>
                    <IconDotsVertical />
                    <span className="sr-only">Open tools menu</span>
                  </Button>
                </div>
              }
            />
          }
        />
        <TooltipContent>Third-party tools</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="flex min-w-52 flex-col overflow-hidden p-0">
        <ScrollArea className="max-h-[65vh] min-h-0 flex-1">
          <div className="p-1">
            {EXTERNAL_TOOLS.map((tool) => (
              <DropdownMenuItem
                key={tool.name}
                nativeButton={false}
                render={
                  <a href={tool.buildUrl(domain)} target="_blank" rel="noopener noreferrer">
                    <Favicon domain={tool.faviconDomain} />
                    {tool.name}
                  </a>
                }
              />
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              nativeButton={false}
              render={
                <a href={SUGGEST_TOOL_ISSUE_URL} target="_blank" rel="noopener">
                  <IconPlus />
                  Suggest a tool
                </a>
              }
            />
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
