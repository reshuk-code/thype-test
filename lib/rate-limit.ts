import "server-only";

import { headers } from "next/headers";

/**
 * Fixed-window rate limiting for the public forms.
 *
 * In memory, per process. That is exact for the Docker deployment this project
 * ships (one app container) and approximate anywhere with several instances,
 * where each keeps its own count — a deliberate trade against adding Redis for
 * two forms. Move the counter into the database or a shared cache before
 * scaling out. The honeypots on both forms still catch the crude bots first.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Above this many tracked keys, expired windows are swept on the next hit. */
const SWEEP_THRESHOLD = 5000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Records one attempt for `key` and reports whether it is within `limit`
 * attempts per `windowMs`. Pure apart from the shared map, so it is testable.
 */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (windows.size > SWEEP_THRESHOLD) sweep(now);

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  current.count += 1;
  return current.count <= limit;
}

/**
 * The visitor's address as the reverse proxy reports it.
 *
 * `x-forwarded-for` is only trustworthy behind a proxy that overwrites it, as
 * the production nginx in front of the container does; without one a client
 * can rotate the header to dodge the limit. That weakens throttling, never
 * access control, so it is acceptable here.
 */
export async function clientAddress(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || "unknown";
}

/** Convenience: limit one named form for the current visitor. */
export async function allowSubmission(
  form: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  return hit(`${form}:${await clientAddress()}`, limit, windowMs);
}
