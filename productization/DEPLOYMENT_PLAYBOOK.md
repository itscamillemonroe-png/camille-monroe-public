# Creator Private OS — Deployment Playbook

## Purpose
Turn one validated Creator Private OS MASTER into a client-specific deployment without copying another client's customer data, credentials, media, messages, transactions, or analytics.

## Phase 1 — Contract + scope
Before technical work begins:
1. Signed agreement / SOW.
2. Deposit received.
3. Modules selected.
4. Client domain identified.
5. Third-party integrations identified.
6. Migration scope documented.
7. Launch acceptance criteria documented.
8. Support plan selected.

## Phase 2 — Create isolated client environment
Create a new private client repository or controlled deployment branch from the clean MASTER release.

Create a new client backend/project. Never reuse the Camille production backend or another customer's backend.

Create client-specific:
- database
- auth project
- storage
- payment credentials
- webhook secrets
- domain/DNS configuration
- analytics configuration
- social/API connections

## Phase 3 — Apply configuration
Populate the deployment configuration:
- creator name
- domain
- public handle
- branding
- theme
- membership duration
- prices
- credit rates
- enabled modules
- social links
- policy URLs
- backend URL / public key

Do not hard-code customer-specific values into reusable modules when configuration can be used instead.

## Phase 4 — Brand package
Required client assets:
- logo / wordmark or text wordmark
- hero image
- avatar/profile image if used
- colors
- approved fonts
- short creator bio
- public CTA copy
- social links
- optional revenue-lane covers

All media must have documented commercial-use permission from the client.

## Phase 5 — Backend initialization
Provision or migrate reusable schema and functions.

Validate:
- account creation
- profile-photo intake
- owner approval/deny/revoke/block
- membership access
- payment callback verification
- idempotent fulfillment
- member wallet/credits
- messaging debits
- voice-call reservation/refund
- Premium Drop unlocks
- owner notifications
- telemetry

## Phase 6 — Payments
Configure only the client's payment accounts.

Never:
- reuse Camille processor credentials
- reuse another client's processor credentials
- treat browser redirects as payment proof
- expose secret keys in frontend code

Run provider-approved test/sandbox flows before live mode.

## Phase 7 — Synthetic acceptance test
Before loading real customers, test with synthetic accounts.

Required test journeys:
1. visitor -> signup -> photo -> approval
2. approved member -> membership checkout -> access
3. active member -> buy credits
4. member -> send paid message
5. member -> reserve voice call credits
6. call ends early -> unused credits return
7. member -> buy Premium Drop
8. member -> tip
9. owner -> receive notifications
10. owner -> publish/review content
11. conversion event -> analytics visible
12. revoke/block -> access changes correctly

## Phase 8 — Client acceptance
Walk the client through:
- owner login
- approval queue
- Creator Studio
- member experience
- payments
- revenue view
- notifications
- messaging/calls
- analytics
- configuration limits
- support process

Client signs or confirms launch acceptance.

## Phase 9 — Launch
Launch only after:
- DNS resolves
- HTTPS works
- production processor callbacks verify
- owner access works
- member gates work
- policies are published
- backups/rollback plan exists
- monitoring is active

## Phase 10 — Recurring management
Monthly service can include:
- uptime checks
- payment-route monitoring
- error review
- analytics report
- configuration updates
- content/automation support
- security maintenance
- backups
- product/revenue lane changes

Any new custom feature is scoped separately unless the support agreement includes development hours.
