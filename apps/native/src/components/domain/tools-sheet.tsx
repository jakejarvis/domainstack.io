import { useRef } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { Text } from "@/components/text";

interface Tool {
  name: string;
  buildUrl: (domain: string) => string;
}

const TOOLS: Tool[] = [
  { buildUrl: (d) => `https://censys.io/domain/${encodeURIComponent(d)}`, name: "Censys" },
  {
    buildUrl: (d) => `https://radar.cloudflare.com/domains/domain/${encodeURIComponent(d)}`,
    name: "Cloudflare Radar",
  },
  { buildUrl: (d) => `https://crt.sh/?q=${encodeURIComponent(d)}`, name: "crt.sh" },
  { buildUrl: (d) => `https://dnsviz.net/d/${encodeURIComponent(d)}/dnssec/`, name: "DNSViz" },
  {
    buildUrl: (d) => `https://whois.domaintools.com/${encodeURIComponent(d)}`,
    name: "DomainTools",
  },
  {
    buildUrl: (d) => `https://exchange.xforce.ibmcloud.com/url/${encodeURIComponent(d)}`,
    name: "IBM X-Force",
  },
  { buildUrl: (d) => `https://intodns.com/${encodeURIComponent(d)}`, name: "intoDNS" },
  {
    buildUrl: (d) =>
      `https://mxtoolbox.com/SuperTool.aspx?action=mx%3a${encodeURIComponent(d)}&run=toolpage`,
    name: "MxToolbox",
  },
  {
    buildUrl: (d) => `https://otx.alienvault.com/indicator/domain/${encodeURIComponent(d)}`,
    name: "Open Threat Exchange",
  },
  {
    buildUrl: (d) =>
      `https://securityheaders.com/?q=${encodeURIComponent(`https://${d}`)}&hide=on&followRedirects=on`,
    name: "Security Headers",
  },
  {
    buildUrl: (d) => `https://securitytrails.com/domain/${encodeURIComponent(d)}/dns`,
    name: "SecurityTrails",
  },
  {
    buildUrl: (d) =>
      `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(`https://${d}`)}`,
    name: "Sharing Debugger",
  },
  {
    buildUrl: (d) => `https://www.shodan.io/search?query=hostname:${encodeURIComponent(d)}`,
    name: "Shodan",
  },
  {
    buildUrl: (d) =>
      `https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(d)}&hideResults=on`,
    name: "SSL Labs",
  },
  { buildUrl: (d) => `https://traffic.cv/${encodeURIComponent(d)}`, name: "Traffic.cv" },
  {
    buildUrl: (d) => `https://www.virustotal.com/gui/domain/${encodeURIComponent(d)}/relations`,
    name: "VirusTotal",
  },
  {
    buildUrl: (d) => `https://web.archive.org/web/*/${encodeURIComponent(d)}`,
    name: "Wayback Machine",
  },
  {
    buildUrl: (d) => `https://www.whatsmydns.net/#A/${encodeURIComponent(d)}`,
    name: "What's My DNS?",
  },
  { buildUrl: (d) => `https://who.is/whois/${encodeURIComponent(d)}`, name: "who.is" },
];

export function ToolsSheet({ domain }: { domain: string }) {
  const sheetRef = useRef<AppBottomSheetRef>(null);

  return (
    <>
      <Button onPress={() => sheetRef.current?.present()} variant="secondary">
        <Text>Open in…</Text>
      </Button>
      <AppBottomSheet
        description={`Inspect ${domain} in an external tool.`}
        ref={sheetRef}
        title="Open in…"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="border-line bg-glass overflow-hidden rounded-2xl border">
            {TOOLS.map((tool, index) => (
              <Pressable
                accessibilityRole="link"
                className={index > 0 ? "border-line border-t px-4 py-3" : "px-4 py-3"}
                key={tool.name}
                onPress={() => {
                  sheetRef.current?.dismiss();
                  void Linking.openURL(tool.buildUrl(domain));
                }}
              >
                <Text className="font-semibold">{tool.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </AppBottomSheet>
    </>
  );
}
