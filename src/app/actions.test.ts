import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "u1", name: "T", email: "t@x", isAdmin: false };
let current: typeof user | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn(async () => current) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/favourites", () => ({ toggleFavourite: vi.fn(async () => ({ ok: true, favourite: true })) }));
vi.mock("@/lib/reviews", () => ({
  setRating: vi.fn(async () => ({ ok: true })),
  writeReview: vi.fn(async () => ({ ok: true, status: "published", reasons: [] })),
  deleteReviewText: vi.fn(async () => ({ ok: true })),
  moderateReview: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/resource-service", () => ({
  saveResource: vi.fn(async () => ({ ok: true, slug: "s", status: "pending" })),
  deleteResource: vi.fn(async () => ({ ok: true })),
  decideResource: vi.fn(async () => ({ ok: true })),
}));

const actions = await import("./actions");
const { refresh } = await import("next/cache");
const reviews = await import("@/lib/reviews");
const svc = await import("@/lib/resource-service");
const fav = await import("@/lib/favourites");

const input = { title: "t", description: "", years: [1], learningAreas: ["maths"], resourceType: "worksheet", tags: [] };

const calls: [string, () => Promise<unknown>][] = [
  ["toggleFavourite", () => actions.toggleFavourite("r")],
  ["rateResource", () => actions.rateResource("r", 4)],
  ["submitReview", () => actions.submitReview("r", 4, "body text here")],
  ["removeReviewText", () => actions.removeReviewText("r")],
  ["moderateReview", () => actions.moderateReview("u", "r", "approve")],
  ["saveResource", () => actions.saveResource(input)],
  ["deleteResource", () => actions.deleteResource("r")],
  ["decideResource", () => actions.decideResource("r", "reject", "why")],
];

describe("server actions", () => {
  beforeEach(() => {
    current = null;
  });

  it.each(calls)("%s requires sign-in", async (_name, fn) => {
    expect(await fn()).toEqual({ ok: false, error: "signin" });
  });

  it("delegate to the services with the signed-in user", async () => {
    current = user;
    for (const [, fn] of calls) expect((await fn() as { ok: boolean }).ok).toBe(true);
    expect(fav.toggleFavourite).toHaveBeenCalledWith(user, "r");
    expect(reviews.setRating).toHaveBeenCalledWith(user, "r", 4);
    expect(reviews.writeReview).toHaveBeenCalledWith(user, "r", { score: 4, body: "body text here" });
    expect(reviews.moderateReview).toHaveBeenCalledWith(user, "u", "r", "approve");
    expect(svc.saveResource).toHaveBeenCalledWith(user, input);
    expect(svc.decideResource).toHaveBeenCalledWith(user, "r", "reject", "why");
    expect(refresh).toHaveBeenCalled();
  });

  it("does not refresh after failed saves or reviews", async () => {
    current = user;
    vi.mocked(svc.saveResource).mockResolvedValueOnce({ ok: false, error: "nope" });
    vi.mocked(reviews.writeReview).mockResolvedValueOnce({ ok: false, error: "nope" });
    await actions.saveResource(input);
    await actions.submitReview("r", 4, "x");
    expect(refresh).not.toHaveBeenCalled();
  });
});
