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
---

## Event-Driven Architecture

In a traditional architecture, services call each other directly. In an event-driven architecture, services communicate by **producing and consuming events**. The producer doesn't know who's listening.

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

### Trade-offs

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
