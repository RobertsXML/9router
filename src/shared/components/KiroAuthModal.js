"use client";

import { useReducer, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input } from "@/shared/components";

const initialState = {
  selectedMethod: null,
  idcStartUrl: "",
  idcRegion: "us-east-1",
  refreshToken: "",
  cliProxyJson: "",
  apiKey: "",
  apiKeyRegion: "us-east-1",
  error: null,
  importing: false,
  autoDetecting: false,
  autoDetected: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SELECT_METHOD":
      return { ...state, selectedMethod: action.method, error: null };
    case "GO_BACK":
      return { ...state, selectedMethod: null, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "AUTO_DETECT_START":
      return { ...state, autoDetecting: true, error: null, autoDetected: false };
    case "AUTO_DETECT_DONE":
      return { ...state, autoDetecting: false, autoDetected: true, refreshToken: action.refreshToken };
    case "AUTO_DETECT_FAIL":
      return { ...state, autoDetecting: false, error: action.error };
    case "IMPORT_START":
      return { ...state, importing: true, error: null };
    case "IMPORT_END":
      return { ...state, importing: false };
    default:
      return state;
  }
}

function MethodSelectionList({ onMethodSelect, onSelectWithDispatch }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted mb-4">
        Choose your authentication method:
      </p>

      {/* AWS Builder ID */}
      <button
        type="button"
        onClick={() => onMethodSelect("builder-id")}
        className="w-full p-4 text-left border border-border rounded-lg hover:bg-sidebar transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">shield</span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">AWS Builder ID</h3>
            <p className="text-sm text-text-muted">
              Recommended for most users. Free AWS account required.
            </p>
          </div>
        </div>
      </button>

      {/* AWS IAM Identity Center (IDC) */}
      <button
        type="button"
        onClick={() => onSelectWithDispatch("idc")}
        className="w-full p-4 text-left border border-border rounded-lg hover:bg-sidebar transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">business</span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">AWS IAM Identity Center</h3>
            <p className="text-sm text-text-muted">
              For enterprise users with custom AWS IAM Identity Center.
            </p>
          </div>
        </div>
      </button>

      {/* AWS API Key */}
      <button
        type="button"
        onClick={() => onSelectWithDispatch("api-key")}
        className="w-full p-4 text-left border border-border rounded-lg hover:bg-sidebar transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">key</span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">API Key</h3>
            <p className="text-sm text-text-muted">
              Use a long-lived Kiro/CodeWhisperer API key (headless auth).
            </p>
          </div>
        </div>
      </button>

      {/* Google Social Login - HIDDEN */}
      <button
        type="button"
        onClick={() => onSelectWithDispatch("social-google")}
        className="hidden w-full p-4 text-left border border-border rounded-lg hover:bg-sidebar transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">account_circle</span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Google Account</h3>
            <p className="text-sm text-text-muted">
              Login with your Google account (manual callback).
            </p>
          </div>
        </div>
      </button>

      {/* GitHub Social Login - HIDDEN */}
      <button
        type="button"
        onClick={() => onSelectWithDispatch("social-github")}
        className="hidden w-full p-4 text-left border border-border rounded-lg hover:bg-sidebar transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">code</span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">GitHub Account</h3>
            <p className="text-sm text-text-muted">
              Login with your GitHub account (manual callback).
            </p>
          </div>
        </div>
      </button>

      {/* Import Token */}
      <button
        type="button"
        onClick={() => onSelectWithDispatch("import")}
        className="w-full p-4 text-left border border-border rounded-lg hover:bg-sidebar transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">file_upload</span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Import Token</h3>
            <p className="text-sm text-text-muted">
              Paste refresh token from Kiro IDE.
            </p>
          </div>
        </div>
      </button>

      {/* Import CLIProxyAPI JSON */}
      <button
        type="button"
        onClick={() => onSelectWithDispatch("import-cli-proxy")}
        className="w-full p-4 text-left border border-border rounded-lg hover:bg-sidebar transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">data_object</span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Import CLIProxyAPI JSON</h3>
            <p className="text-sm text-text-muted">
              Paste external_idp auth JSON from CLIProxyAPI/Kiro Microsoft login.
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

function IdcConfigForm({ idcStartUrl, idcRegion, error, onFieldChange, onContinue, onBack }) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="kiro-idc-start-url" className="block text-sm font-medium mb-2">
          IDC Start URL <span className="text-red-500">*</span>
        </label>
        <Input
          id="kiro-idc-start-url"
          value={idcStartUrl}
          onChange={(e) => onFieldChange("idcStartUrl", e.target.value)}
          placeholder="https://your-org.awsapps.com/start"
          className="font-mono text-sm"
        />
        <p className="text-xs text-text-muted mt-1">
          Your organization&apos;s AWS IAM Identity Center URL
        </p>
      </div>

      <div>
        <label htmlFor="kiro-idc-region" className="block text-sm font-medium mb-2">
          AWS Region
        </label>
        <Input
          id="kiro-idc-region"
          value={idcRegion}
          onChange={(e) => onFieldChange("idcRegion", e.target.value)}
          placeholder="us-east-1"
          className="font-mono text-sm"
        />
        <p className="text-xs text-text-muted mt-1">
          AWS region for your Identity Center (default: us-east-1)
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <Button onClick={onContinue} fullWidth>
          Continue
        </Button>
        <Button onClick={onBack} variant="ghost" fullWidth>
          Back
        </Button>
      </div>
    </div>
  );
}

function ApiKeyForm({ apiKey, apiKeyRegion, error, importing, onFieldChange, onImport, onBack }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex gap-2">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Paste a long-lived Kiro/CodeWhisperer API key. It is validated
            against AWS and stored directly as a bearer credential (no refresh).
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="kiro-api-key" className="block text-sm font-medium mb-2">
          API Key <span className="text-red-500">*</span>
        </label>
        <Input
          id="kiro-api-key"
          value={apiKey}
          onChange={(e) => onFieldChange("apiKey", e.target.value)}
          placeholder="Paste your Kiro API key..."
          className="font-mono text-sm"
        />
      </div>

      <div>
        <label htmlFor="kiro-api-key-region" className="block text-sm font-medium mb-2">
          AWS Region
        </label>
        <Input
          id="kiro-api-key-region"
          value={apiKeyRegion}
          onChange={(e) => onFieldChange("apiKeyRegion", e.target.value)}
          placeholder="us-east-1"
          className="font-mono text-sm"
        />
        <p className="text-xs text-text-muted mt-1">
          AWS region for the key (default: us-east-1)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onImport} fullWidth disabled={importing || !apiKey.trim()}>
          {importing ? "Validating..." : "Add API Key"}
        </Button>
        <Button onClick={onBack} variant="ghost" fullWidth>
          Back
        </Button>
      </div>
    </div>
  );
}

function ImportTokenForm({ refreshToken, error, importing, autoDetecting, autoDetected, onFieldChange, onImport, onBack }) {
  return (
    <div className="space-y-4">
      {/* Auto-detecting state */}
      {autoDetecting && (
        <div className="text-center py-6">
          <div className="size-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-primary animate-spin">
              progress_activity
            </span>
          </div>
          <h3 className="text-lg font-semibold mb-2">Auto-detecting token...</h3>
          <p className="text-sm text-text-muted">
            Reading from AWS SSO cache
          </p>
        </div>
      )}

      {/* Form (shown after auto-detect completes) */}
      {!autoDetecting && (
        <>
          {/* Success message if auto-detected */}
          {autoDetected && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Token auto-detected from Kiro IDE successfully!
                </p>
              </div>
            </div>
          )}

          {/* Info message if not auto-detected */}
          {!autoDetected && !error && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Kiro IDE not detected. Please paste your refresh token manually.
                </p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="kiro-refresh-token" className="block text-sm font-medium mb-2">
              Refresh Token <span className="text-red-500">*</span>
            </label>
            <Input
              id="kiro-refresh-token"
              value={refreshToken}
              onChange={(e) => onFieldChange("refreshToken", e.target.value)}
              placeholder="Token will be auto-filled..."
              className="font-mono text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={onImport} fullWidth disabled={importing || !refreshToken.trim()}>
              {importing ? "Importing..." : "Import Token"}
            </Button>
            <Button onClick={onBack} variant="ghost" fullWidth>
              Back
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ImportCliProxyForm({ cliProxyJson, error, importing, onFieldChange, onImport, onBack }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex gap-2">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Paste the Kiro CLIProxyAPI auth JSON containing auth_method=external_idp. Only Microsoft login token endpoints are accepted.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="kiro-cli-proxy-json" className="block text-sm font-medium mb-2">
          CLIProxyAPI Auth JSON <span className="text-red-500">*</span>
        </label>
        <textarea
          id="kiro-cli-proxy-json"
          value={cliProxyJson}
          onChange={(e) => onFieldChange("cliProxyJson", e.target.value)}
          placeholder={'{"auth_method":"external_idp","access_token":"...","refresh_token":"...","client_id":"...","token_endpoint":"https://login.microsoftonline.com/.../oauth2/v2.0/token","profile_arn":"...","scopes":"..."}'}
          className="min-h-40 w-full rounded-md border border-border bg-background p-3 font-mono text-sm outline-none focus:border-primary"
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onImport} fullWidth disabled={importing || !cliProxyJson.trim()}>
          {importing ? "Importing..." : "Import CLIProxyAPI JSON"}
        </Button>
        <Button onClick={onBack} variant="ghost" fullWidth>
          Back
        </Button>
      </div>
    </div>
  );
}

/**
 * Kiro Auth Method Selection Modal
 * Auto-detects token from AWS SSO cache or allows manual import
 */
export default function KiroAuthModal({ isOpen, onMethodSelect, onClose }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { selectedMethod, idcStartUrl, idcRegion, refreshToken, cliProxyJson, apiKey, apiKeyRegion, error, importing, autoDetecting, autoDetected } = state;
  const idcCredentialsRef = useRef(null);

  // Auto-detect token when import method is selected
  useEffect(() => {
    if (selectedMethod !== "import" || !isOpen) return;
    const controller = new AbortController();

    const autoDetect = async () => {
      dispatch({ type: "AUTO_DETECT_START" });
      idcCredentialsRef.current = null;

      try {
        const res = await fetch("/api/oauth/kiro/auto-import", { signal: controller.signal });
        const data = await res.json();

        if (data.found) {
          dispatch({ type: "AUTO_DETECT_DONE", refreshToken: data.refreshToken });
          // Store IDC/organization credentials if present
          if (data.clientId && data.clientSecret) {
            idcCredentialsRef.current = {
              clientId: data.clientId,
              clientSecret: data.clientSecret,
              region: data.region,
              authMethod: data.authMethod,
              profileArn: data.profileArn,
            };
          }
        } else {
          dispatch({ type: "AUTO_DETECT_FAIL", error: data.error || "Could not auto-detect token" });
        }
      } catch (err) {
        if (err.name !== "AbortError") dispatch({ type: "AUTO_DETECT_FAIL", error: "Failed to auto-detect token" });
      }
    };

    autoDetect();
    return () => controller.abort();
  }, [selectedMethod, isOpen]);

  const handleMethodSelect = (method) => {
    dispatch({ type: "SELECT_METHOD", method });
  };

  const handleBack = () => {
    dispatch({ type: "GO_BACK" });
  };

  const handleImportToken = async () => {
    if (!refreshToken.trim()) {
      dispatch({ type: "SET_ERROR", error: "Please enter a refresh token" });
      return;
    }

    dispatch({ type: "IMPORT_START" });

    try {
      const res = await fetch("/api/oauth/kiro/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken: refreshToken.trim(),
          ...(idcCredentialsRef.current || {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      // Success - notify parent to refresh connections
      onMethodSelect("import");
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err.message });
    } finally {
      dispatch({ type: "IMPORT_END" });
    }
  };

  const handleImportCliProxyJson = async () => {
    if (!cliProxyJson.trim()) {
      dispatch({ type: "SET_ERROR", error: "Please paste CLIProxyAPI auth JSON" });
      return;
    }

    dispatch({ type: "IMPORT_START" });

    try {
      const res = await fetch("/api/oauth/kiro/import-cli-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: cliProxyJson.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "CLIProxyAPI import failed");
      }

      onMethodSelect("import-cli-proxy");
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err.message });
    } finally {
      dispatch({ type: "IMPORT_END" });
    }
  };

  const handleIdcContinue = () => {
    if (!idcStartUrl.trim()) {
      dispatch({ type: "SET_ERROR", error: "Please enter your IDC start URL" });
      return;
    }
    onMethodSelect("idc", { startUrl: idcStartUrl.trim(), region: idcRegion });
  };

  const handleApiKeyImport = async () => {
    if (!apiKey.trim()) {
      dispatch({ type: "SET_ERROR", error: "Please enter an API key" });
      return;
    }

    dispatch({ type: "IMPORT_START" });

    try {
      const res = await fetch("/api/oauth/kiro/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          region: apiKeyRegion.trim() || "us-east-1",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      // Success - notify parent to refresh connections
      onMethodSelect("api-key");
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err.message });
    } finally {
      dispatch({ type: "IMPORT_END" });
    }
  };

  const handleSocialLogin = (provider) => {
    onMethodSelect("social", { provider });
  };

  return (
    <Modal isOpen={isOpen} title="Connect Kiro" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        {/* Method Selection */}
        {!selectedMethod && (
          <MethodSelectionList
            onMethodSelect={onMethodSelect}
            onSelectWithDispatch={handleMethodSelect}
          />
        )}

        {/* IDC Configuration */}
        {selectedMethod === "idc" && (
          <IdcConfigForm
            idcStartUrl={idcStartUrl}
            idcRegion={idcRegion}
            error={error}
            onFieldChange={(field, value) => dispatch({ type: "SET_FIELD", field, value })}
            onContinue={handleIdcContinue}
            onBack={handleBack}
          />
        )}

        {/* API Key */}
        {selectedMethod === "api-key" && (
          <ApiKeyForm
            apiKey={apiKey}
            apiKeyRegion={apiKeyRegion}
            error={error}
            importing={importing}
            onFieldChange={(field, value) => dispatch({ type: "SET_FIELD", field, value })}
            onImport={handleApiKeyImport}
            onBack={handleBack}
          />
        )}

        {/* Social Login Info (Google) */}
        {selectedMethod === "social-google" && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">info</span>
                <div className="flex-1 text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                    Manual Callback Required
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    After login, you&apos;ll need to copy the callback URL from your browser and paste it back here.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleSocialLogin("google")} fullWidth>
                Continue with Google
              </Button>
              <Button onClick={handleBack} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Social Login Info (GitHub) */}
        {selectedMethod === "social-github" && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">info</span>
                <div className="flex-1 text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                    Manual Callback Required
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    After login, you&apos;ll need to copy the callback URL from your browser and paste it back here.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleSocialLogin("github")} fullWidth>
                Continue with GitHub
              </Button>
              <Button onClick={handleBack} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Import Token */}
        {selectedMethod === "import" && (
          <ImportTokenForm
            refreshToken={refreshToken}
            error={error}
            importing={importing}
            autoDetecting={autoDetecting}
            autoDetected={autoDetected}
            onFieldChange={(field, value) => dispatch({ type: "SET_FIELD", field, value })}
            onImport={handleImportToken}
            onBack={handleBack}
          />
        )}

        {/* Import CLIProxyAPI JSON */}
        {selectedMethod === "import-cli-proxy" && (
          <ImportCliProxyForm
            cliProxyJson={cliProxyJson}
            error={error}
            importing={importing}
            onFieldChange={(field, value) => dispatch({ type: "SET_FIELD", field, value })}
            onImport={handleImportCliProxyJson}
            onBack={handleBack}
          />
        )}
      </div>
    </Modal>
  );
}

KiroAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onMethodSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
