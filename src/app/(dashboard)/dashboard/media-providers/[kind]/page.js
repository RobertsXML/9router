import { notFound } from "next/navigation";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { getProviderConnections, getProviderNodes, getCombos } from "@/models";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import MediaProviderKindClient from "./MediaProviderKindClient";

export const dynamic = "force-dynamic";

export default async function MediaProviderKindPage({ params }) {
  const { kind } = await params;

  const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kind);
  if (!kindConfig) return notFound();

  // Fetch all data in parallel
  const [connections, nodes, combos] = await Promise.all([
    getProviderConnections(),
    getProviderNodes(),
    getCombos(),
  ]);

  // Build nodeNameMap for compatible providers (id → name)
  const nodeNameMap = {};
  for (const node of nodes) {
    if (node.id && node.name) nodeNameMap[node.id] = node.name;
  }

  // Strip sensitive fields, enrich name for compatible providers (mirrors /api/providers GET)
  const safeConnections = connections.map((c) => {
    const isCompatible = isOpenAICompatibleProvider(c.provider) || isAnthropicCompatibleProvider(c.provider);
    const name = isCompatible
      ? (c.name || nodeNameMap[c.provider] || c.providerSpecificData?.nodeName || c.provider)
      : c.name;
    return {
      ...c,
      name,
      apiKey: undefined,
      accessToken: undefined,
      refreshToken: undefined,
      idToken: undefined,
    };
  });

  // Filter custom-embedding nodes
  const customNodes = nodes.filter((n) => n.type === "custom-embedding");

  return (
    <MediaProviderKindClient
      initialConnections={safeConnections}
      initialCustomNodes={customNodes}
      initialCombos={combos || []}
    />
  );
}
