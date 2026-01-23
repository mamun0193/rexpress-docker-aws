# 📊 Observability & Debugging Guide for Rexpress

This guide explains how **Rexpress** handles logging, container failures, resource constraints, and observability when running on **AWS ECS with Application Load Balancers**.

It also covers how to investigate issues and interpret system behavior in production.

---

## Centralized Logging with CloudWatch

Rexpress uses **CloudWatch Logs** as the centralized logging backend for all ECS tasks.

Both backend and frontend containers stream their standard output (stdout) and error (stderr) to CloudWatch. Logging is configured at the ECS task definition level using the `awslogs` log driver.

### Log Group Structure

Each service has a dedicated log group:

| Service | Log Group | Purpose |
|---------|-----------|---------|
| Backend | `/ecs/rexpress-backend` | Express.js API logs |
| Frontend | `/ecs/rexpress-frontend` | Nginx and React logs |

**Key Behavior**:
- Every ECS task execution creates a **new log stream**
- When a task restarts, a new log stream is created automatically
- Logs persist **even after tasks stop**, enabling post-mortem debugging
- Application logs are the **primary source of truth** for runtime failures

### How to Access Logs

**Using AWS Console:**
1. Open CloudWatch → Logs → Log groups
2. Select `/ecs/rexpress-backend` or `/ecs/rexpress-frontend`
3. Select the log stream (named like `ecs/rexpress-backend/xxxxxxx`)
4. View recent logs and search for errors

**Using AWS CLI:**

```bash
# View recent logs (last 15 minutes)
aws logs tail /ecs/rexpress-backend --follow --region ap-south-1

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/rexpress-backend \
  --filter-pattern "ERROR" \
  --region ap-south-1
```

---

## Debugging ECS Task Failures

When an ECS service experiences issues, debugging follows a systematic flow:

### Debugging Workflow

```
1. Check ECS Service Events
   ↓ (What happened?)
2. Review ECS Task Stop Reason
   ↓ (How did it exit?)
3. Open CloudWatch Logs
   ↓ (Why did it happen?)
4. Analyze Application Output
   ↓ (Stack traces, config errors?)
5. Take Action
```

### Step 1: Check ECS Service Events

**Using AWS Console:**
1. ECS → Clusters → `rexpress-cluster`
2. Services → Select your service
3. Events tab → Review recent events

**Sample Event**: "Service rexpress-backend-service has reached a steady state with 0 running tasks."

This indicates the service is struggling—either failing to start or crashing immediately.

---

### Step 2: Review Task Stop Reason

**Using AWS Console:**
1. Services → Select service → Tasks tab
2. Click on a stopped task
3. Look for "Stop code" and "Stop reason"

| Stop Code | Stop Reason | Meaning |
|-----------|-------------|---------|
| `EssentialContainerExited` | Container exited with code 1 | Application error (see logs) |
| `EssentialContainerExited` | Container exited with code 137 | Memory limit exceeded (OOMKilled) |
| `TaskFailedToStart` | Insufficient memory | Task def memory too high for cluster |
| `HealthCheckFailure` | N/A | ALB health checks failed repeatedly |

---

### Step 3 & 4: Analyze CloudWatch Logs

Once you know a task failed, look at its logs:

```bash
# Get the task ARN from ECS console, then extract log stream name
TASK_ID="abc1234..."
LOG_STREAM="ecs/rexpress-backend/${TASK_ID}"

aws logs get-log-events \
  --log-group-name /ecs/rexpress-backend \
  --log-stream-name "${LOG_STREAM}" \
  --region ap-south-1
```

**Look for:**
- Stack traces (JavaScript errors)
- Port binding errors ("EADDRINUSE: Address already in use")
- Missing environment variables ("Cannot read property 'x' of undefined")
- Dependency failures ("Cannot connect to Redis")
- Startup timeouts

---

## Container Exit Codes & Exit Behavior

Containers running in ECS may stop for several reasons. ECS does not distinguish between causes—it only observes exit signals.

### Common Exit Codes

| Exit Code | Meaning | Typical Cause |
|-----------|---------|---------------|
| `0` | Normal/clean exit | Intentional shutdown (rare in services) |
| `1` | Application error | Unhandled exception, startup failure |
| `2` | Misuse of command | Shell/Docker issue (rare) |
| `137` | **OOMKilled** | Memory limit exceeded (container killed by kernel) |
| `139` | SIGSEGV | Segmentation fault (memory corruption, rare in Node.js) |

**Exit code 137 is the most important to understand:**

When a container exceeds its configured memory limit:
1. Linux kernel detects the violation
2. OOM killer immediately terminates the process
3. Container exits with code 137
4. No graceful shutdown, no logs about the kill (already out of memory)
5. ECS reports the exit and launches a replacement

---

## ECS Restart Behavior (Crash Loops)

ECS services enforce **desired state**, not application correctness.

### How Restarts Work

```
Desired tasks: 1
        ↓
Task crashes (exit code 1)
        ↓
ECS marks task as STOPPED
        ↓
ECS Service Scheduler launches replacement task
        ↓
Replacement task crashes with same error
        ↓
Loop continues indefinitely
```

**Important**: ECS does not:
- Suppress restarts for misconfigured applications
- Apply exponential backoff
- Prevent infinite crash loops

If your application has a configuration error, it will crash continuously until you fix the underlying issue.

### Detecting Crash Loops

**Using CloudWatch Metrics:**
1. CloudWatch → Container Insights → Service level
2. Look at "Running Task Count" over time
3. Oscillating between 0 and 1 = crash loop

**Using AWS CLI:**

```bash
# Get task launch time and stop time
aws ecs describe-tasks \
  --cluster rexpress-cluster \
  --tasks "arn:aws:ecs:ap-south-1:ACCOUNT:task/rexpress-cluster/TASK_ID" \
  --region ap-south-1 \
  --query 'tasks[0].[createdAt,stoppedAt]'
```

If createdAt and stoppedAt are very close (seconds apart), you have a crash loop.

---

## Resource Constraints & Enforcement

Each ECS task defines explicit CPU and memory limits. These limits directly impact application behavior.

### CPU Enforcement

| Property | Behavior | Impact |
|----------|----------|--------|
| Type | **Soft limit** | Throttling, not killing |
| Exceeded | Container is throttled | Increased latency, slower responses |
| Result | App remains running | Performance degrades, but doesn't crash |

**Example**: If you allocate 256 CPU units but need 512, your app will slow down but keep running.

### Memory Enforcement

| Property | Behavior | Impact |
|----------|----------|--------|
| Type | **Hard limit** | Immediate kill |
| Exceeded | Container terminated | Exit code 137 (OOMKilled) |
| Result | App crashes instantly | No graceful shutdown, no warning |

**Example**: If you allocate 512 MB but your app uses 600 MB, the container is killed immediately.

---

## Task Definition Memory Configuration

When creating an ECS task definition, you must set:

1. **Task memory** (total RAM for the task)
2. **Container memory** (RAM allocated to the specific container)

**Best Practice:**
- Task memory = Container memory + 128 MB buffer
- Example: 512 MB container → 640 MB task memory

If misconfigured (e.g., container memory > task memory), the task fails to launch.

### Detecting Memory Issues

**Memory growing over time** (leak):
- Monitor with CloudWatch metrics
- Restart tasks on a schedule (before OOMKill)
- Optimize code to reduce memory usage

**Sudden OOMKill**:
- Check CloudWatch logs for "exit code 137"
- Review application for memory leaks
- Increase task memory allocation

---

## Load Balancer Health Checks

Application Load Balancers use health checks to determine whether a task should receive traffic.

### What Health Checks Verify

✅ **Verified**:
- Endpoint reachability
- Response time
- HTTP status codes (200, 301, 302, etc.)

❌ **NOT Verified**:
- Database connectivity
- Business logic correctness
- Internal application state
- Resource pressure (CPU, memory)
- Event loop responsiveness

### Health Check Configuration

Default ALB health checks for Rexpress:

| Property | Value | Purpose |
|----------|-------|---------|
| Protocol | HTTP | Check the app via HTTP |
| Port | 5000 (backend), 80 (frontend) | Port app listens on |
| Path | `/health` or `/api/health` | Lightweight check endpoint |
| Interval | 30 seconds | How often to check |
| Timeout | 5 seconds | Max time for response |
| Healthy threshold | 2 | Consecutive passes = healthy |
| Unhealthy threshold | 3 | Consecutive failures = unhealthy |

### When Health Checks Fail

**Scenario 1: App crashes but health check passes (initially)**
- App crashes before health check interval
- ALB doesn't detect it until next check
- Brief downtime until ALB marks task unhealthy

**Scenario 2: Health check fails but app is "healthy"**
- App logic is correct
- But `/health` endpoint returns 500
- ALB removes from rotation even though app works
- Result: Healthy app appears offline

**Scenario 3: Health check succeeds but app is broken**
- `/health` endpoint works
- But `/api/data` endpoint fails
- ALB sends traffic to broken app
- Result: Users see errors

### Improving Health Checks

Best practice: Make health checks **meaningful**, not just reachable:

**Bad health check** (only checks if port is open):
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

**Better health check** (verifies dependencies):
```javascript
app.get('/health', async (req, res) => {
  try {
    // Check Redis connectivity
    await redis.ping();
    // Check database connectivity (if used)
    // await db.query('SELECT 1');
    res.status(200).json({ status: 'healthy' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});
```

---

## Observability with CloudWatch Container Insights

Rexpress uses **CloudWatch Container Insights** to expose ECS metrics at the cluster, service, and task levels.

### Enabled Metrics

| Metric | Unit | Purpose |
|--------|------|---------|
| `CPUUtilization` | Percent (0-100%) | CPU pressure indicator |
| `MemoryUtilization` | Percent (0-100%) | Memory pressure indicator |
| `NetworkIn` | Bytes | Incoming network traffic |
| `NetworkOut` | Bytes | Outgoing network traffic |
| `RunningCount` | Tasks | How many tasks are actually running |
| `DesiredCount` | Tasks | How many tasks should be running |

### Viewing Metrics

**Using AWS Console:**
1. CloudWatch → Container Insights → Performance monitoring
2. Select Resource type: Services
3. Select your cluster and service
4. Review the dashboard

**Using AWS CLI:**

```bash
# Get CPU utilization for last 1 hour
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=rexpress-backend-service Name=ClusterName,Value=rexpress-cluster \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum \
  --region ap-south-1
```

---

## Alarms & Monitoring Strategy

CloudWatch alarms detect abnormal behavior before it causes user-facing failures.

### Alarm Design Principles

1. **One metric per alarm** – Clear causality
2. **Actionable thresholds only** – Avoid noise
3. **Meaningful interpretation** – Know what action to take

### Implemented Alarms

#### ECS Memory Utilization Alarm

| Property | Value |
|----------|-------|
| Metric | `MemoryUtilization` |
| Service | `rexpress-backend` |
| Threshold | > 80% |
| Evaluation period | 2 minutes |
| Datapoints to alarm | 1 out of 2 |

**What it means:**
- Backend memory usage exceeded 80%
- OOMKill is likely in the next 20% usage increase
- Action: Scale service or optimize code

**How to respond:**
1. Check CloudWatch logs for memory-intensive operations
2. Review application code for memory leaks
3. Increase task memory allocation
4. Or scale service to more tasks (distribute load)

#### ECS CPU Utilization Alarm

| Property | Value |
|----------|-------|
| Metric | `CPUUtilization` |
| Service | `rexpress-backend` |
| Threshold | > 85% |
| Evaluation period | 2 minutes |
| Datapoints to alarm | 1 out of 2 |

**What it means:**
- Backend CPU is heavily throttled
- Requests are becoming slow
- Action: Scale service or optimize code

**How to respond:**
1. Check if traffic spike caused it
2. Review application code for hot loops
3. Scale service to more tasks
4. Or upgrade to higher CPU allocation

#### Task Count Mismatch Alarm

| Property | Value |
|----------|-------|
| Metric | `RunningCount` vs `DesiredCount` |
| Service | Any service |
| Threshold | `RunningCount != DesiredCount` for 2 minutes |

**What it means:**
- Tasks are not starting or crashing
- Likely a configuration error or resource exhaustion
- Action: Investigate logs immediately

**How to respond:**
1. Check ECS task stop reasons
2. Review CloudWatch logs for errors
3. Check if cluster has capacity
4. Review task definition for misconfiguration

---

## Operational Investigation Checklist

When something goes wrong in production, follow this checklist:

### Phase 1: Triage (5 min)

- [ ] Are CloudWatch alarms active? Which ones?
- [ ] Check ECS service event log
- [ ] Check `RunningCount` vs `DesiredCount`
- [ ] Is this a recent deployment?

### Phase 2: Evidence Collection (5-10 min)

- [ ] Review CloudWatch metrics (CPU, Memory, Network)
- [ ] Check ECS task stop reasons
- [ ] Open CloudWatch logs for failed tasks
- [ ] Search logs for ERROR, exception, failed

### Phase 3: Root Cause Analysis (10-30 min)

- [ ] Memory exhaustion? (check exit code 137)
- [ ] Configuration error? (check startup logs)
- [ ] Dependency failure? (check Redis/DB connectivity)
- [ ] Health check misconfiguration? (compare app status vs ALB status)

### Phase 4: Remediation

- [ ] Apply quick fix (increase memory, restart service)
- [ ] Verify fix resolves issue
- [ ] Plan longer-term solution
- [ ] Document incident and resolution

---

## Operational Guarantees

With the current setup:

✅ **All container crashes are observable** — Available in CloudWatch Logs with exit code and reason  
✅ **Resource-related failures are detectable** — Memory and CPU metrics visible in real-time  
✅ **Task restart behavior is predictable** — Crash loops visible in Container Insights  
✅ **Application logs are preserved** — Available indefinitely after task termination  
✅ **Alarms provide early warnings** — Before OOMKill or major performance degradation  

This foundation enables **safe scaling**, **reliable deployments**, and **effective incident response**.

---

## Next Steps

- Set up SNS notifications for alarms (when ready)
- Create CloudWatch dashboards for your team
- Establish on-call runbooks based on this guide
- Test failure scenarios in a staging environment
- Document team-specific troubleshooting steps
