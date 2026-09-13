import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "./env.js";

/**
 * Produces a pseudonymous per-day visitor identifier.
 *
 * The inputs are the client IP, the user agent, a server-side secret, and today's date. The IP
 * is used but never stored — only this digest is, truncated to 128 bits.
 *
 * Two properties matter:
 *
 * 1. **Not reversible in practice.** Without VISITOR_HASH_SECRET an attacker who somehow got the
 *    database still can't confirm "was this person here", because they can't recompute the hash.
 * 2. **Not linkable across days.** The date is part of the input, so the same visitor produces a
 *    completely different hash tomorrow. That makes "unique visitors today" answerable and
 *    "follow this person over time" impossible — which is the trade I want.
 *
 * The cost is that a cross-day unique count isn't available. For a portfolio, knowing daily
 * uniques is plenty, and it isn't worth building a tracking profile to get a slightly better
 * number.
 */
export function visitorHash(req: FastifyRequest): string {
  const ip = clientIp(req);
  const ua = req.headers["user-agent"] ?? "unknown";
  const day = new Date().toISOString().slice(0, 10);

  return createHash("sha256")
    .update(`${ip}|${ua}|${day}|${env.VISITOR_HASH_SECRET}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Render and Vercel both sit behind proxies, so the socket address is the proxy's. Trust the
 * left-most entry of x-forwarded-for, which is the original client.
 */
export function clientIp(req: FastifyRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]!.split(",")[0]!.trim();
  }
  return req.ip;
}

/**
 * Keeps only the origin of a referrer. Full URLs can carry query strings with search terms or
 * tokens, none of which is any of this application's business.
 */
export function safeReferrer(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}
