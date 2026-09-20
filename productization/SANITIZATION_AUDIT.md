# Creator Private OS — Sanitization Audit

**Date:** 2026-09-20  
**Workspace:** `product/creator-private-os`

## Important distinction

This Git branch is a **productization workspace**, not the final clean MASTER repository.

Because the branch was created from the Camille production repository, its Git history and many inherited files still contain Camille-specific branding and production-era implementation details. It must not be handed to a client as the reusable master.

## Confirmed clean separation already completed

- isolated Supabase demo project: `gebaqosgncyboutsujcv`
- no Camille production members copied
- no Camille production messages copied
- no Camille production media copied
- no Camille production payment records copied
- no Camille private analytics copied
- no Camille production Stripe/NOWPayments secrets copied
- demo checkout is simulation only
- productization app client no longer defaults to Camille production Supabase
- productization telemetry no longer defaults to Camille production Supabase

## Inherited Camille-specific frontend material still present in workspace

These inherited paths are examples of material that must not be copied verbatim into the final MASTER:

- `index.html` — Camille name, domain, SEO metadata, social profiles, hero copy
- `assets/camille-home.webp` — Camille-owned image
- `assets/member.js` — Camille display name/avatar copy and Camille-domain signup redirect
- `assets/verify.js` — Camille-specific approval language
- `payments/index.html` — Camille wording, fixed current product IDs, OnlyFans destination language
- `lane/*` — Camille pricing/copy/brand presentation
- `studio/index.html` — Camille-specific Creator Studio copy/integration descriptions
- `go/*` — Camille social destinations
- `content/autobot-queue.json` — production/brand-specific content queue
- `CNAME`, `sitemap.xml`, `robots.txt`, manifest/SEO metadata — Camille domain/site configuration

## Do not transfer into a client deployment

- Camille photos/video/audio
- Camille social handles
- Camille domain
- Camille owner email/account identifiers
- live product UUIDs
- live payment routing IDs
- production bank references
- live Stripe/NOWPayments credentials
- real members
- real conversations/messages
- real call records/signals
- real traffic/analytics
- real revenue/orders
- real notifications
- real content tasks
- live automation queues
- Camille-specific legal/policy copy without client/legal review

## Reusable material

The following concepts are reusable once moved into a fresh clean repository:

- account/auth pattern
- profile-photo access request
- owner approval workflow
- membership entitlement
- configurable pricing
- wallet/credit ledger
- paid messaging
- voice-call reservation/refund logic
- protected member content
- Premium Drop products
- tips
- notifications
- Creator Studio workflow
- Control Room workflow
- attribution/analytics model
- review-first automation pattern
- synthetic demo data model
- deployment config schema

## Clean MASTER rule

The final MASTER should be created as a fresh private repository with a clean initial history.

It should contain only:
- neutral reusable frontend
- neutral reusable backend migrations/functions
- configuration templates
- deployment scripts/docs
- generic assets
- no Camille personal media/data
- no Camille production identifiers
- no inherited production Git history

## Clean DEMO rule

The DEMO should be generated from MASTER and configured with a fictional brand such as Avery Vale.

It may include:
- synthetic accounts
- synthetic transactions
- synthetic content
- synthetic metrics
- clearly marked demo checkout

It may never imply synthetic metrics are Camille results or proven customer revenue.

## Current blocking item

The connected GitHub integration does not expose repository creation. A brand-new private GitHub repository must therefore be created through GitHub's normal repository-creation flow before the sanitized MASTER can be transferred into it.

Until then:
- keep using `product/creator-private-os` as the protected build workspace
- do not merge productization changes into Camille production
- do not sell or transfer this inherited repository itself
