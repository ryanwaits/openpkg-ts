'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export interface MethodSectionProps {
  /** Section ID for scroll sync */
  id: string;
  /** Method title (e.g., "Fetch data") */
  title: string;
  /** Method signature (e.g., "select(columns?, options?)") */
  signature?: string;
  /** Method description */
  description?: ReactNode;
  /** Bullet list notes */
  notes?: string[];
  /** Parameter content */
  children?: ReactNode;
  /** Custom className */
  className?: string;
  /** Register with sync scroll (if using SyncScrollProvider) */
  registerSection?: (id: string, ref: React.RefObject<HTMLElement | null>) => void;
  /** Unregister from sync scroll */
  unregisterSection?: (id: string) => void;
}

/**
 * Container for a single API method in the documentation.
 */
export function MethodSection({
  id,
  title,
  signature,
  description,
  notes,
  children,
  className,
  registerSection,
  unregisterSection,
}: MethodSectionProps): ReactNode {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (registerSection && ref.current) {
      registerSection(id, ref);
      return () => unregisterSection?.(id);
    }
  }, [id, registerSection, unregisterSection]);

  return (
    <section
      ref={ref}
      id={id}
      data-section={id}
      className={`openpkg-method-section mb-20 last:mb-0 ${className || ''}`}
    >
      <h2 className="text-2xl font-semibold tracking-tight text-[#ededed] mb-4">{title}</h2>

      {signature && (
        <code className="block font-mono text-sm text-[#666666] mb-6">{signature}</code>
      )}

      {description && (
        <div className="openpkg-method-description text-[15px] leading-relaxed text-[#a0a0a0] mb-6">
          {typeof description === 'string' ? <p>{description}</p> : description}
        </div>
      )}

      {notes && notes.length > 0 && (
        <ul className="list-disc list-inside text-[15px] leading-relaxed text-[#a0a0a0] mb-8 space-y-2">
          {notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}

      {children && (
        <div className="openpkg-method-params">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#666666] mb-4 pb-2 border-b border-[#262626]">
            Parameters
          </h3>
          {children}
        </div>
      )}
    </section>
  );
}
