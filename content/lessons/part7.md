---
title: "Part 7: Data Architecture"
date: 2026-04-14
weight: 7
quiz:
  - question: "Your e-commerce platform needs to store user sessions that expire after 30 minutes and require sub-millisecond lookups. Which database type is most appropriate?"
    answers:
      - "Relational database with indexed session table"
      - "Document store with TTL indexes"
      - "Key-value store with TTL support"
      - "Graph database with session nodes"
    correct: 2
    explanation: "Key-value stores like Redis are optimized for simple lookups by key with sub-millisecond latency and natively support TTL expiration — exactly what ephemeral session data needs."
  - question: "Your team implements cache-aside and a user updates their profile, but other users still see stale data for several minutes. Which cache invalidation strategy would best solve this while keeping the system simple?"
    answers:
      - "Increase the TTL to reduce cache misses"
      - "Switch to write-through caching so the cache updates on every write"
      - "Use event-based invalidation triggered by the profile update"
      - "Add versioning to all cache keys"
    correct: 2
    explanation: "Event-based invalidation reacts to the write event and immediately invalidates or updates the cached entry, eliminating the stale window that TTL alone would leave."
  - question: "You're sharding a multi-tenant SaaS database. Tenant sizes vary from 10 rows to 10 million rows. You choose tenant_id as the shard key. What is the most likely problem?"
    answers:
      - "Cross-shard joins will be impossible"
      - "Hot spots — large tenants create unbalanced shards"
      - "Shard keys cannot be strings"
      - "Consistent hashing won't work with tenant IDs"
    correct: 1
    explanation: "When tenant sizes are highly skewed, using tenant_id as the shard key concentrates large tenants on single shards, creating hot spots and unbalanced load."
  - question: "Your analytics dashboard reads from a leader-follower replicated database. Users report that a record they just inserted doesn't appear in the dashboard. What consistency pattern should you implement?"
    answers:
      - "Monotonic reads by pinning the user to one replica"
      - "Read-your-writes by routing the inserting user's reads to the leader"
      - "Eventual consistency with a longer replication lag tolerance"
      - "Strong consistency by making all reads go to the leader"
    correct: 1
    explanation: "Read-your-writes consistency ensures that a user who performed a write will see that write reflected in subsequent reads, typically by routing their reads to the leader or a replica known to be up-to-date."
  - question: "A financial trading platform must guarantee that a funds transfer either fully completes or fully rolls back, even during a server crash. Which property set is non-negotiable here?"
    answers:
      - "BASE — availability matters most for trading"
      - "ACID — atomicity and durability guarantee the transfer is never partial"
      - "CAP — partition tolerance is the primary concern"
      - "Eventual consistency — the balance will converge over time"
    correct: 1
    explanation: "Financial transactions require ACID guarantees. Atomicity ensures the transfer is all-or-nothing, and durability ensures committed transactions survive crashes. BASE's eventual consistency is unacceptable for money movement."
concepts:
  - label: "Database Selection"
    terms: ["relational", "document store", "key-value", "graph database", "time-series", "polyglot persistence"]
  - label: "Caching Strategies"
    terms: ["cache-aside", "read-through", "write-through", "write-behind", "lazy loading", "cache miss"]
  - label: "Cache Invalidation"
    terms: ["TTL", "event-based invalidation", "cache versioning", "stale data", "thundering herd"]
  - label: "Sharding"
    terms: ["horizontal partitioning", "shard key", "consistent hashing", "hash ring", "hot spot"]
  - label: "Replication"
    terms: ["leader-follower", "multi-leader", "leaderless", "replication lag", "quorum"]
  - label: "Data Pipelines"
    terms: ["ETL", "ELT", "batch processing", "stream processing", "data lake"]
  - label: "Consistency Patterns"
    terms: ["read-your-writes", "monotonic reads", "eventual consistency", "strong consistency", "causal consistency"]
  - label: "ACID vs BASE"
    terms: ["atomicity", "consistency", "isolation", "durability", "basically available", "soft state", "eventual consistency", "CAP theorem"]
case_studies:
  - title: "Fixing the 3-Second Feed Query"
    category: "Scaling Challenge"
    difficulty: "⭐⭐⭐"
    scenario: "BuzzBoard is a social media platform with 2M daily active users. The home feed — showing posts from followed users, sorted by relevance — is the core feature and accounts for 80% of all traffic. The current implementation runs a single SQL query that joins 6 tables: users, posts, follows, likes, comments, and media. Average feed load time is 3.2 seconds, with p99 at 8 seconds. The PostgreSQL database (db.r6g.2xlarge) is at 78% CPU during peak hours, and adding read replicas hasn't helped because the query itself is expensive. Users are churning — analytics shows a direct correlation between feed load time and 7-day retention. The product team wants sub-500ms feed loads."
    constraints: "Team: 5 backend engineers, 2 data engineers. Budget: $8K/month additional infrastructure. Timeline: 6 weeks to show measurable improvement. Cannot change the product requirements (feed must show posts from followed users with like/comment counts, sorted by a relevance score). Currently serving 15,000 feed requests/minute at peak."
    prompts:
      - "Should you optimize the existing SQL query (better indexes, materialized views) or fundamentally change how the feed is assembled? What signals tell you which approach is right?"
      - "If you pre-compute feeds, when do you compute them — on write (fan-out on write) or on read (fan-out on read)? How does the follow graph shape (celebrities with 1M followers vs. average users with 200) affect this decision?"
      - "What storage system would you use for the pre-computed feed? Why might a relational database not be the best fit for this access pattern?"
      - "How do you handle the transition? You can't take the feed offline for a week while you rebuild it."
    approaches:
      - name: "Denormalized Feed Cache with Fan-Out on Write"
        description: "When a user publishes a post, asynchronously write a feed entry to every follower's pre-computed feed in Redis (sorted set keyed by user_id, scored by relevance). Feed reads become a single Redis ZREVRANGE — no joins, no SQL. Use a background worker to handle fan-out via an SQS queue. For users with >50K followers (celebrities), use fan-out on read instead to avoid write amplification."
        trade_off: "Feed reads drop to <10ms — a 300x improvement. But write amplification is significant (a post from a user with 10K followers generates 10K Redis writes), storage costs increase substantially, and feed updates are eventually consistent (a new post may take 1-2 seconds to appear in all followers' feeds). The hybrid approach for celebrities adds complexity."
      - name: "Materialized View + Aggressive Caching"
        description: "Create a PostgreSQL materialized view that pre-joins the 6 tables and refreshes every 60 seconds. Add a Redis cache layer in front with a 30-second TTL for individual feed pages. Optimize the materialized view with partial indexes on active users and recent posts. This keeps the existing architecture but eliminates the expensive real-time join."
        trade_off: "Simplest to implement — no new infrastructure beyond Redis, and the team already knows PostgreSQL. But feeds are up to 90 seconds stale (60s refresh + 30s cache TTL), the materialized view refresh itself is expensive and locks the table briefly, and this approach has a scaling ceiling — at 5M DAU, the materialized view refresh may take too long."
      - name: "Dedicated Feed Service with Cassandra"
        description: "Build a separate feed microservice backed by Cassandra. Partition key is user_id, clustering key is relevance_score descending. When a post is created, an event triggers the feed service to write denormalized feed entries for each follower. The feed service exposes a simple API: GET /feed/{userId}?limit=20. The main application delegates all feed reads to this service."
        trade_off: "Purpose-built for the feed access pattern — Cassandra handles the write throughput of fan-out and provides fast partition scans for reads. But it introduces a new database technology the team must learn and operate, adds a network hop for feed reads, and requires careful handling of the denormalized data (updating a user's display name means updating it across millions of feed entries)."
  - title: "Multi-Tenant Database — The Noisy Neighbor Problem"
    category: "Architecture Decision"
    difficulty: "⭐⭐⭐"
    scenario: "DataForge is a B2B analytics SaaS with 500 customers sharing a single PostgreSQL database (db.r6g.4xlarge). Each customer's data is isolated by a tenant_id column on every table. The median customer has 50K rows in the events table, but the largest customer (MegaCorp) has 5M rows — 100x the average. MegaCorp runs complex analytical queries that regularly trigger sequential scans on the events table, pushing database CPU to 95% and causing query latency spikes for all other tenants. Last week, a MegaCorp report query ran for 12 minutes and caused 30-second response times across the platform. Three mid-tier customers have threatened to leave. The sales team is about to close another enterprise customer similar in size to MegaCorp."
    constraints: "Team: 4 backend engineers, 1 DBA. Budget: $12K/month additional infrastructure. Timeline: must show improvement within 4 weeks (before the 3 unhappy customers' contract renewals). Cannot break the existing API contract — tenants access data through the same REST API. Currently 500 tenants, expecting 50 more per quarter."
    prompts:
      - "What are the different strategies for isolating tenant workloads in a shared database? Think about the spectrum from query-level throttling to full database-per-tenant."
      - "How do you decide which tenants get their own database vs. staying in the shared pool? What criteria beyond data volume matter (query patterns, SLA tier, revenue)?"
      - "How do you migrate MegaCorp's data to a separate database without downtime? What's the sequence of operations to ensure no data is lost or duplicated during the move?"
      - "How does your solution handle the next MegaCorp-sized customer the sales team is about to close?"
    approaches:
      - name: "Tiered Isolation — Silo Large Tenants, Pool the Rest"
        description: "Move MegaCorp (and future enterprise tenants) to a dedicated RDS instance. Keep the remaining 499 tenants on the shared database. Add a tenant routing layer in the application that directs queries to the correct database based on tenant_id. Enterprise tenants get their own connection pool and can run heavy queries without affecting others. Use AWS DMS for zero-downtime migration of MegaCorp's data."
        trade_off: "Directly solves the noisy neighbor problem for the biggest offenders. But you now manage multiple databases (schema migrations must run on all of them), the routing layer adds complexity, and you need a clear policy for when a tenant 'graduates' to a dedicated instance. Cost scales linearly with the number of siloed tenants."
      - name: "Query-Level Throttling + Read Replicas for Analytics"
        description: "Implement per-tenant query throttling using pg_stat_statements monitoring and connection pool limits (e.g., MegaCorp gets max 5 concurrent queries). Route all analytical/reporting queries to a dedicated read replica, keeping the primary for transactional workloads. Add statement_timeout per tenant tier (enterprise: 60s, standard: 10s). This keeps all tenants in one database but prevents any single tenant from monopolizing resources."
        trade_off: "No data migration needed — fastest to implement (days, not weeks). But it's a band-aid: throttling MegaCorp's queries means their reports run slower, which may violate their SLA. Read replicas help with read load but don't solve the fundamental problem of a 5M-row table scan competing with small-tenant queries. This buys time but doesn't scale."
      - name: "Partition by Tenant with PostgreSQL Table Partitioning"
        description: "Convert the events table (and other large tables) to use PostgreSQL declarative partitioning with tenant_id as the partition key. Each tenant's data lives in its own physical partition. PostgreSQL's partition pruning ensures that MegaCorp's queries only scan MegaCorp's partition, not the entire table. Large tenants can have their partitions on faster storage (io2 volumes). No application changes needed — the partitioning is transparent to SQL queries."
        trade_off: "Elegant solution that keeps a single database while providing physical isolation of data. Partition pruning eliminates cross-tenant interference for most queries. But PostgreSQL has practical limits on partition count (500 tenants = 500 partitions per table, which can slow planning), partition maintenance (adding/removing tenants requires DDL), and some queries that span all partitions (admin dashboards) become slower. Works well up to ~1,000 tenants but may need re-evaluation beyond that."
interactive_cases:
  - title: "The Database Performance Report"
    type: "parade-of-facts"
    difficulty: "⭐⭐"
    brief: "Your SaaS platform's database is struggling and the team has compiled a comprehensive performance report. You need to cut through the noise and identify the real bottlenecks."
    opening: "Here's what we're seeing: 47 tables, largest table has 800M rows, average query time 340ms, 12 queries over 5 seconds, connection pool at 95% capacity, 3TB database size, read/write ratio 92:8, most expensive query is a dashboard JOIN across 6 tables, indexes total 400GB, autovacuum running every 2 minutes, replication lag 45 seconds, the DBA quit last month, we're on PostgreSQL 12 (3 versions behind), and the CEO wants to migrate to MongoDB because 'it's faster'. What should we focus on?"
    key_issues: "The 6-table dashboard JOIN (denormalize/CQRS), connection pool exhaustion, replication lag indicating write pressure"
    red_herrings: "CEO's MongoDB suggestion, PostgreSQL version (not urgent), autovacuum frequency (normal for this size), DBA quitting (organizational not technical)"
---

Data architecture is the foundation every other architectural decision rests on. Choose the wrong database, ignore caching, or misunderstand consistency trade-offs, and no amount of clever application code will save you. This lesson covers the core decisions you'll face when designing data layers for real systems.

---

## 1. Database Selection

There is no universal "best database." Each category optimizes for a different access pattern.

| Type | Examples | Strengths | Weaknesses | Best For |
|------|----------|-----------|------------|----------|
| **Relational** | PostgreSQL, MySQL | ACID, joins, mature tooling | Rigid schema, harder to scale horizontally | Transactions, structured data, complex queries |
| **Document** | MongoDB, DynamoDB | Flexible schema, nested data | Weak joins, potential data duplication | Content management, catalogs, user profiles |
| **Key-Value** | Redis, Memcached | Sub-ms latency, simple API | No complex queries, limited data modeling | Sessions, caching, feature flags |
| **Graph** | Neo4j, Neptune | Relationship traversal | Poor for bulk analytics, smaller ecosystem | Social networks, fraud detection, recommendations |
| **Time-Series** | TimescaleDB, InfluxDB | Optimized for append & range queries | Not for general-purpose CRUD | Metrics, IoT, financial tick data |

<div class="callout tip">
<strong>Polyglot persistence:</strong> Most production systems use multiple database types. An e-commerce platform might use PostgreSQL for orders (ACID), Redis for sessions (speed), and Elasticsearch for product search (full-text). The key is choosing the right tool for each access pattern.
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> Instagram chose PostgreSQL over MongoDB early on because their data — users, photos, likes, follows — was highly relational and required strong consistency for features like follower counts and activity feeds. PostgreSQL's ACID guarantees and mature tooling for joins let them scale to hundreds of millions of users on a well-understood stack. They later added Cassandra for direct messages and Redis for caching, embracing polyglot persistence as each access pattern demanded a different tool.
</div>

### Choosing a Database — Decision Framework

<span class="label label-ts">TypeScript</span>

```typescript
// Type-safe database selector — models the decision process
type AccessPattern = "transactional" | "key-lookup" | "relationship-traversal" | "time-range" | "flexible-document";

const dbRecommendation: Record<AccessPattern, string> = {
  "transactional": "PostgreSQL — ACID guarantees, complex joins",
  "key-lookup": "Redis / DynamoDB — sub-ms by primary key",
  "relationship-traversal": "Neo4j — multi-hop graph queries",
  "time-range": "TimescaleDB — time-bucketed aggregations",
  "flexible-document": "MongoDB — schema-flexible nested documents",
};

function selectDatabase(pattern: AccessPattern): string {
  return dbRecommendation[pattern];
}

console.log(selectDatabase("transactional"));
// → "PostgreSQL — ACID guarantees, complex joins"
```

<span class="label label-py">Python</span>

```python
# Decision helper — maps access patterns to database recommendations
DB_RECOMMENDATION: dict[str, str] = {
    "transactional": "PostgreSQL — ACID guarantees, complex joins",
    "key_lookup": "Redis / DynamoDB — sub-ms by primary key",
    "relationship_traversal": "Neo4j — multi-hop graph queries",
    "time_range": "TimescaleDB — time-bucketed aggregations",
    "flexible_document": "MongoDB — schema-flexible nested documents",
}

def select_database(pattern: str) -> str:
    return DB_RECOMMENDATION[pattern]

print(select_database("transactional"))
# → "PostgreSQL — ACID guarantees, complex joins"
```

---

## 2. Caching Strategies

Caching sits between your application and the database, trading memory for speed. The strategy you choose determines how data flows through the cache.

| Strategy | Read Path | Write Path | Consistency | Complexity |
|----------|-----------|------------|-------------|------------|
| **Cache-Aside** | App checks cache → miss → read DB → populate cache | App writes DB → invalidates cache | Eventual (stale window) | Low |
| **Read-Through** | App reads cache → cache reads DB on miss | Same as cache-aside | Eventual | Medium |
| **Write-Through** | Same as read-through | App writes cache → cache writes DB synchronously | Strong | Medium |
| **Write-Behind** | Same as read-through | App writes cache → cache writes DB asynchronously | Eventual (risk of loss) | High |

<div class="callout info">
<strong>Cache-aside</strong> is the most common pattern because it's simple, the application controls the logic, and it works with any cache and database combination. Start here unless you have a specific reason not to.
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> Twitter uses Redis extensively to cache user timelines, avoiding expensive fan-out queries against their storage layer on every page load. When a user opens their home timeline, Twitter serves it from a pre-computed Redis cache rather than assembling it from thousands of followed accounts in real time. This cache-aside approach lets them handle over 400,000 timeline reads per second while keeping median latency under 5 ms.
</div>

### Cache-Aside with Redis

<span class="label label-ts">TypeScript</span>

```typescript
import { createClient } from "redis";

const redis = createClient({ url: "redis://localhost:6379" });
await redis.connect();

interface User {
  id: string;
  name: string;
  email: string;
}

async function getUser(userId: string): Promise<User> {
  const cacheKey = `user:${userId}`;

  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Cache miss — read from database
  const user = await db.query<User>("SELECT * FROM users WHERE id = $1", [userId]);

  // 3. Populate cache with TTL
  await redis.set(cacheKey, JSON.stringify(user), { EX: 300 }); // 5 min TTL

  return user;
}

async function updateUser(userId: string, data: Partial<User>): Promise<void> {
  // 1. Write to database
  await db.query("UPDATE users SET name = $1 WHERE id = $2", [data.name, userId]);

  // 2. Invalidate cache (don't update — avoids race conditions)
  await redis.del(`user:${userId}`);
}
```

<span class="label label-py">Python</span>

```python
import json
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

async def get_user(user_id: str) -> dict:
    cache_key = f"user:{user_id}"

    # 1. Check cache
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)

    # 2. Cache miss — read from database
    user = await db.fetch_one("SELECT * FROM users WHERE id = $1", user_id)

    # 3. Populate cache with TTL
    r.set(cache_key, json.dumps(user), ex=300)  # 5 min TTL

    return user

async def update_user(user_id: str, name: str) -> None:
    # 1. Write to database
    await db.execute("UPDATE users SET name = $1 WHERE id = $2", name, user_id)

    # 2. Invalidate cache
    r.delete(f"user:{user_id}")
```


---

## 3. Cache Invalidation

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

Cache invalidation is hard because you're maintaining two sources of truth. Every strategy is a trade-off between freshness, complexity, and performance.

### Strategies

**TTL (Time-To-Live)** — The simplest approach. Data expires after a fixed duration.

- ✅ Zero coordination needed
- ❌ Stale data until expiry; choosing the right TTL is a guessing game

**Event-Based Invalidation** — Invalidate or update the cache when the underlying data changes.

- ✅ Near-real-time freshness
- ❌ Requires reliable event delivery (message queues, CDC)

**Versioning** — Append a version number to cache keys. Bump the version on writes; old keys naturally become unreachable.

- ✅ No explicit deletion needed; atomic "invalidation"
- ❌ Orphaned keys consume memory until evicted

<span class="label label-ts">TypeScript</span>

```typescript
// Event-based invalidation with a message queue
import { createClient } from "redis";

const redis = createClient({ url: "redis://localhost:6379" });
await redis.connect();

// Producer: publish invalidation event after a write
async function onProductUpdated(productId: string): Promise<void> {
  await redis.del(`product:${productId}`);
  await redis.publish("cache:invalidate", JSON.stringify({ key: `product:${productId}` }));
}

// Consumer: subscribe to invalidation events (other instances)
const subscriber = redis.duplicate();
await subscriber.connect();
await subscriber.subscribe("cache:invalidate", (message) => {
  const { key } = JSON.parse(message);
  console.log(`Invalidated: ${key}`);
});
```

<span class="label label-py">Python</span>

```python
import json
import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# Versioned cache keys
def get_versioned_key(entity: str, entity_id: str) -> str:
    version = r.get(f"{entity}:version:{entity_id}") or "0"
    return f"{entity}:{entity_id}:v{version}"

def invalidate_version(entity: str, entity_id: str) -> None:
    """Bump version — old key becomes unreachable, no explicit delete."""
    r.incr(f"{entity}:version:{entity_id}")

# Usage
cache_key = get_versioned_key("product", "42")  # "product:42:v0"
invalidate_version("product", "42")
new_key = get_versioned_key("product", "42")     # "product:42:v1"
```

<div class="callout">
<strong>The thundering herd problem:</strong> When a popular cache key expires, hundreds of concurrent requests all miss the cache and hit the database simultaneously. Mitigate with <em>cache stampede locks</em> (only one request rebuilds the cache) or <em>stale-while-revalidate</em> (serve stale data while one request refreshes in the background).
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> Facebook faced severe thundering herd problems with Memcached when popular cache keys expired simultaneously across their fleet. They built a system called "lease tokens" — when a cache miss occurs, only the first request gets a lease to rebuild the cache, while subsequent requests either wait briefly or receive a slightly stale value. This event-based invalidation approach with stampede protection allowed them to serve billions of requests per day without overwhelming their MySQL backends.
</div>

---

## 4. Sharding

Sharding (horizontal partitioning) splits data across multiple database instances so no single node holds everything. It's how systems scale beyond what a single machine can handle.

### Core Concepts

- **Shard Key** — The column/field used to determine which shard holds a record. Choosing a bad shard key is the #1 cause of sharding failures.
- **Horizontal Partitioning** — Each shard holds a subset of rows (same schema). Contrast with vertical partitioning, which splits columns.
- **Consistent Hashing** — A technique that minimizes data movement when shards are added or removed.

<div class="diagram">

```
                    Consistent Hashing Ring

            Shard A                Shard B
          (hash 0-90)           (hash 91-180)
              ╲                     ╱
               ╲                   ╱
                ╲                 ╱
         ┌──────────────────────────────┐
         │         Hash Ring            │
         │    0 ──── 90 ──── 180       │
         │    │              │          │
         │   270 ─── 360/0  │          │
         └──────────────────────────────┘
                ╱                 ╲
               ╱                   ╲
              ╱                     ╲
          Shard D                Shard C
        (hash 271-360)        (hash 181-270)

  hash("user:alice") = 147  →  Shard B
  hash("user:bob")   = 302  →  Shard D
  hash("user:carol") = 58   →  Shard A

  Adding Shard E at position 135:
  - Only keys 91-135 move from Shard B → Shard E
  - All other shards are unaffected
```

</div>

<span class="label label-ts">TypeScript</span>

```typescript
import { createHash } from "crypto";

class ConsistentHashRing {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];

  constructor(private replicas: number = 100) {}

  addNode(node: string): void {
    for (let i = 0; i < this.replicas; i++) {
      const hash = this.hash(`${node}:${i}`);
      this.ring.set(hash, node);
      this.sortedKeys.push(hash);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  getNode(key: string): string {
    const hash = this.hash(key);
    for (const nodeHash of this.sortedKeys) {
      if (hash <= nodeHash) return this.ring.get(nodeHash)!;
    }
    return this.ring.get(this.sortedKeys[0])!; // wrap around
  }

  private hash(key: string): number {
    return parseInt(createHash("md5").update(key).digest("hex").slice(0, 8), 16);
  }
}

const ring = new ConsistentHashRing();
ring.addNode("shard-a");
ring.addNode("shard-b");
ring.addNode("shard-c");

console.log(ring.getNode("user:alice")); // → "shard-b"
console.log(ring.getNode("user:bob"));   // → "shard-a"
```

<span class="label label-py">Python</span>

```python
import hashlib
from bisect import bisect_right

class ConsistentHashRing:
    def __init__(self, replicas: int = 100):
        self.replicas = replicas
        self.ring: dict[int, str] = {}
        self.sorted_keys: list[int] = []

    def add_node(self, node: str) -> None:
        for i in range(self.replicas):
            h = self._hash(f"{node}:{i}")
            self.ring[h] = node
            self.sorted_keys.append(h)
        self.sorted_keys.sort()

    def get_node(self, key: str) -> str:
        h = self._hash(key)
        idx = bisect_right(self.sorted_keys, h) % len(self.sorted_keys)
        return self.ring[self.sorted_keys[idx]]

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest()[:8], 16)

ring = ConsistentHashRing()
ring.add_node("shard-a")
ring.add_node("shard-b")
ring.add_node("shard-c")

print(ring.get_node("user:alice"))  # → "shard-b"
print(ring.get_node("user:bob"))    # → "shard-a"
```

<div class="callout tip">
<strong>Shard key selection rules of thumb:</strong> (1) High cardinality — avoid keys with few distinct values. (2) Even distribution — avoid keys that cluster (e.g., country code if 80% of users are in one country). (3) Query alignment — the shard key should appear in your most common queries to avoid scatter-gather.
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> Discord shards their message storage by <code>guild_id</code> (server ID), ensuring all messages for a given server live on the same database node. This shard key aligns perfectly with their most common query — "fetch recent messages in this channel" — since channels belong to guilds, eliminating cross-shard queries. When they migrated from MongoDB to Cassandra, they kept this sharding strategy and used <code>channel_id</code> as the partition key with <code>message_id</code> as the clustering key, enabling efficient time-ordered scans within a single partition.
</div>


---

## 5. Replication

Replication copies data across multiple nodes for fault tolerance, read scalability, and geographic distribution. The topology you choose determines your consistency and availability trade-offs.

### Replication Topologies

<div class="diagram">

```
  Leader-Follower              Multi-Leader              Leaderless
  ──────────────              ────────────              ──────────

  ┌────────┐               ┌────────┐  ┌────────┐     ┌────────┐
  │ Leader │               │Leader A│←→│Leader B│     │Node A  │
  │ (R/W)  │               │ (R/W)  │  │ (R/W)  │     │ (R/W)  │
  └───┬────┘               └───┬────┘  └───┬────┘     └───┬────┘
      │                        │            │              │
  ┌───┴────┐               ┌───┴────┐  ┌───┴────┐     ┌───┴────┐
  │Follower│               │Follower│  │Follower│     │Node B  │
  │  (R)   │               │  (R)   │  │  (R)   │     │ (R/W)  │
  └───┬────┘               └────────┘  └────────┘     └───┬────┘
      │                                                    │
  ┌───┴────┐                                           ┌───┴────┐
  │Follower│                                           │Node C  │
  │  (R)   │                                           │ (R/W)  │
  └────────┘                                           └────────┘
```

</div>

| Topology | Writes | Reads | Conflict Handling | Use Case |
|----------|--------|-------|-------------------|----------|
| **Leader-Follower** | Single leader | Leader + followers | None (single writer) | Most applications; simple, well-understood |
| **Multi-Leader** | Multiple leaders | Any node | Conflict resolution required | Multi-datacenter, offline-capable clients |
| **Leaderless** | Any node (quorum) | Any node (quorum) | Read-repair, anti-entropy | High availability, Dynamo-style systems |

<span class="label label-ts">TypeScript</span>

```typescript
// Quorum reads/writes in a leaderless system
interface ReplicaResponse<T> {
  data: T;
  version: number;
  node: string;
}

async function quorumRead<T>(
  key: string,
  replicas: string[],
  readQuorum: number // W + R > N guarantees overlap
): Promise<T> {
  const responses = await Promise.allSettled(
    replicas.map((node) => readFromNode<T>(node, key))
  );

  const successes = responses
    .filter((r): r is PromiseFulfilledResult<ReplicaResponse<T>> => r.status === "fulfilled")
    .map((r) => r.value);

  if (successes.length < readQuorum) {
    throw new Error(`Quorum not met: ${successes.length}/${readQuorum}`);
  }

  // Return the value with the highest version
  return successes.sort((a, b) => b.version - a.version)[0].data;
}

// With N=3, W=2, R=2: any write overlaps with any read
const value = await quorumRead("user:42", ["node-a", "node-b", "node-c"], 2);
```

<span class="label label-py">Python</span>

```python
import asyncio
from dataclasses import dataclass

@dataclass
class ReplicaResponse:
    data: dict
    version: int
    node: str

async def quorum_read(
    key: str, replicas: list[str], read_quorum: int
) -> dict:
    tasks = [read_from_node(node, key) for node in replicas]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successes = [r for r in results if isinstance(r, ReplicaResponse)]

    if len(successes) < read_quorum:
        raise Exception(f"Quorum not met: {len(successes)}/{read_quorum}")

    # Return highest-version value
    return max(successes, key=lambda r: r.version).data

# N=3, W=2, R=2
value = await quorum_read("user:42", ["node-a", "node-b", "node-c"], 2)
```

<div class="callout info">
<strong>Quorum formula:</strong> With N replicas, if W (write quorum) + R (read quorum) > N, every read is guaranteed to see at least one replica that has the latest write. Common configurations: N=3, W=2, R=2 (balanced) or N=3, W=3, R=1 (fast reads, slower writes).
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> A major European bank uses PostgreSQL leader-follower replication to separate transactional writes from analytical reads. All account transactions (deposits, transfers, payments) go to the leader with full ACID guarantees, while customer-facing dashboards and reporting queries run against two read replicas. This pattern lets them handle 50,000 balance inquiries per minute without adding load to the leader, while using read-your-writes routing to ensure customers always see their most recent transaction.
</div>

---

## 6. Data Pipelines

Data pipelines move and transform data between systems. The two fundamental questions: *when* does data move (batch vs. streaming) and *where* does transformation happen (ETL vs. ELT)?

### ETL vs ELT

| Aspect | ETL (Extract-Transform-Load) | ELT (Extract-Load-Transform) |
|--------|------------------------------|------------------------------|
| **Transform location** | In the pipeline (before loading) | In the destination (after loading) |
| **Raw data preserved?** | No — only transformed data lands | Yes — raw data available for re-processing |
| **Best for** | Structured, well-known schemas | Data lakes, exploratory analytics |
| **Tools** | Apache Airflow, dbt (transform), Informatica | Snowflake, BigQuery, dbt (in-warehouse) |

### Batch vs Streaming

| Aspect | Batch | Streaming |
|--------|-------|-----------|
| **Latency** | Minutes to hours | Seconds to milliseconds |
| **Complexity** | Lower — simpler error handling | Higher — ordering, exactly-once delivery |
| **Cost** | Cheaper for large volumes | More expensive per event |
| **Use cases** | Nightly reports, ML training | Fraud detection, live dashboards |

<span class="label label-ts">TypeScript</span>

```typescript
// Simple batch pipeline: extract → transform → load
interface RawEvent {
  user_id: string;
  event: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface AggregatedMetric {
  user_id: string;
  event_count: number;
  date: string;
}

async function batchPipeline(date: string): Promise<void> {
  // Extract
  const events: RawEvent[] = await dataLake.query(
    `SELECT * FROM raw_events WHERE date = '${date}'`
  );

  // Transform
  const metrics = new Map<string, AggregatedMetric>();
  for (const event of events) {
    const key = `${event.user_id}:${date}`;
    const existing = metrics.get(key) ?? { user_id: event.user_id, event_count: 0, date };
    existing.event_count++;
    metrics.set(key, existing);
  }

  // Load
  await warehouse.bulkInsert("daily_metrics", [...metrics.values()]);
}
```

<span class="label label-py">Python</span>

```python
from dataclasses import dataclass

@dataclass
class AggregatedMetric:
    user_id: str
    event_count: int
    date: str

async def batch_pipeline(date: str) -> None:
    # Extract
    events = await data_lake.query(f"SELECT * FROM raw_events WHERE date = '{date}'")

    # Transform
    metrics: dict[str, AggregatedMetric] = {}
    for event in events:
        key = f"{event['user_id']}:{date}"
        if key not in metrics:
            metrics[key] = AggregatedMetric(event["user_id"], 0, date)
        metrics[key].event_count += 1

    # Load
    await warehouse.bulk_insert("daily_metrics", list(metrics.values()))
```

<div class="callout tip">
<strong>When to choose streaming over batch:</strong> If your business decision depends on data being <em>minutes</em> old, batch is fine. If it depends on data being <em>seconds</em> old (fraud detection, stock trading, real-time personalization), you need streaming. Most systems use both — streaming for hot-path alerts and batch for historical analytics.
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> Spotify uses massive batch pipelines (powered by Google Cloud Dataflow and Apache Beam) to generate its Discover Weekly playlists every Monday. The pipeline processes billions of listening events, applies collaborative filtering models, and writes personalised 30-track playlists for over 500 million users. They chose batch over streaming because playlist freshness on a weekly cadence doesn't require real-time processing, and batch lets them run expensive ML models cost-effectively over the full dataset.
</div>


---

## 7. Consistency Patterns in Practice

Distributed databases offer a spectrum of consistency guarantees. Two patterns come up constantly in real systems.

### Read-Your-Writes

**Problem:** A user updates their profile, refreshes the page, and sees the *old* data because the read hit a stale replica.

**Solution:** After a write, route that user's subsequent reads to the leader (or a replica known to be up-to-date).

<span class="label label-ts">TypeScript</span>

```typescript
class ReadYourWritesRouter {
  // Track the last write timestamp per user
  private lastWrite = new Map<string, number>();

  recordWrite(userId: string): void {
    this.lastWrite.set(userId, Date.now());
  }

  shouldReadFromLeader(userId: string, replicationLagMs: number): boolean {
    const lastWriteTime = this.lastWrite.get(userId);
    if (!lastWriteTime) return false;

    // Route to leader if the write was recent enough to be affected by lag
    return Date.now() - lastWriteTime < replicationLagMs;
  }
}

const router = new ReadYourWritesRouter();

// On write
router.recordWrite("user-42");

// On read
const useLeader = router.shouldReadFromLeader("user-42", 5000);
const db = useLeader ? leaderPool : replicaPool;
const profile = await db.query("SELECT * FROM users WHERE id = $1", ["user-42"]);
```

<span class="label label-py">Python</span>

```python
import time

class ReadYourWritesRouter:
    def __init__(self):
        self._last_write: dict[str, float] = {}

    def record_write(self, user_id: str) -> None:
        self._last_write[user_id] = time.time()

    def should_read_from_leader(self, user_id: str, replication_lag_s: float) -> bool:
        last_write = self._last_write.get(user_id)
        if last_write is None:
            return False
        return time.time() - last_write < replication_lag_s

router = ReadYourWritesRouter()

# On write
router.record_write("user-42")

# On read
use_leader = router.should_read_from_leader("user-42", replication_lag_s=5.0)
db = leader_pool if use_leader else replica_pool
profile = await db.fetch_one("SELECT * FROM users WHERE id = $1", "user-42")
```

### Monotonic Reads

**Problem:** A user makes two reads and the second returns *older* data than the first because it hit a different, more-stale replica.

**Solution:** Pin each user's reads to the same replica (session affinity) so they always see data that is at least as fresh as their last read.

<span class="label label-ts">TypeScript</span>

```typescript
class MonotonicReadRouter {
  private userReplica = new Map<string, string>();

  getReplicaForUser(userId: string, replicas: string[]): string {
    const pinned = this.userReplica.get(userId);
    if (pinned && replicas.includes(pinned)) return pinned;

    // Assign a consistent replica using hash
    const index = simpleHash(userId) % replicas.length;
    const replica = replicas[index];
    this.userReplica.set(userId, replica);
    return replica;
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (const char of str) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}
```

<span class="label label-py">Python</span>

```python
class MonotonicReadRouter:
    def __init__(self):
        self._user_replica: dict[str, str] = {}

    def get_replica_for_user(self, user_id: str, replicas: list[str]) -> str:
        pinned = self._user_replica.get(user_id)
        if pinned and pinned in replicas:
            return pinned

        index = hash(user_id) % len(replicas)
        replica = replicas[index]
        self._user_replica[user_id] = replica
        return replica
```

<div class="callout">
<strong>These patterns are not free.</strong> Read-your-writes increases leader load. Monotonic reads reduce load-balancing flexibility. Both are targeted fixes — apply them where users notice inconsistency (profile pages, dashboards), not globally.
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> LinkedIn applies read-your-writes consistency for profile edits — when a user updates their headline or job title, their subsequent page loads are routed to the leader database so they immediately see the change. However, other users viewing that profile are served from replicas with eventual consistency, since a few seconds of staleness is acceptable for third-party viewers. This targeted approach lets LinkedIn avoid routing all reads to the leader while eliminating the most confusing user-facing inconsistency.
</div>

---

## 8. ACID vs BASE

These two acronyms represent opposite ends of the consistency-availability spectrum.

### ACID

| Property | Meaning | Example |
|----------|---------|---------|
| **Atomicity** | All operations in a transaction succeed or all fail | Bank transfer: debit + credit are one unit |
| **Consistency** | Transactions move the DB from one valid state to another | Foreign keys, constraints are never violated |
| **Isolation** | Concurrent transactions don't interfere | Two users buying the last item don't both succeed |
| **Durability** | Committed data survives crashes | Write-ahead log ensures recovery |

### BASE

| Property | Meaning | Example |
|----------|---------|---------|
| **Basically Available** | The system always responds, even if data is stale | Shopping cart shows slightly outdated inventory |
| **Soft State** | State may change over time without input (due to replication) | Replica catches up to leader asynchronously |
| **Eventual Consistency** | Given enough time, all replicas converge | DNS propagation, social media like counts |

### How They Relate to CAP

The CAP theorem states that during a network partition, a distributed system must choose between **Consistency** (all nodes see the same data) and **Availability** (every request gets a response).

- **ACID systems** (PostgreSQL, MySQL) choose **CP** — they sacrifice availability during partitions to maintain consistency.
- **BASE systems** (DynamoDB, Cassandra) choose **AP** — they sacrifice consistency during partitions to remain available.

<div class="diagram">

```
                    CAP Theorem

              Consistency (C)
                   ╱╲
                  ╱  ╲
                 ╱    ╲
           CP   ╱  You ╲   CA
     (ACID)    ╱  can't  ╲  (Single node —
              ╱  have all ╲  no partitions)
             ╱    three    ╲
            ╱________________╲
    Availability (A) ──── Partition
                           Tolerance (P)
              AP
           (BASE)

  In practice, P is non-negotiable in distributed
  systems, so the real choice is C vs A.
```

</div>

<span class="label label-ts">TypeScript</span>

```typescript
// ACID: bank transfer — must be atomic
async function transfer(fromId: string, toId: string, amount: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [amount, fromId]);
    await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [amount, toId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

<span class="label label-py">Python</span>

```python
# ACID: bank transfer — must be atomic
async def transfer(from_id: str, to_id: str, amount: float) -> None:
    async with db.transaction():
        await db.execute(
            "UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from_id
        )
        await db.execute(
            "UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to_id
        )
        # If either fails, the entire transaction rolls back
```

<div class="callout info">
<strong>When to choose which:</strong> Use ACID when correctness is non-negotiable — financial transactions, inventory management, booking systems. Use BASE when availability and scale matter more than instant consistency — social feeds, analytics counters, recommendation engines. Many systems use both: ACID for the order database, BASE for the product catalog cache.
</div>

<div class="callout tip">
  <strong>Real-World Example:</strong> Stripe processes billions of dollars in payments and relies on ACID transactions in PostgreSQL to ensure that every charge, refund, and transfer is atomic — money never appears or disappears due to partial failures. In contrast, Twitter's like counts and retweet numbers use BASE semantics with eventual consistency across Cassandra replicas, because showing 10,003 likes instead of 10,005 for a few seconds is an acceptable trade-off for the ability to handle millions of interactions per minute without coordination overhead.
</div>

---

## 9. Key Takeaways

1. **No universal database.** Match the database type to the access pattern. Most production systems use multiple databases (polyglot persistence).

2. **Start with cache-aside.** It's the simplest caching strategy and works with any database. Graduate to write-through or write-behind only when you have a measured need.

3. **Cache invalidation is a trade-off, not a solution.** TTL is simple but stale. Event-based is fresh but complex. Versioning is clever but leaks memory. Pick the trade-off that fits your tolerance for staleness.

4. **Shard key selection is the most important sharding decision.** A bad shard key creates hot spots that are expensive to fix. Optimize for even distribution and query alignment.

5. **Leader-follower replication is the default.** Use multi-leader only for multi-datacenter or offline scenarios. Use leaderless only when you need the highest availability and can handle conflict resolution.

6. **Use batch pipelines unless latency matters.** Streaming adds significant complexity. Most analytics workloads are fine with hourly or daily batch runs.

7. **Consistency patterns are targeted fixes.** Apply read-your-writes and monotonic reads where users notice inconsistency, not as global defaults.

8. **ACID for money, BASE for scale.** When in doubt, start with ACID (PostgreSQL) and relax consistency only where you've measured that it's the bottleneck.

<div class="callout tip">
<strong>The data architecture decision tree:</strong> Start with a single relational database. Add a cache when reads are slow. Add read replicas when the leader is overloaded. Shard only when a single node can't hold the data. At each step, you're trading simplicity for scale — make sure you need the scale before paying the complexity cost.
</div>

{{< quiz >}}

## Scenario Challenges

{{< case-studies >}}

## Interactive Case Studies

{{< interactive-cases >}}