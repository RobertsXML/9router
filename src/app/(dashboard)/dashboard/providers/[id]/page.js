import { getProviderConnections, getProviderNodes, getProxyPools, getSettings } from "@/lib/localDb";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import ProviderDetailClient from "./ProviderDetailClient";

export const dynamic = "force-dynamic";

export default async function ProviderDetailPage({ params }) {
  const [paramsResolved, allConnections, allNodes, proxyPools, settings] = await Promise.all([
    params, // Next.js 15+ params is a Promise — resolved in parallel with DB calls
    getProviderConnections(),
    getProviderNodes(),
    getProxyPools({ isActive: true }),
    getSettings(),
  ]);
  const { id: providerId } = paramsResolved;

  // Build node name map & find this provider's node
  const nodeNameMap = {};
  let providerNode = null;
  for (const node of allNodes) {
    if (node.id && node.name) nodeNameMap[node.id] = node.name;
    if (node.id === providerId) providerNode = node;
  }

  // Filter connections for this provider, enrich names, strip sensitive fields
  const connections = allConnections
    .flatMap((c) => {
      if (c.provider !== providerId) return [];
      const isCompatible = isOpenAICompatibleProvider(c.provider) || isAnthropicCompatibleProvider(c.provider);
      const name = isCompatible
        ? (c.name || nodeNameMap[c.provider] || c.providerSpecificData?.nodeName || c.provider)
        : c.name;
      return [{
        ...c,
        name,
        apiKey: undefined,
        accessToken: undefined,
        refreshToken: undefined,
        idToken: undefined,
      }];
    });

  // Strip password from settings
  const { password, oidcClientSecret, ...safeSettings } = settings;

  return (
    <ProviderDetailClient
      initialConnections={connections}
      initialProviderNode={providerNode}
      initialProxyPools={proxyPools}
      initialSettings={safeSettings}
    />
  );
}
