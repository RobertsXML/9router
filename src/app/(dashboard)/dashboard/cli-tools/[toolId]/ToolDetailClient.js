"use client";

import { useState, useEffect, useCallback, useMemo, useReducer } from "react";
import Link from "next/link";
import { CardSkeleton } from "@/shared/components";
import { CLI_TOOLS } from "@/shared/constants/cliTools";
import { getModelsByProviderId, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import ClaudeToolCard from "../components/ClaudeToolCard";
import CodexToolCard from "../components/CodexToolCard";
import DroidToolCard from "../components/DroidToolCard";
import OpenClawToolCard from "../components/OpenClawToolCard";
import HermesToolCard from "../components/HermesToolCard";
import DefaultToolCard from "../components/DefaultToolCard";
import OpenCodeToolCard from "../components/OpenCodeToolCard";
import CoworkToolCard from "../components/CoworkToolCard";
import CopilotToolCard from "../components/CopilotToolCard";
import ClineToolCard from "../components/ClineToolCard";
import KiloToolCard from "../components/KiloToolCard";
import DeepSeekTuiToolCard from "../components/DeepSeekTuiToolCard";
import JcodeToolCard from "../components/JcodeToolCard";

const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL;

function dataReducer(state, action) {
  switch (action.type) {
    case 'SET_CONNECTIONS': return { ...state, connections: action.payload };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_CLOUD': return { ...state, cloudEnabled: action.payload };
    case 'SET_TUNNEL': return { ...state, tunnelEnabled: action.payload.tunnelEnabled, tunnelPublicUrl: action.payload.tunnelPublicUrl, tailscaleEnabled: action.payload.tailscaleEnabled, tailscaleUrl: action.payload.tailscaleUrl };
    case 'SET_API_KEYS': return { ...state, apiKeys: action.payload };
    default: return state;
  }
}

export default function ToolDetailClient({ toolId, machineId }) {
  const tool = CLI_TOOLS[toolId];
  const [{ connections, loading, cloudEnabled, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl, apiKeys }, dispatchData] = useReducer(dataReducer, { connections: [], loading: true, cloudEnabled: false, tunnelEnabled: false, tunnelPublicUrl: "", tailscaleEnabled: false, tailscaleUrl: "", apiKeys: [] });
  const [modelMappings, setModelMappings] = useState({});

  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;
    (async () => {
      try {
        const [provRes, settingsRes, tunnelRes, keysRes] = await Promise.all([
          fetch("/api/providers", { signal: ac.signal }),
          fetch("/api/settings", { signal: ac.signal }),
          fetch("/api/tunnel/status", { signal: ac.signal }),
          fetch("/api/keys", { signal: ac.signal }),
        ]);
        if (!mounted) return;
        if (provRes.ok) {
          const data = await provRes.json();
          dispatchData({ type: 'SET_CONNECTIONS', payload: data.connections || [] });
        }
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          dispatchData({ type: 'SET_CLOUD', payload: data.cloudEnabled || false });
        }
        if (tunnelRes.ok) {
          const data = await tunnelRes.json();
          dispatchData({ type: 'SET_TUNNEL', payload: {
            tunnelEnabled: !!(data.tunnel?.enabled || data.tunnel?.settingsEnabled),
            tunnelPublicUrl: data.tunnel?.publicUrl || "",
            tailscaleEnabled: !!(data.tailscale?.enabled || data.tailscale?.settingsEnabled),
            tailscaleUrl: data.tailscale?.tunnelUrl || "",
          }});
        }
        if (keysRes.ok) {
          const data = await keysRes.json();
          dispatchData({ type: 'SET_API_KEYS', payload: data.keys || [] });
        }
      } catch (error) {
        if (error.name !== "AbortError") console.log("Error loading tool data:", error);
      } finally {
        if (mounted) dispatchData({ type: 'SET_LOADING', payload: false });
      }
    })();
    return () => { mounted = false; ac.abort(); };
  }, []);

  const activeProviders = useMemo(() => connections.filter(c => c.isActive !== false), [connections]);

  const allAvailableModels = useMemo(() => {
    const models = [];
    const seenModels = new Set();
    for (const conn of activeProviders) {
      const alias = PROVIDER_ID_TO_ALIAS[conn.provider] || conn.provider;
      for (const m of getModelsByProviderId(conn.provider)) {
        const modelValue = `${alias}/${m.id}`;
        if (!seenModels.has(modelValue)) {
          seenModels.add(modelValue);
          models.push({ value: modelValue, label: modelValue, provider: conn.provider, alias, connectionName: conn.name, modelId: m.id });
        }
      }
    }
    return models;
  }, [activeProviders]);

  const baseUrl = useMemo(() => {
    if (tunnelEnabled && tunnelPublicUrl) return tunnelPublicUrl;
    if (cloudEnabled && CLOUD_URL) return CLOUD_URL;
    if (typeof window !== "undefined") return window.location.origin;
    return "http://localhost:20128";
  }, [tunnelEnabled, tunnelPublicUrl, cloudEnabled]);

  const handleModelMappingChange = useCallback((tId, alias, target) => {
    setModelMappings(prev => {
      if (prev[tId]?.[alias] === target) return prev;
      return { ...prev, [tId]: { ...prev[tId], [alias]: target } };
    });
  }, []);

  const renderToolCard = () => {
    const hasActiveProviders = allAvailableModels.length > 0;
    const commonProps = {
      tool,
      isExpanded: true,
      onToggle: () => {},
      baseUrl,
      apiKeys,
      tunnelEnabled,
      tunnelPublicUrl,
      tailscaleEnabled,
      tailscaleUrl,
    };

    switch (toolId) {
      case "claude":
        return <ClaudeToolCard {...commonProps} activeProviders={activeProviders} modelMappings={modelMappings[toolId] || {}} onModelMappingChange={(a, t) => handleModelMappingChange(toolId, a, t)} hasActiveProviders={hasActiveProviders} cloudEnabled={cloudEnabled} />;
      case "codex":
        return <CodexToolCard {...commonProps} activeProviders={activeProviders} cloudEnabled={cloudEnabled} />;
      case "opencode":
        return <OpenCodeToolCard {...commonProps} activeProviders={activeProviders} cloudEnabled={cloudEnabled} />;
      case "cowork":
        return <CoworkToolCard {...commonProps} activeProviders={activeProviders} hasActiveProviders={hasActiveProviders} cloudEnabled={cloudEnabled} cloudUrl={CLOUD_URL} tunnelEnabled={tunnelEnabled} tunnelPublicUrl={tunnelPublicUrl} tailscaleEnabled={tailscaleEnabled} tailscaleUrl={tailscaleUrl} />;
      case "droid":
        return <DroidToolCard {...commonProps} activeProviders={activeProviders} hasActiveProviders={hasActiveProviders} cloudEnabled={cloudEnabled} />;
      case "openclaw":
        return <OpenClawToolCard {...commonProps} activeProviders={activeProviders} hasActiveProviders={hasActiveProviders} cloudEnabled={cloudEnabled} />;
      case "hermes":
        return <HermesToolCard {...commonProps} activeProviders={activeProviders} hasActiveProviders={hasActiveProviders} cloudEnabled={cloudEnabled} />;
      case "copilot":
        return <CopilotToolCard {...commonProps} activeProviders={activeProviders} cloudEnabled={cloudEnabled} />;
      case "cline":
        return <ClineToolCard {...commonProps} activeProviders={activeProviders} cloudEnabled={cloudEnabled} />;
      case "kilo":
        return <KiloToolCard {...commonProps} activeProviders={activeProviders} cloudEnabled={cloudEnabled} />;
      case "deepseek-tui":
        return <DeepSeekTuiToolCard {...commonProps} activeProviders={activeProviders} hasActiveProviders={hasActiveProviders} cloudEnabled={cloudEnabled} />;
      case "jcode":
        return <JcodeToolCard {...commonProps} activeProviders={activeProviders} hasActiveProviders={hasActiveProviders} cloudEnabled={cloudEnabled} />;
      default:
        return <DefaultToolCard toolId={toolId} {...commonProps} activeProviders={activeProviders} cloudEnabled={cloudEnabled} tunnelEnabled={tunnelEnabled} />;
    }
  };

  // Guard removed/unknown tools (e.g. disabled Cowork) to avoid crash on direct URL.
  if (!tool) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-1 sm:px-0">
        <Link href="/dashboard/cli-tools" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary w-fit">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to CLI Tools
        </Link>
        <p className="text-sm text-text-muted">Tool not found or disabled.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-1 sm:px-0">
      <Link href="/dashboard/cli-tools" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary w-fit">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to CLI Tools
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text-main sm:text-2xl">{tool.name}</h1>
        <p className="text-sm text-text-muted">{tool.description}</p>
      </div>
      {loading ? <CardSkeleton /> : renderToolCard()}
    </div>
  );
}
