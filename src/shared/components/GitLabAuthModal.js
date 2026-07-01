"use client";

import { useReducer } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input, OAuthModal } from "@/shared/components";

const GITLAB_COM = "https://gitlab.com";

function getRedirectUri() {
  if (typeof window === "undefined") return "http://localhost/callback";
  const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
  return `http://localhost:${port}/callback`;
}

const FORM_INITIAL = { mode: null, baseUrl: GITLAB_COM, clientId: "", clientSecret: "", pat: "" };

function formReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.value };
    case 'RESET': return FORM_INITIAL;
    default: return state;
  }
}

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload };
    case 'SHOW_OAUTH': return { ...state, showOAuth: true, oauthMeta: action.payload, error: null };
    case 'HIDE_OAUTH': return { ...state, showOAuth: false, oauthMeta: null };
    case 'PAT_START': return { ...state, loading: true, error: null };
    case 'PAT_DONE': return { ...state, loading: false };
    case 'PAT_ERROR': return { ...state, loading: false, error: action.payload };
    case 'RESET': return { loading: false, error: null, showOAuth: false, oauthMeta: null };
    default: return state;
  }
}

/**
 * GitLab Duo Authentication Modal
 * Supports two modes:
 * - OAuth (PKCE): requires OAuth App Client ID (and optional Client Secret)
 * - PAT: requires Personal Access Token
 */
export default function GitLabAuthModal({ isOpen, providerInfo, onSuccess, onClose }) {
  const [form, dispatchForm] = useReducer(formReducer, FORM_INITIAL);
  const [{ loading, error, showOAuth, oauthMeta }, dispatchAuth] = useReducer(authReducer, { loading: false, error: null, showOAuth: false, oauthMeta: null });

  const reset = () => {
    dispatchForm({ type: 'RESET' });
    dispatchAuth({ type: 'RESET' });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleOAuthStart = () => {
    if (!form.clientId.trim()) {
      dispatchAuth({ type: 'SET_ERROR', payload: "Client ID is required" });
      return;
    }
    dispatchAuth({ type: 'SHOW_OAUTH', payload: { baseUrl: form.baseUrl.trim() || GITLAB_COM, clientId: form.clientId.trim(), clientSecret: form.clientSecret.trim() } });
  };

  const handlePATSubmit = async () => {
    if (!form.pat.trim()) {
      dispatchAuth({ type: 'SET_ERROR', payload: "Personal Access Token is required" });
      return;
    }
    dispatchAuth({ type: 'PAT_START' });
    try {
      const res = await fetch("/api/oauth/gitlab/pat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: form.pat.trim(), baseUrl: form.baseUrl.trim() || GITLAB_COM }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      onSuccess?.();
      handleClose();
    } catch (err) {
      dispatchAuth({ type: 'PAT_ERROR', payload: err.message });
    }
  };

  if (!isOpen) return null;

  // Sub-modal for OAuth PKCE flow
  if (showOAuth && oauthMeta) {
    return (
      <OAuthModal
        isOpen
        provider="gitlab"
        providerInfo={providerInfo}
        oauthMeta={oauthMeta}
        onSuccess={() => { onSuccess?.(); handleClose(); }}
        onClose={() => { dispatchAuth({ type: 'HIDE_OAUTH' }); }}
      />
    );
  }

  return (
    <Modal isOpen={isOpen} title="Connect GitLab Duo" onClose={handleClose} size="lg">
      <div className="flex flex-col gap-4">
        {/* Mode selection */}
        {!form.mode && (
          <>
            <p className="text-sm text-text-muted">
              Choose how to authenticate with GitLab Duo:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => dispatchForm({ type: 'SET_FIELD', field: 'mode', value: "oauth" })}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-2xl text-primary">lock_open</span>
                <div>
                  <p className="text-sm font-medium">OAuth App</p>
                  <p className="text-xs text-text-muted">Use a GitLab OAuth application</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => dispatchForm({ type: 'SET_FIELD', field: 'mode', value: "pat" })}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-2xl text-primary">key</span>
                <div>
                  <p className="text-sm font-medium">Personal Access Token</p>
                  <p className="text-xs text-text-muted">Use a GitLab PAT with api scope</p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* OAuth mode */}
        {form.mode === "oauth" && (
          <>
            <p className="text-xs text-text-muted">
              Create an OAuth app at{" "}
              <a href={`${form.baseUrl.trim() || GITLAB_COM}/-/profile/applications`} target="_blank" rel="noreferrer" className="text-primary underline">
                GitLab Applications
              </a>{" "}
              with redirect URI{" "}
              <code className="bg-sidebar px-1 rounded text-xs">{getRedirectUri()}</code>
            </p>
            <Input label="GitLab Base URL" value={form.baseUrl} onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'baseUrl', value: e.target.value })} placeholder={GITLAB_COM} />
            <Input label="Client ID" value={form.clientId} onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'clientId', value: e.target.value })} placeholder="Your OAuth application client ID" />
            <Input label="Client Secret (optional for PKCE)" value={form.clientSecret} onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'clientSecret', value: e.target.value })} placeholder="Leave empty for public PKCE app" />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleOAuthStart} fullWidth disabled={!form.clientId.trim()}>
                Authorize
              </Button>
              <Button onClick={() => { dispatchForm({ type: 'SET_FIELD', field: 'mode', value: null }); dispatchAuth({ type: 'SET_ERROR', payload: null }); }} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </>
        )}

        {/* PAT mode */}
        {form.mode === "pat" && (
          <>
            <p className="text-xs text-text-muted">
              Create a PAT at{" "}
              <a href={`${form.baseUrl.trim() || GITLAB_COM}/-/user_settings/personal_access_tokens`} target="_blank" rel="noreferrer" className="text-primary underline">
                GitLab Access Tokens
              </a>{" "}
              with scopes: <code className="bg-sidebar px-1 rounded text-xs">api</code>,{" "}
              <code className="bg-sidebar px-1 rounded text-xs">read_user</code>, and{" "}
              <code className="bg-sidebar px-1 rounded text-xs">ai_features</code>.
            </p>
            <Input label="GitLab Base URL" value={form.baseUrl} onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'baseUrl', value: e.target.value })} placeholder={GITLAB_COM} />
            <Input label="Personal Access Token" value={form.pat} onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'pat', value: e.target.value })} placeholder="glpat-xxxxxxxxxxxxxxxxxxxx" type="password" />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handlePATSubmit} fullWidth disabled={!form.pat.trim() || loading} loading={loading}>
                Connect
              </Button>
              <Button onClick={() => { dispatchForm({ type: 'SET_FIELD', field: 'mode', value: null }); dispatchAuth({ type: 'SET_ERROR', payload: null }); }} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

GitLabAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  providerInfo: PropTypes.shape({ name: PropTypes.string }),
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
