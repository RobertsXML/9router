import { redirect } from "next/navigation";
import { getSettings } from "@/lib/localDb";
import { isOidcConfigured } from "@/lib/auth/oidc";
import LoginClient from "./LoginClient";

async function getAuthStatus() {
  try {
    const settings = await getSettings();
    const requireLogin = settings.requireLogin !== false;
    const authMode = settings.authMode || "password";
    return {
      requireLogin,
      authMode,
      oidcConfigured: isOidcConfigured(settings),
      oidcLoginLabel: (settings.oidcLoginLabel || "Sign in with OIDC").trim() || "Sign in with OIDC",
      hasPassword: !!settings.password,
    };
  } catch {
    return {
      requireLogin: true,
      authMode: "password",
      oidcConfigured: false,
      oidcLoginLabel: "Sign in with OIDC",
      hasPassword: false,
    };
  }
}

export default async function LoginPage() {
  const authStatus = await getAuthStatus();

  if (authStatus.requireLogin === false) {
    redirect("/dashboard");
  }

  return <LoginClient authStatus={authStatus} />;
}
