"use client";

import { ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Favicon } from "@/components/domain/favicon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScrollIndicators } from "@/hooks/use-scroll-indicators";
import { REPOSITORY_SLUG } from "@/lib/constants/app";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type ToolsDropdownProps = {
  domain: string;
};

type Tool = {
  name: string;
  faviconDomain: string;
  buildUrl: (domain: string) => string;
};

const TOOLS = (
  [
    {
      name: "crt.sh",
      faviconDomain: "crt.sh",
      buildUrl: (domain) => `https://crt.sh/?q=${encodeURIComponent(domain)}`,
    },
    {
      name: "DomainTools",
      faviconDomain: "domaintools.com",
      buildUrl: (domain) =>
        `https://whois.domaintools.com/${encodeURIComponent(domain)}`,
    },
    {
      name: "intoDNS",
      faviconDomain: "intodns.com",
      buildUrl: (domain) => `https://intodns.com/${encodeURIComponent(domain)}`,
    },
    {
      name: "MxToolbox",
      faviconDomain: "mxtoolbox.com",
      buildUrl: (domain) =>
        `https://mxtoolbox.com/SuperTool.aspx?action=mx%3a${encodeURIComponent(domain)}&run=toolpage`,
    },
    {
      name: "Security Headers",
      faviconDomain: "securityheaders.io",
      buildUrl: (domain) =>
        `https://securityheaders.com/?q=${encodeURIComponent(`https://${domain}`)}&hide=on&followRedirects=on`,
    },
    {
      name: "SecurityTrails",
      faviconDomain: "securitytrails.com",
      buildUrl: (domain) =>
        `https://securitytrails.com/domain/${encodeURIComponent(domain)}/dns`,
    },
    {
      name: "Sharing Debugger",
      faviconDomain: "facebook.com",
      buildUrl: (domain) =>
        `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(`https://${domain}`)}`,
    },
    {
      name: "VirusTotal",
      faviconDomain: "virustotal.com",
      buildUrl: (domain) =>
        `https://www.virustotal.com/gui/domain/${encodeURIComponent(domain)}/relations`,
    },
    {
      name: "Wayback Machine",
      faviconDomain: "web.archive.org",
      buildUrl: (domain) =>
        `https://web.archive.org/web/*/${encodeURIComponent(domain)}`,
    },
    {
      name: "What's My DNS?",
      faviconDomain: "whatsmydns.net",
      buildUrl: (domain) =>
        `https://www.whatsmydns.net/#A/${encodeURIComponent(domain)}`,
    },
    {
      name: "who.is",
      faviconDomain: "who.is",
      buildUrl: (domain) =>
        `https://who.is/whois/${encodeURIComponent(domain)}`,
    },
    {
      name: "Shodan",
      faviconDomain: "shodan.io",
      buildUrl: (domain) =>
        `https://www.shodan.io/search?query=hostname:${encodeURIComponent(domain)}`,
    },
    {
      name: "Censys",
      faviconDomain: "censys.io",
      buildUrl: (domain) =>
        `https://search.censys.io/search?resource=hosts&q=${encodeURIComponent(domain)}`,
    },
    {
      name: "DNSViz",
      faviconDomain: "dnsviz.net",
      buildUrl: (domain) =>
        `https://dnsviz.net/d/${encodeURIComponent(domain)}/dnssec/`,
    },
    {
      name: "SSL Labs",
      faviconDomain: "ssllabs.com",
      buildUrl: (domain) =>
        `https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(domain)}&hideResults=on`,
    },
    {
      name: "Open Threat Exchange",
      faviconDomain: "levelblue.com",
      buildUrl: (domain) =>
        `https://otx.alienvault.com/indicator/domain/${encodeURIComponent(domain)}`,
    },
    {
      name: "Cloudflare Radar",
      faviconDomain: "cloudflare.com",
      buildUrl: (domain) =>
        `https://radar.cloudflare.com/domains/domain/${encodeURIComponent(domain)}`,
    },
    {
      name: "IBM X-Force",
      faviconDomain: "exchange.xforce.ibmcloud.com",
      buildUrl: (domain) =>
        `https://exchange.xforce.ibmcloud.com/url/${encodeURIComponent(domain)}`,
    },
  ] satisfies Tool[]
).toSorted((a, b) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
);

function ScrollableMenuContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { showStart, showEnd, update } = useScrollIndicators({
    containerRef: scrollRef,
    direction: "vertical",
  });

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [update]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Top scroll shadow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-black/15 to-transparent transition-opacity duration-200 dark:from-black/40",
          showStart ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={cn("min-h-0 flex-1 overflow-y-auto p-1", className)}
      >
        <div ref={contentRef}>{children}</div>
      </div>

      {/* Bottom scroll indicator with shadow and chevron */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center transition-opacity duration-200",
          showEnd ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      >
        {/* Gradient shadow */}
        <div className="h-8 w-full bg-gradient-to-t from-black/20 to-transparent dark:from-black/50" />
        {/* Chevron indicator */}
        <div className="absolute bottom-1 flex items-center justify-center">
          <ChevronDown className="size-4 animate-bounce text-muted-foreground/90" />
        </div>
      </div>
    </div>
  );
}

export function ToolsDropdown({ domain }: ToolsDropdownProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <DropdownMenuTrigger
          render={
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  aria-label="Open menu"
                  size="icon"
                  className="cursor-pointer"
                >
                  <MoreHorizontal />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Third-party tools</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="flex flex-col overflow-hidden p-0"
      >
        <ScrollableMenuContent>
          {TOOLS.map((tool) => (
            <DropdownMenuItem
              key={tool.name}
              nativeButton={false}
              render={
                <a
                  href={tool.buildUrl(domain)}
                  className="cursor-pointer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
              <a
                href={`https://github.com/${REPOSITORY_SLUG}/issues/new`}
                onClick={(e) => {
                  e.preventDefault();
                  const url = new URL(
                    `https://github.com/${REPOSITORY_SLUG}/issues/new`,
                  );
                  url.searchParams.set("labels", "suggestion");
                  url.searchParams.set("title", "Add [TOOL] to tools dropdown");
                  url.searchParams.set(
                    "body",
                    "I suggest adding the following tool to the tools dropdown:\n\n[Add the name, URL, and a brief description of the tool here]",
                  );
                  window.open(url.toString(), "_blank", "noopener");
                }}
                target="_blank"
                rel="noopener"
                className="cursor-pointer"
              >
                <Plus />
                Suggest a tool
              </a>
            }
          />
        </ScrollableMenuContent>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
