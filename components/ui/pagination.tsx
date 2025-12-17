import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { type ButtonProps, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Pagination({
  className,
  render,
  ...props
}: useRender.ComponentProps<"nav">) {
  return useRender({
    defaultTagName: "nav",
    render,
    props: mergeProps<"nav">(props, {
      "aria-label": "pagination",
      className: cn("mx-auto flex w-full justify-center", className),
    }),
    state: {
      slot: "pagination",
    },
  });
}

function PaginationContent({
  className,
  render,
  ...props
}: useRender.ComponentProps<"ul">) {
  return useRender({
    defaultTagName: "ul",
    render,
    props: mergeProps<"ul">(props, {
      className: cn("flex flex-row items-center gap-1", className),
    }),
    state: {
      slot: "pagination-content",
    },
  });
}

function PaginationItem({ render, ...props }: useRender.ComponentProps<"li">) {
  return useRender({
    defaultTagName: "li",
    render,
    props,
    state: {
      slot: "pagination-item",
    },
  });
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, "size"> &
  useRender.ComponentProps<"a">;

function PaginationLink({
  isActive,
  size = "icon",
  className,
  render,
  ...props
}: PaginationLinkProps) {
  return useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(props, {
      "aria-current": isActive ? "page" : undefined,
      className: cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        className,
      ),
    }),
    state: {
      slot: "pagination-link",
      active: Boolean(isActive),
    },
  });
}

function PaginationPrevious({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  );
}

function PaginationEllipsis({
  className,
  render,
  ...props
}: useRender.ComponentProps<"span">) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(props, {
      "aria-hidden": true,
      className: cn("flex size-9 items-center justify-center", className),
      children: (
        <>
          <MoreHorizontalIcon className="size-4" />
          <span className="sr-only">More pages</span>
        </>
      ),
    }),
    state: {
      slot: "pagination-ellipsis",
    },
  });
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
