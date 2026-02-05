import type { CodeHikeConfig } from 'codehike/mdx';

export type CodeOptions = {
  copyButton?: boolean;
  lineNumbers?: boolean;
  wordWrap?: boolean;
  animate?: boolean;
};

export type CodeInfo = {
  storage?: string;
  options: CodeOptions;
  tabs: {
    options: CodeOptions;
    title: string;
    code: string;
    pre: React.ReactNode;
    icon: React.ReactNode;
    lang: string;
  }[];
};

export const theme = 'github-from-css';

/** Standard className for Pre/code block containers */
export const PRE_CLASSNAME =
  'overflow-auto px-0 py-3 m-0 rounded-none !bg-openpkg-code-bg selection:bg-openpkg-code-selection selection:text-current max-h-full flex-1';

export const chConfig: CodeHikeConfig = {
  components: {
    code: 'DocsKitCode',
    inlineCode: 'DocsKitInlineCode',
  },
};

/**
 * Convert flags string to options object.
 *
 * @example
 * flagsToOptions("na") // { lineNumbers: true, animate: true }
 * flagsToOptions("c") // { copyButton: true }
 */
export function flagsToOptions(flags: string = ''): CodeOptions {
  const options: CodeOptions = {};
  const map = {
    c: 'copyButton',
    n: 'lineNumbers',
    w: 'wordWrap',
    a: 'animate',
  } as const;
  flags.split('').forEach((flag) => {
    if (!flag) return; // Skip empty strings
    if (flag in map) {
      const key = map[flag as keyof typeof map];
      options[key] = true;
    } else {
      console.warn(`Unknown flag: ${flag}`);
    }
  });
  return options;
}

/**
 * Extracts flags and title from code block metadata.
 *
 * @example
 * extractFlags({ meta: "foo.js -abc" }) // { title: "foo.js", flags: "abc" }
 * extractFlags({ meta: "-c" }) // { title: "", flags: "c" }
 */
export function extractFlags(codeblock: { meta: string }): { title: string; flags: string } {
  const meta = codeblock.meta || '';
  const flagToken = meta.split(' ').find((token) => token.startsWith('-')) ?? '';
  const metaWithoutFlags = !flagToken
    ? meta
    : meta === flagToken
      ? ''
      : meta.replace(` ${flagToken}`, '').trim();
  const title = metaWithoutFlags.trim();
  return { title, flags: flagToken.slice(1) };
}

/**
 * Extracts only flags from code block metadata (no title).
 *
 * @example
 * extractFlagsOnly({ meta: "foo.js -abc" }) // "abc"
 * extractFlagsOnly({ meta: "-c" }) // "c"
 */
export function extractFlagsOnly(codeblock: { meta: string }): string {
  const meta = codeblock.meta || '';
  const flagToken = meta.split(' ').find((token) => token.startsWith('-'));
  return flagToken ? flagToken.slice(1) : '';
}
