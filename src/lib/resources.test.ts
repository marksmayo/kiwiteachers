import { beforeEach, describe, expect, it, vi } from "vitest";
import { createResource, createUser, dbModule, resetDb } from "../../test/pglite";

vi.mock("./db", async () => (await import("../../test/pglite")).dbModule);

const lib = await import("./resources");
const {
  searchResources, getResourceBySlug, getResourceById, getRelated, getFavourites, getPopularTags, getAreaCounts,
  getStats, listAllResources, listPending, listByUploader, incrementViews, canView, toPrefixQuery,
} = lib;

describe("toPrefixQuery", () => {
  it("builds a safe prefix tsquery", () => {
    expect(toPrefixQuery("Fract  Māori!")).toBe("fract:* & maori:*");
    expect(toPrefixQuery("!!!")).toBeNull();
    expect(toPrefixQuery("a b c d e f g h i j")?.split("&")).toHaveLength(8);
  });
});

describe("canView", () => {
  it("public sees only published; admin and owner see the rest", () => {
    expect(canView({ status: "published", uploaded_by: null }, null)).toBe(true);
    expect(canView({ status: "pending", uploaded_by: "u1" }, null)).toBe(false);
    expect(canView({ status: "pending", uploaded_by: "u1" }, { id: "u2", isAdmin: false })).toBe(false);
    expect(canView({ status: "pending", uploaded_by: "u1" }, { id: "u1", isAdmin: false })).toBe(true);
    expect(canView({ status: "rejected", uploaded_by: "u1" }, { id: "u9", isAdmin: true })).toBe(true);
  });
});

describe("searchResources", () => {
  beforeEach(resetDb);

  it("never returns pending or rejected resources", async () => {
    await createResource({ title: "Live one" });
    await createResource({ title: "Pending one", status: "pending" });
    await createResource({ title: "Rejected one", status: "rejected" });
    const { rows, total } = await searchResources({}, null);
    expect(total).toBe(1);
    expect(rows[0].title).toBe("Live one");
  });

  it("matches text by prefix, tags and curriculum codes", async () => {
    await createResource({ title: "Matariki star fractions", tags: ["space"] });
    await createResource({ title: "Persuasive writing", curriculum_codes: ["EN.P3.W2"] });
    expect((await searchResources({ q: "matar" }, null)).total).toBe(1);
    expect((await searchResources({ q: "spa" }, null)).total).toBe(1);
    expect((await searchResources({ q: "en.p3" }, null)).total).toBe(1);
    expect((await searchResources({ q: "zzz" }, null)).total).toBe(0);
    expect((await searchResources({ q: "%%" }, null)).total).toBe(0);
  });

  it("filters by year, area, type, tag, code and rating", async () => {
    const u = await createUser();
    const a = await createResource({ years: [3], learning_areas: ["english"], resource_type: "reading", tags: ["poetry"], curriculum_codes: ["EN1"] });
    const b = await createResource({ years: [9], learning_areas: ["science"], resource_type: "worksheet" });
    await dbModule.sql(`INSERT INTO rating (user_id, resource_id, score) VALUES ($1, $2, 4.5), ($1, $3, 2)`, [u.id, a.id, b.id]);
    const ids = async (p: Parameters<typeof searchResources>[0]) => (await searchResources(p, null)).rows.map((r) => r.id);
    expect(await ids({ year: "3" })).toEqual([a.id]);
    expect(await ids({ year: "" })).toHaveLength(2);
    expect(await ids({ area: "science" })).toEqual([b.id]);
    expect(await ids({ type: "reading" })).toEqual([a.id]);
    expect(await ids({ tag: "POETRY" })).toEqual([a.id]);
    expect(await ids({ code: "en1" })).toEqual([a.id]);
    expect(await ids({ rating: "4" })).toEqual([a.id]);
    expect(await ids({ rating: "9" })).toHaveLength(2);
  });

  it("sorts by rating, title, popularity, relevance and newest", async () => {
    const u = await createUser();
    const a = await createResource({ title: "Bravo fractions" });
    const b = await createResource({ title: "Alpha fractions" });
    await dbModule.sql(`INSERT INTO rating (user_id, resource_id, score) VALUES ($1, $2, 5)`, [u.id, a.id]);
    await dbModule.sql(`INSERT INTO favourite (user_id, resource_id) VALUES ($1, $2)`, [u.id, b.id]);
    const first = async (sort: string, q?: string) => (await searchResources({ sort, q }, null)).rows[0].id;
    expect(await first("rating")).toBe(a.id);
    expect(await first("title")).toBe(b.id);
    expect(await first("popular")).toBe(b.id);
    expect(await first("newest")).toBe(b.id);
    expect([a.id, b.id]).toContain(await first("relevance", "fractions"));
  });

  it("marks the viewer's favourites and paginates", async () => {
    const u = await createUser();
    const r = await createResource();
    await dbModule.sql(`INSERT INTO favourite (user_id, resource_id) VALUES ($1, $2)`, [u.id, r.id]);
    const res = await searchResources({ page: "1" }, u.id);
    expect(res.rows[0]).toMatchObject({ is_favourite: true, favourite_count: 1 });
    expect(res.pageCount).toBe(1);
    expect((await searchResources({ page: "5" }, u.id)).rows).toHaveLength(0);
  });
});

describe("single resource lookups", () => {
  beforeEach(resetDb);

  it("getResourceBySlug respects visibility and includes the viewer's rating", async () => {
    const owner = await createUser({ name: "Owner Person" });
    const other = await createUser();
    const pending = await createResource({ status: "pending", uploaded_by: owner.id });
    expect(await getResourceBySlug(pending.slug, null)).toBeNull();
    expect(await getResourceBySlug(pending.slug, other)).toBeNull();
    expect(await getResourceBySlug(pending.slug, owner)).toMatchObject({ uploader_name: "Owner Person" });

    const live = await createResource();
    await dbModule.sql(`INSERT INTO rating (user_id, resource_id, score) VALUES ($1, $2, 3.5)`, [other.id, live.id]);
    expect(await getResourceBySlug(live.slug, other)).toMatchObject({ my_rating: 3.5 });
    expect(await getResourceBySlug(live.slug, null)).toMatchObject({ my_rating: null });
    expect(await getResourceBySlug("missing", null)).toBeNull();
  });

  it("getResourceById validates ids", async () => {
    const r = await createResource();
    expect((await getResourceById(r.id))?.id).toBe(r.id);
    expect(await getResourceById("'; drop table resource;--")).toBeNull();
  });
});

describe("listings", () => {
  beforeEach(resetDb);

  it("related, favourites, tags, counts and stats only include published resources", async () => {
    const u = await createUser();
    const main = await createResource({ tags: ["matariki"], learning_areas: ["maths"], years: [4] });
    const rel = await createResource({ tags: ["matariki"], learning_areas: ["science"], years: [4, 5] });
    const hidden = await createResource({ tags: ["matariki"], status: "pending", years: [4] });
    await dbModule.sql(`INSERT INTO favourite (user_id, resource_id) VALUES ($1, $2), ($1, $3)`, [u.id, rel.id, hidden.id]);
    await dbModule.sql(`INSERT INTO rating (user_id, resource_id, score, body, review_status) VALUES ($1, $2, 1, 'bad words here', 'flagged')`, [u.id, main.id]);

    const full = (await getResourceById(main.id))!;
    expect((await getRelated(full, u.id)).map((r) => r.id)).toEqual([rel.id]);
    expect((await getRelated({ ...full, years: [] }, null)).map((r) => r.id)).toEqual([rel.id]);
    expect((await getFavourites(u.id)).map((r) => r.id)).toEqual([rel.id]);
    expect(await getPopularTags()).toEqual([{ tag: "matariki", n: 2 }]);
    expect(await getAreaCounts()).toEqual({ maths: 1, science: 1 });
    expect(await getStats()).toEqual({ resources: 2, users: 1, pending: 1, flagged: 1 });
    expect(await listAllResources()).toHaveLength(2);
    expect((await listPending()).map((r) => r.id)).toEqual([hidden.id]);
  });

  it("listByUploader returns every status for that uploader", async () => {
    const u = await createUser();
    await createResource({ uploaded_by: u.id });
    await createResource({ uploaded_by: u.id, status: "rejected" });
    await createResource();
    expect(await listByUploader(u.id)).toHaveLength(2);
  });

  it("incrementViews only counts published resources", async () => {
    const live = await createResource();
    const pending = await createResource({ status: "pending" });
    await incrementViews(live.id);
    await incrementViews(pending.id);
    const rows = await dbModule.sql(`SELECT id, view_count FROM resource`);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.view_count]))).toEqual({ [live.id]: 1, [pending.id]: 0 });
  });
});
