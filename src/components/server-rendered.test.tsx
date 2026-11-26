// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN");
  }),
}));

let currentUser: { id: string; name: string; email: string; isAdmin: boolean } | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn(async () => currentUser) }));

const reviewsLib = vi.hoisted(() => ({
  listReviews: vi.fn(),
  moderationCounts: vi.fn(async () => ({ pending: 2, flagged: 1 })),
}));
vi.mock("@/lib/reviews", () => reviewsLib);

const actions = vi.hoisted(() => ({ saveResource: vi.fn(), submitReview: vi.fn(), removeReviewText: vi.fn() }));
vi.mock("@/app/actions", () => actions);

const blobClient = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@vercel/blob/client", () => blobClient);
const viewer = vi.hoisted(() => ({
  renderThumbnail: vi.fn(async () => new Blob(["webp"])),
  renderPreviews: vi.fn(async () => [new Blob(["p1"]), new Blob(["p2"])]),
}));
vi.mock("@/components/pdf/PdfViewer", () => viewer);

import { Reviews, displayName } from "./reviews/Reviews";
import { AdminNav, requireAdmin } from "./admin/AdminNav";
import { requireUser } from "@/lib/require-user";
import { ResourceForm } from "./admin/ResourceForm";
import TermsPage from "@/app/terms/page";
import PrivacyPage from "@/app/privacy/page";
import CopyrightPage from "@/app/copyright/page";
import GuidelinesPage from "@/app/guidelines/page";

afterEach(() => {
  cleanup();
  currentUser = null;
});

const review = (over = {}) => ({
  user_id: "u2",
  resource_id: "r1",
  author: "Aroha Te Rangi",
  score: 4.5,
  body: "Loved it",
  review_status: "published",
  flag_reasons: [],
  created_at: new Date("2026-11-01"),
  updated_at: new Date("2026-11-02"),
  ...over,
});

describe("displayName", () => {
  it("shortens to first name and last initial", () => {
    expect(displayName("Aroha Te Rangi")).toBe("Aroha R.");
    expect(displayName("Mere")).toBe("Mere");
    expect(displayName("   ")).toBe("Teacher");
  });
});

describe("Reviews", () => {
  it("shows reviews and a sign-in prompt to visitors", async () => {
    reviewsLib.listReviews.mockResolvedValueOnce([review()]);
    render(await Reviews({ resourceId: "r1", slug: "s", viewerId: null, myScore: null }));
    expect(screen.getByText("Aroha R.")).toBeInTheDocument();
    expect(screen.getByText("Loved it")).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toHaveAttribute("href", "/sign-in?next=/resources/s");
  });

  it("tells authors when their review is held or hidden, and shows the form", async () => {
    reviewsLib.listReviews.mockResolvedValueOnce([review({ user_id: "me", review_status: "flagged" })]);
    render(await Reviews({ resourceId: "r1", slug: "s", viewerId: "me", myScore: 4 }));
    expect(screen.getByText(/waiting for a moderator/)).toBeInTheDocument();
    expect(screen.getByText("Edit your review")).toBeInTheDocument();
    cleanup();
    reviewsLib.listReviews.mockResolvedValueOnce([review({ user_id: "me", review_status: "hidden" })]);
    render(await Reviews({ resourceId: "r1", slug: "s", viewerId: "me", myScore: 4 }));
    expect(screen.getByText(/hidden by a moderator/)).toBeInTheDocument();
  });

  it("handles no reviews", async () => {
    reviewsLib.listReviews.mockResolvedValueOnce([]);
    render(await Reviews({ resourceId: "r1", slug: "s", viewerId: "me", myScore: null }));
    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
  });
});

describe("guards", () => {
  it("requireUser redirects visitors to sign-in", async () => {
    await expect(requireUser("/account")).rejects.toThrow("REDIRECT:/sign-in?next=%2Faccount");
    currentUser = { id: "u", name: "n", email: "e", isAdmin: false };
    await expect(requireUser("/account")).resolves.toBe(currentUser);
  });

  it("requireAdmin redirects visitors and forbids non-admins", async () => {
    await expect(requireAdmin("/admin")).rejects.toThrow("REDIRECT:/sign-in?next=%2Fadmin");
    currentUser = { id: "u", name: "n", email: "e", isAdmin: false };
    await expect(requireAdmin("/admin")).rejects.toThrow("FORBIDDEN");
    currentUser = { ...currentUser, isAdmin: true };
    await expect(requireAdmin("/admin")).resolves.toBe(currentUser);
  });

  it("AdminNav shows alert counts on the right tabs", async () => {
    render(await AdminNav({ active: "queue" }));
    expect(screen.getByText("Approval queue").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

describe("legal pages", () => {
  it.each([
    ["Terms of use", TermsPage, /contributor terms/i],
    ["Privacy policy", PrivacyPage, /Privacy Act 2020/],
    ["Copyright & takedown", CopyrightPage, /Copyright Act 1994/],
    ["Community guidelines", GuidelinesPage, /moderation works/i],
  ])("%s renders with contact details", (title, Page, text) => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /@/ })[0]).toHaveAttribute("href", expect.stringMatching(/^mailto:/));
  });
});

describe("ResourceForm upload flow", () => {
  it("uploads thumbnail, PDF and watermarked previews into the user's folders, then saves", async () => {
    blobClient.upload
      .mockResolvedValueOnce({ pathname: "thumbs/u1/thumb-abc.webp" })
      .mockImplementationOnce(async (_p: string, _f: File, opts: { onUploadProgress?: (p: { percentage: number }) => void }) => {
        opts.onUploadProgress?.({ percentage: 50 });
        return { pathname: "docs/u1/sheet-abc.pdf" };
      })
      .mockResolvedValueOnce({ pathname: "previews/u1/p1-a.webp" })
      .mockResolvedValueOnce({ pathname: "previews/u1/p2-b.webp" });
    actions.saveResource.mockResolvedValueOnce({ ok: true, slug: "sheet", status: "pending" });
    render(<ResourceForm userId="u1" mode="contributor" />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File(["%PDF"], "My Sheet.PDF", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getByText("English"));
    fireEvent.click(screen.getByText("Worksheet"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Submit for review" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/my-resources?submitted=1"));
    expect(blobClient.upload).toHaveBeenNthCalledWith(1, "thumbs/u1/thumb.webp", expect.any(Blob), expect.objectContaining({ access: "private" }));
    expect(blobClient.upload).toHaveBeenNthCalledWith(2, "docs/u1/my-sheet.pdf", expect.any(File), expect.objectContaining({ access: "private" }));
    expect(blobClient.upload).toHaveBeenNthCalledWith(3, "previews/u1/p1.webp", expect.any(Blob), expect.objectContaining({ access: "private" }));
    expect(actions.saveResource).toHaveBeenCalledWith(
      expect.objectContaining({
        blobPathname: "docs/u1/sheet-abc.pdf",
        thumbPathname: "thumbs/u1/thumb-abc.webp",
        previewPathnames: ["previews/u1/p1-a.webp", "previews/u1/p2-b.webp"],
        acceptedRights: true,
        years: [4],
      }),
    );
  });

  it("still saves if preview rendering fails (falls back to the watermarked PDF)", async () => {
    viewer.renderPreviews.mockRejectedValueOnce(new Error("canvas exploded"));
    blobClient.upload.mockResolvedValueOnce({ pathname: "thumbs/u1/t.webp" }).mockResolvedValueOnce({ pathname: "docs/u1/a.pdf" });
    actions.saveResource.mockResolvedValueOnce({ ok: true, slug: "a", status: "published" });
    render(<ResourceForm userId="u1" />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File(["%PDF"], "a.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getByText("English"));
    fireEvent.click(screen.getByText("Worksheet"));
    fireEvent.submit(screen.getByRole("button", { name: "Publish resource" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/resources/a"));
    expect(actions.saveResource).toHaveBeenCalledWith(expect.objectContaining({ previewPathnames: undefined }));
  });

  it("regenerates previews from the current file when editing an older resource", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([37, 80, 68, 70])));
    vi.stubGlobal("fetch", fetchMock);
    blobClient.upload.mockResolvedValueOnce({ pathname: "previews/u1/p1-x.webp" }).mockResolvedValueOnce({ pathname: "previews/u1/p2-y.webp" });
    actions.saveResource.mockResolvedValueOnce({ ok: true, slug: "old", status: "published" });
    render(
      <ResourceForm
        userId="u1"
        initial={{ id: "r9", title: "Old", description: "", years: [4], learningAreas: ["maths"], resourceType: "worksheet", tags: [], curriculumCodes: [], hasPreviews: false }}
      />,
    );
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/resources/old"));
    expect(fetchMock).toHaveBeenCalledWith("/api/resources/r9/file?v=full");
    expect(actions.saveResource).toHaveBeenCalledWith(expect.objectContaining({ id: "r9", previewPathnames: ["previews/u1/p1-x.webp", "previews/u1/p2-y.webp"] }));
    vi.unstubAllGlobals();
  });

  it("rejects files over 25 MB before uploading", () => {
    render(<ResourceForm userId="u1" />);
    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [big] } });
    expect(screen.getByText(/over 25 MB/)).toBeInTheDocument();
  });

  it("surfaces upload failures", async () => {
    blobClient.upload.mockRejectedValue(new Error("Invalid upload path"));
    render(<ResourceForm userId="u1" />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File(["%PDF"], "a.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByText("+ Junior (NE–3)"));
    fireEvent.click(screen.getByText("Science"));
    fireEvent.click(screen.getByText("Science"));
    fireEvent.click(screen.getByText("Science"));
    fireEvent.click(screen.getByText("Activity"));
    fireEvent.submit(screen.getByRole("button", { name: "Publish resource" }));
    expect(await screen.findByText("Invalid upload path")).toBeInTheDocument();
    blobClient.upload.mockReset();
  });
});
