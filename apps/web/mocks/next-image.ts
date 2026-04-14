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

function toImgProps({
  blurDataURL: _blurDataURL,
  fill: _fill,
  loader: _loader,
  placeholder: _placeholder,
  priority: _priority,
  quality: _quality,
  unoptimized: _unoptimized,
  ...props
}: NextImageMockProps): ComponentProps<"img"> {
  return props;
}

export default function NextImageMock(props: NextImageMockProps) {
  return createElement("img", toImgProps(props));
}

export function getImageProps(props: NextImageMockProps) {
  return { props: toImgProps(props) };
}
