import { ImageOff } from "lucide-react";
import Image from "next/image";
import type {
  SocialPreviewProvider,
  SocialPreviewVariant,
} from "@/lib/schemas";

export type SocialPreviewProps = {
  provider: SocialPreviewProvider;
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  variant?: SocialPreviewVariant;
};

function getHostname(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SocialPreview({
  provider,
  title,
  description,
  image,
  url,
  variant = "compact",
}: SocialPreviewProps) {
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
                  className="h-full w-full object-cover"
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#64748b] text-[11px] dark:text-[#8b98a5]">
                  <ImageOff className="h-5 w-5" aria-hidden="true" />
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
                  className="h-full w-full object-cover"
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#64748b] text-[12px] dark:text-[#8b98a5]">
                  <ImageOff className="h-5 w-5" aria-hidden="true" />
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
                className="h-full w-full object-cover"
                loading="lazy"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#606770] text-[12px] dark:text-[#b0b3b8]">
                <ImageOff className="h-5 w-5" aria-hidden="true" />
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
                className="h-full w-full object-cover"
                loading="lazy"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#6e7781] text-[12px] dark:text-[#9aa6b2]">
                <ImageOff className="h-5 w-5" aria-hidden="true" />
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
                className="h-full w-full object-cover"
                loading="lazy"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#6b7075] text-[12px] dark:text-[#9aa6b2]">
                <ImageOff className="h-5 w-5" aria-hidden="true" />
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
                className="h-full w-full object-cover"
                loading="lazy"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#99a1ab] text-[12px]">
                <ImageOff className="h-5 w-5" aria-hidden="true" />
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
      className="w-full"
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
