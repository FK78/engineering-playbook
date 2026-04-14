---
title: "Part 1: Foundations"
subtitle: "Layered Architecture, Coupling/Cohesion & Separation of Concerns"
linkTitle: "Part 1: Foundations"
weight: 1
type: "docs"
quiz:
  - q: "You have a PaymentService that directly constructs HTTP requests to Stripe's API. What's the coupling problem, and how would you fix it?"
    concepts:
      - label: "tight coupling"
        terms: ["tight", "tightly coupled", "directly depends", "hard-coded", "hardcoded", "direct dependency"]
      - label: "interface/abstraction"
        terms: ["interface", "abstraction", "abstract", "contract", "decouple", "indirection"]
      - label: "gateway/adapter pattern"
        terms: ["gateway", "adapter", "wrapper", "intermediary", "middle layer"]
      - label: "swappable implementations"
        terms: ["swap", "switch", "replace", "another provider", "different provider", "implement"]
    answer: "PaymentService is tightly coupled to Stripe's HTTP API. Fix: introduce a PaymentGateway interface. PaymentService depends on the interface; StripePaymentGateway implements it."
  - q: "A UserController contains SQL queries. Which architectural principle is violated?"
    concepts:
      - label: "separation of concerns"
        terms: ["separation of concern", "separate concern", "mixed concern", "wrong place", "doesn't belong"]
      - label: "layered architecture"
        terms: ["layer", "presentation", "controller shouldn't", "wrong layer"]
      - label: "data access belongs elsewhere"
        terms: ["data access", "repository", "dao", "data layer", "persistence layer", "sql should", "move the sql"]
    answer: "Separation of concerns and layered architecture. The presentation layer (controller) is doing data access work. SQL should live in a repository/DAO."
  - q: "You have a ReportService that generates reports, sends them via email, and logs analytics. Is this high or low cohesion?"
    concepts:
      - label: "low cohesion"
        terms: ["low cohesion", "not cohesive", "poor cohesion", "too many thing", "too much", "grab bag", "god class"]
      - label: "multiple responsibilities"
        terms: ["responsibilit", "multiple", "three", "unrelated", "different thing", "several job"]
      - label: "should be split"
        terms: ["split", "separate", "break", "extract", "divide", "single responsibility", "own class", "own service"]
    answer: "Low cohesion. Three unrelated responsibilities. Split into: ReportGenerator, notification mechanism, and AnalyticsLogger."
  - q: "Your mock-based unit test passes, but the feature is broken in production. What kind of test are you missing?"
    concepts:
      - label: "integration or E2E test"
        terms: ["integration", "e2e", "end-to-end", "end to end", "higher level", "acceptance"]
      - label: "real dependencies needed"
        terms: ["real", "actual", "not mock", "live", "true dependency", "real database", "real service"]
      - label: "mocks reflect assumptions"
        terms: ["assumption", "mock doesn't", "mock can't", "mock won't", "fake behav", "not accurate", "doesn't reflect reality"]
    answer: "An integration or E2E test. Your mock reflects assumptions, not reality. Add a test at a higher level with real dependencies."
  - q: "What is the main advantage of using a Repository pattern over directly querying the database in your service layer?"
    concepts:
      - label: "abstraction/interface"
        terms: ["interface", "abstraction", "abstract", "contract", "hide", "encapsulat"]
      - label: "domain-focused"
        terms: ["domain", "business", "collection", "natural language", "readable"]
      - label: "testability"
        terms: ["test", "mock", "fake", "stub", "in-memory", "swap", "replace"]
      - label: "decoupled from database"
        terms: ["decouple", "doesn't know", "doesn't care", "independent", "isolat", "no sql", "without database", "switch database"]
    answer: "The Repository isolates data access behind an interface. Your service doesn't know about SQL or which database is used. This makes code testable and flexible."
---

## Layered Architecture

The most common starting pattern. You organize code into horizontal layers, each with a distinct responsibility. A request flows top-down:

<div class="diagram">
  <div class="layer">Presentation Layer — UI, API controllers, HTTP handling</div>
  <div class="arrow">↓</div>
  <div class="layer">Business Logic Layer — Rules, validation, workflows</div>
  <div class="arrow">↓</div>
  <div class="layer">Data Access Layer — Database queries, ORM, repositories</div>
  <div class="arrow">↓</div>
  <div class="layer">Database — The actual data store</div>
</div>

### The Rules

- Each layer **only depends on the layer directly below it**
- A layer **never** reaches up (data access should not call presentation)
- Each layer **hides its internals** from the layers above

### Why This Matters

Imagine you switch from PostgreSQL to MongoDB. If your architecture is properly layered, only the Data Access layer changes. Business logic and presentation are untouched.

### Real-World Example

A typical web API:

```text
Controller (receives HTTP request)
    → Service (applies business rules)
        → Repository (fetches/saves data)
            → Database
```

- **Controller:** "Someone wants to create an order." Validates the HTTP request shape, calls the service.
- **Service:** "Is this order valid? Does the customer have enough credit? Apply the discount rules." Contains the *why*.
- **Repository:** `INSERT INTO orders...` Contains the *how* of storage.

### When It Breaks Down

<div class="callout">
  <strong>Too many layers</strong> — sometimes called "lasagna architecture." If a layer just passes data through without adding value, it's unnecessary overhead.
</div>

<div class="callout">
  <strong>Leaking abstractions</strong> — when database concepts (SQL, table names) bleed into the business layer, the separation is illusory.
</div>

## Coupling

Coupling measures how much one component depends on the internals of another.

### Spectrum: Tight → Loose

<span class="bad">Tight coupling (bad):</span> <span class="label label-ts">TypeScript</span>

```typescript
class OrderService {
  async createOrder(order: Order) {
    const transporter = nodemailer.createTransport({
      host: "mail.server.com", port: 587
    });
    await transporter.sendMail({
      to: order.customerEmail,
      subject: "Order confirmed",
      html: buildBody(order)
    });
  }
}
```

OrderService *knows* about SMTP, email formatting, server addresses. Change anything about email and you're editing the order service.

<span class="good">Loose coupling (good):</span> <span class="label label-ts">TypeScript</span>

```typescript
interface OrderNotifier {
  orderCreated(order: Order): Promise<void>;
}

class OrderService {
  constructor(private notifier: OrderNotifier) {}

  async createOrder(order: Order) {
    // ... create the order ...
    await this.notifier.orderCreated(order);
  }
}
```

OrderService doesn't know *how* notifications work. It could be email, SMS, a push notification, or nothing in tests.

### How to Spot Tight Coupling

- Changing one class forces changes in many others
- You can't test a class without setting up its dependencies
- Concrete class names appear everywhere instead of interfaces

## Fixing Tight Coupling — Worked Example

A `PaymentService` that directly calls Stripe's API is tightly coupled: if Stripe's API changes or you switch provider, PaymentService must be rewritten.

The fix: create a **generic interface** shaped around what your app needs: <span class="label label-ts">TypeScript</span>

```typescript
interface PaymentGateway {
  charge(amount: number, currency: string, token: string): Promise<PaymentResult>;
}

class StripeGateway implements PaymentGateway {
  async charge(amount: number, currency: string, token: string) {
    return await stripe.charges.create({ amount, currency, source: token });
  }
}

class PayPalGateway implements PaymentGateway {
  async charge(amount: number, currency: string, token: string) {
    // PayPal-specific logic
  }
}

class PaymentService {
  constructor(private gateway: PaymentGateway) {}

  async processPayment(order: Order) {
    const result = await this.gateway.charge(order.total, "gbp", order.paymentToken);
  }
}
```

<div class="callout">
  <strong>Common mistake:</strong> Making the interface shaped like Stripe's API. The interface should describe <strong>what your app needs</strong>, not how any particular provider works.
</div>

### What If a New Gateway Needs More Values?

**Universal** — update the interface with a request object: <span class="label label-ts">TypeScript</span>

```typescript
interface ChargeRequest {
  amount: number;
  currency: string;
  token: string;
  billingAddress?: Address;  // new field, optional for backwards compat
}

interface PaymentGateway {
  charge(request: ChargeRequest): Promise<PaymentResult>;
}
```

**Provider-specific** — keep it inside that implementation: <span class="label label-ts">TypeScript</span>

```typescript
class PayPalGateway implements PaymentGateway {
  async charge(request: ChargeRequest): Promise<PaymentResult> {
    const payerId = await this.resolvePayerId(request.token);
    return await paypal.execute(payerId, request.amount);
  }
}
```

<div class="callout info">
  <strong>How to decide where a field lives:</strong> Ask "Does my service layer know about this value?"
  <ul>
    <li><strong>Yes</strong> (e.g. <code>billingAddress</code> — collected from the user) → on the interface, optional if not all gateways need it</li>
    <li><strong>No</strong> (e.g. <code>payerId</code> — a PayPal internal concept) → inside the implementation only</li>
  </ul>
</div>

### How Do You Design the Interface on Day 1?

1. **Start with your use case, not the provider's API.** "What does my app need?" → "Charge a customer X amount."
2. **Only include what your service actually uses.** Stripe has hundreds of options. Your app uses 3-4.
3. **When a second provider arrives, refactor.** You'll discover what's truly universal vs provider-specific.

<span class="label label-ts">TypeScript</span> — Day 1, only Stripe exists:

```typescript
interface ChargeRequest {
  amount: number;
  currency: string;
  token: string;
}

class StripeGateway implements PaymentGateway {
  async charge(request: ChargeRequest) {
    return stripe.charges.create({
      amount: request.amount,
      currency: request.currency,
      source: request.token,
      description: "Order charge",          // Stripe-specific,
      metadata: { provider: "stripe" }      // not on the interface
    });
  }
}
```

Day 200, adding PayPal — refactor:

```typescript
interface ChargeRequest {
  amount: number;
  currency: string;
  paymentMethodId: string;  // renamed: more generic than "token"
  customerEmail?: string;   // PayPal needs this, Stripe doesn't — optional
}
```

| Stage | What you do |
|---|---|
| **1 provider** | Interface = what your app needs (informed by that provider) |
| **2nd provider arrives** | Refactor: keep what's common, push provider-specific stuff into implementations |
| **3+ providers** | Interface is battle-tested and stable |

<div class="callout info">
  <strong>You'll never get it perfect on day 1, and you shouldn't try.</strong> The interface will evolve — that's normal.
</div>

## Testing Loosely Coupled Code

Loose coupling makes code testable — substitute real dependencies with **test doubles**.

<span class="label label-ts">TypeScript</span> — using Jest:

```typescript
test("createOrder notifies on success", async () => {
  const mockNotifier: OrderNotifier = {
    orderCreated: jest.fn()
  };
  const service = new OrderService(mockNotifier);

  await service.createOrder(testOrder);

  expect(mockNotifier.orderCreated).toHaveBeenCalledWith(testOrder);
});
```

<span class="label label-py">Python</span> — using unittest.mock:

```python
def test_create_order_notifies_on_success():
    mock_notifier = Mock(spec=OrderNotifier)
    service = OrderService(mock_notifier)

    service.create_order(test_order)

    mock_notifier.order_created.assert_called_once_with(test_order)
```

### Types of Test Doubles

| Type | What it does | When to use |
|---|---|---|
| **Mock** | Records calls, you verify interactions | "Was `orderCreated` called?" |
| **Stub** | Returns canned answers | "Return this user when `findById` is called" |
| **Fake** | Working but simplified implementation | In-memory database instead of real DB |

## Are Mocks Reliable? The Testing Pyramid

Mocks are reliable for **logic in isolation**. But they test what you *think* the dependency does, not what it *actually* does.

<div class="callout">
  <strong>The problem:</strong> Your mock says <code>findById</code> returns a User. But what if the real repo throws for deleted users? Test passes, production breaks.
</div>

```text
        /  E2E  \          Few — slow, expensive, brittle
       /----------\
      / Integration \      Some — test real connections
     /----------------\
    /    Unit (mocks)    \  Many — fast, cheap, focused
   /______________________\
```

| Level | What it catches | Trade-off |
|---|---|---|
| **Unit (mocks)** | Logic errors, edge cases, regressions | Fast but can't catch integration issues |
| **Integration** | Wiring problems, real DB queries, API contracts | Slower, needs real dependencies |
| **E2E** | Full workflow failures | Slowest, most brittle |

<div class="callout tip">
  <strong>Practical split:</strong> Unit 70-80% · Integration 15-20% · E2E 5-10%
</div>

## Cohesion

Cohesion measures how related the responsibilities within a single component are.

<span class="bad">Low cohesion (bad):</span> A `UserService` that handles authentication, profile updates, email sending, report generation, and file uploads.

<span class="good">High cohesion (good):</span> An `AuthenticationService` that handles login, logout, token refresh, and password reset.

<div class="callout tip">
  <strong>The Test:</strong> "Can I describe what this component does in one sentence without using 'and'?"<br><br>
  ✅ "Manages user authentication"<br>
  ❌ "Manages user authentication and sends emails and generates reports"
</div>

## Separation of Concerns

The overarching principle. Each part of the system should address one concern only.

| Concern | Where It Lives |
|---|---|
| HTTP routing & request parsing | Controller / Handler |
| Business rules & validation | Service / Domain layer |
| Data persistence | Repository / DAO |
| Cross-cutting (logging, auth) | Middleware / Interceptors |
| Configuration | Environment / Config files |

<div class="callout tip">
  <strong>The Litmus Test:</strong> If you need to change a business rule, how many files do you touch? Ideally <strong>one</strong>.
</div>

## DAO — Data Access Object

Encapsulates all data source access behind a clean interface. Your code never sees SQL or connection strings.

<span class="bad">Without a DAO:</span> <span class="label label-ts">TypeScript</span>

```typescript
class OrderService {
  async getOrder(id: number): Promise<Order> {
    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    return result.rows[0];
  }
}
```

<span class="good">With a DAO:</span> <span class="label label-ts">TypeScript</span>

```typescript
interface OrderDao {
  findById(id: number): Promise<Order | null>;
  save(order: Order): Promise<void>;
  delete(id: number): Promise<void>;
}

class PostgresOrderDao implements OrderDao {
  constructor(private pool: Pool) {}
  async findById(id: number): Promise<Order | null> {
    const result = await this.pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }
  async save(order: Order) { /* ... */ }
  async delete(id: number) { /* ... */ }
}

class OrderService {
  constructor(private orderDao: OrderDao) {}
  async getOrder(id: number) { return this.orderDao.findById(id); }
}
```

### DAO vs Repository — What's Actually Different?

In practice, often nearly identical. The difference is **intent and scope** — it matters when domain objects span multiple tables.

**DAO** = one per *table*: <span class="label label-ts">TypeScript</span>

```typescript
interface OrderDao {
  findById(id: string): Promise<OrderRow | null>;
  insert(row: OrderRow): Promise<void>;
}
interface OrderLineItemDao {
  findByOrderId(orderId: string): Promise<LineItemRow[]>;
}

// Service coordinates multiple DAOs:
class OrderService {
  constructor(private orderDao: OrderDao, private lineItemDao: OrderLineItemDao) {}
  async getOrder(id: string): Promise<Order> {
    const row = await this.orderDao.findById(id);
    const items = await this.lineItemDao.findByOrderId(id);
    return new Order(row, items);  // service assembles
  }
}
```

**Repository** = one per *domain concept*: <span class="label label-ts">TypeScript</span>

```typescript
interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

class PostgresOrderRepository implements OrderRepository {
  async findById(id: string): Promise<Order | null> {
    const orderRow = await this.pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    const itemRows = await this.pool.query("SELECT * FROM line_items WHERE order_id = $1", [id]);
    return new Order(orderRow, itemRows);  // repository assembles
  }
}

class OrderService {
  constructor(private orders: OrderRepository) {}
  async getOrder(id: string) { return this.orders.findById(id); }
}
```

| | DAO approach | Repository approach |
|---|---|---|
| **Service needs to:** | Call multiple DAOs + assemble | Call `repository.findById()` — done |
| **Who knows tables?** | Service layer | Only the repository |
| **Simple CRUD?** | No practical difference | No practical difference |

## Repository Pattern

A Repository acts like an **in-memory collection** of domain objects. The fact that a database is involved is completely hidden.

<span class="label label-ts">TypeScript</span>

```typescript
interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByCustomer(customerId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  remove(order: Order): Promise<void>;
}

class PostgresOrderRepository implements OrderRepository {
  constructor(private pool: Pool) {}

  async findById(id: string): Promise<Order | null> {
    const result = await this.pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    return result.rows[0] ? this.toDomain(result.rows[0]) : null;
  }

  async findByCustomer(customerId: string): Promise<Order[]> {
    const result = await this.pool.query(
      "SELECT * FROM orders WHERE customer_id = $1", [customerId]
    );
    return result.rows.map(this.toDomain);
  }

  async save(order: Order) {
    await this.pool.query(
      `INSERT INTO orders (id, customer_id, total, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET total = $3, status = $4`,
      [order.id, order.customerId, order.total, order.status]
    );
  }

  async remove(order: Order) {
    await this.pool.query("DELETE FROM orders WHERE id = $1", [order.id]);
  }

  private toDomain(row: any): Order {
    return new Order(row.id, row.customer_id, row.total, row.status);
  }
}
```

### Testing a Repository

Use a **fake** (in-memory implementation): <span class="label label-ts">TypeScript</span>

```typescript
class InMemoryOrderRepository implements OrderRepository {
  private orders: Map<string, Order> = new Map();

  async findById(id: string) { return this.orders.get(id) ?? null; }
  async findByCustomer(customerId: string) {
    return [...this.orders.values()].filter(o => o.customerId === customerId);
  }
  async save(order: Order) { this.orders.set(order.id, order); }
  async remove(order: Order) { this.orders.delete(order.id); }
}

test("getOrder returns order", async () => {
  const repo = new InMemoryOrderRepository();
  await repo.save(new Order("1", "cust-1", 99.99, "pending"));
  const service = new OrderService(repo);

  const order = await service.getOrder("1");
  expect(order?.total).toBe(99.99);
});
```

## Key Takeaways

1. **Layer your code** by responsibility, dependencies flow one direction
2. **Loose coupling** = depend on abstractions, not implementations
3. **High cohesion** = each component does one thing well
4. **Separation of concerns** = the guiding principle behind all of the above
5. **Loose coupling enables testing** — swap dependencies for mocks/stubs/fakes
6. **Mocks alone aren't enough** — use the testing pyramid
7. **DAO/Repository** = isolate data access behind an interface

## Check Your Understanding

{{< quiz >}}
