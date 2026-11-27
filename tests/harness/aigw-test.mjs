// AI Gateway in front of Anthropic and Gemini (27/11/2026): off by default, switched on by one variable, never sends a key to another host.
import { gatewayBase, aiUrl, aiHeaders } from './_build/_aigw.mjs';
import { geminiAskCall } from './_build/_geminiask.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const ACC = 'c9d388e3a5f9ee9546e8aa6b6353ec87', GW = 'https://gateway.ai.cloudflare.com/v1/' + ACC + '/tapugan';

(async () => {
  // pairs (retro 28/10/2026 d): three addresses that must be accepted, three that must not
  check('accepts the real gateway address', gatewayBase({ AI_GATEWAY_URL: GW }) === GW);
  check('accepts it with a trailing slash and spaces', gatewayBase({ AI_GATEWAY_URL: ' ' + GW + '/ ' }) === GW);
  check('accepts a gateway name with a dash and digits', gatewayBase({ AI_GATEWAY_URL: 'https://gateway.ai.cloudflare.com/v1/' + ACC + '/tapugan-2' }) !== '');
  check('rejects another host (a key must not go there)', gatewayBase({ AI_GATEWAY_URL: 'https://evil.example.com/v1/' + ACC + '/tapugan' }) === '');
  check('rejects http', gatewayBase({ AI_GATEWAY_URL: GW.replace('https', 'http') }) === '');
  check('rejects a lookalike host', gatewayBase({ AI_GATEWAY_URL: 'https://gateway.ai.cloudflare.com.evil.io/v1/' + ACC + '/tapugan' }) === '');
  check('not set = no gateway', gatewayBase({}) === '' && gatewayBase(null) === '');

  // off: exactly the old addresses
  check('off: Anthropic direct', aiUrl({}, 'anthropic', '/v1/messages') === 'https://api.anthropic.com/v1/messages');
  check('off: Gemini direct', aiUrl({}, 'google', '/v1beta/models/m:generateContent') === 'https://generativelanguage.googleapis.com/v1beta/models/m:generateContent');
  // on
  check('on: Anthropic through the gateway', aiUrl({ AI_GATEWAY_URL: GW }, 'anthropic', '/v1/messages') === GW + '/anthropic/v1/messages');
  check('on: Gemini through the gateway', aiUrl({ AI_GATEWAY_URL: GW }, 'google', '/v1beta/models/m:generateContent') === GW + '/google-ai-studio/v1beta/models/m:generateContent');
  check('a wrong value falls back to direct, not to a broken address', aiUrl({ AI_GATEWAY_URL: 'nonsense' }, 'anthropic', '/v1/messages') === 'https://api.anthropic.com/v1/messages');

  // headers
  const base = { 'x-api-key': 'K' };
  check('no token: headers unchanged', JSON.stringify(aiHeaders({ AI_GATEWAY_URL: GW }, base)) === JSON.stringify(base));
  check('token without a valid gateway: not sent (it would go to the provider)', !('cf-aig-authorization' in aiHeaders({ AI_GATEWAY_TOKEN: 'T' }, base)));
  check('token with the gateway on: cf-aig-authorization', aiHeaders({ AI_GATEWAY_URL: GW, AI_GATEWAY_TOKEN: 'T' }, base)['cf-aig-authorization'] === 'Bearer T');
  check('the input headers object is not changed', !('cf-aig-authorization' in base));

  // a real call site: gemini_ask goes through the gateway when it is on, direct when it is off
  const seen = [];
  const fetchImpl = async (url, opt) => { seen.push({ url, h: opt.headers }); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }), { status: 200 }); };
  await geminiAskCall({ GEMINI_API_KEY: 'g', AI_GATEWAY_URL: GW, AI_GATEWAY_TOKEN: 'T' }, { system: 's', user: 'u' }, fetchImpl);
  await geminiAskCall({ GEMINI_API_KEY: 'g' }, { system: 's', user: 'u' }, fetchImpl);
  check('gemini_ask on: the gateway address and the token header', seen[0] && seen[0].url.startsWith(GW + '/google-ai-studio/v1beta/models/') && seen[0].h['cf-aig-authorization'] === 'Bearer T' && seen[0].h['x-goog-api-key'] === 'g', seen[0]);
  check('gemini_ask off: the direct address, no gateway header', seen[1] && seen[1].url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/') && !('cf-aig-authorization' in seen[1].h), seen[1]);

  console.log('\naigw-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
