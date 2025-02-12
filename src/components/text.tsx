import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import { JSX, ValidComponent, children, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export const textStyle = cva("font-dm", {
  variants: {
    size: {
      "4xl": "text-4xl",
      "3xl": "text-3xl",
      "2xl": "text-2xl",
      xl: "text-xl",
      lg: "text-lg",
      md: "text-md",
      sm: "text-sm",
      xs: "text-xs",
    },
    weight: {
      thin: "font-thin",
      extralight: "font-extralight",
      light: "font-light",
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
      extrabold: "font-extrabold",
      black: "font-black",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
    fullWidth: {
      true: "w-full",
    },
  },
  defaultVariants: {
    size: "md",
    align: "left",
    weight: "normal",
  },
});

export type TextStyleProps = VariantProps<typeof textStyle>;

export type DOMElements = keyof JSX.IntrinsicElements;

export type TextProps<Tag extends ValidComponent> = {
  as?: Tag;
} & TextStyleProps &
  JSX.InsHTMLAttributes<Tag>;

export type TextTags =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "span"
  | "div"
  | "label"
  | "small"
  | "strong"
  | "blockquote";

export function Text<Tag extends TextTags>(props: TextProps<Tag>) {
  const [local, rest] = splitProps(props, [
    "as",
    "size",
    "align",
    "class",
    "children",
    "weight",
    "fullWidth",
  ]);
  const tag = children(() => local.as);

  return (
    <Dynamic
      class={clsx(
        textStyle({
          size: local.size,
          align: local.align,
          weight: local.weight,
          fullWidth: local.fullWidth,
        }),
        local.class,
      )}
      component={tag() ? (tag() as ValidComponent) : ("p" as ValidComponent)}
      {...rest}
    >
      {local.children}
    </Dynamic>
  );
}
