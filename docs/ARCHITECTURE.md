# 🏗️ Architecture Guide for Rexpress

## System Architecture Overview

Rexpress demonstrates a production-grade full-stack application deployed on AWS using containerized microservices with network-level security.

```
┌─────────────────────────────────────────────────────────┐
│                    USERS (INTERNET)                     │
│                         │                               │
│                         ▼                               │
│              ┌──────────────────────┐                  │
│              │  Frontend ALB        │                  │
│              │  (PUBLIC - Port 80)  │ ← Internet       │
│              └─────────┬────────────┘                  │
│                        │                               │
│                        ▼                               │
│              ┌──────────────────────┐                  │
│              │  Frontend Container  │                  │
│              │  React + Nginx       │                  │
│              │  ECS Fargate Task    │                  │
│              └─────────┬────────────┘                  │
│                        │                               │
│                 /api/* proxy requests                  │
│                        ▼                               │
│              ┌──────────────────────┐                  │
│              │  Backend ALB         │                  │
│              │  (PRIVATE - Port 80) │ ← Secured!      │
│              │  Only Frontend can   │                  │
│              │  access this         │                  │
│              └─────────┬────────────┘                  │
│                        │                               │
│                        ▼                               │
│              ┌──────────────────────┐                  │
│              │  Backend Container   │                  │
│              │  Express.js API      │                  │
│              │  ECS Fargate Task    │                  │
│              └──────────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

---

## How It Works

### Request Flow

1. **User opens frontend URL** → Frontend ALB directs to React app (via Nginx)
2. **User navigates to `/users`** → React app fetches `/api/users`
3. **Frontend (Nginx) intercepts `/api/*`** → Routes to Backend ALB
4. **Backend ALB receives request** → Security group only allows frontend traffic ✅
5. **Backend processes request** → Returns JSON data
6. **Frontend displays data** → User sees the results

### Component Breakdown

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React + Vite | User interface (SPA) |
| **Web Server** | Nginx | Serves static files, proxies API requests |
| **Backend** | Express.js | REST API, business logic |
| **Container Runtime** | Docker | Package apps with dependencies |
| **Container Registry** | AWS ECR | Store Docker images |
| **Container Orchestration** | AWS ECS Fargate | Run containers without managing servers |
| **Load Balancing** | AWS ALB | Distribute traffic, health checks |
| **Networking** | AWS VPC | Isolated network, security groups |
| **Logging** | CloudWatch | Centralized logs and monitoring |
| **CI/CD** | GitHub Actions | Automated deployments |

---

## Security Architecture

### Network-Level Security

This project implements **defense in depth** with multiple security layers:

#### Layer 1: Security Groups (Network Firewall)

**Frontend Security Group:**
- Allows inbound HTTP (80) from internet (0.0.0.0/0)
- Allows inbound HTTPS (443) from internet (0.0.0.0/0)
- Allows outbound to backend security group

**Backend Security Group:**
- ❌ Blocks all traffic from internet (0.0.0.0/0)
- ✅ Allows inbound port 5000 from frontend security group only
- ✅ Allows inbound port 80 from frontend security group (health checks)

This ensures **only the frontend can reach the backend**.

#### Layer 2: Application Routing (Nginx)

Nginx intelligently routes requests:
- Static files (/, /assets/*) → Served from local filesystem
- API requests (/api/*) → Proxied to backend ALB
- Cache control → Prevents stale content
- Headers → Adds security headers (X-Requested-With, etc.)

#### Layer 3: HTTPS (Optional but Recommended)

- SSL/TLS certificates from AWS Certificate Manager
- Frontend ALB terminates HTTPS
- Traffic encrypted in transit
- HTTP automatically redirects to HTTPS

---

## Architectural Model

### Single Page Application (SPA) with Network Isolation

```
┌─────────────────────────────────────────────────────────┐
│  SPA Architecture (Frontend calls Backend)              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ✅ User sees: Normal website (React app)               │
│  ✅ Backend hidden: Cannot access directly              │
│  ✅ Security: Network-level (security groups)           │
│  ⚠️  Visibility: APIs discoverable in browser DevTools  │
│  ✅ Protection: Real (network isolation, not obscurity) │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### What This Project Actually Achieves

**Frontend (Exposed):**
- Publicly accessible at frontend ALB DNS
- Anyone can visit and use the app
- React runs in the browser (user-controlled environment)

**Backend (Network-Level Secured):**
- Has a public ALB but is locked down by security groups
- Only accepts traffic from the frontend security group
- Not directly accessible from the internet
- Direct attempts result in connection timeout

---

## The Honest Truth About API Visibility

### In a Single Page Application:

❌ **APIs cannot be hidden** (they run in the user's browser)  
✅ **APIs can be protected** with proper security  
✅ **Backend is effectively invisible to end users** (due to network isolation)

### What This Means:

- A developer inspecting network requests **can see** `/api/users` being called
- An end user **cannot access** the backend directly (connection times out)
- Headers and Nginx routing logic are **routing mechanics, not security**
- Real security is enforced at the **network layer** (security groups)

### Security Layers in This Project

| Layer | What It Does | Example |
|-------|-------------|---------|
| **Network** | Blocks traffic at firewall level | Backend SG only allows frontend SG |
| **Application** | Routes requests intelligently | Nginx routes `/api/*` to backend ALB |
| **HTTP** | Sets proper headers | Cache-Control, X-Requested-With |

**Why this works**: Even though APIs are visible in code, the network prevents unauthorized access.

---

## Alternative Architectures (Not Used Here)

### SSR / Backend-for-Frontend (BFF)

```
User → Server-Side Rendering → Backend API (truly hidden)
```

**Pros:**
- Backend APIs completely invisible to users
- True server-to-server communication
- Better SEO

**Cons:**
- More complex infrastructure
- Requires server-side rendering setup
- Higher operational overhead

### API Gateway Pattern

```
User → API Gateway → Lambda Functions → Database
```

**Pros:**
- Serverless (no container management)
- Built-in auth, throttling, caching
- Pay per request

**Cons:**
- Vendor lock-in (AWS specific)
- Cold start latency
- More complex debugging

### This Project (SPA + Network Security)

```
User → React SPA → Nginx → Backend API (network secured)
```

**Pros:**
- ✅ Simple architecture
- ✅ Honest about tradeoffs
- ✅ Secure with network isolation
- ✅ Easy to understand and maintain

**Cons:**
- ⚠️ APIs visible in browser DevTools (but protected)

---

## Architectural Philosophy

### Core Principles

1. **Simplicity Over Complexity**
   - Use proven patterns (SPA + REST API)
   - Avoid premature optimization
   - Clear separation of concerns

2. **Security by Design**
   - Network isolation (security groups)
   - Principle of least privilege
   - Defense in depth (multiple layers)

3. **Honesty in Documentation**
   - Explain what works and why
   - Document tradeoffs clearly
   - No false sense of security

4. **Production-Ready Practices**
   - Health checks for all services
   - Centralized logging (CloudWatch)
   - Rolling deployments (zero downtime)
   - Infrastructure as code ready

---

## Key Architectural Decisions

### Why Fargate Over EC2?

**Fargate (Serverless Containers):**
- ✅ No server management
- ✅ Automatic scaling
- ✅ Pay only for what you use
- ✅ Faster deployment

**EC2 (Traditional Servers):**
- More control over instances
- Potentially cheaper at scale
- Requires server maintenance

**Decision**: Fargate for simplicity and modern cloud-native approach.

### Why ALB Over NLB?

**Application Load Balancer (ALB):**
- ✅ Layer 7 (HTTP/HTTPS) routing
- ✅ Path-based routing
- ✅ Host-based routing
- ✅ Better for web applications

**Network Load Balancer (NLB):**
- Layer 4 (TCP/UDP) routing
- Ultra-low latency
- Better for non-HTTP traffic

**Decision**: ALB for HTTP-based web application.

### Why Nginx Over Direct Proxy?

**With Nginx:**
- ✅ Static file serving
- ✅ Caching control
- ✅ Reverse proxy
- ✅ Security headers
- ✅ URL rewriting

**Without Nginx:**
- Simpler setup
- One less component

**Decision**: Nginx for production-grade features and performance.

---

## Scalability Considerations

### Horizontal Scaling

ECS allows easy horizontal scaling:

```bash
# Scale backend to 3 tasks
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-backend-service \
  --desired-count 3
```

ALB automatically distributes traffic across all tasks.

### Auto Scaling

Configure auto-scaling based on metrics:

- **CPU utilization** (scale at 70%)
- **Memory utilization** (scale at 80%)
- **Request count** (scale at 1000 req/min)

### Database Considerations (Future)

Current: In-memory data (not persistent)

Production recommendations:
- **Amazon RDS** (PostgreSQL/MySQL)
- **Amazon DynamoDB** (NoSQL)
- **Amazon Aurora** (Serverless SQL)

---

## Cost Optimization

### Current Costs (Estimated)

| Service | Cost |
|---------|------|
| ECS Fargate (2 tasks, 0.25 vCPU, 0.5GB) | ~$10/month |
| ALB (2 load balancers) | ~$35/month |
| ECR (image storage) | ~$1/month |
| CloudWatch Logs | ~$2/month |
| **Total** | ~$48/month |

### Cost Savings Tips

1. **Use Fargate Spot** (70% cheaper, may be interrupted)
2. **Single ALB** (use path routing instead of 2 ALBs)
3. **CloudWatch log retention** (reduce from 30d to 7d)
4. **Delete unused ECR images** (lifecycle policies)

---

## High Availability

### Current Setup

- **Multi-AZ deployment** (ALB in 2+ availability zones)
- **Health checks** (unhealthy tasks replaced automatically)
- **Rolling updates** (zero downtime deployments)

### Production Enhancements

- **Multi-region deployment** (disaster recovery)
- **RDS Multi-AZ** (automatic failover)
- **CloudFront CDN** (global edge caching)
- **Route53 failover routing** (automatic region failover)

---

## Monitoring & Observability

### Current Monitoring

- **CloudWatch Logs**: Container stdout/stderr
- **ALB Health Checks**: Task health status
- **ECS Metrics**: CPU, memory usage

### Production Enhancements

- **CloudWatch Dashboards**: Visual metrics
- **CloudWatch Alarms**: Alert on issues
- **AWS X-Ray**: Distributed tracing
- **Third-party APM**: Datadog, New Relic
- **Structured logging**: JSON logs

---

## Lessons Learned

### What Worked Well

✅ **Network-level security** (effective and simple)  
✅ **Fargate** (no server management)  
✅ **Docker multi-stage builds** (smaller images)  
✅ **CloudWatch logs** (easy debugging)  
✅ **GitHub Actions** (simple CI/CD)

### What Could Be Improved

⚠️ **Two ALBs** (expensive; could use one with path routing)  
⚠️ **No database** (data lost on restart)  
⚠️ **No caching layer** (Redis would improve performance)  
⚠️ **No WAF** (vulnerable to DDoS, injection attacks)  
⚠️ **No secrets management** (hard-coded configs)

---

## Next Steps

- **Add Database**: Implement persistent storage with RDS
- **Implement Caching**: Add Redis for session management
- **Add Authentication**: JWT or OAuth 2.0
- **Add WAF**: Protect against common attacks
- **Multi-region**: Deploy to multiple AWS regions
- **Infrastructure as Code**: Convert to Terraform/CDK

---

## Further Reading

- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [Twelve-Factor App](https://12factor.net/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Container Security Best Practices](https://aws.amazon.com/blogs/containers/)
