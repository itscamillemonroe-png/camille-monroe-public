# Creator Private OS — Feature Classification Matrix

Use this document to prevent Camille-specific logic from contaminating the reusable product.

| Area | Reusable product feature | Camille-specific data/config | Demo treatment |
|---|---|---|---|
| Public site | branded landing/about/links | Camille name, copy, photos, URLs | synthetic creator |
| Auth | login/account system | Camille owner identity/config | demo accounts |
| Approval | profile photo + owner approve/deny/revoke/block | Camille's personal approval decisions | synthetic approvals |
| Membership | paid-duration access rules | Camille's $30/30-day price | sample price |
| Member feed | posts/photos/videos/blogs | Camille media/copy | synthetic content |
| Messaging | member/creator communication + credits | Camille conversations | generated sample threads |
| Voice calls | credit/minute logic + call workflow | Camille's 4 credits/min + availability | sample rates |
| Video calls | excluded from current baseline | retired | do not demo as active |
| Premium Drops | gated paid product model | Camille drop media/products | synthetic drop |
| Tips | configurable tip amounts | Camille "A Little Extra" branding | generic tips |
| Payments | checkout + verified fulfillment architecture | Camille processor accounts/bank routing | sandbox/test only |
| Member records | reusable data model | real Camille members | synthetic records |
| Analytics | conversion/revenue/traffic telemetry | Camille real metrics | synthetic/sample data |
| Notifications | owner/member notifications | Camille-specific wording/routes | synthetic events |
| Creator Studio | content/product/member operations | Camille brand/config | neutral branding |
| Control Room | owner operations + internal controls | Camille owner-only settings | demo-safe controls |
| AI workflows | internal research/drafting/ops assistance | Camille prompts/brand voice | neutral templates |
| Social workflows | review-first publishing/outreach architecture | Camille handles/accounts | mock connections |
| Documentation | deployment owner manual | Camille credentials/references | client-specific manual |

## Rule
Every new feature must be tagged before release:
- **REUSABLE PRODUCT FEATURE**
- **CAMILLE-SPECIFIC**
- **CLIENT-SPECIFIC CUSTOMIZATION**

Reusable modules should use configuration rather than hard-coded Camille names, prices, handles, media, IDs, or account details.
