# Contributing to the Vorion SDK

Thank you for considering a contribution. This repository holds `@vorionsys/sdk`, a small TypeScript client library for AI agent governance over the BASIS framework.

This is a small-team project. Open an issue before doing significant work — it avoids effort on a direction that will not merge.

## What we accept

**Bug fixes** to the client (api-client, agent-trust, capability-matching), with a regression test.

**New tests** under `src/__tests__/`.

**Documentation, typos, clarifications.** Always welcome.

**Additive API surface** that does not break the public exports documented in the README.

> Behavior that changes trust math or tier boundaries does **not** live here — it belongs in [`@vorionsys/basis-spec`](https://github.com/vorionsys/basis-spec). File there instead.

## What we do not accept without discussion

- Breaking changes to the public exports (`Vorion`, `Agent`, `createVorion`, the exported interfaces/types) without a major version bump.
- Re-implementing governance logic that belongs in the runtime or the spec.

## Before you open a PR

This is a single package (not a monorepo). Run the gates CI runs (Node 22):

- `npm install`
- `npx tsc --noEmit` — typecheck (CI runs this explicitly; there is no `typecheck` npm script)
- `npm run build` — `tsc`
- `npm test` — `vitest run` (use `npm run test:watch` for local iteration)

Add or update tests that demonstrate the change.

## Commit style

Conventional commits are encouraged but not mandatory:

- `feat(sdk):` new or changed client API
- `fix:` correct a bug
- `docs:` documentation
- `test:` / `chore:` tests and housekeeping

## Reporting security issues

Do not open a public issue for security vulnerabilities. See [SECURITY.md](./SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## License

By submitting a Contribution, you agree to license your work under the Apache License, Version 2.0 (the license this project carries). You retain copyright on your Contribution; the license grants us and all users the right to use, modify, and redistribute under the same terms.

## Who decides what merges

Vorion LLC maintains this repository and has final commit authority. Issues and PRs are tracked in `vorionsys/sdk`.
