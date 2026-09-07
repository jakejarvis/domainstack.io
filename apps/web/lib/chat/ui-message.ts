import type { InferUITools, Tool, UIMessage } from "ai";

import type { DOMAIN_TOOL_DEFS, DomainToolInput, DomainToolResult } from "./domain-tools";

export type DomainToolSet = {
  [Def in (typeof DOMAIN_TOOL_DEFS)[number] as Def["name"]]: Tool<
    DomainToolInput,
    DomainToolResult<Def["procedure"]>
  >;
};

export type DomainChatUIMessage = UIMessage<never, never, InferUITools<DomainToolSet>>;
