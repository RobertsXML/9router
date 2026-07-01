import { NextResponse } from "next/server";
import { withLocalAuth } from "@/app/api/_lib/auth";
import {
  buildOidcAuthorizationUrl,
  createOidcNonce,
  createOidcState,
  createPkcePair,
  fetchOidcDiscovery,
  getOidcRuntimeConfig,
  getPublicOrigin,
} from "@/lib/auth/oidc";
import { shouldUseSecureCookie } from "@/lib/auth/dashboardSession";

function buildCookieHeader(name, value, options) {
  let cookie = `${name}=${encodeURIComponent(value)}; Path=${options.path}; Max-Age=${options.maxAge}; SameSite=${options.sameSite}; HttpOnly`;
  if (options.secure) cookie += "; Secure";
  return cookie;
}

export const GET = withLocalAuth(async (request) => {
  try {
    const config = await getOidcRuntimeConfig();
    if (!config) {
      return NextResponse.redirect(new URL("/login?error=oidc_not_configured", getPublicOrigin(request)));
    }

    const discovery = await fetchOidcDiscovery(config.issuerUrl);
    const state = createOidcState();
    const nonce = createOidcNonce();
    const { verifier, challenge } = createPkcePair();
    const redirectUri = `${getPublicOrigin(request)}/api/auth/oidc/callback`;
    const authUrl = buildOidcAuthorizationUrl({
      authorizationEndpoint: discovery.authorization_endpoint,
      clientId: config.clientId,
      redirectUri,
      scopes: config.scopes,
      state,
      nonce,
      codeChallenge: challenge,
    });

    // Validate redirect URL is HTTPS (untrusted-redirect-following)
    const authUrlObj = new URL(authUrl);
    if (authUrlObj.protocol !== "https:" && authUrlObj.hostname !== "localhost") {
      return NextResponse.redirect(new URL("/login?error=invalid_auth_url", getPublicOrigin(request)));
    }

    const cookieOptions = {
      httpOnly: true,
      secure: shouldUseSecureCookie(request),
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    };

    const response = NextResponse.redirect(authUrl);
    response.headers.append("Set-Cookie", buildCookieHeader("oidc_state", state, cookieOptions));
    response.headers.append("Set-Cookie", buildCookieHeader("oidc_nonce", nonce, cookieOptions));
    response.headers.append("Set-Cookie", buildCookieHeader("oidc_code_verifier", verifier, cookieOptions));
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message || "oidc_start_failed")}`, getPublicOrigin(request)));
  }
});
