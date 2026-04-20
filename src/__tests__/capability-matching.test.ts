// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

/**
 * Capability and wildcard matching tests (~20 tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Vorion } from '../index.js';

describe('Capability Matching', () => {
  let vorion: Vorion;

  beforeEach(() => {
    vorion = new Vorion({ localMode: true });
  });

  // --- Exact Match ---

  describe('Exact Match', () => {
    it('should match exact simple capability (e.g., "read" matches action type "read")', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'exact-1', name: 'Exact 1', capabilities: ['read'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'documents/test.pdf' });
      expect(result.allowed).toBe(true);
    });

    it('should not match different capability name', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'exact-2', name: 'Exact 2', capabilities: ['read'],
      });
      const result = await agent.requestAction({ type: 'write', resource: 'documents/test.pdf' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Missing capability');
    });

    it('should match type:resource prefix capability', async () => {
      // cap "read:documents" should match action type "read" with resource "documents/test.pdf"
      // because the code checks: cap === `${action.type}:${action.resource.split('/')[0]}`
      const agent = await vorion.registerAgent({
        agentId: 'exact-3', name: 'Exact 3', capabilities: ['read:documents'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'documents/test.pdf' });
      expect(result.allowed).toBe(true);
    });

    it('should not match wrong resource prefix', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'exact-4', name: 'Exact 4', capabilities: ['read:images'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'documents/test.pdf' });
      expect(result.allowed).toBe(false);
    });
  });

  // --- Wildcard Match ---

  describe('Wildcard Match', () => {
    it('should match "read:*" against any resource with type "read"', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'wild-1', name: 'Wild 1', capabilities: ['read:*'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'anything/file.txt' });
      expect(result.allowed).toBe(true);
    });

    it('should not match "read:*" against type "write"', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'wild-2', name: 'Wild 2', capabilities: ['read:*'],
      });
      const result = await agent.requestAction({ type: 'write', resource: 'anything/file.txt' });
      expect(result.allowed).toBe(false);
    });

    it('should match full wildcard "*" against any action', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'wild-3', name: 'Wild 3', capabilities: ['*'],
      });
      const result = await agent.requestAction({ type: 'delete', resource: 'critical/data.db' });
      expect(result.allowed).toBe(true);
    });

    it('should match full wildcard "*" against another action type', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'wild-4', name: 'Wild 4', capabilities: ['*'],
      });
      const result = await agent.requestAction({ type: 'execute', resource: 'system/command' });
      expect(result.allowed).toBe(true);
    });

    it('should match "write:*" wildcard for write actions', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'wild-5', name: 'Wild 5', capabilities: ['write:*'],
      });
      const r1 = await agent.requestAction({ type: 'write', resource: 'docs/file.txt' });
      const r2 = await agent.requestAction({ type: 'write', resource: 'images/photo.jpg' });
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
    });
  });

  // --- Empty Capabilities ---

  describe('Empty Capabilities', () => {
    it('should deny all actions with empty capabilities array', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'empty-1', name: 'Empty 1', capabilities: [],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(false);
    });

    it('should deny all actions with undefined capabilities', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'empty-2', name: 'Empty 2',
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(false);
    });
  });

  // --- Multiple Capabilities ---

  describe('Multiple Capabilities', () => {
    it('should allow action if any capability matches', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'multi-1', name: 'Multi 1', capabilities: ['write', 'read'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(true);
    });

    it('should allow different action types with multiple capabilities', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'multi-2', name: 'Multi 2', capabilities: ['read', 'write', 'delete'],
      });
      const r1 = await agent.requestAction({ type: 'read', resource: 'a.txt' });
      const r2 = await agent.requestAction({ type: 'write', resource: 'b.txt' });
      const r3 = await agent.requestAction({ type: 'delete', resource: 'c.txt' });
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(true);
    });

    it('should deny action not covered by any capability', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'multi-3', name: 'Multi 3', capabilities: ['read', 'write'],
      });
      const result = await agent.requestAction({ type: 'execute', resource: 'command' });
      expect(result.allowed).toBe(false);
    });
  });

  // --- Resource Prefix Extraction ---

  describe('Resource Prefix Extraction', () => {
    it('should extract first path segment as resource prefix', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'prefix-1', name: 'Prefix 1', capabilities: ['read:docs'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'docs/sub/file.txt' });
      expect(result.allowed).toBe(true);
    });

    it('should use full resource as prefix when no slash present', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'prefix-2', name: 'Prefix 2', capabilities: ['read:file.txt'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(true);
    });

    it('should report missing capability with resource prefix in reason', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'prefix-3', name: 'Prefix 3', capabilities: ['write:docs'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'secret/data.txt' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('read:secret');
    });
  });

  // --- Case Sensitivity ---

  describe('Case Sensitivity', () => {
    it('should be case-sensitive for capability matching', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'case-1', name: 'Case 1', capabilities: ['Read'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      // 'Read' !== 'read', so should be denied
      expect(result.allowed).toBe(false);
    });

    it('should match when case is the same', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'case-2', name: 'Case 2', capabilities: ['READ'],
      });
      const result = await agent.requestAction({ type: 'READ', resource: 'file.txt' });
      expect(result.allowed).toBe(true);
    });
  });

  // --- Duplicate Capabilities ---

  describe('Duplicate Capabilities', () => {
    it('should handle duplicate capabilities without issue', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'dup-1', name: 'Dup 1', capabilities: ['read', 'read', 'read'],
      });
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(true);
    });

    it('should return capabilities including duplicates', async () => {
      const agent = await vorion.registerAgent({
        agentId: 'dup-2', name: 'Dup 2', capabilities: ['read', 'read'],
      });
      const caps = agent.getCapabilities();
      expect(caps).toEqual(['read', 'read']);
    });
  });
});
