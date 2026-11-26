import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, resetDb } from "../../test/pglite";

vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);
const { toggleFavourite } = await import("./favourites");

describe("toggleFavourite", () => {
  beforeEach(resetDb);

  it("adds then removes", async () => {
    const u = await createUser();
    const r = await createResource();
    expect(await toggleFavourite(u, r.id)).toEqual({ ok: true, favourite: true });
    expect(await toggleFavourite(u, r.id)).toEqual({ ok: true, favourite: false });
  });

  it("refuses invalid ids and unpublished resources", async () => {
    const u = await createUser();
    const pending = await createResource({ status: "pending" });
    expect(await toggleFavourite(u, "nope")).toEqual({ ok: false, error: "Resource not found" });
    expect(await toggleFavourite(u, pending.id)).toEqual({ ok: false, error: "Resource not found" });
  });
});
