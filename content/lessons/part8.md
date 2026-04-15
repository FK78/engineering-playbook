---
title: "Part 8: System Design Practice"
weight: 8
summary: "The capstone: design real systems end-to-end by combining every pattern from Parts 1-7."
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
case_studies:
  - title: "Design a Multi-Channel Notification System"
    category: "Greenfield Design"
    difficulty: "⭐⭐⭐"
    scenario: "AlertHub is a platform with 10M registered users that needs a unified notification system supporting email, push notifications (iOS/Android), SMS, and in-app notifications. Users can configure preferences per channel. For example, a user might want marketing emails but only push notifications for security alerts. The system must deliver 50M notifications per day (roughly 580/sec average, with spikes to 5,000/sec during marketing campaigns). Current state: each team (marketing, security, product) has built their own notification logic, resulting in 4 separate email-sending implementations, inconsistent user preference handling, and users receiving duplicate notifications. Last month, a marketing blast sent 2M emails to users who had unsubscribed, triggering a GDPR complaint."
    constraints: "Team: 3 backend engineers dedicated to this project, with support from a platform team. Budget: $6K/month for notification infrastructure (SES, SNS, Twilio). Timeline: MVP in 10 weeks. Must integrate with 4 existing services that currently send notifications directly. Must be GDPR-compliant (respect unsubscribe preferences, provide audit trail)."
    prompts:
      - "How do you design the preference system so that user channel preferences are always respected, even when a new notification type is added? Think about the data model for preferences and how it interacts with the delivery pipeline."
      - "What's the architecture for handling 5,000 notifications/sec during spikes without dropping messages or overwhelming downstream providers (SES has sending limits, Twilio has rate limits)?"
      - "How do you ensure exactly-once delivery semantics, or at least prevent the duplicate notification problem? What happens when a push notification provider returns an ambiguous response?"
      - "How do you design the system so that the 4 existing services can migrate incrementally without a big-bang cutover?"
    approaches:
      - name: "Event-Driven Pipeline with Priority Queues"
        description: "Build a notification service that exposes a single API: POST /notify with a payload containing recipient, notification type, and content. The service checks user preferences, then routes to channel-specific SQS queues (email-queue, push-queue, sms-queue, in-app-queue) with priority levels (security: high, marketing: low). Channel workers consume from queues and call the appropriate provider (SES, FCM/APNs, Twilio). Each notification gets a unique idempotency key stored in DynamoDB to prevent duplicates. A dead-letter queue captures failures for retry."
        trade_off: "Clean separation of concerns: preference checking, routing, and delivery are independent stages. Priority queues ensure security alerts aren't delayed by marketing blasts. But the system has multiple failure points (queue, worker, provider), and debugging a 'notification not received' complaint requires tracing through several components. DynamoDB idempotency adds latency to every notification."
      - name: "Centralized Notification Orchestrator with Fan-Out"
        description: "Build a notification orchestrator service that receives notification requests, resolves user preferences from a Redis-cached preference store, and fans out to all applicable channels in parallel. Each channel adapter handles provider-specific logic (batching for SES, token management for push). Use Kafka as the backbone: producers publish notification events, the orchestrator consumes and fans out, and each channel adapter consumes from its own topic. Kafka's consumer groups provide natural load balancing and replay capability."
        trade_off: "Kafka provides durability, replay (re-process failed notifications), and natural backpressure. The orchestrator pattern gives a single place to enforce business rules (quiet hours, frequency capping, preference checks). But Kafka adds operational complexity, the orchestrator is a potential bottleneck/single point of failure, and the team must manage Kafka infrastructure (or pay for MSK). More suited for teams with Kafka experience."
      - name: "Serverless Fan-Out with Step Functions"
        description: "Use AWS Step Functions to orchestrate the notification flow: receive event → check preferences (Lambda) → fan-out to channels (parallel state) → deliver via channel-specific Lambdas (SES, SNS for push, Twilio SDK for SMS, API call for in-app). Step Functions provides built-in retry, error handling, and visual execution tracing. Store preferences in DynamoDB with a DAX cache. Use EventBridge as the entry point so existing services publish events without knowing about the notification system."
        trade_off: "Lowest operational overhead. No servers, queues, or Kafka to manage. Step Functions' visual workflow makes debugging straightforward, and EventBridge decouples producers cleanly. But Step Functions has a per-state-transition cost that adds up at 50M notifications/day (~$150K/year for Step Functions alone), Lambda cold starts can add latency to time-sensitive notifications, and the 25,000 events/sec EventBridge limit may require batching during spikes."
  - title: "Design a Real-Time Collaborative Document Editor"
    category: "Greenfield Design"
    difficulty: "⭐⭐⭐"
    scenario: "DocSync is building a real-time collaborative document editor for enterprise teams, similar to Google Docs but for regulated industries (healthcare, finance). Up to 50 users can edit the same document simultaneously. The editor must show each user's cursor position in real-time, handle conflicting edits without data loss, and support offline editing that syncs when the user reconnects. Documents average 50KB but can reach 2MB. The target market requires that all data stays within the customer's chosen AWS region (data residency) and that a full edit history is retained for 7 years (compliance audit trail). The company has 500 paying teams with an average of 20 users each."
    constraints: "Team: 6 engineers (2 frontend, 3 backend, 1 infra). Budget: $10K/month infrastructure. Timeline: 12 weeks to a working prototype with real-time co-editing and cursor presence. Offline support can follow in phase 2. Must support data residency (deploy per-region). Documents must be recoverable to any point in their edit history."
    prompts:
      - "What conflict resolution strategy would you use: Operational Transformation (OT) or Conflict-free Replicated Data Types (CRDTs)? What are the practical trade-offs for a team of 6 building this in 12 weeks?"
      - "How do you design the real-time communication layer to handle 50 concurrent editors with sub-200ms latency for cursor updates and edits? What protocol and infrastructure do you use?"
      - "How do you store the document and its edit history to support both real-time collaboration and the 7-year audit trail requirement? Think about the hot path (active editing) vs. cold path (historical audit)."
      - "How does offline editing work? When a user reconnects after editing offline for 2 hours, how do you merge their changes with the 47 edits that happened while they were away?"
    approaches:
      - name: "OT-Based with Central Server"
        description: "Use Operational Transformation with a central server that acts as the single source of truth. Each client sends operations (insert, delete) to the server, which transforms them against concurrent operations and broadcasts the result. The server maintains a linear operation log per document. Use WebSockets for real-time communication, with a Redis pub/sub layer for cursor presence. Store the current document state in PostgreSQL and the operation log in an append-only table. Archive operation logs older than 30 days to S3 for the 7-year audit trail."
        trade_off: "OT is well-understood (Google Docs uses it) and the central server simplifies conflict resolution since there's one canonical operation order. But the server is a bottleneck and single point of failure for each document session, OT algorithms are notoriously complex to implement correctly (especially for rich text), and the central server must be in the customer's region (data residency). Scaling to many concurrent documents requires careful session routing."
      - name: "CRDT-Based with Peer-Aware Server"
        description: "Use a CRDT library (Yjs or Automerge) for conflict-free merging. Each client maintains a local CRDT document and syncs changes via a lightweight server that relays updates between peers. CRDTs guarantee convergence without a central authority. Edits can happen offline and merge automatically on reconnect. Store CRDT snapshots in S3 (one per document) and sync deltas in DynamoDB. Use WebSocket connections to the server for real-time relay, with cursor positions broadcast as ephemeral presence data."
        trade_off: "CRDTs handle offline editing naturally (the core use case for phase 2) and eliminate the central server as a conflict resolution bottleneck. Libraries like Yjs are mature and handle rich text. But CRDT documents are larger than plain text (metadata overhead can be 2-10x), the 7-year audit trail is harder because CRDTs don't have a linear operation log (you'd need to snapshot periodically), and debugging merge conflicts in production is more opaque than OT's deterministic transformation."
      - name: "Hybrid: CRDT Client + Event-Sourced Server"
        description: "Use Yjs on the client for local editing and conflict resolution. The server receives CRDT sync updates and also writes each change as an event to an append-only event store (DynamoDB Streams or Kafka). The event store provides the 7-year audit trail and enables point-in-time document reconstruction. Current document state is materialized into S3 on every save. WebSocket connections handle real-time sync, and a presence service (Redis) tracks cursors. For offline support, the client's Yjs document syncs its accumulated changes when reconnecting."
        trade_off: "Combines the best of both: CRDTs handle the hard problem of conflict resolution and offline support, while event sourcing provides the audit trail and point-in-time recovery the compliance team needs. But it's the most complex architecture. The team must understand both CRDTs and event sourcing, and there are two representations of truth (CRDT state and event log) that must stay consistent. The 12-week timeline is aggressive for this approach."
interactive_cases:
  - title: "The Millions of Users Founder"
    type: "great-unknown"
    difficulty: "⭐⭐"
    brief: "A startup founder has reached out for architecture advice. They have a bold vision but very little detail. Your job is to ask the right questions before proposing any solution."
    opening: "We need to build a system that can handle millions of users."
    hidden_facts: "It's a ticket marketplace for live events. Currently pre-launch with 0 users. Team of 2 developers. $50K remaining runway (3 months). 'Millions of users' is their 5-year vision, not current need. First event is in 6 weeks with expected 5,000 ticket buyers. Real concurrent load will be ~1,000 users during ticket drops. They haven't built anything yet. They're considering microservices because 'that's what Netflix uses'."
---

# Part 8: System Design Practice

This is the capstone. Everything from Parts 1-7 (domain modelling, messaging patterns, CQRS, event sourcing, microservices, observability, resilience) converges here. We walk through designing three real systems end-to-end, then distil the patterns into a cheat sheet you can reference in interviews and on the job.

<div class="callout info">
This part is deliberately opinionated. Real system design has no single correct answer, but it does have a <strong>process</strong>. Follow the process, justify your decisions, and you will arrive at a defensible design every time.
</div>

---

{{< audio-player part="part8" >}}

## 1. The System Design Process

Every design, whether on a whiteboard, in a design doc, or in an interview, follows the same five-phase loop:

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

<div class="callout tip">
  <strong>Real-World Example:</strong> When Google designed Google Maps' real-time traffic system, they started not with architecture but with requirements: sub-second latency for route recalculation, global coverage across 220+ countries, and the ability to ingest GPS data from billions of Android devices. This requirements-first approach led them to a streaming architecture with edge-computed traffic tiles rather than a simpler batch system, a decision that would have been wrong without first quantifying the latency and scale constraints.
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
- High availability: a broken redirect is a broken link
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

**Chosen: Base62 with a distributed counter** (e.g. Twitter Snowflake-style ID, base62 encoded). A 7-character base62 string gives 62⁷ ≈ 3.5 trillion unique keys, more than enough.

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

- **Stateless API servers** behind a load balancer. Scale horizontally.
- **DynamoDB on-demand** scales reads/writes automatically.
- **Redis cluster** with consistent hashing for cache sharding.
- **Analytics decoupled** via Kafka. Redirect latency is not affected by analytics writes.

<div class="callout tip">
  <strong>Real-World Example:</strong> Bitly handles over 10 billion link redirects per month using a read-optimized architecture strikingly similar to this design. They use a distributed key-value store for URL lookups, a Redis caching layer that serves the vast majority of redirects without hitting the database, and a separate analytics pipeline that asynchronously processes click events. Their 301 redirect latency stays under 20 ms at the 99th percentile because the hot path (cache lookup and redirect) is completely decoupled from analytics processing.
</div>

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

Presence (online/offline/typing) is **ephemeral**. Use **Redis** with TTL-based heartbeats.

```
SETEX  presence:{userId}  30  "online"     # expires in 30s
```

Clients send a heartbeat every 20 seconds. If the key expires, the user is offline.

### Fan-Out for Group Messages

For a group message, the server must deliver to all online members. Two strategies:

| Strategy | When to Use |
|---|---|
| **Fan-out on write** | Small groups (< 500 members): write a copy to each member's queue |
| **Fan-out on read** | Large groups / channels: members pull from a shared timeline |

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

- **Connection Gateways** are stateful (hold WebSocket connections). Scale by adding nodes. Use a **service registry** so the Message Service knows which gateway holds which user.
- **Kafka** bridges gateways: if User A is on Gateway-1 and User B is on Gateway-2, the message routes through Kafka.
- **Cassandra** scales linearly by adding nodes. No single point of failure.

<div class="callout">
The hardest part of chat at scale is not message storage. It is <strong>connection routing</strong>. Knowing which of 200 gateway nodes holds a given user's WebSocket is the core coordination problem.
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> WhatsApp handles over 100 billion messages per day with a remarkably lean architecture. They use Erlang/BEAM for their connection gateways, which can hold millions of concurrent WebSocket connections per node due to Erlang's lightweight process model. Messages are stored in Mnesia (for transient data) and Cassandra (for persistent history), and they route messages between gateway nodes using a custom protocol rather than a general-purpose message bus. Their team of fewer than 50 engineers supported 2 billion users by keeping the architecture simple and optimizing the connection layer relentlessly.
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

<div class="callout tip">
  <strong>Real-World Example:</strong> Shopify processes millions of orders during flash sales like Black Friday, where their peak hit 700,000 orders per minute. Their order system uses an event-driven architecture with a saga-like pattern: when a customer checks out, the order service emits domain events that trigger payment processing, inventory reservation, and shipping label generation as independent, loosely coupled steps. Compensating transactions handle failures. If payment declines after inventory is reserved, an <code>InventoryReleased</code> event frees the stock. This choreography-based approach lets each service scale independently and degrade gracefully under extreme load.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> Netflix's architecture is a textbook example of composing multiple patterns. They use CQRS to separate their content catalog reads (served from a denormalized cache) from editorial writes, circuit breakers (via Hystrix, which they open-sourced) to isolate failures between their 700+ microservices, event sourcing for their A/B testing platform to replay experiment assignments, and saga orchestration for their subscription billing flow. No single pattern solves their problems. It's the deliberate combination, applied where each is justified, that lets them stream to 260 million subscribers with 99.99% availability.
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
2. **State assumptions explicitly.** "I'm assuming a 10:1 read-to-write ratio. Does that sound right?"
3. **Drive the conversation.** Don't wait to be asked. Proactively identify the hardest sub-problems.
4. **Acknowledge trade-offs.** "We gain availability here but sacrifice strong consistency."
5. **Use concrete numbers.** "With 5 KB per record and 100 M records, that's ~500 GB" is more convincing than "a lot of data."

<div class="callout info">
Interviewers are not looking for the "right" answer. They want to see structured thinking, awareness of trade-offs, and the ability to go deep when it matters.
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> Amazon's internal system design review process (called "operational readiness reviews") mirrors the interview framework almost exactly. Before launching any new service, teams must present capacity estimates, architecture diagrams, deep dives on failure modes, and explicit trade-off documentation. The review board challenges assumptions with questions like "what happens when your primary database fails?" and "show me the back-of-envelope math for your storage growth." This structured process is why Amazon's interview loop emphasizes the same skills. It directly reflects how they build production systems.
</div>

### Common Mistakes to Avoid

- Jumping to a solution without understanding requirements
- Over-engineering for scale you don't need
- Ignoring failure scenarios entirely
- Using buzzwords without explaining why (e.g. "just use Kafka" without saying why Kafka)
- Spending too long on one component and running out of time

---

## 7. Architecture Documentation

Good architecture is worthless if no one can understand it six months later. Documentation captures the *why* behind decisions, gives new team members context, and provides a shared vocabulary for discussing the system.

### Architecture Decision Records (ADRs)

An ADR is a short document that captures a single architectural decision, the context that led to it, and the consequences of choosing it. They answer the question new team members always ask: "Why did we build it this way?"

**Standard ADR format:**

| Section | Purpose |
|---------|---------|
| **Title** | Short, descriptive name for the decision |
| **Status** | Proposed, Accepted, Deprecated, Superseded |
| **Context** | What situation or problem prompted this decision? |
| **Decision** | What did we decide, and why? |
| **Consequences** | What are the positive and negative results? |

**Concrete example:**

```
# ADR-007: Use PostgreSQL over MongoDB for the Order Service

## Status
Accepted

## Context
The order service handles financial transactions that require ACID guarantees.
Orders have a well-defined schema (order ID, line items, totals, status, timestamps)
that rarely changes. We need complex queries for reporting: joins across orders,
customers, and products with aggregations. The team has strong SQL experience
but limited MongoDB experience.

## Decision
Use PostgreSQL as the primary database for the order service.

## Consequences
- Positive: ACID transactions protect against partial order writes.
- Positive: JOINs and aggregations are straightforward for reporting.
- Positive: Team is already proficient with PostgreSQL.
- Negative: Horizontal scaling is harder than MongoDB if order volume
  exceeds a single node's capacity. We accept this trade-off because
  projected volume (10K orders/day) fits comfortably on one instance
  for the next 2-3 years.
- Negative: Schema migrations require more planning than a schemaless store.
```

**Where to store ADRs:** Keep them in your repository under a `docs/adr/` directory, numbered sequentially (`001-use-postgresql.md`, `002-adopt-event-sourcing.md`). They live with the code and are reviewed in pull requests like any other change.

### C4 Model

The C4 model provides four levels of architecture diagrams, each zooming in further. Think of it like a map: Level 1 is the country view, Level 4 is the street view.

| Level | Name | Shows | Audience |
|-------|------|-------|----------|
| 1 | **Context** | Your system as a box, surrounded by users and external systems | Everyone (business, dev, ops) |
| 2 | **Container** | Major runtime units inside your system (APIs, databases, queues) | Developers, architects |
| 3 | **Component** | Internal components within a single container | Developers working on that container |
| 4 | **Code** | Class/module diagrams inside a component | Usually auto-generated, rarely maintained |

**Level 1: Context Diagram (E-Commerce System)**

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTEXT DIAGRAM                          │
│                                                                 │
│   ┌──────────┐         ┌──────────────────────┐                 │
│   │ Customer │────────>│   E-Commerce System   │                │
│   │ [Person] │<────────│   [Software System]   │                │
│   └──────────┘         └──────────┬───────────┘                 │
│                                   │                             │
│                    ┌──────────────┼──────────────┐              │
│                    │              │              │               │
│                    v              v              v               │
│             ┌────────────┐ ┌──────────┐  ┌────────────┐        │
│             │  Payment   │ │  Email   │  │  Shipping  │        │
│             │  Gateway   │ │ Provider │  │  Partner   │        │
│             │ [External] │ │[External]│  │ [External] │        │
│             └────────────┘ └──────────┘  └────────────┘        │
│                                                                 │
│   ┌──────────┐                                                  │
│   │  Admin   │────────> E-Commerce System                       │
│   │ [Person] │                                                  │
│   └──────────┘                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Level 2: Container Diagram (E-Commerce System)**

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CONTAINER DIAGRAM                             │
│                     E-Commerce System                               │
│                                                                     │
│   ┌──────────┐      ┌──────────────┐      ┌───────────────┐       │
│   │ Customer │─────>│  Web App     │─────>│  API Gateway  │       │
│   │          │      │  [React SPA] │      │  [Kong/NGINX] │       │
│   └──────────┘      └──────────────┘      └───────┬───────┘       │
│                                                    │                │
│                              ┌─────────────────────┼────────┐      │
│                              │                     │        │      │
│                              v                     v        v      │
│                     ┌──────────────┐  ┌──────────┐  ┌──────────┐  │
│                     │   Order      │  │ Product  │  │   User   │  │
│                     │   Service    │  │ Service  │  │  Service │  │
│                     │  [Node.js]   │  │[Node.js] │  │ [Node.js]│  │
│                     └──────┬───────┘  └────┬─────┘  └────┬─────┘  │
│                            │               │             │         │
│                            v               v             v         │
│                     ┌──────────────┐  ┌──────────┐  ┌──────────┐  │
│                     │  Order DB    │  │Product DB│  │  User DB │  │
│                     │ [PostgreSQL] │  │[Postgres]│  │[Postgres]│  │
│                     └──────────────┘  └──────────┘  └──────────┘  │
│                            │                                       │
│                            v                                       │
│                     ┌──────────────┐      ┌──────────────┐        │
│                     │  Message     │─────>│  Notification│        │
│                     │  Queue       │      │  Service     │        │
│                     │  [RabbitMQ]  │      │  [Node.js]   │        │
│                     └──────────────┘      └──────────────┘        │
│                                                                     │
│                     ┌──────────────┐                                │
│                     │  Redis       │  (shared cache layer)         │
│                     │  [Cache]     │                                │
│                     └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

<div class="callout tip">
Most teams only need Level 1 and Level 2 diagrams. Level 3 is useful for complex services. Level 4 is almost never worth maintaining manually.
</div>

### Estimation Skills

Architects need to do back-of-envelope estimation to make informed decisions about storage, compute, and bandwidth. You do not need exact numbers. You need the right order of magnitude.

**Key numbers to memorize:**

| Fact | Value |
|------|-------|
| Seconds in a day | 86,400 (~100K for rough math) |
| 1M requests/day | ~12 requests/second |
| 1 char (ASCII) | 1 byte |
| 1 KB | ~1,000 characters of text |
| 1 MB | ~1,000 KB |
| 1 GB | ~1,000 MB |

**Worked example: Storage for a chat application**

*Assumptions:*
- 1M daily active users
- Each user sends 50 messages per day
- Average message size: 200 characters = 200 bytes

*Calculation:*

```
Messages per day:     1,000,000 users x 50 messages = 50,000,000 messages/day
Storage per day:      50,000,000 x 200 bytes = 10,000,000,000 bytes = 10 GB/day
Storage per month:    10 GB x 30 = 300 GB/month
Storage per year:     300 GB x 12 = 3.6 TB/year
Storage for 5 years:  3.6 TB x 5 = 18 TB

With metadata overhead (timestamps, user IDs, indexes), roughly 2x:
Total 5-year estimate: ~36 TB
```

This tells you a single PostgreSQL instance (which tops out around 10-20 TB comfortably) will not hold 5 years of data. You need to plan for sharding, archival, or a distributed database like Cassandra from the start.

<div class="callout info">
Estimation is not about getting the exact number. It is about getting the right order of magnitude. 100GB vs 1TB vs 10TB changes your architecture. 100GB vs 120GB does not.
</div>

---

## 8. Key Takeaways

1. **Follow a process.** Requirements → Estimation → High-Level → Deep Dive → Trade-offs. Every time.
2. **Numbers matter.** Back-of-envelope math separates hand-waving from engineering. Know your powers of two and latency numbers.
3. **Patterns compose.** Real systems use multiple patterns together. CQRS + Event Sourcing + Sagas is a common trio for complex domains.
4. **Trade-offs are the point.** There is no perfect design. The value is in understanding what you gain and what you give up.
5. **Start simple, evolve.** Don't design for 1 billion users on day one. Design for current scale with a clear path to grow.
6. **Failure is normal.** Every design must answer: "What happens when this component goes down?" If you can't answer that, the design is incomplete.
7. **Communication is a skill.** The best design in the world is useless if you can't explain it clearly to your team or interviewer.

<div class="callout">
System design is not about memorising solutions. It is about developing the judgement to make good trade-offs under uncertainty. The three designs in this part are starting points. Practise by redesigning them with different constraints: What if consistency matters more than availability? What if the budget is 10× smaller? What if the team is three people?
</div>

---

{{< quiz >}}

## Scenario Challenges

{{< case-studies >}}

## Interactive Case Studies

{{< interactive-cases >}}