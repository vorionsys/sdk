// Vorion quickstart — a governed agent in ~50 lines, using ONLY the published
// @vorionsys/sdk. No server to run and no proprietary engine imported: local
// mode is an in-memory capability + trust-floor gate, perfect for getting a feel
// for the model. For evidence-/risk-based governance (action magnitude,
// reversibility, attestation, observation ceilings) point the SDK at a hosted
// Cognigate endpoint with { apiEndpoint, apiKey } — the trust engine stays remote.
//
//   Run:  npm install && node quickstart.mjs

import { createVorion } from '@vorionsys/sdk';

const vorion = createVorion({ localMode: true, defaultObservationTier: 'GRAY_BOX' });

// 1) Register an agent with explicit, scoped capabilities (nothing is assumed).
const agent = await vorion.registerAgent({
  agentId: 'invoice-bot-01',
  name: 'Invoice Bot',
  capabilities: ['read', 'write:reports'], // read anything; write only under reports/
  observationTier: 'GRAY_BOX',
});
const start = await agent.getTrustInfo();
console.log(`▸ registered "${agent.getName()}" — T${start.tierNumber} ${start.tierName}, score ${start.score}/1000\n`);

// 2) In-scope action → allowed, with tier-appropriate constraints and an audit proof.
const read = await agent.requestAction({ type: 'read', resource: 'documents/report.pdf' });
console.log(`read  documents/report.pdf      → ${verdict(read)}`);
console.log(`        constraints: ${(read.constraints ?? []).join(', ') || 'none'}   proof: ${read.proofId.slice(0, 8)}…\n`);

// 3) Out-of-scope action → denied. The agent has no 'transfer' capability.
const wire = await agent.requestAction({ type: 'transfer', resource: 'bank/wires', parameters: { amount: 25_000 } });
console.log(`transfer  bank/wires ($25k)     → ${verdict(wire)}\n`);

// 4) Trust is earned and lost. Repeated failures erode the score below the action floor (200).
for (let i = 0; i < 20; i++) await agent.reportFailure('write', 'simulated bad outcome');
const eroded = await agent.getTrustInfo();
console.log(`▸ after 20 reported failures — T${eroded.tierNumber} ${eroded.tierName}, score ${eroded.score}/1000`);
const write = await agent.requestAction({ type: 'write', resource: 'reports/q3.csv' });
console.log(`write reports/q3.csv            → ${verdict(write)}   (has the capability, but trust is now too low)\n`);

// 5) Every decision is recorded for audit.
console.log(`▸ audit trail: ${agent.getActionHistory().map(h => `${h.allowed ? '✓' : '✗'}${h.action}`).join('  ')}`);

function verdict(r) {
  return `${r.allowed ? 'ALLOW' : 'DENY '} [${r.tier}] — ${r.reason}`;
}
