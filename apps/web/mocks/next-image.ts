import { type ComponentProps, createElement } from "react";

type NextImageMockProps = ComponentProps<"img"> & {
  blurDataURL?: string;
  fill?: boolean;
  loader?: unknown;
  placeholder?: string;
  priority?: boolean;
  quality?: number | `${number}`;
  unoptimized?: boolean;
};

export default function NextImageMock({
  blurDataURL: _blurDataURL,
  fill: _fill,
  loader: _loader,
  placeholder: _placeholder,
  priority: _priority,
  quality: _quality,
  unoptimized: _unoptimized,
  ...props
}: NextImageMockProps) {
  return createElement("img", props);
}

export function getImageProps({ props }: { props: NextImageMockProps }) {
  return { props };
}
