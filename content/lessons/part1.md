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
case_studies:
  - title: "The 5,000-Line God Class"
    category: "Architecture Decision"
    difficulty: "⭐⭐"
    scenario: "TechPulse is a B2B SaaS startup with 12,000 paying customers. Their Node.js monolith has grown over 3 years, and the UserService class has ballooned to 5,000 lines — handling authentication, profile management, role-based access, notification preferences, billing integration, and audit logging. Deployments take 45 minutes because the entire app must be tested end-to-end. A recent change to the billing logic broke the login flow, causing a 2-hour outage. The team of 6 engineers spends 30% of their time on merge conflicts in this single file."
    constraints: "6 engineers, $0 additional infrastructure budget for 3 months, must maintain current feature velocity, 99.5% uptime SLA with customers"
    prompts:
      - "Should you refactor the existing UserService incrementally or rewrite it from scratch? What are the risks of each?"
      - "How would you identify the responsibility boundaries within the 5,000-line class? What criteria would you use to decide where to split?"
      - "How do you keep shipping features while restructuring? What's your strategy for avoiding a 'big bang' migration?"
      - "What testing strategy would give you confidence that the split doesn't break existing behavior?"
    approaches:
      - name: "Strangler Fig Refactor"
        description: "Extract one responsibility at a time into its own service class behind an interface. Start with the most independent concern (e.g., audit logging), route calls through the new class, and delete the old code once validated. Repeat for each concern over several sprints."
        trade_off: "Safest approach with lowest risk of outage, but slow — could take 3-4 months to fully decompose. Requires discipline to avoid adding new code to the old class during the transition."
      - name: "Parallel Rewrite with Feature Flags"
        description: "Build a new set of focused services (AuthService, ProfileService, BillingBridge, etc.) alongside the existing UserService. Use feature flags to gradually route traffic to the new implementations, comparing outputs for correctness."
        trade_off: "Faster end state and cleaner architecture, but doubles the code surface temporarily. Risk of subtle behavioral differences between old and new implementations. Requires robust feature flag infrastructure."
      - name: "Modular Monolith with Enforced Boundaries"
        description: "Keep everything in one deployable unit but reorganize into modules with explicit public APIs and no direct cross-module imports. Use a linter or build tool to enforce boundaries. Each module owns its own database tables."
        trade_off: "Least disruptive — no infrastructure changes, no distributed systems complexity. But requires strong team discipline to maintain boundaries, and doesn't solve the deployment coupling problem."
  - title: "Untangling the Spaghetti Legacy"
    category: "Migration"
    difficulty: "⭐⭐⭐"
    scenario: "MediTrack, a healthcare scheduling platform, has been acquired by a larger company. The inherited PHP codebase has 200 API endpoints where controllers directly contain SQL queries, business logic, email sending, and PDF generation — often all in the same method. There are no tests. The original developers have left. The system serves 800 medical practices and processes 50,000 appointments per day. Downtime or data bugs directly affect patient care."
    constraints: "4 engineers (none familiar with the codebase), 9-month deadline to pass a security audit, zero tolerance for data corruption, cannot freeze features — must ship 2 compliance features during migration"
    prompts:
      - "With 200 endpoints and no tests, how do you even start? What's your strategy for understanding what the code actually does?"
      - "How do you introduce layers (controller → service → repository) without rewriting everything at once?"
      - "Which endpoints do you migrate first? What criteria determine priority?"
      - "How do you ensure the refactored code behaves identically to the original when there are no existing tests?"
    approaches:
      - name: "Characterization Tests First"
        description: "Before changing any code, write integration tests that capture the current behavior of each endpoint — including bugs. Use HTTP-level tests that hit the endpoint and assert on the response. Once you have a safety net, extract business logic into service classes and SQL into repositories one endpoint at a time."
        trade_off: "Highest confidence in correctness, but writing tests for 200 untested endpoints is extremely time-consuming. Could take 2-3 months before any structural improvement begins. Tests may be brittle if they depend on specific database state."
      - name: "Facade Pattern with Incremental Extraction"
        description: "Create a thin service layer that initially just delegates to the existing controller code. New features are built in the clean architecture. For each existing endpoint you touch (bug fix, feature change), extract its logic into the service layer at that time. Over months, the old code shrinks organically."
        trade_off: "Lets you ship features immediately while improving incrementally. But progress is uneven — high-traffic endpoints get cleaned up while rarely-touched ones stay messy. Could take 18+ months to fully migrate at natural pace."
      - name: "Priority-Based Rewrite of Critical Paths"
        description: "Identify the 20-30 endpoints that handle sensitive data (patient records, payments, authentication) and rewrite them with proper layering, input validation, and audit logging. Leave the remaining 170+ endpoints as-is until the security audit passes."
        trade_off: "Fastest path to passing the security audit and protecting patient data. But creates a two-tier codebase where critical paths are clean and everything else is legacy. Risk of the 'everything else' never getting cleaned up."
interactive_cases:
  - title: "The Slow App Mystery"
    type: "great-unknown"
    difficulty: "⭐⭐"
    brief: "A CTO calls you saying 'our app is slow and the team can't ship features fast enough.' That's all they tell you. Your job is to ask the right questions to uncover the real problem."
    opening: "Hi, thanks for taking this call. Look, I'll be honest — things aren't going well. Our app is slow, and the team just can't ship features fast enough. We need help figuring out what's wrong."
    hidden_facts: "The app is a 3-year-old Node.js monolith. 15 developers. Controllers have 2000+ lines with SQL, business logic, and HTTP handling mixed together. No tests. Deploy takes 4 hours. The 'slowness' is actually developer velocity, not runtime performance. The database is fine."
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

<div class="callout tip">
  <strong>Real-World Example:</strong> A typical e-commerce startup using Express or FastAPI naturally falls into this pattern. Controllers handle HTTP parsing, services enforce rules like "don't allow checkout with an empty cart," and repositories talk to PostgreSQL. When the team later migrated their product catalog to Elasticsearch, only the repository layer changed — the service and controller code remained untouched.
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

<div class="callout tip">
  <strong>Real-World Example:</strong> Netflix's early notification system was tightly coupled — the video encoding service directly called email and push notification code. When they needed to add SMS alerts, they had to modify the encoding service. They decoupled by introducing an event bus: services publish events like "encoding complete," and independent notification handlers subscribe to them. This let teams add new notification channels without touching upstream services.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> Shopify's payment processing supports hundreds of gateways — Stripe, PayPal, Adyen, and more. They achieve this through a PaymentGateway interface that each provider implements. When a merchant switches from Stripe to Adyen, Shopify's core checkout logic doesn't change at all. Only the gateway implementation is swapped, exactly like the pattern shown below.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> Spotify's backend teams rely heavily on test doubles for their microservices. Each service defines interfaces for its dependencies, allowing engineers to run thousands of unit tests in seconds using in-memory fakes. This fast feedback loop lets them deploy to production multiple times per day with confidence, catching logic errors before they ever hit integration environments.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> Google famously documented this problem in their testing culture. Teams that relied solely on mocked unit tests kept shipping bugs where services failed at integration points — serialization mismatches, unexpected nulls from real databases, and timeout behaviors mocks never simulated. They adopted a "Test Sizes" policy (small/medium/large) mirroring the testing pyramid, requiring medium tests with real dependencies for all critical paths.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> A fintech team inherited a 4,000-line UserService that handled authentication, profile management, KYC verification, email notifications, and audit logging. Every change risked breaking unrelated features, and the file had constant merge conflicts. They split it into five focused services — AuthService, ProfileService, KycService, NotificationService, and AuditService — each under 500 lines. Bug rates dropped and deployment frequency tripled because teams could change one concern without touching the others.
</div>

<span class="bad">Low cohesion (bad):</span> A `UserService` that handles authentication, profile updates, email sending, report generation, and file uploads.

<span class="good">High cohesion (good):</span> An `AuthenticationService` that handles login, logout, token refresh, and password reset.

<div class="callout tip">
  <strong>The Test:</strong> "Can I describe what this component does in one sentence without using 'and'?"<br><br>
  ✅ "Manages user authentication"<br>
  ❌ "Manages user authentication and sends emails and generates reports"
</div>

## Separation of Concerns

The overarching principle. Each part of the system should address one concern only.

<div class="callout tip">
  <strong>Real-World Example:</strong> Express and Django both use middleware to separate cross-cutting concerns from business logic. Authentication, rate limiting, and request logging are handled by middleware layers before a request ever reaches a route handler. This means adding JWT authentication to 50 endpoints requires changing one middleware file, not 50 handler functions — a textbook application of separation of concerns.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> A SaaS startup initially built their app on MySQL with raw SQL queries scattered throughout their services. When they needed to migrate their orders table to DynamoDB for better scalability, they had to rewrite dozens of files. After the migration, they introduced a DAO layer. When they later moved their user data to DynamoDB as well, only the UserDao implementation changed — the rest of the application was untouched.
</div>

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

<div class="callout tip">
  <strong>Real-World Example:</strong> A logistics company modeled their Shipment aggregate with items, tracking events, and delivery attempts. Their ShipmentRepository loaded and saved the entire aggregate as one unit. When they migrated from PostgreSQL to MongoDB for the shipments domain, the service layer didn't change at all — they simply wrote a new MongoShipmentRepository implementing the same interface. The repository pattern made the database a swappable implementation detail.
</div>

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


## SOLID Principles

Five design principles that guide you toward maintainable, flexible object-oriented code. Each one addresses a specific kind of pain you'll hit as a codebase grows.

### 1. Single Responsibility Principle (SRP)

A class should have **one reason to change**. If a class handles multiple concerns, a change to one concern risks breaking the others.

This connects directly to the [cohesion section above](#cohesion): SRP is cohesion applied at the class level.

<span class="bad">Violating SRP:</span> <span class="label label-ts">TypeScript</span>

```typescript
class OrderService {
  validate(order: Order): boolean {
    return order.items.length > 0 && order.total > 0;
  }

  async save(order: Order): Promise<void> {
    await db.query("INSERT INTO orders ...", [order]);
  }

  async sendConfirmation(order: Order): Promise<void> {
    await emailClient.send(order.customerEmail, "Order confirmed");
  }
}
```

Three reasons to change: validation rules, persistence logic, email format. A change to the email provider could break order saving.

<span class="good">Applying SRP:</span> <span class="label label-ts">TypeScript</span>

```typescript
class OrderValidator {
  validate(order: Order): boolean {
    return order.items.length > 0 && order.total > 0;
  }
}

class OrderRepository {
  async save(order: Order): Promise<void> {
    await db.query("INSERT INTO orders ...", [order]);
  }
}

class OrderNotifier {
  async sendConfirmation(order: Order): Promise<void> {
    await emailClient.send(order.customerEmail, "Order confirmed");
  }
}
```

Each class has one reason to change. They can be tested, modified, and deployed independently.

### 2. Open/Closed Principle (OCP)

Classes should be **open for extension** but **closed for modification**. Add new behavior without changing existing, tested code.

<span class="bad">Violating OCP:</span> <span class="label label-ts">TypeScript</span>

```typescript
class DiscountCalculator {
  calculate(type: string, total: number): number {
    if (type === "seasonal") return total * 0.1;
    if (type === "loyalty") return total * 0.15;
    // Adding a new discount means modifying this method
    return 0;
  }
}
```

Every new discount type requires editing this method, risking regressions in existing discount logic.

<span class="good">Applying OCP with the strategy pattern:</span> <span class="label label-ts">TypeScript</span>

```typescript
interface DiscountStrategy {
  calculate(total: number): number;
}

class SeasonalDiscount implements DiscountStrategy {
  calculate(total: number): number { return total * 0.1; }
}

class LoyaltyDiscount implements DiscountStrategy {
  calculate(total: number): number { return total * 0.15; }
}

// New discount: just add a new class. No existing code changes.
class ReferralDiscount implements DiscountStrategy {
  calculate(total: number): number { return total * 0.2; }
}

class DiscountCalculator {
  constructor(private strategy: DiscountStrategy) {}
  calculate(total: number): number {
    return this.strategy.calculate(total);
  }
}
```

### 3. Liskov Substitution Principle (LSP)

Subtypes must be **substitutable** for their base types without breaking correctness. If code works with a base class, it must also work with any subclass.

<span class="bad">Classic LSP violation:</span> <span class="label label-ts">TypeScript</span>

```typescript
class Rectangle {
  constructor(protected width: number, protected height: number) {}

  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  area(): number { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number) { this.width = w; this.height = w; }
  setHeight(h: number) { this.width = h; this.height = h; }
}

// This breaks:
function expectArea(rect: Rectangle) {
  rect.setWidth(5);
  rect.setHeight(4);
  console.log(rect.area()); // Rectangle: 20, Square: 16!
}
```

Square changes the behavior of setWidth/setHeight in a way that breaks expectations of Rectangle users.

<span class="good">Fix: use separate types or a read-only interface:</span> <span class="label label-ts">TypeScript</span>

```typescript
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area(): number { return this.width * this.height; }
}

class Square implements Shape {
  constructor(private side: number) {}
  area(): number { return this.side * this.side; }
}
```

No inheritance, no broken substitution. Both satisfy the Shape contract honestly.

### 4. Interface Segregation Principle (ISP)

Don't force classes to implement interfaces they don't use. Prefer **focused interfaces** over fat ones.

This connects to the [interface discussion in the coupling section](#fixing-tight-coupling--worked-example): well-designed interfaces should be shaped around what consumers need.

<span class="bad">Fat interface:</span> <span class="label label-ts">TypeScript</span>

```typescript
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  attendMeeting(): void;
}

// A robot worker is forced to implement eat() and sleep()
class RobotWorker implements Worker {
  work() { /* ... */ }
  eat() { throw new Error("Robots don't eat"); }
  sleep() { throw new Error("Robots don't sleep"); }
  attendMeeting() { /* ... */ }
}
```

<span class="good">Segregated interfaces:</span> <span class="label label-ts">TypeScript</span>

```typescript
interface Workable {
  work(): void;
}

interface Feedable {
  eat(): void;
  sleep(): void;
}

interface Meetable {
  attendMeeting(): void;
}

class HumanWorker implements Workable, Feedable, Meetable {
  work() { /* ... */ }
  eat() { /* ... */ }
  sleep() { /* ... */ }
  attendMeeting() { /* ... */ }
}

class RobotWorker implements Workable, Meetable {
  work() { /* ... */ }
  attendMeeting() { /* ... */ }
}
```

Each class only implements what it actually supports. No dead methods, no thrown errors.

### 5. Dependency Inversion Principle (DIP)

High-level modules should not depend on low-level modules. Both should depend on **abstractions**.

This is the principle behind everything in the [coupling section](#coupling). The PaymentGateway interface, the OrderNotifier interface, the OrderRepository interface: all are DIP in action.

DIP ties SOLID together: SRP tells you *what* to split, OCP tells you *how* to extend, LSP tells you *how* to substitute, ISP tells you *how* to shape interfaces, and DIP tells you *what* to depend on.

### SOLID Summary

| Principle | One-Line Description |
|---|---|
| **Single Responsibility** | A class should have one reason to change |
| **Open/Closed** | Extend behavior without modifying existing code |
| **Liskov Substitution** | Subtypes must be drop-in replacements for their base types |
| **Interface Segregation** | Prefer small, focused interfaces over large, general ones |
| **Dependency Inversion** | Depend on abstractions, not concrete implementations |

<div class="callout tip">
  <strong>Keep perspective:</strong> SOLID principles are guidelines, not laws. Apply them when they reduce complexity. Forcing SOLID onto simple code makes it harder to read.
</div>

## MVC Pattern

Model-View-Controller is the architectural pattern behind most web frameworks: Express, Django, Rails, Spring, and many others. It separates an application into three roles:

- **Model**: data and business logic. Services, domain objects, database access.
- **View**: what the user sees. HTML templates, JSON responses, UI components.
- **Controller**: handles input and coordinates. Receives a request, calls the model, returns a view.

### MVC in an Express API

<span class="label label-ts">TypeScript</span>

```typescript
// Model: service + repository handle data and business logic
class OrderService {
  constructor(private repo: OrderRepository) {}

  async getOrder(id: string): Promise<Order | null> {
    return this.repo.findById(id);
  }
}

// Controller: handles HTTP input, calls the model, returns a response (view)
class OrderController {
  constructor(private service: OrderService) {}

  async getOrder(req: Request, res: Response) {
    const order = await this.service.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });
    return res.json(order); // JSON response is the "view"
  }
}

// Route wiring
const controller = new OrderController(orderService);
app.get("/orders/:id", (req, res) => controller.getOrder(req, res));
```

The controller doesn't contain business logic or SQL. The service doesn't know about HTTP. The JSON response acts as the view layer in an API context.

<div class="callout info">
  <strong>Note:</strong> MVP (Model-View-Presenter) and MVVM (Model-View-ViewModel) are frontend variants of this pattern, commonly used in mobile and SPA frameworks. They are not covered here.
</div>

## Test-Driven Development (TDD)

TDD is a development workflow where you write the test **before** the implementation. It follows a three-step cycle called Red-Green-Refactor:

1. **Red**: write a test that fails (the feature doesn't exist yet)
2. **Green**: write the minimum code to make the test pass
3. **Refactor**: clean up the code while keeping the test green

This connects to the [testing pyramid](#are-mocks-reliable-the-testing-pyramid): TDD primarily produces unit tests, the base of the pyramid.

### TDD in Practice: Building an OrderValidator

Let's build an `OrderValidator` using three TDD cycles. <span class="label label-ts">TypeScript</span> with Jest.

**Cycle 1: orders must have at least one item**

```typescript
// Red: write the failing test
test("rejects orders with no items", () => {
  const validator = new OrderValidator();
  const result = validator.validate({ items: [], total: 50 });
  expect(result).toEqual({ valid: false, error: "Order must have at least one item" });
});

// Green: minimum code to pass
class OrderValidator {
  validate(order: { items: any[]; total: number }) {
    if (order.items.length === 0) {
      return { valid: false, error: "Order must have at least one item" };
    }
    return { valid: true };
  }
}
```

**Cycle 2: total must be positive**

```typescript
// Red: new failing test
test("rejects orders with zero total", () => {
  const validator = new OrderValidator();
  const result = validator.validate({ items: ["item1"], total: 0 });
  expect(result).toEqual({ valid: false, error: "Order total must be positive" });
});

// Green: extend to handle this case
class OrderValidator {
  validate(order: { items: any[]; total: number }) {
    if (order.items.length === 0) {
      return { valid: false, error: "Order must have at least one item" };
    }
    if (order.total <= 0) {
      return { valid: false, error: "Order total must be positive" };
    }
    return { valid: true };
  }
}
```

**Cycle 3: valid orders pass**

```typescript
// Red: test the happy path
test("accepts valid orders", () => {
  const validator = new OrderValidator();
  const result = validator.validate({ items: ["item1"], total: 99.99 });
  expect(result).toEqual({ valid: true });
});

// Green: already passes. Refactor: extract a result type.
interface ValidationResult {
  valid: boolean;
  error?: string;
}

class OrderValidator {
  validate(order: { items: any[]; total: number }): ValidationResult {
    if (order.items.length === 0) {
      return { valid: false, error: "Order must have at least one item" };
    }
    if (order.total <= 0) {
      return { valid: false, error: "Order total must be positive" };
    }
    return { valid: true };
  }
}
```

### When TDD Works Well

- **Business logic**: validation rules, calculations, state machines
- **Algorithms**: sorting, filtering, transformation pipelines
- **Validators**: input checking, schema enforcement

### When TDD Is Less Useful

- **UI code**: visual layout is hard to express as a test-first assertion
- **Infrastructure**: database migrations, deployment scripts
- **Exploratory code**: prototyping where requirements are still unclear

<div class="callout tip">
  <strong>TDD is a design tool, not just a testing tool.</strong> Writing the test first forces you to think about the interface before the implementation. You discover awkward APIs, missing parameters, and unclear responsibilities before you write a single line of production code.
</div>

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

## Scenario Challenges

{{< case-studies >}}

## Interactive Case Studies

{{< interactive-cases >}}
