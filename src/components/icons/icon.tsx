import { splitProps, type ComponentProps } from "solid-js";

import { cn } from "~/lib/utils";

export type IconProps = ComponentProps<"svg">;

export const Icon = (props: IconProps) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <svg
      stroke="currentColor"
      stroke-width="1"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={cn("size-4", props.class)}
      {...rest}
    />
  );
};
