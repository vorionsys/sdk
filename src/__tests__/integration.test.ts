// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

/**
 * Full lifecycle integration tests (~40 tests)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Vorion, Agent, createVorion } from '../index.js';

describe('Integration Tests', () => {
  // --- Local Mode Full Lifecycle ---

  describe('Local Mode Lifecycle', () => {
    let vorion: Vorion;

    beforeEach(() => {
      vorion = createVorion({ localMode: true });
    });

    it('should complete full lifecycle: register → trust → action → success → trust check', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'lifecycle', name: 'Lifecycle Agent', capabilities: ['read', 'write'],
      });

      // Check initial trust
      const trust1 = await agent.getTrustInfo();
      expect(trust1.score).toBe(500);
      expect(trust1.tierName).toBe('Monitored');

      // Request action
      const result = await agent.requestAction({ type: 'read', resource: 'docs/report.pdf' });
      expect(result.allowed).toBe(true);

      // Report success
      await agent.reportSuccess('read');

      // Check trust increased
      const trust2 = await agent.getTrustInfo();
      expect(trust2.score).toBeGreaterThan(trust1.score);
    });

    it('should handle register → action denied → failure → trust decreased', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'denied-lifecycle', name: 'Denied', capabilities: ['read'],
      });

      // Try disallowed action
      const result = await agent.requestAction({ type: 'delete', resource: 'critical/data.db' });
      expect(result.allowed).toBe(false);

      // Report failure
      await agent.reportFailure('delete', 'unauthorized');

      // Trust should have decreased
      const trust = await agent.getTrustInfo();
      expect(trust.score).toBeLessThan(500);
    });

    it('should handle multiple agents with different capabilities', async () => {
      const reader = await vorion.registerAgent({
        agentId: 'reader', name: 'Reader', capabilities: ['read'],
      });
      const writer = await vorion.registerAgent({
        agentId: 'writer', name: 'Writer', capabilities: ['write'],
      });
      const admin = await vorion.registerAgent({
        agentId: 'admin', name: 'Admin', capabilities: ['*'],
      });

      // Reader can read but not write
      expect((await reader.requestAction({ type: 'read', resource: 'file.txt' })).allowed).toBe(true);
      expect((await reader.requestAction({ type: 'write', resource: 'file.txt' })).allowed).toBe(false);

      // Writer can write but not read
      expect((await writer.requestAction({ type: 'write', resource: 'file.txt' })).allowed).toBe(true);
      expect((await writer.requestAction({ type: 'read', resource: 'file.txt' })).allowed).toBe(false);

      // Admin can do everything
      expect((await admin.requestAction({ type: 'read', resource: 'file.txt' })).allowed).toBe(true);
      expect((await admin.requestAction({ type: 'write', resource: 'file.txt' })).allowed).toBe(true);
      expect((await admin.requestAction({ type: 'delete', resource: 'file.txt' })).allowed).toBe(true);
    });

    it('should track trust increase after repeated successes', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'grower', name: 'Grower', capabilities: ['read'],
      });

      const initialTrust = (await agent.getTrustInfo()).score;

      for (let i = 0; i < 5; i++) {
        await agent.reportSuccess('read');
      }

      const finalTrust = (await agent.getTrustInfo()).score;
      expect(finalTrust).toBe(initialTrust + 10); // 5 * 2
    });

    it('should track trust decrease after repeated failures', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'faller', name: 'Faller', capabilities: ['read'],
      });

      const initialTrust = (await agent.getTrustInfo()).score;

      for (let i = 0; i < 3; i++) {
        await agent.reportFailure('read');
      }

      const finalTrust = (await agent.getTrustInfo()).score;
      expect(finalTrust).toBe(initialTrust - 60); // 3 * 20
    });

    it('should change tier after enough failures', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-change', name: 'Tier Change', capabilities: ['read'],
      });

      // Start at T3 (500)
      expect((await agent.getTrustInfo()).tierNumber).toBe(3);

      // 3 failures: 500 - 60 = 440 => T2
      for (let i = 0; i < 3; i++) {
        await agent.reportFailure('read');
      }
      expect((await agent.getTrustInfo()).tierNumber).toBe(2);
    });

    it('should change tier after enough successes', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-up', name: 'Tier Up', capabilities: ['read'],
      });

      // Start at T3 (500). Need 650 for T4. So 75 successes = +150 => 650
      for (let i = 0; i < 75; i++) {
        await agent.reportSuccess('read');
      }
      expect((await agent.getTrustInfo()).tierNumber).toBe(4);
      expect((await agent.getTrustInfo()).tierName).toBe('Standard');
    });

    it('should grow action history with each request', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'history', name: 'History', capabilities: ['read', 'write'],
      });

      expect(agent.getActionHistory()).toHaveLength(0);

      await agent.requestAction({ type: 'read', resource: 'a.txt' });
      expect(agent.getActionHistory()).toHaveLength(1);

      await agent.requestAction({ type: 'write', resource: 'b.txt' });
      expect(agent.getActionHistory()).toHaveLength(2);

      await agent.requestAction({ type: 'delete', resource: 'c.txt' }); // denied
      expect(agent.getActionHistory()).toHaveLength(3);
    });

    it('should include denied actions in history', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'deny-hist', name: 'Deny Hist', capabilities: ['read'],
      });

      await agent.requestAction({ type: 'delete', resource: 'file.txt' });
      const history = agent.getActionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].allowed).toBe(false);
      expect(history[0].action).toBe('delete');
    });

    it('should produce unique proof IDs across all requests', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'proofs', name: 'Proofs', capabilities: ['read', 'write'],
      });

      const proofIds = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const result = await agent.requestAction({ type: 'read', resource: `file${i}.txt` });
        proofIds.add(result.proofId);
      }
      expect(proofIds.size).toBe(20);
    });

    it('should register same agent ID twice (overwrites)', async () => {
      const agent1 = await vorion.registerAgent({
        agentId: 'same', name: 'First', capabilities: ['read'],
      });
      const agent2 = await vorion.registerAgent({
        agentId: 'same', name: 'Second', capabilities: ['write'],
      });

      expect(vorion.getAgent('same')).toBe(agent2);
      expect(agent2.getName()).toBe('Second');
      expect(agent2.getCapabilities()).toEqual(['write']);
    });

    it('should get agent by ID after registration', async () => {
      await vorion.registerAgent({ agentId: 'findme', name: 'Find Me', capabilities: ['read'] });
      const found = vorion.getAgent('findme');
      expect(found).toBeDefined();
      expect(found?.getId()).toBe('findme');
      expect(found?.getName()).toBe('Find Me');
    });

    it('should maintain independent trust per agent', async () => {
      const a1 = await vorion.registerAgent({
        agentId: 'indep-1', name: 'Indep 1', capabilities: ['read'],
      });
      const a2 = await vorion.registerAgent({
        agentId: 'indep-2', name: 'Indep 2', capabilities: ['read'],
      });

      await a1.reportSuccess('read');
      await a1.reportSuccess('read');
      await a2.reportFailure('read');

      expect((await a1.getTrustInfo()).score).toBe(504);
      expect((await a2.getTrustInfo()).score).toBe(480);
    });

    it('should maintain independent action history per agent', async () => {
      const a1 = await vorion.registerAgent({
        agentId: 'hist-1', name: 'Hist 1', capabilities: ['read'],
      });
      const a2 = await vorion.registerAgent({
        agentId: 'hist-2', name: 'Hist 2', capabilities: ['write'],
      });

      await a1.requestAction({ type: 'read', resource: 'f1.txt' });
      await a1.requestAction({ type: 'read', resource: 'f2.txt' });
      await a2.requestAction({ type: 'write', resource: 'f3.txt' });

      expect(a1.getActionHistory()).toHaveLength(2);
      expect(a2.getActionHistory()).toHaveLength(1);
    });

    it('should work without any server in local mode', async () => {
      // No fetch calls should be made
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const localVorion = createVorion({ localMode: true });

      const agent = await localVorion.registerAgent({
        agentId: 'no-server', name: 'No Server', capabilities: ['read'],
      });
      await agent.requestAction({ type: 'read', resource: 'file.txt' });
      await agent.reportSuccess('read');
      await agent.reportFailure('read');
      await agent.getTrustInfo();
      await localVorion.healthCheck();

      expect(fetchSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('should handle agent with all capabilities performing varied actions', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'all-caps', name: 'All Caps', capabilities: ['*'],
      });

      const actions = ['read', 'write', 'delete', 'execute', 'admin', 'deploy'];
      for (const action of actions) {
        const result = await agent.requestAction({ type: action, resource: 'resource' });
        expect(result.allowed).toBe(true);
      }
      expect(agent.getActionHistory()).toHaveLength(6);
    });

    it('should recover trust after failures with enough successes', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'recover', name: 'Recover', capabilities: ['read'],
      });

      // Drop trust: 2 failures = -40 => 460
      await agent.reportFailure('read');
      await agent.reportFailure('read');
      expect((await agent.getTrustInfo()).score).toBe(460);

      // Recover: 20 successes = +40 => 500
      for (let i = 0; i < 20; i++) {
        await agent.reportSuccess('read');
      }
      expect((await agent.getTrustInfo()).score).toBe(500);
    });

    it('should handle action with parameters', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'params', name: 'Params', capabilities: ['read'],
      });
      const result = await agent.requestAction({
        type: 'read',
        resource: 'docs/report.pdf',
        parameters: { format: 'pdf', page: 1, includeMetadata: true },
      });
      expect(result.allowed).toBe(true);
      expect(result.proofId).toBeDefined();
    });
  });

  // --- Remote Mode Integration ---

  describe('Remote Mode Integration', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function mockAdmit() {
      fetchSpy.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          admitted: true, initialTier: 3, initialScore: 500,
          observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
        }),
      } as Response);
    }

    function mockIntent(allowed: boolean) {
      fetchSpy.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          intentId: `i-${Math.random().toString(36).slice(2)}`,
          allowed,
          tier: allowed ? 'GREEN' : 'RED',
          reason: allowed ? 'Allowed' : 'Denied',
          proofId: `p-${Math.random().toString(36).slice(2)}`,
          constraints: allowed ? ['rate_limit:100/min'] : undefined,
          processingTimeMs: 5,
        }),
      } as Response);
    }

    function mockSignal(scoreBefore: number, scoreAfter: number) {
      fetchSpy.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          accepted: true, scoreBefore, scoreAfter,
          change: scoreAfter - scoreBefore,
          newTier: 3, newTierName: 'Monitored',
        }),
      } as Response);
    }

    function mockTrust(score: number, tier: number, tierName: string) {
      fetchSpy.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          agentId: 'remote-agent', score, tier, tierName,
        }),
      } as Response);
    }

    it('should call admitAgent API on registerAgent', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      await vorion.registerAgent({ agentId: 'remote-1', name: 'Remote 1', capabilities: ['read'] });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/trust/admit',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should call submitIntent API on requestAction', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({ agentId: 'remote-2', name: 'Remote 2', capabilities: ['read'] });

      mockIntent(true);
      await agent.requestAction({ type: 'read', resource: 'file.txt' });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should call recordSignal API on reportSuccess', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({ agentId: 'remote-3', name: 'Remote 3', capabilities: ['read'] });

      mockSignal(500, 510);
      await agent.reportSuccess('read');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.example.com/api/v1/trust/remote-3/signal',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should call recordSignal API on reportFailure', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({ agentId: 'remote-4', name: 'Remote 4' });

      mockSignal(500, 450);
      await agent.reportFailure('write', 'error occurred');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should call getTrustInfo API', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({ agentId: 'remote-5', name: 'Remote 5' });

      mockTrust(750, 4, 'Standard');
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(750);
      expect(info.tierName).toBe('Standard');
      expect(info.tierNumber).toBe(4);
    });

    it('should complete full remote lifecycle', async () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });

      // Register
      mockAdmit();
      const agent = await vorion.registerAgent({
        agentId: 'full-remote', name: 'Full Remote', capabilities: ['read'],
      });

      // Check trust
      mockTrust(500, 3, 'Monitored');
      const trust1 = await agent.getTrustInfo();
      expect(trust1.score).toBe(500);

      // Request action
      mockIntent(true);
      const result = await agent.requestAction({ type: 'read', resource: 'doc.txt' });
      expect(result.allowed).toBe(true);

      // Report success
      mockSignal(500, 510);
      await agent.reportSuccess('read');

      // Check trust again
      mockTrust(510, 3, 'Monitored');
      const trust2 = await agent.getTrustInfo();
      expect(trust2.score).toBe(510);

      expect(fetchSpy).toHaveBeenCalledTimes(5);
    });

    it('should propagate remote action denied result', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({
        agentId: 'denied-remote', name: 'Denied Remote', capabilities: ['read'],
      });

      mockIntent(false);
      const result = await agent.requestAction({ type: 'read', resource: 'secret.txt' });
      expect(result.allowed).toBe(false);
      expect(result.tier).toBe('RED');
    });

    it('should include processingTimeMs from remote response', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({
        agentId: 'timing', name: 'Timing', capabilities: ['read'],
      });

      mockIntent(true);
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.processingTimeMs).toBeDefined();
      expect(typeof result.processingTimeMs).toBe('number');
    });

    it('should track action history even in remote mode', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({
        agentId: 'remote-hist', name: 'Remote Hist', capabilities: ['read'],
      });

      mockIntent(true);
      await agent.requestAction({ type: 'read', resource: 'a.txt' });
      mockIntent(false);
      await agent.requestAction({ type: 'read', resource: 'b.txt' });

      const history = agent.getActionHistory();
      expect(history).toHaveLength(2);
      expect(history[0].allowed).toBe(true);
      expect(history[1].allowed).toBe(false);
    });

    it('should send default observation tier to API when not specified', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
        defaultObservationTier: 'BLACK_BOX',
      });
      await vorion.registerAgent({ agentId: 'obs-test', name: 'Obs Test' });

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.observationTier).toBe('BLACK_BOX');
    });

    it('should send agent-specified observation tier to API', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      await vorion.registerAgent({
        agentId: 'obs-agent', name: 'Obs Agent', observationTier: 'WHITE_BOX',
      });

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.observationTier).toBe('WHITE_BOX');
    });

    it('should propagate API errors during registerAgent', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 503,
        json: () => Promise.resolve({ error: 'Service Unavailable' }),
      } as Response);

      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      await expect(
        vorion.registerAgent({ agentId: 'err', name: 'Err' })
      ).rejects.toThrow('API error 503');
    });

    it('should propagate API errors during requestAction', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({
        agentId: 'act-err', name: 'Act Err', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 500,
        json: () => Promise.resolve({ error: 'Internal Error' }),
      } as Response);

      await expect(
        agent.requestAction({ type: 'read', resource: 'file.txt' })
      ).rejects.toThrow('API error 500');
    });

    it('should propagate API errors during reportSuccess', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({
        agentId: 'suc-err', name: 'Suc Err', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 500,
        json: () => Promise.resolve({ error: 'Signal processing failed' }),
      } as Response);

      await expect(agent.reportSuccess('read')).rejects.toThrow('API error 500');
    });

    it('should propagate API errors during reportFailure', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({
        agentId: 'fail-err', name: 'Fail Err', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 502,
        json: () => Promise.resolve({ error: 'Bad Gateway' }),
      } as Response);

      await expect(agent.reportFailure('read')).rejects.toThrow('API error 502');
    });

    it('should propagate API errors during getTrustInfo', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const agent = await vorion.registerAgent({
        agentId: 'trust-err', name: 'Trust Err',
      });

      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 404,
        json: () => Promise.resolve({ error: 'Agent not found' }),
      } as Response);

      await expect(agent.getTrustInfo()).rejects.toThrow('API error 404');
    });

    it('should send empty capabilities array when none specified', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      await vorion.registerAgent({ agentId: 'no-caps', name: 'No Caps' });

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.capabilities).toEqual([]);
    });

    it('should send default GRAY_BOX observation tier when none specified', async () => {
      mockAdmit();
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      await vorion.registerAgent({ agentId: 'default-obs', name: 'Default Obs' });

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.observationTier).toBe('GRAY_BOX');
    });
  });
});
