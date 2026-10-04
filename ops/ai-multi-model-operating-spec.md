# Camille Monroe Multi-Model Intelligence Layer

Status: production architecture specification
Owner: Camille Monroe / AI Operational Desk
Principle: cash conversion first; brand, privacy, legality and trust are hard gates.

## Purpose
Use multiple U.S. and Chinese/global AI model families as specialized business intelligence, localization and quality-control workers without exposing sensitive customer, payment, legal, child, credential or private business data across providers.

## Eight model-family lanes
1. OpenAI — primary business reasoning, offer design, structured generation.
2. Anthropic — editorial review, long-form analysis, policy/quality review.
3. Google Gemini — multimodal review, localization support, research synthesis.
4. xAI Grok — secondary market/creative perspective and cross-checking.
5. Meta Llama — open-model lane for low-sensitivity classification and experimentation.
6. DeepSeek — multilingual reasoning and China-market language cross-check.
7. Alibaba Qwen — Chinese/Asian-market localization and multilingual review.
8. Moonshot/Kimi — Chinese-language long-context review when an approved API route is available.

Model IDs MUST NOT be hardcoded from this document. Resolve current supported model IDs from the selected gateway/provider at runtime.

## Privacy gate
NEVER multi-route:
- payment card/bank data
- passwords, tokens, API keys or credentials
- private legal/court/CPS records
- children's identifying information
- medical records
- government IDs
- customer PII beyond the minimum required for the transaction

Sensitive tasks stay on the explicitly approved primary provider/system. Cross-model work receives redacted or synthetic context only.

## Operating roles
### Cash Engine
- offer generation
- pricing experiments
- buyer-segment hypotheses
- conversion-copy variants
- post-sale upsell ideas

### Globalization Engine
- English master copy is the source of truth
- initial U.S. localization: English + Spanish
- later languages added only when market evidence supports them
- Chinese-language lanes receive public/product copy, never restricted records
- translation requires second-model review before customer use

### Collectible Asset Engine
One master creator-owned asset can generate:
- individual digital collectible editions
- bundles
- member editions
- geographic campaigns
- multilingual packages
- separately negotiated commercial licenses

Do not describe collectibles as investments or promise appreciation.

## Routing policy
FAST: low-cost model for classification, tagging, translation drafts.
PRIMARY: strongest approved model for revenue-critical customer-facing work.
REVIEW: second independent model checks claims, tone, localization and brand fit.
CHINA-LOCALIZATION: Qwen/DeepSeek/Kimi lane for Chinese-language public/product content.
MULTIMODAL: approved image-capable model for public creator assets.
FAILOVER: use another approved provider only for non-sensitive requests.

## Brand Culture Gate
Every output must pass:
1. brand fit
2. legality
3. ethics
4. customer trust
5. reputation
6. margin
7. time to cash
8. conversion probability
9. long-term asset value

## Email-only commerce workflow
email offer/order confirmation
→ Stripe-hosted invoice or secure payment link
→ payment confirmation
→ private deliverable handoff link
→ collectible/PDF/certificate/license
→ email receipt
→ archived transaction record

No phone call or live meeting is required.

## Audit record for every AI job
Store:
- timestamp
- task type
- sensitivity class
- selected model family
- fallback/reviewer family
- language
- market/region
- asset/product ID
- token/cost data when available
- human approval status for external customer-facing output

Do not store raw secrets in logs.

## Cash-first KPI set
- collected cash
- gross margin
- revenue per master asset
- time to first cash
- conversion rate by city/state/country
- conversion rate by language
- average order value
- repeat purchase rate
- AI cost per collected dollar
- refund/dispute rate

## Deployment rule
The current public site remains GitHub Pages + Supabase. Do not introduce a Vercel-only runtime dependency into the static frontend. Provider/gateway calls belong server-side (for example, an existing Supabase Edge Function or another approved backend), never in browser JavaScript with secret keys.
