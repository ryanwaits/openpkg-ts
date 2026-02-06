import type React from 'react';

// ─── Colors ──────────────────────────────────────────────────

const colors = {
  string: 'var(--openpkg-syn-string, #2aa198)',
  number: 'var(--openpkg-syn-number, #b58900)',
  boolean: 'var(--openpkg-syn-boolean, #c9555a)',
  keyword: 'var(--openpkg-syn-keyword, #c9555a)',
  punctuation: 'var(--openpkg-syn-punctuation, #999)',
  tag: 'var(--openpkg-syn-tag, #268bd2)',
  attr: 'var(--openpkg-syn-attr, #b58900)',
  component: 'var(--openpkg-syn-component, #b58900)',
  comment: 'var(--openpkg-syn-comment, #586e75)',
} as const;

function span(key: string, color: string, text: string): React.ReactNode {
  return <span key={key} style={{ color }}>{text}</span>;
}

// ─── JSON ────────────────────────────────────────────────────

const jsonTokenRegex = /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\],])/g;

export function highlightJson(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  jsonTokenRegex.lastIndex = 0;
  while ((match = jsonTokenRegex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(json.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      nodes.push(span(`k${match.index}`, colors.punctuation, match[1]));
      nodes.push(match[2]);
    } else if (match[3]) {
      nodes.push(span(`s${match.index}`, colors.string, match[3]));
    } else if (match[4]) {
      nodes.push(span(`n${match.index}`, colors.number, match[4]));
    } else if (match[5]) {
      nodes.push(span(`b${match.index}`, colors.boolean, match[5]));
    } else if (match[6]) {
      nodes.push(span(`u${match.index}`, colors.keyword, match[6]));
    } else if (match[7]) {
      nodes.push(span(`p${match.index}`, colors.punctuation, match[7]));
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < json.length) {
    nodes.push(json.slice(lastIndex));
  }

  return nodes;
}

// ─── TSX / JSX ───────────────────────────────────────────────

const tsxTokenRegex = new RegExp(
  [
    // Comments: // ... or /* ... */
    String.raw`(\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,
    // JSX tags: <Component or </Component or <div or </div or />
    String.raw`(<\/?)([A-Z][A-Za-z0-9]*|[a-z][a-z0-9-]*)`,
    String.raw`(\/>|>)`,
    // Strings: "..." or '...' or `...`
    String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|` + '`(?:[^`\\\\]|\\\\.)*`)',
    // Keywords
    String.raw`\b(import|export|from|default|function|return|const|let|type|interface|as|if|else|for|of|in|new|typeof|null|undefined|true|false|void)\b`,
    // JSX attribute names (word followed by =)
    String.raw`\b([a-zA-Z_$][a-zA-Z0-9_$]*)(=)`,
    // Numbers
    String.raw`\b(\d+(?:\.\d+)?)\b`,
    // Braces/brackets
    String.raw`([{}()[\];,])`,
  ].join('|'),
  'g',
);

export function highlightTsx(code: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  tsxTokenRegex.lastIndex = 0;
  while ((match = tsxTokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(code.slice(lastIndex, match.index));
    }

    const i = match.index;

    if (match[1]) {
      // Comment
      nodes.push(span(`c${i}`, colors.comment, match[1]));
    } else if (match[2] && match[3]) {
      // JSX tag open/close + component/element name
      const isComponent = /^[A-Z]/.test(match[3]);
      nodes.push(span(`to${i}`, colors.punctuation, match[2]));
      nodes.push(span(`tn${i}`, isComponent ? colors.component : colors.tag, match[3]));
    } else if (match[4]) {
      // Self-close /> or close >
      nodes.push(span(`tc${i}`, colors.punctuation, match[4]));
    } else if (match[5]) {
      // String
      nodes.push(span(`s${i}`, colors.string, match[5]));
    } else if (match[6]) {
      // Keyword
      nodes.push(span(`kw${i}`, colors.keyword, match[6]));
    } else if (match[7] && match[8]) {
      // Attribute name + equals
      nodes.push(span(`an${i}`, colors.attr, match[7]));
      nodes.push(span(`eq${i}`, colors.punctuation, match[8]));
    } else if (match[9]) {
      // Number
      nodes.push(span(`n${i}`, colors.number, match[9]));
    } else if (match[10]) {
      // Punctuation
      nodes.push(span(`p${i}`, colors.punctuation, match[10]));
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < code.length) {
    nodes.push(code.slice(lastIndex));
  }

  return nodes;
}
