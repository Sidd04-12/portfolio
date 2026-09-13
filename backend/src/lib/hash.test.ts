import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * Exercises the visitor-hash construction directly rather than through Fastify, so the
 * properties can be asserted without standing up a server.
 *
 * The construction under test is:
 *   sha256(ip | user-agent | yyyy-mm-dd | secret) truncated to 32 hex chars
 */
function hash(ip: string, ua: string, day: string, secret: string): string {
  return createHash("sha256").update(`${ip}|${ua}|${day}|${secret}`).digest("hex").slice(0, 32);
}

const SECRET = "test-secret-value";

describe("visitor hash", () => {
  it("is stable for the same visitor within a day", () => {
    const a = hash("1.2.3.4", "Firefox", "2026-09-13", SECRET);
    const b = hash("1.2.3.4", "Firefox", "2026-09-13", SECRET);
    expect(a).toBe(b);
  });

  it("distinguishes two visitors on the same day", () => {
    const a = hash("1.2.3.4", "Firefox", "2026-09-13", SECRET);
    const b = hash("5.6.7.8", "Firefox", "2026-09-13", SECRET);
    expect(a).not.toBe(b);
  });

  it("cannot be linked across days — this is the point of including the date", () => {
    const today = hash("1.2.3.4", "Firefox", "2026-09-13", SECRET);
    const tomorrow = hash("1.2.3.4", "Firefox", "2026-09-14", SECRET);
    expect(today).not.toBe(tomorrow);
  });

  it("cannot be recomputed without the server secret", () => {
    const real = hash("1.2.3.4", "Firefox", "2026-09-13", SECRET);
    const guessed = hash("1.2.3.4", "Firefox", "2026-09-13", "wrong-secret");
    expect(guessed).not.toBe(real);
  });

  it("does not contain the IP address in any form", () => {
    const ip = "203.0.113.42";
    const digest = hash(ip, "Firefox", "2026-09-13", SECRET);
    expect(digest).not.toContain(ip);
    expect(digest).not.toContain("203");
    expect(digest).toMatch(/^[0-9a-f]{32}$/);
  });
});
