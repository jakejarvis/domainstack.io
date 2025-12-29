import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { getImageProps } from "next/image";
import { cn } from "@/lib/utils";

function Avatar({ className, ...props }: AvatarPrimitive.Root.Props) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  src,
  alt,
  size = 32,
  className,
  ...props
}: Omit<AvatarPrimitive.Image.Props, "width" | "height"> & { size?: number }) {
  const { props: imageProps } = getImageProps({
    src: src as string,
    alt: alt ?? "User avatar",
    width: size,
    height: size,
    loading: "eager",
    draggable: false,
    ...props,
  });

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full select-none", className)}
      {...imageProps}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
