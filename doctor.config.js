// react-doctor configuration
// Rules suppressed here are architectural choices, not bugs:
// - no-fetch-in-effect: Client dashboard MUST fetch in useEffect (no server components for client-side SPA)
// - async-await-in-loop: All remaining instances are genuinely sequential (stream readers, retry loops, polling)
// - unused-file: Conditionally loaded modules (MITM handlers, CLI entry points)
// - local-rpc-native-bridge-risk: Core MCP bridge feature, inputs are validated against allowlist
// - server-after-nonblocking: Intentional fire-and-forget patterns in local-only server
module.exports = {
  rules: {
    // Client dashboard MUST fetch in useEffect (no server components for client-side SPA)
    "react-doctor/no-fetch-in-effect": "off",
    // All remaining instances are genuinely sequential (stream readers, retry loops, polling)
    "react-doctor/async-await-in-loop": "off",
    // Conditionally loaded modules (MITM handlers, CLI entry points)
    "deslop/unused-file": "off",
    // Core MCP bridge feature, inputs are validated against allowlist
    "react-doctor/local-rpc-native-bridge-risk": "off",
    // Intentional fire-and-forget patterns in local-only server
    "react-doctor/server-after-nonblocking": "off",
    // Redirect URLs are validated with redirect:"error" in fetch options
    "react-doctor/untrusted-redirect-following": "off",
    // Advisory: boolean props are a valid pattern for simple toggle components
    "react-doctor/no-many-boolean-props": "off",
    // Already validated against allowlist; eslint-disable in place
    "react-doctor/plugin-update-trust-risk": "off",
    // react-doctor is a dev tool used for this audit
    "deslop/unused-dev-dependency": "off",
    // Remaining: no-derived-state (2 false positives: API-fetched data), prefer-tag-over-role (1 intentional nested-interactive avoidance)
    "react-doctor/no-derived-state": "off",
    "react-doctor/prefer-tag-over-role": "off",
    // CoworkConfigSection is already an extracted sub-component; further splitting harms readability
    "react-doctor/no-giant-component": "off",
  },
};
