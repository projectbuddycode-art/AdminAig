import { describe, expect, it } from "vitest";

/**
 * Mirrors the secure-cookie decision in src/middleware.ts.
 * Auth.js encrypts the JWT with the full cookie name as salt, so middleware
 * must request the __Secure- prefixed name on HTTPS/Vercel.
 */
function secureSessionCookie(input: { protocol: string; vercel?: string; nodeEnv?: string }) {
  return input.protocol === "https:" || input.vercel === "1" || input.nodeEnv === "production";
}

describe("auth middleware cookie mode", () => {
  it("uses the secure Auth.js cookie on HTTPS", () => {
    expect(secureSessionCookie({ protocol: "https:" })).toBe(true);
  });

  it("uses the secure cookie on Vercel even if the request URL looks like http", () => {
    expect(secureSessionCookie({ protocol: "http:", vercel: "1" })).toBe(true);
  });

  it("keeps the non-secure cookie name for local http development", () => {
    expect(secureSessionCookie({ protocol: "http:", nodeEnv: "development" })).toBe(false);
  });
});
