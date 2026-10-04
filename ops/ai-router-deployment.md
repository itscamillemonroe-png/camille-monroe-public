# AI Ops Router — Deployment & Activation

Production Edge Function: `ai-ops-router`
Supabase project: `wybpxixkjimbpvufozub`
Auth: JWT required
Current safe state: routing ready; external provider execution locked until credentials exist.

## Provider lanes
- OpenAI
- Anthropic
- Google Gemini
- xAI
- Meta/Llama
- DeepSeek
- Alibaba/Qwen
- Moonshot/Kimi

## Recommended credential strategy
Prefer ONE approved multi-provider gateway credential when it supports the required model families and commercial/data terms. This minimizes secret sprawl. If direct providers are required, use server-side Supabase project secrets only.

Never put any provider credential in GitHub Pages, browser JavaScript, public JSON, GitHub Actions logs, or customer-facing HTML.

## Secret names if direct-provider mode is used
`OPENAI_API_KEY`
`ANTHROPIC_API_KEY`
`GOOGLE_GENERATIVE_AI_API_KEY`
`XAI_API_KEY`
`META_AI_API_KEY` (only if using an approved hosted Meta/Llama endpoint)
`DEEPSEEK_API_KEY`
`DASHSCOPE_API_KEY` (Qwen)
`MOONSHOT_API_KEY`

Exact provider endpoints and model IDs must be verified at activation time. Do not hardcode stale model IDs.

## Activation gate
Execution may be enabled only after:
1. credential exists server-side;
2. provider/model is currently available;
3. commercial terms are acceptable;
4. data handling is acceptable for the task class;
5. a non-sensitive smoke test succeeds;
6. fallback/reviewer behavior is verified;
7. cost limits are defined.

## Privacy classes
PUBLIC: public marketing/product copy; multi-model routing allowed.
INTERNAL: ordinary non-sensitive business strategy; approved providers only.
RESTRICTED: legal/CPS, children, medical, government ID, financial credentials, passwords/tokens, sensitive customer PII; never multi-route.

## Language strategy
English is master/source copy.
Initial U.S. expansion: English + Spanish.
Chinese-language public/product localization: Qwen primary, DeepSeek review, Kimi fallback when available and approved.
Additional languages are activated based on measured buyer demand.

## Commerce path
Email offer/order confirmation → Stripe hosted invoice/payment link → paid confirmation → private handoff link → asset/PDF/certificate/license → receipt → archived transaction record.

## KPIs
Collected cash; margin; revenue per asset; time to cash; conversion by geography; conversion by language; AOV; repeat purchase; AI cost per collected dollar; refunds/disputes.
