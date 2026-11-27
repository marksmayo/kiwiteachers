import { describe, expect, it } from "vitest";
import { isAuthorisedCron } from "./cron-auth";

describe("isAuthorisedCron", () => {
  const secret = "s3cret-s3cret-s3cret";
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorisedCron(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorisedCron(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorisedCron(`Bearer nope`, secret)).toBe(false);
    expect(isAuthorisedCron(secret, secret)).toBe(false);
    expect(isAuthorisedCron(null, secret)).toBe(false);
  });
  it("refuses everything when the secret is missing or weak", () => {
    expect(isAuthorisedCron("Bearer ", "")).toBe(false);
    expect(isAuthorisedCron("Bearer short", "short")).toBe(false);
    expect(isAuthorisedCron("Bearer x", undefined)).toBe(false);
  });
});
