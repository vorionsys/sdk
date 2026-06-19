# Quickstart — a governed agent in ~50 lines

A runnable example of [`@vorionsys/sdk`](https://www.npmjs.com/package/@vorionsys/sdk): register an
agent, request actions through a governance gate, watch trust move, and read the audit trail —
using **only published packages**, no server required.

```bash
npm install
node quickstart.mjs      # or: npm start
```

## What it shows

1. **Capabilities are explicit.** An agent only gets what you grant it (`read`, `write:reports`); an
   un-granted action (`transfer`) is denied.
2. **Decisions carry a tier, a reason, constraints, and a proof ID** for audit.
3. **Trust is dynamic.** `reportFailure()` erodes the score; once it drops below the action floor,
   even a capability-matched action is denied.
4. **Everything is logged** (`getActionHistory()`).

## Local mode vs. remote mode

This runs in **local mode** — an in-memory **capability + trust-floor** gate, ideal for learning the
shape of the API offline. It deliberately does **not** bundle Vorion's trust engine.

For full **evidence-/risk-based** governance — action magnitude, reversibility, data sensitivity,
attestation, and observation ceilings — point the SDK at a hosted **Cognigate** endpoint; the engine
stays remote:

```js
const vorion = createVorion({
  apiEndpoint: 'https://api.cognigate.dev',
  apiKey: process.env.VORION_API_KEY,
});
// same Agent API — requestAction / reportSuccess / reportFailure / getTrustInfo
```

## Trust tiers

Scores run 0–1000 across eight tiers: **T0** Sandbox · **T1** Observed · **T2** Provisional ·
**T3** Monitored · **T4** Standard · **T5** Trusted · **T6** Certified · **T7** Autonomous.
