import { getProviderNodeById } from "@/lib/localDb";
import { CUSTOM_EMBEDDING_PREFIX } from "@/shared/constants/providers";
import { notFound } from "next/navigation";
import MediaProviderDetailClient from "./MediaProviderDetailClient";

// Server Component - fetches custom node data on the server
export default async function MediaProviderDetailPage({ params }) {
  const { kind, id } = await params;

  // Only fetch for custom embedding nodes on the server
  let initialCustomNode = null;
  if (kind === "embedding" && id.startsWith(CUSTOM_EMBEDDING_PREFIX)) {
    initialCustomNode = await getProviderNodeById(id);
    if (!initialCustomNode) return notFound();
  }

  return <MediaProviderDetailClient initialCustomNode={initialCustomNode} />;
}
