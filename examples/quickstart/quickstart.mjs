// Vorion quickstart — a trust-scored, capability-gated agent in one file.
// Uses only published @vorionsys packages. Run: node quickstart.mjs
import { createTrustCalculator, createPreActionGate, createMapTrustProvider } from '@vorionsys/a3i';
import { ObservationTier, ActionType, DataSensitivity, Reversibility } from '@vorionsys/contracts';

const agentId = 'invoice-bot-01';
const calculator = createTrustCalculator();
const now = new Date();

// ── 1. Trust is computed from evidence, not asserted ─────────────────────
const evidence = [
  { evidenceId: 'e1', factorCode: 'CT-COMP',  impact: 400, source: 'sandbox test suite',    collectedAt: now, evidenceType: 'sandbox_test' },
  { evidenceId: 'e2', factorCode: 'CT-REL',   impact: 300, source: '30-day uptime monitor', collectedAt: now },
  { evidenceId: 'e3', factorCode: 'OP-HUMAN', impact: 500, source: 'operator approval',     collectedAt: now, evidenceType: 'hitl_approval' },
];
const profile = calculator.calculate(agentId, ObservationTier.GRAY_BOX, evidence);
const score = calculator.applyCeiling(profile.compositeScore, ObservationTier.GRAY_BOX);
console.log(`[1] ${agentId} scored ${score}/1000 from ${evidence.length} pieces of evidence (GRAY_BOX observation)`);

// ── 2. Every action passes a pre-action gate wired to that score ─────────
const auditTrail = [];
const gate = createPreActionGate(undefined, createMapTrustProvider({ [agentId]: score }));
gate.addEventListener((e) => auditTrail.push(e));

const wire = {
  agentId, action: 'Wire $25,000 to new vendor', actionType: ActionType.TRANSFER,
  resourceScope: ['bank/wires'], dataSensitivity: DataSensitivity.RESTRICTED,
  reversibility: Reversibility.IRREVERSIBLE, magnitude: 25000,
};

// ── 3. Low-risk action → approved ────────────────────────────────────────
const read = await gate.verify({
  agentId, action: 'Read public price list', actionType: ActionType.READ,
  resourceScope: ['catalog/prices'], dataSensitivity: DataSensitivity.PUBLIC,
  reversibility: Reversibility.REVERSIBLE,
});
console.log(`[2] READ public catalog   → ${read.status}  (risk ${read.riskLevel}: needs ${read.requiredTrust}, has ${read.currentTrust})`);

// ── 4. Irreversible high-risk action at modest trust → REJECTED ──────────
const blocked = await gate.verify(wire);
console.log(`[3] WIRE $25k             → ${blocked.status}  (risk ${blocked.riskLevel}: needs ${blocked.requiredTrust}, has ${blocked.currentTrust}, deficit ${blocked.trustDeficit})`);
console.log(`     gate's reasoning: ${blocked.reasoning[0]}`);

// ── 5. Trust must be EARNED — and observability caps it ──────────────────
const codes = ['CT-OBS','CT-TRANS','CT-ACCT','CT-SAFE','CT-SEC','CT-PRIV','CT-ID','OP-ALIGN','OP-CONTEXT','OP-STEW','SF-HUM','SF-ADAPT','SF-LEARN'];
const audits = codes.map((factorCode, i) => ({
  evidenceId: `audit-${i}`, factorCode, impact: 800, source: 'quarterly security audit', collectedAt: now,
  evidenceType: i % 3 ? 'audit' : 'hitl_approval',
}));
const grown = calculator.recalculate(profile, audits);
const grayCapped = calculator.applyCeiling(grown.compositeScore, ObservationTier.GRAY_BOX);
console.log(`[4] after audits: raw ${grown.compositeScore} → ${grayCapped}/1000 (GRAY_BOX ceiling caps trust at 750; CRITICAL actions need 800)`);

// More evidence can't break the ceiling — better OBSERVABILITY can:
const whiteBoxScore = calculator.applyCeiling(grown.compositeScore, ObservationTier.WHITE_BOX);
const retry = await gate.verify(wire, whiteBoxScore);
console.log(`[5] WHITE_BOX observation lifts ceiling → ${whiteBoxScore}/1000 → WIRE retry → ${retry.status}  (needs ${retry.requiredTrust}, has ${retry.currentTrust})`);

// ── 6. Every decision was witnessed ───────────────────────────────────────
console.log(`[6] audit trail — ${auditTrail.length} gate events:`);
for (const e of auditTrail) console.log(`     ${e.type.padEnd(14)} ${e.agentId}  "${e.action}"  trust=${e.trustScore} risk=${e.riskLevel}`);
