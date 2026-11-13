# Which notification vendor fits Cadence?

Research for [#13](https://github.com/josephsiefers/cohort-005-project/issues/13), a child of the map [#12 Wayfinder: In-app Notifications](https://github.com/josephsiefers/cohort-005-project/issues/12).

Researched 2026-11-12 against each vendor's own docs, pricing pages, npm registry metadata and SDK repos. Vendors change pricing and plan gates often; re-check the cited page before relying on a number.

## Context

- Cadence is a React Router 8.3 + React 19.2 app on Node, SQLite via Drizzle.
- Transactional Emails stay on Postmark (`app/lib/mailer.server.ts`), which falls back to writing JSON files in `.outbox/` when `POSTMARK_SERVER_TOKEN` is unset. The Notification stand-in should work the same way.
- v1 Notifications are **in-app only**. The vendor does orchestration **and** the feed.
- Notifications are stored **only at the vendor**; Cadence keeps no `notifications` table.
- Cadence has EU buyers.

## Answer

**Recommend Novu (Novu Cloud, EU region).** Runner-up: **Knock**.

Novu is the only vendor that meets every criterion on its free tier *and* lets Cadence keep Notification data in the EU (Frankfurt) from day one, with self-hosting as a later escape hatch. Its `<Inbox />` ships a bell, feed and preferences panel in one component, and `@novu/react` also exposes headless hooks; it supports React 19.

Knock is the stronger product on two points that matter for "stored only at the vendor": its feed items are kept **indefinitely** (Novu keeps them 30 days on Free, 90 days on Pro/Team), and its feed auth is an **expiring signed JWT** (Novu uses a static HMAC hash). Knock loses on data location: it stores data in the US and EU residency is still "coming soon". If the EU question is settled as "US storage under the DPF/SCCs is fine", Knock becomes the better pick, and the swap is cheap at this stage.

Courier and MagicBell are out: Courier gates digest/batching to Enterprise and EU residency to paid plans; MagicBell has a 1,000-delivery free tier, no documented batching, no headless React layer in its current SDK, and no documented hosting region.

## Comparison against the ticket's criteria

| Criterion | Novu | Knock | Courier | MagicBell |
| --- | --- | --- | --- | --- |
| Free tier for development | Yes: 10,000 workflow runs/mo, all channels incl. in-app, 2 environments, **5 workflows**, 3 team members [N1] | Yes: 10,000 messages/mo, unlimited environments and workflows, no hard cap [K1] | Yes: 10,000 sends/mo "Developer" [C1] | Weak: **1,000 deliveries/mo**, 1 project [M1] |
| Trigger from Node | `@novu/api` (v3.19). `@novu/node` is deprecated since 2025-03-20 [npm] | `@knocklabs/node` (v1.41) [npm] | `@trycourier/courier` (v10) [npm] | `magicbell-js/project-client` `broadcasts.createBroadcast` [M5] |
| React SDK: ready-made feed | `<Inbox />` (Bell, Notifications, InboxContent, Preferences) [N2] | `NotificationFeedPopover`, `NotificationFeed`, `NotificationIconButton` [K2] | `<CourierInbox />`, `<CourierInboxPopupMenu />`, `<CourierToast />` [C2] | `Inbox`, `FloatingInbox`, `ToastContainer` [M2] |
| React SDK: headless | `@novu/react` hooks: `useNotifications`, `useCounts`, `usePreferences`, `useNovu` (+ `@novu/js`) [N2][N3][npm] | `useNotifications`, `useNotificationStore`, `useKnockFeed`, `usePreferences` [K3][npm] | `useCourier()` hook (+ `@trycourier/courier-js`) [C2] | **None in `@magicbell/react`**; build on `magicbell-js/user-client` + `magicbell-js/realtime`. Old `@magicbell/react-headless` is no longer in the SDK repo [M2][M5] |
| React 19 | Yes (`^18 \|\| ^19`) [N2][npm] | Yes (`^17 \|\| ^18 \|\| ^19`) [npm] | Yes (`>=18`) [npm] | Not stated; no peer deps declared [npm] |
| Per-user preferences built in | Yes: global, per-workflow, per-channel; "critical" workflows can't be opted out of; preferences panel inside `<Inbox />` [N4] | Yes: PreferenceSet by workflow/category/channel; hosted preference centre; `usePreferences` hook, **no prebuilt React preferences component** [K4][npm] | Yes: subscription topics (OPTED_IN/OPTED_OUT/REQUIRED), `<CourierPreferences />`, hosted page [C3] | Yes: by channel per category; `UserPreferences` component [M2][M6] |
| Self-hosting | **Yes**: open-source core (MIT, with proprietary `enterprise/` packages); needs API, Worker, WS, MongoDB, Redis, S3. Supported self-host is Enterprise [N5][N1][repo] | No | No | No (proprietary licence) [repo] |
| Where data is stored | **US (Virginia) or EU (Frankfurt), chosen at account creation, on every plan incl. Free**; can't be moved later [N6][N1] | **US**; "EU data residency is coming soon… by the end of 2026" [K5][K6] | US by default; EU (Ireland) on **paid plans only** (Business, Enterprise) [C4] | Not documented; Trust Centre names no region [M3] |

## Facts later decisions depend on

### Novu (recommended)

- **User identity and sync.** A Subscriber is keyed by `subscriberId`; use the Cadence user id. Subscribers are upserted from the data in each workflow trigger, can be pre-created via API (bulk up to 500), and the Inbox creates a subscriber on first session [N7][N2]. No mandatory up-front sync, but role changes have to be pushed if templates or preferences depend on them.
- **Feed auth.** The browser uses the public `applicationIdentifier` + `subscriberId`. In production turn on "Security HMAC encryption" and pass `subscriberHash` = HMAC-SHA256(secret key, subscriberId), hex, computed on the server. If HMAC is on and the hash is missing, the Inbox won't load [N8]. The hash **does not expire**; it is effectively a permanent per-user credential.
- **Real-time.** WebSocket by default; `useNotifications` auto-injects new items, and `realtime: false` turns it off [N3]. EU region needs `apiUrl: https://eu.api.novu.co` and `socketUrl: wss://eu.socket.novu.co` [N8].
- **Batching.** Digest step, per subscriber by default, optional extra digest key (e.g. `payload.lessonId`); "regular" or "scheduled" windows; "when events repeat" sends the first one at once then batches the burst [N9]. Max digest window **1 day on Free**, 7 days Pro, 30 days Team [N9][N10].
- **Local or test mode.** No offline mode. Free gives a Development and a Production environment [N1]. `npx novu dev` (Local Studio) needs Novu Cloud and a tunnel, and is only for Novu Framework (code-first) workflows [N11]. Cadence needs its own `.outbox/`-style stand-in.
- **Storing only at the vendor.** Works, but **Inbox feed retention is 30 days on Free, 90 days on Pro/Team**, custom on Enterprise [N10][N6]. Older Notifications vanish and Cadence has no copy.
- **Data residency.** EU (Frankfurt) on Free; region is picked at sign-up and data can't be moved between regions [N6].

### Knock (runner-up)

- **User identity and sync.** User `id` is your own id (max 256 chars, no `/` or `#`, immutable). Identify with the identify endpoint or inline in a workflow trigger. Users are per environment, so identify again in each one [K7].
- **Feed auth.** Public API key + user id. "Enhanced security mode" (meant for production) needs a signed user token: RS256 JWT with `sub` = user id, signed server-side by `signUserToken` in `@knocklabs/node` (default lifetime 3600 s), passed as the `userToken` prop; `onUserTokenExpiring` lets you refresh it [K8].
- **Real-time.** WebSocket `new-message` event (may be throttled) plus REST feed fetch [K9].
- **Batching.** Batch function per recipient, optional batch key, fixed, dynamic or sliding windows up to 90 days, max items 2–1000. Batch is not plan-gated; only rendering more than 10 activities is Enterprise [K10][K6].
- **Local or test mode.** No local or offline mode. Unlimited isolated environments (Development, Production, more) with separate keys and data [K11][K1].
- **Storing only at the vendor.** Best fit: "In-app feed notifications are available indefinitely"; only logs expire (30 days, 90 on Enterprise) [K12].
- **Data residency.** US only today [K5][K6].

### Courier

- **User identity.** `user_id` is your own id; profiles via `POST /profiles/{user_id}` (merge), `PUT` (replace). A send to `{ user_id }` looks up an existing profile and **does not create one** from the `to` object [C5].
- **Feed auth.** Backend calls `POST /auth/issue-token` with scopes `user_id:<id> inbox:read:messages inbox:write:events`; client calls `signIn({ userId, jwt })`. Omit `expires_in` and the token never expires; the SDK doesn't refresh tokens [C6].
- **Real-time.** WebSocket after `inbox.listenForUpdates()` [C2].
- **Batching.** Batch step (wait period, max wait, max items, user or dynamic key) [C7], but the pricing page lists "Digest & batching" under **Enterprise** [C1].
- **Local or test mode.** Every workspace has Production and Test environments; no separate test mode [C8].
- **Storing only at the vendor.** Inbox retention isn't documented.
- **Data residency.** EU (Ireland) on Business and Enterprise; data already sent through the US stays in the US [C4].

### MagicBell

- **User identity.** `external_id` (immutable once set) or email; upserts on notification create [M4].
- **Feed auth.** User JWT, HS256, signed with the project Secret Key on the server; claims `user_external_id` and/or `user_email`, `api_key`. The docs' example lifetime is 1 year [M7].
- **Real-time.** WebSocket via `magicbell-js/realtime` [M5][M6].
- **Batching.** None documented on broadcasts [M8].
- **Local or test mode.** None documented.
- **Storing only at the vendor.** Retention isn't documented.
- **Data residency.** Not documented [M3].

## Risks

1. **Novu's feed retention vs. "stored only at the vendor".** On Free, Notifications are gone after 30 days, after 90 on Pro/Team. That's fine if a Notification is a nudge (the record lives in the Refund Request, the Transactional Email, the comment). It's not fine if Students expect a permanent history. Decide this explicitly; it's a good candidate for the ADR on vendor-only storage.
2. **Novu free-tier workflow cap.** 5 workflows on Free, 20 on Pro ($30/mo) [N1][N10]. Four roles with several event types each will probably exceed 5, so expect Pro before launch. Digest windows over 1 day also need Pro.
3. **Novu HMAC hash never expires.** Anyone holding a user's `subscriberHash` can read that user's feed indefinitely, unless the secret key is rotated (which invalidates every hash). Knock's and Courier's expiring JWTs are stronger.
4. **Region is a one-way door with Novu.** It's chosen at account creation and data can't be moved [N6]. Create the EU account deliberately; the Development environment lives in the same account.
5. **Knock's EU date.** Knock says EU residency by end of 2026 [K6]; on 2026-11-12 its docs still say "coming soon". If it ships, the gap with Knock narrows to self-hosting.
6. **No vendor has an offline mode**, so tests and DevUI user-switching depend on Cadence's own stand-in transport for triggers *and* a stand-in data source for the feed UI.
7. **Novu Framework vs. dashboard workflows.** Code-first (Framework) workflows need a public "bridge endpoint" in Cadence and a tunnel for local dev [N11]. Dashboard-defined workflows avoid that but live outside the repo.
8. **Pricing and plan gates drift.** Novu's pricing page and its limits page disagree on activity-feed retention ("24 hours" vs "1 day") [N1][N10]; Knock's pricing page and retention docs disagree on whether feed retention is configurable [K1][K12].

## Sources

Novu

- [N1] Pricing: https://novu.co/pricing
- [N2] Inbox overview: https://docs.novu.co/platform/inbox/overview
- [N3] `useNotifications` hook: https://docs.novu.co/platform/sdks/react/hooks/use-notifications
- [N4] Preferences: https://docs.novu.co/platform/concepts/preferences
- [N5] Self-hosting overview: https://docs.novu.co/community/self-hosting-novu/overview
- [N6] Security and compliance (regions, Inbox retention): https://docs.novu.co/platform/additional-resources/security
- [N7] Subscribers: https://docs.novu.co/platform/concepts/subscribers
- [N8] Prepare for production (HMAC, EU URLs): https://docs.novu.co/platform/inbox/prepare-for-production
- [N9] Digest step: https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest
- [N10] Limits: https://docs.novu.co/platform/developer/limits
- [N11] Local Studio: https://docs.novu.co/framework/studio
- [repo] https://github.com/novuhq/novu (`LICENSE-MIT`, `LICENSE-ENTERPRISE`, `EE-PACKAGES-LICENSE`)

Knock

- [K1] Pricing: https://knock.app/pricing
- [K2] React SDK overview: https://docs.knock.app/in-app-ui/react/overview
- [K3] Custom notification UI with hooks: https://docs.knock.app/in-app-ui/react/custom-notifications-ui
- [K4] Preferences: https://docs.knock.app/concepts/preferences and https://docs.knock.app/in-app-ui/react/preferences
- [K5] Privacy policy (data stored in the US): https://knock.app/legal/privacy-policy
- [K6] Plans and usage (EU residency roadmap, Enterprise-only features): https://docs.knock.app/manage-your-account/knock-plans
- [K7] Users: https://docs.knock.app/concepts/users
- [K8] Security and authentication: https://docs.knock.app/in-app-ui/security-and-authentication
- [K9] In-app APIs and real-time service: https://docs.knock.app/in-app-ui/api-overview
- [K10] Batch function: https://docs.knock.app/designing-workflows/batch-function
- [K11] Environments: https://docs.knock.app/concepts/environments
- [K12] Data retention: https://docs.knock.app/manage-your-account/data-retention
- SDK repo: https://github.com/knocklabs/javascript (MIT)

Courier

- [C1] Pricing: https://www.courier.com/pricing
- [C2] Courier React SDK: https://www.courier.com/docs/sdk-libraries/courier-react-web
- [C3] Preferences: https://www.courier.com/docs/platform/preferences/preferences-overview
- [C4] EU datacenter: https://courier.com/docs/platform/workspaces/eu-datacenter
- [C5] Users: https://www.courier.com/docs/platform/users/users-overview
- [C6] Inbox authentication: https://www.courier.com/docs/platform/inbox/authentication
- [C7] Batching: https://www.courier.com/docs/platform/automations/batching
- [C8] Environments and API keys: https://courier.com/docs/platform/workspaces/environments-api-keys

MagicBell

- [M1] Pricing: https://www.magicbell.com/pricing
- [M2] React components: https://www.magicbell.com/docs/libraries/magicbell-react
- [M3] Trust Centre: https://www.magicbell.com/security
- [M4] User primitive: https://www.magicbell.com/docs/primitive/user
- [M5] Browser/Node client (`magicbell-js`): https://www.magicbell.com/docs/libraries/magicbell-js
- [M6] In-app channel: https://www.magicbell.com/docs/channels/in_app
- [M7] User JWT: https://www.magicbell.com/docs/api/authentication/user
- [M8] Broadcast primitive: https://www.magicbell.com/docs/primitive/broadcast
- [repo] https://github.com/magicbell/magicbell-js (proprietary `LICENSE`)

[npm] `npm view` on 2026-11-12: `@novu/react@3.19.2`, `@novu/api@3.19.1`, `@novu/node@2.6.6` (deprecated), `@knocklabs/react@0.15.1`, `@knocklabs/node@1.41.1`, `@trycourier/courier-react@9.3.5`, `@trycourier/courier@10.0.0`, `@magicbell/react@1.14.0`, `magicbell-js@1.8.0`. Hook names checked against each package's published `.d.ts` files.
