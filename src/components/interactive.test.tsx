// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";

const push = vi.fn();
const refreshRouter = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: refreshRouter }), useSearchParams: () => new URLSearchParams() }));

const actions = vi.hoisted(() => ({
  rateResource: vi.fn(),
  submitReview: vi.fn(),
  removeReviewText: vi.fn(),
  decideResource: vi.fn(),
  moderateReview: vi.fn(),
  deleteResource: vi.fn(),
  toggleFavourite: vi.fn(),
  saveResource: vi.fn(),
}));
vi.mock("@/app/actions", () => actions);

const authClient = vi.hoisted(() => ({ changePassword: vi.fn(), deleteUser: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient }));

import { StarPicker } from "./StarPicker";
import { RatingInput } from "./RatingInput";
import { ReviewForm } from "./reviews/ReviewForm";
import { TagInput } from "./TagInput";
import { ChangePasswordForm } from "./account/ChangePasswordForm";
import { DeleteAccountForm } from "./account/DeleteAccountForm";
import { DecisionButtons } from "./admin/DecisionButtons";
import { ModerationButtons } from "./admin/ModerationButtons";
import { DeleteButton } from "./admin/DeleteButton";
import { ResourceForm } from "./admin/ResourceForm";
import { Stars, RatingSummary } from "./Stars";

afterEach(cleanup);

/** jsdom has no layout; give star buttons a 30px box so half-star maths works. */
function mockRect() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, width: 30, top: 0, height: 30, right: 30, bottom: 30, x: 0, y: 0, toJSON() {} } as DOMRect);
}

describe("Stars / RatingSummary", () => {
  it("renders partial fills and summary text", () => {
    const { container } = render(<Stars value={3.5} />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(5);
    render(<RatingSummary avg={4.25} count={3} />);
    expect(screen.getByLabelText("Rated 4.3 out of 5 from 3 ratings")).toBeInTheDocument();
    render(<RatingSummary avg={null} count={0} />);
    expect(screen.getByText("No ratings yet")).toBeInTheDocument();
  });
});

describe("StarPicker", () => {
  beforeEach(mockRect);

  it("picks half stars from the left half and whole stars from the right", () => {
    const onChange = vi.fn();
    render(<StarPicker value={null} onChange={onChange} />);
    const third = screen.getByLabelText("3 stars");
    fireEvent.click(third, { clientX: 5 });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    fireEvent.click(third, { clientX: 25 });
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it("supports keyboard and hover preview", () => {
    const onChange = vi.fn();
    const onHover = vi.fn();
    render(<StarPicker value={2} onChange={onChange} onHoverChange={onHover} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
    fireEvent.mouseMove(screen.getByLabelText("5 stars"), { clientX: 29 });
    expect(onHover).toHaveBeenLastCalledWith(5);
    fireEvent.mouseLeave(slider);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("ignores input when disabled and won't go below half a star", () => {
    const onChange = vi.fn();
    const { rerender } = render(<StarPicker value={0.5} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowDown" });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<StarPicker value={3} onChange={onChange} disabled />);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("RatingInput", () => {
  beforeEach(mockRect);
  const props = { resourceId: "r1", initialAvg: null, initialCount: 0, initialMine: null, returnTo: "/resources/x" };

  it("sends signed-out users to sign in", () => {
    render(<RatingInput {...props} signedIn={false} />);
    expect(screen.getByText("Sign in to rate")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("4 stars"), { clientX: 25 });
    expect(push).toHaveBeenCalledWith("/sign-in?next=%2Fresources%2Fx");
  });

  it("saves a rating and shows the new average", async () => {
    actions.rateResource.mockResolvedValueOnce({ ok: true, mine: 4, rating_avg: 4, rating_count: 1 });
    render(<RatingInput {...props} signedIn />);
    fireEvent.click(screen.getByLabelText("4 stars"), { clientX: 25 });
    await waitFor(() => expect(screen.getByText("from 1 rating")).toBeInTheDocument());
    expect(actions.rateResource).toHaveBeenCalledWith("r1", 4);
  });

  it("removes a rating and reverts on error", async () => {
    actions.rateResource.mockResolvedValueOnce({ ok: true, mine: null, rating_avg: null, rating_count: 0 });
    render(<RatingInput {...props} initialMine={3} initialAvg={3} initialCount={1} signedIn />);
    fireEvent.click(screen.getByText("Remove my rating (and review)"));
    await waitFor(() => expect(refreshRouter).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText("2 stars")).toBeEnabled());

    actions.rateResource.mockResolvedValueOnce({ ok: false, error: "Ratings are 0.5 to 5 stars" });
    fireEvent.click(screen.getByLabelText("2 stars"), { clientX: 25 });
    await waitFor(() => expect(screen.getByText("Ratings are 0.5 to 5 stars")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText("2 stars")).toBeEnabled());

    actions.rateResource.mockResolvedValueOnce({ ok: false, error: "signin" });
    fireEvent.click(screen.getByLabelText("2 stars"), { clientX: 25 });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/sign-in?next=%2Fresources%2Fx"));
  });
});

describe("ReviewForm", () => {
  beforeEach(mockRect);

  it("validates before submitting", async () => {
    render(<ReviewForm resourceId="r1" initialScore={null} initialBody={null} />);
    fireEvent.click(screen.getByText("Post review"));
    expect(await screen.findByText("Choose a star rating first.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("4 stars"), { clientX: 25 });
    fireEvent.click(screen.getByText("Post review"));
    expect(await screen.findByText(/at least 10 characters/)).toBeInTheDocument();
    expect(actions.submitReview).not.toHaveBeenCalled();
  });

  it("tells the author when their review is held for moderation", async () => {
    actions.submitReview.mockResolvedValueOnce({ ok: true, status: "flagged", reasons: ["link"] });
    render(<ReviewForm resourceId="r1" initialScore={4} initialBody={null} />);
    await userEvent.type(screen.getByLabelText("Your review"), "See www.example.com for more");
    fireEvent.click(screen.getByText("Post review"));
    expect(await screen.findByText(/once a moderator has checked it/)).toBeInTheDocument();
  });

  it("confirms published reviews and surfaces server errors", async () => {
    actions.submitReview.mockResolvedValueOnce({ ok: false, error: "Resource not found" });
    actions.submitReview.mockResolvedValueOnce({ ok: false, error: "signin" });
    actions.submitReview.mockResolvedValueOnce({ ok: true, status: "published", reasons: [] });
    render(<ReviewForm resourceId="r1" initialScore={5} initialBody={null} />);
    await userEvent.type(screen.getByLabelText("Your review"), "Brilliant resource for my class");
    const post = async () => {
      await waitFor(() => expect(screen.getByRole("button", { name: "Post review" })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "Post review" }));
    };
    await post();
    expect(await screen.findByText("Resource not found")).toBeInTheDocument();
    await post();
    expect(await screen.findByText("Please sign in again.")).toBeInTheDocument();
    await post();
    expect(await screen.findByText(/your review is live/)).toBeInTheDocument();
  });

  it("lets authors edit, cancel and delete an existing review", async () => {
    actions.removeReviewText.mockResolvedValueOnce({ ok: true });
    render(<ReviewForm resourceId="r1" initialScore={4} initialBody="Existing review text" />);
    fireEvent.click(screen.getByText("Edit your review"));
    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("Delete review"));
    expect(await screen.findByText(/Review removed/)).toBeInTheDocument();
    expect(actions.removeReviewText).toHaveBeenCalledWith("r1");
  });
});

describe("TagInput", () => {
  it("adds on Enter and comma, removes on click and Backspace", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TagInput label="Tags" value={[]} onChange={onChange} />);
    const input = screen.getByLabelText("Tags");
    await userEvent.type(input, "Fractions{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["fractions"]);
    fireEvent.change(input, { target: { value: "a,b" } });
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    rerender(<TagInput label="Tags" value={["x", "y"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Remove x"));
    expect(onChange).toHaveBeenLastCalledWith(["y"]);
    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith(["x"]);
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "draft" } });
    fireEvent.blur(screen.getByLabelText("Tags"));
    expect(onChange).toHaveBeenLastCalledWith(["x", "y", "draft"]);
  });
});

describe("ChangePasswordForm", () => {
  async function fill(current: string, next: string, confirm: string) {
    await userEvent.type(screen.getByLabelText("Current password"), current);
    await userEvent.type(screen.getByLabelText("New password"), next);
    await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
    fireEvent.submit(screen.getByRole("button", { name: "Change password" }));
  }

  it("validates matching, length and difference", async () => {
    render(<ChangePasswordForm />);
    await fill("oldpassword", "newpassword1", "different1");
    expect(await screen.findByText(/don’t match/)).toBeInTheDocument();
    cleanup();
    render(<ChangePasswordForm />);
    await fill("samepassword", "samepassword", "samepassword");
    expect(await screen.findByText(/different password/)).toBeInTheDocument();
    expect(authClient.changePassword).not.toHaveBeenCalled();
  });

  it("changes the password and revokes other sessions", async () => {
    authClient.changePassword.mockResolvedValueOnce({ error: null });
    render(<ChangePasswordForm />);
    await fill("oldpassword", "newpassword1", "newpassword1");
    expect(await screen.findByText("Password changed.")).toBeInTheDocument();
    expect(authClient.changePassword).toHaveBeenCalledWith({ currentPassword: "oldpassword", newPassword: "newpassword1", revokeOtherSessions: true });
  });

  it("explains a wrong current password", async () => {
    authClient.changePassword.mockResolvedValueOnce({ error: { message: "Invalid password" } });
    render(<ChangePasswordForm />);
    await fill("wrongpassword", "newpassword1", "newpassword1");
    expect(await screen.findByText("Your current password is incorrect.")).toBeInTheDocument();
  });
});

describe("DeleteAccountForm", () => {
  it("requires the confirmation phrase", async () => {
    render(<DeleteAccountForm isAdmin />);
    expect(screen.getByText(/You’re an administrator/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Your password"), "pw12345678");
    fireEvent.submit(screen.getByRole("button", { name: /Permanently delete/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/to confirm/);
    expect(authClient.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes with password and redirects home; explains a wrong password", async () => {
    authClient.deleteUser.mockResolvedValueOnce({ error: { message: "Invalid password" } }).mockResolvedValueOnce({ error: null });
    render(<DeleteAccountForm isAdmin={false} />);
    await userEvent.type(screen.getByLabelText("Your password"), "pw12345678");
    await userEvent.type(screen.getByLabelText(/Type “delete my account”/), "Delete my account");
    fireEvent.submit(screen.getByRole("button", { name: /Permanently delete/ }));
    expect(await screen.findByText("That password is incorrect.")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: /Permanently delete/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(authClient.deleteUser).toHaveBeenLastCalledWith({ password: "pw12345678" });
  });
});

describe("admin buttons", () => {
  it("DecisionButtons approves, and rejects with a reason", async () => {
    actions.decideResource.mockResolvedValue({ ok: true });
    render(<DecisionButtons id="r1" />);
    fireEvent.click(screen.getByText(/Approve & publish/));
    await waitFor(() => expect(actions.decideResource).toHaveBeenCalledWith("r1", "approve", ""));
    fireEvent.click(screen.getByText("Reject"));
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Rejection reason"), "Blurry scan");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(actions.decideResource).toHaveBeenLastCalledWith("r1", "reject", "Blurry scan"));
    actions.decideResource.mockResolvedValueOnce({ ok: false, error: "Not authorised" });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Not authorised")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
  });

  it("ModerationButtons sends each action and shows errors", async () => {
    actions.moderateReview.mockResolvedValue({ ok: true });
    render(<ModerationButtons userId="u1" resourceId="r1" />);
    for (const [label, action] of [["Approve & publish", "approve"], ["Keep hidden", "hide"], ["Delete text", "delete"]] as const) {
      await act(async () => fireEvent.click(screen.getByText(label)));
      expect(actions.moderateReview).toHaveBeenLastCalledWith("u1", "r1", action);
    }
    actions.moderateReview.mockResolvedValueOnce({ ok: false, error: "Not authorised" });
    await act(async () => fireEvent.click(screen.getByText("Keep hidden")));
    expect(await screen.findByText("Not authorised")).toBeInTheDocument();
  });

  it("DeleteButton confirms before deleting", async () => {
    actions.deleteResource.mockResolvedValueOnce({ ok: false, error: "You can't delete this resource" });
    render(<DeleteButton id="r1" label="Withdraw" />);
    fireEvent.click(screen.getByLabelText("Withdraw"));
    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByLabelText("Withdraw"));
    fireEvent.click(screen.getByText("Confirm withdraw"));
    expect(await screen.findByText("You can't delete this resource")).toBeInTheDocument();
  });
});

describe("ResourceForm validation", () => {
  it("checks file, years, areas, type and contributor rights before uploading", async () => {
    render(<ResourceForm userId="u1" mode="contributor" />);
    const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Submit for review" }));
    submit();
    expect(await screen.findByText("Please attach a PDF.")).toBeInTheDocument();

    const pdf = new File(["%PDF-1.7"], "Matariki_star-fractions.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File(["x"], "notes.docx")] } });
    expect(await screen.findByText(/choose a PDF file/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [pdf] } });
    expect(screen.getByDisplayValue("Matariki star fractions")).toBeInTheDocument();

    submit();
    expect(await screen.findByText("Choose at least one year level.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("+ Middle (4–6)"));
    submit();
    expect(await screen.findByText("Choose at least one learning area.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Maths & Statistics"));
    submit();
    expect(await screen.findByText("Choose a resource type.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Worksheet"));
    submit();
    expect(await screen.findByText(/right to share/)).toBeInTheDocument();
    expect(actions.saveResource).not.toHaveBeenCalled();
  });

  it("edits without a new file and redirects to the resource when published", async () => {
    actions.saveResource.mockResolvedValueOnce({ ok: true, slug: "abc", status: "published" });
    render(
      <ResourceForm
        userId="u1"
        initial={{ id: "r1", title: "T", description: "", years: [4], learningAreas: ["maths"], resourceType: "worksheet", tags: ["a"], curriculumCodes: ["MA1"] }}
      />,
    );
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/resources/abc"));
    expect(actions.saveResource).toHaveBeenCalledWith(expect.objectContaining({ id: "r1", curriculumCodes: ["MA1"], blobPathname: undefined }));
  });

  it("shows server errors", async () => {
    actions.saveResource.mockResolvedValueOnce({ ok: false, error: "signin" });
    render(
      <ResourceForm
        userId="u1"
        mode="contributor"
        initial={{ id: "r1", title: "T", description: "", years: [4], learningAreas: ["maths"], resourceType: "worksheet", tags: [], curriculumCodes: [] }}
      />,
    );
    fireEvent.submit(screen.getByRole("button", { name: "Save and resubmit" }));
    expect(await screen.findByText(/session expired/)).toBeInTheDocument();
  });
});
