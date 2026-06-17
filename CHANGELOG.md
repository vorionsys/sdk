# Changelog

All notable changes to `@vorionsys/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-17

### Changed

- **BREAKING — clean rewrite.** Re-released on the `@vorionsys/sdk` name as a standalone, dependency-clean TypeScript client. The legacy `0.3.x` line (withdrawn pending IP review) and its internal/moat dependency chain (`@vorionsys/a3i`, `@vorionsys/atsf-core`, `@vorionsys/security`) are dropped.
- The only `@vorionsys` dependency is now `@vorionsys/runtime` (`^0.1.2`), declared as an **optional peer** and consumed **type-only** (erased at build — no runtime `require`).
- Apache-2.0 licensed; complete governance docs (LICENSE, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT).

### Retained (stable public surface)

- `Vorion` client with **local** (in-memory trust scoring) and **remote** (hosted Cognigate API) modes, the `Agent` governance lifecycle (register, request, report), and the `createVorion()` factory.
- Remote mode targets the Cognigate trust API: `POST /api/v1/intents`, `/api/v1/intents/check`, `POST /api/v1/trust/admit`, `GET /api/v1/trust/{agentId}`, `POST /api/v1/trust/{agentId}/signal`, `GET /api/v1/health`.
- BASIS trust-tier model (T0–T7, `BLACK_BOX`/`GRAY_BOX`/`WHITE_BOX`) and proof-commitment IDs on every decision.

### Migration from 0.3.x

- `0.3.x` was deprecated/withdrawn pending IP review; `1.0.0` is its supported, dependency-clean successor on the same name. Re-install `@vorionsys/sdk@^1.0.0` — the documented client surface (`Vorion`, `Agent`, `createVorion`) is preserved.

## [0.1.2] - 2026-02-17

### Changed
- Removed raw `src` from published tarball (dist-only)
- Standardized package metadata for npm publish

## [0.1.1] - 2026-02-11

### Fixed

- Corrected default observation tier assignment during agent registration
- Improved error messages for missing capabilities in local mode

## [0.1.0] - 2026-02-08

### Added

- Initial release of `@vorionsys/sdk`
- `Vorion` client class with local and remote mode support
- `Agent` class with governance request lifecycle (register, request, report)
- `createVorion()` factory function
- Local mode with in-memory trust scoring and capability-based authorization
- Remote mode connecting to Cognigate API (`/api/v1/intents`, `/api/v1/trust`)
- Trust tier system (T0-T7) with asymmetric score adjustments
- Constraint application based on trust tier (rate limits, audit levels, sandboxing)
- Proof commitment IDs on every action decision for audit compliance
- Action history tracking per agent
- Health check endpoint support
- Full TypeScript type definitions (`VorionConfig`, `AgentOptions`, `ActionResult`, `TrustInfo`)
- Re-exported runtime types (`TrustTier`, `DecisionTier`, `AgentCredentials`, `Action`, `TrustSignal`)

[1.0.0]: https://github.com/vorionsys/sdk/releases/tag/v1.0.0
[0.1.1]: https://github.com/vorionsys/vorion/compare/@vorionsys/sdk@0.1.0...@vorionsys/sdk@0.1.1
[0.1.0]: https://github.com/vorionsys/vorion/releases/tag/@vorionsys/sdk@0.1.0
