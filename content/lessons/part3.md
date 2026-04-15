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

{{< audio-player part="part3" >}}

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
  <strong>Adding a new subscriber?</strong> Just subscribe. OrderService doesn't change. That's loose coupling through events.
</div>

### Events Don't Replace APIs

Events and queues sit alongside APIs and direct calls, not instead of them. A typical system uses both:

```text
User → API (REST) → Order Service → saves to DB (synchronous)
                                   → publishes event (asynchronous)
                                   → returns response to user

The user waits for the API response.
Downstream services react to the event in the background.
```

You wouldn't replace `GET /orders/123` with an event. The user needs a response now. But you would replace "Order Service directly calls Email Service and Analytics Service" with events, because the user doesn't need to wait for those.

| Use case | Use |
|---|---|
| User needs a response now | API / direct call |
| User doesn't need to wait for this | Event / queue |
| One service needs data from another | API call |
| Multiple services need to react to something | Event |
| Need to retry failed work | Queue |
| Need audit trail / replay | Event stream |

<div class="callout tip">
  <strong>Most production systems are a mix.</strong> The API handles the request, does the critical work synchronously, then fires off events for everything else. Events add a decoupled, resilient layer for scaling and audit history. They don't replace your API.
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
  <strong>Rule of thumb:</strong> Commands can fail ("sorry, not enough stock"). Events are facts. They already happened and can't be undone, only reacted to.
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

<span class="label label-py">Python</span>, conceptual:

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

<span class="label label-py">Python</span>, conceptual:

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

### Building a Queue-Driven System

Queue-driven architecture is about **task distribution**. A producer puts work on a queue, workers pick it up and process it. The queue acts as a buffer between the producer and consumers.

<span class="label label-ts">TypeScript</span> - SQS example:

```typescript
// Producer: order service puts work on the queue after saving
class OrderService {
  async placeOrder(order: Order) {
    await this.orderRepo.save(order);
    await this.res.status(201).json(order); // respond to user immediately

    // Queue background tasks (user doesn't wait for these)
    await sqs.sendMessage({
      QueueUrl: EMAIL_QUEUE_URL,
      MessageBody: JSON.stringify({ type: "send_confirmation", orderId: order.id })
    });
    await sqs.sendMessage({
      QueueUrl: INVOICE_QUEUE_URL,
      MessageBody: JSON.stringify({ type: "generate_invoice", orderId: order.id })
    });
  }
}

// Consumer: email worker runs separately, processes one message at a time
async function emailWorker() {
  while (true) {
    const result = await sqs.receiveMessage({
      QueueUrl: EMAIL_QUEUE_URL,
      WaitTimeSeconds: 20  // long polling, waits for messages
    });

    for (const message of result.Messages ?? []) {
      const task = JSON.parse(message.Body);
      await sendConfirmationEmail(task.orderId);
      await sqs.deleteMessage({
        QueueUrl: EMAIL_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle  // acknowledge: done, remove it
      });
    }
  }
}
```

Key characteristics:
- **Buffering**: if the email service is slow or down, messages pile up in the queue and get processed when it recovers
- **Scaling**: run 10 email workers and they compete for messages. Each message goes to one worker.
- **Retry**: if a worker crashes before deleting the message, it becomes visible again after a timeout and another worker picks it up
- **Dead letter queue**: messages that fail repeatedly get moved to a separate queue for investigation

```text
Order Service → [ Email Queue ] → Email Worker 1
                                → Email Worker 2  (competing)
                                → Email Worker 3

              → [ Invoice Queue ] → Invoice Worker 1
                                  → Invoice Worker 2
```

### Building an Event Stream-Driven System

Stream-driven architecture is about **broadcasting facts**. A producer appends events to a log. Multiple consumers read from the log independently, each at their own pace.

<span class="label label-ts">TypeScript</span> - Kafka example:

```typescript
// Producer: order service publishes an event (a fact about what happened)
class OrderService {
  async placeOrder(order: Order) {
    await this.orderRepo.save(order);

    // Publish one event, multiple services will consume it
    await kafka.producer.send({
      topic: "order-events",
      messages: [{
        key: order.id,  // ensures all events for same order go to same partition
        value: JSON.stringify({
          type: "OrderPlaced",
          orderId: order.id,
          customerId: order.customerId,
          items: order.items,
          total: order.total,
          timestamp: new Date()
        })
      }]
    });
  }
}

// Consumer 1: email service (consumer group "email")
const emailConsumer = kafka.consumer({ groupId: "email-service" });
await emailConsumer.subscribe({ topic: "order-events" });
await emailConsumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());
    if (event.type === "OrderPlaced") {
      await sendConfirmationEmail(event.customerId, event.orderId);
    }
  }
});

// Consumer 2: analytics service (consumer group "analytics")
// Reads the SAME events independently
const analyticsConsumer = kafka.consumer({ groupId: "analytics-service" });
await analyticsConsumer.subscribe({ topic: "order-events" });
await analyticsConsumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());
    if (event.type === "OrderPlaced") {
      await trackRevenue(event.total);
      await updateDashboard(event);
    }
  }
});

// Consumer 3: search indexer (consumer group "search")
// Also reads the SAME events
const searchConsumer = kafka.consumer({ groupId: "search-indexer" });
await searchConsumer.subscribe({ topic: "order-events" });
await searchConsumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());
    if (event.type === "OrderPlaced") {
      await elasticsearch.index({ index: "orders", id: event.orderId, body: event });
    }
  }
});
```

Key characteristics:
- **One event, many consumers**: publish once, three services each process it independently
- **Persistence**: events stay in Kafka for days/weeks (configurable retention)
- **Replay**: new service added next month? Subscribe from the beginning, process all historical events
- **Ordering**: events with the same key (orderId) are guaranteed to arrive in order within a partition
- **Consumer independence**: if analytics is slow, email and search are unaffected

```text
Order Service → [ Kafka: order-events ]
                    │
                    ├── Consumer Group "email"     → Email Service
                    ├── Consumer Group "analytics"  → Analytics Service
                    └── Consumer Group "search"     → Search Indexer

Each group reads ALL events independently.
Within a group, partitions are split across instances.
```

### Queue vs Stream: Side by Side

The same scenario implemented both ways:

```typescript
// QUEUE approach: order service sends specific tasks to specific queues
await emailQueue.send({ task: "send_confirmation", orderId: "123" });
await invoiceQueue.send({ task: "generate_invoice", orderId: "123" });
await analyticsQueue.send({ task: "track_order", orderId: "123" });
// Order service knows about every downstream consumer. Adding a new one = change order service.

// STREAM approach: order service publishes one event
await kafka.publish("order-events", { type: "OrderPlaced", orderId: "123", ... });
// Order service doesn't know who's listening. Adding a new consumer = deploy new service. Done.
```

<div class="callout tip">
  <strong>Start with queues</strong> when you have simple background tasks (send email, generate PDF). Move to streams when multiple services need the same events, or when you need replay and audit capabilities. Many systems use both: queues for task processing, streams for event broadcasting.
</div>

### Using Events and Queues Together

In practice, events and queues often work in the same flow. The event broadcasts what happened. The queue handles the specific task with retry guarantees.

```text
Kafka (event stream)                    SQS (queue)

OrderPlaced event --> Email Service --> [ Email Send Queue ] --> Email Worker
                  --> Analytics Service                         (retries, rate limits)
                  --> Search Indexer
```

The email service consumes the **event** from Kafka (to know an order was placed), then puts a **task** on a queue (to actually send the email with retries):

<span class="label label-ts">TypeScript</span>

```typescript
// Email service: consumes the EVENT from Kafka
kafkaConsumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());
    if (event.type === "OrderPlaced") {
      // Puts a TASK on a queue
      await sqs.sendMessage({
        QueueUrl: EMAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          to: event.customerEmail,
          template: "order_confirmation",
          orderId: event.orderId
        })
      });
    }
  }
});

// Email worker: processes the TASK from the queue
// Handles retries, rate limiting, failures
async function emailWorker() {
  const result = await sqs.receiveMessage({ QueueUrl: EMAIL_QUEUE_URL });
  for (const message of result.Messages ?? []) {
    try {
      const task = JSON.parse(message.Body);
      await sendgrid.send(task.to, task.template, task.data);
      await sqs.deleteMessage({ QueueUrl: EMAIL_QUEUE_URL, ReceiptHandle: message.ReceiptHandle });
    } catch {
      // Don't delete. Message becomes visible again after timeout.
      // SQS retries automatically. After 3 failures, goes to dead letter queue.
    }
  }
}
```

| | Event (stream) | Task (queue) |
|---|---|---|
| Says | "An order was placed" | "Send this specific email" |
| Who cares | Anyone who wants to know | One worker that sends emails |
| If it fails | Other consumers unaffected | Retried automatically |
| Multiple consumers | Yes, that's the point | No, one worker picks it up |

<div class="callout info">
  <strong>For a simple system, you can skip the queue</strong> and have the email service send directly when it gets the event. The queue becomes useful when you need retry guarantees, rate limiting (email providers have send limits), or buffering during traffic spikes.
</div>

## Guaranteeing Eventual Delivery

In a distributed system, things fail: the network drops, a service crashes, a database times out. How do you make sure messages and events are never lost?

### The Dual-Write Problem

The most common bug in event-driven systems: you save to the database and publish an event, but one succeeds and the other fails.

<span class="label label-ts">TypeScript</span>

```typescript
// DANGEROUS: dual-write
async placeOrder(order: Order) {
  await db.query("INSERT INTO orders ...", [order]);  // succeeds
  await kafka.publish("OrderPlaced", order);           // fails! network error
  // Order is saved but no event was published.
  // Downstream services never know about this order.
}
```

### The Outbox Pattern

The fix: don't publish events directly. Write the event to an **outbox table** in the same database transaction as your data. A separate process reads the outbox and publishes to Kafka.

<span class="label label-ts">TypeScript</span>

```typescript
// SAFE: outbox pattern
async placeOrder(order: Order) {
  await db.transaction(async (tx) => {
    // Both writes in the same transaction: both succeed or both fail
    await tx.query("INSERT INTO orders ...", [order]);
    await tx.query(
      "INSERT INTO outbox (event_type, payload, published) VALUES ($1, $2, false)",
      ["OrderPlaced", JSON.stringify(order)]
    );
  });
  // No Kafka call here. The transaction guarantees both rows exist.
}

// Separate process: outbox publisher (runs on a schedule or continuously)
async function publishOutbox() {
  const events = await db.query(
    "SELECT * FROM outbox WHERE published = false ORDER BY created_at LIMIT 100"
  );
  for (const event of events.rows) {
    await kafka.publish(event.event_type, JSON.parse(event.payload));
    await db.query("UPDATE outbox SET published = true WHERE id = $1", [event.id]);
  }
}
```

```text
Order Service                    Outbox Table              Kafka
     │                               │                       │
     ├── INSERT order ───────────────►│                       │
     ├── INSERT outbox event ────────►│                       │
     │   (same transaction)           │                       │
     │                                │                       │
     │              Outbox Publisher ──┤                       │
     │              (polls or CDC)    ├── publish event ──────►│
     │                                ├── mark as published   │
```

<div class="callout info">
  <strong>Change Data Capture (CDC)</strong> is an alternative to polling the outbox. Tools like Debezium watch the database transaction log and automatically publish new outbox rows to Kafka. No polling delay, no missed events.
</div>

### Dead Letter Queues

When a message fails processing repeatedly, you don't want it blocking the queue forever. A **dead letter queue (DLQ)** catches these failed messages for investigation.

```text
Main Queue                          Dead Letter Queue
┌──────────┐                        ┌──────────┐
│ message A │──→ Worker: success ✓   │          │
│ message B │──→ Worker: fail        │          │
│           │──→ Worker: fail (retry)│          │
│           │──→ Worker: fail (retry)│ message B│ ← moved here after 3 failures
└──────────┘                        └──────────┘
```

<span class="label label-ts">TypeScript</span> - SQS dead letter queue config:

```typescript
// When creating the queue, configure the DLQ
await sqs.createQueue({
  QueueName: "order-emails",
  Attributes: {
    RedrivePolicy: JSON.stringify({
      deadLetterTargetArn: "arn:aws:sqs:eu-west-1:123456:order-emails-dlq",
      maxReceiveCount: "3"  // after 3 failed attempts, move to DLQ
    })
  }
});

// Monitor the DLQ: alert if messages appear
// These are messages that need human investigation
```

<div class="callout tip">
  <strong>Always set up DLQ monitoring.</strong> A growing DLQ means something is broken. Common causes: malformed messages, downstream service permanently down, or a bug in the consumer. Fix the root cause, then replay the DLQ messages.
</div>

### Durable Queues and Persistence

By default, most message brokers persist messages to disk so they survive restarts:

| Broker | Durability | How |
|---|---|---|
| **SQS** | Durable by default | Messages stored redundantly across multiple AZs |
| **RabbitMQ** | Optional | Mark queues and messages as `durable`. Without it, a restart loses everything |
| **Kafka** | Durable by default | Messages written to disk, replicated across brokers |

<span class="label label-ts">TypeScript</span> - RabbitMQ durable queue:

```typescript
// Create a durable queue (survives broker restart)
await channel.assertQueue("order-emails", { durable: true });

// Publish a persistent message (written to disk, not just memory)
channel.sendToQueue("order-emails", Buffer.from(JSON.stringify(task)), {
  persistent: true
});
```

### Replay Handling

When things go wrong, you need to reprocess messages. How depends on your infrastructure:

**Event streams (Kafka):** Reset the consumer's offset to replay from any point.

```typescript
// Replay all events from the beginning
const consumer = kafka.consumer({ groupId: "search-indexer-rebuild" });
await consumer.subscribe({ topic: "order-events", fromBeginning: true });
// Processes every event ever published
```

**Queues (SQS):** Messages are deleted after processing, so you can't replay from the queue. Instead, replay from the DLQ or re-publish from the outbox.

```typescript
// Replay failed messages from the DLQ
const dlqMessages = await sqs.receiveMessage({ QueueUrl: DLQ_URL });
for (const msg of dlqMessages.Messages ?? []) {
  // Move back to the main queue for reprocessing
  await sqs.sendMessage({ QueueUrl: MAIN_QUEUE_URL, MessageBody: msg.Body });
  await sqs.deleteMessage({ QueueUrl: DLQ_URL, ReceiptHandle: msg.ReceiptHandle });
}

// Or replay from the outbox table
const missed = await db.query(
  "SELECT * FROM outbox WHERE published = false AND created_at > $1",
  [sinceTimestamp]
);
```

### Summary: Delivery Guarantees

| Pattern | What it solves |
|---|---|
| **Outbox pattern** | Prevents data saved but event lost (dual-write problem) |
| **Dead letter queue** | Catches messages that fail repeatedly for investigation |
| **Durable queues** | Messages survive broker restarts |
| **Replay (streams)** | Reprocess events from any point in time |
| **Replay (DLQ/outbox)** | Reprocess failed or missed messages |
| **Idempotent consumers** | Makes all of the above safe to retry |

<div class="callout tip">
  <strong>These patterns work together.</strong> The outbox guarantees the event is published. Durable queues guarantee it's not lost in transit. The DLQ catches processing failures. Idempotent consumers make retries safe. Each layer covers a different failure mode.
</div>

## Multiple Consumers and Idempotency

When you scale a service to multiple instances, how do you prevent the same message being processed twice?

<div class="callout tip">
  <strong>Real-World Example:</strong> Stripe's payment processing system handles idempotency as a core design principle. Every API request accepts an idempotency key, so if a network failure causes a client to retry a payment charge, Stripe recognizes the duplicate and returns the original result instead of charging the customer twice. This matters at scale. Stripe processes billions of API requests where even a tiny percentage of duplicates would mean real money lost.
</div>

### Consumer Groups

**Queues** handle this automatically. Multiple instances of the email service compete for messages, and each message goes to exactly one instance:

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

### Idempotency, Handling Duplicates

Even with consumer groups, a message *can* be delivered twice (worker crashes after processing but before acknowledging). Most queues offer **at-least-once** delivery, not exactly-once.

The fix: make your consumers **idempotent**, meaning safe to process the same message twice.

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
| Multiple instances of same service | Consumer group, each message goes to one instance |
| Message delivered twice (retry/failure) | Idempotency, makes processing safe to repeat |
| Different services need same event | Different consumer groups, each gets all messages |

<div class="callout info">
  <strong>Design every consumer to be idempotent.</strong> Processing the same message twice should produce the same result as processing it once.
</div>

## CQRS, Command Query Responsibility Segregation

CQRS separates your system into two sides: one optimized for **writing** data, another optimized for **reading** data.

<div class="callout tip">
  <strong>Real-World Example:</strong> A large retail banking app separated its transaction processing (writes) from account balance and statement views (reads) using CQRS. Writes went through a normalized, ACID-compliant command model that enforced business rules like overdraft limits. Reads were served from denormalized, pre-computed projections optimized for the mobile app's dashboard, showing balances, recent transactions, and spending summaries without any JOINs. This let them scale the read side to handle 50x more traffic during peak hours without impacting transaction processing.
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

With CQRS, the read side is **pre-computed**. The work happens once when data changes, not every time someone reads it.

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

The **write side** uses normalized tables (good for consistency and business rules). The **read side** uses a flat, denormalized table that's updated when events happen, so queries never need JOINs.

### Normalized vs Denormalized, The Progression

Before any design, data starts as one big flat table with everything repeated. Alice's name appears on every row. If she changes her email, you update dozens of rows and risk inconsistency.

**Normalized** splits this into separate tables with no repetition. Alice's email exists once. But reading "Alice's orders with product names" now requires JOINing 3-4 tables.

**Denormalized** intentionally flattens it back into a read-optimized table, but it's derived from the normalized source, kept in sync via events.

| State | What it looks like | Trade-off |
|---|---|---|
| **Unnormalized** | One big table, everything repeated | Data inconsistency, update anomalies |
| **Normalized** | Separate tables, no repetition | Needs JOINs to read, slower queries |
| **Denormalized** | Flat tables built from normalized data | Redundant data, but fast reads |

<div class="callout info">
  <strong>Denormalized ≠ unnormalized.</strong> Denormalization is a deliberate choice. The normalized tables remain the source of truth (write side), and the denormalized table is a pre-computed view (read side) kept in sync via events.
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

Each table is shaped exactly for its query, with no JOINs at read time. All are updated by event handlers listening to the same events:

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

### Eventual Consistency, The Latency Trade-off

There's always a delay between writing data and the read model catching up. That's **eventual consistency**, typically milliseconds to a few seconds.

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

### Polyglot Persistence, Different Stores for Different Queries

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
  <strong>You only add separate stores when you have a specific performance problem.</strong> For most apps, one Postgres database with a few denormalized read tables is enough. Don't add Elasticsearch on day one. Add it when search becomes a bottleneck.
</div>

### Managing Multiple Read Stores

The write side doesn't run scripts or poll for changes. It just publishes events. Each read store has its own **consumer service** that runs continuously, listening for events and updating its store:

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
| Add a new read store later | Deploy a new consumer, start from the beginning. Nothing else changes. |

<div class="callout tip">
  <strong>For simpler setups</strong> (one Postgres for both write and read tables), you don't need Kafka or separate services. The event handler can live in the same app: <code>eventBus.on("OrderPlaced", async (e) => { await db.query("INSERT INTO order_summaries ...") })</code>. Scale up to Kafka when you actually need separate databases.
</div>

<span class="label label-ts">TypeScript</span>, Write side:

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

<span class="label label-ts">TypeScript</span>, Read side:

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

<span class="label label-ts">TypeScript</span>, Level 1 (simplest CQRS, no events):

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

Compare with the non-CQRS version, where one service does everything:

```typescript
// Without CQRS — reads and writes in one service
class OrderService {
  // Writes — use domain model
  async placeOrder(cmd: PlaceOrderCommand) {
    const order = new Order(cmd.customerId, cmd.items);
    order.validate();
    await this.orderRepo.save(order);
  }
  async cancelOrder(id: string) {
    const order = await this.orderRepo.findById(id);
    order.cancel();
    await this.orderRepo.save(order);
  }

  // Reads — raw SQL, don't use domain model at all
  async getOrderSummaries(customerId: string) { /* JOIN 3 tables */ }
  async getDashboardStats() { /* JOIN 5 tables, aggregate */ }
  async searchOrders(filters: SearchFilters) { /* complex WHERE */ }
  async getTopProducts(period: string) { /* GROUP BY, ORDER BY */ }

  // Service is now half business logic, half reporting queries
}
```

<div class="callout info">
  <strong>The non-CQRS service works fine until reads get complex.</strong> When you have 4+ read methods with complex JOINs that don't use the domain model, the service becomes half business logic, half reporting. CQRS Level 1 just splits them into two classes. The write service stays focused on rules, the query service stays focused on fast reads.
</div>

<div class="callout tip">
  <strong>Most apps only need Level 1 or 2.</strong> Separate your read and write code paths first. Add denormalized tables when JOINs get slow. Add events and separate databases only when you hit a specific scaling problem. Don't start at Level 4.
</div>

### Other Trade-offs

| Benefit | Cost |
|---|---|
| Read and write models optimized independently | More complexity, two models to maintain |
| Read side can scale separately | Eventual consistency, read model lags behind writes |
| Queries are fast (pre-computed) | Need event infrastructure to sync models |
| Write side stays clean (no query concerns) | Harder to reason about than simple CRUD |

<div class="callout info">
  <strong>When to use CQRS:</strong> When reads and writes have very different requirements. A simple CRUD app doesn't need it. A dashboard reading from 10 tables while writes go to normalized tables? CQRS shines.
</div>

## Event Sourcing

Instead of storing the **current state** of an entity, you store the **sequence of events** that led to that state. The event log is the source of truth.

<div class="callout tip">
  <strong>Real-World Example:</strong> LMAX Exchange, a financial trading platform, uses event sourcing to store every trade, order placement, and cancellation as an immutable event. This gives them a complete audit trail required by financial regulators and the ability to reconstruct the exact state of any account at any point in time. When they needed to investigate a disputed trade, they replayed events up to that millisecond to see exactly what happened. This is impossible with a traditional database that only stores current state.
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

<details>
<summary><strong>🔍 Dry Run: Watch Event Sourcing Step by Step</strong></summary>

**Step 1: User creates an order:**

| # | Event | Data |
|---|---|---|
| 1 | OrderCreated | `{ customerId: "cust-42" }` |

State after replay → `Order { status: "draft", items: [], total: 0 }`

**Step 2: Adds a Widget (£29.99 × 2):**

| # | Event | Data |
|---|---|---|
| 1 | OrderCreated | `{ customerId: "cust-42" }` |
| 2 | ItemAdded | `{ productId: "widget", qty: 2, price: 29.99 }` |

State after replay → `Order { status: "draft", items: [widget×2], total: 0 }`

**Step 3: Adds a Gadget (£15.00 × 1):**

| # | Event | Data |
|---|---|---|
| 1 | OrderCreated | `{ customerId: "cust-42" }` |
| 2 | ItemAdded | `{ productId: "widget", qty: 2, price: 29.99 }` |
| 3 | ItemAdded | `{ productId: "gadget", qty: 1, price: 15.00 }` |

State after replay → `Order { status: "draft", items: [widget×2, gadget×1], total: 0 }`

**Step 4: Submits the order:**

| # | Event | Data |
|---|---|---|
| 1 | OrderCreated | `{ customerId: "cust-42" }` |
| 2 | ItemAdded | `{ productId: "widget", qty: 2, price: 29.99 }` |
| 3 | ItemAdded | `{ productId: "gadget", qty: 1, price: 15.00 }` |
| 4 | OrderSubmitted | `{ total: 74.98 }` |

State after replay → `Order { status: "submitted", items: [widget×2, gadget×1], total: 74.98 }`

**Step 5: Payment taken:**

| # | Event | Data |
|---|---|---|
| 1–4 | ... | (same as above) |
| 5 | PaymentTaken | `{ amount: 74.98 }` |

State after replay → `Order { status: "paid", total: 74.98 }`

**Step 6: Shipped:**

| # | Event | Data |
|---|---|---|
| 1–5 | ... | (same as above) |
| 6 | OrderShipped | `{ trackingId: "XYZ-789" }` |

State after replay → `Order { status: "shipped", total: 74.98 }`

**The key: replay to any point:**

```typescript
// "What did the order look like before payment?"
const events = await eventStore.getEvents("order-123");
const beforePayment = events.slice(0, 4); // events 1-4 only
Order.fromEvents("order-123", beforePayment);
// → Order { status: "submitted", total: 74.98 }

// "What about when it was just a draft with one item?"
Order.fromEvents("order-123", events.slice(0, 2));
// → Order { status: "draft", items: [widget×2] }
```

**Traditional DB at this point:** One row, `{ status: "shipped", total: 74.98 }`. No idea what happened in between.

</details>

<details>
<summary><strong>🔄 Dry Run: Replaying Events to Rebuild State</strong></summary>

Someone calls `loadOrder("order-123")`. The event store returns all 6 events. The replay function processes them one at a time:

```
Start: Order { status: undefined, items: [], total: 0 }
```

**Event 1: OrderCreated** `{ customerId: "cust-42" }`
```
apply → this.status = "draft"
State:  Order { status: "draft", items: [], total: 0 }
```

**Event 2: ItemAdded** `{ productId: "widget", qty: 2, price: 29.99 }`
```
apply → this.items.push({ widget, 2, 29.99 })
State:  Order { status: "draft", items: [widget×2], total: 0 }
```

**Event 3: ItemAdded** `{ productId: "gadget", qty: 1, price: 15.00 }`
```
apply → this.items.push({ gadget, 1, 15.00 })
State:  Order { status: "draft", items: [widget×2, gadget×1], total: 0 }
```

**Event 4: OrderSubmitted** `{ total: 74.98 }`
```
apply → this.status = "submitted"; this.total = 74.98
State:  Order { status: "submitted", items: [widget×2, gadget×1], total: 74.98 }
```

**Event 5: PaymentTaken** `{ amount: 74.98 }`
```
apply → this.status = "paid"
State:  Order { status: "paid", items: [widget×2, gadget×1], total: 74.98 }
```

**Event 6: OrderShipped** `{ trackingId: "XYZ-789" }`
```
apply → this.status = "shipped"
State:  Order { status: "shipped", items: [widget×2, gadget×1], total: 74.98 }
```

**Done.** The order is fully reconstructed from its events. No traditional database row was needed.

**Want the state at step 4?** Replay only events 1 to 4. Stop there. You get `{ status: "submitted", total: 74.98 }`.

**Want to debug why the total is wrong?** Walk through each ItemAdded event and check the prices. The full history is right there.

</details>

The domain object **produces events** when actions happen, and the event store **appends them**:

<span class="label label-ts">TypeScript</span>

```typescript
class Order {
  private uncommittedEvents: OrderEvent[] = [];

  // Actions produce events — not direct state changes
  static create(id: string, customerId: string): Order {
    const order = new Order();
    order.id = id;
    order.addEvent({ type: "OrderCreated", customerId });
    return order;
  }

  addItem(productId: string, quantity: number, price: number) {
    if (this.status !== "draft") throw new Error("Cannot modify submitted order");
    this.addEvent({ type: "ItemAdded", productId, quantity, price });
  }

  submit() {
    if (this.items.length === 0) throw new Error("Cannot submit empty order");
    this.addEvent({ type: "OrderSubmitted", total: this.calculateTotal() });
  }

  // Each action creates an event AND applies it to current state
  private addEvent(event: OrderEvent) {
    this.uncommittedEvents.push(event);
    this.apply(event);  // update in-memory state
  }

  getUncommittedEvents(): OrderEvent[] {
    return this.uncommittedEvents;
  }
}

// The event store — append-only, never update or delete
class EventStore {
  async save(aggregateId: string, events: OrderEvent[]) {
    for (const event of events) {
      await db.query(
        "INSERT INTO events (aggregate_id, type, data, timestamp) VALUES ($1, $2, $3, NOW())",
        [aggregateId, event.type, JSON.stringify(event)]
      );
    }
  }

  async getEvents(aggregateId: string): Promise<OrderEvent[]> {
    const result = await db.query(
      "SELECT data FROM events WHERE aggregate_id = $1 ORDER BY timestamp",
      [aggregateId]
    );
    return result.rows.map(r => JSON.parse(r.data));
  }
}

// Putting it together — a command handler
class PlaceOrderHandler {
  async handle(cmd: { customerId: string; items: CartItem[] }) {
    // 1. Create the order (produces OrderCreated event)
    const order = Order.create(generateId(), cmd.customerId);

    // 2. Add items (produces ItemAdded events)
    for (const item of cmd.items) {
      order.addItem(item.productId, item.quantity, item.price);
    }

    // 3. Submit (produces OrderSubmitted event)
    order.submit();

    // 4. Save all events to the store
    await this.eventStore.save(order.id, order.getUncommittedEvents());
    // Events saved: [OrderCreated, ItemAdded, ItemAdded, OrderSubmitted]
  }
}
```

### Implementation: Replaying Events

To load an order, fetch its events and replay them:

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

**Choreography**: services react to events, no central coordinator:

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
// STEP 1: Payment service listens for new orders
eventBus.subscribe("OrderPlaced", async (event) => {
  try {
    await paymentService.charge(event.customerId, event.total);
    await eventBus.publish("PaymentTaken", { orderId: event.orderId });
  } catch {
    await eventBus.publish("PaymentFailed", { orderId: event.orderId });
  }
});

// STEP 2: Inventory listens for successful payment
eventBus.subscribe("PaymentTaken", async (event) => {
  try {
    await inventoryService.reserve(event.orderId);
    await eventBus.publish("StockReserved", { orderId: event.orderId });
  } catch {
    await eventBus.publish("StockReserveFailed", { orderId: event.orderId });
  }
});

// COMPENSATING ACTIONS — revert previous steps on failure

// Payment failed? Nothing to undo (payment didn't happen), just cancel the order
eventBus.subscribe("PaymentFailed", async (event) => {
  await orderService.cancel(event.orderId);  // undo step 0
});

// Stock reservation failed? Undo payment, then cancel order
eventBus.subscribe("StockReserveFailed", async (event) => {
  await paymentService.refund(event.orderId);  // undo step 1
  await orderService.cancel(event.orderId);     // undo step 0
});
});
```

**Orchestration**: a central coordinator manages the steps:

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

### Orchestration Calls Out to Services

The orchestrator is just the coordinator. It calls other services via HTTP, gRPC, or messaging. It doesn't contain the business logic itself:

<span class="label label-ts">TypeScript</span>

```typescript
class PlaceOrderSaga {
  constructor(
    private paymentService: PaymentClient,     // HTTP call to payment service
    private inventoryService: InventoryClient,  // HTTP call to inventory service
    private shippingService: ShippingClient,    // HTTP call to shipping service
  ) {}

  async execute(order: Order) {
    await this.paymentService.charge(order);    // remote call
    await this.inventoryService.reserve(order); // remote call
    await this.shippingService.schedule(order); // remote call
  }
}
```

### Every Saga Step Must Be Idempotent

Both forward steps and compensating actions can fail and need retrying. If a refund call times out, did it happen or not? You have to retry. If the refund isn't idempotent, the customer gets refunded twice.

<span class="label label-ts">TypeScript</span>

```typescript
// Inside the payment service - idempotent refund
async refund(orderId: string) {
  // Check if already refunded
  const existing = await db.query(
    "SELECT 1 FROM refunds WHERE order_id = $1", [orderId]
  );
  if (existing.rows.length > 0) return; // already done, skip

  await stripe.refunds.create({ payment_intent: paymentId });
  await db.query("INSERT INTO refunds (order_id) VALUES ($1)", [orderId]);
}
```

This applies to every step in the saga:

| Step | Why it must be idempotent |
|---|---|
| `charge(orderId)` | Orchestrator might retry if it didn't get a response |
| `reserve(orderId)` | Network could fail after the service processed it |
| `refund(orderId)` | Compensation might be retried if the first attempt timed out |
| `release(orderId)` | Same |

<div class="callout tip">
  <strong>The pattern:</strong> every service checks "have I already done this?" before doing anything. Use a unique identifier (like orderId) to track what's been processed. This makes every call safe to retry.
</div>

### Choreography vs Orchestration

| | Choreography | Orchestration |
|---|---|---|
| **Coordination** | Decentralized (events) | Central coordinator |
| **Coupling** | Very loose | Coordinator knows all steps |
| **Visibility** | Hard to see the full flow | Easy to see in one place |
| **Complexity** | Grows with number of services | Stays in one class |
| **Best for** | Simple flows, few steps | Complex flows, many steps |

### Downsides of Each

**Choreography** is loosely coupled in code (services don't reference each other) but **tightly coupled in knowledge**. Every service needs to know which events to listen for, what compensating actions to run, and the implicit order of the flow. The full saga logic is invisible, spread across many subscribers in different services. Nobody can look at one place and see the complete picture.

**Orchestration** is the opposite. The orchestrator is **tightly coupled to every service** (it calls them all) but the flow is **visible in one place**. If any service changes its API, the orchestrator breaks. And if the orchestrator goes down, all sagas stop.

| Downside | Choreography | Orchestration |
|---|---|---|
| **Coupling type** | Implicit knowledge coupling | Explicit code coupling |
| **Debugging** | Hard: trace events across services | Easy: read one class |
| **Single point of failure** | No | Yes: the orchestrator |
| **Adding a step** | Add a subscriber, but who sees the full flow? | Edit one class, but it grows |
| **Circular dependencies** | Possible: A reacts to B reacts to A | Not possible |
| **Testing** | Hard: simulate event chains | Easier: mock services, test orchestrator |
| **Scaling** | Each service scales independently | Orchestrator can bottleneck |

<div class="callout tip">
  <strong>The real question:</strong> can someone new to the team understand the flow? With 3 steps, choreography is fine. With 8 steps and branching failure paths, orchestration is much easier to reason about. Start with orchestration for complex flows.
</div>

## Sizing an Event-Driven System

When designing event-driven systems, you need to estimate throughput to choose the right infrastructure. This is a back-of-envelope estimation skill that comes up in system design interviews and real capacity planning.

### The Framework

Always break the problem into components, estimate each one, then multiply. State your assumptions explicitly so others can challenge them.

```text
1. Start with the business metric (orders per day, users, requests)
2. Break it into time units (per second is what infrastructure cares about)
3. Count events per business action (not just the action itself)
4. Apply a peak multiplier (real traffic is spiky, not uniform)
5. Give a range, not a single number
```

### Worked Example: Food Delivery Platform in 10 Cities

**Step 1: Orders per city per day**

Don't just guess. Anchor to something real. A mid-size city with a food delivery platform might do 5,000 to 20,000 orders per day. Start with 10,000 as a baseline.

```text
10 cities x 10,000 orders/day = 100,000 orders/day
```

**Step 2: Convert to per-second**

```text
100,000 orders / 86,400 seconds = ~1.2 orders/second (average)
```

But orders aren't spread evenly. Most happen during lunch (12:00-13:00) and dinner (18:00-20:00). That's roughly 4 peak hours out of 24.

```text
Peak concentration: ~60-70% of orders in 4 hours
70,000 orders in 14,400 seconds = ~5 orders/second during peak
```

**Step 3: Events per order**

This is where people undercount. An order isn't one event. Think through the full lifecycle:

| Event | When |
|---|---|
| OrderCreated | Customer places order |
| PaymentProcessed | Payment charged |
| OrderAccepted | Restaurant confirms |
| PreparationStarted | Kitchen begins cooking |
| OrderReady | Food is ready for pickup |
| DriverAssigned | Driver matched to order |
| DriverPickedUp | Driver collected the food |
| OrderDelivered | Customer received the food |
| OrderRated | Customer leaves a review |

That's 9 events per order. Some orders also generate: PaymentFailed, OrderCancelled, RefundProcessed, DriverReassigned. Call it 8-12 events per order on average.

```text
5 orders/second x 10 events/order = 50 events/second at peak
```

**Step 4: Add downstream consumers**

Each event might trigger additional work: updating read models, sending notifications, updating analytics, adjusting driver availability. If 3 consumers each process every event:

```text
50 events/second x 3 consumers = 150 messages/second total throughput
```

**Step 5: Apply a safety margin**

Real systems need headroom for spikes (a promotion, bad weather causing surge orders, a new city launch). Use 2-3x.

```text
150 x 3 = 450 messages/second capacity needed
```

**Step 6: Give a range**

Your assumptions could be off. State the range:

```text
Conservative (5K orders/city): ~200 messages/second
Baseline (10K orders/city):    ~450 messages/second
Aggressive (20K orders/city):  ~900 messages/second
```

### Common Mistakes in Estimation

| Mistake | Why it matters |
|---|---|
| Counting only the primary action | An "order" generates 8-12 events, not 1 |
| Using daily averages for capacity | Peak traffic can be 5-10x the average |
| Not anchoring to real numbers | "1,000 orders per hour" sounds reasonable but is it? Check against known platforms |
| Single number instead of a range | Assumptions are uncertain. Always give low/mid/high |
| Ignoring downstream fan-out | 50 events/second becomes 150+ when multiple consumers process each one |
| Not questioning the inputs | If someone says "10 cities", ask: what size? Launch stage or mature? |

### Sensitivity Analysis

The most impactful assumptions to test:

```text
If orders/city doubles:     throughput doubles
If events/order goes 8->12: throughput increases 50%
If peak factor goes 3x->5x: throughput increases 67%
If consumers go 3->5:       throughput increases 67%
```

The biggest lever is usually orders per city and peak concentration. Get those wrong and your estimate is off by an order of magnitude.

<div class="callout tip">
  <strong>In an interview or planning session:</strong> propose your own assumptions, state them clearly, then ask "does that seem reasonable?" Don't wait to be given numbers. Show that you can reason about the business context: meal times create peaks, new cities have fewer orders, promotions cause spikes.
</div>

## Putting It All Together

These patterns rarely exist in isolation. Here's how they combine in a real food delivery app, walking through what happens when a customer places an order:

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
              │  Event Stream   │ (Kafka)
              └──┬──────┬───┬──┘
                 │      │   │
         ┌───────▼┐  ┌──▼──┐ ┌▼────────────┐
         │Payment │  │Email│ │Read Model   │
         │Service │  │Svc  │ │(Projections)│
         └───┬────┘  └─────┘ └──────┬──────┘
             │                      │
         ┌───▼────┐          ┌──────▼──────┐
         │Kitchen │          │ Query API   │
         │Service │          │ (Read Model)│
         └────────┘          └─────────────┘
```

### The Flow: Customer Orders a Burger

**1. Customer taps "Place Order" in the app**

The API Gateway routes the request to the Order Service. This is the **write side** of CQRS.

```typescript
// Order Service (write side) - validates and saves
const order = Order.create(customerId, items);
order.submit();
await eventStore.save(order.id, order.getUncommittedEvents());
// Events saved: [OrderCreated, ItemAdded, OrderSubmitted]
```

If using **event sourcing**, those events are the source of truth. No orders table with a status column. Just events.

**2. OrderPlaced event hits the event stream**

Kafka receives the event. This is the **event-driven** part. The Order Service is done. It doesn't know or care what happens next.

**3. Multiple consumers react independently**

Each service has its own consumer group, processing the same event for different purposes:

- **Payment Service** charges the customer's card. On success, publishes `PaymentTaken`. On failure, publishes `PaymentFailed`.
- **Email Service** sends an order confirmation. If it fails, the order still proceeds (email is not critical).
- **Read Model Projector** updates the denormalized `order_summaries` table so the customer can see their order status instantly. This is the **CQRS read side**.

**4. The saga coordinates the multi-step flow**

Payment, kitchen prep, and driver assignment need to happen in order. If any step fails, previous steps must be undone. This is the **saga pattern**:

```text
OrderPlaced → PaymentTaken → KitchenAccepted → DriverAssigned → OrderDelivered
                                    ↓ (if kitchen rejects)
                              PaymentRefunded → OrderCancelled
```

With choreography, each service listens for the previous step's success event and publishes its own. With orchestration, a central `OrderFulfillmentSaga` class calls each service in sequence.

**5. Customer checks order status**

The app calls the Query API, which reads from the **denormalized read model**. No JOINs, no hitting the write database. Fast, even under heavy load.

```typescript
// Read side - one simple query, pre-computed by the projector
const status = await readDb.query(
  "SELECT * FROM order_tracking WHERE order_id = $1", [orderId]
);
// Returns: { status: "preparing", restaurant: "Burger Place", eta: "18 mins" }
```

### Which Patterns Are Used Where

| What happens | Pattern used | Why |
|---|---|---|
| Order saved as events, not rows | Event Sourcing | Full audit trail, can replay state |
| Write and read use different models | CQRS | Write is normalized, read is fast/flat |
| Services don't call each other directly | Event-Driven | Loose coupling, independent scaling |
| Payment then kitchen then driver in sequence | Saga | Distributed transaction with compensation |
| Kafka retains events for replay | Event Stream | Multiple consumers, replayability |
| Email service processes independently | Message Consumer | Fire and forget, non-critical |

<div class="callout tip">
  <strong>You don't need all of these on day one.</strong> Start with a monolith and direct calls. Add events when services need to be decoupled. Add CQRS when reads get slow. Add event sourcing when you need an audit trail. Add sagas when you have multi-service transactions. Each pattern solves a specific problem. Add it when you have that problem.
</div>

## Key Takeaways

1. **Event-driven architecture** decouples services. Producers don't know about consumers
2. **Commands** = "do this" (one handler). **Events** = "this happened" (many listeners)
3. **Message queues** = one consumer per message (tasks). **Event streams** = multiple consumers, messages persist (events)
4. **CQRS** = separate read and write models when they have different requirements
5. **Event sourcing** = store events, not state. Full audit trail, reconstruct any point in time
6. **Sagas** = manage distributed transactions with compensating actions
7. These patterns add complexity. Use them when the problem demands it, not by default

## Check Your Understanding

{{< quiz >}}

## Scenario Challenges

{{< case-studies >}}

## Interactive Case Studies

{{< interactive-cases >}}
