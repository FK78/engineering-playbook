---
title: "Part 3: Events & CQRS"
subtitle: "Event-Driven Architecture, Messaging Patterns & CQRS"
linkTitle: "Part 3: Events & CQRS"
weight: 3
type: "docs"
quiz:
  - q: "Your order service directly calls the inventory service, email service, and analytics service after an order is placed. What's the problem and how would you fix it?"
    concepts:
      - label: "tight coupling between services"
        terms: ["tight", "coupled", "direct call", "depends on", "knows about", "synchronous"]
      - label: "use events instead"
        terms: ["event", "publish", "emit", "broadcast", "message", "async", "decouple"]
      - label: "services subscribe independently"
        terms: ["subscribe", "listen", "consumer", "independent", "don't know about each other", "react"]
    answer: "The order service is tightly coupled to all downstream services. If any fails, the order fails. Fix: publish an OrderPlaced event. Inventory, email, and analytics each subscribe independently. The order service doesn't know they exist."
  - q: "You're building a system where reads are 100x more frequent than writes, and the read queries need denormalized data from multiple tables. What pattern would help?"
    concepts:
      - label: "CQRS"
        terms: ["cqrs", "command query", "separate read", "separate write", "read model", "write model"]
      - label: "optimized read model"
        terms: ["denormali", "read-optimized", "projection", "view", "materialized", "pre-computed", "flat"]
      - label: "scale independently"
        terms: ["scale", "independent", "separate database", "separate store", "read replica"]
    answer: "CQRS — separate the read and write models. Writes go through the command model (normalized). Reads use a denormalized, pre-computed read model optimized for your queries. Each can scale independently."
  - q: "What's the difference between a message queue and an event stream? When would you use each?"
    concepts:
      - label: "queue = one consumer processes each message"
        terms: ["one consumer", "single consumer", "consumed once", "removed", "task", "job", "work queue", "point-to-point"]
      - label: "stream = multiple consumers, messages persist"
        terms: ["multiple consumer", "many consumer", "persist", "replay", "log", "retain", "broadcast", "fan-out"]
      - label: "appropriate use cases"
        terms: ["background job", "task", "work distribution", "audit", "replay", "event sourcing", "history"]
    answer: "Queue: each message is processed by one consumer, then removed. Good for task distribution (send email, process payment). Stream: messages persist and multiple consumers can read them independently. Good for event sourcing, audit logs, and when multiple services need the same events."
  - q: "A user places an order that requires payment, inventory reservation, and shipping setup across three services. How do you handle this without a distributed transaction?"
    concepts:
      - label: "saga pattern"
        terms: ["saga", "compensat", "sequence", "step", "workflow"]
      - label: "compensating actions on failure"
        terms: ["compensat", "undo", "rollback", "reverse", "cancel", "refund"]
      - label: "choreography or orchestration"
        terms: ["choreograph", "orchestrat", "coordinator", "event-driven", "central"]
    answer: "Use the Saga pattern. Each service performs its step and publishes an event. If any step fails, previous steps are undone via compensating actions (e.g., refund payment, release inventory). Can be choreographed (events) or orchestrated (central coordinator)."
  - q: "Your team wants a complete audit trail of every change to an order, including the ability to reconstruct the order's state at any point in time. What pattern would you use?"
    concepts:
      - label: "event sourcing"
        terms: ["event sourc", "event store", "event log", "append", "sequence of event"]
      - label: "store events, not state"
        terms: ["store event", "not current state", "don't store state", "derive state", "replay", "rebuild"]
      - label: "reconstruct by replaying"
        terms: ["replay", "reconstruct", "rebuild", "rehydrat", "point in time", "history"]
    answer: "Event Sourcing. Instead of storing the current order state, store every event (OrderCreated, ItemAdded, OrderShipped). Reconstruct the state at any point by replaying events up to that moment. The event log is the source of truth."
case_studies:
  - title: "The 8-Second Order"
    category: "Scaling Challenge"
    difficulty: "⭐⭐"
    scenario: "QuickCart is an online grocery platform processing 500 orders per minute at peak (weekday evenings, 6-9 PM). Placing an order currently takes 8 seconds because the Order Service synchronously calls four downstream services in sequence: Payment Gateway (1.5s), Inventory Service (2s), Email Service (1.5s), and Analytics Service (3s). Customers are abandoning checkout — conversion dropped 18% last month. During a recent flash sale, the Analytics Service went down for 20 minutes, which meant no orders could be placed at all, costing an estimated $120,000 in lost revenue."
    constraints: "5 engineers, peak load of 500 orders/minute with 3x spikes during promotions, Payment and Inventory must succeed before confirming the order, Email and Analytics failures should never block checkout, 99.9% uptime target"
    prompts:
      - "Which of the four downstream calls are essential to order placement and which are not? How does this distinction change your architecture?"
      - "If you make Email and Analytics asynchronous, how do you guarantee they eventually process every order? What happens if a message is lost?"
      - "Payment and Inventory still take 3.5 seconds combined. Can you parallelize them? What are the consistency implications?"
      - "How do you handle the scenario where Payment succeeds but Inventory fails? What's your compensation strategy?"
    approaches:
      - name: "Async Events for Non-Critical Paths"
        description: "Keep Payment and Inventory as synchronous calls (they must succeed for the order to be valid), but publish an OrderPlaced event to a message queue after they complete. Email and Analytics subscribe to this event and process asynchronously. The order confirms in ~3.5 seconds instead of 8."
        trade_off: "Cuts response time by more than half with minimal architectural change. Email might arrive a few seconds late, which users won't notice. But you need a message broker (SQS/RabbitMQ), dead-letter queues for failed messages, and monitoring to ensure consumers keep up. Analytics data has a slight delay."
      - name: "Parallel Calls with Saga Compensation"
        description: "Call Payment and Inventory in parallel (reducing their combined time from 3.5s to ~2s). If Payment succeeds but Inventory fails, execute a compensating refund. Email and Analytics are event-driven as above. Total response time drops to ~2 seconds."
        trade_off: "Fastest possible response time, but parallel execution introduces compensation complexity. You need idempotent refund logic, and there's a brief window where a customer is charged but the order isn't confirmed. Requires careful error handling and monitoring of compensation flows."
      - name: "Event-Driven with Orchestrator Saga"
        description: "The Order Service creates a pending order and publishes a command to start the saga. An orchestrator coordinates Payment → Inventory in sequence, with compensating actions on failure. Once both succeed, it publishes OrderConfirmed, triggering Email and Analytics. The API returns immediately with a pending order ID; the client polls or uses WebSocket for confirmation."
        trade_off: "Sub-second API response (just creates a pending record), fully decoupled, and the orchestrator provides clear visibility into the order workflow. But the user experience changes — they see 'processing' instead of instant confirmation. Adds infrastructure complexity (orchestrator, state machine, polling/WebSocket). Overkill if the 2-second parallel approach is fast enough."
  - title: "The Auditable Fintech Ledger"
    category: "Greenfield Design"
    difficulty: "⭐⭐⭐"
    scenario: "VaultPay is a fintech startup building a digital wallet for small businesses. Regulators require a complete, immutable audit trail of every account change — deposits, withdrawals, transfers, fee deductions, and balance adjustments — with the ability to reconstruct any account's exact balance at any point in time. Simultaneously, the mobile app needs a fast dashboard showing current balances, recent transactions, and monthly spending summaries for 50,000 accounts. The compliance team must be able to query 'What was Account X's balance at 3:47 PM on March 12th?' within seconds."
    constraints: "7 engineers, must pass SOC 2 and financial regulator audit within 6 months, read-to-write ratio of 200:1, dashboard must load in under 500ms, audit queries must return in under 5 seconds, zero tolerance for lost transactions"
    prompts:
      - "How does event sourcing help meet the regulatory requirement? What would the event schema look like for financial transactions?"
      - "The dashboard needs sub-500ms reads but the audit trail could have millions of events per account. How do you serve both needs?"
      - "How do you handle the 'balance at a point in time' query efficiently without replaying all events from the beginning?"
      - "What happens if a bug in your projection logic produces incorrect dashboard balances? How do you detect and recover?"
    approaches:
      - name: "Event Sourcing with CQRS Projections"
        description: "Store every account change as an immutable event in an append-only event store (the source of truth). Project events into a read-optimized database for the dashboard — a balances table, a recent_transactions table, and a monthly_summaries table. Use snapshots every 1,000 events to speed up point-in-time reconstruction. The compliance team queries the event store directly for audit trails."
        trade_off: "Perfect audit trail by design — events are immutable and complete. Dashboard reads are fast because projections are pre-computed. But event sourcing adds significant complexity: schema evolution of events is hard, projections can drift if there are bugs (need rebuild capability), and the team needs to learn a new paradigm. Snapshots add another moving part."
      - name: "Append-Only Ledger with Materialized Views"
        description: "Use a traditional relational database with an append-only transactions table (no UPDATEs or DELETEs allowed — enforced by database permissions). Current balances are maintained as a materialized view or trigger-updated summary table. Point-in-time balance is calculated with SELECT SUM(amount) FROM transactions WHERE account_id = X AND timestamp <= T."
        trade_off: "Simpler than full event sourcing — the team can use familiar SQL and relational patterns. The append-only constraint provides auditability. But point-in-time queries get slow as transaction volume grows (millions of rows to sum). Materialized views can lag. Doesn't naturally support replaying events to build new projections."
      - name: "Dual-Write with Immutable Audit Log"
        description: "Write current state to a normalized PostgreSQL database for the dashboard (fast reads, familiar queries). Simultaneously write every change to an immutable audit log (DynamoDB with no delete permissions, or S3 with object lock). The dashboard reads from PostgreSQL; compliance queries the audit log. A reconciliation job periodically verifies the two are consistent."
        trade_off: "Simplest mental model — current state in one place, audit trail in another. Each store is optimized for its purpose. But dual-writes risk inconsistency if one write succeeds and the other fails (need transactional outbox or change data capture). The reconciliation job adds operational overhead. Two sources of truth is inherently fragile."
interactive_cases:
  - title: "CQRS Event Throughput Estimation"
    type: "back-of-envelope"
    difficulty: "⭐⭐"
    brief: "Estimate how many events per second a CQRS system would need to handle for a food delivery app like Deliveroo operating in 10 cities. Walk through your assumptions step by step."
    opening: "We're designing the event infrastructure for a food delivery platform launching in 10 cities. Before we pick between Kafka, SQS, or Kinesis, we need a rough estimate of event throughput. Can you walk me through a back-of-envelope calculation for how many events per second we'd need to handle at peak?"
    answer_range: "500-5000 events/second depending on assumptions"
    key_assumptions: "orders per city per hour, events per order lifecycle (created, accepted, picked up, delivered, rated = ~5-8 events), peak multiplier"
---

## Event-Driven Architecture

In a traditional architecture, services call each other directly. In an event-driven architecture, services communicate by **producing and consuming events**. The producer doesn't know who's listening.

<div class="callout tip">
  <strong>Real-World Example:</strong> Uber's trip processing system uses event-driven architecture to coordinate across dozens of microservices. When a ride is completed, a "TripCompleted" event is published and consumed independently by billing, driver payments, rider receipts, surge pricing, and analytics services. This decoupling allowed Uber to scale from handling thousands to millions of trips per day without services needing to know about each other.
</div>

### Direct Calls vs Events

<span class="bad">Direct calls (tight coupling):</span> <span class="label label-ts">TypeScript</span>

```typescript
class OrderService {
  constructor(
    private inventory: InventoryService,
    private email: EmailService,
    private analytics: AnalyticsService,
  ) {}

  async placeOrder(order: Order) {
    await this.saveOrder(order);
    await this.inventory.reserve(order.items);    // if this fails, order fails
    await this.email.sendConfirmation(order);     // if this fails, order fails
    await this.analytics.trackOrder(order);       // if this fails, order fails
  }
}
```

OrderService knows about every downstream service. Adding a new one means editing OrderService. If any call fails, the whole order fails.

<span class="good">Event-driven (loose coupling):</span> <span class="label label-ts">TypeScript</span>

```typescript
class OrderService {
  constructor(private eventBus: EventBus) {}

  async placeOrder(order: Order) {
    await this.saveOrder(order);
    await this.eventBus.publish("OrderPlaced", {
      orderId: order.id,
      customerId: order.customerId,
      items: order.items,
      total: order.total,
    });
    // Done. OrderService doesn't know who's listening.
  }
}

// Each service subscribes independently
eventBus.subscribe("OrderPlaced", async (event) => {
  await inventoryService.reserve(event.items);
});

eventBus.subscribe("OrderPlaced", async (event) => {
  await emailService.sendConfirmation(event.orderId);
});

eventBus.subscribe("OrderPlaced", async (event) => {
  await analyticsService.trackOrder(event);
});
```

<div class="callout tip">
  <strong>Adding a new subscriber?</strong> Just subscribe. OrderService doesn't change. That's the power of loose coupling through events.
</div>

### Commands vs Events

These are two different types of messages with different semantics:

| | Command | Event |
|---|---|---|
| **Intent** | "Do this" | "This happened" |
| **Direction** | Sent to a specific handler | Broadcast to anyone listening |
| **Naming** | Imperative: `ReserveInventory`, `SendEmail` | Past tense: `OrderPlaced`, `PaymentReceived` |
| **Consumers** | Exactly one | Zero or many |
| **Can be rejected?** | Yes | No (it already happened) |

<span class="label label-ts">TypeScript</span>

```typescript
// Command — directed at a specific handler
interface ReserveInventory {
  orderId: string;
  items: { productId: string; quantity: number }[];
}

// Event — something that happened, broadcast to all
interface OrderPlaced {
  orderId: string;
  customerId: string;
  items: { productId: string; quantity: number }[];
  total: number;
  placedAt: Date;
}
```

<div class="callout info">
  <strong>Rule of thumb:</strong> Commands can fail ("sorry, not enough stock"). Events are facts — they already happened and can't be undone, only reacted to.
</div>

## Message Queues vs Event Streams

Two different infrastructure patterns for moving messages between services:

<div class="callout tip">
  <strong>Real-World Example:</strong> LinkedIn built Apache Kafka to solve their activity feed problem. They needed hundreds of services to consume the same user activity events (profile views, connection requests, job applications) independently and at their own pace. A traditional message queue would have required duplicating messages for each consumer. Kafka's persistent log with consumer groups let each team read the same stream without interfering with others, processing over a trillion messages per day.
</div>

### Message Queue (SQS, RabbitMQ)

```text
Producer → [ Queue ] → Consumer
                         ↑
              Message removed after processing
```

- Each message is processed by **one consumer**, then removed
- If you add more consumers, they **compete** for messages (work distribution)
- Good for: background jobs, task processing, work distribution

<span class="label label-py">Python</span> — conceptual:

```python
# Producer
queue.send_message({"task": "send_email", "to": "alice@example.com", "order_id": "123"})

# Consumer (only ONE consumer gets this message)
message = queue.receive_message()
send_email(message["to"], message["order_id"])
queue.delete_message(message)  # gone forever
```

### Event Stream (Kafka, Kinesis)

```text
Producer → [ Stream / Log ] → Consumer A (reads at own pace)
                             → Consumer B (reads at own pace)
                             → Consumer C (reads at own pace)
                    ↑
         Messages persist, can be replayed
```

- Messages **persist** in an ordered log
- **Multiple consumers** each read independently at their own pace
- Consumers can **replay** from any point
- Good for: event sourcing, audit trails, multiple services reacting to same events

<span class="label label-py">Python</span> — conceptual:

```python
# Producer
stream.publish("orders", {"event": "OrderPlaced", "order_id": "123", "total": 59.99})

# Consumer A — inventory (reads from its own position)
for event in stream.consume("orders", group="inventory"):
    reserve_stock(event["order_id"])

# Consumer B — analytics (reads the SAME events independently)
for event in stream.consume("orders", group="analytics"):
    track_order(event["order_id"])
```

### When to Use Which

| Scenario | Choose | Why |
|---|---|---|
| "Send this email" | Queue | One consumer, task is done once |
| "Process this payment" | Queue | Exactly-once processing matters |
| "Order was placed" (multiple services care) | Stream | Multiple consumers need the same event |
| Need to replay events from last week | Stream | Messages persist |
| Distribute work across workers | Queue | Competing consumers |
| Audit trail / event sourcing | Stream | Append-only log |

## Multiple Consumers and Idempotency

When you scale a service to multiple instances, how do you prevent the same message being processed twice?

<div class="callout tip">
  <strong>Real-World Example:</strong> Stripe's payment processing system handles idempotency as a core design principle. Every API request accepts an idempotency key, so if a network failure causes a client to retry a payment charge, Stripe recognizes the duplicate and returns the original result instead of charging the customer twice. This pattern is critical at scale — Stripe processes billions of API requests where even a tiny percentage of duplicates would mean real money lost.
</div>

### Consumer Groups

**Queues** handle this automatically — multiple instances of the email service compete for messages. Each message goes to exactly one instance:

```text
                    ┌─ Email Worker 1  (gets message A)
Queue ─────────────►├─ Email Worker 2  (gets message B)
[A, B, C, D]       └─ Email Worker 3  (gets message C)
```

**Event streams** use consumer groups. All instances of a service join the same group. The stream assigns partitions so each message is processed once per group:

```text
Stream partitions:
  Partition 0 ──→ Email Worker 1
  Partition 1 ──→ Email Worker 2

Different groups read independently:
  Group "email"     → processes each event once across its workers
  Group "analytics" → processes the SAME events independently
```

### Idempotency — Handling Duplicates

Even with consumer groups, a message *can* be delivered twice (worker crashes after processing but before acknowledging). Most queues offer **at-least-once** delivery, not exactly-once.

The fix: make your consumers **idempotent** — safe to process the same message twice.

<span class="label label-ts">TypeScript</span>

```typescript
async function handleSendEmail(event: OrderPlaced) {
  // Check if we already processed this event
  const already = await db.query(
    "SELECT 1 FROM processed_events WHERE event_id = $1", [event.eventId]
  );
  if (already.rows.length > 0) return;  // already done, skip

  await sendEmail(event.customerEmail, event.orderId);

  // Record that we processed it
  await db.query(
    "INSERT INTO processed_events (event_id) VALUES ($1)", [event.eventId]
  );
}
```

| Problem | Solution |
|---|---|
| Multiple instances of same service | Consumer group — each message goes to one instance |
| Message delivered twice (retry/failure) | Idempotency — make processing safe to repeat |
| Different services need same event | Different consumer groups — each gets all messages |

<div class="callout info">
  <strong>Design every consumer to be idempotent.</strong> Processing the same message twice should produce the same result as processing it once. This is a fundamental rule of distributed systems.
</div>

## CQRS — Command Query Responsibility Segregation

CQRS separates your system into two sides: one optimized for **writing** data, another optimized for **reading** data.

<div class="callout tip">
  <strong>Real-World Example:</strong> A large retail banking app separated its transaction processing (writes) from account balance and statement views (reads) using CQRS. Writes went through a normalized, ACID-compliant command model that enforced business rules like overdraft limits. Reads were served from denormalized, pre-computed projections optimized for the mobile app's dashboard — showing balances, recent transactions, and spending summaries without any JOINs. This let them scale the read side to handle 50x more traffic during peak hours without impacting transaction processing.
</div>

### Why?

In most apps, reads vastly outnumber writes. But the data model that's good for writing (normalized, consistent) is often bad for reading (requires joins, slow queries). CQRS lets you optimize each side independently.

### The Problem CQRS Solves

Without CQRS, your query has to JOIN multiple tables every time someone views a page:

<span class="label label-ts">TypeScript</span>

```typescript
// Without CQRS — one database, queries do all the work
async getOrderSummaries(customerId: string) {
  return db.query(`
    SELECT o.id, o.total, o.status, o.created_at,
           c.name as customer_name,
           COUNT(oi.id) as item_count
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.customer_id = $1
    GROUP BY o.id, c.name
    ORDER BY o.created_at DESC
  `, [customerId]);
  // This JOIN runs every time someone views the page. Slow at scale.
}
```

With CQRS, the read side is **pre-computed** — the work happens once when data changes, not every time someone reads it.

### How It Works

```text
WITHOUT CQRS:
  orders ──┐
  customers ├──→ JOIN at query time ──→ UI
  order_items ┘    (slow, every time)

WITH CQRS:
  Write DB (normalized)          Read DB (denormalized)
  ┌─────────┐                    ┌──────────────────┐
  │ orders  │                    │ order_summaries   │
  │ items   │── event ──────────→│ (flat, pre-joined)│──→ UI
  │ customers│  "OrderPlaced"    │ no joins needed   │   (fast)
  └─────────┘                    └──────────────────┘
```

The **write side** uses normalized tables (good for consistency and business rules). The **read side** uses a flat, denormalized table that's updated when events happen — so queries never need JOINs.

### Normalized vs Denormalized — The Progression

Before any design, data starts as one big flat table with everything repeated — Alice's name appears on every row. If she changes her email, you update dozens of rows and risk inconsistency.

**Normalized** splits this into separate tables with no repetition. Alice's email exists once. But reading "Alice's orders with product names" now requires JOINing 3-4 tables.

**Denormalized** intentionally flattens it back into a read-optimized table — but it's derived from the normalized source, kept in sync via events.

| State | What it looks like | Trade-off |
|---|---|---|
| **Unnormalized** | One big table, everything repeated | Data inconsistency, update anomalies |
| **Normalized** | Separate tables, no repetition | Needs JOINs to read, slower queries |
| **Denormalized** | Flat tables built from normalized data | Redundant data, but fast reads |

<div class="callout info">
  <strong>Denormalized ≠ unnormalized.</strong> Denormalization is a deliberate choice — the normalized tables remain the source of truth (write side), and the denormalized table is a pre-computed view (read side) kept in sync via events.
</div>

### Read Tables in Practice

You create actual tables (or even a separate database) shaped for how the UI reads data. One read table per view is common:

```text
WRITE SIDE (one normalized database):
  customers, orders, order_items, products

READ SIDE (separate tables, one per view):
  order_summaries        → "My Orders" page
  product_bestsellers    → "Top Products" dashboard
  customer_activity_feed → admin "Recent Activity" view
```

Each table is shaped exactly for its query — no JOINs at read time. All are updated by event handlers listening to the same events:

<span class="label label-ts">TypeScript</span>

```typescript
eventBus.subscribe("OrderPlaced", async (event) => {
  // Update three different read tables from one event
  await readDb.query("INSERT INTO order_summaries ...", [...]);

  for (const item of event.items) {
    await readDb.query(
      "UPDATE product_bestsellers SET units_sold = units_sold + $1 WHERE product_id = $2",
      [item.quantity, item.productId]
    );
  }

  await readDb.query("INSERT INTO customer_activity_feed ...", [...]);
});
```

<div class="callout tip">
  <strong>The read side doesn't have to be the same database.</strong> You could write to Postgres, read from Elasticsearch for search, and read from Redis for dashboards. Each read store is optimized for its specific query pattern.
</div>

### Eventual Consistency — The Latency Trade-off

There's always a delay between writing data and the read model catching up. That's **eventual consistency** — typically milliseconds to a few seconds.

In practice, handle it with simple UX patterns:

<span class="label label-ts">TypeScript</span>

```typescript
// After placing an order, redirect to a confirmation page
// that reads from the WRITE side (source of truth)
router.post("/orders", async (req, res) => {
  const order = await orderService.create(req.body);
  // Don't redirect to the list page (read model might lag)
  res.redirect(`/orders/${order.id}/confirmation`);
});

// The list page uses the read model — by the time the user
// navigates there, the read model has caught up
```

<div class="callout info">
  <strong>For most apps, the lag is invisible.</strong> By the time a user clicks to another page, the read model has caught up. Only high-frequency trading or real-time collaboration apps need to worry about sub-second consistency.
</div>

### Polyglot Persistence — Different Stores for Different Queries

Different query patterns need different database types. The write side stays as one normalized database; the read side can fan out to multiple stores:

```text
WRITE SIDE:
  PostgreSQL (normalized, ACID, business rules)

EVENTS ──→ OrderPlaced, OrderShipped, etc.

READ SIDE (each optimized for its job):
  ├─ PostgreSQL:    order_summaries  → "My Orders" page
  ├─ Elasticsearch: products index   → Search ("red shoes under £50")
  ├─ Redis:         dashboard stats  → Admin dashboard (sub-ms reads)
  └─ DynamoDB:      activity feed    → High write throughput
```

<span class="label label-ts">TypeScript</span>

```typescript
eventBus.subscribe("OrderPlaced", async (event) => {
  // Same event, four different stores
  await postgres.query("INSERT INTO order_summaries ...", [...]);

  await elasticsearch.index("products", {
    script: { source: "ctx._source.orders += 1" }
  });

  await redis.hincrby("dashboard:today", "order_count", 1);
  await redis.hincrbyfloat("dashboard:today", "revenue", event.total);

  await dynamodb.put({
    TableName: "customer_activity",
    Item: { customerId: event.customerId, type: "order_placed", timestamp: Date.now() }
  });
});
```

| Problem | Why one DB struggles | Better read store |
|---|---|---|
| Full-text search with filters | Postgres `LIKE` is slow | Elasticsearch |
| Dashboard counters (millions of reads/sec) | Too many queries | Redis |
| Activity feed (massive write throughput) | Write locks | DynamoDB / Cassandra |
| Recommendation engine | Needs graph traversal | Neo4j |

<div class="callout">
  <strong>You only add separate stores when you have a specific performance problem.</strong> For most apps, one Postgres database with a few denormalized read tables is enough. Don't add Elasticsearch on day one — add it when search becomes a bottleneck.
</div>

### Managing Multiple Read Stores

The write side doesn't run scripts or poll for changes — it just publishes events. Each read store has its own **consumer service** that runs continuously, listening for events and updating its store:

<span class="label label-ts">TypeScript</span>

```typescript
// search-indexer service — runs 24/7, listens to Kafka
const consumer = kafka.consumer({ groupId: "search-indexer" });
await consumer.subscribe({ topic: "orders" });

await consumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());
    switch (event.type) {
      case "OrderPlaced":
        await elasticsearch.index({
          index: "orders", id: event.orderId,
          body: { customerId: event.customerId, total: event.total, status: "placed" }
        });
        break;
      case "OrderShipped":
        await elasticsearch.update({
          index: "orders", id: event.orderId,
          body: { doc: { status: "shipped" } }
        });
        break;
    }
  }
});
```

Each consumer is a separate service responsible for its own store. The write side doesn't know they exist.

| Problem | How it's handled |
|---|---|
| Consumer crashes | Kafka remembers the last processed offset. Consumer restarts where it left off. |
| Consumer falls behind | Catches up at its own pace. Read model is temporarily stale but self-heals. |
| Rebuild a read store from scratch | Replay all events from the beginning of the log. |
| Add a new read store later | Deploy a new consumer, start from the beginning — nothing else changes. |

<div class="callout tip">
  <strong>For simpler setups</strong> (one Postgres for both write and read tables), you don't need Kafka or separate services. The event handler can live in the same app: <code>eventBus.on("OrderPlaced", async (e) => { await db.query("INSERT INTO order_summaries ...") })</code>. Scale up to Kafka when you actually need separate databases.
</div>

<span class="label label-ts">TypeScript</span> — Write side:

```typescript
// Command handler — validates and writes
class PlaceOrderHandler {
  constructor(
    private orderRepo: OrderRepository,
    private eventBus: EventBus,
  ) {}

  async handle(cmd: PlaceOrderCommand) {
    const order = new Order(cmd.customerId, cmd.items);
    order.validate();  // business rules
    await this.orderRepo.save(order);
    await this.eventBus.publish("OrderPlaced", {
      orderId: order.id,
      customerId: order.customerId,
      items: order.items,
      total: order.total,
    });
  }
}
```

<span class="label label-ts">TypeScript</span> — Read side:

```typescript
// Event handler — updates the read model
eventBus.subscribe("OrderPlaced", async (event) => {
  // Denormalized view — pre-joined, ready to query
  await readDb.query(`
    INSERT INTO order_summaries (order_id, customer_name, total, status, item_count)
    SELECT $1, c.name, $2, 'placed', $3
    FROM customers c WHERE c.id = $4
  `, [event.orderId, event.total, event.items.length, event.customerId]);
});

// Query handler — fast, no joins needed
class OrderSummaryQuery {
  async getByCustomer(customerId: string): Promise<OrderSummary[]> {
    return readDb.query(
      "SELECT * FROM order_summaries WHERE customer_id = $1 ORDER BY created_at DESC",
      [customerId]
    );
  }
}
```

### CQRS Complexity Levels

CQRS doesn't require events, Kafka, or separate databases. At its simplest, it's just "use a different code path for reads than writes":

| Level | What it looks like | Events? | Separate DB? | Eventual consistency? |
|---|---|---|---|---|
| **1. Separate query classes** | Different service for reads vs writes, same DB | No | No | No |
| **2. Denormalized read tables** | Read tables updated in same transaction | Optional | No | No |
| **3. Separate read stores** | Events sync to Elasticsearch/Redis/etc | Yes | Yes | Yes |
| **4. Event sourcing + CQRS** | Events are source of truth, read models are projections | Yes | Yes | Yes |

<span class="label label-ts">TypeScript</span> — Level 1 (simplest CQRS, no events):

```typescript
// Write: domain model with business rules
class OrderService {
  async placeOrder(cmd: PlaceOrderCommand) {
    const order = new Order(cmd.customerId, cmd.items);
    order.validate();
    await this.orderRepo.save(order);
  }
}

// Read: separate query class, same database, optimized SQL
class OrderQueryService {
  async getOrderSummaries(customerId: string) {
    return db.query(`
      SELECT o.id, o.total, c.name, COUNT(oi.id) as items
      FROM orders o JOIN customers c ON ... JOIN order_items oi ON ...
      WHERE o.customer_id = $1 GROUP BY ...
    `, [customerId]);
  }
}
// That's CQRS. Two code paths. No events, no Kafka, one database.
```

<div class="callout tip">
  <strong>Most apps only need Level 1 or 2.</strong> Separate your read and write code paths first. Add denormalized tables when JOINs get slow. Add events and separate databases only when you hit a specific scaling problem. Don't start at Level 4.
</div>

### Other Trade-offs

| Benefit | Cost |
|---|---|
| Read and write models optimized independently | More complexity — two models to maintain |
| Read side can scale separately | Eventual consistency — read model lags behind writes |
| Queries are fast (pre-computed) | Need event infrastructure to sync models |
| Write side stays clean (no query concerns) | Harder to reason about than simple CRUD |

<div class="callout info">
  <strong>When to use CQRS:</strong> When reads and writes have very different requirements. A simple CRUD app doesn't need it. A dashboard reading from 10 tables while writes go to normalized tables? CQRS shines.
</div>

## Event Sourcing

Instead of storing the **current state** of an entity, you store the **sequence of events** that led to that state. The event log is the source of truth.

<div class="callout tip">
  <strong>Real-World Example:</strong> LMAX Exchange, a financial trading platform, uses event sourcing to store every trade, order placement, and cancellation as an immutable event. This gives them a complete audit trail required by financial regulators and the ability to reconstruct the exact state of any account at any point in time. When they needed to investigate a disputed trade, they replayed events up to that millisecond to see exactly what happened — something impossible with a traditional database that only stores current state.
</div>

### Traditional vs Event Sourced

**Traditional:** Store current state, overwrite on change.

```text
orders table:
| id  | status    | total | updated_at |
| 123 | shipped   | 59.99 | 2024-03-15 |
```

What happened between creation and shipping? No idea.

**Event Sourced:** Store every event, derive current state.

```text
events table:
| event_id | aggregate_id | type           | data                          | timestamp  |
| 1        | order-123    | OrderCreated   | {customerId: "42", items: []} | 2024-03-10 |
| 2        | order-123    | ItemAdded      | {productId: "A", qty: 2}      | 2024-03-10 |
| 3        | order-123    | ItemAdded      | {productId: "B", qty: 1}      | 2024-03-10 |
| 4        | order-123    | OrderSubmitted | {total: 59.99}                | 2024-03-11 |
| 5        | order-123    | PaymentTaken   | {amount: 59.99, method: card} | 2024-03-12 |
| 6        | order-123    | OrderShipped   | {trackingId: "XYZ789"}        | 2024-03-15 |
```

Full history. You can reconstruct the order at any point in time.

### Implementation

<span class="label label-ts">TypeScript</span>

```typescript
// Events
type OrderEvent =
  | { type: "OrderCreated"; customerId: string }
  | { type: "ItemAdded"; productId: string; quantity: number; price: number }
  | { type: "OrderSubmitted"; total: number }
  | { type: "PaymentTaken"; amount: number }
  | { type: "OrderShipped"; trackingId: string };

// Rebuild state by replaying events
class Order {
  id: string;
  status: string = "draft";
  items: OrderItem[] = [];
  total: number = 0;

  static fromEvents(id: string, events: OrderEvent[]): Order {
    const order = new Order();
    order.id = id;
    for (const event of events) {
      order.apply(event);
    }
    return order;
  }

  private apply(event: OrderEvent) {
    switch (event.type) {
      case "OrderCreated":
        this.status = "draft";
        break;
      case "ItemAdded":
        this.items.push({ productId: event.productId, quantity: event.quantity, price: event.price });
        break;
      case "OrderSubmitted":
        this.status = "submitted";
        this.total = event.total;
        break;
      case "PaymentTaken":
        this.status = "paid";
        break;
      case "OrderShipped":
        this.status = "shipped";
        break;
    }
  }
}

// Load an order: fetch events, replay them
async function loadOrder(id: string): Promise<Order> {
  const events = await eventStore.getEvents(id);
  return Order.fromEvents(id, events);
}
```

<span class="label label-py">Python</span>

```python
class Order:
    def __init__(self):
        self.status = "draft"
        self.items = []
        self.total = 0

    @classmethod
    def from_events(cls, events: list[dict]) -> "Order":
        order = cls()
        for event in events:
            order._apply(event)
        return order

    def _apply(self, event: dict):
        match event["type"]:
            case "OrderCreated":
                self.status = "draft"
            case "ItemAdded":
                self.items.append({"product_id": event["product_id"], "qty": event["qty"]})
            case "OrderSubmitted":
                self.status = "submitted"
                self.total = event["total"]
            case "OrderShipped":
                self.status = "shipped"
```

### Trade-offs

| Benefit | Cost |
|---|---|
| Complete audit trail for free | More complex than simple CRUD |
| Reconstruct state at any point in time | Replaying many events can be slow (use snapshots) |
| Debug production issues by replaying events | Schema evolution of events is tricky |
| Natural fit with CQRS and event-driven architecture | Eventual consistency |
| Can replay events to build new read models | Harder to query (need projections) |

<div class="callout">
  <strong>Snapshots:</strong> If an entity has thousands of events, replaying them all is slow. Take periodic snapshots (save the current state) and only replay events after the snapshot.
</div>

## Saga Pattern

When a business process spans multiple services, you can't use a traditional database transaction. A **Saga** breaks the process into steps, each with a **compensating action** to undo it if a later step fails.

<div class="callout tip">
  <strong>Real-World Example:</strong> An airline booking platform like Expedia coordinates flights, hotels, and car rentals across separate provider services using the Saga pattern. When a customer books a vacation package, the system reserves a flight, then a hotel, then a rental car. If the car rental fails (no availability), compensating actions automatically cancel the hotel reservation and release the flight seat. They use an orchestrator service to manage the multi-step workflow, making it easy to track which step failed and ensure all compensations execute correctly.
</div>

### Example: Place Order

```text
1. Order Service    → Create order (pending)
2. Payment Service  → Charge customer
3. Inventory Service → Reserve stock
4. Shipping Service → Schedule delivery

If step 3 fails:
  → Undo step 2: Refund payment
  → Undo step 1: Cancel order
```

### Two Approaches

**Choreography** — services react to events, no central coordinator:

```text
OrderService                    PaymentService              InventoryService
    │                               │                           │
    ├── publishes OrderPlaced ──────►                           │
    │                               ├── publishes PaymentTaken ─►
    │                               │                           ├── publishes StockReserved
    │                               │                           │
    │   If StockReserveFailed: ◄────┤── refunds payment ◄──────┤
    ├── cancels order               │                           │
```

<span class="label label-ts">TypeScript</span>

```typescript
// Each service listens and reacts
eventBus.subscribe("OrderPlaced", async (event) => {
  try {
    await paymentService.charge(event.customerId, event.total);
    await eventBus.publish("PaymentTaken", { orderId: event.orderId });
  } catch {
    await eventBus.publish("PaymentFailed", { orderId: event.orderId });
  }
});

eventBus.subscribe("PaymentTaken", async (event) => {
  try {
    await inventoryService.reserve(event.orderId);
    await eventBus.publish("StockReserved", { orderId: event.orderId });
  } catch {
    await eventBus.publish("StockReserveFailed", { orderId: event.orderId });
  }
});

// Compensating actions
eventBus.subscribe("StockReserveFailed", async (event) => {
  await paymentService.refund(event.orderId);
  await orderService.cancel(event.orderId);
});
```

**Orchestration** — a central coordinator manages the steps:

<span class="label label-ts">TypeScript</span>

```typescript
class PlaceOrderSaga {
  async execute(order: Order) {
    try {
      await this.paymentService.charge(order.customerId, order.total);
      await this.inventoryService.reserve(order.id, order.items);
      await this.shippingService.schedule(order.id);
      await this.orderService.confirm(order.id);
    } catch (error) {
      // Compensate in reverse order
      await this.shippingService.cancel(order.id).catch(() => {});
      await this.inventoryService.release(order.id).catch(() => {});
      await this.paymentService.refund(order.id).catch(() => {});
      await this.orderService.cancel(order.id);
    }
  }
}
```

### Choreography vs Orchestration

| | Choreography | Orchestration |
|---|---|---|
| **Coordination** | Decentralized (events) | Central coordinator |
| **Coupling** | Very loose | Coordinator knows all steps |
| **Visibility** | Hard to see the full flow | Easy to see in one place |
| **Complexity** | Grows with number of services | Stays in one class |
| **Best for** | Simple flows, few steps | Complex flows, many steps |

<div class="callout tip">
  <strong>Start with orchestration</strong> for complex flows — it's easier to understand and debug. Use choreography when services are truly independent and the flow is simple.
</div>

## Putting It All Together

These patterns often combine:

```text
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                          │
└──────────────────────┬──────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Order Service  │
              │  (Write Model)  │
              └────────┬────────┘
                       │ publishes OrderPlaced event
                       ▼
              ┌─────────────────┐
              │  Event Stream   │ (Kafka / Kinesis)
              └──┬──────┬───┬──┘
                 │      │   │
         ┌───────▼┐  ┌──▼──┐ ┌▼────────────┐
         │Inventory│  │Email│ │Read Model   │
         │Service  │  │Svc  │ │(Projections)│
         └─────────┘  └─────┘ └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │ Query API   │
                              │ (Read Model)│
                              └─────────────┘
```

- **Event-driven** — services communicate via events
- **CQRS** — separate write model (Order Service) and read model (Projections)
- **Event sourcing** — optionally store events as source of truth
- **Saga** — coordinate multi-service transactions

## Key Takeaways

1. **Event-driven architecture** decouples services — producers don't know about consumers
2. **Commands** = "do this" (one handler). **Events** = "this happened" (many listeners)
3. **Message queues** = one consumer per message (tasks). **Event streams** = multiple consumers, messages persist (events)
4. **CQRS** = separate read and write models when they have different requirements
5. **Event sourcing** = store events, not state. Full audit trail, reconstruct any point in time
6. **Sagas** = manage distributed transactions with compensating actions
7. These patterns add complexity — use them when the problem demands it, not by default

## Check Your Understanding

{{< quiz >}}

## Scenario Challenges

{{< case-studies >}}

## Interactive Case Studies

{{< interactive-cases >}}
