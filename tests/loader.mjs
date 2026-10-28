/**
 * Module resolution for `node --test`, so tests need no test framework.
 *
 * Node runs the TypeScript itself (type stripping); this hook only teaches it
 * the two things Next.js normally provides:
 * - the `@/` path alias from tsconfig.json
 * - extensionless relative imports (`./base` → `./base.ts`)
 *
 * Registered by tests/register.mjs; see the `test` script in package.json.
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

function resolveFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(base, `index${ext}`);
    if (existsSync(index)) return index;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let candidate = null;

  if (specifier.startsWith("@/")) {
    candidate = resolveFile(path.join(ROOT, specifier.slice(2)));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:") &&
    !path.extname(specifier)
  ) {
    candidate = resolveFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
  }

  if (candidate) return { url: pathToFileURL(candidate).href, shortCircuit: true };

  try {
    return await next(specifier, context);
  } catch (error) {
    // Next.js ships subpaths such as `next/headers` as CommonJS files with no
    // export map, which Node's ESM resolver will not find without `.js`.
    if (error?.code === "ERR_MODULE_NOT_FOUND" && /^next\/[a-z-/]+$/.test(specifier)) {
      return next(`${specifier}.js`, context);
    }
    throw error;
  }
}
