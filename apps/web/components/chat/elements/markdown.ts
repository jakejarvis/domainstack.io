import { defaultRehypePlugins } from "streamdown";

/**
 * Model output can be steered by third-party text (tool results), so chat markdown
 * renders no raw HTML and no media: an <img> would load without a click and can
 * carry conversation text to any host. Links keep Streamdown's link-safety modal.
 */
export const CHAT_REHYPE_PLUGINS = [defaultRehypePlugins.sanitize, defaultRehypePlugins.harden];

export const CHAT_DISALLOWED_ELEMENTS = [
  "img",
  "picture",
  "source",
  "video",
  "audio",
  "iframe",
  "object",
  "embed",
  "svg",
] as const;
