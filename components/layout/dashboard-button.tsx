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
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard" className="cursor-pointer">
            <Table2 />
            <span className="sr-only">Dashboard</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Dashboard</TooltipContent>
    </Tooltip>
  );
}
