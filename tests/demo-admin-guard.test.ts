import { afterEach, describe, expect, it } from "vitest";
import { assertDemoBootstrapAllowed, demoAdminCredentials } from "../prisma/demo-admin";

const KEYS = ["VERCEL", "NEXT_PHASE", "DEMO_TENANT_ENABLED", "DEMO_ADMIN_EMAIL", "DEMO_ADMIN_PASSWORD"] as const;
const previous: Record<string, string | undefined> = {};

function saveEnv() {
  for (const key of KEYS) previous[key] = process.env[key];
}

function restoreEnv() {
  for (const key of KEYS) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}

describe("demo administrator bootstrap guards", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("requires the demo tenant flag and refuses to run on Vercel", () => {
    saveEnv();
    delete process.env.VERCEL;
    delete process.env.NEXT_PHASE;
    process.env.DEMO_TENANT_ENABLED = "false";
    expect(() => assertDemoBootstrapAllowed()).toThrow(/DEMO_TENANT_ENABLED/);

    process.env.DEMO_TENANT_ENABLED = "true";
    process.env.VERCEL = "1";
    expect(() => assertDemoBootstrapAllowed()).toThrow(/does not run on Vercel/);
  });

  it("rejects a missing password without echoing a secret", () => {
    saveEnv();
    delete process.env.VERCEL;
    delete process.env.NEXT_PHASE;
    process.env.DEMO_TENANT_ENABLED = "true";
    process.env.DEMO_ADMIN_EMAIL = "projectbuddy.code@gmail.com";
    process.env.DEMO_ADMIN_PASSWORD = "short";
    expect(() => demoAdminCredentials()).toThrow(/at least 12 characters/);
    try {
      demoAdminCredentials();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      expect(message).not.toContain("short");
      expect(message.toLowerCase()).not.toContain("password is");
    }
  });
});
