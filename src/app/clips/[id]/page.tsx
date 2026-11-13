import type { Metadata } from "next";
import { ClipReview } from "@/components/clips/clip-review";

export const metadata: Metadata = {
  title: "Clip review",
};

export default async function ClipReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClipReview clipId={id} />;
}
