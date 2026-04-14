---
title: "Part 6: Cloud & Infrastructure Patterns"
subtitle: "Load Balancing, Scaling, CDNs, Containers, IaC, CI/CD & Disaster Recovery"
linkTitle: "Part 6: Cloud & Infrastructure"
weight: 6
type: "docs"
quiz:
  - q: "Your e-commerce API is getting 10x traffic during a flash sale. The database CPU is at 95% and response times are spiking. You already have 3 app server instances behind a load balancer. What scaling strategy addresses the real bottleneck?"
    concepts:
      - label: "vertical scaling the database"
        terms: ["vertical", "scale up", "bigger instance", "more CPU", "more RAM", "upgrade", "database is the bottleneck"]
      - label: "read replicas"
        terms: ["read replica", "replica", "read-only", "offload reads", "distribute reads"]
      - label: "caching layer"
        terms: ["cache", "caching", "Redis", "Memcached", "reduce database load", "fewer queries"]
      - label: "identify the bottleneck"
        terms: ["bottleneck", "database", "not the app server", "wrong layer", "adding app servers won't help"]
    answer: "Adding more app servers won't help — the database is the bottleneck. Vertically scale the DB, add read replicas for read-heavy traffic, or introduce a caching layer to reduce DB load."
  - q: "Your team deploys a new version and it causes a 500 error rate spike. With a traditional deployment, you'd have to roll back manually. How would blue-green deployment have helped here?"
    concepts:
      - label: "instant rollback"
        terms: ["rollback", "switch back", "instant", "immediate", "flip", "redirect", "point back"]
      - label: "two environments"
        terms: ["two environment", "blue", "green", "standby", "idle", "parallel", "duplicate"]
      - label: "traffic switching"
        terms: ["switch traffic", "route traffic", "load balancer", "DNS", "cut over", "swap"]
      - label: "zero downtime"
        terms: ["zero downtime", "no downtime", "seamless", "users don't notice"]
    answer: "Blue-green keeps the old version (blue) running while the new version (green) is deployed separately. Traffic is switched at the load balancer. If green fails, you instantly switch back to blue — no manual rollback, no downtime."
  - q: "Your company runs a single-region setup on AWS us-east-1. A regional outage takes your entire platform offline for 4 hours. The CEO asks you to prevent this. What architecture change do you propose, and what trade-offs does it introduce?"
    concepts:
      - label: "multi-region"
        terms: ["multi-region", "multiple region", "second region", "another region", "cross-region"]
      - label: "active-active or active-passive"
        terms: ["active-active", "active-passive", "failover", "standby region", "hot standby", "warm standby"]
      - label: "data replication"
        terms: ["replicat", "sync", "data consistency", "cross-region replication", "eventual consistency", "lag"]
      - label: "cost and complexity trade-off"
        terms: ["cost", "expensive", "complex", "trade-off", "double", "twice", "operational overhead"]
    answer: "Deploy to at least two regions. Active-passive gives failover with lower cost; active-active serves traffic from both regions but requires cross-region data replication and conflict resolution. Trade-offs: higher cost, operational complexity, and data consistency challenges."
  - q: "A developer on your team manually SSH'd into a production server and installed a hotfix by editing files directly. Why is this problematic, and what practice prevents it?"
    concepts:
      - label: "configuration drift"
        terms: ["drift", "snowflake", "inconsistent", "out of sync", "different from", "not reproducible"]
      - label: "infrastructure as code"
        terms: ["infrastructure as code", "IaC", "Terraform", "CloudFormation", "codified", "version controlled"]
      - label: "immutable infrastructure"
        terms: ["immutable", "replace don't patch", "new instance", "rebuild", "never modify", "disposable"]
      - label: "auditability"
        terms: ["audit", "track", "history", "who changed", "no record", "git log", "review"]
    answer: "Manual changes create configuration drift — the server no longer matches what's defined in code. There's no audit trail, no review, and no way to reproduce the fix. Infrastructure as Code (Terraform/CloudFormation) and immutable infrastructure prevent this: changes go through code review, are version-controlled, and servers are replaced rather than patched."
  - q: "Your API serves users globally but all servers are in us-east-1. Users in Asia report 800ms latency. Adding more servers in us-east-1 doesn't help. What infrastructure pattern reduces this latency?"
    concepts:
      - label: "CDN / edge network"
        terms: ["CDN", "edge", "content delivery", "CloudFront", "Cloudflare", "point of presence", "PoP"]
      - label: "geographic proximity"
        terms: ["closer", "proximity", "nearby", "local", "region", "geograph"]
      - label: "cache at the edge"
        terms: ["cache", "edge cache", "static content", "closer to user"]
      - label: "multi-region deployment"
        terms: ["multi-region", "deploy in Asia", "another region", "closer server", "regional deployment"]
    answer: "The latency is caused by physical distance, not server capacity. Use a CDN to cache static/semi-static content at edge locations near users. For dynamic API calls, deploy to a region closer to Asian users (e.g., ap-southeast-1) or use a multi-region architecture."
---

## Load Balancing

A load balancer distributes incoming traffic across multiple servers so no single server becomes overwhelmed. It's the front door of any scalable system.

<div class="diagram">
  <div class="layer">Clients</div>
  <div class="arrow">↓</div>
  <div class="layer" style="background:#e8f5e9">Load Balancer</div>
  <div class="arrow">↓ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ↓ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ↓</div>
  <div style="display:flex; justify-content:center; gap:1rem;">
    <div class="layer">Server 1</div>
    <div class="layer">Server 2</div>
    <div class="layer">Server 3</div>
  </div>
</div>

### L4 vs L7 Load Balancing

These refer to layers of the OSI networking model:

**Layer 4 (Transport)** — routes based on IP address and TCP/UDP port. It doesn't inspect the request content. Fast and simple.

**Layer 7 (Application)** — inspects HTTP headers, URLs, cookies. Can route `/api/*` to backend servers and `/static/*` to a CDN origin. More flexible, slightly more overhead.

<div class="callout info">
  <strong>When to use which?</strong> Use L4 when you just need to spread TCP connections (databases, game servers). Use L7 when you need content-based routing (microservices, A/B testing, API gateways).
</div>

### Load Balancing Algorithms

**Round Robin** — requests go to servers in order: 1, 2, 3, 1, 2, 3... Simple but ignores server load.

**Least Connections** — sends the next request to whichever server has the fewest active connections. Better for uneven workloads.

**Consistent Hashing** — hashes a key (e.g., user ID) to determine which server handles it. The same user always hits the same server. Critical for sticky sessions and distributed caches.

<span class="label label-ts">TypeScript</span>

```typescript
// Consistent hashing concept — map keys to server nodes
class ConsistentHash {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];

  addNode(node: string, replicas = 100) {
    for (let i = 0; i < replicas; i++) {
      const hash = this.hash(`${node}:${i}`);
      this.ring.set(hash, node);
      this.sortedKeys.push(hash);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  getNode(key: string): string {
    const hash = this.hash(key);
    const idx = this.sortedKeys.findIndex(k => k >= hash);
    const ringIdx = idx === -1 ? 0 : idx;
    return this.ring.get(this.sortedKeys[ringIdx])!;
  }

  private hash(key: string): number {
    let h = 0;
    for (const ch of key) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
  }
}

const ring = new ConsistentHash();
ring.addNode("server-1");
ring.addNode("server-2");
ring.addNode("server-3");

console.log(ring.getNode("user-42"));   // consistently maps to same server
console.log(ring.getNode("user-108"));
```

<span class="label label-py">Python</span>

```python
import hashlib
import bisect

class ConsistentHash:
    def __init__(self, replicas=100):
        self.replicas = replicas
        self.ring: dict[int, str] = {}
        self.sorted_keys: list[int] = []

    def add_node(self, node: str):
        for i in range(self.replicas):
            h = self._hash(f"{node}:{i}")
            self.ring[h] = node
            bisect.insort(self.sorted_keys, h)

    def get_node(self, key: str) -> str:
        h = self._hash(key)
        idx = bisect.bisect_left(self.sorted_keys, h)
        if idx == len(self.sorted_keys):
            idx = 0
        return self.ring[self.sorted_keys[idx]]

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

ring = ConsistentHash()
ring.add_node("server-1")
ring.add_node("server-2")
ring.add_node("server-3")

print(ring.get_node("user-42"))   # consistently maps to same server
print(ring.get_node("user-108"))
```

<div class="callout tip">
  <strong>Why consistent hashing matters:</strong> When you add or remove a server, only a fraction of keys get remapped — not all of them. This is why it's used in distributed caches (Memcached, Redis Cluster) and databases (DynamoDB, Cassandra).
</div>

## Auto-Scaling

Scaling means adding capacity to handle more load. There are two directions:

**Vertical Scaling (Scale Up)** — give a single machine more CPU, RAM, or disk. Simple but has a ceiling — you can't infinitely upgrade one box.

**Horizontal Scaling (Scale Out)** — add more machines. No ceiling in theory, but your application must be stateless (or use external state) to work behind a load balancer.

<div class="callout">
  <strong>Rule of thumb:</strong> Scale vertically for databases (until you can't), scale horizontally for application servers (from the start).
</div>

### Scaling Policies

Auto-scaling groups (ASGs) automatically add or remove instances based on rules:

**Target Tracking** — "Keep average CPU at 60%." The simplest. The ASG adds/removes instances to maintain the target.

**Step Scaling** — "If CPU > 70%, add 2 instances. If CPU > 90%, add 5." More granular control.

**Scheduled Scaling** — "At 8am on weekdays, set minimum instances to 10." For predictable traffic patterns.

<span class="label label-ts">TypeScript</span>

```typescript
// Conceptual auto-scaling decision logic
interface ScalingMetrics {
  avgCpuPercent: number;
  requestsPerSecond: number;
  avgResponseTimeMs: number;
}

function evaluateScaling(metrics: ScalingMetrics, currentInstances: number): number {
  // Scale up aggressively, scale down conservatively
  if (metrics.avgCpuPercent > 80 || metrics.avgResponseTimeMs > 2000) {
    return Math.min(currentInstances + 2, 20); // cap at 20
  }
  if (metrics.avgCpuPercent < 30 && metrics.avgResponseTimeMs < 200) {
    return Math.max(currentInstances - 1, 2);  // minimum 2
  }
  return currentInstances; // no change
}
```

<span class="label label-py">Python</span>

```python
from dataclasses import dataclass

@dataclass
class ScalingMetrics:
    avg_cpu_percent: float
    requests_per_second: float
    avg_response_time_ms: float

def evaluate_scaling(metrics: ScalingMetrics, current_instances: int) -> int:
    if metrics.avg_cpu_percent > 80 or metrics.avg_response_time_ms > 2000:
        return min(current_instances + 2, 20)
    if metrics.avg_cpu_percent < 30 and metrics.avg_response_time_ms < 200:
        return max(current_instances - 1, 2)
    return current_instances
```

### Key Metrics to Scale On

- **CPU utilization** — the most common, but can be misleading for I/O-bound workloads
- **Request count / throughput** — better for web APIs
- **Queue depth** — ideal for worker/consumer services (e.g., SQS queue length)
- **Custom metrics** — response latency, error rate, business-specific metrics

<div class="callout info">
  <strong>Cooldown periods</strong> are critical. After scaling up, wait 2–5 minutes before evaluating again. Without cooldowns, you get "thrashing" — rapidly adding and removing instances as metrics oscillate.
</div>

## CDNs (Content Delivery Networks)

A CDN is a globally distributed network of edge servers that cache content close to users.

### What CDNs Solve

- **Latency** — a user in Tokyo shouldn't wait for a response from a server in Virginia
- **Bandwidth** — offload static assets (images, JS, CSS) from your origin servers
- **DDoS protection** — CDN absorbs traffic spikes at the edge before they reach your infrastructure

### How It Works

```text
User in Tokyo → CDN Edge (Tokyo PoP) → [cache HIT] → response in 20ms
User in Tokyo → CDN Edge (Tokyo PoP) → [cache MISS] → Origin (us-east-1) → cache + respond
```

### Cache Invalidation

The hardest problem in CDNs (and computer science):

- **TTL (Time-to-Live)** — content expires after N seconds. Simple but stale data is possible.
- **Versioned URLs** — `/app.v2.3.js` instead of `/app.js`. New deploy = new URL = no stale cache. Best practice for static assets.
- **Purge/Invalidate API** — explicitly tell the CDN to drop cached content. Use sparingly — it's slow and expensive at scale.

<span class="label label-ts">TypeScript</span>

```typescript
// Generating versioned asset URLs to bust CDN cache
import { createHash } from "crypto";
import { readFileSync } from "fs";

function versionedUrl(filePath: string, baseUrl: string): string {
  const content = readFileSync(filePath);
  const hash = createHash("md5").update(content).digest("hex").slice(0, 8);
  return `${baseUrl}/${filePath}?v=${hash}`;
}

// /static/app.js?v=a3f8c1d2 — changes only when file content changes
```

### Edge Computing

CDNs are evolving beyond caching. Edge compute (Cloudflare Workers, Lambda@Edge, Deno Deploy) lets you run code at the edge:

- A/B testing without hitting origin
- Auth token validation at the edge
- Geo-based redirects
- Personalized content assembly

<div class="callout tip">
  <strong>Think of CDNs in layers:</strong> static assets (always cache), semi-dynamic content (short TTL), dynamic API responses (usually don't cache, but edge compute can help).
</div>

## Containers & Orchestration

### Why Containers?

The classic problem: "It works on my machine." Containers package your application *with its entire runtime environment* — OS libraries, language runtime, dependencies — into a single portable image.

```text
Traditional:  App → depends on host OS, installed packages, env vars, file paths
Container:    App + Runtime + Deps → runs identically everywhere
```

### Docker Concepts

- **Image** — a read-only template. Think of it as a snapshot of your application and its environment.
- **Container** — a running instance of an image. Lightweight, isolated, disposable.
- **Dockerfile** — the recipe that builds an image.
- **Registry** — where images are stored (Docker Hub, ECR, GCR).

```dockerfile
# Example: containerizing a Node.js API
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/server.js"]
```

<div class="callout">
  <strong>Containers are not VMs.</strong> They share the host OS kernel and start in milliseconds. A VM includes an entire guest OS and takes minutes to boot.
</div>

### Kubernetes — The Problems It Solves

You have 50 containers across 10 servers. How do you:

- Decide which server runs which container?
- Restart a container that crashes?
- Scale from 5 to 20 instances when traffic spikes?
- Route traffic only to healthy containers?
- Roll out a new version without downtime?

Kubernetes (K8s) answers all of these. The key concepts:

**Pod** — the smallest deployable unit. Usually one container, sometimes tightly coupled sidecars. Pods are ephemeral — they can be killed and recreated at any time.

**Service** — a stable network endpoint that routes traffic to a set of pods. Pods come and go; the service IP stays the same.

**Deployment** — declares "I want 5 replicas of my API running version 2.1." Kubernetes makes it so, handling rolling updates and rollbacks.

```yaml
# Kubernetes Deployment — declarative desired state
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
        - name: api
          image: myregistry/api-server:2.1.0
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
```

<div class="callout info">
  <strong>You don't always need Kubernetes.</strong> For small teams or simple workloads, managed services like AWS ECS/Fargate, Google Cloud Run, or even a single server with Docker Compose are simpler. K8s shines when you have many services, complex networking, and need fine-grained control.
</div>

## Infrastructure as Code (IaC)

### The Problem

Manually creating infrastructure (clicking through the AWS console) leads to:

- **Snowflake servers** — each one is slightly different, nobody knows the full config
- **Configuration drift** — production doesn't match staging
- **No audit trail** — who changed what, when, and why?
- **Not reproducible** — can you rebuild your entire environment from scratch?

### The Solution

Define infrastructure in code files, version-controlled alongside your application:

- **Terraform** — cloud-agnostic, uses HCL (HashiCorp Configuration Language), manages state
- **AWS CloudFormation** — AWS-specific, uses JSON/YAML, tightly integrated with AWS
- **Pulumi** — uses real programming languages (TypeScript, Python) instead of DSLs

### Conceptual Terraform Example

```hcl
# Define a load-balanced, auto-scaling web tier
provider "aws" {
  region = "us-east-1"
}

resource "aws_lb" "web" {
  name               = "web-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "web" {
  name     = "web-targets"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_autoscaling_group" "web" {
  desired_capacity = 3
  max_size         = 10
  min_size         = 2

  launch_template {
    id      = aws_launch_template.web.id
    version = "$Latest"
  }

  target_group_arns = [aws_lb_target_group.web.arn]
}

resource "aws_autoscaling_policy" "cpu_target" {
  name                   = "cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.web.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0
  }
}
```

### Immutable Infrastructure

The principle: **never modify a running server. Replace it.**

- Need to patch the OS? Build a new image, deploy new instances, terminate old ones.
- Need to update config? Same thing.
- A server is misbehaving? Terminate it. The ASG will launch a fresh one.

This eliminates configuration drift entirely. Every server is identical because every server was built from the same image.

<div class="callout tip">
  <strong>Terraform workflow:</strong> <code>terraform plan</code> shows what will change. <code>terraform apply</code> makes it happen. Always review the plan before applying — especially in production.
</div>

## CI/CD Pipelines

CI/CD automates the path from code commit to production deployment.

**CI (Continuous Integration)** — automatically build and test every commit. Catch bugs early.

**CD (Continuous Delivery)** — automatically deploy to staging. Production deploy requires a manual approval.

**CD (Continuous Deployment)** — automatically deploy all the way to production. Every passing commit goes live.

<div class="diagram">
  <div class="layer">Developer pushes code</div>
  <div class="arrow">↓</div>
  <div class="layer">Build — compile, bundle, create artifacts</div>
  <div class="arrow">↓</div>
  <div class="layer">Test — unit, integration, E2E, security scans</div>
  <div class="arrow">↓</div>
  <div class="layer">Deploy to Staging — automated</div>
  <div class="arrow">↓</div>
  <div class="layer" style="background:#fff3e0">Approval Gate (optional)</div>
  <div class="arrow">↓</div>
  <div class="layer" style="background:#e8f5e9">Deploy to Production</div>
</div>

### Blue-Green Deployments

Run two identical environments. Only one serves live traffic at a time.

```text
                    ┌─────────────────┐
                    │  Load Balancer   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼                              ▼
   ┌──────────────────┐          ┌──────────────────┐
   │   Blue (v1.0)    │          │  Green (v1.1)    │
   │  ← LIVE TRAFFIC  │          │  ← IDLE / TEST   │
   └──────────────────┘          └──────────────────┘

Deploy v1.1 to Green → Test Green → Switch LB to Green → Blue becomes idle
If Green fails → Switch LB back to Blue (instant rollback)
```

### Canary Releases

Route a small percentage of traffic to the new version. Monitor error rates and latency. Gradually increase if healthy.

```text
v1.0  ████████████████████░░  95% of traffic
v1.1  ░░░░░░░░░░░░░░░░░░░░█   5% of traffic  ← canary

Monitor for 15 minutes...

v1.0  ████████████████░░░░░░  75% of traffic
v1.1  ░░░░░░░░░░░░░░░░████░  25% of traffic  ← expanding

Monitor... all healthy...

v1.1  ████████████████████░░ 100% of traffic  ← fully rolled out
```

<span class="label label-py">Python</span>

```python
# Conceptual canary routing logic
import random

def route_request(canary_percent: int = 5) -> str:
    """Route traffic between stable and canary deployments."""
    if random.randint(1, 100) <= canary_percent:
        return "canary-v1.1"
    return "stable-v1.0"
```

<div class="callout">
  <strong>Blue-green vs canary:</strong> Blue-green is all-or-nothing — you switch 100% of traffic at once. Canary is gradual — you slowly shift traffic. Canary is safer for high-traffic systems because a bug only affects a small percentage of users initially.
</div>

## Multi-Region & Disaster Recovery

### Why Multi-Region?

A single region is a single point of failure. Cloud regions do go down — and when they do, everything in that region goes with them.

### Active-Active vs Active-Passive

**Active-Passive** — one region handles all traffic (active). A second region is on standby (passive). If the active region fails, DNS or a global load balancer switches traffic to the passive region.

- Simpler to implement
- Passive region costs money but serves no traffic until failover
- Data replication is one-directional (active → passive)
- Failover takes minutes (DNS propagation, warming up)

**Active-Active** — both regions serve live traffic simultaneously. A global load balancer routes users to the nearest region.

- Lower latency for global users
- No failover delay — the other region is already handling traffic
- Much more complex: data must be replicated bidirectionally
- Conflict resolution needed (what if two regions update the same record?)

```text
Active-Passive:
  Users → Region A (active) ──replicates──→ Region B (standby)
  [Region A fails] → DNS switches → Users → Region B (now active)

Active-Active:
  Users (US)    → Region A (us-east-1)  ←──sync──→  Region B (eu-west-1) ← Users (EU)
  Users (Asia)  → Region C (ap-southeast-1) ←──sync──→ Region A, B
```

### RPO and RTO

Two metrics that define your disaster recovery requirements:

**RPO (Recovery Point Objective)** — how much data can you afford to lose? If your RPO is 1 hour, you need backups/replication at least every hour.

**RTO (Recovery Time Objective)** — how long can you be down? If your RTO is 15 minutes, you need automated failover — manual intervention is too slow.

| Strategy | RPO | RTO | Cost |
|---|---|---|---|
| Backups only | Hours | Hours | $ |
| Pilot light (minimal standby) | Minutes | 15–30 min | $$ |
| Warm standby (scaled-down copy) | Seconds–Minutes | Minutes | $$$ |
| Active-Active | Near zero | Near zero | $$$$ |

<div class="callout info">
  <strong>Choose based on business impact.</strong> A blog can tolerate hours of downtime. A payment system cannot. The cost of DR should be proportional to the cost of downtime.
</div>

<span class="label label-ts">TypeScript</span>

```typescript
// Health check endpoint for multi-region failover
import { Router } from "express";

const health = Router();

health.get("/health", async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    cache: await checkRedis(),
    region: process.env.AWS_REGION,
    uptime: process.uptime(),
  };

  const healthy = checks.database && checks.cache;
  res.status(healthy ? 200 : 503).json(checks);
});

// Global load balancers (Route 53, CloudFront) poll this endpoint.
// If a region returns 503, traffic is routed to healthy regions.
```

## Key Takeaways

1. **Load balancers** distribute traffic — use L7 for HTTP-aware routing, L4 for raw TCP performance
2. **Scale horizontally** for stateless app servers, vertically for databases (until you add read replicas or shard)
3. **CDNs** reduce latency by caching content at the edge — use versioned URLs for cache busting
4. **Containers** solve "works on my machine" — Kubernetes solves orchestration at scale, but isn't always necessary
5. **Infrastructure as Code** makes infrastructure reproducible, auditable, and reviewable — treat servers as cattle, not pets
6. **CI/CD pipelines** automate the path from commit to production — blue-green for instant rollback, canary for gradual rollout
7. **Multi-region** eliminates single-region failure — choose active-active or active-passive based on your RPO/RTO requirements and budget

## Check Your Understanding

{{< quiz >}}
