'use client';

import { formatSchema } from '@openpkg-ts/sdk/browser';
import type { OpenPkg, SpecExport, SpecSignatureParameter } from '@openpkg-ts/spec';
import type { ReactNode } from 'react';

export interface FunctionSectionProps {
  export: SpecExport;
  spec: OpenPkg;
  className?: string;
  /** Custom parameter row renderer */
  renderParam?: (param: SpecSignatureParameter, index: number) => ReactNode;
  /** Custom code example renderer */
  renderExample?: (code: string, lang: string) => ReactNode;
}

/**
 * Headless function documentation section.
 * Renders parameters, returns, throws, and type parameters.
 *
 * @example
 * ```tsx
 * <FunctionSection export={fn} spec={spec} />
 * ```
 */
export function FunctionSection({
  export: exp,
  spec,
  className,
  renderParam,
  renderExample,
}: FunctionSectionProps): ReactNode {
  const sig = exp.signatures?.[0];
  const params = sig?.parameters ?? [];
  const hasParams = params.length > 0;
  const hasReturns = !!sig?.returns;
  const hasThrows = sig?.throws && sig.throws.length > 0;
  const hasTypeParams = exp.typeParameters && exp.typeParameters.length > 0;

  // Build import statement
  const pkgName = spec.meta.name;
  const importStatement = `import { ${exp.name} } from '${pkgName}';`;

  // Build example code
  const exampleCode =
    exp.examples?.[0] && typeof exp.examples[0] !== 'string'
      ? exp.examples[0].code
      : `${importStatement}\n\n${exp.name}(${params.map((p) => p.name).join(', ')})`;

  return (
    <section className={className} data-component="function-section" data-export={exp.name}>
      {/* Header */}
      <header data-slot="header">
        <h2 data-slot="title">{exp.name}()</h2>
        {exp.description && <p data-slot="description">{exp.description}</p>}
        <code data-slot="import">{importStatement}</code>
      </header>

      {/* Parameters */}
      {hasParams && (
        <div data-slot="parameters">
          <h3>Parameters</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {params.map((param, index) =>
                renderParam ? (
                  renderParam(param, index)
                ) : (
                  <tr key={param.name ?? index} data-required={param.required}>
                    <td>
                      <code>{param.name}</code>
                      {param.required === false && <span data-badge="optional">?</span>}
                      {param.rest && <span data-badge="rest">...</span>}
                    </td>
                    <td>
                      <code>{formatSchema(param.schema)}</code>
                    </td>
                    <td>{param.description}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Returns */}
      {hasReturns && (
        <div data-slot="returns">
          <h3>Returns</h3>
          <p>
            <code>{formatSchema(sig.returns?.schema)}</code>
            {sig.returns?.description && <span> — {sig.returns?.description}</span>}
          </p>
        </div>
      )}

      {/* Throws */}
      {hasThrows && (
        <div data-slot="throws">
          <h3>Throws</h3>
          <ul>
            {sig.throws?.map((t, i) => (
              <li key={i}>
                {t.type && <code>{t.type}</code>}
                {t.type && t.description && ' — '}
                {t.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Type Parameters */}
      {hasTypeParams && (
        <div data-slot="type-parameters">
          <h3>Type Parameters</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Constraint</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {exp.typeParameters?.map((tp) => (
                <tr key={tp.name}>
                  <td>
                    <code>{tp.name}</code>
                  </td>
                  <td>{tp.constraint && <code>{tp.constraint}</code>}</td>
                  <td>{tp.default && <code>{tp.default}</code>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Example */}
      <div data-slot="example">
        <h3>Example</h3>
        {renderExample ? (
          renderExample(exampleCode, 'typescript')
        ) : (
          <pre>
            <code>{exampleCode}</code>
          </pre>
        )}
      </div>
    </section>
  );
}
