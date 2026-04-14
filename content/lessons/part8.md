---
title: "Part 8: System Design Practice"
weight: 8
summary: "The capstone — design real systems end-to-end by combining every pattern from Parts 1–7."
quiz:
  - question: "Design a URL shortening service like bit.ly. Walk through requirements, API design, storage, encoding, caching, and how you would scale it to handle 100M URLs."
    concepts:
      - label: "URL Shortener Design"
        terms: ["short URL", "base62 encoding", "hash collision", "301 redirect", "read-heavy workload", "key-value store", "cache-aside"]
  - question: "Design a real-time chat application that supports one-on-one and group messaging for millions of concurrent users. Discuss connection management, message delivery guarantees, storage, and presence."
    concepts:
      - label: "Chat System Design"
        terms: ["WebSocket", "real-time messaging", "presence service", "fan-out", "message queue", "horizontal scaling", "connection gateway"]
  - question: "Design an e-commerce order processing system that handles checkout, payment, inventory reservation, and shipping notifications. Explain how you would use event-driven architecture and sagas to maintain consistency."
    concepts:
      - label: "Order System Design"
        terms: ["saga pattern", "event-driven architecture", "CQRS", "eventual consistency", "compensating transaction", "idempotency", "domain events"]
  - question: "You are designing a system that must serve 50,000 requests per second with sub-100ms p99 latency. Walk through your capacity estimation, caching strategy, data partitioning approach, and how you would handle failure scenarios."
    concepts:
      - label: "Capacity & Scaling"
        terms: ["capacity estimation", "horizontal scaling", "sharding", "cache-aside", "circuit breaker", "load balancing", "back-of-envelope"]
  - question: "Compare designing a system for strong consistency versus eventual consistency. Pick a concrete example for each, explain the trade-offs, and describe which architectural patterns you would apply."
    concepts:
      - label: "Consistency Trade-offs"
        terms: ["CAP theorem", "strong consistency", "eventual consistency", "two-phase commit", "saga", "CQRS", "event sourcing", "trade-off analysis"]
---

# Part 8: System Design Practice

This is the capstone. Everything from Parts 1–7 — domain modelling, messaging patterns, CQRS, event sourcing, microservices, observability, resilience — converges here. We will walk through designing three real systems end-to-end, then distil the patterns into a cheat sheet you can reference in interviews and on the job.

<div class="callout info">
This part is deliberately opinionated. Real system design has no single correct answer — but it does have a <strong>process</strong>. Follow the process, justify your decisions, and you will arrive at a defensible design every time.
</div>

---

## 1. The System Design Process

Every design — whether on a whiteboard, in a design doc, or in an interview — follows the same five-phase loop:

### Phase 1: Requirements Gathering

Separate **functional requirements** (what the system does) from **non-functional requirements** (how well it does it).

| Category | Example Questions |
|---|---|
| Functional | What are the core use cases? Who are the actors? What data flows in and out? |
| Non-functional | What latency is acceptable? What availability target (99.9 %? 99.99 %)? What consistency model? |
| Constraints | Budget? Team size? Existing tech stack? Regulatory requirements (GDPR, PCI-DSS)? |

<div class="callout tip">
Always ask clarifying questions first. The biggest mistake is jumping straight to boxes and arrows before understanding what you are building.
</div>

### Phase 2: Capacity Estimation (Back-of-Envelope)

Rough numbers keep you honest. A system serving 100 reads/sec has very different needs from one serving 100K reads/sec.

```
Daily active users (DAU):    10 M
Writes per user per day:     2
Total writes/day:            20 M  → ~230 writes/sec
Read:write ratio:            10:1  → ~2,300 reads/sec
Average object size:         500 bytes
Storage per year:            20 M × 365 × 500 B ≈ 3.65 TB
```

### Phase 3: High-Level Design

Draw the major components: clients, load balancers, API gateways, services, databases, caches, queues. Show the data flow for the primary use case.

### Phase 4: Deep Dives

Pick the 2–3 most interesting or risky components and zoom in. This is where you discuss:

- Data model and schema design
- API contracts
- Partitioning / sharding strategy
- Caching layers
- Consistency and failure handling

### Phase 5: Trade-off Discussion

No design is perfect. Explicitly state what you traded away and why:

- Consistency vs. availability
- Latency vs. durability
- Simplicity vs. scalability
- Cost vs. performance

---

## 2. Design: URL Shortener

### Requirements

**Functional:**
- Given a long URL, generate a short, unique alias (e.g. `https://sho.rt/abc123`)
- Redirecting to the short URL returns the original URL
- Optional: custom aliases, expiration, analytics

**Non-functional:**
- Very read-heavy (100:1 read-to-write ratio)
- Low-latency redirects (< 50 ms p99)
- High availability — a broken redirect is a broken link
- 100 M new URLs per month

### Capacity Estimation

```
Writes:  100 M / month ≈ ~40 writes/sec
Reads:   100:1 → ~4,000 reads/sec
Storage: 100 M × 12 months × 5 years × 500 B ≈ 3 TB
```

### API Design

<span class="label label-ts">TypeScript</span>

```typescript
// Create short URL
POST /api/v1/urls
Body: { "longUrl": "https://example.com/very/long/path", "customAlias?": "my-link", "expiresAt?": "2027-01-01T00:00:00Z" }
Response 201: { "shortUrl": "https://sho.rt/abc123", "longUrl": "...", "expiresAt": "..." }

// Redirect
GET /:shortCode → 301 Redirect to longUrl

// Analytics (optional)
GET /api/v1/urls/:shortCode/stats
Response 200: { "totalClicks": 48210, "createdAt": "...", "lastAccessedAt": "..." }
```

### Encoding Strategy

We need short, unique keys. Options:

| Approach | Pros | Cons |
|---|---|---|
| MD5/SHA-256 hash + truncate | Simple, deterministic | Collisions on truncation |
| Base62 counter | No collisions, short | Requires distributed counter |
| Pre-generated key pool | Fast, no collision | Requires key management service |

**Chosen: Base62 with a distributed counter** (e.g. Twitter Snowflake-style ID → base62 encode). A 7-character base62 string gives 62⁷ ≈ 3.5 trillion unique keys — more than enough.

```typescript
function toBase62(id: bigint): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  while (id > 0n) {
    result = chars[Number(id % 62n)] + result;
    id = id / 62n;
  }
  return result.padStart(7, '0');
}
```

### Database Choice

Read-heavy, simple key-value lookups → **DynamoDB** or **Cassandra**.

Schema (DynamoDB):

| Attribute | Type | Role |
|---|---|---|
| `shortCode` | String | Partition key |
| `longUrl` | String | |
| `createdAt` | Number | |
| `expiresAt` | Number | TTL attribute |
| `userId` | String | GSI for user lookups |

### Caching

Place a **cache-aside** layer (Redis/Memcached) in front of the database. The top 20 % of URLs likely account for 80 % of traffic (Zipf distribution).

Cache policy: **Read-through with TTL**. On redirect, check cache first → on miss, read from DB and populate cache.

### Architecture Diagram

<div class="diagram">

```
┌──────────┐       ┌──────────────┐       ┌───────────────┐
│  Client   │──────▶│  Load        │──────▶│  API Service  │
│ (Browser) │◀──301─│  Balancer    │       │  (Stateless)  │
└──────────┘       └──────────────┘       └──────┬────────┘
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              ┌──────────┐  ┌──────────┐  ┌──────────────┐
                              │  Redis   │  │ DynamoDB  │  │  ID Counter  │
                              │  Cache   │  │ (URLs)    │  │  (Snowflake) │
                              └──────────┘  └──────────┘  └──────────────┘
                                    │
                                    ▼
                              ┌──────────────┐
                              │  Analytics   │
                              │  (Async via  │
                              │   Kafka)     │
                              └──────────────┘
```

</div>

### Scaling Considerations

- **Stateless API servers** behind a load balancer — scale horizontally.
- **DynamoDB on-demand** scales reads/writes automatically.
- **Redis cluster** with consistent hashing for cache sharding.
- **Analytics decoupled** via Kafka — redirect latency is not affected by analytics writes.

---

## 3. Design: Chat Application

### Requirements

**Functional:**
- One-on-one and group messaging
- Sent / delivered / read receipts
- Online/offline presence indicators
- Message history and search

**Non-functional:**
- Real-time delivery (< 200 ms)
- 10 M concurrent connections
- Messages must not be lost (at-least-once delivery)
- 99.99 % availability

### Capacity Estimation

```
Concurrent users:     10 M
Messages/user/day:    40
Total messages/day:   400 M → ~4,600 messages/sec
Average message size: 200 bytes
Storage/year:         400 M × 365 × 200 B ≈ 29 TB
```

### Connection Management — WebSockets

HTTP polling is too expensive at 10 M users. **WebSockets** give us persistent, bidirectional connections.

<span class="label label-ts">TypeScript</span>

```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws, req) => {
  const userId = authenticate(req);
  ConnectionRegistry.register(userId, ws);

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    MessageRouter.route(userId, msg);
  });

  ws.on('close', () => {
    ConnectionRegistry.unregister(userId);
    PresenceService.setOffline(userId);
  });
});
```

<span class="label label-py">Python</span>

```python
import asyncio
import websockets

connected: dict[str, websockets.WebSocketServerProtocol] = {}

async def handler(ws: websockets.WebSocketServerProtocol):
    user_id = await authenticate(ws)
    connected[user_id] = ws
    try:
        async for raw in ws:
            msg = json.loads(raw)
            await route_message(user_id, msg)
    finally:
        del connected[user_id]
        await set_offline(user_id)

asyncio.run(websockets.serve(handler, "0.0.0.0", 8080))
```

### Message Storage

Messages are **write-heavy** and queried by conversation + time range → **Cassandra** is a natural fit.

```
Partition key:  conversation_id
Clustering key: message_timestamp (DESC)
```

This gives efficient queries like "last 50 messages in conversation X" as a single partition scan.

### Presence Service

Presence (online/offline/typing) is **ephemeral** — use **Redis** with TTL-based heartbeats.

```
SETEX  presence:{userId}  30  "online"     # expires in 30s
```

Clients send a heartbeat every 20 seconds. If the key expires, the user is offline.

### Fan-Out for Group Messages

For a group message, the server must deliver to all online members. Two strategies:

| Strategy | When to Use |
|---|---|
| **Fan-out on write** | Small groups (< 500 members) — write a copy to each member's queue |
| **Fan-out on read** | Large groups / channels — members pull from a shared timeline |

For most chat apps, **fan-out on write** for groups up to a few hundred members, with a shared channel model for very large groups.

### Architecture Diagram

<div class="diagram">

```
┌──────────┐    WebSocket     ┌─────────────────┐
│  Mobile  │─────────────────▶│  Connection      │
│  / Web   │◀────────────────│  Gateway (N nodes)│
└──────────┘                  └────────┬─────────┘
                                       │
                         ┌─────────────┼──────────────┐
                         ▼             ▼              ▼
                  ┌────────────┐ ┌──────────┐  ┌────────────┐
                  │  Message   │ │ Presence │  │  Group     │
                  │  Service   │ │ Service  │  │  Service   │
                  └─────┬──────┘ └────┬─────┘  └─────┬──────┘
                        │             │              │
                  ┌─────▼──────┐ ┌────▼─────┐       │
                  │ Cassandra  │ │  Redis   │       │
                  │ (Messages) │ │(Presence)│       │
                  └────────────┘ └──────────┘       │
                        │                           │
                        ▼                           ▼
                  ┌──────────────────────────────────────┐
                  │         Kafka / Message Bus           │
                  │  (cross-node delivery, notifications) │
                  └──────────────────────────────────────┘
```

</div>

### Scaling to Millions

- **Connection Gateways** are stateful (hold WebSocket connections) — scale by adding nodes. Use a **service registry** so the Message Service knows which gateway holds which user.
- **Kafka** bridges gateways: if User A is on Gateway-1 and User B is on Gateway-2, the message routes through Kafka.
- **Cassandra** scales linearly by adding nodes — no single point of failure.

<div class="callout">
The hardest part of chat at scale is not message storage — it is <strong>connection routing</strong>. Knowing which of 200 gateway nodes holds a given user's WebSocket is the core coordination problem.
</div>

---

## 4. Design: E-Commerce Order System

This design deliberately references patterns from earlier parts to show how they compose in a real system.

### Requirements

**Functional:**
- Browse products, add to cart, checkout
- Process payment, reserve inventory, confirm order
- Send notifications (email, push) at each stage
- Handle failures gracefully (payment fails → release inventory)

**Non-functional:**
- No overselling (inventory accuracy)
- Eventual consistency is acceptable between services
- Audit trail for every order state change
- 10K orders/minute at peak

### Order Flow — The Saga Pattern

A checkout spans multiple services. We use a **choreography-based saga** (see Part 5) where each service reacts to domain events:

```
1. OrderService  → publishes  OrderCreated
2. PaymentService  → listens for OrderCreated → charges card → publishes PaymentCompleted
3. InventoryService → listens for PaymentCompleted → reserves stock → publishes InventoryReserved
4. NotificationService → listens for InventoryReserved → sends confirmation email
```

**Compensating transactions** handle failures:

```
PaymentFailed  → OrderService cancels order
InventoryFailed → PaymentService issues refund → OrderService cancels order
```

<span class="label label-ts">TypeScript</span>

```typescript
// Order aggregate with event sourcing (see Part 4)
class Order {
  private status: OrderStatus = 'CREATED';
  private events: DomainEvent[] = [];

  checkout(cart: Cart, paymentMethod: PaymentMethod): void {
    this.apply(new OrderCreated(this.id, cart.items, paymentMethod));
  }

  confirmPayment(transactionId: string): void {
    if (this.status !== 'CREATED') throw new InvalidStateError();
    this.apply(new PaymentConfirmed(this.id, transactionId));
  }

  cancel(reason: string): void {
    this.apply(new OrderCancelled(this.id, reason));
  }

  private apply(event: DomainEvent): void {
    this.events.push(event);
    this.evolve(event);
  }

  private evolve(event: DomainEvent): void {
    switch (event.type) {
      case 'OrderCreated':    this.status = 'CREATED'; break;
      case 'PaymentConfirmed': this.status = 'PAID'; break;
      case 'OrderCancelled':  this.status = 'CANCELLED'; break;
    }
  }
}
```

### CQRS — Separate Read and Write Models (Part 4)

The **write side** uses event-sourced Order aggregates. The **read side** projects events into a denormalised view optimised for the storefront:

```typescript
// Read-model projector
async function onOrderCreated(event: OrderCreated): Promise<void> {
  await readDb.orders.insert({
    orderId: event.orderId,
    status: 'CREATED',
    items: event.items,
    total: event.items.reduce((sum, i) => sum + i.price * i.qty, 0),
    createdAt: event.timestamp,
  });
}
```

### Architecture Diagram

<div class="diagram">

```
┌──────────┐      ┌──────────────┐      ┌────────────────┐
│  Client   │─────▶│  API Gateway │─────▶│  Order Service │
│ (Web/App) │      │              │      │  (Write Model) │
└──────────┘      └──────────────┘      └───────┬────────┘
                                                 │ Domain Events
                                                 ▼
                                        ┌────────────────┐
                                        │     Kafka      │
                                        └───┬────┬────┬──┘
                                            │    │    │
                          ┌─────────────────┘    │    └─────────────────┐
                          ▼                      ▼                      ▼
                   ┌──────────────┐     ┌────────────────┐     ┌───────────────┐
                   │   Payment    │     │   Inventory    │     │ Notification  │
                   │   Service    │     │   Service      │     │   Service     │
                   └──────┬───────┘     └───────┬────────┘     └───────────────┘
                          │                     │
                          ▼                     ▼
                   ┌──────────────┐     ┌────────────────┐
                   │  Stripe /    │     │  Inventory DB  │
                   │  Payment GW  │     │  (PostgreSQL)  │
                   └──────────────┘     └────────────────┘

                   ┌──────────────────────────────────────┐
                   │  Read Model Projector                 │
                   │  (consumes events → updates read DB)  │
                   └──────────────────┬───────────────────┘
                                      ▼
                               ┌──────────────┐
                               │  Read DB     │
                               │ (Elasticsearch│
                               │  / Postgres)  │
                               └──────────────┘
```

</div>

### Patterns Referenced

| Pattern | Source | Usage Here |
|---|---|---|
| Domain Events | Part 2 | Every state change emits an event |
| Event Sourcing | Part 4 | Order aggregate rebuilt from events |
| CQRS | Part 4 | Separate write (event store) and read (projected view) models |
| Saga (Choreography) | Part 5 | Cross-service order flow with compensating transactions |
| Idempotency | Part 6 | Payment retries use idempotency keys |
| Circuit Breaker | Part 6 | Wraps calls to external payment gateway |
| Structured Logging | Part 7 | Correlation ID flows through all events |

---

## 5. Common Patterns Cheat Sheet

A quick-reference mapping problems to the patterns covered in this series:

| Problem | Pattern | Part |
|---|---|---|
| Complex business logic with many rules | Domain Model + Aggregates | Part 1 |
| Decoupling producers from consumers | Domain Events / Message Bus | Part 2 |
| Commands vs. queries have different shapes | CQRS | Part 4 |
| Need full audit trail / temporal queries | Event Sourcing | Part 4 |
| Cross-service data consistency without 2PC | Saga (Choreography / Orchestration) | Part 5 |
| Read-heavy workload with stale-tolerant data | Cache-Aside + Read Replicas | Part 3 |
| Protecting against downstream failures | Circuit Breaker | Part 6 |
| Preventing duplicate side effects on retry | Idempotency Keys | Part 6 |
| Gradual feature rollout | Feature Flags | Part 6 |
| Understanding production behaviour | Structured Logging + Distributed Tracing | Part 7 |
| Scaling writes across nodes | Partitioning / Sharding | Part 3 |
| Real-time client updates | WebSockets + Pub/Sub | Part 3 |
| Handling long-running workflows | Process Manager / Saga Orchestrator | Part 5 |
| Separating infrastructure from domain | Hexagonal Architecture / Ports & Adapters | Part 1 |

<div class="callout tip">
No pattern exists in isolation. The e-commerce design above uses <strong>seven</strong> patterns together. The skill is knowing which to combine and when the added complexity is justified.
</div>

---

## 6. How to Approach System Design Interviews

### The Framework (45–60 minutes)

| Phase | Time | What to Do |
|---|---|---|
| **Requirements** | 5 min | Ask clarifying questions. Nail down scope, users, scale. |
| **Estimation** | 3 min | Back-of-envelope: QPS, storage, bandwidth. |
| **High-Level Design** | 10 min | Draw major components and data flow. |
| **Deep Dives** | 20 min | Zoom into 2–3 critical components. |
| **Trade-offs & Wrap-up** | 5 min | Discuss alternatives, failure modes, future improvements. |

### Communication Tips

1. **Think out loud.** The interviewer is evaluating your thought process, not just the final diagram.
2. **State assumptions explicitly.** "I'm assuming a 10:1 read-to-write ratio — does that sound right?"
3. **Drive the conversation.** Don't wait to be asked — proactively identify the hardest sub-problems.
4. **Acknowledge trade-offs.** "We gain availability here but sacrifice strong consistency."
5. **Use concrete numbers.** "With 5 KB per record and 100 M records, that's ~500 GB" is more convincing than "a lot of data."

<div class="callout info">
Interviewers are not looking for the "right" answer. They want to see structured thinking, awareness of trade-offs, and the ability to go deep when it matters.
</div>

### Common Mistakes to Avoid

- Jumping to a solution without understanding requirements
- Over-engineering for scale you don't need
- Ignoring failure scenarios entirely
- Using buzzwords without explaining why (e.g. "just use Kafka" — why Kafka?)
- Spending too long on one component and running out of time

---

## 7. Key Takeaways

1. **Follow a process.** Requirements → Estimation → High-Level → Deep Dive → Trade-offs. Every time.
2. **Numbers matter.** Back-of-envelope math separates hand-waving from engineering. Know your powers of two and latency numbers.
3. **Patterns compose.** Real systems use multiple patterns together — CQRS + Event Sourcing + Sagas is a common trio for complex domains.
4. **Trade-offs are the point.** There is no perfect design. The value is in understanding what you gain and what you give up.
5. **Start simple, evolve.** Don't design for 1 billion users on day one. Design for current scale with a clear path to grow.
6. **Failure is normal.** Every design must answer: "What happens when this component goes down?" If you can't answer that, the design is incomplete.
7. **Communication is a skill.** The best design in the world is useless if you can't explain it clearly to your team or interviewer.

<div class="callout">
System design is not about memorising solutions — it is about developing the judgement to make good trade-offs under uncertainty. The three designs in this part are starting points. Practise by redesigning them with different constraints: What if consistency matters more than availability? What if the budget is 10× smaller? What if the team is three people?
</div>

---

{{< quiz >}}
