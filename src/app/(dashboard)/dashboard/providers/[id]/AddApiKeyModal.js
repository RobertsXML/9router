"use client";

import { useReducer } from "react";
import PropTypes from "prop-types";
import { Button, Badge, Input, Modal, Select } from "@/shared/components";
import { AI_PROVIDERS } from "@/shared/constants/providers";

const BULK_PLACEHOLDER = `name1|sk-key1\nname2|sk-key2\nsk-key-only-auto-named`;
const NONE_PROXY_POOL_VALUE = "__none__";

const initialFormState = {
  name: "",
  apiKey: "",
  defaultModel: "",
  priority: 1,
  proxyPoolId: NONE_PROXY_POOL_VALUE,
  ollamaHostUrl: "",
  azureEndpoint: "",
  apiVersion: "2024-10-01-preview",
  deployment: "",
  organization: "",
  cloudflareAccountId: "",
  region: "",
  validating: false,
  validationResult: null,
  saving: false,
  mode: "single",
  bulkText: "",
  bulkResult: null,
};

function formReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_VALIDATING":
      return { ...state, validating: action.value };
    case "SET_VALIDATION_RESULT":
      return { ...state, validationResult: action.value };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_MODE":
      return { ...state, mode: action.mode, bulkResult: null };
    case "SET_BULK_RESULT":
      return { ...state, bulkResult: action.value };
    case "SET_REGION":
      return { ...state, region: action.value };
    default:
      return state;
  }
}

const BulkForm = ({ bulkText, bulkResult, saving, onBulkTextChange, onSubmit, onClose }) => (
  <div className="flex flex-col gap-3">
    <p className="text-xs text-text-muted">One key per line. Format: <code>name|apiKey</code> or just <code>apiKey</code> (auto-named by index).</p>
    <textarea
      className="w-full rounded border border-accent/30 bg-sidebar p-2 text-sm font-mono resize-y min-h-[140px] focus:outline-none focus:ring-1 focus:ring-primary"
      placeholder={BULK_PLACEHOLDER}
      value={bulkText}
      onChange={(e) => onBulkTextChange(e.target.value)}
      aria-label="Bulk API keys"
    />
    {bulkResult && (
      <div className={`text-sm font-medium ${bulkResult.failed > 0 ? "text-yellow-400" : "text-green-400"}`}>
        ✓ {bulkResult.success} added{bulkResult.failed > 0 ? `, ✗ ${bulkResult.failed} failed` : ""}
      </div>
    )}
    <div className="flex gap-2">
      <Button onClick={onSubmit} fullWidth disabled={saving || !bulkText.trim()}>
        {saving ? "Adding..." : "Add All Keys"}
      </Button>
      <Button onClick={onClose} variant="ghost" fullWidth>Cancel</Button>
    </div>
  </div>
);

const SingleForm = ({
  state, dispatch, provider, providerFlags, credentialLabel, credentialPlaceholder, providerRegions, error,
  onValidate, onSubmit, onClose,
}) => {
  const { isCompatible, isAnthropic, isOllamaLocal, isCookie, isXaiApiKey, isAzure, isCloudflareAi } = providerFlags;
  const { name, apiKey, defaultModel, priority, proxyPoolId, ollamaHostUrl, azureEndpoint, apiVersion, deployment, organization, cloudflareAccountId, region, validating, validationResult, saving } = state;
  const setField = (field, value) => dispatch({ type: "SET_FIELD", field, value });

  return (
    <>
      <Input
        label="Name"
        value={name}
        onChange={(e) => setField("name", e.target.value)}
        placeholder={isOllamaLocal ? "Ollama Local" : "Production Key"}
      />
      {isOllamaLocal && (
        <div className="flex gap-2">
          <Input
            label="Ollama Host URL"
            value={ollamaHostUrl}
            onChange={(e) => setField("ollamaHostUrl", e.target.value)}
            placeholder="http://localhost:11434"
            className="flex-1"
          />
          <div className="pt-6">
            <Button onClick={onValidate} disabled={validating || saving} variant="secondary">
              {validating ? "Checking..." : "Check"}
            </Button>
          </div>
        </div>
      )}
      {!isOllamaLocal && (
        <div className="flex gap-2">
          <Input
            label={credentialLabel}
            type={isCookie ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setField("apiKey", e.target.value)}
            placeholder={credentialPlaceholder}
            className="flex-1"
          />
          <div className="pt-6">
            <Button onClick={onValidate} disabled={!apiKey || validating || saving} variant="secondary">
              {validating ? "Checking..." : "Check"}
            </Button>
          </div>
        </div>
      )}
      {isXaiApiKey && (
        <p className="text-xs text-text-muted">
          Use a direct xAI API key from console.x.ai. This is separate from Grok Build OAuth.
        </p>
      )}
      {isCookie && state.authHint && (
        <p className="text-xs text-text-muted">
          {state.authHint}
          {state.website && (
            <>
              {" "}
              <a href={state.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Open {state.website.replace(/^https?:\/\//, "")}
              </a>
            </>
          )}
        </p>
      )}
      {providerRegions && (
        <Select
          label="Region"
          value={region}
          onChange={(e) => dispatch({ type: "SET_REGION", value: e.target.value })}
          options={providerRegions.map((r) => ({ value: r.id, label: r.label }))}
        />
      )}
      {isCompatible && (
        <Input
          label="Default Model"
          value={defaultModel}
          onChange={(e) => setField("defaultModel", e.target.value)}
          placeholder={isAnthropic ? "claude-3-5-sonnet-latest" : "gpt-4o-mini"}
        />
      )}
      {isOllamaLocal && (
        <p className="text-xs text-text-muted">
          Leave blank to use <code>http://localhost:11434</code>. For remote Ollama, enter the full host URL (e.g. <code>http://192.168.1.10:11434</code>).
        </p>
      )}
      {validationResult && (
        <Badge variant={validationResult === "success" ? "success" : "error"}>
          {validationResult === "success" ? "Valid" : "Invalid"}
        </Badge>
      )}
      {error && (
        <p className="text-xs text-red-500 break-words">{error}</p>
      )}
      {isCompatible && (
        <p className="text-xs text-text-muted">
          Enter the model ID exactly as your compatible endpoint expects it. This model will be saved as the connection default.
        </p>
      )}
      {isCloudflareAi && (
        <div className="bg-sidebar/50 p-4 rounded-lg border border-accent/20">
          <h3 className="font-semibold mb-3 text-sm">Cloudflare Workers AI</h3>
          <Input
            label="Account ID"
            value={cloudflareAccountId}
            onChange={(e) => setField("cloudflareAccountId", e.target.value)}
            placeholder="abc123def456..."
          />
          <p className="text-xs text-text-muted mt-2">
            Find your Account ID in the right sidebar of <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">dash.cloudflare.com</a>
          </p>
        </div>
      )}
      {isAzure && (
        <div className="bg-sidebar/50 p-4 rounded-lg border border-accent/20">
          <h3 className="font-semibold mb-3 text-sm">Azure OpenAI Configuration</h3>
          <div className="flex flex-col gap-3">
            <Input
              label="Azure Endpoint"
              value={azureEndpoint}
              onChange={(e) => setField("azureEndpoint", e.target.value)}
              placeholder="https://your-resource.openai.azure.com"
            />
            <Input
              label="Deployment Name"
              value={deployment}
              onChange={(e) => setField("deployment", e.target.value)}
              placeholder="gpt-4"
            />
            <Input
              label="API Version"
              value={apiVersion}
              onChange={(e) => setField("apiVersion", e.target.value)}
              placeholder="2024-10-01-preview"
            />
            <Input
              label="Organization"
              value={organization}
              onChange={(e) => setField("organization", e.target.value)}
              placeholder="Organization ID"
            />
          </div>
        </div>
      )}

      <Input
        label="Priority"
        type="number"
        value={priority}
        onChange={(e) => setField("priority", Number.parseInt(e.target.value) || 1)}
      />

      <Select
        label="Proxy Pool"
        value={proxyPoolId}
        onChange={(e) => setField("proxyPoolId", e.target.value)}
        options={[
          { value: NONE_PROXY_POOL_VALUE, label: "None" },
          ...((state.proxyPools || []).map((pool) => ({ value: pool.id, label: pool.name }))),
        ]}
        placeholder="None"
      />

      {((state.proxyPools || []).length === 0) && (
        <p className="text-xs text-text-muted">
          No active proxy pools available. Create one in Proxy Pools page first.
        </p>
      )}

      <p className="text-xs text-text-muted">
        Legacy manual proxy fields are still accepted by API for backward compatibility.
      </p>

      <div className="flex gap-2">
        <Button onClick={onSubmit} fullWidth disabled={saving || (!isOllamaLocal && (!name || !apiKey)) || (isCompatible && !defaultModel.trim()) || (isAzure && (!azureEndpoint || !deployment || !organization)) || (isCloudflareAi && !cloudflareAccountId)}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button onClick={onClose} variant="ghost" fullWidth>
          Cancel
        </Button>
      </div>
    </>
  );
};

export default function AddApiKeyModal({ isOpen, provider, providerName, isCompatible, isAnthropic, authType, authHint, website, proxyPools, error, onSave, onBulkDone, onClose }) {
  const isOllamaLocal = provider === "ollama-local";
  const isCookie = authType === "cookie";
  const isXaiApiKey = provider === "xai" && !isCookie;
  const credentialLabel = isCookie ? "Cookie Value" : "API Key";
  const credentialPlaceholder = isCookie
    ? (provider === "grok-web" ? "sso=xxxxx... or just the raw value" : "eyJhbGciOi...")
    : (isXaiApiKey ? "xai-..." : "");

  const isAzure = provider === "azure";
  const isCloudflareAi = provider === "cloudflare-ai";
  const providerRegions = AI_PROVIDERS?.[provider]?.regions || null;
  const defaultRegion = AI_PROVIDERS?.[provider]?.defaultRegion || providerRegions?.[0]?.id || "";

  const [state, dispatch] = useReducer(formReducer, {
    ...initialFormState,
    region: defaultRegion,
  });

  const buildProviderSpecificData = () => {
    if (isOllamaLocal && state.ollamaHostUrl.trim()) {
      return { baseUrl: state.ollamaHostUrl.trim() };
    }
    if (isAzure) {
      return {
        azureEndpoint: state.azureEndpoint,
        apiVersion: state.apiVersion,
        deployment: state.deployment,
        organization: state.organization,
      };
    }
    if (isCloudflareAi) {
      return { accountId: state.cloudflareAccountId };
    }
    if (providerRegions && state.region) {
      return { region: state.region };
    }
    return undefined;
  };

  const handleValidate = async () => {
    dispatch({ type: "SET_VALIDATING", value: true });
    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: state.apiKey, providerSpecificData: buildProviderSpecificData() }),
      });
      const data = await res.json();
      dispatch({ type: "SET_VALIDATION_RESULT", value: data.valid ? "success" : "failed" });
    } catch {
      dispatch({ type: "SET_VALIDATION_RESULT", value: "failed" });
    } finally {
      dispatch({ type: "SET_VALIDATING", value: false });
    }
  };

  const handleSubmit = async () => {
    if (!provider) return;
    if (!isOllamaLocal && !state.apiKey) return;
    if (!isOllamaLocal) {
      if (!state.name) return;
    }
    if (isCompatible && !state.defaultModel.trim()) return;

    dispatch({ type: "SET_SAVING", value: true });
    try {
      let isValid = false;
      try {
        dispatch({ type: "SET_VALIDATING", value: true });
        dispatch({ type: "SET_VALIDATION_RESULT", value: null });
        const res = await fetch("/api/providers/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey: state.apiKey, providerSpecificData: buildProviderSpecificData() }),
        });
        const data = await res.json();
        isValid = !!data.valid;
        dispatch({ type: "SET_VALIDATION_RESULT", value: isValid ? "success" : "failed" });
      } catch {
        dispatch({ type: "SET_VALIDATION_RESULT", value: "failed" });
      } finally {
        dispatch({ type: "SET_VALIDATING", value: false });
      }

      await onSave({
        name: state.name || (isOllamaLocal ? "Ollama Local" : ""),
        apiKey: state.apiKey,
        defaultModel: isCompatible ? state.defaultModel.trim() : undefined,
        priority: state.priority,
        proxyPoolId: state.proxyPoolId === NONE_PROXY_POOL_VALUE ? null : state.proxyPoolId,
        testStatus: isValid ? "active" : "unknown",
        providerSpecificData: buildProviderSpecificData()
      });
    } finally {
      dispatch({ type: "SET_SAVING", value: false });
    }
  };

  const handleBulkSubmit = async () => {
    const lines = state.bulkText.split("\n").flatMap((l) => { const t = l.trim(); return t ? [t] : []; });
    if (!lines.length) return;
    dispatch({ type: "SET_SAVING", value: true });
    dispatch({ type: "SET_BULK_RESULT", value: null });
    const results = await Promise.all(lines.map(async (line, i) => {
      const parts = line.split("|");
      const apiKey = parts.length >= 2 ? parts.slice(1).join("|").trim() : parts[0].trim();
      const baseName = parts.length >= 2 ? parts[0].trim() : "Key";
      const name = `${baseName} ${i + 1}`;
      try {
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey, name, priority: 1, testStatus: "unknown" }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }));
    const success = results.filter(Boolean).length;
    const failed = results.length - success;
    dispatch({ type: "SET_SAVING", value: false });
    dispatch({ type: "SET_BULK_RESULT", value: { success, failed } });
    if (success > 0 && onBulkDone) onBulkDone();
  };

  if (!provider) return null;

  return (
    <Modal isOpen={isOpen} title={`Add ${providerName || provider} ${credentialLabel}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button size="sm" variant={state.mode === "single" ? "primary" : "ghost"} onClick={() => dispatch({ type: "SET_MODE", mode: "single" })}>Single</Button>
          <Button size="sm" variant={state.mode === "bulk" ? "primary" : "ghost"} onClick={() => dispatch({ type: "SET_MODE", mode: "bulk" })}>Bulk Add</Button>
        </div>

        {state.mode === "bulk" && (
          <BulkForm
            bulkText={state.bulkText}
            bulkResult={state.bulkResult}
            saving={state.saving}
            onBulkTextChange={(value) => dispatch({ type: "SET_FIELD", field: "bulkText", value })}
            onSubmit={handleBulkSubmit}
            onClose={onClose}
          />
        )}

        {state.mode === "single" && (
          <SingleForm
            state={{ ...state, proxyPools, authHint, website }}
            dispatch={dispatch}
            provider={provider}
            providerFlags={{ isCompatible, isAnthropic, isOllamaLocal, isCookie, isXaiApiKey, isAzure, isCloudflareAi }}
            credentialLabel={credentialLabel}
            credentialPlaceholder={credentialPlaceholder}
            providerRegions={providerRegions}
            error={error}
            onValidate={handleValidate}
            onSubmit={handleSubmit}
            onClose={onClose}
          />
        )}
      </div>
    </Modal>
  );
}

AddApiKeyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  provider: PropTypes.string,
  providerName: PropTypes.string,
  isCompatible: PropTypes.bool,
  isAnthropic: PropTypes.bool,
  authType: PropTypes.string,
  authHint: PropTypes.string,
  website: PropTypes.string,
  proxyPools: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
  })),
  error: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onBulkDone: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
