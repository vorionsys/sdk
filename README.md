# @vorionsys/sdk

Simple, developer-friendly SDK for AI agent governance powered by the Vorion platform and the BASIS (Baseline Authority for Safe & Interoperable Systems) framework.

[![npm version](https://img.shields.io/npm/v/@vorionsys/sdk.svg)](https://www.npmjs.com/package/@vorionsys/sdk)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Installation

```bash
npm install @vorionsys/sdk
```

The SDK requires `@vorionsys/runtime` as a peer dependency:

```bash
npm install @vorionsys/sdk @vorionsys/runtime
```

## What It Provides

`@vorionsys/sdk` provides a simple interface for AI agent governance. It lets you:

- **Register agents** with declared capabilities and observation tiers
- **Submit governance requests** to check whether an agent is permitted to perform an action
- **Report outcomes** (success or failure) that dynamically adjust an agent's trust score
- **Query trust scores** to understand an agent's current standing in the trust tier system

The SDK operates in two modes: **local mode** for development and testing (in-memory, no external dependencies) and **remote mode** for production (connects to a Cognigate API instance).

## Quick Start

```typescript
import { Vorion } from '@vorionsys/sdk';

// Local mode -- in-memory governance for development and testing
const vorion = new Vorion({ localMode: true });

// 1. Register an agent with its capabilities
const agent = await vorion.registerAgent({
  agentId: 'research-assistant',
  name: 'Research Assistant',
  capabilities: ['read:*', 'write:documents'],
});

// 2. Request permission before performing an action
const result = await agent.requestAction({
  type: 'read',
  resource: 'documents/quarterly-report.pdf',
});

if (result.allowed) {
  // Action is permitted -- perform it
  console.log('Proof ID:', result.proofId); // audit trail
  console.log('Constraints:', result.constraints); // e.g. ['rate_limit:100/min']

  // 3. Report the outcome to update trust
  await agent.reportSuccess('read');
} else {
  console.log('Denied:', result.reason);
}

// 4. Check the agent's current trust score
const trust = await agent.getTrustInfo();
console.log(`Trust: ${trust.score}/1000 (${trust.tierName})`);
```

## Usage Examples

### Registering an Agent

```typescript
import { Vorion } from '@vorionsys/sdk';

const vorion = new Vorion({ localMode: true });

const agent = await vorion.registerAgent({
  agentId: 'data-analyst-01',
  name: 'Data Analyst',
  capabilities: ['read:*', 'write:reports', 'execute:queries'],
  observationTier: 'GRAY_BOX', // BLACK_BOX | GRAY_BOX | WHITE_BOX
  metadata: { version: '2.1', team: 'analytics' },
});

console.log(agent.getId());           // 'data-analyst-01'
console.log(agent.getName());         // 'Data Analyst'
console.log(agent.getCapabilities()); // ['read:*', 'write:reports', 'execute:queries']
```

### Submitting a Governance Request

Every action an agent wants to perform goes through the governance pipeline. The SDK checks capabilities and trust score, then returns a decision with an audit-grade proof ID.

```typescript
const result = await agent.requestAction({
  type: 'write',
  resource: 'reports/summary.md',
  parameters: { format: 'markdown', overwrite: false },
});

// result structure:
// {
//   allowed: true,
//   tier: 'GREEN',            // GREEN = approved, YELLOW = conditional, RED = denied
//   reason: 'Action permitted',
//   proofId: 'a1b2c3d4-...',  // unique proof commitment ID for audit
//   constraints: ['rate_limit:100/min', 'audit:standard'],
// }
```

### Checking Trust Scores

Trust scores range from 0 to 1000. Agents start at 500 (T3 -- Monitored) and move up or down based on reported outcomes. Trust adjustment is asymmetric: failures cost more than successes gain.

```typescript
const trust = await agent.getTrustInfo();
console.log(trust.score);          // 500
console.log(trust.tierName);       // 'Monitored'
console.log(trust.tierNumber);     // 3
console.log(trust.observationTier); // 'GRAY_BOX'

// Report successes to build trust
await agent.reportSuccess('read');
await agent.reportSuccess('read');

const updated = await agent.getTrustInfo();
console.log(updated.score); // 504 (each success adds +2)

// Failures decrease trust more aggressively
await agent.reportFailure('write', 'Upstream permission denied');

const afterFailure = await agent.getTrustInfo();
console.log(afterFailure.score); // 484 (failure subtracts -20)
```

### Using the Factory Function

```typescript
import { createVorion } from '@vorionsys/sdk';

const vorion = createVorion({ localMode: true });
```

### Remote Mode (Production)

Connect to a Cognigate API instance for production-grade governance with persistent trust state, distributed coordination, and full audit logging.

```typescript
const vorion = new Vorion({
  apiEndpoint: 'https://cognigate.example.com',
  apiKey: process.env.VORION_API_KEY,
  timeout: 15000, // request timeout in ms (default: 30000)
});

// API works identically -- the SDK handles remote calls transparently
const agent = await vorion.registerAgent({
  agentId: 'prod-agent',
  name: 'Production Agent',
  capabilities: ['read:*'],
});

const result = await agent.requestAction({
  type: 'read',
  resource: 'data/users.json',
});

// Remote mode includes server-side processing time
console.log(result.processingTimeMs); // e.g. 12
```

### Health Check

```typescript
const health = await vorion.healthCheck();
// Local:  { status: 'healthy', version: 'local' }
// Remote: { status: 'healthy', version: '1.2.0' }
```

### Managing Multiple Agents

```typescript
const vorion = new Vorion({ localMode: true });

await vorion.registerAgent({ agentId: 'agent-a', name: 'Agent A', capabilities: ['read:*'] });
await vorion.registerAgent({ agentId: 'agent-b', name: 'Agent B', capabilities: ['write:*'] });

const agentA = vorion.getAgent('agent-a');  // Agent | undefined
const all = vorion.getAllAgents();           // Agent[]
console.log(all.length);                    // 2
console.log(vorion.isLocalMode());          // true
```

## API Reference

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `Vorion` | Class | Main SDK client for agent governance |
| `Agent` | Class | Agent wrapper returned by `registerAgent()` |
| `createVorion` | Function | Factory function to create a `Vorion` instance |
| `VorionConfig` | Interface | Configuration options for `Vorion` |
| `AgentOptions` | Interface | Options for registering an agent |
| `ActionResult` | Interface | Result returned by `requestAction()` |
| `TrustInfo` | Interface | Trust score information from `getTrustInfo()` |
| `TrustTier` | Type | Re-exported from `@vorionsys/runtime` |
| `DecisionTier` | Type | Re-exported from `@vorionsys/runtime` |
| `AgentCredentials` | Type | Re-exported from `@vorionsys/runtime` |
| `Action` | Type | Re-exported from `@vorionsys/runtime` |
| `TrustSignal` | Type | Re-exported from `@vorionsys/runtime` |

### `Vorion` Class

```typescript
new Vorion(config?: VorionConfig)
```

**Config options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `apiEndpoint` | `string` | -- | Cognigate API URL. Enables remote mode when set. |
| `apiKey` | `string` | -- | API key. Required when `apiEndpoint` is set. |
| `localMode` | `boolean` | `true` | Force local (in-memory) mode. Defaults to `true` when no endpoint is provided. |
| `defaultObservationTier` | `'BLACK_BOX' \| 'GRAY_BOX' \| 'WHITE_BOX'` | `'GRAY_BOX'` | Default observation tier for registered agents. |
| `timeout` | `number` | `30000` | Request timeout in milliseconds (remote mode). |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `registerAgent(options)` | `Promise<Agent>` | Register an agent with the governance system |
| `getAgent(agentId)` | `Agent \| undefined` | Retrieve a registered agent by ID |
| `getAllAgents()` | `Agent[]` | List all registered agents |
| `getConfig()` | `VorionConfig` | Get the current SDK configuration |
| `isLocalMode()` | `boolean` | Check if the SDK is running in local mode |
| `healthCheck()` | `Promise<{ status, version }>` | Check API health (returns local status in local mode) |

### `Agent` Class

Returned by `vorion.registerAgent()`. Do not instantiate directly.

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `requestAction(action)` | `Promise<ActionResult>` | Request permission to perform an action |
| `reportSuccess(actionType)` | `Promise<void>` | Report a successful action (positive trust signal, +2 score in local mode) |
| `reportFailure(actionType, reason?)` | `Promise<void>` | Report a failed action (negative trust signal, -20 score in local mode) |
| `getTrustInfo()` | `Promise<TrustInfo>` | Get current trust score and tier information |
| `getId()` | `string` | Get the agent's unique identifier |
| `getName()` | `string` | Get the agent's human-readable name |
| `getCapabilities()` | `string[]` | Get the agent's declared capabilities |
| `getActionHistory()` | `Array<{ action, allowed, timestamp }>` | Get the agent's action request history |

### `ActionResult` Interface

```typescript
interface ActionResult {
  allowed: boolean;                    // Whether the action was permitted
  tier: 'GREEN' | 'YELLOW' | 'RED';   // Decision tier
  reason: string;                      // Human-readable explanation
  proofId: string;                     // Unique proof commitment ID for audit
  constraints?: string[];              // Applied constraints (e.g. rate limits)
  processingTimeMs?: number;           // Server processing time (remote mode only)
}
```

### `TrustInfo` Interface

```typescript
interface TrustInfo {
  score: number;          // Current trust score (0-1000)
  tierName: string;       // Human-readable tier name (e.g. 'Monitored')
  tierNumber: number;     // Tier number (0-7)
  observationTier: string; // Observation tier (BLACK_BOX, GRAY_BOX, WHITE_BOX)
}
```

## Trust Tiers

Agents start at T3 (Monitored, score 500) in local mode. Trust adjusts asymmetrically based on reported signals -- successes increase score gradually while failures decrease it more aggressively.

| Tier | Score Range | Name | Constraints |
|------|-------------|------|-------------|
| T0 | 0--199 | Sandbox | `rate_limit:10/min`, `audit:full`, `sandbox:true` |
| T1 | 200--349 | Observed | `rate_limit:10/min`, `audit:full`, `sandbox:true` |
| T2 | 350--499 | Provisional | `rate_limit:100/min`, `audit:standard` |
| T3 | 500--649 | Monitored | `rate_limit:100/min`, `audit:standard` |
| T4 | 650--799 | Standard | `rate_limit:1000/min`, `audit:light` |
| T5 | 800--875 | Trusted | `rate_limit:1000/min`, `audit:light` |
| T6 | 876--950 | Certified | No constraints |
| T7 | 951--1000 | Autonomous | No constraints |

## Capability Patterns

Capabilities use a `type:resource` pattern with glob support:

| Pattern | Matches |
|---------|---------|
| `read` | Exact match on `read` action type |
| `read:*` | Any `read` action regardless of resource |
| `read:documents` | `read` actions on resources starting with `documents/` |
| `*` | All actions (unrestricted) |

## TypeScript

The SDK ships with full TypeScript type definitions. All interfaces and types are exported for direct use:

```typescript
import type {
  VorionConfig,
  AgentOptions,
  ActionResult,
  TrustInfo,
  TrustTier,
  DecisionTier,
  AgentCredentials,
  Action,
  TrustSignal,
} from '@vorionsys/sdk';
```

## Requirements

- Node.js >= 18.0.0
- `@vorionsys/runtime` >= 0.1.0 (peer dependency)

## Related Packages

| Package | Description |
|---------|-------------|
| [`@vorionsys/runtime`](https://www.npmjs.com/package/@vorionsys/runtime) | Core orchestration layer (trust facade, proof committer, intent pipeline) |

## Contributing

See the [main repository](https://github.com/vorionsys/vorion) for contribution guidelines.

## License

Apache-2.0 -- see [LICENSE](./LICENSE) for details.

---

Part of the [Vorion](https://github.com/vorionsys/vorion) project.
