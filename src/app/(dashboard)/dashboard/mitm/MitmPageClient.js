"use client";

import { useState, useEffect, useReducer, useCallback, useMemo } from "react";
import { MITM_TOOLS } from "@/shared/constants/cliTools";
import { getModelsByProviderId } from "@/shared/constants/models";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { MitmServerCard, MitmToolCard } from "@/app/(dashboard)/dashboard/cli-tools/components";

function dataReducer(state, action) {
  switch (action.type) {
    case 'SET_CONNECTIONS': return { ...state, connections: action.payload };
    case 'SET_API_KEYS': return { ...state, apiKeys: action.payload };
    case 'SET_ALIASES': return { ...state, modelAliases: action.payload };
    case 'SET_CLOUD': return { ...state, cloudEnabled: action.payload };
    default: return state;
  }
}

export default function MitmPageClient() {
  const [{ connections, apiKeys, modelAliases, cloudEnabled }, dispatchData] = useReducer(dataReducer, { connections: [], apiKeys: [], modelAliases: {}, cloudEnabled: false });
  const [expandedTool, setExpandedTool] = useState(null);
  // eslint-disable-next-line react-doctor/no-derived-state -- apiMitmStatus is populated from API fetches in fetchMitmStatus, not derived from other state
  const [apiMitmStatus, setApiMitmStatus] = useState({ running: false, certExists: false, dnsStatus: {}, hasCachedPassword: false });
  const [dnsStatusOverride, setDnsStatusOverride] = useState(null);

  const mitmStatus = useMemo(() => {
    if (dnsStatusOverride === null) return apiMitmStatus;
    return { ...apiMitmStatus, dnsStatus: dnsStatusOverride };
  }, [apiMitmStatus, dnsStatusOverride]);

  const fetchMitmStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/cli-tools/antigravity-mitm");
      if (res.ok) {
        const data = await res.json();
        setApiMitmStatus(data);
      }
    } catch {
      setApiMitmStatus({ running: false, certExists: false, dnsStatus: {} });
    }
  }, []);

  useEffect(() => {
    fetchConnections();
    fetchApiKeys();
    fetchAliases();
    fetchCloudSettings();
    fetchMitmStatus();
  }, [fetchMitmStatus]);

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        dispatchData({ type: 'SET_CONNECTIONS', payload: data.connections || [] });
      }
    } catch { /* ignore */ }
  };

  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        dispatchData({ type: 'SET_API_KEYS', payload: data.keys || [] });
      }
    } catch { /* ignore */ }
  };

  const fetchAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      if (res.ok) {
        const data = await res.json();
        dispatchData({ type: 'SET_ALIASES', payload: data.aliases || {} });
      }
    } catch { /* ignore */ }
  };

  const fetchCloudSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        dispatchData({ type: 'SET_CLOUD', payload: data.cloudEnabled || false });
      }
    } catch { /* ignore */ }
  };

  const getActiveProviders = () => connections.filter(c => c.isActive !== false);

  const hasActiveProviders = () => {
    const active = getActiveProviders();
    return active.some(conn =>
      getModelsByProviderId(conn.provider).length > 0 ||
      isOpenAICompatibleProvider(conn.provider) ||
      isAnthropicCompatibleProvider(conn.provider)
    );
  };

  const mitmTools = Object.entries(MITM_TOOLS);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
        <span className="material-symbols-outlined text-[16px] text-yellow-500 mt-0.5 shrink-0">warning</span>
        <p className="text-xs text-red-600 dark:text-yellow-400 leading-relaxed">
          ⚠️ MITM intercepts HTTPS traffic of IDE tools (Antigravity, GitHub Copilot, Kiro) via local CA to redirect requests to your providers. May violate ToS → account ban. Use at your own risk.
        </p>
      </div>

      {/* MITM Server Card */}
      <MitmServerCard
        apiKeys={apiKeys}
        cloudEnabled={cloudEnabled}
        status={mitmStatus}
        onRefresh={fetchMitmStatus}
      />

      {/* Tool Cards */}
      <div className="grid gap-3 sm:gap-4">
        {mitmTools.map(([toolId, tool]) => (
          <MitmToolCard
            key={toolId}
            tool={tool}
            isExpanded={expandedTool === toolId}
            onToggle={() => setExpandedTool(expandedTool === toolId ? null : toolId)}
            serverRunning={mitmStatus.running}
            dnsActive={mitmStatus.dnsStatus?.[toolId] || false}
            hasCachedPassword={mitmStatus.hasCachedPassword || false}
            needsSudoPassword={mitmStatus.needsSudoPassword !== false}
            isWin={mitmStatus.isWin === true}
            apiKeys={apiKeys}
            activeProviders={getActiveProviders()}
            hasActiveProviders={hasActiveProviders()}
            modelAliases={modelAliases}
            cloudEnabled={cloudEnabled}
            onDnsChange={(data) => setDnsStatusOverride(data.dnsStatus ?? null)}
          />
        ))}
      </div>
    </div>
  );
}
