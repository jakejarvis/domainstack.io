import {
  IconArchive,
  IconBell,
  IconBellOff,
  IconBookmark,
  IconCircleDashedCheck,
  IconDotsVertical,
  IconExternalLink,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";

import { useDashboardActions } from "@/context/dashboard-context";
import { addDomainResumeHref } from "@/lib/add-domain-resume";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";

/** Per-domain actions menu shared by the dashboard grid cards and table rows. */
export function DomainActionsMenu({
  domain,
  triggerVariant,
}: {
  domain: Pick<
    TrackedDomainWithDetails,
    "id" | "domainName" | "verified" | "verificationMethod" | "muted"
  >;
  triggerVariant: "ghost" | "outline";
}) {
  const { onMute, onArchive, onRemove } = useDashboardActions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant={triggerVariant} size="icon-sm">
            <IconDotsVertical />
            <span className="sr-only">Actions</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem
          nativeButton={false}
          render={
            <a href={`https://${domain.domainName}`} target="_blank" rel="noopener noreferrer">
              <IconExternalLink />
              Open
            </a>
          }
        />
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href={`/${encodeURIComponent(domain.domainName)}`}>
              <IconBookmark />
              View Report
            </Link>
          }
        />
        {!domain.verified ? (
          <DropdownMenuItem
            nativeButton={false}
            render={
              <Link href={addDomainResumeHref(domain.id, domain.verificationMethod)}>
                <IconCircleDashedCheck />
                Continue verification
              </Link>
            }
          />
        ) : null}
        <DropdownMenuSeparator />
        {domain.verified ? (
          <DropdownMenuItem onClick={() => onMute(domain.id, !domain.muted)}>
            {domain.muted ? (
              <>
                <IconBell />
                Unmute
              </>
            ) : (
              <>
                <IconBellOff />
                Mute
              </>
            )}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => onArchive(domain.id)}>
          <IconArchive />
          Archive
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRemove(domain.id)}>
          <IconTrash className="text-danger-foreground" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
