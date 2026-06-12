# Vorion Quickstart — a governed agent in 60 lines

This example is the complete Vorion story, runnable, against the **published npm packages**:

1. **Trust is computed from evidence, not asserted.** An agent's score comes from sandbox tests, uptime history, and human approvals — weighted, on a 0–1000 scale.
2. **Every action passes a pre-action gate.** Low-risk reads sail through; an irreversible $25k wire at modest trust is **rejected before execution** with the reasoning attached.
3. **Trust must be earned — and observability caps it.** A pile of audit evidence raises the raw score to 968, but GRAY_BOX observation (I/O + logs only) caps usable trust at 750. CRITICAL actions need 800. More evidence can't break the ceiling — **better observability can** (WHITE_BOX → ceiling 900).
4. **Humans stay in the loop.** Even at 900 trust, the CRITICAL wire returns `PENDING_HUMAN_APPROVAL` — high trust earns the *request*, not a rubber stamp.
5. **Everything is witnessed.** Every gate decision lands in an audit trail.

## Run it

```bash
npm install
npm start
```

That's it — two published packages (`@vorionsys/a3i`, `@vorionsys/contracts`), no build step, no config.

## Expected output

```
[1] invoice-bot-01 scored 562.5/1000 from 3 pieces of evidence (GRAY_BOX observation)
[2] READ public catalog   → APPROVED  (risk READ: needs 0, has 562.5)
[3] WIRE $25k             → REJECTED  (risk CRITICAL: needs 800, has 562.5, deficit 237.5)
     gate's reasoning: High-risk action type (delete/transfer)
[4] after audits: raw 968.75 → 750/1000 (GRAY_BOX ceiling caps trust at 750; CRITICAL actions need 800)
[5] WHITE_BOX observation lifts ceiling → 900/1000 → WIRE retry → PENDING_HUMAN_APPROVAL  (needs 800, has 900)
[6] audit trail — 3 gate events:
     GATE_APPROVED  invoice-bot-01  "Read public price list"  trust=562.5 risk=READ
     GATE_REJECTED  invoice-bot-01  "Wire $25,000 to new vendor"  trust=562.5 risk=CRITICAL
     GATE_PENDING   invoice-bot-01  "Wire $25,000 to new vendor"  trust=900 risk=CRITICAL
```

## APIs used

| API | Package | What it does |
|---|---|---|
| `createTrustCalculator()` | `@vorionsys/a3i` | Evidence → 16-factor trust profile (`calculate`, `recalculate`, `applyCeiling`) |
| `createPreActionGate()` / `verify()` | `@vorionsys/a3i` | Risk-classifies an action and gates it against trust thresholds |
| `createMapTrustProvider()` | `@vorionsys/a3i` | Wires trust scores into the gate |
| `ObservationTier`, `ActionType`, `DataSensitivity`, `Reversibility` | `@vorionsys/contracts` | Canonical enums driving risk + ceiling math |

This example runs in CI on every PR and weekly against the live npm registry, so the published quickstart can never silently break again.
