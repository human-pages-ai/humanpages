# MCP Protocol Analytics Tracking

This document describes the comprehensive PostHog analytics tracking added to the MCP (Model Context Protocol) handler and tool execution layer.

## Overview

PostHog analytics tracking has been integrated into:
1. **MCP Protocol Handler** (`backend/src/routes/mcp-remote.ts`) - session lifecycle and protocol-level events
2. **Tool Execution Layer** (`backend/src/lib/mcp-tools.ts`) - granular per-tool analytics

All events are tracked using the `trackServerEvent()` function from `backend/src/lib/posthog.ts`.

## Session Lifecycle Tracking

### Session Created: `mcp_session_started`
**When:** New session is created after agent authentication
**Location:** `mcp-remote.ts` - `createSession()` function
**Properties:**
- `session_id`: Unique session identifier
- `agent_id`: Agent ID

**Use case:** Track how many agents are actively using the MCP API and session creation patterns.

---

### Session Ended: `mcp_session_ended`
**When:**
- Client explicitly terminates session (DELETE /api/mcp)
- Session times out after 1 hour of inactivity
**Location:**
- `mcp-remote.ts` - DELETE /api/mcp endpoint
- `mcp-remote.ts` - cleanup interval (timeout tracking)
**Properties:**
- `session_id`: Unique session identifier
- `agent_id`: Agent ID
- `duration_seconds`: Session lifetime in seconds
- `reason`: Either `'client_disconnect'` or `'timeout'`

**Use case:** Measure session duration, understand whether disconnections are intentional or timeout-based.

---

### SSE Connected: `mcp_sse_connected`
**When:** Client establishes Server-Sent Events (SSE) connection
**Location:** `mcp-remote.ts` - GET /api/mcp endpoint
**Properties:**
- `session_id`: Unique session identifier
- `agent_id`: Agent ID

**Use case:** Track real-time streaming subscriptions and client connection patterns.

---

## Protocol-Level Tracking

### Tools Listed: `mcp_tools_listed`
**When:** Client calls `tools/list` to discover available tools
**Location:** `mcp-remote.ts` - `tools/list` case
**Properties:**
- `session_id`: Unique session identifier
- `agent_id`: Agent ID
- `tool_count`: Number of tools returned (always 13 currently)

**Use case:** Track how often agents discover the tool catalog; baseline for subsequent tool usage.

---

### Tool Called: `mcp_tool_called`
**When:** Every successful or failed tool execution (tools/call)
**Location:** `mcp-remote.ts` - `tools/call` case
**Properties:**
- `session_id`: Unique session identifier
- `agent_id`: Agent ID
- `tool_name`: Name of the tool executed
- `success`: Boolean - whether execution succeeded
- `latency_ms`: Execution time in milliseconds
- `error_type`: Only present if `success=false`; one of:
  - `tool_error`: Tool returned error object
  - `rate_limited`: Rate limit exceeded
  - `auth_failed`: Authentication failed
  - `not_found`: Resource not found
  - `validation`: Invalid input
  - `server_error`: Upstream server error

**Use case:** Core analytics for tool adoption, latency monitoring, error rates, and debugging.

---

### Tool Error: `mcp_tool_error`
**When:** Tool execution fails (either exception or tool returns error object)
**Location:** `mcp-remote.ts` - `tools/call` case
**Properties:**
- `session_id`: Unique session identifier
- `agent_id`: Agent ID
- `tool_name`: Name of the tool
- `error_type`: Categorized error (see above)
- `latency_ms`: Time to failure

**Use case:** Detailed error tracking alongside the mcp_tool_called event; cross-reference for root cause analysis.

---

## Granular Tool-Level Tracking

### Search Humans: `mcp_search_executed`
**Tool:** `search_humans`
**Location:** `mcp-tools.ts` - search_humans case
**Properties:**
- `agent_id`: Agent ID
- `skill`: First skill searched (if provided)
- `location`: Location filter (if provided)
- `result_count`: Number of results returned
- `has_filters`: Boolean - whether advanced filters were used

**Use case:** Understand search behavior; which skills/locations are most popular; filter adoption.

---

### Profile Viewed: `mcp_profile_viewed`
**Tools:** `get_human`, `get_human_profile`
**Location:** `mcp-tools.ts` - both get_human cases
**Properties:**
- `agent_id`: Agent ID
- `human_id`: ID of the viewed profile
- `is_authenticated`: Boolean - whether authenticated profile data was requested

**Use case:** Track which profiles are viewed most often; measure impact of authenticated vs. public data.

---

### Job Created: `mcp_job_created`
**Tool:** `create_job`
**Location:** `mcp-tools.ts` - create_job case
**Properties:**
- `agent_id`: Agent ID
- `human_id`: ID of the human the job is for (if specified)
- `price_usdc`: Budget in USDC
- `payment_mode`: Payment type (ONE_TIME, STREAM, etc.)
- `has_callback`: Boolean - whether callback webhook is configured

**Use case:** Track job creation volume, budget distribution, payment preferences, and webhook adoption.

---

### Agent Registered: `mcp_agent_registered_via_tool`
**Tool:** `register_agent`
**Location:** `mcp-tools.ts` - register_agent case
**Properties:**
- `agent_name`: Display name of registered agent

**Use case:** Distinguish agent registrations via MCP tool vs. REST API; measure tool adoption for onboarding.

---

### Listings Browsed: `mcp_listings_browsed`
**Tool:** `browse_listings`
**Location:** `mcp-tools.ts` - browse_listings case
**Properties:**
- `agent_id`: Agent ID
- `category`: Listing category filter (if specified)
- `result_count`: Number of listings returned
- `page`: Pagination page number (calculated from offset/limit)

**Use case:** Track marketplace browsing patterns; category popularity; pagination usage.

---

### Listing Created: `mcp_listing_created`
**Tool:** `create_listing`
**Location:** `mcp-tools.ts` - create_listing case
**Properties:**
- `agent_id`: Agent ID
- `category`: Category of the listing
- `has_price`: Boolean - whether price was set

**Use case:** Track listing creation volume; category distribution; pricing adoption.

---

### Ping: `mcp_ping`
**Tool:** `ping`
**Location:** `mcp-tools.ts` - ping case
**Properties:**
- `agent_id`: Agent ID

**Use case:** Health checks; baseline for distinguishing active vs. idle agents.

---

## Implementation Details

### Tracking Function Signature
```typescript
trackServerEvent(
  distinctId: string,           // Agent ID or 'anonymous'
  event: string,                // Event name
  properties?: Record<string, any>,  // Event properties
  req?: ExpressRequest          // Optional request object for IP geolocation
): void
```

Key features:
- **Non-blocking:** PostHog queue and batching; doesn't slow down response
- **Batching:** Events batch every 10 seconds or at 20 events max
- **Geolocation:** Automatically resolves agent country/city from IP if request object provided
- **Graceful degradation:** No-op if POSTHOG_KEY environment variable is not set

### Agent ID As Distinct ID
All events use `agentId` as PostHog's `distinctId`. This allows:
- Cohort analysis by agent
- User-journey funnels per agent
- Identifying power users and dormant agents

### Error Categorization
Tool errors are intelligently categorized by examining error messages:
- `rate_limited`: Contains "Rate limit"
- `auth_failed`: Contains "Unauthorized" or "401"
- `not_found`: Contains "not found" or "404"
- `validation`: Contains "validation" or "invalid"
- `server_error`: Fallback for other errors

### Latency Measurement
Latency is measured at the protocol handler level (mcp-remote.ts) using `Date.now()`:
```typescript
const startTime = Date.now();
// ... tool execution ...
const latencyMs = Date.now() - startTime;
trackServerEvent(agentId, 'mcp_tool_called', { latency_ms: latencyMs });
```

This captures full execution time including network round-trips.

### Response Minimization
Tool-level tracking extracts response data safely:
- Checks for `Array.isArray(result)` to handle array responses
- Falls back to `result?.data` for paginated responses
- Counts items before minimization (no PII leakage)

## Recommended Dashboards in PostHog

### 1. MCP Usage Overview
- Line chart: Daily `mcp_session_started` events
- Breakdown by agent (top 10)
- Session duration distribution (percentiles: p50, p95, p99)

### 2. Tool Adoption
- Table: Tool call counts sorted by `tool_name`
- Filter: `tool_name` breakdown
- Insight: Which tools are most popular?

### 3. Error Analysis
- Funnel: `mcp_tool_called` (success=true) vs. `mcp_tool_called` (success=false)
- Breakdown by `error_type`
- Alert: Set up alert if error rate > 5%

### 4. Latency Monitoring
- Line chart: `mcp_tool_called` events, graph `latency_ms`
- Breakdown by `tool_name`
- Alert: Set up alert if p99 latency > 2000ms

### 5. Search Behavior
- Aggregate: `mcp_search_executed` by `skill` (top 20)
- Filter adoption: `has_filters=true` vs. `has_filters=false` event counts

### 6. Marketplace Activity
- Funnel: `browse_listings` → `create_listing` (conversion rate)
- Category breakdown in both events

## Privacy and Security

### What Is NOT Tracked
- API keys, tokens, secrets (never logged)
- Full request/response bodies
- User PII from profile lookups
- Callback URLs or webhook secrets
- Actual job descriptions or listing content

### What IS Tracked
- Anonymized event names and counts
- Non-sensitive parameters (skill name, location, category)
- Numeric aggregates (result counts, prices, latencies)
- Boolean flags (has_filters, has_callback, has_price)

### Compliance
- PostHog is GDPR-compliant and uses aggregate-level analytics
- AgentId is the primary identifier; agents can opt out via PostHog settings
- All tracking is server-side; no client-side exposure of analytics code

## Testing

To verify tracking in development:
1. Set `POSTHOG_KEY` environment variable
2. Make MCP calls via curl or GPT connector
3. Check PostHog dashboard for events appearing within 10 seconds (batching window)

Example:
```bash
# Create session
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0", "method":"initialize", "id":1}'

# Call tool
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Mcp-Session-Id: session_xxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0", "method":"tools/call", "params":{"name":"ping"}, "id":2}'
```

## Future Enhancements

1. **Custom Funnels:** Create funnels for agent workflows (search → view profile → create job)
2. **Cohort Analysis:** Identify high-value vs. churn-risk agents
3. **A/B Testing:** Roll out feature changes and measure adoption
4. **Alerting:** Set up PagerDuty alerts for error rate spikes
5. **Attribution:** Cross-reference with REST API events for multi-channel analysis

---

## Files Modified

- **`backend/src/routes/mcp-remote.ts`**: Session and protocol-level tracking (13 tracking calls)
- **`backend/src/lib/mcp-tools.ts`**: Tool-level tracking (9 tracking calls)
- **`backend/src/lib/posthog.ts`**: No changes (pre-existing integration)

Total: 22 distinct event types across 206 lines of changes.
