// Cloudflare AI Gateway in front of Anthropic and Gemini (27/11/2026, Michael in the questionnaire: "do it: only the AI Gateway first").
// Off by default: with no AI_GATEWAY_URL in the environment every call goes direct, exactly as before. Switching on = one Pages variable,
// switching off = deleting it (no deploy). The gateway adds a spend cap in dollars (429 when over) and a usage log; it does not cache
// chat answers (a cached answer could be another person's or stale), see project-files/cloudflare-review-27-11-2026.md.
// A gateway that answers 429 or 5xx is NOT retried direct: that would bypass the very cap this is for.
const GW_RE = /^https:\/\/gateway\.ai\.cloudflare\.com\/v1\/[0-9a-f]{32}\/[A-Za-z0-9_-]{1,64}$/;
const DIRECT = { anthropic: 'https://api.anthropic.com', google: 'https://generativelanguage.googleapis.com' };
const VIA = { anthropic: '/anthropic', google: '/google-ai-studio' };
// The gateway base from the environment, or '' when it is not set or is not a Cloudflare gateway address (a wrong value never sends a key elsewhere).
export function gatewayBase(env) {
  const u = String((env && env.AI_GATEWAY_URL) || '').trim().replace(/\/+$/, '');
  return GW_RE.test(u) ? u : '';
}
// provider: 'anthropic' | 'google'. path: '/v1/messages' or '/v1beta/models/<model>:generateContent' (the path as the provider has it).
export function aiUrl(env, provider, path) {
  const base = gatewayBase(env);
  return base ? base + VIA[provider] + path : DIRECT[provider] + path;
}
// h = the headers of the call. cf-aig-authorization only when the gateway is on and a token is set (an authenticated gateway).
export function aiHeaders(env, h) {
  const out = Object.assign({}, h || {});
  if (gatewayBase(env) && env.AI_GATEWAY_TOKEN) out['cf-aig-authorization'] = 'Bearer ' + env.AI_GATEWAY_TOKEN;
  return out;
}
