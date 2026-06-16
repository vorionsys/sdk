# Security Policy

## Reporting a vulnerability

Report security issues **privately** — not through public GitHub issues or discussions.

**Preferred:** use GitHub's private vulnerability reporting for this repository — open the **Security** tab → **Report a vulnerability**. This keeps the report, the maintainers, and any fix in one private thread.

**Alternative:** email **security@vorion.org**.

> The `security@vorion.org` inbox and the response timeframes below are a stated intent, **pending inbox and SLA verification** — they are not yet a contractual commitment. If you do not get an acknowledgment, please open a private GitHub vulnerability report as well.

Include:
- Affected package and version (`@vorionsys/sdk`, and whether you hit local or remote mode)
- Reproduction steps or a minimal test case
- Your assessment of severity and impact
- Whether you intend to disclose publicly, and on what timeline

**Target (not a guaranteed SLA):** acknowledge within 3 business days; confirm or refute within 14 days of acknowledgment.

## Scope

In-scope:
- Any path where the client leaks the API key (writing `apiKey` to logs, error messages, or persisting it unintentionally)
- TLS / endpoint handling flaws in remote mode
- Capability-matching glob bypass — a pattern that grants more than declared
- Trust-signal handling that lets a caller forge a higher tier locally

Out-of-scope:
- The Cognigate server / runtime the client talks to (report to that team)
- `@vorionsys/runtime` and other peer dependencies (report upstream)
- The BASIS constants / formulas themselves (report to [`vorionsys/basis-spec`](https://github.com/vorionsys/basis-spec))
- Vulnerabilities in dependencies (report those upstream)

## Supported versions

Phrased against `@vorionsys/sdk`. Note the published `0.3.x` line is a different, partially-incompatible layout from the `1.0.0` rewrite — security reports should state which line they hit. There is no LTS commitment while pre-1.0.

## Disclosure

We prefer coordinated disclosure. Once we acknowledge and have a fix in progress, we will agree on a public disclosure date. The reporter is credited unless anonymity is requested. If an issue is already being exploited in the wild, we may disclose immediately.

## Key & secret handling

The SDK holds an API key for remote mode and an in-memory trust store for local mode. It ships **no signing keys** and implements **no cryptographic primitives**. In scope: any path where the API key is written to logs, error messages, or persisted unintentionally. The proof-chain shape and signing belong to `@vorionsys/basis-spec` and the runtime, respectively — report those there.

## PGP

Not offered at this time. GitHub private reporting or email is sufficient for our scale. If you require encrypted communication, ask and we will arrange it.
