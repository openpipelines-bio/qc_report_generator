import {
  createMemo,
  type Component,
  type JSXElement,
  type ParentComponent,
} from "solid-js";
import { HeadLineIcon } from "~/components/icons/icon-headline";
import { Text } from "~/components/text";

export const headingLink = (children: JSXElement) =>
  children?.toString().toLowerCase().replaceAll(" ", "-").replaceAll(",", "");

const HeadlineLink: Component<{
  link: string;
  children: JSXElement;
}> = (props) => {
  return (
    <a href={props.link} class="group flex items-center gap-1">
      <span id="heading-text">{props.children}</span>
      <HeadLineIcon class="hidden size-[.65em] group-hover:inline-block" />
    </a>
  );
};

export const H1: ParentComponent = (props) => (
  <Text
    as="h1"
    size="4xl"
    weight="bold"
    id={headingLink(props.children)}
    class="mb-8 mt-8 scroll-mt-16"
  >
    <HeadlineLink link={`#${headingLink(props.children)}`}>
      {props.children}
    </HeadlineLink>
  </Text>
);

export const H2: ParentComponent = (props) => (
  <Text
    as="h2"
    size="2xl"
    weight="bold"
    id={headingLink(props.children)}
    class="mb-6 mt-6 scroll-mt-10"
  >
    <HeadlineLink link={`#${headingLink(props.children)}`}>
      {props.children}
    </HeadlineLink>
  </Text>
);

export const H3: ParentComponent = (props) => (
  <Text
    as="h3"
    size="lg"
    weight="semibold"
    id={headingLink(props.children)}
    class="mb-4 mt-4 scroll-mt-10"
  >
    <HeadlineLink link={`#${headingLink(props.children)}`}>
      {props.children}
    </HeadlineLink>
  </Text>
);

// export const H4: ParentComponent = props => (
//   <Text
//     variant="body-sm"
//     as="h4"
//     id={headingLink(props.children)}
//     class="mb-3 mt-6 scroll-mt-12" // Slightly reduced margins for lower-level heading
//   >
//     <HeadlineLink link={`#${headingLink(props.children)}`}>
//       {props.children}
//     </HeadlineLink>
//   </Text>
// );

// export const H5: ParentComponent = props => (
//   <Text
//     variant="body-sm"
//     as="h5"
//     id={headingLink(props.children)}
//     class="mb-2 mt-4 scroll-mt-12" // Compact margins for detail headings
//   >
//     <HeadlineLink link={`#${headingLink(props.children)}`}>
//       {props.children}
//     </HeadlineLink>
//   </Text>
// );

// export const H6: ParentComponent = props => (
//   <Text
//     variant="docs-heading-6"
//     as="h6"
//     id={headingLink(props.children)}
//     class="mb-2 mt-4 scroll-mt-12" // Same as H5 for consistency
//   >
//     <HeadlineLink link={`#${headingLink(props.children)}`}>
//       {props.children}
//     </HeadlineLink>
//   </Text>
// );

export const P: ParentComponent = (props) => (
  <p class="mb-6 mt-4 leading-relaxed first-of-type:mt-6">{props.children}</p>
);

export const UL: ParentComponent = (props) => (
  <ul class="mb-6 ml-4 mt-2 list-disc">{props.children}</ul>
);

export const OL: ParentComponent = (props) => (
  <ol class="mb-6 ml-4 mt-2 list-decimal">{props.children}</ol>
);

export const LI: ParentComponent = (props) => (
  <li class="mb-2 ml-4">{props.children}</li>
);

export const A: ParentComponent<{ href: string }> = (props) => {
  const isLocal = createMemo(() =>
    ["/", "./", "#"].some((s) => props.href.startsWith(s)),
  );

  return (
    <a
      href={props.href}
      target={isLocal() ? "" : "_blank"}
      class="text-accent underline underline-offset-2 transition-colors hover:text-accent/80 hover:underline-offset-4"
    >
      {props.children}
    </a>
  );
};

export const Blockquote: ParentComponent = (props) => (
  <div class="my-8 ml-4 border-l-2 border-accent pl-6">
    <Text as="blockquote" size="lg" class="text-accent">
      {props.children}
    </Text>
  </div>
);
