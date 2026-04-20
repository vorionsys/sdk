// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

/**
 * Vorion config, mode selection, and factory tests (~25 tests)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Vorion, createVorion } from '../index.js';

describe('Vorion Config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Default Config ---

  describe('Default Config', () => {
    it('should default to local mode when no config is provided', () => {
      const vorion = new Vorion();
      expect(vorion.isLocalMode()).toBe(true);
    });

    it('should default to local mode with empty config', () => {
      const vorion = new Vorion({});
      expect(vorion.isLocalMode()).toBe(true);
    });

    it('should default to GRAY_BOX observation tier', () => {
      const vorion = new Vorion();
      const config = vorion.getConfig();
      expect(config.defaultObservationTier).toBe('GRAY_BOX');
    });

    it('should default timeout to 30000ms', () => {
      const vorion = new Vorion();
      const config = vorion.getConfig();
      expect(config.timeout).toBe(30000);
    });

    it('should have no API client in local mode', () => {
      const vorion = new Vorion();
      expect(vorion.getApiClient()).toBeNull();
    });
  });

  // --- Remote Mode ---

  describe('Remote Mode', () => {
    it('should enable remote mode with apiEndpoint and apiKey', () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key-123',
      });
      expect(vorion.isLocalMode()).toBe(false);
    });

    it('should have API client in remote mode', () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key-123',
      });
      expect(vorion.getApiClient()).not.toBeNull();
    });

    it('should throw when apiEndpoint is set without apiKey', () => {
      expect(() => {
        new Vorion({ apiEndpoint: 'https://api.example.com' });
      }).toThrow('apiKey is required for remote mode');
    });

    it('should accept custom timeout', () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
        timeout: 5000,
      });
      const config = vorion.getConfig();
      expect(config.timeout).toBe(5000);
    });

    it('should accept custom observation tier', () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
        defaultObservationTier: 'WHITE_BOX',
      });
      const config = vorion.getConfig();
      expect(config.defaultObservationTier).toBe('WHITE_BOX');
    });
  });

  // --- localMode Override ---

  describe('localMode Override', () => {
    it('should force local mode when localMode: true even with apiEndpoint', () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
        localMode: true,
      });
      expect(vorion.isLocalMode()).toBe(true);
      expect(vorion.getApiClient()).toBeNull();
    });

    it('should not create API client when localMode: true', () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
        localMode: true,
      });
      expect(vorion.getApiClient()).toBeNull();
    });
  });

  // --- createVorion Factory ---

  describe('createVorion Factory', () => {
    it('should create a Vorion instance', () => {
      const vorion = createVorion();
      expect(vorion).toBeInstanceOf(Vorion);
    });

    it('should create local mode instance by default', () => {
      const vorion = createVorion();
      expect(vorion.isLocalMode()).toBe(true);
    });

    it('should create instance with custom config', () => {
      const vorion = createVorion({
        defaultObservationTier: 'BLACK_BOX',
        timeout: 10000,
      });
      const config = vorion.getConfig();
      expect(config.defaultObservationTier).toBe('BLACK_BOX');
      expect(config.timeout).toBe(10000);
    });

    it('should create remote mode instance', () => {
      const vorion = createVorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'factory-key',
      });
      expect(vorion.isLocalMode()).toBe(false);
    });
  });

  // --- Agent Management ---

  describe('Agent Management', () => {
    it('should start with no agents', () => {
      const vorion = new Vorion({ localMode: true });
      expect(vorion.getAllAgents()).toEqual([]);
    });

    it('should return undefined for non-existent agent', () => {
      const vorion = new Vorion({ localMode: true });
      expect(vorion.getAgent('nonexistent')).toBeUndefined();
    });

    it('should store registered agents', async () => {
      const vorion = new Vorion({ localMode: true });
      await vorion.registerAgent({ agentId: 'a1', name: 'A1' });
      expect(vorion.getAllAgents()).toHaveLength(1);
    });

    it('should retrieve agent by ID', async () => {
      const vorion = new Vorion({ localMode: true });
      const agent = await vorion.registerAgent({ agentId: 'a2', name: 'A2' });
      expect(vorion.getAgent('a2')).toBe(agent);
    });

    it('should support multiple agents', async () => {
      const vorion = new Vorion({ localMode: true });
      await vorion.registerAgent({ agentId: 'a1', name: 'A1' });
      await vorion.registerAgent({ agentId: 'a2', name: 'A2' });
      await vorion.registerAgent({ agentId: 'a3', name: 'A3' });
      expect(vorion.getAllAgents()).toHaveLength(3);
    });

    it('should overwrite agent if same ID is registered again', async () => {
      const vorion = new Vorion({ localMode: true });
      const agent1 = await vorion.registerAgent({ agentId: 'dup', name: 'First' });
      const agent2 = await vorion.registerAgent({ agentId: 'dup', name: 'Second' });
      expect(vorion.getAgent('dup')).toBe(agent2);
      expect(vorion.getAgent('dup')).not.toBe(agent1);
      expect(vorion.getAllAgents()).toHaveLength(1);
    });
  });

  // --- Multiple Instances ---

  describe('Multiple Instances', () => {
    it('should not share state between instances', async () => {
      const v1 = new Vorion({ localMode: true });
      const v2 = new Vorion({ localMode: true });

      await v1.registerAgent({ agentId: 'only-v1', name: 'Only V1' });

      expect(v1.getAllAgents()).toHaveLength(1);
      expect(v2.getAllAgents()).toHaveLength(0);
      expect(v2.getAgent('only-v1')).toBeUndefined();
    });

    it('should maintain independent configs', () => {
      const v1 = new Vorion({ localMode: true, timeout: 1000 });
      const v2 = new Vorion({ localMode: true, timeout: 5000 });

      expect(v1.getConfig().timeout).toBe(1000);
      expect(v2.getConfig().timeout).toBe(5000);
    });
  });

  // --- Health Check ---

  describe('Health Check', () => {
    it('should return local health in local mode', async () => {
      const vorion = new Vorion({ localMode: true });
      const health = await vorion.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('local');
    });

    it('should call API health endpoint in remote mode', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', version: '2.0.0' }),
      } as Response);

      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      const health = await vorion.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('2.0.0');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/health',
        expect.anything()
      );
    });
  });

  // --- Config Returns Copy ---

  describe('Config Immutability', () => {
    it('should return a copy of config (not the original)', () => {
      const vorion = new Vorion({ localMode: true, timeout: 5000 });
      const config1 = vorion.getConfig();
      const config2 = vorion.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should not allow external mutation of config', () => {
      const vorion = new Vorion({ localMode: true, timeout: 5000 });
      const config = vorion.getConfig();
      config.timeout = 99999;
      expect(vorion.getConfig().timeout).toBe(5000);
    });
  });
});
