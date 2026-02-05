'use client';

import type * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ClientDocsKitCode } from '../code.client-highlight';
import { type Language, LanguageSelector } from './language-selector';

export interface CodeExample {
  /** Language identifier */
  languageId: string;
  /** Code content */
  code: string;
  /** Optional syntax highlighting language (defaults to languageId) */
  highlightLang?: string;
}

export interface APICodePanelProps {
  /** Available languages for the selector */
  languages: Language[];
  /** Code examples keyed by language id */
  examples: CodeExample[];
  /** Optional external link (e.g., to API playground) */
  externalLink?: string;
  /** Optional title shown in header */
  title?: string;
  /** Custom className */
  className?: string;
}

/**
 * Right-side sticky code panel for API documentation.
 * Features language dropdown and syntax highlighting via docskit.
 */
export function APICodePanel({
  languages,
  examples,
  externalLink: _externalLink,
  title,
  className,
}: APICodePanelProps): React.ReactNode {
  const [selectedLang, setSelectedLang] = useState(examples[0]?.languageId ?? languages[0]?.id);

  const currentExample = examples.find((e) => e.languageId === selectedLang);
  const code = currentExample?.code ?? '';
  const lang = currentExample?.highlightLang ?? currentExample?.languageId ?? 'txt';

  const metaTitle = title ?? '';
  const meta = metaTitle ? `${metaTitle} -c` : '-c';

  return (
    <div className={cn('sticky top-20', className)}>
      {languages.length > 1 && (
        <div className="flex items-center gap-2 mb-2">
          <LanguageSelector languages={languages} value={selectedLang} onChange={setSelectedLang} />
        </div>
      )}
      <ClientDocsKitCode
        codeblock={{
          value: code,
          lang: lang === 'curl' ? 'bash' : lang,
          meta,
        }}
      />
    </div>
  );
}
