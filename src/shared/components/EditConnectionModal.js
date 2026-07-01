"use client";

import { useReducer, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import Modal from "@/shared/components/Modal";
import Input from "@/shared/components/Input";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";

const initialState = {
  formData: { name: "", priority: 1, apiKey: "" },
  azureData: { azureEndpoint: "", apiVersion: "2024-10-01-preview", deployment: "", organization: "" },
  cloudflareData: { accountId: "" },
  testing: false,
  testResult: null,
  validating: false,
  validationResult: null,
  saving: false,
};

function editConnectionReducer(state, action) {
  switch (action.type) {
    case "SET_FORM_DATA":
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case "SET_AZURE_DATA":
      return { ...state, azureData: { ...state.azureData, ...action.payload } };
    case "SET_CLOUDFLARE_DATA":
      return { ...state, cloudflareData: { ...state.cloudflareData, ...action.payload } };
    case "TEST_START":
      return { ...state, testing: true, testResult: null };
    case "TEST_RESULT":
      return { ...state, testing: false, testResult: action.result };
    case "VALIDATE_START":
      return { ...state, validating: true, validationResult: null };
    case "VALIDATE_RESULT":
      return { ...state, validating: false, validationResult: action.result };
    case "SAVE_START":
      return { ...state, saving: true };
    case "SAVE_END":
      return { ...state, saving: false };
    case "RESET_FORM":
      return {
        ...state,
        formData: action.formData || initialState.formData,
        azureData: action.azureData || initialState.azureData,
        cloudflareData: action.cloudflareData || initialState.cloudflareData,
        testResult: null,
        validationResult: null,
      };
    default:
      return state;
  }
}

export default function EditConnectionModal({ isOpen, connection, proxyPools, onSave, onClose }) {
  const [state, dispatch] = useReducer(editConnectionReducer, initialState);
  const { formData, azureData, cloudflareData, testing, testResult, validating, validationResult, saving } = state;

  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn) return () => {};
    const newFormData = { name: conn.name || "", priority: conn.priority || 1, apiKey: "" };
    let newAzureData = initialState.azureData;
    if (conn.provider === "azure" && conn.providerSpecificData) {
      newAzureData = {
        azureEndpoint: conn.providerSpecificData.azureEndpoint || "",
        apiVersion: conn.providerSpecificData.apiVersion || "2024-10-01-preview",
        deployment: conn.providerSpecificData.deployment || "",
        organization: conn.providerSpecificData.organization || "",
      };
    }
    let newCloudflareData = initialState.cloudflareData;
    if (conn.provider === "cloudflare-ai" && conn.providerSpecificData) {
      newCloudflareData = { accountId: conn.providerSpecificData.accountId || "" };
    }
    dispatch({ type: "RESET_FORM", formData: newFormData, azureData: newAzureData, cloudflareData: newCloudflareData });
    return () => {};
  }, []);

  const isOAuth = connection?.authType === "oauth";
  const isAzure = connection?.provider === "azure";
  const isCloudflareAi = connection?.provider === "cloudflare-ai";
  const isCompatible = connection
    ? (isOpenAICompatibleProvider(connection.provider) || isAnthropicCompatibleProvider(connection.provider))
    : false;

  const handleTest = async () => {
    if (!connection?.provider) return;
    dispatch({ type: "TEST_START" });
    try {
      const res = await fetch(`/api/providers/${connection.id}/test`, { method: "POST" });
      const data = await res.json();
      dispatch({ type: "TEST_RESULT", result: data.valid ? "success" : "failed" });
    } catch {
      dispatch({ type: "TEST_RESULT", result: "failed" });
    }
  };

  const handleValidate = async () => {
    if (!connection?.provider || !formData.apiKey) return;
    dispatch({ type: "VALIDATE_START" });
    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: connection.provider,
          apiKey: formData.apiKey,
          ...(isAzure ? { providerSpecificData: azureData } : {}),
          ...(isCloudflareAi ? { providerSpecificData: cloudflareData } : {}),
        }),
      });
      const data = await res.json();
      dispatch({ type: "VALIDATE_RESULT", result: data.valid ? "success" : "failed" });
    } catch {
      dispatch({ type: "VALIDATE_RESULT", result: "failed" });
    }
  };

  const handleSubmit = async () => {
    if (!connection) return;
    dispatch({ type: "SAVE_START" });
    try {
      const updates = {
        name: formData.name,
        priority: formData.priority,
      };
      if (!isOAuth && formData.apiKey) {
        updates.apiKey = formData.apiKey;
        let isValid = validationResult === "success";
        if (!isValid) {
          try {
            dispatch({ type: "VALIDATE_START" });
            const res = await fetch("/api/providers/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: connection.provider,
                apiKey: formData.apiKey,
                ...(isAzure ? { providerSpecificData: azureData } : {}),
                ...(isCloudflareAi ? { providerSpecificData: cloudflareData } : {}),
              }),
            });
            const data = await res.json();
            isValid = !!data.valid;
            dispatch({ type: "VALIDATE_RESULT", result: isValid ? "success" : "failed" });
          } catch {
            dispatch({ type: "VALIDATE_RESULT", result: "failed" });
          }
        }
        if (isValid) {
          updates.testStatus = "active";
          updates.lastError = null;
          updates.lastErrorAt = null;
        }
      }
      
      // Add Azure-specific data if this is an Azure connection
      if (isAzure) {
        updates.providerSpecificData = {
          azureEndpoint: azureData.azureEndpoint,
          apiVersion: azureData.apiVersion,
          deployment: azureData.deployment,
          organization: azureData.organization,
        };
      }
      if (isCloudflareAi) {
        updates.providerSpecificData = { accountId: cloudflareData.accountId };
      }
      
      await onSave(updates);
    } finally {
      dispatch({ type: "SAVE_END" });
    }
  };

  if (!connection) return null;

  return (
    <Modal isOpen={isOpen} title="Edit Connection" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => dispatch({ type: "SET_FORM_DATA", payload: { name: e.target.value } })}
          placeholder={isOAuth ? "Account name" : "Production Key"}
        />
        {isOAuth && connection.email && (
          <div className="bg-sidebar/50 p-3 rounded-lg">
            <p className="text-sm text-text-muted mb-1">Email</p>
            <p className="font-medium">{connection.email}</p>
          </div>
        )}
        <Input
          label="Priority"
          type="number"
          value={formData.priority}
          onChange={(e) => dispatch({ type: "SET_FORM_DATA", payload: { priority: Number.parseInt(e.target.value, 10) || 1 } })}
        />

        {!isOAuth && (
          <>
            <div className="flex gap-2">
              <Input
                label="API Key"
                type="password"
                value={formData.apiKey}
                onChange={(e) => dispatch({ type: "SET_FORM_DATA", payload: { apiKey: e.target.value } })}
                placeholder="Enter new API key"
                hint="Leave blank to keep the current API key."
                className="flex-1"
              />
              <div className="pt-6">
                <Button onClick={handleValidate} disabled={!formData.apiKey || validating || saving} variant="secondary">
                  {validating ? "Checking..." : "Check"}
                </Button>
              </div>
            </div>
            {validationResult && (
              <Badge variant={validationResult === "success" ? "success" : "error"}>
                {validationResult === "success" ? "Valid" : "Invalid"}
              </Badge>
            )}
          </>
        )}

        {isAzure && (
          <div className="bg-sidebar/50 p-4 rounded-lg border border-accent/20">
            <h3 className="font-semibold mb-3 text-sm">Azure OpenAI Configuration</h3>
            <div className="flex flex-col gap-3">
              <Input
                label="Azure Endpoint"
                value={azureData.azureEndpoint}
                onChange={(e) => dispatch({ type: "SET_AZURE_DATA", payload: { azureEndpoint: e.target.value } })}
                placeholder="https://your-resource.openai.azure.com"
                hint="Your Azure OpenAI resource endpoint URL"
              />
              <Input
                label="Deployment Name"
                value={azureData.deployment}
                onChange={(e) => dispatch({ type: "SET_AZURE_DATA", payload: { deployment: e.target.value } })}
                placeholder="gpt-4"
                hint="The deployment name in your Azure resource"
              />
              <Input
                label="API Version"
                value={azureData.apiVersion}
                onChange={(e) => dispatch({ type: "SET_AZURE_DATA", payload: { apiVersion: e.target.value } })}
                placeholder="2024-10-01-preview"
                hint="Azure OpenAI API version to use"
              />
              <Input
                label="Organization"
                value={azureData.organization}
                onChange={(e) => dispatch({ type: "SET_AZURE_DATA", payload: { organization: e.target.value } })}
                placeholder="Organization ID"
                hint="Required for billing"
              />
            </div>
          </div>
        )}

        {!isCompatible && !isAzure && !isCloudflareAi && (
          <div className="flex items-center gap-3">
            <Button onClick={handleTest} variant="secondary" disabled={testing}>
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            {testResult && (
              <Badge variant={testResult === "success" ? "success" : "error"}>
                {testResult === "success" ? "Valid" : "Failed"}
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSubmit} fullWidth disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button onClick={onClose} variant="ghost" fullWidth>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

EditConnectionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  connection: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
    priority: PropTypes.number,
    authType: PropTypes.string,
    provider: PropTypes.string,
    providerSpecificData: PropTypes.object,
  }),
  proxyPools: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
  })),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

