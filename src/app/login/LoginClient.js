"use client";

import { useReducer, useEffect } from "react";
import { Card, Button, Input } from "@/shared/components";

function handleOidcLogin() {
  window.location.href = "/api/auth/oidc/start";
}

const initialState = (authStatus) => ({
  password: "",
  error: "",
  resetHint: "",
  retryAfter: 0,
  loading: false,
  hasPassword: !!authStatus.hasPassword,
  authMode: authStatus.authMode || "password",
  oidcConfigured: authStatus.oidcConfigured === true,
  oidcLoginLabel: authStatus.oidcLoginLabel || "Sign in with OIDC",
  mustChange: false,
  newPassword: "",
});

function loginReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "LOGIN_START":
      return { ...state, loading: true, error: "", resetHint: "" };
    case "LOGIN_SUCCESS_MUST_CHANGE":
      return { ...state, loading: false, mustChange: true };
    case "LOGIN_FAILURE":
      return {
        ...state,
        loading: false,
        error: action.error || "Invalid password",
        resetHint: action.resetHint || state.resetHint,
        retryAfter: action.retryAfter ? Number(action.retryAfter) : state.retryAfter,
      };
    case "LOGIN_ERROR":
      return { ...state, loading: false, error: action.error || "An error occurred. Please try again." };
    case "TICK_RETRY":
      return { ...state, retryAfter: state.retryAfter > 0 ? state.retryAfter - 1 : 0 };
    default:
      return state;
  }
}

export default function LoginClient({ authStatus }) {
  const [state, dispatch] = useReducer(loginReducer, authStatus, initialState);
  const { password, error, resetHint, retryAfter, loading, hasPassword, authMode, oidcConfigured, oidcLoginLabel, mustChange, newPassword } = state;

  // Countdown for rate-limit
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => dispatch({ type: "TICK_RETRY" }), 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  const handleLogin = async (e) => {
    e.preventDefault();
    dispatch({ type: "LOGIN_START" });

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.mustChangePassword) {
          dispatch({ type: "LOGIN_SUCCESS_MUST_CHANGE" });
          return;
        }
        window.location.assign("/dashboard");
      } else {
        const data = await res.json();
        dispatch({ type: "LOGIN_FAILURE", error: data.error, resetHint: data.resetHint, retryAfter: data.retryAfter });
      }
    } catch {
      dispatch({ type: "LOGIN_ERROR", error: "An error occurred. Please try again." });
    }
  };

  // Force a new password before entering the dashboard (default + remote).
  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    dispatch({ type: "LOGIN_START" });
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      if (res.ok) {
        window.location.assign("/dashboard");
      } else {
        const data = await res.json();
        dispatch({ type: "LOGIN_ERROR", error: data.error || "Failed to set password" });
      }
    } catch {
      dispatch({ type: "LOGIN_ERROR", error: "An error occurred. Please try again." });
    }
  };

  const oidcAvailable = oidcConfigured && ["oidc", "both"].includes(authMode);
  const passwordAvailable = authMode !== "oidc" || !oidcConfigured;

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4 relative overflow-hidden">
      {/* Faint grid background */}
      <div className="landing-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">9Router</h1>
          <p className="text-text-muted">
            {authMode === "oidc" && oidcConfigured
              ? "Sign in with your OIDC provider to access the dashboard"
              : "Enter your password to access the dashboard"}
          </p>
        </div>

        <Card>
          {mustChange ? (
            <form onSubmit={handleSetNewPassword} className="flex flex-col gap-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                Set a new password before accessing the dashboard remotely.
              </p>
              <div className="flex flex-col gap-2">
                <label htmlFor="new-password" className="text-sm font-medium">New password</label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "newPassword", value: e.target.value })}
                  required
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
              <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={!newPassword}>
                Set password
              </Button>
            </form>
          ) : (
          <div className="flex flex-col gap-4">
            {oidcAvailable && (
              <Button type="button" variant="primary" className="w-full" onClick={handleOidcLogin}>
                {oidcLoginLabel}
              </Button>
            )}

            {oidcAvailable && passwordAvailable && <div className="h-px bg-border/60" />}

            {passwordAvailable ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                {((authMode === "oidc" && !oidcConfigured) || (authMode === "both" && !oidcConfigured)) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                    OIDC login is enabled, but the issuer/client fields are not configured yet. Password login is still available for recovery.
                  </p>
                )}

                {authMode === "both" && oidcConfigured && (
                  <p className="text-xs text-text-muted text-center">
                    Password and OIDC login are both enabled.
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <label htmlFor="login-password" className="text-sm font-medium">Password</label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })}
                    required
                  />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  {retryAfter > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Locked. Retry in <span className="font-mono">{retryAfter}s</span>.
                    </p>
                  )}
                  {resetHint && (
                    <p className="text-xs text-text-muted">
                      Forgot password? Open <code className="bg-sidebar px-1 rounded">9router</code> CLI on the host → <b>Settings</b> → <b>Reset Password to Default</b>.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={loading}
                  disabled={retryAfter > 0}
                >
                  {retryAfter > 0 ? `Wait ${retryAfter}s` : "Login"}
                </Button>

                <p className="text-xs text-center text-text-muted mt-2">
                  Default password is <code className="bg-sidebar px-1 rounded">123456</code>
                </p>
                {hasPassword === false && (
                  <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                    Security risk: no password set. You will be asked to set one when logging in remotely.
                  </p>
                )}
              </form>
            ) : (
              error && <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
          )}
        </Card>
      </div>
    </div>
  );
}
