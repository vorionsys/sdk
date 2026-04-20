// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

/**
 * Edge cases and property-based tests (~10 tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Vorion } from '../index.js';

describe('Edge Cases', () => {
  let vorion: Vorion;

  beforeEach(() => {
    vorion = new Vorion({ localMode: true });
  });

  it('should handle tier boundary crossing: 199→200 via reportSuccess', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'boundary-cross', name: 'Boundary Cross', capabilities: ['read'],
    });

    // Drop to ~200: 500 - 15*20 = 200, then -1 more failure => 180
    // Actually let's get to exactly 200 and confirm T1, then reportSuccess to 202 (T1 still)
    for (let i = 0; i < 15; i++) {
      await agent.reportFailure('read');
    }
    let info = await agent.getTrustInfo();
    expect(info.score).toBe(200);
    expect(info.tierNumber).toBe(1); // T1

    // One more failure => 180 => T0
    await agent.reportFailure('read');
    info = await agent.getTrustInfo();
    expect(info.score).toBe(180);
    expect(info.tierNumber).toBe(0); // T0

    // 10 successes => 180 + 20 = 200 => T1 again
    for (let i = 0; i < 10; i++) {
      await agent.reportSuccess('read');
    }
    info = await agent.getTrustInfo();
    expect(info.score).toBe(200);
    expect(info.tierNumber).toBe(1); // Crossed back to T1
  });

  it('should handle very long agent ID', async () => {
    const longId = 'a'.repeat(1000);
    const agent = await vorion.registerAgent({
      agentId: longId, name: 'Long ID', capabilities: ['read'],
    });
    expect(agent.getId()).toBe(longId);
    expect(vorion.getAgent(longId)).toBe(agent);
  });

  it('should handle Unicode in agent name', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'unicode', name: 'AI助手 🤖 Ágent™ ñ 日本語',
      capabilities: ['read'],
    });
    expect(agent.getName()).toBe('AI助手 🤖 Ágent™ ñ 日本語');
  });

  it('should handle empty capabilities array correctly', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'empty-caps', name: 'Empty Caps', capabilities: [],
    });
    const caps = agent.getCapabilities();
    expect(caps).toEqual([]);

    const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
    expect(result.allowed).toBe(false);
  });

  it('should handle resource with no slash in requestAction', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'no-slash', name: 'No Slash', capabilities: ['read:filename.txt'],
    });
    // resource.split('/')[0] = 'filename.txt'
    const result = await agent.requestAction({ type: 'read', resource: 'filename.txt' });
    expect(result.allowed).toBe(true);
  });

  it('should handle rapid sequential requests without state corruption', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'rapid', name: 'Rapid', capabilities: ['read'],
    });

    // Fire 50 requests sequentially
    const results = [];
    for (let i = 0; i < 50; i++) {
      results.push(await agent.requestAction({ type: 'read', resource: `file${i}.txt` }));
    }

    expect(results).toHaveLength(50);
    expect(results.every(r => r.allowed === true)).toBe(true);
    expect(agent.getActionHistory()).toHaveLength(50);

    // Trust should have incremented by 1 per allowed action = +50
    const info = await agent.getTrustInfo();
    expect(info.score).toBe(550);
  });

  it('should handle agent with max trust (1000) correctly', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'max-trust', name: 'Max Trust', capabilities: ['read'],
    });

    // Raise to 1000
    for (let i = 0; i < 260; i++) {
      await agent.reportSuccess('read');
    }
    const info = await agent.getTrustInfo();
    expect(info.score).toBe(1000);
    expect(info.tierNumber).toBe(7);
    expect(info.tierName).toBe('Autonomous');

    // Additional success should not exceed 1000
    await agent.reportSuccess('read');
    expect((await agent.getTrustInfo()).score).toBe(1000);

    // Action should still be allowed and score stays at 1000
    const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
    expect(result.allowed).toBe(true);
    expect((await agent.getTrustInfo()).score).toBe(1000);
  });

  it('should handle agent with zero trust (0) correctly', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'zero-trust', name: 'Zero Trust', capabilities: ['read'],
    });

    // Drop to 0
    for (let i = 0; i < 30; i++) {
      await agent.reportFailure('read');
    }
    const info = await agent.getTrustInfo();
    expect(info.score).toBe(0);
    expect(info.tierNumber).toBe(0);
    expect(info.tierName).toBe('Sandbox');

    // Additional failure should not go below 0
    await agent.reportFailure('read');
    expect((await agent.getTrustInfo()).score).toBe(0);

    // Actions should be denied (trust < 200)
    const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Trust score too low');
  });

  it('should return a copy of action history (not the original array)', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'hist-copy', name: 'Hist Copy', capabilities: ['read'],
    });

    await agent.requestAction({ type: 'read', resource: 'file.txt' });
    const history1 = agent.getActionHistory();
    const history2 = agent.getActionHistory();

    expect(history1).not.toBe(history2);
    expect(history1).toEqual(history2);

    // Mutating the returned array should not affect the internal state
    history1.push({ action: 'fake', allowed: true, timestamp: 0 });
    expect(agent.getActionHistory()).toHaveLength(1);
  });

  it('should return a copy of capabilities (not the original array)', async () => {
    const agent = await vorion.registerAgent({
      agentId: 'caps-copy', name: 'Caps Copy', capabilities: ['read', 'write'],
    });

    const caps1 = agent.getCapabilities();
    const caps2 = agent.getCapabilities();

    expect(caps1).not.toBe(caps2);
    expect(caps1).toEqual(caps2);

    // Mutating returned array should not affect internal state
    caps1.push('delete');
    expect(agent.getCapabilities()).toEqual(['read', 'write']);
  });
});
