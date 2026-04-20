// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-2026 Vorion LLC

/**
 * @vorionsys/sdk - Vorion SDK
 *
 * Simple, developer-friendly interface for AI agent governance.
 * Supports both local mode (in-memory) and remote mode (cognigate-api).
 *
 * @packageDocumentation
 */

import * as crypto from 'node:crypto';

// Re-export runtime types for convenience
export type {
  TrustTier,
  DecisionTier,
  AgentCredentials,
  Action,
  TrustSignal,
} from '@vorionsys/runtime';

/**
 * SDK Configuration
 */
export interface VorionConfig {
  /** API endpoint for hosted Cognigate */
  apiEndpoint?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Default observation tier for agents */
  defaultObservationTier?: 'BLACK_BOX' | 'GRAY_BOX' | 'WHITE_BOX';
  /** Enable local mode (no API calls). If false and apiEndpoint is provided, uses remote mode. */
  localMode?: boolean;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Agent registration options
 */
export interface AgentOptions {
  /** Unique agent identifier */
  agentId: string;
  /** Human-readable name */
  name: string;
  /** Agent capabilities/permissions */
  capabilities?: string[];
  /** Observation tier */
  observationTier?: 'BLACK_BOX' | 'GRAY_BOX' | 'WHITE_BOX';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of an action request
 */
export interface ActionResult {
  /** Whether the action was allowed */
  allowed: boolean;
  /** Decision tier (GREEN/YELLOW/RED) */
  tier: 'GREEN' | 'YELLOW' | 'RED';
  /** Human-readable reason */
  reason: string;
  /** Proof commitment ID for audit */
  proofId: string;
  /** Any constraints applied */
  constraints?: string[];
  /** Processing time in ms (remote mode only) */
  processingTimeMs?: number;
}

/**
 * Trust score information
 */
export interface TrustInfo {
  /** Current trust score (0-1000) */
  score: number;
  /** Trust tier name */
  tierName: string;
  /** Trust tier number (0-7) */
  tierNumber: number;
  /** Observation tier */
  observationTier: string;
}

/**
 * API Client for cognigate-api
 */
class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(baseUrl: string, apiKey: string, timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string; message?: string };
        throw new Error(`API error ${response.status}: ${errorData.error || errorData.message || 'Unknown'}`);
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Intent endpoints
  async submitIntent(payload: {
    agentId: string;
    agentName?: string;
    capabilities?: string[];
    observationTier?: string;
    action: { type: string; resource: string; parameters?: Record<string, unknown> };
  }) {
    return this.request<{
      intentId: string;
      allowed: boolean;
      tier: string;
      reason: string;
      proofId: string;
      constraints?: string[];
      processingTimeMs: number;
    }>('POST', '/api/v1/intents', payload);
  }

  async checkIntent(payload: {
    agentId: string;
    agentName?: string;
    capabilities?: string[];
    observationTier?: string;
    action: { type: string; resource: string };
  }) {
    return this.request<{
      wouldAllow: boolean;
      tier: string;
      reason: string;
    }>('POST', '/api/v1/intents/check', payload);
  }

  // Trust endpoints
  async admitAgent(payload: {
    agentId: string;
    name: string;
    capabilities: string[];
    observationTier: string;
  }) {
    return this.request<{
      admitted: boolean;
      initialTier: number;
      initialScore: number;
      observationCeiling: number;
      capabilities: string[];
      expiresAt: string;
      reason?: string;
    }>('POST', '/api/v1/trust/admit', payload);
  }

  async getTrustInfo(agentId: string) {
    return this.request<{
      agentId: string;
      score: number | null;
      tier: number | null;
      tierName: string | null;
      observationCeiling?: number;
      message?: string;
    }>('GET', `/api/v1/trust/${agentId}`);
  }

  async recordSignal(agentId: string, payload: {
    type: 'success' | 'failure' | 'violation' | 'neutral';
    source: string;
    weight?: number;
    context?: Record<string, unknown>;
  }) {
    return this.request<{
      accepted: boolean;
      scoreBefore: number;
      scoreAfter: number;
      change: number;
      newTier: number | null;
      newTierName: string | null;
    }>('POST', `/api/v1/trust/${agentId}/signal`, payload);
  }

  // Health check
  async health() {
    return this.request<{ status: string; version: string }>('GET', '/api/v1/health');
  }
}

/**
 * Vorion SDK Client
 *
 * Simple interface for agent governance.
 *
 * @example
 * ```typescript
 * // Local mode (in-memory, for testing)
 * const vorion = new Vorion({ localMode: true });
 *
 * // Remote mode (cognigate-api)
 * const vorion = new Vorion({
 *   apiEndpoint: 'http://localhost:3000',
 *   apiKey: 'vorion-dev-key-12345',
 * });
 *
 * const agent = vorion.registerAgent({
 *   agentId: 'my-agent',
 *   name: 'My AI Agent',
 *   capabilities: ['read:*', 'write:*'],
 * });
 *
 * const result = await agent.requestAction({
 *   type: 'read',
 *   resource: 'documents/report.pdf',
 * });
 *
 * if (result.allowed) {
 *   // Perform the action
 *   await agent.reportSuccess('read');
 * } else {
 *   console.log('Denied:', result.reason);
 * }
 * ```
 */
export class Vorion {
  private config: VorionConfig;
  private agents: Map<string, Agent> = new Map();
  private apiClient: ApiClient | null = null;

  constructor(config: VorionConfig = {}) {
    this.config = {
      localMode: !config.apiEndpoint,
      defaultObservationTier: 'GRAY_BOX',
      timeout: 30000,
      ...config,
    };

    // Initialize API client for remote mode
    if (!this.config.localMode && this.config.apiEndpoint) {
      if (!this.config.apiKey) {
        throw new Error('apiKey is required for remote mode');
      }
      this.apiClient = new ApiClient(
        this.config.apiEndpoint,
        this.config.apiKey,
        this.config.timeout
      );
    }
  }

  /**
   * Register an agent with the governance system
   */
  async registerAgent(options: AgentOptions): Promise<Agent> {
    const agent = new Agent(this, options);

    // In remote mode, admit the agent via API
    if (this.apiClient) {
      await this.apiClient.admitAgent({
        agentId: options.agentId,
        name: options.name,
        capabilities: options.capabilities ?? [],
        observationTier: options.observationTier ?? this.config.defaultObservationTier ?? 'GRAY_BOX',
      });
    }

    this.agents.set(options.agentId, agent);
    return agent;
  }

  /**
   * Get a registered agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get SDK configuration
   */
  getConfig(): VorionConfig {
    return { ...this.config };
  }

  /**
   * Get the API client (for advanced use)
   */
  getApiClient(): ApiClient | null {
    return this.apiClient;
  }

  /**
   * Check if running in local mode
   */
  isLocalMode(): boolean {
    return this.config.localMode ?? true;
  }

  /**
   * Health check (remote mode only)
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    if (!this.apiClient) {
      return { status: 'healthy', version: 'local' };
    }
    return this.apiClient.health();
  }
}

/**
 * Agent wrapper for simplified governance interactions
 */
export class Agent {
  private sdk: Vorion;
  private options: AgentOptions;
  private localTrustScore = 500; // Start at T3 (Monitored) for local mode
  private actionHistory: Array<{ action: string; allowed: boolean; timestamp: number }> = [];

  constructor(sdk: Vorion, options: AgentOptions) {
    this.sdk = sdk;
    this.options = {
      observationTier: sdk.getConfig().defaultObservationTier,
      capabilities: [],
      ...options,
    };
  }

  /**
   * Request permission to perform an action
   */
  async requestAction(action: {
    type: string;
    resource: string;
    parameters?: Record<string, unknown>;
  }): Promise<ActionResult> {
    const apiClient = this.sdk.getApiClient();

    // Remote mode: call cognigate-api
    if (apiClient) {
      const result = await apiClient.submitIntent({
        agentId: this.options.agentId,
        agentName: this.options.name,
        capabilities: this.options.capabilities,
        observationTier: this.options.observationTier,
        action,
      });

      this.actionHistory.push({
        action: action.type,
        allowed: result.allowed,
        timestamp: Date.now(),
      });

      return {
        allowed: result.allowed,
        tier: result.tier as 'GREEN' | 'YELLOW' | 'RED',
        reason: result.reason,
        proofId: result.proofId,
        constraints: result.constraints,
        processingTimeMs: result.processingTimeMs,
      };
    }

    // Local mode: simple capability check
    const proofId = crypto.randomUUID();
    const hasCapability = this.options.capabilities?.some(cap =>
      cap === '*' ||
      cap === action.type || // Simple capability (e.g., 'read')
      cap === `${action.type}:*` ||
      cap === `${action.type}:${action.resource.split('/')[0]}`
    ) ?? false;
    const allowed = hasCapability && this.localTrustScore >= 200;

    if (allowed) {
      this.localTrustScore = Math.min(1000, this.localTrustScore + 1);
    }

    this.actionHistory.push({
      action: action.type,
      allowed,
      timestamp: Date.now(),
    });

    return {
      allowed,
      tier: allowed ? 'GREEN' : 'RED',
      reason: allowed
        ? 'Action permitted'
        : hasCapability
          ? 'Trust score too low'
          : `Missing capability: ${action.type}:${action.resource.split('/')[0]}`,
      proofId,
      constraints: allowed ? this.getConstraintsForTier() : undefined,
    };
  }

  /**
   * Report action completion (positive signal)
   */
  async reportSuccess(actionType: string): Promise<void> {
    const apiClient = this.sdk.getApiClient();

    if (apiClient) {
      await apiClient.recordSignal(this.options.agentId, {
        type: 'success',
        source: 'sdk',
        weight: 0.1,
        context: { actionType },
      });
    } else {
      this.localTrustScore = Math.min(1000, this.localTrustScore + 2);
    }
  }

  /**
   * Report action failure (negative signal)
   */
  async reportFailure(actionType: string, reason?: string): Promise<void> {
    const apiClient = this.sdk.getApiClient();

    if (apiClient) {
      await apiClient.recordSignal(this.options.agentId, {
        type: 'failure',
        source: 'sdk',
        weight: 0.5,
        context: { actionType, reason },
      });
    } else {
      this.localTrustScore = Math.max(0, this.localTrustScore - 20);
    }
  }

  /**
   * Get current trust information
   */
  async getTrustInfo(): Promise<TrustInfo> {
    const apiClient = this.sdk.getApiClient();

    if (apiClient) {
      const info = await apiClient.getTrustInfo(this.options.agentId);
      return {
        score: info.score ?? 0,
        tierName: info.tierName ?? 'Unknown',
        tierNumber: info.tier ?? 0,
        observationTier: this.options.observationTier ?? 'GRAY_BOX',
      };
    }

    return {
      score: this.localTrustScore,
      tierName: this.getTierName(),
      tierNumber: this.getTierNumber(),
      observationTier: this.options.observationTier ?? 'GRAY_BOX',
    };
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.options.agentId;
  }

  /**
   * Get agent name
   */
  getName(): string {
    return this.options.name;
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): string[] {
    return [...(this.options.capabilities ?? [])];
  }

  /**
   * Get action history
   */
  getActionHistory(): Array<{ action: string; allowed: boolean; timestamp: number }> {
    return [...this.actionHistory];
  }

  private getTierNumber(): number {
    if (this.localTrustScore < 200) return 0;
    if (this.localTrustScore < 350) return 1;
    if (this.localTrustScore < 500) return 2;
    if (this.localTrustScore < 650) return 3;
    if (this.localTrustScore < 800) return 4;
    if (this.localTrustScore < 876) return 5;
    if (this.localTrustScore < 951) return 6;
    return 7;
  }

  private getTierName(): string {
    const names = [
      'Sandbox',      // T0
      'Observed',     // T1
      'Provisional',  // T2
      'Monitored',    // T3
      'Standard',     // T4
      'Trusted',      // T5
      'Certified',    // T6
      'Autonomous',   // T7
    ];
    return names[this.getTierNumber()] ?? 'Unknown';
  }

  private getConstraintsForTier(): string[] {
    const tier = this.getTierNumber();
    if (tier <= 1) {
      return ['rate_limit:10/min', 'audit:full', 'sandbox:true'];
    }
    if (tier <= 3) {
      return ['rate_limit:100/min', 'audit:standard'];
    }
    if (tier <= 5) {
      return ['rate_limit:1000/min', 'audit:light'];
    }
    return []; // T6-T7: minimal constraints
  }
}

/**
 * Create a new Vorion SDK instance
 */
export function createVorion(config?: VorionConfig): Vorion {
  return new Vorion(config);
}

// Default export
export default Vorion;
