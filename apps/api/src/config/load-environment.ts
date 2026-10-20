import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Load the first .env file found between the API package and the workspace
 * root. Values supplied by the host always take precedence.
 */
export function loadEnvironment(): void {
  const candidates = [
    process.env.ENV_FILE,
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
    resolve(process.cwd(), '..', '..', '.env'),
  ].filter((path): path is string => Boolean(path));

  const envFile = candidates.find((path) => existsSync(path));
  if (!envFile) return;

  for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
