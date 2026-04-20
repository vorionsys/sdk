# Changelog

All notable changes to `@vorionsys/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.1]: https://github.com/vorionsys/vorion/compare/@vorionsys/sdk@0.1.0...@vorionsys/sdk@0.1.1
[0.1.0]: https://github.com/vorionsys/vorion/releases/tag/@vorionsys/sdk@0.1.0
