import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  CaretLeftIcon,
  CaretRightIcon,
  DotsThreeIcon,
} from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
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
      role: "navigation",
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
      className: cn("flex items-center gap-1", className),
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
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  useRender.ComponentProps<"a">;

function PaginationLink({
  isActive,
  size = "icon",
  className,
  render,
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      variant={isActive ? "outline" : "ghost"}
      size={size}
      className={className}
      nativeButton={false}
      render={
        <a
          aria-current={isActive ? "page" : undefined}
          data-slot="pagination-link"
          data-active={isActive}
          {...props}
        />
      }
    />
  );
}

function PaginationPrevious({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("pl-2!", className)}
      {...props}
    >
      <CaretLeftIcon aria-hidden />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("pr-2!", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <CaretRightIcon aria-hidden />
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
      className: cn(
        "flex size-9 items-center items-center justify-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className,
      ),
      children: (
        <>
          <DotsThreeIcon className="size-4" aria-hidden />
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
