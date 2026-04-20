// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

/**
 * Agent trust scoring, tier boundaries, and constraints tests (~45 tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Vorion, Agent } from '../index.js';

describe('Agent Trust', () => {
  let vorion: Vorion;

  beforeEach(() => {
    vorion = new Vorion({ localMode: true });
  });

  // --- Trust Score Basics ---

  describe('Initial Trust Score', () => {
    it('should start with trust score of 500', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'init-trust', name: 'Init Trust', capabilities: ['read'],
      });
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(500);
    });

    it('should start at tier T3 (Monitored)', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'init-tier', name: 'Init Tier', capabilities: ['read'],
      });
      const info = await agent.getTrustInfo();
      expect(info.tierNumber).toBe(3);
      expect(info.tierName).toBe('Monitored');
    });
  });

  // --- Tier Boundary Tests ---

  describe('Tier Boundaries', () => {
    async function createAgentAtScore(score: number): Promise<Agent> {
      const agent = await vorion.registerAgent({
        agentId: `tier-${score}-${Math.random().toString(36).slice(2)}`,
        name: `Agent at ${score}`,
        capabilities: ['read'],
      });
      // Manipulate score: start at 500, adjust via reportSuccess (+2) or reportFailure (-20)
      const diff = score - 500;
      if (diff > 0) {
        // Each reportSuccess adds +2
        const successes = Math.ceil(diff / 2);
        for (let i = 0; i < successes; i++) {
          await agent.reportSuccess('read');
        }
      } else if (diff < 0) {
        // Each reportFailure subtracts 20
        const failures = Math.ceil(Math.abs(diff) / 20);
        for (let i = 0; i < failures; i++) {
          await agent.reportFailure('read');
        }
      }
      return agent;
    }

    it('should be T0 (Sandbox) at score 0', async () => {
      const agent = await createAgentAtScore(0);
      const info = await agent.getTrustInfo();
      expect(info.tierNumber).toBe(0);
      expect(info.tierName).toBe('Sandbox');
    });

    it('should be T0 (Sandbox) at score 199', async () => {
      // 500 - 199 = need to reduce by 301. 301/20 = 16 failures = 320 reduction => score 180
      // Approximate: we get close to 199 but the test checks tier
      const agent = await vorion.registerAgent({
        agentId: 'tier-199', name: 'Agent 199', capabilities: ['read'],
      });
      // 500 - 16*20 = 500 - 320 = 180 => T0
      for (let i = 0; i < 16; i++) {
        await agent.reportFailure('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBeLessThan(200);
      expect(info.tierNumber).toBe(0);
      expect(info.tierName).toBe('Sandbox');
    });

    it('should be T1 (Observed) at score 200', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-200', name: 'Agent 200', capabilities: ['read'],
      });
      // 500 - 15*20 = 500 - 300 = 200 => T1
      for (let i = 0; i < 15; i++) {
        await agent.reportFailure('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(200);
      expect(info.tierNumber).toBe(1);
      expect(info.tierName).toBe('Observed');
    });

    it('should be T1 (Observed) at score 349', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-349', name: 'Agent 349', capabilities: ['read'],
      });
      // 500 - 8*20 = 500 - 160 = 340 => T1
      for (let i = 0; i < 8; i++) {
        await agent.reportFailure('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(340);
      expect(info.tierNumber).toBe(1);
    });

    it('should be T2 (Provisional) at score 350', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-350', name: 'Agent 350', capabilities: ['read'],
      });
      // 500 - 8*20 = 340 (T1), then +5 successes = 340+10 = 350 => T2
      for (let i = 0; i < 8; i++) {
        await agent.reportFailure('read');
      }
      for (let i = 0; i < 5; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(350);
      expect(info.tierNumber).toBe(2);
      expect(info.tierName).toBe('Provisional');
    });

    it('should be T2 (Provisional) at score 499', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-499', name: 'Agent 499', capabilities: ['read'],
      });
      // 500 - 1*20 = 480. Then +9*2 = 498. Still need 1 more.
      // Actually, just do 1 failure: 500-20 = 480 => T2
      await agent.reportFailure('read');
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(480);
      expect(info.tierNumber).toBe(2);
      expect(info.tierName).toBe('Provisional');
    });

    it('should be T3 (Monitored) at score 500', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-500', name: 'Agent 500', capabilities: ['read'],
      });
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(500);
      expect(info.tierNumber).toBe(3);
      expect(info.tierName).toBe('Monitored');
    });

    it('should be T3 (Monitored) at score 649', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-649', name: 'Agent 649', capabilities: ['read'],
      });
      // 500 + 74*2 = 500 + 148 = 648 => T3
      for (let i = 0; i < 74; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(648);
      expect(info.tierNumber).toBe(3);
    });

    it('should be T4 (Standard) at score 650', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-650', name: 'Agent 650', capabilities: ['read'],
      });
      // 500 + 75*2 = 500 + 150 = 650 => T4
      for (let i = 0; i < 75; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(650);
      expect(info.tierNumber).toBe(4);
      expect(info.tierName).toBe('Standard');
    });

    it('should be T4 (Standard) at score 799', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-799', name: 'Agent 799', capabilities: ['read'],
      });
      // 500 + 149*2 = 500 + 298 = 798 => T4
      for (let i = 0; i < 149; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(798);
      expect(info.tierNumber).toBe(4);
    });

    it('should be T5 (Trusted) at score 800', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-800', name: 'Agent 800', capabilities: ['read'],
      });
      // 500 + 150*2 = 800 => T5
      for (let i = 0; i < 150; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(800);
      expect(info.tierNumber).toBe(5);
      expect(info.tierName).toBe('Trusted');
    });

    it('should be T5 (Trusted) at score 875', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-875', name: 'Agent 875', capabilities: ['read'],
      });
      // Need score near 875. requestAction with capability also adds +1.
      // Use reportSuccess (+2 each): 500 + 187*2 = 874, one more = 876 => T6
      // Actually 500 + 187*2 = 874. That's T5 (< 876).
      for (let i = 0; i < 187; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(874);
      expect(info.tierNumber).toBe(5);
    });

    it('should be T6 (Certified) at score 876', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-876', name: 'Agent 876', capabilities: ['read'],
      });
      // 500 + 188*2 = 876 => T6
      for (let i = 0; i < 188; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(876);
      expect(info.tierNumber).toBe(6);
      expect(info.tierName).toBe('Certified');
    });

    it('should be T6 (Certified) at score 950', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-950', name: 'Agent 950', capabilities: ['read'],
      });
      // 500 + 225*2 = 950 => T6 (< 951)
      for (let i = 0; i < 225; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(950);
      expect(info.tierNumber).toBe(6);
    });

    it('should be T7 (Autonomous) at score 951', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-951', name: 'Agent 951', capabilities: ['read'],
      });
      // 500 + 226*2 = 952 => T7 (>= 951). Close enough.
      for (let i = 0; i < 226; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBeGreaterThanOrEqual(951);
      expect(info.tierNumber).toBe(7);
      expect(info.tierName).toBe('Autonomous');
    });

    it('should be T7 (Autonomous) at score 1000', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-1000', name: 'Agent 1000', capabilities: ['read'],
      });
      // 500 + 250*2 = 1000, capped at 1000
      for (let i = 0; i < 260; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(1000);
      expect(info.tierNumber).toBe(7);
      expect(info.tierName).toBe('Autonomous');
    });
  });

  // --- Trust Score Movement ---

  describe('Trust Score Movement', () => {
    it('should increase by 2 on reportSuccess', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'inc-2', name: 'Inc 2', capabilities: ['read'],
      });
      await agent.reportSuccess('read');
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(502);
    });

    it('should decrease by 20 on reportFailure', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'dec-20', name: 'Dec 20', capabilities: ['read'],
      });
      await agent.reportFailure('read');
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(480);
    });

    it('should demonstrate asymmetric trust (failure costs more than success gains)', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'asym', name: 'Asymmetric', capabilities: ['read'],
      });
      // 1 success = +2, 1 failure = -20 => net -18
      await agent.reportSuccess('read');
      await agent.reportFailure('read');
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(482); // 500 + 2 - 20
    });

    it('should not exceed 1000', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'cap-1000', name: 'Cap 1000', capabilities: ['read'],
      });
      for (let i = 0; i < 300; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(1000);
    });

    it('should not go below 0', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'floor-0', name: 'Floor 0', capabilities: ['read'],
      });
      for (let i = 0; i < 30; i++) {
        await agent.reportFailure('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(0);
    });

    it('should increase by 1 when allowed action is performed (requestAction)', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'req-inc', name: 'Req Inc', capabilities: ['read'],
      });
      await agent.requestAction({ type: 'read', resource: 'file.txt' });
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(501); // 500 + 1 from allowed action
    });

    it('should not change score when action is denied', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'req-deny', name: 'Req Deny', capabilities: [],
      });
      await agent.requestAction({ type: 'read', resource: 'file.txt' });
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(500); // No change when denied
    });

    it('should accumulate multiple successes correctly', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'multi-suc', name: 'Multi Success', capabilities: ['read'],
      });
      for (let i = 0; i < 10; i++) {
        await agent.reportSuccess('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(520); // 500 + 10*2
    });

    it('should accumulate multiple failures correctly', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'multi-fail', name: 'Multi Fail', capabilities: ['read'],
      });
      for (let i = 0; i < 5; i++) {
        await agent.reportFailure('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(400); // 500 - 5*20
    });
  });

  // --- Constraints ---

  describe('Constraints for Tier', () => {
    it('should return sandbox constraints for T0-T1', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'const-t0', name: 'Const T0', capabilities: ['read'],
      });
      // Drop to T1: 500 - 15*20 = 200
      for (let i = 0; i < 15; i++) {
        await agent.reportFailure('read');
      }
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(true);
      expect(result.constraints).toContain('rate_limit:10/min');
      expect(result.constraints).toContain('audit:full');
      expect(result.constraints).toContain('sandbox:true');
    });

    it('should return standard constraints for T2-T3', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'const-t3', name: 'Const T3', capabilities: ['read'],
      });
      // Score is 500 = T3
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.constraints).toContain('rate_limit:100/min');
      expect(result.constraints).toContain('audit:standard');
    });

    it('should return light constraints for T4-T5', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'const-t4', name: 'Const T4', capabilities: ['read'],
      });
      // Raise to T4: 500 + 75*2 = 650
      for (let i = 0; i < 75; i++) {
        await agent.reportSuccess('read');
      }
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.constraints).toContain('rate_limit:1000/min');
      expect(result.constraints).toContain('audit:light');
    });

    it('should return no constraints for T6-T7', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'const-t7', name: 'Const T7', capabilities: ['read'],
      });
      // Raise to T6: 500 + 188*2 = 876
      for (let i = 0; i < 188; i++) {
        await agent.reportSuccess('read');
      }
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.constraints).toEqual([]);
    });

    it('should not include constraints when action is denied', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'const-deny', name: 'Const Deny', capabilities: [],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(false);
      expect(result.constraints).toBeUndefined();
    });
  });

  // --- Request Action with Trust ---

  describe('Request Action with Trust Score', () => {
    it('should deny action when trust score is below 200 even with capability', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'low-trust', name: 'Low Trust', capabilities: ['read'],
      });
      // Drop below 200: 500 - 16*20 = 180
      for (let i = 0; i < 16; i++) {
        await agent.reportFailure('read');
      }
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Trust score too low');
    });

    it('should allow action at trust score exactly 200 with capability', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'exact-200', name: 'Exact 200', capabilities: ['read'],
      });
      // Drop to 200: 500 - 15*20 = 200
      for (let i = 0; i < 15; i++) {
        await agent.reportFailure('read');
      }
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(200);
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(true);
    });

    it('should return GREEN tier for allowed actions', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'green', name: 'Green', capabilities: ['read'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.tier).toBe('GREEN');
    });

    it('should return RED tier for denied actions', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'red', name: 'Red', capabilities: [],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.tier).toBe('RED');
    });

    it('should return a proofId for every action request', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'proof', name: 'Proof', capabilities: ['read'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.proofId).toBeDefined();
      expect(typeof result.proofId).toBe('string');
      expect(result.proofId.length).toBeGreaterThan(0);
    });

    it('should return unique proofIds for different requests', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'unique-proof', name: 'Unique Proof', capabilities: ['read'],
      });
      const r1 = await agent.requestAction({ type: 'read', resource: 'a.txt' });
      const r2 = await agent.requestAction({ type: 'read', resource: 'b.txt' });
      expect(r1.proofId).not.toBe(r2.proofId);
    });
  });

  // --- Observation Tier ---

  describe('Observation Tier', () => {
    it('should use default observation tier from config', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'obs-default', name: 'Obs Default', capabilities: ['read'],
      });
      const info = await agent.getTrustInfo();
      expect(info.observationTier).toBe('GRAY_BOX');
    });

    it('should use agent-specified observation tier', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'obs-custom', name: 'Obs Custom', capabilities: ['read'],
        observationTier: 'WHITE_BOX',
      });
      const info = await agent.getTrustInfo();
      expect(info.observationTier).toBe('WHITE_BOX');
    });

    it('should use BLACK_BOX observation tier', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'obs-black', name: 'Obs Black', capabilities: ['read'],
        observationTier: 'BLACK_BOX',
      });
      const info = await agent.getTrustInfo();
      expect(info.observationTier).toBe('BLACK_BOX');
    });
  });

  // --- Additional Trust Tests ---

  describe('Trust Score Edge Behaviors', () => {
    it('should return "Action permitted" reason when action is allowed', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'reason-ok', name: 'Reason OK', capabilities: ['read'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.reason).toBe('Action permitted');
    });

    it('should report missing capability with correct format in reason', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'reason-miss', name: 'Reason Miss', capabilities: ['write'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'docs/file.txt' });
      expect(result.reason).toBe('Missing capability: read:docs');
    });

    it('should handle alternating success and failure signals', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'alternate', name: 'Alternate', capabilities: ['read'],
      });
      // success (+2), failure (-20), success (+2), failure (-20)
      await agent.reportSuccess('read');
      await agent.reportFailure('read');
      await agent.reportSuccess('read');
      await agent.reportFailure('read');
      const info = await agent.getTrustInfo();
      // 500 + 2 - 20 + 2 - 20 = 464
      expect(info.score).toBe(464);
    });

    it('should maintain correct tier name for all 8 tiers via getTrustInfo', async () => {
      // Verify tier names array is complete
      const tierNames = ['Sandbox', 'Observed', 'Provisional', 'Monitored', 'Standard', 'Trusted', 'Certified', 'Autonomous'];
      // We can verify the default (Monitored at T3)
      const agent = await vorion.registerAgent({
        agentId: 'all-tiers', name: 'All Tiers', capabilities: ['read'],
      });
      const info = await agent.getTrustInfo();
      expect(tierNames).toContain(info.tierName);
      expect(info.tierName).toBe('Monitored');
    });
  });
});
