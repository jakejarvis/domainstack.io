"use client";

import {
  MediaControlBar,
  MediaController,
  MediaMuteButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import { cn } from "@/lib/utils";

const variables = {
  "--media-primary-color": "var(--primary)",
  "--media-secondary-color": "var(--background)",
  "--media-text-color": "var(--foreground)",
  "--media-background-color": "var(--background)",
  "--media-control-hover-background": "var(--accent)",
  "--media-font-family": "var(--font-sans)",
  "--media-live-button-icon-color": "var(--muted-foreground)",
  "--media-live-button-indicator-color": "var(--destructive)",
  "--media-range-track-background": "var(--border)",
} as React.CSSProperties;

function VideoPlayer({
  style,
  ...props
}: React.ComponentProps<typeof MediaController>) {
  return (
    <MediaController
      style={{
        ...variables,
        ...style,
      }}
      {...props}
    />
  );
}

function VideoPlayerControlBar(
  props: React.ComponentProps<typeof MediaControlBar>,
) {
  return <MediaControlBar {...props} />;
}

function VideoPlayerTimeRange({
  className,
  ...props
}: React.ComponentProps<typeof MediaTimeRange>) {
  return <MediaTimeRange className={cn("p-2.5", className)} {...props} />;
}

function VideoPlayerTimeDisplay({
  className,
  ...props
}: React.ComponentProps<typeof MediaTimeDisplay>) {
  return <MediaTimeDisplay className={cn("p-2.5", className)} {...props} />;
}

function VideoPlayerVolumeRange({
  className,
  ...props
}: React.ComponentProps<typeof MediaVolumeRange>) {
  return <MediaVolumeRange className={cn("p-2.5", className)} {...props} />;
}

function VideoPlayerPlayButton({
  className,
  ...props
}: React.ComponentProps<typeof MediaPlayButton>) {
  return <MediaPlayButton className={cn("p-2.5", className)} {...props} />;
}

function VideoPlayerSeekBackwardButton({
  className,
  ...props
}: React.ComponentProps<typeof MediaSeekBackwardButton>) {
  return (
    <MediaSeekBackwardButton className={cn("p-2.5", className)} {...props} />
  );
}

function VideoPlayerSeekForwardButton({
  className,
  ...props
}: React.ComponentProps<typeof MediaSeekForwardButton>) {
  return (
    <MediaSeekForwardButton className={cn("p-2.5", className)} {...props} />
  );
}

function VideoPlayerMuteButton({
  className,
  ...props
}: React.ComponentProps<typeof MediaMuteButton>) {
  return <MediaMuteButton className={cn("p-2.5", className)} {...props} />;
}

function VideoPlayerContent({
  className,
  ...props
}: React.ComponentProps<"video">) {
  return <video className={cn("mt-0 mb-0", className)} {...props} />;
}

export {
  VideoPlayer,
  VideoPlayerControlBar,
  VideoPlayerTimeRange,
  VideoPlayerTimeDisplay,
  VideoPlayerVolumeRange,
  VideoPlayerPlayButton,
  VideoPlayerSeekBackwardButton,
  VideoPlayerSeekForwardButton,
  VideoPlayerMuteButton,
  VideoPlayerContent,
};
