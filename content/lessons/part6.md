---
title: "Part 6: Cloud & Infrastructure Patterns"
subtitle: "Load Balancing, Scaling, CDNs, Containers, IaC, CI/CD, Serverless & Disaster Recovery"
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
case_studies:
  - title: "Surviving Black Friday — 10x Traffic Spike"
    category: "Scaling Challenge"
    difficulty: "⭐⭐"
    scenario: "ShopStream is a mid-size e-commerce platform selling electronics. They run 2 EC2 instances (m5.large) behind an ALB, with a single db.r5.xlarge RDS PostgreSQL instance. Normal traffic is 200 requests/sec with 150ms average response time. Last Black Friday, traffic spiked to 2,000 requests/sec within 30 minutes — the database CPU hit 100%, connection pools exhausted, and the site returned 503 errors for 6 hours. They lost an estimated $180K in sales. Their normal monthly AWS bill is $5K, and the CFO has approved up to $15K/month during November-December but wants costs back to normal by January."
    constraints: "Budget: $5K/month normal, $15K/month during peak season. Team: 4 backend engineers, 1 DevOps. Timeline: 8 weeks until next Black Friday. Cannot re-platform the application — must work with the existing Node.js/PostgreSQL stack."
    prompts:
      - "The database was the bottleneck, not the app servers. What specific database-level changes would you make to handle 10x read traffic without re-architecting the application?"
      - "How would you design the auto-scaling policy for the application tier? What metric would you scale on, and why might CPU not be the best choice for this workload?"
      - "What caching strategy would you implement to reduce database load? Which data is safe to cache and which absolutely must be real-time (think: product pages vs. inventory counts)?"
      - "How do you ensure costs return to $5K/month after the peak? What's your scale-down strategy?"
    approaches:
      - name: "Vertical Scale DB + Read Replicas + Redis Cache"
        description: "Upgrade the RDS instance to db.r5.4xlarge for Black Friday, add 2 read replicas for product catalog and search queries, and introduce a Redis ElastiCache cluster for product pages, category listings, and session data. Application code routes read queries to replicas and checks cache before hitting the database. After the event, scale the RDS instance back down and reduce replica count to 1."
        trade_off: "Straightforward to implement within 8 weeks and doesn't require application re-architecture. But vertical scaling has a ceiling, read replicas add replication lag (stale inventory risk), and the team must modify query routing in the application. Cost is predictable and reversible."
      - name: "Auto-Scaling App Tier + CDN + Queue-Based Order Processing"
        description: "Set up an ASG with target-tracking on ALB request count (not CPU). Put CloudFront in front of the ALB to cache static assets and product images. Decouple order processing by putting checkout requests into an SQS queue — the API returns 'order received' immediately while workers process orders asynchronously. This protects the database from checkout-spike writes."
        trade_off: "Handles traffic spikes more gracefully and protects the database from write storms. But asynchronous checkout changes the user experience (no instant confirmation), requires careful idempotency handling, and adds operational complexity with SQS/workers. The CDN helps with static content but doesn't reduce database load for dynamic queries."
      - name: "Pre-Scaled Infrastructure with Scheduled Scaling"
        description: "Use scheduled scaling to pre-provision infrastructure before Black Friday: 8 app instances, RDS scaled to db.r5.4xlarge, 3 read replicas, and a warmed Redis cache. Run a load test at 3,000 req/sec two weeks before to validate. Set up CloudWatch alarms and a runbook for manual intervention. Schedule scale-down for December 1st."
        trade_off: "The most predictable approach — you know exactly what capacity you'll have and can load-test it in advance. But you pay for peak capacity even during quiet hours of the sale, and it doesn't handle unexpected traffic beyond what you pre-provisioned. Best combined with reactive auto-scaling as a safety net."
  - title: "From SSH Deploys to Modern CI/CD"
    category: "Migration"
    difficulty: "⭐⭐⭐"
    scenario: "FieldOps is a logistics SaaS company with a Django monolith running on 8 Ubuntu EC2 instances behind an ALB. Deployments are done by the lead developer who SSHs into each server sequentially, runs git pull, pip install, and restarts gunicorn. The process takes 2 hours, causes 15 minutes of downtime per server (2 hours total rolling), and requires the lead dev to be available. Last month, a bad deploy introduced a database migration bug that took the site down for 4 hours — there was no way to roll back because the migration was destructive. The team has 6 developers, none with DevOps experience, and the CTO wants zero-downtime deployments within 3 months."
    constraints: "Team: 6 developers with no DevOps/CI-CD experience. Timeline: 3 months. Budget: $2K/month additional infrastructure. Must support the existing Django/PostgreSQL stack. Cannot afford more than 30 minutes of planned downtime during the migration to the new system."
    prompts:
      - "What's the simplest CI/CD pipeline you could set up that eliminates SSH-based deploys? Consider the team's lack of DevOps experience when choosing tools."
      - "How do you solve the destructive database migration problem? What practices prevent a bad migration from being unrecoverable?"
      - "Should you containerize the application or keep deploying to EC2 instances? What factors drive this decision for a team with no Docker experience?"
      - "How do you handle the transition period where the team is learning the new deployment process? What's your rollback plan if the new pipeline itself has issues?"
    approaches:
      - name: "GitHub Actions + AWS CodeDeploy (No Containers)"
        description: "Set up GitHub Actions to run tests on every PR. On merge to main, build an application artifact (zip), upload to S3, and trigger AWS CodeDeploy for a rolling deployment across the 8 EC2 instances with automatic rollback on health check failure. Database migrations run as a separate, manually-triggered pipeline step with a required approval gate. Use Django's migration framework with backward-compatible migrations only (no destructive changes without a multi-step process)."
        trade_off: "Lowest learning curve — the team keeps their familiar EC2 environment and just adds automation on top. CodeDeploy handles rolling deploys and rollback natively. But the servers are still mutable (configuration drift risk), and you're not solving the underlying 'snowflake server' problem. Good enough for now, but may need revisiting in a year."
      - name: "Containerize with Docker + ECS Fargate + Blue-Green"
        description: "Containerize the Django app with Docker. Deploy to ECS Fargate (no servers to manage). Use ECS blue-green deployments via CodeDeploy — deploy the new version as a separate task set, run health checks, then switch ALB traffic. If the new version fails, traffic switches back instantly. Database migrations run in a separate ECS task before the deployment."
        trade_off: "Eliminates server management entirely and gives true zero-downtime blue-green deployments. But the team must learn Docker, ECS, and task definitions — a steep curve for 6 developers with no DevOps experience. The 3-month timeline is tight. Fargate costs more than EC2 for equivalent compute."
      - name: "AWS Elastic Beanstalk with Managed Deployments"
        description: "Migrate the Django app to Elastic Beanstalk, which provides managed EC2 instances, auto-scaling, rolling deployments, and one-click rollback out of the box. Configure rolling deployments with batch size of 2 (25% at a time) and health-check-based rollback. Use Beanstalk's .ebextensions for environment configuration. Database migrations run via a leader_only container command."
        trade_off: "The fastest path to managed deployments — Beanstalk abstracts away most infrastructure concerns and the team can deploy via git push or the EB CLI. But Beanstalk is opinionated and constraining — customizing networking, scaling policies, or adding sidecars is harder. Teams often outgrow Beanstalk within 1-2 years and face another migration."
interactive_cases:
  - title: "Live Streaming Capacity Estimation"
    type: "back-of-envelope"
    difficulty: "⭐⭐"
    brief: "Your company is hosting a major live streaming event and needs to estimate server capacity. The engineering VP wants a back-of-envelope calculation before approving the infrastructure budget."
    opening: "We've got a live event coming up — 500,000 concurrent viewers, each consuming a 4Mbps video stream. How many servers do we need? Walk me through your math."
    answer_range: "50-200 servers depending on CDN assumptions, server capacity (10Gbps typical), and CDN offload percentage"
    key_assumptions: "CDN offload (90-99% of traffic), origin server bandwidth, geographic distribution, redundancy factor"
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

<div class="callout tip">
  <strong>Real-World Example:</strong> Twitch, the live video streaming platform, uses consistent hashing in their load balancing layer to route viewers of the same stream to the same set of edge servers. This ensures that the cached video segments for a popular stream are reused efficiently rather than fetched repeatedly from origin. When they add capacity during a major esports event, consistent hashing ensures only a small fraction of viewer connections are redistributed — minimizing buffering interruptions for millions of concurrent viewers.
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

<div class="callout tip">
  <strong>Real-World Example:</strong> Amazon.com uses predictive auto-scaling combined with scheduled scaling to handle Black Friday and Prime Day traffic. Weeks before the event, their systems analyze historical traffic patterns and pre-scale infrastructure. During the event, target-tracking policies maintain CPU utilization around 60%, while step scaling adds aggressive capacity if latency spikes. After the event, conservative scale-down policies with long cooldown periods gradually reduce capacity over hours — not minutes — to avoid premature termination during late-night shopping surges.
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

<div class="callout tip">
  <strong>Real-World Example:</strong> Netflix operates its own CDN called Open Connect, with thousands of servers embedded directly inside ISP networks worldwide. When you press play, the video streams from a server physically located in your ISP's data center — not from Netflix's AWS origin. Netflix pre-positions popular content at edge locations during off-peak hours based on viewing predictions. This architecture serves over 15% of global internet traffic with sub-50ms latency for most users, while dramatically reducing Netflix's bandwidth costs.
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

<div class="callout tip">
  <strong>Real-World Example:</strong> Spotify migrated from a fleet of hand-managed VMs to Kubernetes over several years. They had over 150 engineering teams deploying independently, and their VM-based infrastructure couldn't keep up — provisioning took hours, and each team's deployment process was slightly different. By moving to Kubernetes, they standardized deployments across all teams using a shared platform called Backstage. Developers now deploy containerized services in minutes instead of hours, and Spotify can run thousands of microservices with consistent resource management, health checking, and auto-scaling.
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

<div class="callout tip">
  <strong>Real-World Example:</strong> HashiCorp (the creators of Terraform) published a case study on how Starbucks manages over 30,000 stores' worth of cloud infrastructure using Terraform. Before IaC, spinning up infrastructure for a new store initiative took weeks of manual AWS console work and was error-prone. With Terraform modules, they codified reusable patterns for common store infrastructure — networking, databases, compute — and new environments can be provisioned in minutes via pull request. Every change is peer-reviewed, version-controlled, and automatically applied through their CI pipeline.
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

<div class="callout tip">
  <strong>Real-World Example:</strong> Facebook (Meta) uses a canary deployment system for every code push to their billions-of-users platform. New code is first deployed to internal employees only, then to 1% of production traffic, then 10%, then 100% — with automated metrics checks at each stage. In one notable incident, a canary deployment caught a memory leak that would have crashed servers globally — the 1% canary showed memory usage climbing 5x faster than normal, and the deployment was automatically rolled back before it reached the wider user base. This system lets Facebook deploy code multiple times per day with confidence.
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

<div class="callout tip">
  <strong>Real-World Example:</strong> During the 2017 AWS us-east-1 S3 outage, companies with single-region architectures went completely offline for hours — including major sites like Trello, Quora, and parts of Apple's ecosystem. Netflix, however, stayed online because they run an active-active multi-region architecture across three AWS regions. Their Zuul gateway automatically routes traffic away from unhealthy regions, and their data layer uses Cassandra with cross-region replication. The tradeoff is significant operational complexity and roughly 3x infrastructure cost, but for a service where every minute of downtime costs millions in lost revenue, the investment pays for itself.
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

## Serverless Architecture

### What Is Serverless?

With serverless, you write functions and the cloud provider manages servers, scaling, and availability for you. You pay per invocation, not per hour. Zero traffic means zero cost.

The main serverless compute services are **AWS Lambda**, **Google Cloud Functions**, and **Azure Functions**.

<div class="callout info">
  <strong>Not actually "no servers."</strong> Servers still exist. You just don't provision, patch, or manage them. The cloud provider handles all of that.
</div>

### How It Works

Serverless functions are triggered by events:

- **HTTP request** via API Gateway
- **Queue message** from SQS
- **Schedule** (cron) via EventBridge
- **File upload** to S3
- **Database change** via DynamoDB Streams

<span class="label label-ts">TypeScript</span>

```typescript
// AWS Lambda handler: API endpoint via API Gateway
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const userId = event.pathParameters?.id;

  // Your business logic here
  const user = { id: userId, name: "Alice", email: "alice@example.com" };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  };
};
```

<span class="label label-py">Python</span>

```python
# AWS Lambda handler: processing an SQS message
import json

def handler(event, context):
    for record in event["Records"]:
        body = json.loads(record["body"])
        order_id = body["order_id"]

        # Process the order
        print(f"Processing order {order_id}")
        # ... business logic here

    return {"statusCode": 200, "body": "Processed"}
```

<div class="callout tip">
  <strong>API Gateway + Lambda replaces Express/FastAPI for simple APIs.</strong> Instead of running a web server 24/7, each route becomes a Lambda function triggered by API Gateway. No server to manage, no idle compute cost. For simple CRUD APIs, this is often the fastest path to production.
</div>

### Serverless Patterns

**API backend:** API Gateway + Lambda + DynamoDB

```text
Client → API Gateway → Lambda → DynamoDB
                          ↓
                     Response back
```

**Event processing:** SQS/SNS + Lambda

```text
Producer → SQS Queue → Lambda (consumer) → Database / S3 / etc.
```

**Scheduled jobs:** EventBridge + Lambda

```text
EventBridge (cron: "every 5 minutes") → Lambda → cleanup / report / sync
```

**File processing:** S3 trigger + Lambda

```text
User uploads file → S3 bucket → Lambda → thumbnail / parse / transform → S3 output
```

<div class="callout">
  <strong>Simple API backend architecture:</strong>
</div>

```text
              ┌──────────────┐
              │    Client     │
              └──────┬───────┘
                     │
              ┌──────▼───────┐
              │ API Gateway   │
              └──────┬───────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Lambda   │ │ Lambda   │ │ Lambda   │
   │ GET /usr │ │ POST /usr│ │ GET /ord │
   └────┬─────┘ └────┬─────┘ └────┬─────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
              ┌──────────────┐
              │  DynamoDB     │
              └──────────────┘
```

### Cold Starts

A cold start happens when a Lambda function is invoked after an idle period. The cloud provider must initialize the runtime environment before your code runs. This adds latency, typically 100ms to several seconds depending on the runtime and package size.

**Why it happens:** the execution environment is not kept alive indefinitely. After a period of inactivity, it is reclaimed. The next invocation must spin up a fresh environment.

**Mitigation strategies:**

- **Provisioned concurrency:** pre-warm a set number of execution environments (costs money, but eliminates cold starts)
- **Keep functions warm:** schedule a ping every few minutes to prevent the environment from being reclaimed
- **Use lighter runtimes:** Node.js and Python cold starts are typically 100-300ms. Java and .NET can take 1-3 seconds or more.

### When to Use Serverless

| Use Case | Serverless? | Why |
|---|---|---|
| Sporadic/unpredictable traffic | Yes | Pay nothing when idle |
| Simple API endpoints | Yes | No infrastructure to manage |
| Event processing (S3, SQS) | Yes | Natural fit for triggers |
| Long-running processes (>15 min) | No | Lambda has execution time limits |
| WebSocket/persistent connections | Partially | Possible but awkward |
| High-throughput, steady traffic | Maybe not | Containers may be cheaper at scale |

### Serverless vs Containers

| | Serverless (Lambda) | Containers (ECS/K8s) |
|---|---|---|
| Scaling | Automatic, per-request | Automatic, per-pod/task |
| Cold start | Yes (100ms to seconds) | No (always running) |
| Cost at low traffic | Very cheap | Minimum cost (always running) |
| Cost at high traffic | Can be expensive | More predictable |
| Max execution time | 15 minutes (Lambda) | Unlimited |
| Control | Limited (runtime, memory) | Full (OS, networking) |

<div class="callout">
  <strong>Serverless is not a replacement for containers.</strong> Many teams use both: Lambda for event-driven glue (S3 triggers, SQS processors, cron jobs) and containers for core API services that need persistent connections or long-running processes.
</div>


## Key Takeaways

1. **Load balancers** distribute traffic. Use L7 for HTTP-aware routing, L4 for raw TCP performance
2. **Scale horizontally** for stateless app servers, vertically for databases (until you add read replicas or shard)
3. **CDNs** reduce latency by caching content at the edge. Use versioned URLs for cache busting
4. **Containers** solve "works on my machine." Kubernetes solves orchestration at scale, but isn't always necessary
5. **Infrastructure as Code** makes infrastructure reproducible, auditable, and reviewable. Treat servers as cattle, not pets
6. **CI/CD pipelines** automate the path from commit to production. Blue-green for instant rollback, canary for gradual rollout
7. **Multi-region** eliminates single-region failure. Choose active-active or active-passive based on your RPO/RTO requirements and budget
8. **Serverless** lets you run code without managing servers. Ideal for event-driven workloads, sporadic traffic, and simple APIs. Use containers when you need persistent connections, long-running processes, or predictable high-throughput costs

## Check Your Understanding

{{< quiz >}}

## Scenario Challenges

{{< case-studies >}}

## Interactive Case Studies

{{< interactive-cases >}}