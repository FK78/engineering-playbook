---
title: "Part 2: API & Domain"
subtitle: "API Design (REST, GraphQL) & Domain Modeling"
linkTitle: "Part 2: API & Domain"
weight: 2
type: "docs"
quiz:
  - q: "Your mobile app only needs a user's name and avatar, but your REST endpoint returns the full user profile with 30 fields. What's the problem and how would you solve it?"
    concepts:
      - label: "over-fetching"
        terms: ["over-fetch", "overfetch", "too much data", "unnecessary data", "wasted data", "extra fields", "don't need"]
      - label: "solution approach"
        terms: ["graphql", "bff", "backend for frontend", "fields param", "sparse fieldset", "select fields", "custom endpoint", "tailored"]
      - label: "client-driven"
        terms: ["client decide", "client choose", "client request", "client specif", "ask for what", "only what"]
    answer: "Over-fetching. Solutions: use GraphQL so the client requests only what it needs, add a fields query parameter, or create a BFF (Backend for Frontend) with a tailored response for mobile."
  - q: "You're designing a URL for 'cancel order 123'. Should it be GET /cancelOrder/123? Why or why not?"
    concepts:
      - label: "URLs should be nouns"
        terms: ["noun", "resource", "not a verb", "shouldn't be a verb", "no verb", "verb in url", "action in url"]
      - label: "use correct HTTP method"
        terms: ["patch", "post", "put", "delete", "http method", "http verb", "not get", "get shouldn't", "get is for reading"]
      - label: "model as state change or resource"
        terms: ["status", "state", "cancellation", "cancelled", "cancel as", "update the"]
    answer: "No. URLs should be nouns (resources), not verbs. Use PATCH /orders/123 with {status: 'cancelled'}, or POST /orders/123/cancellation if you model cancellation as a resource."
  - q: "What is an aggregate root and why does the Repository pattern work with it?"
    concepts:
      - label: "entry point to a cluster"
        terms: ["entry point", "root", "main entity", "parent", "top-level", "cluster", "group of entit"]
      - label: "consistency boundary"
        terms: ["consisten", "boundar", "invariant", "rule", "valid", "integrity", "unit"]
      - label: "repository saves the whole aggregate"
        terms: ["save", "load", "persist", "whole", "together", "as one", "including child", "including item", "single unit"]
    answer: "An aggregate root is the entry point to a cluster of related entities. All changes go through the root to maintain consistency. The Repository saves/loads the entire aggregate as a unit."
  - q: "Your company has a 'Product' in the catalog, warehouse, and pricing systems. Should they all share one Product class?"
    concepts:
      - label: "no, different bounded contexts"
        terms: ["no", "bounded context", "different context", "separate context", "different meaning", "different model", "own model"]
      - label: "different needs per context"
        terms: ["different field", "different propert", "different need", "catalog has", "warehouse has", "pricing has", "each system", "each context"]
      - label: "avoid god object"
        terms: ["god object", "god class", "bloat", "too big", "too many field", "everything in one", "monolith"]
    answer: "No. Each system is a different bounded context. Catalog Product has descriptions. Warehouse Product has weight and location. Sharing one class creates a god object."
  - q: "When would you choose GraphQL over REST?"
    concepts:
      - label: "multiple/varied clients"
        terms: ["multiple client", "different client", "mobile", "web and mobile", "varied", "each client", "frontend"]
      - label: "complex/nested data"
        terms: ["nested", "complex", "relat", "joined", "connected", "graph", "deep"]
      - label: "over/under-fetching problems"
        terms: ["over-fetch", "overfetch", "under-fetch", "underfetch", "too much", "too many request", "n+1", "multiple request", "round trip"]
    answer: "When you have multiple client types needing different data, complex nested relationships, or want to avoid over/under-fetching. Common for mobile apps or as a gateway aggregating microservices."
case_studies:
  - title: "One API, Three Very Different Clients"
    category: "Architecture Decision"
    difficulty: "⭐⭐"
    scenario: "SmartHome Inc. has a REST API with 50 endpoints serving three clients: a React web dashboard, a mobile app (iOS/Android), and IoT sensor devices with 256KB RAM. The mobile team complains that the GET /devices endpoint returns 2KB per device when they only need name and status (80 bytes). The IoT devices need sub-100ms responses with payloads under 512 bytes. The web team wants rich, nested data with device history and analytics. Last month, the team created 6 mobile-specific endpoints, and the API is becoming unmaintainable."
    constraints: "8 engineers (3 backend, 3 frontend, 2 IoT firmware), 50 existing REST endpoints with external partner integrations, IoT devices cannot be updated once deployed, API must remain backward-compatible"
    prompts:
      - "Should you adopt GraphQL, create Backend-for-Frontend (BFF) services, or add field selection to your REST API? What factors drive this decision?"
      - "The IoT devices have severe constraints: tiny payloads, no ability to update firmware. How does this affect your API strategy?"
      - "How do you handle the transition without breaking the 50 existing endpoints that external partners depend on?"
      - "What are the operational costs of each approach? Consider monitoring, debugging, and team cognitive load."
    approaches:
      - name: "GraphQL Gateway"
        description: "Introduce a GraphQL layer in front of the existing REST services. Web and mobile clients query GraphQL and request exactly the fields they need. IoT devices continue using a dedicated lightweight REST endpoint with minimal payloads. Keep existing REST endpoints for external partners."
        trade_off: "Solves over-fetching cleanly for web and mobile, and the schema serves as living documentation. But adds a new technology to the stack, requires training the team, and GraphQL caching is harder than REST caching. IoT still needs a separate solution."
      - name: "Backend-for-Frontend (BFF) Pattern"
        description: "Create three thin API layers, one for web, one for mobile, one for IoT, each tailored to its client's needs. Each BFF calls the same underlying services but shapes the response differently. Web BFF returns rich nested data, mobile BFF returns compact payloads, IoT BFF returns binary-encoded minimal responses."
        trade_off: "Each client gets exactly what it needs with no compromise. But you now maintain three API surfaces instead of one. Changes to underlying services may require updates to all three BFFs. Works best when each client has a dedicated team."
      - name: "Sparse Fieldsets on Existing REST"
        description: "Add a ?fields=name,status query parameter to existing REST endpoints, letting clients specify which fields to return. Add a ?include=history,analytics parameter for nested resources. IoT devices use fields to get minimal payloads. No new infrastructure needed."
        trade_off: "Lowest effort. Extends existing REST API without new services or technologies. But field selection logic adds complexity to every endpoint, doesn't solve deeply nested data needs well, and IoT payload size depends on JSON overhead (consider MessagePack for IoT)."
  - title: "The Product That Means Everything"
    category: "Architecture Decision"
    difficulty: "⭐⭐⭐"
    scenario: "GearUp is an e-commerce company with $40M annual revenue. Their single PostgreSQL database has a products table with 85 columns because three teams share it: Catalog (descriptions, images, SEO metadata, categories), Warehouse (weight, dimensions, shelf location, reorder threshold), and Pricing (base price, discount rules, tax category, regional pricing). Last quarter, the Pricing team's migration to add a currency_rules column broke the Warehouse team's inventory sync job, causing a 4-hour outage. Teams average 2 merge conflicts per week on the Product model. Feature delivery has slowed by 40% year-over-year."
    constraints: "3 teams of 4 engineers each, shared PostgreSQL database with 2.3M product rows, 15 downstream services consume the products table via direct queries or CDC, must maintain referential integrity for orders"
    prompts:
      - "How would you split the monolithic Product into bounded contexts? What belongs to each context?"
      - "15 downstream services query the products table directly. How do you migrate them without a big-bang cutover?"
      - "How do the three contexts share data they all need (like product ID and name)? What's the communication pattern?"
      - "What happens to existing JOINs between products and orders? How do you maintain referential integrity across contexts?"
    approaches:
      - name: "Separate Tables, Shared Database"
        description: "Split the 85-column products table into three domain-specific tables (catalog_products, warehouse_products, pricing_products) in the same database, linked by product_id. Each team owns their table's schema. Create views that reconstruct the old table shape for backward compatibility with downstream consumers."
        trade_off: "Lowest risk: no new infrastructure, referential integrity via foreign keys, and views provide backward compatibility. But teams still share a database, so deployment coupling remains. A bad migration by one team can still lock the shared database."
      - name: "Separate Services with Event Sync"
        description: "Extract each context into its own service with its own database. Catalog Service, Warehouse Service, and Pricing Service each own their data. When Catalog updates a product name, it publishes a ProductNameChanged event that Warehouse and Pricing consume to update their local copies."
        trade_off: "Full team autonomy: each team deploys independently with no schema conflicts. But introduces eventual consistency (Warehouse might show an old product name briefly), requires event infrastructure (Kafka/SQS), and cross-context queries become harder. Migrating 15 downstream consumers is a major effort."
      - name: "Modular Monolith with Internal APIs"
        description: "Keep one deployable unit but enforce strict module boundaries. Each team's code lives in a separate module with a defined internal API. The Product model is split into three module-specific models. Cross-module access goes through service interfaces, never direct table access. A shared kernel contains only product_id and name."
        trade_off: "Eliminates merge conflicts and enforces boundaries without distributed systems complexity. But requires tooling to enforce module boundaries (linter rules, architecture tests). Doesn't solve the single-database bottleneck if one team's queries are slow."
interactive_cases:
  - title: "The Marketplace API Brief"
    type: "parade-of-facts"
    difficulty: "⭐⭐"
    brief: "A product manager dumps a 500-word brief about building a new API for a marketplace. It's packed with details: user counts, revenue targets, tech stack preferences, competitor analysis, team size, office locations, and the CEO's favourite programming language. Your job is to cut through the noise and identify what actually matters architecturally."
    opening: "Hey! So excited to kick this off. Here's the brief for our new marketplace API. We have 50,000 buyers, 3,000 sellers, and 200 admin users. Revenue target is $2M ARR by Q4. The CEO loves Rust but the team knows TypeScript. Our main competitor uses Go with gRPC. We have teams in London and Berlin, 12 engineers total. We need buyers to browse products, sellers to manage inventory, and admins to handle disputes. Oh, and we're planning to open the API to third-party developers next year. The Product model is used by all three teams but they each need different fields. What do you think?"
    key_issues: "Different data needs per client type (BFF/GraphQL decision), Product bounded context conflict, public API versioning strategy"
    red_herrings: "CEO's language preference, office locations, competitor's tech stack, revenue targets"
---

{{< audio-player part="part2" >}}

## REST Fundamentals

**REST** (Representational State Transfer) is an architectural style for APIs. It's not a protocol. It's a set of constraints that, when followed, make APIs predictable and scalable.

<div class="callout tip">
  <strong>Real-World Example:</strong> Stripe's REST API is widely considered the gold standard for API design. They use consistent resource-based URLs (/v1/charges, /v1/customers), proper HTTP verbs, predictable status codes, and idempotency keys for safe retries. Their API is so well-designed that "make it like Stripe's API" has become shorthand in the industry for good REST practices. It demonstrates how following REST constraints rigorously creates an API that developers love.
</div>

### Core Principles

- **Resources**: everything is a resource identified by a URL: `/orders/123`, `/users/456`
- **HTTP verbs**: the action is expressed by the method, not the URL
- **Stateless**: each request contains everything the server needs. No server-side session.
- **Representations**: resources can have multiple formats (JSON, XML). The client gets a *representation*, not the resource itself.

### HTTP Verbs

| Verb | Purpose | Idempotent? | Example |
|---|---|---|---|
| **GET** | Read a resource | Yes | `GET /orders/123` |
| **POST** | Create a resource | No | `POST /orders` |
| **PUT** | Replace a resource entirely | Yes | `PUT /orders/123` |
| **PATCH** | Partially update a resource | Yes* | `PATCH /orders/123` |
| **DELETE** | Remove a resource | Yes | `DELETE /orders/123` |

<div class="callout info">
  <strong>Idempotent</strong> means calling it multiple times produces the same result. <code>DELETE /orders/123</code> twice? Same outcome, the order is gone. <code>POST /orders</code> twice? Two orders created. That's why POST isn't idempotent.
</div>

### Status Codes

| Range | Meaning | Common Codes |
|---|---|---|
| **2xx** | Success | 200 OK, 201 Created, 204 No Content |
| **3xx** | Redirect | 301 Moved, 304 Not Modified |
| **4xx** | Client error | 400 Bad Request, 401 Unauthorized, 404 Not Found, 409 Conflict |
| **5xx** | Server error | 500 Internal Error, 503 Service Unavailable |

## REST in Practice

<div class="callout tip">
  <strong>Real-World Example:</strong> Twilio built their entire business on a clean REST API. Their URL structure (/Accounts/{sid}/Messages) uses nouns and hierarchy, POST creates messages, GET retrieves them, and every response includes consistent pagination and error formats. This predictability meant developers could integrate Twilio in hours, not days, proving that practical REST design directly impacts developer adoption and business growth.
</div>

### URL Design

<span class="good">Good:</span> Nouns for resources, hierarchy for relationships

```text
GET    /users/42/orders          # orders belonging to user 42
GET    /users/42/orders/7        # specific order
POST   /users/42/orders          # create order for user 42
GET    /orders?status=pending    # filter with query params
```

<span class="bad">Bad:</span> Verbs in URLs, flat structure

```text
GET    /getOrdersForUser?userId=42    # verb in URL
POST   /createOrder                    # action in URL
GET    /getAllPendingOrders             # filtering baked into path
```

### A Practical REST API

<span class="label label-ts">TypeScript</span>, Express example:

```typescript
const router = express.Router();

// GET /orders — list orders
router.get("/orders", async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const orders = await orderService.list({ status, page: +page, limit: +limit });
  res.json({
    data: orders.items,
    pagination: { page: +page, limit: +limit, total: orders.total }
  });
});

// GET /orders/:id — get one order
router.get("/orders/:id", async (req, res) => {
  const order = await orderService.getById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ data: order });
});

// POST /orders — create an order
router.post("/orders", async (req, res) => {
  const order = await orderService.create(req.body);
  res.status(201).json({ data: order });
});

// PATCH /orders/:id — partial update
router.patch("/orders/:id", async (req, res) => {
  const order = await orderService.update(req.params.id, req.body);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ data: order });
});

// DELETE /orders/:id
router.delete("/orders/:id", async (req, res) => {
  await orderService.delete(req.params.id);
  res.status(204).send();
});
```

<span class="label label-py">Python</span>, FastAPI example:

```python
from fastapi import FastAPI, HTTPException

app = FastAPI()

@app.get("/orders")
async def list_orders(status: str = None, page: int = 1, limit: int = 20):
    orders = await order_service.list(status=status, page=page, limit=limit)
    return {"data": orders.items, "pagination": {"page": page, "limit": limit, "total": orders.total}}

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await order_service.get_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"data": order}

@app.post("/orders", status_code=201)
async def create_order(body: CreateOrderRequest):
    order = await order_service.create(body)
    return {"data": order}

@app.delete("/orders/{order_id}", status_code=204)
async def delete_order(order_id: str):
    await order_service.delete(order_id)
```

### Pagination

Never return unbounded lists. Common approaches:

| Style | How it works | Best for |
|---|---|---|
| **Offset/Limit** | `?page=2&limit=20` | Simple UIs with page numbers |
| **Cursor-based** | `?after=abc123&limit=20` | Infinite scroll, real-time data |

<div class="callout tip">
  <strong>Cursor-based is more reliable.</strong> Offset pagination breaks when items are inserted/deleted between pages. Cursor pagination uses a stable reference point.
</div>

### Versioning

APIs evolve. Common strategies:

- **URL path:** `/v1/orders`, `/v2/orders`. Simple, explicit.
- **Header:** `Accept: application/vnd.myapp.v2+json`. Cleaner URLs, harder to discover.
- **Query param:** `/orders?version=2`. Easy but messy.

<div class="callout info">
  <strong>Most teams use URL path versioning.</strong> It's the simplest to implement, test, and document.
</div>

## GraphQL

A query language for APIs. Instead of the server deciding what data to return, the **client specifies exactly what it needs**.

<div class="callout tip">
  <strong>Real-World Example:</strong> GitHub switched from REST (v3) to GraphQL (v4) for their public API. Their REST API required multiple round trips to fetch a pull request with its reviews, comments, and status checks, sometimes 5+ requests. With GraphQL, clients fetch all of that in a single query. GitHub reported that mobile clients saw significant performance improvements because they could request only the fields they needed instead of downloading full resource representations.
</div>

### How It Works

One endpoint (`POST /graphql`), the client sends a query:

```graphql
query {
  order(id: "123") {
    id
    total
    status
    customer {
      name
      email
    }
    items {
      productName
      quantity
      price
    }
  }
}
```

Server returns exactly that shape, no more, no less:

```json
{
  "data": {
    "order": {
      "id": "123",
      "total": 59.99,
      "status": "shipped",
      "customer": { "name": "Alice", "email": "alice@example.com" },
      "items": [
        { "productName": "Widget", "quantity": 2, "price": 29.99 }
      ]
    }
  }
}
```

### Schema Definition

```graphql
type Order {
  id: ID!
  total: Float!
  status: String!
  customer: Customer!
  items: [OrderItem!]!
}

type Customer {
  id: ID!
  name: String!
  email: String!
}

type Query {
  order(id: ID!): Order
  orders(status: String, limit: Int): [Order!]!
}

type Mutation {
  createOrder(input: CreateOrderInput!): Order!
  updateOrderStatus(id: ID!, status: String!): Order!
}
```

### Resolvers

<span class="label label-ts">TypeScript</span>

```typescript
const resolvers = {
  Query: {
    order: async (_, { id }) => orderService.getById(id),
    orders: async (_, { status, limit }) => orderService.list({ status, limit }),
  },
  Mutation: {
    createOrder: async (_, { input }) => orderService.create(input),
  },
  // Nested resolver — only runs if client asks for 'customer'
  Order: {
    customer: async (order) => customerService.getById(order.customerId),
    items: async (order) => orderItemService.getByOrderId(order.id),
  }
};
```

### Key Concepts

- **Query**: read data (like GET)
- **Mutation**: write data (like POST/PUT/DELETE)
- **Subscription**: real-time updates via WebSocket
- **Resolver**: function that fetches data for a field
- **Schema**: the contract defining all types and operations

## REST vs GraphQL

<div class="callout tip">
  <strong>Real-World Example:</strong> Airbnb uses both REST and GraphQL in their architecture. Their internal microservices communicate via REST for simple CRUD operations, while their frontend teams use a GraphQL gateway that aggregates data from multiple services. This hybrid approach lets backend teams keep services simple while giving frontend engineers the flexibility to fetch exactly the data each page needs in a single request.
</div>

| | REST | GraphQL |
|---|---|---|
| **Endpoints** | Many (`/orders`, `/users`) | One (`/graphql`) |
| **Data shape** | Server decides | Client decides |
| **Over-fetching** | Common | Solved |
| **Under-fetching** | Common (need multiple requests) | Solved (one query, nested data) |
| **Caching** | Easy (HTTP caching built-in) | Harder (single endpoint, POST) |
| **Learning curve** | Lower | Higher |
| **File uploads** | Simple (multipart) | Awkward |

### When to Use Which

| Scenario | Choose | Why |
|---|---|---|
| Simple CRUD API | REST | Simpler, well-understood, easy caching |
| Multiple client types (mobile, web) | GraphQL | Each client fetches exactly what it needs |
| Public API for third parties | REST | Lower barrier, better docs standards |
| Complex nested data | GraphQL | Avoids N+1 REST calls |
| Microservices gateway | GraphQL | Aggregates multiple services |

<div class="callout info">
  <strong>They're not mutually exclusive.</strong> Many teams use REST for simple services and GraphQL as a gateway that aggregates them.
</div>

## Communication Protocols Beyond REST

REST is the most common API style, but it is not the only way services communicate. As systems grow, different parts of your architecture have different needs: low-latency internal calls, real-time updates, one-way streams, or fully asynchronous messaging. Each protocol has trade-offs, and most production systems use several of them together.

### gRPC

**gRPC** is a high-performance RPC (Remote Procedure Call) framework created by Google. It uses **Protocol Buffers** (protobuf) for serialization and **HTTP/2** for transport.

Why is it faster than REST + JSON?

- **Binary format.** Protobuf encodes data in a compact binary format, producing payloads significantly smaller than JSON.
- **HTTP/2 multiplexing.** Multiple requests and responses share a single TCP connection, eliminating head-of-line blocking.
- **Streaming support.** gRPC natively supports server streaming, client streaming, and bidirectional streaming.

#### Defining a Service with Protobuf

A `.proto` file defines your service contract, including messages and RPC methods:

```protobuf
syntax = "proto3";

package orders;

service OrderService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc CreateOrder (CreateOrderRequest) returns (Order);
  rpc StreamOrderUpdates (GetOrderRequest) returns (stream OrderUpdate);
}

message GetOrderRequest {
  string order_id = 1;
}

message CreateOrderRequest {
  string customer_id = 1;
  repeated OrderItem items = 2;
}

message OrderItem {
  string product_id = 1;
  int32 quantity = 2;
}

message Order {
  string id = 1;
  string customer_id = 2;
  repeated OrderItem items = 3;
  string status = 4;
  double total = 5;
}

message OrderUpdate {
  string order_id = 1;
  string status = 2;
  string timestamp = 3;
}
```

#### gRPC Server and Client

<span class="label label-ts">TypeScript</span>

```typescript
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const packageDef = protoLoader.loadSync("order.proto");
const proto = grpc.loadPackageDefinition(packageDef).orders as any;

// Server
const server = new grpc.Server();
server.addService(proto.OrderService.service, {
  getOrder: async (call, callback) => {
    const order = await orderStore.findById(call.request.order_id);
    callback(null, order);
  },
  createOrder: async (call, callback) => {
    const order = await orderStore.create(call.request);
    callback(null, order);
  },
});
server.bindAsync("0.0.0.0:50051", grpc.ServerCredentials.createInsecure(), () => {
  console.log("gRPC server running on port 50051");
});

// Client
const client = new proto.OrderService("localhost:50051", grpc.credentials.createInsecure());
client.getOrder({ order_id: "123" }, (err, order) => {
  console.log("Order:", order);
});
```

<span class="label label-py">Python</span>

```python
import grpc
from concurrent import futures
import order_pb2
import order_pb2_grpc

# Server
class OrderServicer(order_pb2_grpc.OrderServiceServicer):
    async def GetOrder(self, request, context):
        order = await order_store.find_by_id(request.order_id)
        return order_pb2.Order(id=order.id, status=order.status, total=order.total)

server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
order_pb2_grpc.add_OrderServiceServicer_to_server(OrderServicer(), server)
server.add_insecure_port("[::]:50051")
server.start()

# Client
channel = grpc.insecure_channel("localhost:50051")
stub = order_pb2_grpc.OrderServiceStub(channel)
order = stub.GetOrder(order_pb2.GetOrderRequest(order_id="123"))
print("Order:", order)
```

<div class="callout tip">
  <strong>When to use gRPC:</strong> service-to-service communication, low-latency requirements, streaming data. <strong>When NOT to use:</strong> browser-facing clients (limited browser support for HTTP/2 gRPC), public APIs where developers need to debug with curl or Postman.
</div>

### WebSockets

**WebSockets** provide a persistent, bidirectional connection between client and server. Unlike HTTP, where the client sends a request and waits for a response, a WebSocket connection stays open and either side can send messages at any time.

How it differs from HTTP:

- HTTP: client opens connection, sends request, gets response, connection closes (or is reused for the next request).
- WebSocket: client opens connection via an HTTP upgrade handshake, then both sides send messages freely until one side closes the connection.

<span class="label label-ts">TypeScript</span> (using `ws` library)

```typescript
import { WebSocketServer, WebSocket } from "ws";

// Server
const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ user: message.user, text: message.text }));
      }
    });
  });

  ws.on("close", () => console.log("Client disconnected"));
});

// Client
const ws = new WebSocket("ws://localhost:8080");
ws.on("open", () => ws.send(JSON.stringify({ user: "Alice", text: "Hello!" })));
ws.on("message", (data) => console.log("Received:", JSON.parse(data.toString())));
```

<span class="label label-py">Python</span> (using `websockets` library)

```python
import asyncio
import websockets
import json

connected = set()

# Server
async def handler(websocket):
    connected.add(websocket)
    try:
        async for raw in websocket:
            message = json.loads(raw)
            for client in connected:
                if client.open:
                    await client.send(json.dumps({"user": message["user"], "text": message["text"]}))
    finally:
        connected.discard(websocket)

async def main():
    async with websockets.serve(handler, "localhost", 8080):
        await asyncio.Future()  # run forever

# Client
async def client():
    async with websockets.connect("ws://localhost:8080") as ws:
        await ws.send(json.dumps({"user": "Alice", "text": "Hello!"}))
        response = await ws.recv()
        print("Received:", json.loads(response))
```

<div class="callout tip">
  <strong>Use cases:</strong> real-time chat, live dashboards, notifications, collaborative editing. <strong>When NOT to use:</strong> simple request/response patterns (HTTP is simpler and more widely supported), stateless APIs where connections do not need to persist.
</div>

### Server-Sent Events (SSE)

**SSE** is a one-way streaming mechanism from server to client over a standard HTTP connection. The client opens a connection, and the server pushes events as they happen. It is simpler than WebSockets when you only need server-to-client updates.

<span class="label label-ts">TypeScript</span> (Express)

```typescript
import express from "express";

const app = express();

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send an update every 2 seconds
  const interval = setInterval(() => {
    sendEvent({ price: (Math.random() * 100).toFixed(2), timestamp: Date.now() });
  }, 2000);

  req.on("close", () => clearInterval(interval));
});

app.listen(3000);
```

<span class="label label-py">Python</span> (FastAPI)

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio, json, random, time

app = FastAPI()

async def event_generator():
    while True:
        data = json.dumps({"price": f"{random.uniform(0, 100):.2f}", "timestamp": time.time()})
        yield f"data: {data}\n\n"
        await asyncio.sleep(2)

@app.get("/events")
async def stream_events():
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

<div class="callout info">
  <strong>Use cases:</strong> live feeds, progress updates, stock tickers. SSE reconnects automatically if the connection drops, which WebSockets do not do natively.
</div>

### Message-Based Communication

Not all communication needs to be synchronous. Services can also communicate via **message queues** (e.g. SQS, RabbitMQ) and **event streams** (e.g. Kafka, EventBridge). This pattern is covered in depth in Part 3.

The key distinction:

| | Synchronous (REST, gRPC) | Asynchronous (Message Queues) |
|---|---|---|
| **Caller waits?** | Yes, blocks until response | No, fire and forget |
| **Coupling** | Caller must know the receiver | Caller publishes to a queue/topic |
| **Failure handling** | Caller gets an error immediately | Message is retried or dead-lettered |
| **Best for** | Queries, real-time responses | Background tasks, cross-service events |

### Protocol Comparison

| Protocol | Direction | Format | Connection | Best for |
|---|---|---|---|---|
| **REST** | Request/Response | JSON | New per request | CRUD APIs, public APIs |
| **gRPC** | Request/Response + Streaming | Protobuf | Persistent (HTTP/2) | Service-to-service, low latency |
| **WebSocket** | Bidirectional | Any | Persistent | Real-time, chat, collaboration |
| **SSE** | Server to Client | Text | Persistent | Live feeds, notifications |
| **Message Queue** | Async | Any | N/A | Background tasks, decoupling |

<div class="callout">
  <strong>Most systems use multiple protocols.</strong> REST for public APIs, gRPC between internal services, WebSockets for real-time features, and message queues for async work.
</div>

## Domain Modeling

Domain modeling is about structuring your code around the **business problem**, not the database or UI. It comes from Domain-Driven Design (DDD).

<div class="callout tip">
  <strong>Real-World Example:</strong> A large insurance company modeled their policies as aggregates with the Policy entity as the root, containing Coverage value objects and Claim entities. Business rules like "a policy can't have overlapping coverage periods" and "claims can't exceed the coverage limit" were enforced directly on the Policy aggregate. This meant underwriters and developers spoke the same language, and critical business invariants couldn't be bypassed by any code path.
</div>

### Entity

Has a unique identity that persists over time. Two orders with the same data but different IDs are different orders.

```typescript
class Order {
  constructor(
    public readonly id: string,
    public readonly customerId: string,
    private _status: OrderStatus,
    private _items: OrderItem[],
  ) {}

  get total(): number {
    return this._items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  addItem(item: OrderItem) {
    if (this._status !== "draft") throw new Error("Cannot modify a submitted order");
    this._items.push(item);
  }

  submit() {
    if (this._items.length === 0) throw new Error("Cannot submit empty order");
    this._status = "submitted";
  }
}
```

<div class="callout tip">
  <strong>Notice:</strong> The business rules live <em>on the entity</em>. "Can't modify a submitted order" and "can't submit an empty order" are enforced by the Order itself, not by a service checking from outside.
</div>

### Value Object

Defined by its attributes, not identity. Two addresses with the same street/city/postcode are the same address.

```typescript
class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error("Currency mismatch");
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

### Aggregate

A cluster of entities and value objects treated as a single unit. The **aggregate root** is the entry point. All changes go through it.

```typescript
// Order is the aggregate root
// OrderItems are part of the Order aggregate
class Order {  // aggregate root
  private items: OrderItem[];  // part of this aggregate

  addItem(product: Product, quantity: number) {
    this.items.push(new OrderItem(product.id, product.price, quantity));
  }
}

// Repository works with the aggregate root
interface OrderRepository {
  save(order: Order): Promise<void>;  // saves order AND its items
  findById(id: string): Promise<Order | null>;
}
```

### Domain Service

Logic that doesn't naturally belong to any single entity.

```typescript
class PricingService {
  calculateDiscount(order: Order, customer: Customer): Money {
    if (customer.isVip && order.total.amount > 100) {
      return new Money(order.total.amount * 0.1, order.total.currency);
    }
    return new Money(0, order.total.currency);
  }
}
```

## Bounded Contexts

A bounded context is a boundary within which a domain model is defined and consistent. The same real-world concept can mean different things in different contexts.

<div class="callout tip">
  <strong>Real-World Example:</strong> Amazon's teams each own their own "Customer" model. In the retail context, Customer has a shopping cart and wish list. In the shipping context, Customer has delivery addresses and delivery preferences. In the payments context, Customer has payment methods and billing history. Rather than forcing one massive Customer class across the company, each team defines exactly the model they need. This is a core reason Amazon's teams can deploy independently at scale.
</div>

<div class="diagram">
  <div class="layer" style="border-color: #4caf50;">
    <strong style="color: #4caf50;">Sales Context</strong><br>
    Customer = name, email, payment method<br>
    Order = items, total, discount
  </div>
  <div class="arrow">↕ Customer ID shared, but models are different</div>
  <div class="layer" style="border-color: #2196F3;">
    <strong style="color: #2196F3;">Shipping Context</strong><br>
    Customer = name, delivery address, phone<br>
    Order = weight, dimensions, tracking number
  </div>
  <div class="arrow">↕</div>
  <div class="layer" style="border-color: #f0a500;">
    <strong style="color: #f0a500;">Billing Context</strong><br>
    Customer = billing address, tax ID, payment history<br>
    Order = invoice number, amount due, payment status
  </div>
</div>

<div class="callout">
  <strong>The mistake:</strong> Creating one giant <code>Customer</code> class used everywhere. It becomes a god object. Bounded contexts prevent this.
</div>

### How Contexts Communicate

| Pattern | How | When |
|---|---|---|
| **Shared Kernel** | Both contexts share a small common model | Tightly related teams |
| **Anti-Corruption Layer** | Translate between contexts at the boundary | Integrating with legacy or external systems |
| **Events** | One context publishes events, others subscribe | Loose coupling between contexts |

<span class="label label-ts">TypeScript</span>, Anti-Corruption Layer example:

```typescript
class ShippingCustomerAdapter {
  constructor(private salesApi: SalesApiClient) {}

  async getShippingCustomer(customerId: string): Promise<ShippingCustomer> {
    const salesCustomer = await this.salesApi.getCustomer(customerId);
    return {
      id: salesCustomer.id,
      name: salesCustomer.name,
      deliveryAddress: salesCustomer.defaultAddress,
    };
  }
}
```

## Key Takeaways

1. **REST**: resources + HTTP verbs + status codes. Stateless, cacheable, well-understood.
2. **GraphQL**: client-driven queries. Solves over/under-fetching. Higher complexity.
3. **Choose based on your needs.** REST for simple APIs, GraphQL for complex client requirements. They can coexist.
4. **Domain modeling**: structure code around business concepts (entities, value objects, aggregates).
5. **Business rules belong on domain objects**, not scattered across services.
6. **Bounded contexts**: the same concept can have different models in different parts of the system.

## Check Your Understanding

{{< quiz >}}

## Scenario Challenges

{{< case-studies >}}

## Interactive Case Studies

{{< interactive-cases >}}
