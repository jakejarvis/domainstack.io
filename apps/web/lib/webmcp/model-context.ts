/**
 * Minimal typings and access for WebMCP (https://webmachinelearning.github.io/webmcp/).
 * The browser API is not in `lib.dom` yet.
 */

type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
};

export type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>, options: { signal?: AbortSignal }) => Promise<unknown>;
  annotations?: WebMcpToolAnnotations;
};

export type ModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<undefined>;
};

/**
 * The spec puts `modelContext` on `document`. Early Chrome builds and some
 * write-ups use `navigator.modelContext`, so it's only a trailing fallback.
 */
export function getModelContext(): ModelContext | undefined {
  const fromDocument = (document as Document & { modelContext?: ModelContext }).modelContext;
  if (fromDocument) return fromDocument;
  return (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
}
