"use client";

import { Table2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Dashboard button that appears in the header when user is signed in.
 * Visible on all screen sizes.
 */
export function DashboardButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link href="/dashboard">
                <Table2 />
                <span className="sr-only">Dashboard</span>
              </Link>
            }
          />
        }
      />
      <TooltipContent>Dashboard</TooltipContent>
    </Tooltip>
  );
}
