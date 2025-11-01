"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { Favicon } from "@/components/favicon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REPOSITORY_SLUG } from "@/lib/constants";

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
      faviconDomain: "ssllabs.com",
      buildUrl: (domain) =>
        `https://otx.alienvault.com/indicator/domain/${encodeURIComponent(domain)}`,
    },
  ] satisfies Tool[]
).toSorted((a, b) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
);

export function ToolsDropdown({ domain }: ToolsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label="Open menu" size="icon">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TOOLS.map((tool) => (
          <DropdownMenuItem key={tool.name} asChild>
            <a
              href={tool.buildUrl(domain)}
              className="cursor-pointer"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Favicon domain={tool.faviconDomain} />
              {tool.name}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
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
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
