// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

/**
 * ApiClient HTTP layer tests (~40 tests)
 * Tests the internal ApiClient class via the Vorion SDK remote mode.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Vorion } from '../index.js';

type ResponseType = 'basic' | 'cors' | 'default' | 'error' | 'opaque' | 'opaqueredirect';

// Helper to create a mock Response
function mockResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(status, body, ok),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob([])),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

describe('ApiClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRemoteVorion(opts?: { timeout?: number }) {
    const config: Record<string, unknown> = {
      apiEndpoint: 'https://api.example.com',
      apiKey: 'test-api-key-123',
      localMode: false,
    };
    if (opts?.timeout !== undefined) {
      config.timeout = opts.timeout;
    }
    return new Vorion(config as import('../index.js').VorionConfig);
  }

  // --- Request Method Tests ---

  describe('HTTP Methods', () => {
    it('should send GET request for health check', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { status: 'healthy', version: '1.0.0' }));
      const vorion = createRemoteVorion();
      await vorion.healthCheck();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/health',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should send POST request for submitIntent', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'test', name: 'Test', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-1', allowed: true, tier: 'GREEN',
        reason: 'Allowed', proofId: 'p-1', processingTimeMs: 5,
      }));
      await agent.requestAction({ type: 'read', resource: 'file.txt' });

      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.example.com/api/v1/intents',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should send GET request for getTrustInfo', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'agent-x', name: 'Agent X', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        agentId: 'agent-x', score: 500, tier: 3, tierName: 'Monitored',
      }));
      await agent.getTrustInfo();

      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.example.com/api/v1/trust/agent-x',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should send POST request for recordSignal (reportSuccess)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'sig-agent', name: 'Sig Agent', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        accepted: true, scoreBefore: 500, scoreAfter: 510,
        change: 10, newTier: 3, newTierName: 'Monitored',
      }));
      await agent.reportSuccess('read');

      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.example.com/api/v1/trust/sig-agent/signal',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should send POST request for recordSignal (reportFailure)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: [], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'fail-agent', name: 'Fail Agent',
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        accepted: true, scoreBefore: 500, scoreAfter: 450,
        change: -50, newTier: 2, newTierName: 'Provisional',
      }));
      await agent.reportFailure('write', 'timeout');

      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.example.com/api/v1/trust/fail-agent/signal',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  // --- Header Tests ---

  describe('Headers', () => {
    it('should include Content-Type: application/json', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { status: 'healthy', version: '1.0' }));
      const vorion = createRemoteVorion();
      await vorion.healthCheck();

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(callArgs.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
      }));
    });

    it('should include Authorization Bearer token from apiKey', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { status: 'healthy', version: '1.0' }));
      const vorion = createRemoteVorion();
      await vorion.healthCheck();

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(callArgs.headers).toEqual(expect.objectContaining({
        'Authorization': 'Bearer test-api-key-123',
      }));
    });

    it('should use the provided API key in all requests', async () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com',
        apiKey: 'my-custom-key-xyz',
        localMode: false,
      });
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { status: 'healthy', version: '1.0' }));
      await vorion.healthCheck();

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(callArgs.headers).toEqual(expect.objectContaining({
        'Authorization': 'Bearer my-custom-key-xyz',
      }));
    });
  });

  // --- URL Construction ---

  describe('URL Construction', () => {
    it('should strip trailing slash from base URL', async () => {
      const vorion = new Vorion({
        apiEndpoint: 'https://api.example.com/',
        apiKey: 'key',
        localMode: false,
      });
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { status: 'healthy', version: '1.0' }));
      await vorion.healthCheck();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/health',
        expect.anything()
      );
    });

    it('should construct correct URL for admitAgent', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: [], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      await vorion.registerAgent({ agentId: 'url-test', name: 'URL Test' });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/trust/admit',
        expect.anything()
      );
    });

    it('should construct correct URL for checkIntent', async () => {
      // We can test checkIntent indirectly — but since checkIntent isn't
      // called from the Agent class directly, we test the URL is correct
      // via submitIntent
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'check-url', name: 'Check URL', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-1', allowed: true, tier: 'GREEN',
        reason: 'ok', proofId: 'p-1', processingTimeMs: 1,
      }));
      await agent.requestAction({ type: 'read', resource: 'doc.txt' });

      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.example.com/api/v1/intents',
        expect.anything()
      );
    });

    it('should include agentId in trust info URL path', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: [], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'special-agent-007', name: 'Special',
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        agentId: 'special-agent-007', score: 500, tier: 3, tierName: 'Monitored',
      }));
      await agent.getTrustInfo();

      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.example.com/api/v1/trust/special-agent-007',
        expect.anything()
      );
    });
  });

  // --- Error Response Tests ---

  describe('Error Responses', () => {
    it('should throw on 400 Bad Request', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(400, { error: 'Bad Request' }, false));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('API error 400');
    });

    it('should throw on 401 Unauthorized', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(401, { error: 'Unauthorized' }, false));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('API error 401');
    });

    it('should throw on 403 Forbidden', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(403, { error: 'Forbidden' }, false));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('API error 403');
    });

    it('should throw on 404 Not Found', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(404, { error: 'Not Found' }, false));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('API error 404');
    });

    it('should throw on 500 Internal Server Error', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(500, { error: 'Internal Server Error' }, false));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('API error 500');
    });

    it('should include error message from response body', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(422, { error: 'Validation failed: agentId required' }, false));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('Validation failed: agentId required');
    });

    it('should include message field from response body', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(400, { message: 'Invalid payload' }, false));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('Invalid payload');
    });

    it('should handle non-JSON error responses gracefully', async () => {
      const badResp = {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('not json')),
        headers: new Headers(),
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        clone: () => badResp,
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob([])),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve('Bad Gateway'),
        bytes: () => Promise.resolve(new Uint8Array()),
      } as Response;
      fetchSpy.mockResolvedValueOnce(badResp);
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('API error 502');
    });
  });

  // --- Network Error Tests ---

  describe('Network Errors', () => {
    it('should propagate fetch TypeError (network error)', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('Failed to fetch');
    });

    it('should propagate DNS resolution errors', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.example.com'));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('ENOTFOUND');
    });

    it('should propagate connection refused errors', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
      const vorion = createRemoteVorion();
      await expect(vorion.healthCheck()).rejects.toThrow('ECONNREFUSED');
    });
  });

  // --- Timeout Tests ---

  describe('Timeout Handling', () => {
    it('should pass abort signal to fetch', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { status: 'healthy', version: '1.0' }));
      const vorion = createRemoteVorion();
      await vorion.healthCheck();

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(callArgs.signal).toBeDefined();
      expect(callArgs.signal).toBeInstanceOf(AbortSignal);
    });

    it('should use default timeout of 30000ms', () => {
      const vorion = createRemoteVorion();
      const config = vorion.getConfig();
      expect(config.timeout).toBe(30000);
    });

    it('should use custom timeout when provided', () => {
      const vorion = createRemoteVorion({ timeout: 5000 });
      const config = vorion.getConfig();
      expect(config.timeout).toBe(5000);
    });
  });

  // --- Request Body Tests ---

  describe('Request Body', () => {
    it('should not include body in GET requests', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { status: 'healthy', version: '1.0' }));
      const vorion = createRemoteVorion();
      await vorion.healthCheck();

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(callArgs.body).toBeUndefined();
    });

    it('should include JSON body in POST requests', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      await vorion.registerAgent({
        agentId: 'body-test', name: 'Body Test', capabilities: ['read'],
      });

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.agentId).toBe('body-test');
      expect(body.name).toBe('Body Test');
      expect(body.capabilities).toEqual(['read']);
    });

    it('should include action details in submitIntent body', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'action-body', name: 'Action Body', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-1', allowed: true, tier: 'GREEN',
        reason: 'ok', proofId: 'p-1', processingTimeMs: 2,
      }));
      await agent.requestAction({
        type: 'read', resource: 'documents/test.pdf',
        parameters: { format: 'pdf' },
      });

      const callArgs = fetchSpy.mock.calls[1][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.action.type).toBe('read');
      expect(body.action.resource).toBe('documents/test.pdf');
      expect(body.action.parameters).toEqual({ format: 'pdf' });
    });

    it('should include signal type and weight in recordSignal body', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: [], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'signal-body', name: 'Signal Body',
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        accepted: true, scoreBefore: 500, scoreAfter: 510,
        change: 10, newTier: 3, newTierName: 'Monitored',
      }));
      await agent.reportSuccess('read');

      const callArgs = fetchSpy.mock.calls[1][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.type).toBe('success');
      expect(body.source).toBe('sdk');
      expect(body.weight).toBe(0.1);
    });

    it('should include failure reason in context for reportFailure', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: [], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'fail-body', name: 'Fail Body',
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        accepted: true, scoreBefore: 500, scoreAfter: 450,
        change: -50, newTier: 2, newTierName: 'Provisional',
      }));
      await agent.reportFailure('write', 'disk full');

      const callArgs = fetchSpy.mock.calls[1][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.type).toBe('failure');
      expect(body.weight).toBe(0.5);
      expect(body.context.reason).toBe('disk full');
      expect(body.context.actionType).toBe('write');
    });
  });

  // --- Response Parsing Tests ---

  describe('Response Parsing', () => {
    it('should parse health check response correctly', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { status: 'healthy', version: '2.3.1' }));
      const vorion = createRemoteVorion();
      const health = await vorion.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('2.3.1');
    });

    it('should parse admitAgent response during registerAgent', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read', 'write'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'parse-test', name: 'Parse Test', capabilities: ['read', 'write'],
      });
      // Agent is registered and stored
      expect(vorion.getAgent('parse-test')).toBe(agent);
    });

    it('should parse submitIntent response into ActionResult', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'result-test', name: 'Result', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-42', allowed: true, tier: 'YELLOW',
        reason: 'Allowed with monitoring', proofId: 'proof-abc',
        constraints: ['rate_limit:50/min'], processingTimeMs: 12,
      }));
      const result = await agent.requestAction({ type: 'read', resource: 'file.txt' });
      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('YELLOW');
      expect(result.reason).toBe('Allowed with monitoring');
      expect(result.proofId).toBe('proof-abc');
      expect(result.constraints).toEqual(['rate_limit:50/min']);
      expect(result.processingTimeMs).toBe(12);
    });

    it('should parse getTrustInfo response into TrustInfo', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: [], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'trust-parse', name: 'Trust Parse', observationTier: 'WHITE_BOX',
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        agentId: 'trust-parse', score: 750, tier: 4, tierName: 'Standard',
      }));
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(750);
      expect(info.tierName).toBe('Standard');
      expect(info.tierNumber).toBe(4);
      expect(info.observationTier).toBe('WHITE_BOX');
    });

    it('should handle null score/tier in getTrustInfo', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 0, initialScore: 0,
        observationCeiling: 3, capabilities: [], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'null-trust', name: 'Null Trust',
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        agentId: 'null-trust', score: null, tier: null, tierName: null,
        message: 'Agent not found',
      }));
      const info = await agent.getTrustInfo();
      expect(info.score).toBe(0);
      expect(info.tierName).toBe('Unknown');
      expect(info.tierNumber).toBe(0);
    });
  });

  // --- Remote Mode Action History ---

  describe('Remote Mode Action History', () => {
    it('should track action history in remote mode', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'hist-remote', name: 'Hist Remote', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-1', allowed: true, tier: 'GREEN',
        reason: 'ok', proofId: 'p-1', processingTimeMs: 1,
      }));
      await agent.requestAction({ type: 'read', resource: 'a.txt' });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-2', allowed: false, tier: 'RED',
        reason: 'denied', proofId: 'p-2', processingTimeMs: 1,
      }));
      await agent.requestAction({ type: 'read', resource: 'b.txt' });

      const history = agent.getActionHistory();
      expect(history).toHaveLength(2);
      expect(history[0].allowed).toBe(true);
      expect(history[1].allowed).toBe(false);
    });
  });

  // --- Additional Coverage ---

  describe('Additional Coverage', () => {
    it('should send agent name in submitIntent payload', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'name-check', name: 'Name Check Agent', capabilities: ['read'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-1', allowed: true, tier: 'GREEN',
        reason: 'ok', proofId: 'p-1', processingTimeMs: 1,
      }));
      await agent.requestAction({ type: 'read', resource: 'file.txt' });

      const callArgs = fetchSpy.mock.calls[1][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.agentName).toBe('Name Check Agent');
    });

    it('should send observation tier in submitIntent payload', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'obs-submit', name: 'Obs Submit', capabilities: ['read'],
        observationTier: 'WHITE_BOX',
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-1', allowed: true, tier: 'GREEN',
        reason: 'ok', proofId: 'p-1', processingTimeMs: 1,
      }));
      await agent.requestAction({ type: 'read', resource: 'file.txt' });

      const callArgs = fetchSpy.mock.calls[1][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.observationTier).toBe('WHITE_BOX');
    });

    it('should send capabilities array in submitIntent payload', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        admitted: true, initialTier: 3, initialScore: 500,
        observationCeiling: 7, capabilities: ['read', 'write'], expiresAt: '2099-01-01',
      }));
      const vorion = createRemoteVorion();
      const agent = await vorion.registerAgent({
        agentId: 'caps-submit', name: 'Caps Submit', capabilities: ['read', 'write'],
      });

      fetchSpy.mockResolvedValueOnce(mockResponse(200, {
        intentId: 'i-1', allowed: true, tier: 'GREEN',
        reason: 'ok', proofId: 'p-1', processingTimeMs: 1,
      }));
      await agent.requestAction({ type: 'read', resource: 'file.txt' });

      const callArgs = fetchSpy.mock.calls[1][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.capabilities).toEqual(['read', 'write']);
    });
  });
});
