import { getProviderConnections, getProviderNodes } from "@/models";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import ProvidersClient from "./ProvidersClient";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const [connections, nodes] = await Promise.all([
    getProviderConnections(),
    getProviderNodes(),
  ]);

  // Build nodeNameMap for compatible providers (id → name)
  const nodeNameMap = {};
  for (const node of nodes) {
    if (node.id && node.name) nodeNameMap[node.id] = node.name;
  }

  // Hide sensitive fields, enrich name for compatible providers
  const safeConnections = connections.map((c) => {
    const isCompatible =
      isOpenAICompatibleProvider(c.provider) ||
      isAnthropicCompatibleProvider(c.provider);
    const name = isCompatible
      ? c.name || nodeNameMap[c.provider] || c.providerSpecificData?.nodeName || c.provider
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

  return (
    <ProvidersClient
      initialConnections={safeConnections}
      initialProviderNodes={nodes}
    />
  );
}
