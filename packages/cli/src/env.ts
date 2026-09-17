import fs from 'node:fs';
import path from 'node:path';

/** dotenv-compatible assignment parser: quotes, export prefix, inline comments. */
export function parseEnvText(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trimStart();
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || /\s/.test(key)) continue;
    let value = line.slice(eq + 1);
    if (value.startsWith(' ') || value.startsWith('\t')) value = value.trimStart();

    if (value.startsWith('"')) {
      let i = 1;
      let parsed = '';
      while (i < value.length) {
        const ch = value[i];
        if (ch === '\\' && i + 1 < value.length) {
          const next = value[i + 1];
          parsed += next === 'n' ? '\n' : next === 'r' ? '\r' : next === 't' ? '\t' : next;
          i += 2;
          continue;
        }
        if (ch === '"') break;
        parsed += ch;
        i++;
      }
      out[key] = parsed;
      continue;
    }
    if (value.startsWith("'")) {
      const end = value.indexOf("'", 1);
      out[key] = end === -1 ? value.slice(1) : value.slice(1, end);
      continue;
    }
    const hash = value.search(/\s+#/);
    out[key] = (hash === -1 ? value : value.slice(0, hash)).trim();
  }
  return out;
}

function parseIfExists(file: string): Record<string, string> {
  try {
    if (!fs.existsSync(file)) return {};
    return parseEnvText(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

/** Load .env then .env.local (local wins). Never override existing process.env. */
export function loadCwdEnv(cwd = process.cwd()): void {
  const parsed = {
    ...parseIfExists(path.join(cwd, '.env')),
    ...parseIfExists(path.join(cwd, '.env.local')),
  };
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
