---
title: "Part 4: Distributed Systems"
subtitle: "CAP Theorem, Consistency, Consensus, Microservices & Observability"
linkTitle: "Part 4: Distributed Systems"
weight: 4
type: "docs"
quiz:
  - q: "Your e-commerce checkout must never sell more items than are in stock, even during a network partition between data centers. Which CAP property are you prioritizing, and what's the trade-off?"
    concepts:
      - label: "choosing consistency over availability"
        terms: ["consistency", "CP", "correct", "accurate", "never oversell", "strong consistency"]
      - label: "rejecting requests during partition"
        terms: ["unavailable", "reject", "refuse", "error", "timeout", "deny", "503", "can't serve"]
      - label: "partition tolerance is mandatory"
        terms: ["partition", "network", "split", "mandatory", "can't avoid", "always happens"]
    answer: "You're choosing Consistency (CP system). During a network partition, the system refuses writes rather than risk overselling. Partition tolerance is non-negotiable in distributed systems, so the real choice is always between C and A during a partition."
  - q: "Users are complaining that after updating their profile, they sometimes see stale data when they refresh. The system uses eventual consistency with multiple read replicas. How would you fix this without switching to strong consistency everywhere?"
    concepts:
      - label: "read-your-own-writes consistency"
        terms: ["read your own write", "read-after-write", "session consistency", "sticky session", "causal", "own update"]
      - label: "route reads to primary after write"
        terms: ["route to primary", "read from master", "read from leader", "write node", "same node"]
      - label: "keep eventual consistency for other users"
        terms: ["eventual", "other users", "everyone else", "don't need strong", "acceptable delay"]
    answer: "Implement read-your-own-writes consistency. After a user writes, route their subsequent reads to the primary node (or wait for replication). Other users can still read from replicas with eventual consistency. This gives the writing user a consistent experience without the cost of strong consistency for all reads."
  - q: "Your microservice calls three downstream services. One of them has been failing 90% of the time for the last minute, causing your service to slow down. What pattern should you implement?"
    concepts:
      - label: "circuit breaker"
        terms: ["circuit breaker", "circuit", "breaker", "trip", "open circuit", "stop calling"]
      - label: "fail fast instead of waiting"
        terms: ["fail fast", "fast fail", "don't wait", "immediate", "timeout", "stop trying"]
      - label: "fallback or degraded response"
        terms: ["fallback", "degrade", "default", "cached", "partial", "graceful"]
    answer: "Implement a circuit breaker. After detecting the high failure rate, the circuit opens and immediately returns a fallback response instead of waiting for timeouts. This protects your service from cascading failures. After a cooldown period, the circuit half-opens to test if the downstream service has recovered."
  - q: "Your team is debugging a slow API response that spans 5 microservices. Logs exist for each service but you can't tell which logs belong to the same request. What's missing?"
    concepts:
      - label: "distributed tracing / correlation ID"
        terms: ["correlation id", "trace id", "request id", "distributed trac", "tracing", "span"]
      - label: "propagate ID across services"
        terms: ["propagat", "pass", "forward", "header", "downstream", "across service"]
      - label: "link logs from all services"
        terms: ["link", "correlat", "connect", "stitch", "aggregate", "single request", "end-to-end"]
    answer: "You need distributed tracing with correlation IDs. Generate a unique trace ID at the entry point and propagate it through all downstream service calls via headers. Each service includes this ID in its logs. Now you can filter all logs by a single trace ID to see the full request journey across all 5 services."
  - q: "Your startup has 3 developers and is building an MVP. A senior engineer proposes splitting the app into 12 microservices from day one. What's your response?"
    concepts:
      - label: "start with a monolith"
        terms: ["monolith", "single service", "one service", "start simple", "too early", "premature"]
      - label: "microservices add operational complexity"
        terms: ["complex", "overhead", "operational", "deploy", "network", "debug", "infrastructure"]
      - label: "extract services later when needed"
        terms: ["extract", "later", "when needed", "grow into", "split when", "boundary", "modular monolith"]
    answer: "Start with a well-structured monolith. 12 microservices for 3 developers means more time on infrastructure than features. Microservices add network complexity, deployment overhead, and distributed debugging challenges. Build a modular monolith with clear boundaries, then extract services when you have a proven need (scale, team size, independent deployment)."
---

## CAP Theorem

In a distributed system, you can't have everything. The **CAP theorem** states that when a network partition occurs, a distributed data store can guarantee at most **two of three** properties:

<div class="diagram">
  <div class="layer">Consistency — every read gets the most recent write</div>
  <div class="arrow">+</div>
  <div class="layer">Availability — every request gets a response (no errors/timeouts)</div>
  <div class="arrow">+</div>
  <div class="layer">Partition Tolerance — system works despite network failures between nodes</div>
</div>

<div class="callout">
<strong>The real choice:</strong> Partition tolerance is non-negotiable in distributed systems — networks <em>will</em> fail. So the actual decision is: during a partition, do you sacrifice <strong>consistency</strong> (serve stale data) or <strong>availability</strong> (reject requests)?
</div>

### CP vs AP Systems

**CP (Consistency + Partition Tolerance)** — during a partition, the system refuses to serve requests rather than return stale data.

**AP (Availability + Partition Tolerance)** — during a partition, the system serves requests but may return stale data.

| Database | CAP Priority | Why |
|---|---|---|
| PostgreSQL (single node) | CA | No partition tolerance — it's one node |
| MongoDB (default config) | CP | Writes go to primary; if primary is unreachable, writes fail |
| Cassandra | AP | Writes succeed on any node; data syncs eventually |
| DynamoDB | AP (default) / CP (strong reads) | Configurable — eventual consistency by default, optional strong reads |
| etcd / ZooKeeper | CP | Used for coordination — correctness over availability |
| CockroachDB | CP | Distributed SQL — serializable consistency, rejects during partition |
| Redis Cluster | AP | Async replication; a failover can lose recent writes |
| Consul | CP | Raft consensus — leader must be reachable for writes |

<span class="label label-ts">TypeScript</span> — choosing consistency level in DynamoDB:

```typescript
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

// AP: eventual consistency (default, faster, cheaper)
const eventualRead = new GetItemCommand({
  TableName: "Orders",
  Key: { orderId: { S: "order-123" } },
  ConsistentRead: false,
});

// CP: strong consistency (slower, costs 2x)
const strongRead = new GetItemCommand({
  TableName: "Orders",
  Key: { orderId: { S: "order-123" } },
  ConsistentRead: true,
});
```

<span class="label label-py">Python</span> — same choice in boto3:

```python
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("Orders")

# AP: eventual consistency (default)
response = table.get_item(Key={"orderId": "order-123"})

# CP: strong consistency
response = table.get_item(Key={"orderId": "order-123"}, ConsistentRead=True)
```

---

## Consistency Models

Not all consistency is the same. Different models offer different guarantees — and different costs.

### Strong Consistency

Every read returns the most recent write. All nodes agree on the current value at all times.

**When it matters:** bank account balances, inventory counts, anything where stale data causes real harm.

<span class="label label-ts">TypeScript</span>

```typescript
// Strong consistency: read-after-write guaranteed
async function transferMoney(from: string, to: string, amount: number) {
  await db.transaction(async (tx) => {
    const balance = await tx.query(
      "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE", [from]
    );
    if (balance.rows[0].balance < amount) {
      throw new Error("Insufficient funds");
    }
    await tx.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [amount, from]);
    await tx.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [amount, to]);
  });
}
```

### Eventual Consistency

If no new writes occur, all replicas will *eventually* converge to the same value. Reads may return stale data.

**When it matters:** social media feeds, product reviews, analytics dashboards — where slight staleness is acceptable.

<span class="label label-py">Python</span>

```python
# Eventual consistency: user might see stale like count briefly
async def add_like(post_id: str, user_id: str):
    # Write to primary
    await primary_db.execute(
        "INSERT INTO likes (post_id, user_id) VALUES (%s, %s)", (post_id, user_id)
    )
    # Replicas will catch up — reads from replicas may lag

async def get_like_count(post_id: str) -> int:
    # Reading from replica — might be slightly behind
    result = await replica_db.fetch_one(
        "SELECT COUNT(*) FROM likes WHERE post_id = %s", (post_id,)
    )
    return result[0]
```

### Causal Consistency

Operations that are causally related are seen in the correct order. Unrelated operations may be seen in any order.

**When it matters:** chat messages (replies must appear after the message they reply to), comment threads.

<span class="label label-ts">TypeScript</span>

```typescript
// Causal consistency: reply must be seen after the original message
interface Message {
  id: string;
  text: string;
  causalDependency?: string; // ID of the message this depends on
  vectorClock: Record<string, number>;
}

function canDeliver(msg: Message, delivered: Map<string, Message>): boolean {
  if (!msg.causalDependency) return true;
  return delivered.has(msg.causalDependency);
}
```

<div class="callout tip">
<strong>Rule of thumb:</strong> Use strong consistency for money and inventory. Use eventual consistency for social features and analytics. Use causal consistency for conversations and collaborative editing.
</div>

---

## Consensus

In a distributed system, how do multiple nodes agree on a single value — like who the leader is, or what the next log entry should be?

This is the **consensus problem**, and it's hard because:

- Nodes can crash at any time
- Messages can be delayed, duplicated, or lost
- There's no global clock — nodes disagree on "now"

<div class="diagram">
  <div class="layer">Node A proposes value X</div>
  <div class="arrow">↓</div>
  <div class="layer">Node B proposes value Y</div>
  <div class="arrow">↓</div>
  <div class="layer">Consensus protocol → All nodes agree on X (or Y, but the same one)</div>
</div>

### Raft

Raft solves consensus by electing a **leader**. All writes go through the leader, who replicates them to followers. If the leader dies, a new election happens.

**Key idea:** The system is safe as long as a **majority** (quorum) of nodes are alive. With 5 nodes, you can tolerate 2 failures.

**Used by:** etcd, Consul, CockroachDB, TiKV

### Paxos

Paxos solves the same problem but is notoriously difficult to understand and implement. It uses a **proposer/acceptor/learner** model.

**Key idea:** A value is chosen when a majority of acceptors agree on it. Multiple rounds of proposals may be needed.

**Used by:** Google Spanner, Apache ZooKeeper (variant)

<div class="callout info">
<strong>You don't implement consensus — you use it.</strong> Choose a system that has it built in (etcd, ZooKeeper, Consul). The important thing is understanding <em>what</em> it guarantees: all nodes agree on the same sequence of operations, even when some nodes fail.
</div>

---

## Microservices Trade-offs

Microservices are not a free upgrade from monoliths. They trade one set of problems for another.

### When Monolith vs Microservices

| Factor | Monolith | Microservices |
|---|---|---|
| Team size | Small team (< 10) | Multiple teams owning services |
| Deployment | Deploy everything together | Deploy services independently |
| Debugging | Stack trace in one process | Distributed tracing across network |
| Data consistency | Transactions are easy | Distributed transactions are hard |
| Latency | Function calls (nanoseconds) | Network calls (milliseconds) |
| Operational cost | One thing to deploy/monitor | Dozens of things to deploy/monitor |

<div class="callout">
<strong>Start with a monolith.</strong> Extract services when you have a proven need: a component needs to scale independently, a team needs to deploy independently, or a bounded context is clearly separate.
</div>

### The Fallacies of Distributed Computing

These are assumptions developers make that are **false** in distributed systems:

1. **The network is reliable** — it's not. Packets get dropped, connections time out
2. **Latency is zero** — every network call adds milliseconds
3. **Bandwidth is infinite** — large payloads cost real time
4. **The network is secure** — every hop is an attack surface
5. **Topology doesn't change** — nodes come and go
6. **There is one administrator** — multiple teams, multiple configs
7. **Transport cost is zero** — serialization, TLS, load balancers all cost
8. **The network is homogeneous** — different hardware, different clouds

<span class="label label-ts">TypeScript</span> — the network is unreliable, so add retries:

```typescript
async function fetchWithRetry(
  url: string, maxRetries = 3, baseDelay = 200
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return response;
      if (response.status < 500) throw new Error(`Client error: ${response.status}`);
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt)); // exponential backoff
  }
  throw new Error("Unreachable");
}
```

<span class="label label-py">Python</span> — retries with backoff:

```python
import asyncio
import httpx

async def fetch_with_retry(url: str, max_retries: int = 3, base_delay: float = 0.2):
    async with httpx.AsyncClient(timeout=5.0) as client:
        for attempt in range(max_retries + 1):
            try:
                response = await client.get(url)
                response.raise_for_status()
                return response
            except (httpx.HTTPStatusError, httpx.RequestError):
                if attempt == max_retries:
                    raise
            await asyncio.sleep(base_delay * (2 ** attempt))
```

---

## Service Discovery & Load Balancing

In a microservices architecture, services need to find each other. IP addresses change as containers scale up and down.

### Client-Side vs Server-Side Discovery

<div class="diagram">
  <div class="layer">Client-Side Discovery</div>
  <div class="layer">Client → Service Registry → picks an instance → Service Instance</div>
  <div class="arrow">↓</div>
  <div class="layer">Server-Side Discovery</div>
  <div class="layer">Client → Load Balancer → routes to instance → Service Instance</div>
</div>

**Client-side discovery:** The client queries a service registry (Consul, etcd, Eureka) and picks an instance. The client handles load balancing.

**Server-side discovery:** The client sends requests to a load balancer (ALB, NGINX, Kubernetes Service), which routes to a healthy instance. The client doesn't know about individual instances.

<div class="callout tip">
<strong>In practice:</strong> Kubernetes uses server-side discovery (Services + kube-proxy). AWS uses ALB/NLB. Client-side discovery (like gRPC with service mesh) gives more control but adds client complexity.
</div>

### Health Checks

Services must report whether they're healthy. Without health checks, load balancers send traffic to dead instances.

<span class="label label-ts">TypeScript</span> — health check endpoint:

```typescript
import express from "express";

const app = express();

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");       // check database
    await redis.ping();                // check cache
    res.json({ status: "healthy" });
  } catch (err) {
    res.status(503).json({ status: "unhealthy", error: (err as Error).message });
  }
});
```

<span class="label label-py">Python</span> — FastAPI health check:

```python
from fastapi import FastAPI, Response

app = FastAPI()

@app.get("/health")
async def health_check(response: Response):
    try:
        await db.execute("SELECT 1")
        await redis.ping()
        return {"status": "healthy"}
    except Exception as e:
        response.status_code = 503
        return {"status": "unhealthy", "error": str(e)}
```

---

## Circuit Breaker Pattern

When a downstream service is failing, continuing to call it wastes resources and causes cascading failures. A **circuit breaker** detects failures and short-circuits requests.

<div class="diagram">
  <div class="layer">CLOSED — requests flow normally, failures are counted</div>
  <div class="arrow">failure threshold exceeded →</div>
  <div class="layer">OPEN — requests fail immediately, no calls to downstream</div>
  <div class="arrow">cooldown expires →</div>
  <div class="layer">HALF-OPEN — one test request allowed through</div>
  <div class="arrow">success → CLOSED / failure → OPEN</div>
</div>

<span class="label label-ts">TypeScript</span> — circuit breaker implementation:

```typescript
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;

  constructor(
    private threshold: number = 5,
    private cooldownMs: number = 10_000,
  ) {}

  async call<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = "HALF_OPEN";
      } else {
        return fallback();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      return fallback();
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
    }
  }
}

// Usage
const breaker = new CircuitBreaker(5, 10_000);

const result = await breaker.call(
  () => fetch("https://api.payment.com/charge").then((r) => r.json()),
  () => ({ status: "service_unavailable", cached: true }),
);
```

<div class="callout info">
<strong>In production:</strong> Use libraries like <code>opossum</code> (Node.js) or <code>pybreaker</code> (Python) instead of rolling your own. They handle edge cases like concurrent requests during half-open state.
</div>

---

## Observability

You can't debug a distributed system with `console.log`. Observability has **three pillars**:

| Pillar | What It Tells You | Tools |
|---|---|---|
| **Logs** | What happened (discrete events) | CloudWatch Logs, ELK, Loki |
| **Metrics** | How the system is performing (aggregated numbers) | CloudWatch Metrics, Prometheus, Datadog |
| **Traces** | How a request flowed across services (end-to-end) | X-Ray, Jaeger, Zipkin |

<div class="callout">
<strong>Logs</strong> tell you <em>what</em> happened. <strong>Metrics</strong> tell you <em>how much</em>. <strong>Traces</strong> tell you <em>where</em> (which service, which call, how long).
</div>

### Distributed Tracing with Correlation IDs

A **correlation ID** (or trace ID) is a unique identifier generated at the entry point of a request and propagated through every downstream service call. It ties together all logs, metrics, and spans for a single user request.

<div class="diagram">
  <div class="layer">User Request → API Gateway (generates traceId: abc-123)</div>
  <div class="arrow">↓ header: x-trace-id: abc-123</div>
  <div class="layer">Order Service (logs with traceId: abc-123)</div>
  <div class="arrow">↓ header: x-trace-id: abc-123</div>
  <div class="layer">Payment Service (logs with traceId: abc-123)</div>
  <div class="arrow">↓ header: x-trace-id: abc-123</div>
  <div class="layer">Inventory Service (logs with traceId: abc-123)</div>
</div>

<span class="label label-ts">TypeScript</span> — tracing middleware for Express:

```typescript
import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

// Middleware: extract or generate trace ID, attach to request and response
function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const traceId = (req.headers["x-trace-id"] as string) || randomUUID();
  const spanId = randomUUID().slice(0, 8);

  req.traceId = traceId;
  req.spanId = spanId;
  res.setHeader("x-trace-id", traceId);

  const start = Date.now();
  res.on("finish", () => {
    console.log(JSON.stringify({
      traceId,
      spanId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    }));
  });

  next();
}

// Propagate trace ID to downstream calls
async function callDownstream(url: string, traceId: string) {
  return fetch(url, {
    headers: { "x-trace-id": traceId },
  });
}
```

<span class="label label-py">Python</span> — FastAPI tracing middleware:

```python
import uuid, time, json, logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)

class TracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get("x-trace-id", str(uuid.uuid4()))
        span_id = str(uuid.uuid4())[:8]
        request.state.trace_id = trace_id

        start = time.monotonic()
        response = await call_next(request)
        duration_ms = (time.monotonic() - start) * 1000

        response.headers["x-trace-id"] = trace_id
        logger.info(json.dumps({
            "traceId": trace_id,
            "spanId": span_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "durationMs": round(duration_ms, 2),
        }))
        return response
```

<div class="callout tip">
<strong>Structured logging is essential.</strong> JSON logs with consistent fields (traceId, spanId, service, method, path, status, duration) let you filter and correlate across services. Never use unstructured <code>console.log("something happened")</code> in production.
</div>

---

## Key Takeaways

1. **CAP theorem** — during a network partition, choose consistency (reject requests) or availability (serve stale data). Partition tolerance is mandatory
2. **Consistency models** — strong for money, eventual for social features, causal for conversations. Pick the cheapest model that's correct for your use case
3. **Consensus** (Raft/Paxos) — how distributed nodes agree. Don't implement it — use systems that have it (etcd, ZooKeeper, Consul)
4. **Start with a monolith** — microservices add network complexity, operational overhead, and distributed debugging. Extract services when you have a proven need
5. **The network is unreliable** — add retries with exponential backoff, timeouts, and circuit breakers to every external call
6. **Circuit breakers** prevent cascading failures — fail fast instead of waiting for a dead service
7. **Observability = logs + metrics + traces** — use correlation IDs to tie requests together across services

## Check Your Understanding

{{< quiz >}}