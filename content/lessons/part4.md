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
case_studies:
  - title: "The Cascading Failure"
    category: "Incident Response"
    difficulty: "⭐⭐⭐"
    scenario: "GlobalMart is an e-commerce platform serving 10 million daily active users across 12 countries. Last Tuesday at 2:15 PM UTC, the Recommendation Service (which suggests 'You might also like...' products) started returning 500 errors due to a corrupted ML model deployment. Within 3 minutes, product pages began failing entirely — even though recommendations are a non-critical feature. The Product Detail Page service calls Recommendations synchronously and has no timeout configured, so threads piled up waiting for responses. By 2:25 PM, the Product service was unresponsive, which cascaded to Search, Cart, and Checkout. The site was fully down for 47 minutes, costing an estimated $2.1M in lost sales."
    constraints: "10M daily users, 23 microservices, peak traffic of 45,000 requests/second, 99.95% uptime SLA ($50K penalty per hour of downtime), must implement fixes without a full architecture rewrite, 3-week deadline for initial resilience improvements"
    prompts:
      - "What specific resilience patterns would have prevented the Recommendation Service failure from cascading? Where exactly would you implement each one?"
      - "The Product Detail Page treats recommendations as required data. How do you redesign this so non-critical features degrade gracefully?"
      - "How do you set appropriate timeouts and circuit breaker thresholds? What data do you need to make these decisions?"
      - "Once you've implemented resilience patterns, how do you verify they actually work? How do you test for cascading failures before they happen in production?"
    approaches:
      - name: "Circuit Breakers with Graceful Degradation"
        description: "Wrap every inter-service call in a circuit breaker. When the Recommendation Service fails, the circuit opens and the Product Detail Page renders without recommendations (showing a static 'Popular Products' fallback from cache). Add timeouts (e.g., 500ms) to all downstream calls. Implement bulkheads so each downstream dependency gets its own thread pool — a slow Recommendations call can't exhaust threads needed for Pricing or Inventory."
        trade_off: "Directly addresses the root cause of the cascading failure. Implementation is straightforward with libraries like Resilience4j or opossum. But requires auditing all 23 services to identify every synchronous dependency, classifying each as critical vs. non-critical, and designing fallbacks for each. Timeouts and thresholds need tuning based on real traffic data."
      - name: "Async-First Architecture"
        description: "Redesign the Product Detail Page to fetch non-critical data (recommendations, reviews, recently viewed) asynchronously via the frontend. The backend returns core product data immediately; the UI loads supplementary sections independently via separate API calls. If any supplementary call fails, that section shows a placeholder."
        trade_off: "Eliminates backend cascading entirely for non-critical features — the Product service never calls Recommendations at all. Improves perceived performance (core content loads faster). But requires frontend changes across all clients (web, mobile, apps), increases the number of API calls per page load, and shifts complexity to the client. Doesn't help with backend-to-backend cascading for critical paths."
      - name: "Service Mesh with Automatic Resilience"
        description: "Deploy a service mesh (Istio/Linkerd) that handles timeouts, retries, circuit breaking, and traffic management at the infrastructure level. Configure resilience policies in YAML rather than in application code. Add automatic canary deployments so a corrupted ML model is caught before full rollout."
        trade_off: "Applies resilience uniformly across all 23 services without changing application code. Canary deployments prevent bad deployments from reaching production. But a service mesh adds significant operational complexity — proxy sidecars increase latency and resource usage, debugging becomes harder (is it the app or the mesh?), and the team needs to learn a new infrastructure layer. Overkill if only a few critical paths need protection."
  - title: "The Invisible Bottleneck"
    category: "Incident Response"
    difficulty: "⭐⭐"
    scenario: "FinFlow runs a payment processing platform with 15 microservices. The checkout flow touches 7 of them: API Gateway → Auth → Cart → Pricing → Inventory → Payment → Confirmation. Users report that checkout takes 6-12 seconds, but when engineers check individual service dashboards, each service reports p95 latency under 200ms. There's no distributed tracing — each service logs independently to its own CloudWatch log group. The team has spent 3 weeks adding more logging to individual services without finding the bottleneck. Meanwhile, checkout abandonment has increased 25%."
    constraints: "15 microservices on ECS, 7 engineers across 3 teams, each team owns different services, no existing tracing infrastructure, 200,000 checkouts per day, must diagnose within 1 week and fix within 3 weeks"
    prompts:
      - "Why can individual services appear fast while the end-to-end flow is slow? What are the possible causes that per-service metrics would miss?"
      - "How would you implement distributed tracing across 15 services? What's the minimum viable setup to diagnose this specific problem?"
      - "Once you have traces, what patterns would you look for? How do you distinguish between sequential bottlenecks, network latency, and queuing delays?"
      - "How do you make observability a permanent part of the platform so this class of problem is caught early in the future?"
    approaches:
      - name: "Correlation ID + Centralized Logging"
        description: "Generate a unique trace ID at the API Gateway and propagate it via HTTP headers through all downstream calls. Each service includes this trace ID in every log line. Aggregate all logs into a single CloudWatch log group (or ELK/Loki). Filter by trace ID to see the full request timeline. Add timestamps to identify gaps between service calls."
        trade_off: "Minimal infrastructure change — just add a header and a log field to each service. Can be implemented in a few days with middleware. But manual log analysis is tedious, you can't visualize the call graph, and you won't see network-level delays (time between one service sending a response and the next service receiving it). Good enough to diagnose the immediate problem."
      - name: "OpenTelemetry with Distributed Tracing"
        description: "Instrument all 15 services with OpenTelemetry SDK. Each service creates spans for incoming requests and outgoing calls. Traces are exported to AWS X-Ray (or Jaeger/Tempo). The trace waterfall visualization shows exactly where time is spent — including network hops, queue wait times, and sequential vs. parallel calls."
        trade_off: "Full visibility into the request lifecycle with visual waterfall diagrams. Can identify network latency, serialization overhead, and connection pool exhaustion that logs alone would miss. But instrumenting 15 services takes 2-3 weeks, adds a dependency on tracing infrastructure, and introduces slight performance overhead (typically <2%). Requires buy-in from all 3 teams."
      - name: "Synthetic Transaction Profiling"
        description: "Build a synthetic checkout transaction that runs every 60 seconds, measuring end-to-end latency and latency at each hop. Use a simple script that calls each service in sequence, recording timestamps. Compare synthetic results with real user traffic to isolate whether the issue is load-dependent. Add network-level monitoring (VPC flow logs, ECS task metrics) to check for infrastructure bottlenecks."
        trade_off: "Can be built in days without modifying any service code. Quickly reveals whether the problem is load-dependent or constant. But synthetic transactions may not reproduce the exact conditions causing slowness (e.g., specific product combinations, cache misses). Doesn't provide per-request visibility for real user traffic. Best as a quick diagnostic tool, not a long-term observability solution."
interactive_cases:
  - title: "The Angry Customers Mystery"
    type: "great-unknown"
    difficulty: "⭐⭐"
    brief: "A VP of Engineering says 'We keep having outages and our customers are angry.' That's all they tell you. Your job is to ask the right questions to uncover the systemic issues causing repeated failures."
    opening: "Thanks for meeting with us. We're in trouble — we keep having outages and our customers are furious. We've had three major incidents in the last month and honestly, we don't even fully understand why. Can you help us figure out what's going on?"
    hidden_facts: "15 microservices on ECS. No circuit breakers. Services retry failed calls infinitely with no backoff. One slow database query in the user service cascades to all services. No distributed tracing. Monitoring is basic CloudWatch CPU/memory only. Last 3 outages were all cascading failures triggered by different root causes. Team of 8, no SRE."
---

## CAP Theorem

In a distributed system, you can't have everything. The **CAP theorem** states that when a network partition occurs, a distributed data store can guarantee at most **two of three** properties:

<div class="callout tip">
  <strong>Real-World Example:</strong> Amazon DynamoDB chose AP (availability + partition tolerance) by default — during a network partition, it continues serving requests even if some reads return slightly stale data. Google Spanner took the opposite approach, choosing CP (consistency + partition tolerance) by using synchronized atomic clocks (TrueTime) across data centers to guarantee globally consistent reads, accepting that writes may be rejected during partitions. DynamoDB suits shopping carts where availability matters most; Spanner suits financial ledgers where consistency is non-negotiable.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> Facebook (Meta) uses different consistency models for different features. News Feed uses eventual consistency — if a friend's post appears a few seconds late, nobody notices. But for Facebook Pay (money transfers), they use strong consistency to ensure balances are always accurate. For Messenger, they use causal consistency so replies always appear after the message they respond to, even across different data centers. This mix-and-match approach lets them optimize cost and performance per feature.
</div>

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

### Practical Consistency Patterns

Strong, eventual, and causal are the theoretical models. In practice, you rarely switch the whole system to strong consistency just because one user sees stale data. Instead, you apply **targeted patterns** that fix specific problems cheaply.

#### Read-Your-Own-Writes

The most common consistency complaint: "I updated my profile but when I refresh, I see the old data." This happens because the write goes to the primary, but the read hits a replica that hasn't caught up yet.

```text
User updates profile:
  Browser → API → Primary DB (write succeeds)

User refreshes page:
  Browser → API → Replica DB (still has old data!) ← stale read
```

The fix: after a user writes, route **that user's** subsequent reads to the primary (or a replica known to be up to date). Everyone else still reads from replicas.

<span class="label label-ts">TypeScript</span>

```typescript
class UserProfileService {
  constructor(
    private primaryDb: Database,
    private replicaDb: Database,
  ) {}

  async updateProfile(userId: string, data: ProfileUpdate) {
    await this.primaryDb.query("UPDATE users SET ... WHERE id = $1", [userId]);

    // Set a short-lived flag: "this user just wrote"
    await redis.set(`recent-write:${userId}`, "1", "EX", 10); // expires in 10 seconds
  }

  async getProfile(userId: string, requestingUserId: string) {
    // If the requesting user just wrote, read from primary
    const recentWrite = await redis.get(`recent-write:${requestingUserId}`);
    const db = recentWrite ? this.primaryDb : this.replicaDb;

    return db.query("SELECT * FROM users WHERE id = $1", [userId]);
  }
}
```

<span class="label label-py">Python</span>

```python
class UserProfileService:
    def __init__(self, primary_db, replica_db, redis_client):
        self.primary = primary_db
        self.replica = replica_db
        self.redis = redis_client

    async def update_profile(self, user_id: str, data: dict):
        await self.primary.execute("UPDATE users SET ... WHERE id = $1", user_id)
        # Flag this user as a recent writer for 10 seconds
        await self.redis.set(f"recent-write:{user_id}", "1", ex=10)

    async def get_profile(self, user_id: str, requesting_user_id: str):
        recent_write = await self.redis.get(f"recent-write:{requesting_user_id}")
        db = self.primary if recent_write else self.replica
        return await db.fetch_one("SELECT * FROM users WHERE id = $1", user_id)
```

The key insight: only the user who just wrote gets routed to the primary. Everyone else still reads from cheap, scalable replicas. You get the consistency where it matters without paying the cost everywhere.

```text
User who just updated:
  Browser → API → checks Redis → recent write found → Primary DB ✓ (fresh data)

Other users:
  Browser → API → checks Redis → no recent write → Replica DB (fast, scalable)
```

#### What If the Primary Goes Down?

Writes always go to the primary, with or without read-your-own-writes. If the primary fails, you can't write at all. That's a database-level concern, not an application-level one.

Most managed databases (RDS, Aurora, Cloud SQL) handle this with **automatic failover**: a replica gets promoted to primary, typically in 30 to 120 seconds.

```text
Normal:           Primary fails:         After failover:
Writes → Primary  Writes → ✗ (down)     Writes → Replica 1 (now Primary)
Reads  → Replicas Reads  → Replicas ✓   Reads  → Replica 2
```

During the failover window:

| Strategy | What happens | Best for |
|---|---|---|
| Fail writes, serve stale reads | Users can browse but not update | Read-heavy apps (catalogs) |
| Queue writes, process after recovery | Accept the write into a queue, apply later | Order placement |
| Return an error | "Service temporarily unavailable" | Honest, simple |

#### Alternatives That Avoid Reading From Primary

You don't always need to hit the primary after a write:

<span class="label label-ts">TypeScript</span>

```typescript
// Alternative 1: Return the data you just wrote (simplest)
async updateProfile(userId: string, data: ProfileUpdate) {
  const updated = await primary.query(
    "UPDATE users SET name = $1 WHERE id = $2 RETURNING *", [data.name, userId]
  );
  // Return fresh data directly. Client already has it. No read needed.
  return updated.rows[0];
}

// Alternative 2: Check if replica has caught up before reading
async getProfile(userId: string, requestingUserId: string) {
  const recentWrite = await redis.get(`recent-write:${requestingUserId}`);
  if (!recentWrite) {
    return replica.query("SELECT * FROM users WHERE id = $1", [userId]);
  }
  // Check replica lag instead of always hitting primary
  const lag = await replica.query("SELECT extract(epoch from now() - pg_last_xact_replay_timestamp())");
  if (lag.rows[0].extract < 1) { // less than 1 second behind
    return replica.query("SELECT * FROM users WHERE id = $1", [userId]);
  }
  return primary.query("SELECT * FROM users WHERE id = $1", [userId]);
}
```

<div class="callout tip">
  <strong>Alternative 1 (return what you wrote) is the simplest and most common.</strong> After a POST or PUT, return the created/updated resource in the response. The client already has fresh data without any read at all. Most REST APIs do this by default.
</div>

#### Monotonic Reads

A different problem: a user refreshes twice and sees data go *backwards*. First refresh hits replica A (up to date), second refresh hits replica B (behind). Their order count goes from 5 to 4 and back to 5.

The fix: pin a user to the same replica for the duration of their session. This is called **sticky sessions** or **session affinity**.

<span class="label label-ts">TypeScript</span>

```typescript
function getReplicaForUser(userId: string, replicas: Database[]): Database {
  // Simple consistent hash: same user always hits same replica
  const hash = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return replicas[hash % replicas.length];
}

async function getOrders(userId: string) {
  const replica = getReplicaForUser(userId, replicas);
  return replica.query("SELECT * FROM orders WHERE customer_id = $1", [userId]);
}
```

The user always reads from the same replica, so they never see data go backwards. Different users may see slightly different states, but each user's view is consistent with itself.

#### When to Use Which Pattern

| Problem | Pattern | How it works | Cost |
|---|---|---|---|
| "I updated but see old data" | Read-your-own-writes | Route writer's reads to primary for a few seconds | One Redis lookup per read |
| "Data goes backwards on refresh" | Monotonic reads | Pin user to same replica (sticky session) | Slightly uneven replica load |
| "Replies appear before the message" | Causal consistency | Track dependencies, deliver in order | Vector clocks or logical timestamps |
| "Balance must always be accurate" | Strong consistency | All reads go to primary | Slower reads, primary is bottleneck |

<div class="callout info">
  <strong>You can mix these per feature.</strong> Profile updates use read-your-own-writes. The activity feed uses eventual consistency. Payments use strong consistency. Each feature gets the cheapest consistency model that's correct for its use case.
</div>

---

## Consensus

In a distributed system, how do multiple nodes agree on a single value — like who the leader is, or what the next log entry should be?

<div class="callout tip">
  <strong>Real-World Example:</strong> Kubernetes relies on etcd, which implements the Raft consensus protocol, to store all cluster state — pod assignments, service configurations, secrets. When you run <code>kubectl apply</code>, the write must be agreed upon by a majority of etcd nodes before it's committed. This is why Kubernetes control planes run 3 or 5 etcd nodes: with 3 nodes, the cluster tolerates 1 failure; with 5, it tolerates 2. If a majority of etcd nodes go down, the cluster can still run existing workloads but can't schedule new ones.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> Shopify ran one of the largest Ruby on Rails monoliths in the world, serving millions of merchants. Rather than jumping to microservices, they adopted a "modular monolith" approach — splitting the codebase into well-defined components with enforced boundaries, while keeping it as a single deployable unit. They only extracted services (like their Storefront Renderer) when a specific component had a clear, proven need for independent scaling. This avoided the operational overhead of microservices while still achieving team autonomy.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> Netflix built Eureka, an open-source service discovery tool, because their AWS-based microservices architecture (600+ services) needed instances to find each other as they constantly scaled up and down. Each service registers itself with Eureka on startup and queries it to find other services. Combined with their client-side load balancer Ribbon, this let Netflix handle millions of concurrent streams even as individual instances were replaced every few hours due to auto-scaling and chaos engineering experiments.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> Netflix developed Hystrix after a major outage where a single failing microservice caused cascading failures across their entire streaming platform. Hystrix wrapped every inter-service call in a circuit breaker: when a downstream service's error rate exceeded a threshold, the circuit opened and immediately returned a fallback response (e.g., a cached recommendation list instead of a personalized one). This meant a failing recommendations service degraded the experience gracefully instead of taking down the entire app. Hystrix is now in maintenance mode, succeeded by Resilience4j, but the pattern it popularized is standard practice.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> An engineering team at a fintech company noticed intermittent 2-second latency spikes on their checkout API but couldn't reproduce them locally. By implementing distributed tracing with Jaeger and propagating trace IDs across their 8 microservices, they discovered that a downstream fraud-detection service was occasionally making a synchronous call to a third-party API that timed out. The trace waterfall showed the exact span where the delay occurred. They added a circuit breaker with a cached fallback, reducing p99 latency from 3.2 seconds to 400 milliseconds.
</div>

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

### Observability Tools in Practice

The observability ecosystem splits into open-source, self-hosted tools and fully managed cloud services. Open-source gives you control and avoids vendor lock-in. Managed services reduce operational burden but cost more at scale.

| Category | Open Source | Cloud Managed | What It Does |
|---|---|---|---|
| **Logging** | ELK Stack (Elasticsearch + Logstash + Kibana), Grafana Loki | CloudWatch Logs, Datadog Logs | Collects, indexes, and searches discrete event records from your services |
| **Metrics** | Prometheus + Grafana | CloudWatch Metrics, Datadog | Aggregates numeric time-series data: counters, gauges, histograms |
| **Tracing** | Jaeger, Zipkin | AWS X-Ray, Datadog APM | Tracks a single request as it flows across service boundaries, showing latency per span |
| **All-in-One** | Grafana Stack (Loki + Prometheus + Tempo + Grafana) | Datadog, New Relic | Unified platform covering logs, metrics, and traces in a single UI |

<div class="callout info">
<strong>OpenTelemetry (OTel)</strong> is the vendor-neutral, CNCF-backed standard for instrumentation. You instrument your code once with the OTel SDK, then export telemetry data to any backend: Jaeger, Prometheus, Datadog, or any other OTel-compatible collector. This means you can switch observability vendors without changing application code. OTel covers traces, metrics, and logs with a single set of APIs.
</div>

### Setting Up a Practical Observability Stack

A production-ready observability stack needs three things: trace collection, metrics scraping, and a way to view both. Here is a concrete setup using OpenTelemetry.

**Architecture:**

```
Your App (OTel SDK)
    ├── traces  → OTel Collector → Jaeger (view in browser at :16686)
    └── metrics → OTel Collector → Prometheus (scrape at :9090) → Grafana (:3000)
```

**Step 1: Install the OpenTelemetry SDK**

<span class="label label-ts">TypeScript</span>

```bash
npm install @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http
```

**Step 2: Create the tracing setup file**

<span class="label label-ts">TypeScript</span>, `tracing.ts`: load this file before your app starts.

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

const sdk = new NodeSDK({
  serviceName: "order-service",
  traceExporter: new OTLPTraceExporter({
    url: "http://otel-collector:4318/v1/traces",
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: "http://otel-collector:4318/v1/metrics",
    }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Auto-instruments HTTP, Express, pg, mysql, redis, and more
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();
process.on("SIGTERM", () => sdk.shutdown());
```

**Step 3: Start your app with tracing enabled**

```bash
node --require ./tracing.js dist/server.js
```

This auto-instruments all HTTP requests, Express routes, and database calls without any code changes to your route handlers.

**Step 4: How a trace looks in Jaeger**

When a request hits your API gateway and flows through multiple services, Jaeger displays a waterfall of spans:

```
Trace: abc-123-def-456                                    Duration: 245ms
├── [order-service] POST /api/orders                      ├─────────────────────────────┤ 245ms
│   ├── [order-service] middleware: auth                   ├──┤ 12ms
│   ├── [order-service] pg.query: INSERT INTO orders       ├────┤ 35ms
│   ├── [payment-service] POST /api/payments               ├──────────────┤ 120ms
│   │   ├── [payment-service] pg.query: SELECT balance      ├──┤ 8ms
│   │   └── [payment-service] HTTP POST stripe.com/charge    ├────────┤ 95ms
│   └── [inventory-service] PUT /api/stock                   ├─────┤ 45ms
│       └── [inventory-service] redis.decrby: stock:sku-42    ├─┤ 3ms
```

Each bar is a **span**. The parent-child nesting shows you exactly where time is spent. In this example, the Stripe API call dominates latency at 95ms.

<span class="label label-py">Python</span>, FastAPI + OpenTelemetry equivalent:

```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install
```

```python
# tracing_setup.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

resource = Resource.create({"service.name": "order-service"})
provider = TracerProvider(resource=resource)
provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4318/v1/traces"))
)
trace.set_tracer_provider(provider)

def instrument_app(app):
    FastAPIInstrumentor.instrument_app(app)
```

```python
# main.py
from fastapi import FastAPI
from tracing_setup import instrument_app

app = FastAPI()
instrument_app(app)

@app.get("/api/orders/{order_id}")
async def get_order(order_id: str):
    return {"order_id": order_id, "status": "confirmed"}
```

```bash
opentelemetry-instrument python main.py
```

### Metrics: What to Measure

Not everything that can be measured should be. Two frameworks help you focus on what matters.

**RED Method** (for request-driven services):

| Signal | What to Measure | Example |
|---|---|---|
| **R**ate | Requests per second | `http_requests_total` |
| **E**rrors | Failed requests per second | `http_errors_total` or requests with status >= 500 |
| **D**uration | Latency distribution per request | `http_request_duration_seconds` histogram |

**USE Method** (for infrastructure resources like CPU, memory, disks, network):

| Signal | What to Measure | Example |
|---|---|---|
| **U**tilization | Percentage of resource capacity in use | CPU at 78% |
| **S**aturation | Amount of queued or deferred work | Thread pool queue depth of 340 |
| **E**rrors | Count of error events on the resource | Disk I/O errors, network packet drops |

**The Four Golden Signals** (from Google's SRE book) combine both perspectives:

1. **Latency**: how long requests take. Track p50, p95, and p99 separately. A healthy average can hide a terrible tail.
2. **Traffic**: demand on your system. Requests per second, concurrent connections, or messages consumed per second.
3. **Errors**: the rate of failed requests, whether explicit (HTTP 500) or implicit (HTTP 200 with wrong content, or responses slower than an SLO threshold).
4. **Saturation**: how "full" your service is. Queue depths, memory usage, thread pool exhaustion. Saturation predicts problems before they cause errors.

<span class="label label-ts">TypeScript</span>, Prometheus metrics with OpenTelemetry:

```typescript
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("order-service");

const requestCounter = meter.createCounter("http_requests_total", {
  description: "Total HTTP requests",
});

const requestDuration = meter.createHistogram("http_request_duration_seconds", {
  description: "HTTP request duration in seconds",
  unit: "s",
});

const errorCounter = meter.createCounter("http_errors_total", {
  description: "Total HTTP errors (status >= 500)",
});

// Use in Express middleware
function metricsMiddleware(req, res, next) {
  const start = performance.now();
  res.on("finish", () => {
    const duration = (performance.now() - start) / 1000;
    const labels = { method: req.method, path: req.route?.path || req.path, status: String(res.statusCode) };
    requestCounter.add(1, labels);
    requestDuration.record(duration, labels);
    if (res.statusCode >= 500) errorCounter.add(1, labels);
  });
  next();
}
```

### Alerting Strategy

Good alerts wake you up for the right reasons. Bad alerts train you to ignore your pager.

**Alert on symptoms, not causes.** A high CPU alert tells you something is busy, but it does not tell you if users are affected. Instead, alert on what users experience: high error rate, elevated latency, or dropped requests. CPU is a diagnostic signal you check after the alert fires.

<div class="callout">
<strong>Rule of thumb:</strong> if an alert fires and no user is affected, it should not be paging you. Make it a low-priority ticket instead.
</div>

**SLIs, SLOs, and SLAs:**

| Term | Definition | Example |
|---|---|---|
| **SLI** (Service Level Indicator) | A measurable metric of service quality | 95th percentile latency of the /checkout endpoint |
| **SLO** (Service Level Objective) | A target value for an SLI, set internally | p95 latency < 300ms, measured over a 30-day rolling window |
| **SLA** (Service Level Agreement) | A contractual commitment with consequences for missing it | 99.9% availability per month, or the customer gets service credits |

The relationship: SLIs are what you measure. SLOs are the targets you set. SLAs are the promises you make to customers (and SLOs should be stricter than SLAs to give you a safety margin).

**Error Budgets:**

An error budget is the inverse of your SLO. If your SLO is 99.9% availability over 30 days, your error budget is 0.1%, which equals roughly 43 minutes of downtime per month.

- While you have budget remaining, ship features and take risks.
- When the budget is nearly exhausted, freeze deployments and focus on reliability.
- Error budgets align product and engineering teams. Product wants to ship fast. Engineering wants stability. The error budget gives both sides a shared, objective threshold.

### Dashboards

A good service dashboard answers one question: "Is this service healthy right now?" Build it around the golden signals.

**What to include on every service dashboard:**

| Section | Panels | Why |
|---|---|---|
| **Request Rate** | Requests/sec by endpoint, by status code | Shows traffic patterns and whether demand is normal |
| **Error Rate** | Errors/sec, error percentage (errors / total) | The single most important health signal |
| **Latency** | p50, p95, p99 response time | p50 shows typical experience, p99 shows worst-case. Both matter. |
| **Saturation** | Queue depth, connection pool usage, thread pool active/max, memory usage | Predicts failures before they happen |
| **Dependencies** | Downstream service error rate and latency | Your service is only as healthy as its dependencies |

<div class="callout tip">
<strong>Dashboard tips:</strong> Use Grafana with Prometheus as the data source. Set consistent time ranges (last 1 hour by default). Add annotation markers for deployments so you can correlate changes with metric shifts. Keep dashboards to 8-12 panels. If you need more, split into overview and deep-dive dashboards.
</div>

**Example Grafana dashboard JSON snippet** (request rate panel):

```json
{
  "title": "Request Rate",
  "type": "timeseries",
  "datasource": "Prometheus",
  "targets": [
    {
      "expr": "sum(rate(http_requests_total{service=\"order-service\"}[5m])) by (status)",
      "legendFormat": "{{status}}"
    }
  ]
}
```

**Example Prometheus alerting rule** (error rate SLO breach):

```yaml
groups:
  - name: order-service-slos
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_errors_total{service="order-service"}[5m]))
          / sum(rate(http_requests_total{service="order-service"}[5m]))
          > 0.001
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Order service error rate exceeds 0.1% SLO"
          description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes."
```

---

## SOA vs Microservices

Before microservices became the default conversation, there was **SOA (Service-Oriented Architecture)**. Understanding where SOA came from helps you understand why microservices exist, and when SOA patterns are still the right choice.

### SOA: The Original Service Architecture

SOA emerged in the early 2000s as a way to break large enterprise systems into services that could be reused across the organization. The defining feature is the **Enterprise Service Bus (ESB)**, a centralized middleware layer that handles routing, message transformation, protocol translation, and orchestration between services.

Services in SOA tend to be **large and coarse-grained**. A single "Customer Service" might handle registration, profile management, authentication, and preferences. The ESB sits in the middle, directing traffic and enforcing standards.

```text
Service A ──┐
Service B ──┤── Enterprise Service Bus (ESB) ──┤── Service D
Service C ──┘                                   └── Service E
```

### Microservices: The Evolution

Microservices evolved from SOA, keeping the idea of service boundaries but removing the centralized bus. Each service is **small, independently deployable, and owns its own data**. Communication happens directly between services via HTTP, gRPC, or events, with no central orchestrator.

```text
Service A ──→ Service B (HTTP)
Service A ──→ Service C (gRPC)
Service B ──→ Service D (events via message queue)
```

### Key Differences

| | SOA | Microservices |
|---|---|---|
| Service size | Large, coarse-grained | Small, fine-grained |
| Communication | ESB (centralized) | Direct HTTP/gRPC/events (decentralized) |
| Data | Often shared database | Each service owns its data |
| Governance | Centralized standards | Decentralized, team autonomy |
| Deployment | Often deployed together | Independent deployment |
| Best era | 2000s enterprise | 2010s+ cloud-native |

### When You'd Still See SOA

SOA is not dead. You will encounter it in:

- **Large enterprises with legacy systems.** Banks, insurers, and government agencies invested heavily in ESB infrastructure (IBM WebSphere, MuleSoft, Oracle Service Bus). Ripping that out is expensive and risky.
- **Regulated industries.** Centralized governance through an ESB makes it easier to enforce compliance, audit trails, and data standards across all services.
- **Organizations that need shared data contracts.** When dozens of teams must agree on canonical data formats, a centralized bus that enforces schemas can reduce integration chaos.

<div class="callout">
<strong>Microservices are not always better than SOA.</strong> If your organization needs centralized governance and shared data standards, SOA patterns may be more appropriate.
</div>

---

## The Actor Model

The **actor model** is a concurrency model where the fundamental unit of computation is an **actor**: an independent entity that communicates with other actors only via messages. No shared state, no locks.

### What Is an Actor?

Each actor has three things:

1. **A mailbox** (message queue): incoming messages are queued and processed one at a time
2. **State** (private): only the actor can read or modify its own state
3. **Behavior** (message handler): defines how the actor processes each message

When an actor receives a message, it can: update its own state, send messages to other actors, or create new actors. It never directly accesses another actor's state.

```text
Actor A ──message──→ [Mailbox] → Actor B (processes one message at a time)
                                   ├── updates own state
                                   ├── sends message to Actor C
                                   └── creates new Actor D
```

### How It Differs from Traditional Threading

| | Traditional Threads | Actor Model |
|---|---|---|
| State | Shared memory between threads | Private to each actor |
| Synchronization | Locks, mutexes, semaphores | No locks needed |
| Communication | Read/write shared variables | Message passing only |
| Failure mode | Deadlocks, race conditions | Message delivery failures |
| Mental model | "Protect shared data" | "Send messages, don't share" |

### Where You See It

- **Erlang/Elixir**: the language was built around actors. WhatsApp handled 2 million connections per server using Erlang actors. Discord uses Elixir for real-time messaging.
- **Akka (JVM)**: actor framework for Java/Scala. Used in high-throughput financial systems and IoT platforms.
- **Microsoft Orleans (.NET)**: "virtual actors" (grains) for cloud-native .NET applications. Used in Halo's game services.

### Conceptual Example

<span class="label label-ts">TypeScript</span>, a simplified actor that processes messages from a mailbox:

```typescript
type Message = { type: string; payload: unknown };
type Behavior = (state: unknown, message: Message) => unknown;

class Actor {
  private mailbox: Message[] = [];
  private processing = false;

  constructor(
    private state: unknown,
    private behavior: Behavior,
  ) {}

  send(message: Message) {
    this.mailbox.push(message);
    this.processNext();
  }

  private processNext() {
    if (this.processing || this.mailbox.length === 0) return;
    this.processing = true;
    const message = this.mailbox.shift()!;
    this.state = this.behavior(this.state, message);
    this.processing = false;
    this.processNext();
  }
}

// Usage: a chat session actor
const chatActor = new Actor({ messages: [] as string[] }, (state: any, msg: Message) => {
  if (msg.type === "NEW_MESSAGE") {
    return { messages: [...state.messages, msg.payload] };
  }
  return state;
});

chatActor.send({ type: "NEW_MESSAGE", payload: "Hello!" });
chatActor.send({ type: "NEW_MESSAGE", payload: "How are you?" });
```

Each actor processes one message at a time. No locks, no race conditions. If you need concurrency, you create more actors, not more threads.

### When to Use

- **High concurrency**: millions of simultaneous connections or sessions
- **Real-time systems**: chat, gaming, live collaboration
- **IoT**: each device or sensor as an actor
- **Systems where isolation matters**: one actor crashing should not bring down others

### When Not to Use

- **Simple CRUD applications**: the overhead of actors is not justified when a straightforward request/response model works fine
- **When you don't have concurrency problems**: if your system handles requests sequentially or at low volume, actors add complexity without benefit

<div class="callout tip">
<strong>Real-world scale:</strong> WhatsApp handled 2 million connections per server using Erlang actors. Each chat session was an actor with its own state and mailbox. No shared memory, no locks, no race conditions.
</div>

---


## Resilience Patterns

Beyond circuit breakers, distributed systems need multiple strategies to handle overload and failure. Each pattern addresses a different failure mode.

### Backpressure

When a service receives more requests than it can process, it needs to signal upstream to slow down. Without backpressure, an unbounded queue grows until the service runs out of memory and crashes.

```text
Without backpressure:
  Producer (fast) → [queue grows forever] → Consumer (slow) → OOM crash

With backpressure:
  Producer (fast) → [bounded queue, rejects when full] → Consumer (slow)
                  ← 429 / rejection signal ←
```

<span class="label label-ts">TypeScript</span> -- bounded queue with backpressure:

```typescript
class BoundedQueue<T> {
  private queue: T[] = [];

  constructor(private maxSize: number) {}

  enqueue(item: T): boolean {
    if (this.queue.length >= this.maxSize) return false; // reject
    this.queue.push(item);
    return true;
  }

  dequeue(): T | undefined {
    return this.queue.shift();
  }

  get size() { return this.queue.length; }
}

// Usage in a request handler
const taskQueue = new BoundedQueue<Request>(1000);

app.post("/jobs", (req, res) => {
  if (!taskQueue.enqueue(req)) {
    return res.status(429).json({ error: "Server overloaded, try again later" });
  }
  res.status(202).json({ status: "queued" });
});
```

An unbounded queue (a plain array with no limit) accepts everything. Under sustained load, it grows until the process runs out of memory. A bounded queue forces the system to reject work it cannot handle, keeping the service alive for the requests it can process.

### Throttling / Rate Limiting

Throttling limits how many requests a client can make in a given time window. This protects your service from a single client consuming all available capacity.

The **token bucket** algorithm is one of the most common approaches: a bucket holds tokens, each request consumes one, and tokens refill at a fixed rate.

<span class="label label-ts">TypeScript</span> -- token bucket rate limiter:

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Per-client rate limiting
const buckets = new Map<string, TokenBucket>();

function getOrCreateBucket(clientId: string): TokenBucket {
  if (!buckets.has(clientId)) {
    buckets.set(clientId, new TokenBucket(100, 10)); // 100 burst, 10/sec refill
  }
  return buckets.get(clientId)!;
}

app.use((req, res, next) => {
  const clientId = req.headers["x-api-key"] as string || req.ip!;
  if (!getOrCreateBucket(clientId).consume()) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  next();
});
```

<div class="callout tip">
  <strong>In production:</strong> Use API Gateway throttling (AWS API Gateway, Kong, NGINX) instead of application-level rate limiting. API Gateway throttling runs at the edge, rejecting excess traffic before it reaches your service. This protects against DDoS and reduces load on your backend.
</div>

### Graceful Degradation

When a dependency fails, serve a reduced experience instead of failing completely. The core functionality still works; only the non-critical parts degrade.

**Example:** A product page depends on a recommendations service. When that service is down, the page still loads with product details, pricing, and inventory. The recommendations section falls back to cached popular items instead of personalized results.

<span class="label label-ts">TypeScript</span> -- graceful degradation with fallback:

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
}

async function getRecommendations(userId: string): Promise<Product[]> {
  try {
    const res = await fetch(`http://recommendations-svc/for/${userId}`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return res.json();
  } catch {
    // Fallback: return cached popular items instead of personalized results
    return getCachedPopularItems();
  }
}

async function getCachedPopularItems(): Promise<Product[]> {
  const cached = await redis.get("popular-items");
  return cached ? JSON.parse(cached) : [];
}

// Product page handler
app.get("/products/:id", async (req, res) => {
  const [product, recommendations] = await Promise.all([
    getProduct(req.params.id),                    // critical: must succeed
    getRecommendations(req.user.id),              // non-critical: can degrade
  ]);

  res.json({
    product,
    recommendations,
    recommendationsSource: recommendations.length ? "personalized" : "popular",
  });
});
```

The key insight: classify each dependency as critical or non-critical. Critical failures (product data, pricing) return an error. Non-critical failures (recommendations, reviews) return a degraded response.

### Load Shedding

Under extreme load, intentionally drop low-priority requests to protect critical paths. This is different from rate limiting: rate limiting caps per-client usage, while load shedding drops requests system-wide based on priority.

<span class="label label-ts">TypeScript</span> -- priority-based load shedding:

```typescript
type Priority = "critical" | "normal" | "low";

function getPriority(req: Request): Priority {
  if (req.path.startsWith("/api/checkout")) return "critical";
  if (req.path.startsWith("/api/search")) return "normal";
  return "low";
}

function loadShedding(currentLoad: () => number, maxLoad: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const load = currentLoad();
    const priority = getPriority(req);

    // At 90%+ load, drop low-priority requests
    if (load > maxLoad * 0.9 && priority === "low") {
      return res.status(503).json({ error: "Service busy, try again later" });
    }
    // At 95%+ load, drop normal-priority requests too
    if (load > maxLoad * 0.95 && priority === "normal") {
      return res.status(503).json({ error: "Service busy, try again later" });
    }
    // Critical requests always get through
    next();
  };
}

// Usage with a simple load metric (active connections)
let activeConnections = 0;
app.use(loadShedding(() => activeConnections, 1000));
app.use((req, res, next) => {
  activeConnections++;
  res.on("finish", () => activeConnections--);
  next();
});
```

### Comparison

| Pattern | What it does | When to use |
|---|---|---|
| **Backpressure** | Rejects new work when the queue is full, signaling upstream to slow down | Service is processing slower than requests arrive |
| **Throttling / Rate Limiting** | Caps requests per client to a fixed rate | Protecting against abusive or misconfigured clients |
| **Graceful Degradation** | Returns a reduced response when a dependency fails | Non-critical features that can fall back to cached or default data |
| **Load Shedding** | Drops low-priority requests under extreme load | Protecting critical paths (checkout, payments) during traffic spikes |

<div class="callout info">
  <strong>These patterns complement each other.</strong> A production system typically uses rate limiting at the API gateway, backpressure on internal queues, circuit breakers on downstream calls, graceful degradation for non-critical features, and load shedding as a last resort under extreme load.
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
8. **Resilience patterns** — use backpressure, throttling, graceful degradation, and load shedding together to handle overload and partial failures

## Check Your Understanding

{{< quiz >}}

## Scenario Challenges

{{< case-studies >}}

## Interactive Case Studies

{{< interactive-cases >}}