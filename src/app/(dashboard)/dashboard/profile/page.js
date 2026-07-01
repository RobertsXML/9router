import { getSettings } from "@/lib/localDb";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const settings = await getSettings();
  const { password, oidcClientSecret, ...safeSettings } = settings;
  safeSettings.oidcConfigured = !!(safeSettings.oidcIssuerUrl && safeSettings.oidcClientId && oidcClientSecret);

  const enableRequestLogs = process.env.ENABLE_REQUEST_LOGS === "true";
  const enableTranslator = process.env.ENABLE_TRANSLATOR === "true";

  return (
    <ProfileClient
      initialSettings={{
        ...safeSettings,
        enableRequestLogs,
        enableTranslator,
        hasPassword: !!password,
      }}
    />
  );
}
