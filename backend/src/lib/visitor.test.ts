import { describe, expect, it } from "vitest";
import { safeReferrer } from "./visitor.js";

/**
 * The privacy claims in the README are only worth making if they're enforced. These lock in the
 * two that matter: referrers are reduced to an origin, and nothing that could identify a person
 * survives into storage.
 */
describe("safeReferrer", () => {
  it("keeps only the origin, discarding path and query", () => {
    expect(safeReferrer("https://linkedin.com/feed?utm_source=x&token=secret")).toBe(
      "https://linkedin.com",
    );
    expect(safeReferrer("https://news.ycombinator.com/item?id=12345")).toBe(
      "https://news.ycombinator.com",
    );
  });

  it("preserves the port when one is present", () => {
    expect(safeReferrer("http://localhost:5173/some/path")).toBe("http://localhost:5173");
  });

  it("returns null for anything that isn't a usable URL", () => {
    expect(safeReferrer("")).toBeNull();
    expect(safeReferrer("not a url")).toBeNull();
    expect(safeReferrer(undefined)).toBeNull();
    expect(safeReferrer(null)).toBeNull();
    expect(safeReferrer(42)).toBeNull();
  });

  it("never returns a string containing a query string", () => {
    const inputs = [
      "https://example.com/a?b=c",
      "https://example.com/?q=search+terms",
      "https://example.com/path/deep?token=abc#frag",
    ];
    for (const input of inputs) {
      const out = safeReferrer(input);
      expect(out).not.toBeNull();
      expect(out).not.toContain("?");
      expect(out).not.toContain("#");
    }
  });
});
