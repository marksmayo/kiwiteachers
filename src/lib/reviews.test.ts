import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, dbModule, resetDb } from "../../test/pglite";

vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);

const reviews = await import("./reviews");
const { setRating, writeReview, deleteReviewText, listReviews, listFlaggedReviews, moderateReview, moderationCounts, validScore, REVIEWS_PER_DAY } = reviews;

const NIL = "00000000-0000-0000-0000-000000000000";
const good = "My Year 5 class loved this. Great for a quick warm-up.";

describe("validScore", () => {
  it.each([0.5, 1, 2.5, 5])("accepts %s", (s) => expect(validScore(s)).toBe(true));
  it.each([0, 5.5, 3.3, NaN, "4", null])("rejects %s", (s) => expect(validScore(s)).toBe(false));
});

describe("ratings", () => {
  beforeEach(resetDb);

  it("sets, updates and removes a rating, keeping aggregates in sync", async () => {
    const u = await createUser();
    const r = await createResource();
    expect(await setRating(u, r.id, 4.5)).toMatchObject({ ok: true, mine: 4.5, rating_avg: 4.5, rating_count: 1 });
    expect(await setRating(u, r.id, 3)).toMatchObject({ rating_avg: 3, rating_count: 1 });
    expect(await setRating(u, r.id, null)).toMatchObject({ ok: true, rating_avg: null, rating_count: 0 });
  });

  it("rejects invalid scores and unpublished resources", async () => {
    const u = await createUser();
    const r = await createResource();
    const pending = await createResource({ status: "pending" });
    expect(await setRating(u, r.id, 3.3)).toEqual({ ok: false, error: expect.stringMatching(/0.5 to 5/) });
    expect(await setRating(u, pending.id, 4)).toEqual({ ok: false, error: "Resource not found" });
    expect(await setRating(u, "bad", 4)).toEqual({ ok: false, error: "Resource not found" });
  });

  it("keeps an existing written review when only the stars change", async () => {
    const u = await createUser();
    const r = await createResource();
    await writeReview(u, r.id, { score: 4, body: good });
    await setRating(u, r.id, 5);
    const [mine] = await listReviews(r.id, u.id);
    expect(mine).toMatchObject({ score: 5, body: good });
  });
});

describe("written reviews + moderation", () => {
  beforeEach(resetDb);

  it("publishes clean reviews immediately", async () => {
    const u = await createUser({ name: "Aroha Tane" });
    const r = await createResource();
    expect(await writeReview(u, r.id, { score: 4.5, body: `  ${good}  ` })).toEqual({ ok: true, status: "published", reasons: [] });
    const list = await listReviews(r.id, null);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ author: "Aroha Tane", body: good, score: 4.5 });
  });

  it("holds flagged reviews back from the public but shows them to their author", async () => {
    const u = await createUser();
    const r = await createResource();
    const res = await writeReview(u, r.id, { score: 1, body: "Rubbish, get a better one at www.spam.com" });
    expect(res).toEqual({ ok: true, status: "flagged", reasons: ["link"] });
    expect(await listReviews(r.id, null)).toHaveLength(0);
    expect(await listReviews(r.id, u.id)).toHaveLength(1);
    expect(await moderationCounts()).toEqual({ pending: 0, flagged: 1 });
    const [flagged] = await listFlaggedReviews();
    expect(flagged).toMatchObject({ resource_slug: r.slug, flag_reasons: ["link"] });
  });

  it("validates score, length and resource", async () => {
    const u = await createUser();
    const r = await createResource();
    expect(await writeReview(u, r.id, { score: 0, body: good })).toEqual({ ok: false, error: expect.stringMatching(/star rating/) });
    expect(await writeReview(u, r.id, { score: 4, body: "short" })).toEqual({ ok: false, error: expect.stringMatching(/at least/) });
    expect(await writeReview(u, r.id, { score: 4, body: "x".repeat(2001) })).toEqual({ ok: false, error: expect.stringMatching(/at most/) });
    expect(await writeReview(u, NIL, { score: 4, body: good })).toEqual({ ok: false, error: "Resource not found" });
  });

  it("rate-limits prolific reviewers", async () => {
    const u = await createUser();
    for (let i = 0; i < REVIEWS_PER_DAY; i++) {
      const r = await createResource();
      await dbModule.sql(`INSERT INTO rating (user_id, resource_id, score, body) VALUES ($1, $2, 4, 'fine review text')`, [u.id, r.id]);
    }
    const r = await createResource();
    expect(await writeReview(u, r.id, { score: 4, body: good })).toEqual({ ok: false, error: expect.stringMatching(/a lot of reviews/) });
  });

  it("editing a review re-runs moderation", async () => {
    const u = await createUser();
    const r = await createResource();
    await writeReview(u, r.id, { score: 4, body: "This is shit honestly mate" });
    expect((await writeReview(u, r.id, { score: 4, body: good })).ok).toBe(true);
    expect(await listReviews(r.id, null)).toHaveLength(1);
  });

  it("authors can delete their review text but keep stars", async () => {
    const u = await createUser();
    const r = await createResource();
    await writeReview(u, r.id, { score: 4, body: good });
    expect(await deleteReviewText(u, r.id)).toEqual({ ok: true });
    expect(await listReviews(r.id, u.id)).toHaveLength(0);
    const [row] = await dbModule.sql(`SELECT score::float AS s FROM rating WHERE user_id = $1`, [u.id]);
    expect(row.s).toBe(4);
    expect(await deleteReviewText(u, "bad")).toEqual({ ok: false, error: "Resource not found" });
  });

  it("shows 'Former member' for reviews whose author name is blank", async () => {
    const u = await createUser({ name: "" });
    const r = await createResource();
    await writeReview(u, r.id, { score: 4, body: good });
    expect((await listReviews(r.id, null))[0].author).toBe("Former member");
  });
});

describe("moderateReview", () => {
  beforeEach(resetDb);

  async function flagged() {
    const u = await createUser();
    const r = await createResource();
    await writeReview(u, r.id, { score: 2, body: "email me on bob@example.com for a better one" });
    return { u, r };
  }

  it("approve publishes the review", async () => {
    const admin = await createUser({ role: "admin" });
    const { u, r } = await flagged();
    expect(await moderateReview(admin, u.id, r.id, "approve")).toEqual({ ok: true });
    expect(await listReviews(r.id, null)).toHaveLength(1);
    expect(await moderationCounts()).toEqual({ pending: 0, flagged: 0 });
  });

  it("hide keeps it out of public view and out of the queue", async () => {
    const admin = await createUser({ role: "admin" });
    const { u, r } = await flagged();
    await moderateReview(admin, u.id, r.id, "hide");
    expect(await listReviews(r.id, null)).toHaveLength(0);
    expect((await listReviews(r.id, u.id))[0].review_status).toBe("hidden");
    expect(await listFlaggedReviews()).toHaveLength(0);
  });

  it("delete removes the text but keeps the rating", async () => {
    const admin = await createUser({ role: "admin" });
    const { u, r } = await flagged();
    await moderateReview(admin, u.id, r.id, "delete");
    expect(await listReviews(r.id, u.id)).toHaveLength(0);
    const [row] = await dbModule.sql(`SELECT rating_count FROM resource WHERE id = $1`, [r.id]);
    expect(row.rating_count).toBe(1);
  });

  it("is admin-only", async () => {
    const { u, r } = await flagged();
    expect(await moderateReview(u, u.id, r.id, "approve")).toEqual({ ok: false, error: "Not authorised" });
    const admin = await createUser({ role: "admin" });
    expect(await moderateReview(admin, u.id, "bad", "approve")).toEqual({ ok: false, error: "Review not found" });
  });
});
