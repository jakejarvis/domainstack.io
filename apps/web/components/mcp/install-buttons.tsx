import Image from "next/image";

import { VSCodeIcon } from "@/components/mcp/brand-icons";
import { CURSOR_DEEPLINK, VSCODE_DEEPLINK } from "@/lib/mcp";

export function CursorInstallButton() {
  return (
    <p className="mb-4 flex justify-center text-center">
      <a href={CURSOR_DEEPLINK} data-disable-progress>
        <Image
          src="https://cursor.com/deeplink/mcp-install-light.svg"
          alt="Add domainstack MCP server to Cursor"
          width={128}
          height={32}
        />
      </a>
    </p>
  );
}

export function VSCodeInstallButton() {
  return (
    <p className="mb-4 flex justify-center text-center">
      <a
        href={VSCODE_DEEPLINK}
        className="inline-flex items-center gap-2 rounded-md bg-[#0066b8] p-3 leading-none font-medium text-white !no-underline transition-colors hover:bg-[#005ba4] hover:!text-white"
        data-disable-progress
      >
        <VSCodeIcon className="inline-block size-4" />
        Install in VS Code
      </a>
    </p>
  );
}
