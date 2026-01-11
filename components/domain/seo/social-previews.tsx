import { SiDiscord, SiFacebook, SiX } from "@icons-pack/react-simple-icons";
import { ImageBrokenIcon } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SocialPreviewProvider =
  | "twitter"
  | "facebook"
  | "linkedin"
  | "discord"
  | "slack";

export function SocialPreviews({
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
        <TabsList className="h-11 gap-1 md:justify-start">
          <TabsTrigger value="twitter" data-1p-ignore>
            <SiX className="size-4 md:size-3.5" aria-hidden />
            <span className="hidden text-[13px] md:inline">Twitter</span>
          </TabsTrigger>
          <TabsTrigger value="facebook" data-1p-ignore>
            <SiFacebook className="size-4 md:size-3.5" aria-hidden />
            <span className="hidden text-[13px] md:inline">Facebook</span>
          </TabsTrigger>
          <TabsTrigger value="linkedin" data-1p-ignore>
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4 md:size-3.5"
              role="img"
              aria-label="Linkedin"
              aria-hidden
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.06 2.06 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065m1.782 13.019H3.555V9h3.564zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
            </svg>
            <span className="hidden text-[13px] md:inline">LinkedIn</span>
          </TabsTrigger>
          <TabsTrigger value="discord" data-1p-ignore>
            <SiDiscord className="size-4 md:size-3.5" aria-hidden />
            <span className="hidden text-[13px] md:inline">Discord</span>
          </TabsTrigger>
          <TabsTrigger value="slack" data-1p-ignore>
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4 md:size-3.5"
              role="img"
              aria-label="Slack"
              aria-hidden
            >
              <path d="M5.042 15.165a2.53 2.53 0 0 1-2.52 2.523A2.53 2.53 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.53 2.53 0 0 1 8.834 24a2.53 2.53 0 0 1-2.521-2.522zM8.834 5.042a2.53 2.53 0 0 1-2.521-2.52A2.53 2.53 0 0 1 8.834 0a2.53 2.53 0 0 1 2.521 2.522v2.52zm0 1.271a2.53 2.53 0 0 1 2.521 2.521 2.53 2.53 0 0 1-2.521 2.521H2.522A2.53 2.53 0 0 1 0 8.834a2.53 2.53 0 0 1 2.522-2.521zm10.122 2.521a2.53 2.53 0 0 1 2.522-2.521A2.53 2.53 0 0 1 24 8.834a2.53 2.53 0 0 1-2.522 2.521h-2.522zm-1.268 0a2.53 2.53 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.53 2.53 0 0 1 2.523 2.522zm-2.523 10.122a2.53 2.53 0 0 1 2.523 2.522A2.53 2.53 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.53 2.53 0 0 1-2.522 2.523z" />
            </svg>
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

function getHostname(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SocialPreview({
  provider,
  title,
  description,
  image,
  url,
  variant = "compact",
}: {
  provider: SocialPreviewProvider;
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  variant?: "compact" | "large";
}) {
  const hostname = getHostname(url);
  let card: React.ReactNode | null = null;

  if (provider === "twitter") {
    if (variant === "compact") {
      card = (
        <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#eff3f4] bg-white text-black dark:border-[#2f3336] dark:bg-black dark:text-white">
          <div className="flex items-stretch">
            <div className="relative min-h-[96px] w-24 shrink-0 self-stretch bg-[#f1f5f9] dark:bg-[#0f1419]">
              {image ? (
                <Image
                  src={image}
                  alt="Preview image"
                  width={240}
                  height={240}
                  className="h-full w-full select-none object-cover"
                  draggable={false}
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#64748b] text-[11px] dark:text-[#8b98a5]">
                  <ImageBrokenIcon className="h-5 w-5" aria-hidden />
                  <span className="sr-only">No image</span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 p-3">
              <div className="truncate text-[#536471] text-[11px] leading-4 dark:text-[#8b98a5]">
                {hostname}
              </div>
              <div className="mt-0.5 line-clamp-1 font-semibold text-[15px] leading-5">
                {title || hostname}
              </div>
              {description && (
                <div className="mt-0.5 line-clamp-2 text-[#536471] text-[13px] leading-5 dark:text-[#8b98a5]">
                  {description}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      // Large (summary_large_image) layout
      card = (
        <div className="overflow-hidden rounded-2xl border border-[#eff3f4] bg-white text-black dark:border-[#2f3336] dark:bg-black dark:text-white">
          <div className="relative w-full overflow-hidden bg-[#f1f5f9] dark:bg-[#0f1419]">
            <div className="aspect-[16/9] min-h-[160px] w-full">
              {image ? (
                <Image
                  src={image}
                  alt="Preview image"
                  width={1200}
                  height={675}
                  className="h-full w-full select-none object-cover"
                  draggable={false}
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#64748b] text-[12px] dark:text-[#8b98a5]">
                  <ImageBrokenIcon className="h-5 w-5" aria-hidden />
                  <span className="sr-only">No image</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-3">
            <div className="truncate text-[#536471] text-[11px] leading-4 dark:text-[#8b98a5]">
              {hostname}
            </div>
            <div className="mt-0.5 line-clamp-2 font-semibold text-[15px] leading-5">
              {title || hostname}
            </div>
            {description && (
              <div className="mt-0.5 line-clamp-2 text-[#536471] text-[13px] leading-5 dark:text-[#8b98a5]">
                {description}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  if (provider === "facebook") {
    card = (
      <div className="overflow-hidden rounded-md border border-[#e4e6eb] bg-white text-black dark:border-[#3a3b3c] dark:bg-[#18191a] dark:text-white">
        <div className="relative w-full bg-[#f0f2f5] dark:bg-[#242526]">
          <div className="aspect-[1.91/1] min-h-[150px] w-full">
            {image ? (
              <Image
                src={image}
                alt="Preview image"
                width={1200}
                height={628}
                className="h-full w-full select-none object-cover"
                loading="lazy"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#606770] text-[12px] dark:text-[#b0b3b8]">
                <ImageBrokenIcon className="h-5 w-5" aria-hidden />
                <span className="sr-only">No image</span>
              </div>
            )}
          </div>
        </div>
        <div className="bg-[#f0f2f5] px-4 py-3 dark:bg-[#3a3b3c]">
          <div className="truncate font-medium text-[#606770] text-[11px] uppercase tracking-wide dark:text-[#b0b3b8]">
            {hostname}
          </div>
          <div className="mt-1 line-clamp-2 font-semibold text-[#050505] text-[17px] leading-5 dark:text-[#e4e6eb]">
            {title || hostname}
          </div>
          {description && (
            <div className="mt-1 line-clamp-2 text-[#606770] text-[13px] leading-5 dark:text-[#b0b3b8]">
              {description}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (provider === "linkedin") {
    card = (
      <div className="overflow-hidden border border-[#dde6f2] bg-white text-black dark:border-[#2e3a44] dark:bg-[#1d2226] dark:text-white">
        <div className="relative w-full bg-[#eef3f8] dark:bg-[#0b0f12]">
          <div className="aspect-[1200/627] min-h-[150px] w-full">
            {image ? (
              <Image
                src={image}
                alt="Preview image"
                width={1200}
                height={627}
                className="h-full w-full select-none object-cover"
                draggable={false}
                loading="lazy"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#6e7781] text-[12px] dark:text-[#9aa6b2]">
                <ImageBrokenIcon className="h-5 w-5" aria-hidden />
                <span className="sr-only">No image</span>
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="line-clamp-2 font-semibold text-[#0a66c2] text-[13px] leading-6 dark:text-[#70b5f9]">
            {title || hostname}
          </div>
          <div className="truncate text-[#6e7781] text-[13px] leading-5 dark:text-[#9aa6b2]">
            {hostname}
          </div>
        </div>
      </div>
    );
  }

  if (provider === "slack") {
    // Slack unfurl card: hostname, title (link blue), description, then image.
    card = (
      <div className="relative overflow-hidden rounded-md border border-[#e1e3e6] bg-white p-3 pl-6 text-black dark:border-[#2b2e33] dark:bg-[#1f2329] dark:text-white">
        <div className="absolute top-3 bottom-3 left-3 w-[3px] rounded bg-[#c9ced6] dark:bg-[#3a3f45]" />
        <div className="truncate text-[#4a4e52] text-[12px] leading-4 dark:text-[#b7bfc6]">
          {hostname}
        </div>
        <div className="mt-1 font-semibold text-[#1d9bd1] text-[15px] leading-5 dark:text-[#36c5f0]">
          {title || hostname}
        </div>
        {description && (
          <div className="mt-1 text-[#4a4e52] text-[13px] leading-5 dark:text-[#b7bfc6]">
            {description}
          </div>
        )}
        <div className="mt-3 overflow-hidden rounded-[6px] bg-[#ecebeb] dark:bg-[#393d42]">
          <div className="aspect-[16/9] min-h-[150px] w-full">
            {image ? (
              <Image
                src={image}
                alt="Preview image"
                width={1200}
                height={675}
                className="h-full w-full select-none object-cover"
                draggable={false}
                loading="lazy"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#6b7075] text-[12px] dark:text-[#9aa6b2]">
                <ImageBrokenIcon className="h-5 w-5" aria-hidden />
                <span className="sr-only">No image</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (provider === "discord") {
    // Discord embed-style card: title link blue, description, large rounded image, subtle container.
    card = (
      <div className="rounded-lg border border-[#1f2124] bg-[#2b2d31] p-3 text-white">
        <div className="truncate text-[#b5bac1] text-[12px] leading-4">
          {hostname}
        </div>
        <div className="mt-1 line-clamp-2 font-semibold text-[#58a6ff] text-[16px] leading-5">
          {title || hostname}
        </div>
        {description && (
          <div className="mt-1 line-clamp-3 text-[#dbdee1] text-[13px] leading-5">
            {description}
          </div>
        )}
        <div className="mt-3 overflow-hidden rounded-md bg-[#1f2124]">
          <div className="aspect-[1200/628] min-h-[150px] w-full">
            {image ? (
              <Image
                src={image}
                alt="Preview image"
                width={1200}
                height={628}
                className="h-full w-full select-none object-cover"
                draggable={false}
                loading="lazy"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#99a1ab] text-[12px]">
                <ImageBrokenIcon className="h-5 w-5" aria-hidden />
                <span className="sr-only">No image</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return card ? (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      aria-label={`Open ${hostname} in a new tab`}
      data-slot="social-preview"
      data-provider={provider}
      data-variant={variant}
      className="w-full font-[system-ui]"
    >
      {card}
    </a>
  ) : (
    <div
      className="flex h-48 w-full items-center justify-center rounded-md border text-[#64748b] text-[12px] dark:text-[#8b98a5]"
      data-slot="social-preview"
      data-provider={provider}
      data-variant={variant}
    >
      No preview available.
    </div>
  );
}
