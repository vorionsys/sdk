// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

/**
 * Vorion SDK Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Vorion, createVorion, Agent } from '../index.js';

describe('Vorion SDK', () => {
  let vorion: Vorion;

  beforeEach(() => {
    vorion = createVorion({ localMode: true });
  });

  describe('Vorion', () => {
    it('should create SDK instance', () => {
      expect(vorion).toBeInstanceOf(Vorion);
    });

    it('should register agents', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'test-agent',
        name: 'Test Agent',
        capabilities: ['read', 'write'],
      });

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getId()).toBe('test-agent');
      expect(agent.getName()).toBe('Test Agent');
    });

    it('should retrieve registered agents', async () => {
      await vorion.registerAgent({
        agentId: 'agent-1',
        name: 'Agent 1',
      });

      const retrieved = vorion.getAgent('agent-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.getId()).toBe('agent-1');
    });

    it('should list all agents', async () => {
      await vorion.registerAgent({ agentId: 'agent-1', name: 'Agent 1' });
      await vorion.registerAgent({ agentId: 'agent-2', name: 'Agent 2' });

      const agents = vorion.getAllAgents();
      expect(agents.length).toBe(2);
    });

    it('should return config', () => {
      const config = vorion.getConfig();
      expect(config.localMode).toBe(true);
      expect(config.defaultObservationTier).toBe('GRAY_BOX');
    });
  });

  describe('Agent', () => {
    let agent: Agent;

    beforeEach(async () => {
      agent = await vorion.registerAgent({
        agentId: 'test-agent',
        name: 'Test Agent',
        capabilities: ['read', 'write'],
        observationTier: 'GRAY_BOX',
      });
    });

    it('should request actions with capability', async () => {
      const result = await agent.requestAction({
        type: 'read',
        resource: 'documents/test.pdf',
      });

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('GREEN');
      expect(result.proofId).toBeDefined();
    });

    it('should deny actions without capability', async () => {
      const result = await agent.requestAction({
        type: 'delete', // Not in capabilities
        resource: 'documents/test.pdf',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Missing capability');
    });

    it('should track action history', async () => {
      await agent.requestAction({ type: 'read', resource: 'file1.txt' });
      await agent.requestAction({ type: 'write', resource: 'file2.txt' });

      const history = agent.getActionHistory();
      expect(history.length).toBe(2);
      expect(history[0].action).toBe('read');
      expect(history[1].action).toBe('write');
    });

    it('should provide trust info', async () => {
      const trustInfo = await agent.getTrustInfo();

      expect(trustInfo.score).toBe(500); // Default start
      expect(trustInfo.tierName).toBe('Monitored'); // T3
      expect(trustInfo.tierNumber).toBe(3);
      expect(trustInfo.observationTier).toBe('GRAY_BOX');
    });

    it('should increase trust on success', async () => {
      const initialTrustInfo = await agent.getTrustInfo();
      const initialScore = initialTrustInfo.score;

      await agent.reportSuccess('read');

      const newTrustInfo = await agent.getTrustInfo();
      expect(newTrustInfo.score).toBeGreaterThan(initialScore);
    });

    it('should decrease trust on failure (asymmetric)', async () => {
      const initialTrustInfo = await agent.getTrustInfo();
      const initialScore = initialTrustInfo.score;

      await agent.reportFailure('write', 'Permission denied');

      const newTrustInfo = await agent.getTrustInfo();
      expect(newTrustInfo.score).toBeLessThan(initialScore);
      // Asymmetric: failure should decrease more than success increases
      expect(initialScore - newTrustInfo.score).toBeGreaterThan(10);
    });

    it('should apply constraints based on tier', async () => {
      const result = await agent.requestAction({
        type: 'read',
        resource: 'documents/test.pdf',
      });

      expect(result.constraints).toBeDefined();
      expect(result.constraints?.some((c) => c.includes('rate_limit'))).toBe(true);
    });

    it('should return capabilities', () => {
      const caps = agent.getCapabilities();
      expect(caps).toContain('read');
      expect(caps).toContain('write');
    });
  });

  describe('Trust Tiers', () => {
    it('should correctly identify tier from score', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'tier-test',
        name: 'Tier Test',
        capabilities: ['read'],
      });

      // Default is 500 = T3 Monitored
      const initialTrustInfo = await agent.getTrustInfo();
      expect(initialTrustInfo.tierName).toBe('Monitored');

      // Decrease trust significantly
      for (let i = 0; i < 20; i++) {
        await agent.reportFailure('read');
      }

      // Should be at lower tier now
      const newTrustInfo = await agent.getTrustInfo();
      expect(newTrustInfo.tierNumber).toBeLessThan(3);
    });
  });

  describe('Remote mode configuration', () => {
    it('should require apiKey for remote mode', () => {
      expect(() => {
        new Vorion({
          apiEndpoint: 'http://localhost:3000',
          // No apiKey provided
        });
      }).toThrow('apiKey is required for remote mode');
    });

    it('should default to local mode without apiEndpoint', () => {
      const v = new Vorion({});
      expect(v.isLocalMode()).toBe(true);
    });

    it('should enable remote mode with apiEndpoint and apiKey', () => {
      const v = new Vorion({
        apiEndpoint: 'http://localhost:3000',
        apiKey: 'test-key',
      });
      expect(v.isLocalMode()).toBe(false);
    });

    it('should return local health check in local mode', async () => {
      const health = await vorion.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('local');
    });
  });
});
