# 🔧 Troubleshooting Guide for Rexpress

This guide covers common issues you might encounter and how to solve them.

---

## Problem 1: "Site Can't Be Reached" / Connection Timeout

### Symptoms
- Frontend ALB DNS times out in browser
- Cannot reach `http://<FRONTEND_ALB_DNS>`
- Works locally but not on AWS

### Root Causes
- Security group doesn't allow inbound traffic
- ALB not associated with correct subnets
- ECS tasks not getting public IPs
- ALB in wrong availability zones

### Solutions

**Check Security Group Rules:**
```bash
aws ec2 describe-security-groups \
  --group-names rexpress-frontend-sg \
  --region ap-south-1
```

Ensure inbound rules include:
- Type: HTTP, Port: 80, Source: 0.0.0.0/0
- Type: HTTPS, Port: 443, Source: 0.0.0.0/0 (if using SSL)

**Verify ECS Task Has Public IP:**
1. ECS → Clusters → rexpress-cluster → Services
2. Click on service → Tasks tab
3. Click on running task → Check "Public IP" is assigned

**Fix**: Update service to enable public IP:
```bash
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region ap-south-1
```

**Check ALB Health:**
1. EC2 → Load Balancers → Select frontend ALB
2. Check "State" is "active"
3. Listeners tab → Verify port 80 is configured
4. Target groups → Check targets are healthy

---

## Problem 2: Backend Accessible Directly from Internet

### Symptoms
- Direct calls to `http://<BACKEND_ALB_DNS>/api/users` return data
- Anyone can access your API without going through frontend

### Why It's Bad
- Your API data is exposed to anyone on the internet
- No rate limiting or access control
- Potential security vulnerability

### Solution

Remove public access and allow only frontend security group:

```bash
# Get security group IDs
BACKEND_SG=$(aws ec2 describe-security-groups \
  --group-names rexpress-backend-sg \
  --region ap-south-1 \
  --query "SecurityGroups[0].GroupId" --output text)

FRONTEND_SG=$(aws ec2 describe-security-groups \
  --group-names rexpress-frontend-sg \
  --region ap-south-1 \
  --query "SecurityGroups[0].GroupId" --output text)

# Remove public access (0.0.0.0/0)
aws ec2 revoke-security-group-ingress \
  --group-id $BACKEND_SG \
  --protocol tcp --port 5000 --cidr 0.0.0.0/0 \
  --region ap-south-1

# Allow backend port 5000 from frontend SG only
aws ec2 authorize-security-group-ingress \
  --group-id $BACKEND_SG \
  --protocol tcp --port 5000 \
  --source-group $FRONTEND_SG \
  --region ap-south-1

# Allow backend port 80 from frontend SG (for health checks)
aws ec2 authorize-security-group-ingress \
  --group-id $BACKEND_SG \
  --protocol tcp --port 80 \
  --source-group $FRONTEND_SG \
  --region ap-south-1
```

**Verify:**
- ❌ `curl http://<BACKEND_ALB_DNS>/api/users` → Should timeout
- ✅ Frontend `/users` page → Should still work

---

## Problem 3: Container Image Not Updating

### Symptoms
- Deployed new version but ECS still runs old container
- Changes not reflected in live site
- CloudWatch logs show old behavior

### Root Causes
- ECS cached old image
- Task definition not updated
- Service not forced to redeploy

### Solutions

**Force New Deployment:**
```bash
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --force-new-deployment \
  --region ap-south-1
```

**Update Task Definition and Deploy:**
```bash
# Register new task definition revision
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# Update service with new revision
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --task-definition rexpress-frontend-task:2 \
  --region ap-south-1
```

**Clear Browser Cache:**
- Press Ctrl+Shift+Delete
- Clear cached images and files
- Hard refresh: Ctrl+F5

---

## Problem 4: Frontend Can't Reach Backend API

### Symptoms
- Frontend loads but clicking "Users" shows error or empty data
- Console error: `Failed to fetch` or network error
- Backend works when accessed directly

### Root Causes
- Wrong backend ALB DNS in `nginx.conf`
- Nginx configuration syntax error
- CORS issues
- Backend security group blocking frontend

### Solutions

**Check nginx.conf:**
```nginx
location /api/ {
    # IMPORTANT: Must match your actual backend ALB DNS
    proxy_pass http://rexpress-backend-alb-123456.ap-south-1.elb.amazonaws.com;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

**Rebuild and Redeploy Frontend:**
```bash
cd frontend
docker build -t rexpress-frontend .
docker tag rexpress-frontend:latest \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest

aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --force-new-deployment \
  --region ap-south-1
```

**Check Security Groups:**
Ensure backend security group allows traffic from frontend security group (see Problem 2).

**Test Nginx Config Locally:**
```bash
docker run -p 8080:80 rexpress-frontend
# Try accessing http://localhost:8080/users
```

---

## Problem 5: Stale Frontend After Deploy

### Symptoms
- Deployed new frontend but browser shows old UI
- Hard refresh doesn't help
- Incognito mode shows new version

### Root Causes
- Browser cache
- Nginx caching
- Missing cache-control headers

### Solutions

**Update nginx.conf with proper cache headers:**
```nginx
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
}

location = /index.html {
    root /usr/share/nginx/html;
    add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0";
    add_header Pragma "no-cache";
}

location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    root /usr/share/nginx/html;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**Force Browser Refresh:**
- Chrome/Firefox: Ctrl+Shift+Delete → Clear cache
- Hard refresh: Ctrl+F5 or Ctrl+Shift+R

**Wait for ECS Deployment:**
- Rolling deployment takes 2-3 minutes
- Old tasks drain before stopping

---

## Problem 6: HTTPS Timing Out on Custom Domain

### Symptoms
- `https://www.yourdomain.com` times out
- `http://` version works fine
- ALB HTTP endpoint works

### Root Cause
Frontend ALB security group doesn't allow inbound TCP/443

### Solution

**Add HTTPS rule to security group:**
```bash
# Using AWS Console:
EC2 → Security Groups → Select rexpress-frontend-sg
→ Inbound Rules → Edit Inbound Rules → Add Rule:
- Type: HTTPS
- Protocol: TCP
- Port Range: 443
- Source: 0.0.0.0/0 (IPv4) and ::/0 (IPv6)

# Using AWS CLI:
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp --port 443 --cidr 0.0.0.0/0 \
  --region ap-south-1

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --ip-permissions IpProtocol=tcp,FromPort=443,ToPort=443,Ipv6Ranges='[{CidrIpv6="::/0"}]' \
  --region ap-south-1
```

**Verify:**
```bash
curl -I "https://www.yourdomain.com"
# Should return: HTTP/1.1 200 OK
```

---

## Problem 7: ECS Task Fails to Start

### Symptoms
- Service shows 0 running tasks
- Tasks start but immediately stop
- "STOPPED" status with error message

### Common Causes

**Cause 1: Container Fails Health Check**

Check CloudWatch logs:
```bash
aws logs tail /ecs/rexpress-backend --follow --region ap-south-1
```

Look for:
- Application errors
- Missing environment variables
- Port binding issues

**Cause 2: Insufficient Resources**

Task definition requires more CPU/memory than available:
- Solution: Increase task size or reduce resource limits

**Cause 3: ECR Image Pull Error**

Check task stopped reason:
```bash
aws ecs describe-tasks \
  --cluster rexpress-cluster \
  --tasks <TASK_ARN> \
  --region ap-south-1
```

Solutions:
- Verify image exists in ECR
- Check task execution role has ECR permissions
- Ensure correct image URI in task definition

**Cause 4: Missing Task Execution Role**

Create execution role with required permissions:
- `AmazonECSTaskExecutionRolePolicy`
- ECR pull permissions
- CloudWatch Logs permissions

---

## Problem 8: Target Group Shows Unhealthy

### Symptoms
- ALB target group shows "Unhealthy"
- Tasks running but not receiving traffic
- Health check failing

### Solutions

**Check Health Check Path:**
1. EC2 → Target Groups → Select target group
2. Health checks tab → Verify path matches your app

For backend: `/health`  
For frontend: `/` or `/health`

**Verify App Responds to Health Check:**
```bash
# SSH into container (if possible) or check logs
curl http://localhost:5000/health
# Should return: {"status": "healthy"}
```

**Adjust Health Check Settings:**
- Increase timeout (from 5s to 10s)
- Increase interval (from 30s to 60s)
- Reduce healthy threshold (from 2 to 1)

**Check Security Group:**
Ensure target security group allows traffic from ALB security group.

---

## Problem 9: GitHub Actions Pipeline Fails

### Symptom: Login to ECR Fails

**Error:** `Error: Cannot perform an interactive login from a non TTY device`

**Solution:** Check AWS credentials in GitHub Secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_ACCOUNT_ID`

### Symptom: Docker Build Fails

**Error:** `unable to prepare context: unable to evaluate symlinks in Dockerfile path`

**Solution:** Check Dockerfile exists and path is correct in workflow:
```yaml
context: ./backend
file: ./backend/Dockerfile
```

### Symptom: ECS Update Fails

**Error:** `Service not found` or `Cluster not found`

**Solution:** Verify names match exactly:
- Cluster: `rexpress-cluster`
- Service: `rexpress-backend-service` and `rexpress-frontend-service`

### Symptom: Pipeline Hangs on Deployment

**Solution:** Check ECS service events:
1. ECS → Clusters → Services → Events tab
2. Look for errors (e.g., "failed to pull image", "health check failed")

---

## Debugging Strategies

### 1. Check Logs First

Always start with CloudWatch logs:
```bash
# Backend logs
aws logs tail /ecs/rexpress-backend --follow --region ap-south-1

# Frontend logs
aws logs tail /ecs/rexpress-frontend --follow --region ap-south-1
```

### 2. Inspect AWS Resources

```bash
# Check ALB health
aws elbv2 describe-target-health \
  --target-group-arn <TG_ARN> \
  --region ap-south-1

# Check ECS task status
aws ecs describe-tasks \
  --cluster rexpress-cluster \
  --tasks <TASK_ARN> \
  --region ap-south-1

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-xxx \
  --region ap-south-1
```

### 3. Test Locally

Before deploying to AWS:
```bash
# Run containers locally
docker run -p 5000:5000 rexpress-backend
docker run -p 8080:80 rexpress-frontend

# Test endpoints
curl http://localhost:5000/health
curl http://localhost:8080
```

### 4. Make HTTP Requests

Test specific endpoints:
```bash
# PowerShell (Windows)
Invoke-WebRequest -Uri "http://<ALB_DNS>/api/users"

# curl (Linux/Mac)
curl http://<ALB_DNS>/api/users

# With headers
curl -H "X-Requested-With: XMLHttpRequest" http://<ALB_DNS>/api/users
```

### 5. Verify Network Connectivity

```bash
# Check if port is open
telnet <ALB_DNS> 80

# Check DNS resolution
nslookup <ALB_DNS>

# Trace route
traceroute <ALB_DNS>
```

---

## Quick Troubleshooting Checklist

Use this checklist when something goes wrong:

| Check | Command/Location |
|-------|-----------------|
| **ECS Tasks Running?** | ECS → Clusters → Services → Tasks |
| **Target Group Healthy?** | EC2 → Target Groups → Targets tab |
| **Security Groups Correct?** | EC2 → Security Groups |
| **CloudWatch Logs?** | CloudWatch → Log groups → /ecs/* |
| **ALB Active?** | EC2 → Load Balancers |
| **DNS Resolving?** | `nslookup <ALB_DNS>` |
| **Port Open?** | `telnet <ALB_DNS> 80` |
| **Latest Image Deployed?** | ECR → Repositories → Image tags |

---

## Getting Help

If you're still stuck:

1. **Check CloudWatch Logs** - Most issues show up in logs
2. **Review AWS Console Events** - ECS service events often explain failures
3. **Test Locally** - Eliminate AWS-specific issues
4. **Search AWS Forums** - Others may have faced similar issues
5. **AWS Support** - Consider AWS support plan for production issues

---

## Common Error Messages

### "Service [service-name] not found"
- Service doesn't exist or wrong region
- Check service name and region match

### "CannotPullContainerError"
- Task execution role lacks ECR permissions
- Image doesn't exist in ECR
- Wrong image URI in task definition

### "ResourceInitializationError"
- Task execution role missing
- CloudWatch log group doesn't exist
- Insufficient ENI capacity in subnet

### "CannotStartContainerError"
- Application error on startup
- Check CloudWatch logs for error details
- Verify container CMD/ENTRYPOINT is correct

---

## Performance Issues

### Slow Response Times

**Possible Causes:**
- Too few ECS tasks (scale up)
- Backend doing heavy computation
- No caching layer
- Database queries slow

**Solutions:**
- Increase desired task count
- Add Redis caching
- Optimize database queries
- Use CDN for static assets

### High CPU/Memory Usage

**Check metrics:**
```bash
aws ecs describe-services \
  --cluster rexpress-cluster \
  --services rexpress-backend-service \
  --region ap-south-1
```

**Solutions:**
- Increase task CPU/memory
- Optimize application code
- Profile and fix bottlenecks
- Enable auto-scaling

---

## Best Practices to Avoid Issues

1. **Always Test Locally First** - Catch issues before AWS deployment
2. **Check Logs Immediately** - Don't wait for problems to escalate
3. **Use Health Checks** - Detect failures early
4. **Version Your Images** - Tag with commit SHA for traceability
5. **Monitor Resources** - Set up CloudWatch alarms
6. **Document Changes** - Keep track of configuration changes
7. **Incremental Deployments** - Test one change at a time

---

## Need More Help?

- [Docker Guide](DOCKER_GUIDE.md) - Docker-specific issues
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Step-by-step deployment
- [Architecture Guide](ARCHITECTURE.md) - Understand the system
- [CI/CD Guide](CI_CD_GUIDE.md) - Pipeline troubleshooting
