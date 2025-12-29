"use client";

import { Bug } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { REPOSITORY_SLUG } from "@/lib/constants/app";
import { cn } from "@/lib/utils";

type ErrorWithOptionalDigest = Error & { digest?: string };

type CreateIssueButtonProps = {
  error?: ErrorWithOptionalDigest;
  className?: string;
} & Pick<React.ComponentProps<typeof Button>, "variant" | "size">;

function buildIssueUrl(error?: ErrorWithOptionalDigest) {
  const message = error?.message?.trim() || "Unexpected error";
  const digest = error && "digest" in error ? error.digest : undefined;

  const shortMessage =
    message.length > 80 ? `${message.slice(0, 77)}…` : message;
  const titleParts = ["Bug:", shortMessage];
  if (digest) titleParts.push(`(id: ${digest})`);
  const title = titleParts.join(" ");

  const url = new URL(`https://github.com/${REPOSITORY_SLUG}/issues/new`);
  url.searchParams.set("labels", "bug");
  url.searchParams.set("title", title);

  const lines: string[] = [];
  lines.push("### Description");
  lines.push("");
  lines.push("Describe what you were doing when the error occurred.");
  lines.push("");
  lines.push("### Environment");
  lines.push("");
  if (typeof window !== "undefined") {
    lines.push(`- URL: ${window.location.href}`);
  }
  if (typeof navigator !== "undefined") {
    lines.push(`- Browser: ${navigator.userAgent}`);
  }
  lines.push(`- Time: ${new Date().toISOString()}`);
  if (digest) {
    lines.push(`- Error id: ${digest}`);
  }
  lines.push("");
  lines.push("### Error");
  lines.push("");
  lines.push(`- Message: ${message}`);
  if (error?.stack) {
    lines.push("");
    lines.push("<details><summary>Stack trace</summary>\n\n");
    lines.push("```text");
    lines.push(error.stack);
    lines.push("```");
    lines.push("\n</details>");
  }

  url.searchParams.set("body", lines.join("\n"));
  return url.toString();
}

export function CreateIssueButton(props: CreateIssueButtonProps) {
  const { error, className, variant = "outline", size = "default" } = props;

  const issueUrl = useMemo(() => buildIssueUrl(error), [error]);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("cursor-pointer leading-none", className)}
      nativeButton={false}
      render={
        <a href={issueUrl} target="_blank" rel="noopener">
          <Bug />
          Create GitHub issue
        </a>
      }
    />
  );
}

export default CreateIssueButton;
