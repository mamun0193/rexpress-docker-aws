# 🔴 Redis Integration Guide

> Complete walkthrough: Local Redis (Docker) → Production Redis (AWS ElastiCache)

---

## 📋 Table of Contents

1. [Local Redis Setup (Docker Compose)](#local-redis-setup)
2. [Production Redis Setup (AWS ElastiCache)](#production-redis-setup)
3. [ECS Task Definition Configuration](#ecs-task-definition)
4. [Monitoring & Troubleshooting](#monitoring)
5. [Failure Testing](#failure-testing)

---

## Local Redis Setup

### Docker Compose Configuration

The local development environment runs Redis in Docker:

```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  container_name: redis
  ports:
    - "6379:6379"
```

**Environment variables for backend**:
```env
REDIS_ENABLED=true
REDIS_HOST=redis          # Docker service name
REDIS_PORT=6379
```

**Launch locally**:
```bash
docker-compose up -d
```

**Verify Redis is running**:
```bash
redis-cli -h localhost -p 6379 ping
# Expected output: PONG
```

---

## Production Redis Setup

### AWS ElastiCache Migration (15 Steps)

#### **STEP 1 — Open ElastiCache**

AWS Console → **ElastiCache** → **Redis** → **Create Redis cache**

---

#### **STEP 2 — Deployment Option**

✅ **Node-based cluster**
❌ Do NOT choose Serverless

**Why**: Predictable endpoint, clearer networking, better learning value.

---

#### **STEP 3 — Creation Method**

✅ **New cache**

---

#### **STEP 4 — Cache Settings**

* **Name**: `rexpress-redis`
* Description: optional

---

#### **STEP 5 — Engine & Mode**

* **Engine**: Redis
* **Cluster mode**: ❌ Disabled

(Simple single-node Redis)

---

#### **STEP 6 — Node Configuration**

* **Node type**: `cache.t4g.micro`
* **Number of replicas**: `0`
* **Multi-AZ**: ❌ Disabled

(Cheap + perfect for learning)

---

#### **STEP 7 — Networking (VERY IMPORTANT)**

### VPC

✅ Select **same VPC** as your ECS cluster

### Subnet Group

* Choose **private subnets**
* ❌ No public subnets

### Public Access

❌ Disabled

---

#### **STEP 8 — Security Groups (CRITICAL STEP)**

### Create / Select Redis Security Group

**Inbound rule**:

* **Type**: Custom TCP
* **Port**: 6379
* **Source**: **ECS backend service security group**

❌ Do NOT allow `0.0.0.0/0`

**Result**: Only ECS can talk to Redis

---

#### **STEP 9 — Advanced Settings**

You can leave defaults:

* Encryption in transit: ❌ Off (ok for now)
* AUTH token: ❌ Off
* Backups: optional

(You can enable later)

---

#### **STEP 10 — Create Cache**

Click **Create Redis cache**
Wait until status = **Available**

⏱ Takes ~5–10 minutes

---

#### **STEP 11 — Copy Redis Endpoint**

Once available:

ElastiCache → Redis → your cluster → **Primary endpoint**

Example:
```
rexpress-redis.xxxxxx.use1.cache.amazonaws.com
```

⚠️ This replaces `localhost` or `redis`

---

## ECS Task Definition

### STEP 12 — Update Backend Task Definition

ECS → Task Definitions → Backend container → **Environment variables**

**Add**:
```env
REDIS_ENABLED=true
REDIS_HOST=rexpress-redis.xxxxxx.use1.cache.amazonaws.com
REDIS_PORT=6379
```

**Steps**:
1. Create new revision
2. Update environment variables
3. Register revision
4. Deploy service (rolling update)

---

## Monitoring

### STEP 13 — Verify in CloudWatch Logs

Backend logs should show:

**Success**:
```
✅ Redis ready
```

**Graceful fallback**:
```
⚠️ Redis error (ignored)
```

**Key point**: Service must stay UP even if Redis is unreachable.

---

### STEP 14 — Production Test

Call your API:

```bash
curl https://<ALB-DNS>/api/products
```

**Expected behavior**:
* First call → Database (slow ~1.5s)
* Second call → Cache (fast <10ms)
* Faster response

**Verify in logs**:
```
source: "db"    # First call
source: "cache" # Second call
```

---

## Failure Testing

### STEP 15 — Mandatory Failure Test

**Test graceful degradation**:

Temporarily:
* Remove Redis security group inbound rule **OR**
* Put wrong `REDIS_HOST` in task definition

**Expected behavior**:
```
✅ Logs show Redis error
✅ API still works
✅ ECS tasks do NOT restart
```

**This proves**: Your application is resilient—cache failures don't break the service.

---

## 🏗️ Final Architecture

```
Browser
  ↓
ALB (Frontend)
  ↓
ECS Frontend Container
  ↓ (API calls)
ALB (Backend)
  ↓
ECS Backend Container
  ↓ (Cache/DB lookups)
ElastiCache Redis (Private VPC)
```

---

## 📝 Implementation Details

### Redis Configuration (`backend/src/config/redis.js`)

```javascript
const { createClient } = require("redis");

let redisClient = null;
let redisReady = false;

async function connectRedis() {
  // Check if Redis is enabled
  if (process.env.REDIS_ENABLED !== "true") {
    console.log("Redis disabled via env");
    return null;
  }

  try {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        reconnectStrategy: false // Don't retry forever
      }
    });

    // Event handlers for monitoring
    redisClient.on("ready", () => {
      redisReady = true;
      console.log("✅ Redis ready");
    });

    redisClient.on("end", () => {
      redisReady = false;
      console.warn("⚠️ Redis connection closed");
    });

    redisClient.on("error", (err) => {
      redisReady = false;
      console.warn("⚠️ Redis error (ignored):", err.message);
    });

    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn("⚠️ Redis unavailable at startup");
    redisClient = null;
    redisReady = false;
    return null;
  }
}

function getRedisClient() {
  if (!redisClient || !redisReady) return null;
  return redisClient;
}

module.exports = { connectRedis, getRedisClient };
```

### Caching in Routes (`backend/src/routes/products.js`)

```javascript
const express = require("express");
const router = express.Router();
const { getRedisClient } = require("../config/redis");

router.get("/", async (req, res) => {
  const redis = getRedisClient();
  const cacheKey = "products:all";

  try {
    // SAFE cache read
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.json({
            source: "cache",
            data: JSON.parse(cached)
          });
        }
      } catch (err) {
        console.warn("Redis read failed, skipping cache");
      }
    }

    // Fallback to database
    await new Promise((r) => setTimeout(r, 1500)); // Simulate DB delay

    const products = [
      { id: 1, name: "Laptop" },
      { id: 2, name: "Phone" }
    ];

    // SAFE cache write
    if (redis) {
      try {
        await redis.setEx(cacheKey, 60, JSON.stringify(products));
      } catch (err) {
        console.warn("Redis write failed");
      }
    }

    res.json({
      source: "db",
      data: products
    });
  } catch (err) {
    console.error("Route failure:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
```

---

## ✅ What You've Mastered

✔ Local Redis with Docker Compose  
✔ Production Redis with AWS ElastiCache  
✔ ECS ↔ Redis networking  
✔ Security Groups configuration  
✔ Graceful degradation (cache failures don't break API)  
✔ CloudWatch monitoring & logs  
✔ Testing & failure scenarios  

---

## 🔗 Related Documentation

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full AWS deployment steps
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design overview
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues & fixes
