"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import * as favourites from "@/lib/favourites";
import * as reviews from "@/lib/reviews";
import * as resources from "@/lib/resource-service";

const SIGN_IN = { ok: false as const, error: "signin" };

export async function toggleFavourite(resourceId: string) {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  return favourites.toggleFavourite(user, resourceId);
}

export async function rateResource(resourceId: string, score: number | null) {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  return reviews.setRating(user, resourceId, score);
}

export async function submitReview(resourceId: string, score: number, body: string) {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  const res = await reviews.writeReview(user, resourceId, { score, body });
  if (res.ok) refresh();
  return res;
}

export async function removeReviewText(resourceId: string) {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  const res = await reviews.deleteReviewText(user, resourceId);
  refresh();
  return res;
}

export async function moderateReview(userId: string, resourceId: string, action: "approve" | "hide" | "delete") {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  const res = await reviews.moderateReview(user, userId, resourceId, action);
  refresh();
  return res;
}

export async function saveResource(input: resources.ResourceInput) {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  const res = await resources.saveResource(user, input);
  if (res.ok) refresh();
  return res;
}

export async function deleteResource(id: string) {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  const res = await resources.deleteResource(user, id);
  refresh();
  return res;
}

export async function decideResource(id: string, decision: "approve" | "reject", reason?: string) {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  const res = await resources.decideResource(user, id, decision, reason);
  refresh();
  return res;
}
