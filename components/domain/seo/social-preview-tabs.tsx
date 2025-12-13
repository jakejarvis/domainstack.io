"use client";

import { useState } from "react";
import {
  DiscordIcon,
  FacebookIcon,
  LinkedinIcon,
  SlackIcon,
  TwitterIcon,
} from "@/components/brand-icons";
import { SocialPreview } from "@/components/domain/seo/social-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SocialPreviewProvider } from "@/lib/schemas";

export function SocialPreviewTabs({
  preview,
  twitterVariant,
}: {
  preview: {
    title: string | null;
    description: string | null;
    image?: string | null;
    imageUploaded?: string | null | undefined;
    canonicalUrl: string;
  };
  twitterVariant: "compact" | "large";
}) {
  const [selectedTab, setSelectedTab] =
    useState<SocialPreviewProvider>("twitter");

  return (
    <div className="mt-6 space-y-3">
      <div className="text-[11px] text-foreground/70 uppercase tracking-[0.08em] dark:text-foreground/80">
        Open Graph
      </div>
      <Tabs
        value={selectedTab}
        onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}
      >
        <TabsList className="h-11 w-full gap-1 border border-muted-foreground/15 bg-muted/30 md:justify-start dark:bg-muted/50 dark:*:data-[state=active]:bg-accent">
          <TabsTrigger
            value="twitter"
            className="cursor-pointer data-[state=active]:cursor-default"
          >
            <TwitterIcon className="size-4 md:size-3.5" aria-hidden="true" />
            <span className="hidden text-[13px] md:inline">Twitter</span>
          </TabsTrigger>
          <TabsTrigger
            value="facebook"
            className="cursor-pointer data-[state=active]:cursor-default"
          >
            <FacebookIcon className="size-4 md:size-3.5" aria-hidden="true" />
            <span className="hidden text-[13px] md:inline">Facebook</span>
          </TabsTrigger>
          <TabsTrigger
            value="linkedin"
            className="cursor-pointer data-[state=active]:cursor-default"
          >
            <LinkedinIcon className="size-4 md:size-3.5" aria-hidden="true" />
            <span className="hidden text-[13px] md:inline">LinkedIn</span>
          </TabsTrigger>
          <TabsTrigger
            value="discord"
            className="cursor-pointer data-[state=active]:cursor-default"
          >
            <DiscordIcon className="size-4 md:size-3.5" aria-hidden="true" />
            <span className="hidden text-[13px] md:inline">Discord</span>
          </TabsTrigger>
          <TabsTrigger
            value="slack"
            className="cursor-pointer data-[state=active]:cursor-default"
          >
            <SlackIcon className="size-4 md:size-3.5" aria-hidden="true" />
            <span className="hidden text-[13px] md:inline">Slack</span>
          </TabsTrigger>
        </TabsList>
        <div className="mx-auto mt-4 mb-2 w-full max-w-[480px] md:max-w-[640px]">
          <TabsContent value={selectedTab} className="grid place-items-center">
            <SocialPreview
              provider={selectedTab}
              title={preview.title}
              description={preview.description}
              image={preview.imageUploaded ?? null}
              url={preview.canonicalUrl}
              variant={selectedTab === "twitter" ? twitterVariant : undefined}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
