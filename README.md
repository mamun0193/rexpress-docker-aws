# 🚀 Rexpress - Deploy a Full-Stack App to AWS ECS

## What is Rexpress?

**Rexpress** is a simple full-stack application with:
- **Frontend**: A React app (built with Vite) that displays a home page and a users list
- **Backend**: An Express.js REST API that provides data (e.g., `/api/users`)

This project teaches you how to **containerize and deploy** both the frontend and backend to AWS using Docker and ECS Fargate—a serverless container platform.

**Goal**: By the end, you'll have a production-ready deployment where:
- Your frontend is publicly accessible
- Your backend is **secured** so only your frontend can access it
- Both run on AWS with automatic scaling and load balancing

---

---

## 📁 Project Structure

```
rexpress/
├── backend/
│   ├── Dockerfile           ← Container recipe for the API
│   ├── package.json
│   └── src/
│       ├── app.js           ← Express setup
│       └── server.js        ← Start the server
├── frontend/
│   ├── Dockerfile           ← Container recipe for React app
│   ├── nginx.conf           ← Nginx config (reverse proxy)
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       └── pages/
│           ├── Home.jsx     ← Home page
│           ├── Users.jsx    ← Fetches data from /api/users
│           └── Health.jsx
└── README.md
```

---

## 🐳 What is Docker? (A Quick Intro)

**The Problem**: "It works on my machine" syndrome
- Your app works locally but breaks on your colleague's computer or in production
- Different OS versions, Node versions, dependencies cause issues

**Docker Solution**: Package your app in a **container**
- A container is like a lightweight box that includes:
  - Your code
  - All dependencies (Node, npm packages, etc.)
  - The exact OS environment

**Benefits**:
- ✅ Same behavior everywhere (local, AWS, another server)
- ✅ Easy deployment (just run the container)
- ✅ Scalable (run multiple copies if traffic increases)
- ✅ Cost-effective (only pay for what you use)

**How it works in this project**:
1. We create a `Dockerfile` for the backend (Node.js + Express)
2. We create a `Dockerfile` for the frontend (Node.js + Vite + Nginx)
3. Build these into Docker images
4. Push the images to AWS ECR (Elastic Container Registry)
5. Deploy them to AWS ECS Fargate (containerized services run automatically)

## 📋 Prerequisites

Before you start, make sure you have:

1. **Docker Desktop** installed and running
2. **AWS CLI** installed (`aws configure` with your credentials)
3. **An AWS Account** with permissions for ECR, ECS, EC2, CloudWatch
4. Basic terminal/command line knowledge

---

## 🏗️ Deployment Architecture

Here's what we're building on AWS:

```
┌─────────────────────────────────────────────────────────┐
│                    USERS (INTERNET)                    │
│                         │                              │
│                         ▼                              │
│              ┌──────────────────────┐                 │
│              │  Frontend ALB        │                 │
│              │  (PUBLIC - Port 80)  │ ← Internet      │
│              └─────────┬────────────┘                 │
│                        │                              │
│                        ▼                              │
│              ┌──────────────────────┐                 │
│              │  Frontend Container  │                 │
│              │  React + Nginx       │                 │
│              │  ECS Fargate Task    │                 │
│              └─────────┬────────────┘                 │
│                        │                              │
│                 /api/* proxy requests                 │
│                        ▼                              │
│              ┌──────────────────────┐                 │
│              │  Backend ALB         │                 │
│              │  (PRIVATE - Port 80) │ ← Secured!     │
│              │  Only Frontend can   │                 │
│              │  access this         │                 │
│              └─────────┬────────────┘                 │
│                        │                              │
│                        ▼                              │
│              ┌──────────────────────┐                 │
│              │  Backend Container   │                 │
│              │  Express.js API      │                 │
│              │  ECS Fargate Task    │                 │
│              └──────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

### How It Works:

1. **User opens frontend URL** → Frontend ALB directs to React app (via Nginx)
2. **User navigates to `/users`** → React app fetches `/api/users`
3. **Frontend (Nginx) intercepts `/api/*`** → Routes to Backend ALB
4. **Backend ALB receives request** → Security group only allows frontend traffic ✅
5. **Backend processes request** → Returns JSON data
6. **Frontend displays data** → User sees the results

---

## 🔐 Security Architecture

**Frontend (Exposed)**:
- Publicly accessible at `http://frontend-alb-dns`
- Anyone can visit and use the app

**Backend (Protected)**:
- Has a public ALB but is locked down by security groups
- Only accepts traffic from the Frontend security group
- Not accessible directly from the internet
- If someone tries: `http://backend-alb-dns/api/users` → **Connection times out**

This is how we keep your data safe! Only your frontend app can talk to your backend.

---

## 🚀 Step-by-Step Deployment Guide

### Phase 1: Build & Push Docker Images to ECR

#### Step 1a: Build Docker Images Locally

First, create Docker images from your code:

```bash
cd backend
docker build -t rexpress-backend .

cd ../frontend
docker build -t rexpress-frontend .
```

#### Step 1b: (Optional) Test Locally

Before pushing to AWS, test locally:

```bash
# Create a network for containers
docker network create rexpress-network

# Run backend
docker run -d --name backend --network rexpress-network -p 5000:5000 rexpress-backend

# Run frontend (in separate terminal)
docker run -d --name frontend --network rexpress-network -p 80:80 rexpress-frontend

# Test:
# - Frontend: http://localhost
# - API: http://localhost:5000/api/users

# Cleanup
docker stop backend frontend
docker rm backend frontend
docker network rm rexpress-network
```

#### Step 1c: Create ECR Repositories

ECR is AWS's container registry (like Docker Hub but private).

```bash
# Create repos
aws ecr create-repository --repository-name rexpress-backend --region ap-south-1
aws ecr create-repository --repository-name rexpress-frontend --region ap-south-1
```

#### Step 1d: Push Images to ECR

```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Replace <ACCOUNT_ID> with your 12-digit AWS account ID

# Tag and push backend
docker tag rexpress-backend:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-backend:latest

# Tag and push frontend
docker tag rexpress-frontend:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest
```

---

### Phase 2: Set Up AWS Infrastructure (ECS, ALB, Security Groups)

We'll use AWS Console for this (easier to understand). If you prefer CLI, see the original guide steps.

#### Step 2a: Create ECS Cluster

1. Go to **AWS Console** → **ECS** → **Clusters**
2. Click **Create Cluster**
3. **Cluster name**: `rexpress-cluster`
4. **Infrastructure**: Select **AWS Fargate** (serverless!)
5. Click **Create**

#### Step 2b: Create CloudWatch Log Groups

```bash
aws logs create-log-group --log-group-name /ecs/rexpress-backend --region ap-south-1
aws logs create-log-group --log-group-name /ecs/rexpress-frontend --region ap-south-1
```

#### Step 2c: Create Task Definitions

**For Backend:**

1. **ECS** → **Task Definitions** → **Create new task definition**
2. Fill in:
   - **Task family**: `rexpress-backend-task`
   - **Launch type**: Fargate
   - **OS/CPU/Memory**: Linux / 0.25 vCPU / 0.5 GB
3. **Container Details**:
   - **Name**: `backend`
   - **Image**: `<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-backend:latest`
   - **Port mappings**: `5000`
   - **Log driver**: awslogs
   - **Log group**: `/ecs/rexpress-backend`
4. Click **Create**

**For Frontend** (same steps, but):
- **Task family**: `rexpress-frontend-task`
- **Container name**: `frontend`
- **Image**: `<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest`
- **Port**: `80`
- **Log group**: `/ecs/rexpress-frontend`

#### Step 2d: Create Security Groups

**Backend Security Group:**

1. **EC2** → **Security Groups** → **Create security group**
2. **Name**: `rexpress-backend-sg`
3. **VPC**: Default VPC
4. **Inbound Rules**:
   - Type: Custom TCP, Port: 5000, Source: 0.0.0.0/0 (for now, we'll restrict later)
5. Click **Create**

**Frontend Security Group:**

1. **Name**: `rexpress-frontend-sg`
2. **Inbound Rules**:
   - Type: HTTP, Port: 80, Source: 0.0.0.0/0
3. Click **Create**

#### Step 2e: Create Target Groups & Load Balancers

**Backend Target Group:**

1. **EC2** → **Target Groups** → **Create target group**
2. **Name**: `rexpress-backend-tg`
3. **Target type**: **IP addresses** (important for Fargate!)
4. **Protocol**: HTTP, **Port**: 5000
5. **Health check path**: `/health`
6. Click **Create**

**Backend Load Balancer:**

1. **EC2** → **Load Balancers** → **Create Load Balancer** → **Application Load Balancer**
2. **Name**: `rexpress-backend-alb`
3. **Scheme**: Internet-facing
4. **Subnets**: Select 2+ subnets
5. **Security group**: `rexpress-backend-sg`
6. **Listener**: HTTP on port 80 → Forward to `rexpress-backend-tg`
7. Click **Create**
8. **📝 Copy the Backend ALB DNS name** (you'll need it!)

**Frontend Target Group & ALB** (same steps, but):
- **Names**: `rexpress-frontend-tg` and `rexpress-frontend-alb`
- **Port**: 80 (both target group and listener)
- **Health check path**: `/health` (or `/`)

#### Step 2f: Create ECS Services

**Backend Service:**

1. **ECS** → **Clusters** → **rexpress-cluster** → **Create** (under Services)
2. **Compute**: Fargate
3. **Task definition**: `rexpress-backend-task`
4. **Service name**: `rexpress-backend-service`
5. **Desired count**: 1
6. **Networking**:
   - **Subnets**: Same as ALBs
   - **Security group**: `rexpress-backend-sg`
   - **Public IP**: ENABLED
7. **Load balancer**:
   - **Type**: Application Load Balancer
   - **Load balancer**: `rexpress-backend-alb`
   - **Target group**: `rexpress-backend-tg`
   - **Container**: `backend:5000`
8. Click **Create**

**Frontend Service** (same, but):
- **Task definition**: `rexpress-frontend-task`
- **Service name**: `rexpress-frontend-service`
- **Security group**: `rexpress-frontend-sg`
- **Load balancer**: `rexpress-frontend-alb`
- **Target group**: `rexpress-frontend-tg`
- **Container**: `frontend:80`

#### Step 2g: Update Frontend Config with Backend ALB DNS

Before testing, update your frontend to point to the backend ALB.

1. Open `frontend/nginx.conf`
2. Find the line with `proxy_pass` (should be in the `/api/` location block)
3. Update it to your backend ALB DNS:
   ```nginx
   proxy_pass http://<YOUR_BACKEND_ALB_DNS>;
   ```
4. Save the file
5. Rebuild and push the frontend image:
   ```bash
   cd frontend
   docker build -t rexpress-frontend .
   docker tag rexpress-frontend:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest
   docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest
   ```
6. In ECS Console, update the frontend service to force a new deployment

---

### Phase 3: Test Your Deployment

Wait 2-3 minutes for containers to start, then test:

```bash
# Test backend API
curl http://<BACKEND_ALB_DNS>/api/users
# Should return: [{"id":1,"name":"John"},...]

# Test frontend (in browser)
http://<FRONTEND_ALB_DNS>
# Should load React app
# Click Users → should display data from backend
```

**✅ If both work, congratulations!** 🎉

---

### Phase 4: 🔒 Secure Your Backend (Critical!)

Right now, your backend is publicly accessible. Anyone can call:
```
http://<BACKEND_ALB_DNS>/api/users
```

Let's change that so **only the frontend can access the backend**.

#### Step 4a: Update Backend Security Group

Find your security group IDs:

```bash
aws ec2 describe-security-groups --group-names rexpress-backend-sg --region ap-south-1 --query "SecurityGroups[0].GroupId"
# Returns: sg-0695633fc86985336

aws ec2 describe-security-groups --group-names rexpress-frontend-sg --region ap-south-1 --query "SecurityGroups[0].GroupId"
# Returns: sg-0ad1349b9e0e4555e
```

Remove public access and add frontend-only access:

```bash
# Remove public access (port 80 from 0.0.0.0/0)
aws ec2 revoke-security-group-ingress \
  --group-id sg-0695633fc86985336 \
  --protocol tcp --port 80 --cidr 0.0.0.0/0 \
  --region ap-south-1

# Add rule: Backend port 5000 from Frontend SG
aws ec2 authorize-security-group-ingress \
  --group-id sg-0695633fc86985336 \
  --protocol tcp --port 5000 \
  --source-group sg-0ad1349b9e0e4555e \
  --region ap-south-1

# Add rule: Backend port 80 from Frontend SG (for ALB health checks)
aws ec2 authorize-security-group-ingress \
  --group-id sg-0695633fc86985336 \
  --protocol tcp --port 80 \
  --source-group sg-0ad1349b9e0e4555e \
  --region ap-south-1
```

#### Step 4b: Verify Security

Test that:

✅ `http://<FRONTEND_ALB_DNS>/users` → **Works** (frontend can access backend)

❌ `http://<BACKEND_ALB_DNS>/api/users` → **Timeout** (public access blocked)

---

## 🧪 Problems We Faced & How We Fixed Them

### Problem 1: "Site Can't Be Reached" / Connection Timeout

**Symptom**: Frontend ALB DNS works locally but times out in browser.

**Root Cause**:
- Security group didn't allow inbound traffic
- ALB wasn't associated with correct subnets
- ECS tasks weren't getting public IPs

**Fix**:
- ✅ Ensured security groups had correct inbound rules (port 80/5000)
- ✅ Verified ECS service had "Public IP" ENABLED
- ✅ Checked ALB was in public subnets with Internet Gateway attached

---

### Problem 2: "Anyone Can Access Backend Directly"

**Symptom**: Direct calls to `http://backend-alb/api/users` worked (showing data).

**Why It's Bad**: Your API data is exposed to anyone on the internet!

**Fix**:
- ✅ Removed `0.0.0.0/0` rule from backend security group
- ✅ Added security group rule allowing only frontend SG traffic
- ✅ Now direct calls timeout, but frontend-to-backend still works

---

### Problem 3: Container Image Not Updating

**Symptom**: Deployed a new version but ECS still ran the old container.

**Root Cause**: ECS was pulling the old image from ECR cache.

**Fix**:
- ✅ Registered a new task definition revision
- ✅ Updated service with `--force-new-deployment` flag
- ✅ Ensured Dockerfile uses correct image references

```bash
# Force new deployment
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --force-new-deployment \
  --region ap-south-1
```

---

### Problem 4: "Frontend Can't Reach Backend API"

**Symptom**: Frontend loads but clicking "Users" shows an error or empty data.

**Root Cause**:
- `nginx.conf` had wrong backend ALB DNS
- Nginx configuration had syntax errors
- CORS or header issues

**Fix**:
- ✅ Updated `nginx.conf` with correct backend ALB DNS
- ✅ Rebuilt frontend image
- ✅ Added `X-Requested-With` header to frontend fetch requests
- ✅ Configured Nginx to detect XHR vs browser requests

**Key setting in nginx.conf**:
```nginx
location ~ ^/api/(.*)$ {
    # For XHR requests: proxy to backend
    if ($http_x_requested_with = "XMLHttpRequest") {
        proxy_pass http://<BACKEND_ALB>/api/$1;
    }
    # For browser requests: redirect to frontend route
    rewrite ^ /$1 permanent;
}
```

**Key setting in frontend fetch**:
```javascript
fetch('/api/users', {
    headers: {
        'X-Requested-With': 'XMLHttpRequest'
    }
})
```

---

### Problem 5: "Stale Frontend Bundle After Deploy"

**Symptom**: Deployed new frontend but browser still showed old UI/behavior.

**Root Cause**: Browser cache or ECS serving old image.

**Fix**:
- ✅ Added `Cache-Control: no-store` header to `index.html` in nginx
- ✅ Forced browser refresh (Ctrl+Shift+Delete)
- ✅ Verified `index.html` in nginx.conf:

```nginx
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0";
}
```

---

## 🔧 How We Debugged Issues

### Debugging Strategy Used:

1. **Check Logs First**
   ```bash
   # CloudWatch Logs
   aws logs tail /ecs/rexpress-frontend --follow --region ap-south-1
   aws logs tail /ecs/rexpress-backend --follow --region ap-south-1
   ```

2. **Inspect AWS Resources**
   ```bash
   # Check ALB health
   aws elbv2 describe-target-health --target-group-arn <TG_ARN> --region ap-south-1
   
   # Check ECS tasks
   aws ecs describe-tasks --cluster rexpress-cluster --tasks <TASK_ARN> --region ap-south-1
   
   # Check security groups
   aws ec2 describe-security-groups --group-ids sg-xxx --region ap-south-1
   ```

3. **Test Locally**
   ```bash
   # Run container locally to test before AWS
   docker run -p 80:80 rexpress-frontend
   docker run -p 5000:5000 rexpress-backend
   ```

4. **Make HTTP Requests**
   ```bash
   # PowerShell on Windows
   Invoke-WebRequest -Uri "http://<ALB_DNS>/api/users" -Headers @{"X-Requested-With"="XMLHttpRequest"}
   
   # Or curl
   curl -H "X-Requested-With: XMLHttpRequest" http://<ALB_DNS>/api/users
   ```

5. **Verify Network**
   ```bash
   # Check if security groups allow traffic
   # Check if ALB is active and healthy
   # Check if tasks have public IPs assigned
   ```

---

## 🧹 Cleanup (Stop AWS Charges!)

When you're done, delete everything in this order:

```bash
# 1. Scale down ECS services (set desired count to 0)
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --desired-count 0 \
  --region ap-south-1

aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-backend-service \
  --desired-count 0 \
  --region ap-south-1

# Wait for tasks to stop...

# 2. Delete ECS services
aws ecs delete-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --force \
  --region ap-south-1

aws ecs delete-service \
  --cluster rexpress-cluster \
  --service rexpress-backend-service \
  --force \
  --region ap-south-1

# 3. Delete load balancers (AWS Console is easier)
# EC2 → Load Balancers → Select both ALBs → Delete

# 4. Delete target groups (wait 5 minutes after ALBs)
aws elbv2 delete-target-group --target-group-arn <TG_ARN> --region ap-south-1

# 5. Delete security groups
aws ec2 delete-security-group --group-id sg-xxx --region ap-south-1

# 6. Delete ECS cluster
aws ecs delete-cluster --cluster rexpress-cluster --region ap-south-1

# 7. Delete ECR repositories
aws ecr delete-repository --repository-name rexpress-backend --force --region ap-south-1
aws ecr delete-repository --repository-name rexpress-frontend --force --region ap-south-1

# 8. Delete CloudWatch logs
aws logs delete-log-group --log-group-name /ecs/rexpress-backend --region ap-south-1
aws logs delete-log-group --log-group-name /ecs/rexpress-frontend --region ap-south-1
```

---


## 🎉 Custom Domain & HTTPS

Replace the ugly ALB DNS with a real domain:

```
Current: http://rexpress-frontend-alb-123456.ap-south-1.elb.amazonaws.com
Desired: https://myapp.com
```

#### Option 1: Using Free Domain with CNAME (⭐ Our Approach)

This approach works with free domain providers (Freenom, freedomain.one, etc.) and doesn't require Route53.

**Important**: ALB DNS cannot be added as an apex (root @) domain using CNAME. You **must use a subdomain prefix** like `www.`

**Steps**:

1. **Register a Free Domain**
   - Go to [freedomain.one](https://freedomain.one/) (or Freenom.com, etc.)
   - Register a free domain (e.g., `myapp.tk`,`myapp.publicvm.com`,`myapp.work.gd` `myapp.ml`)
   - Note down your domain name

2. **Create an SSL/TLS Certificate (AWS Certificate Manager)**
   ```bash
   # Open AWS Console → Certificate Manager → Request Certificate
   # - Certificate Type: Public
   # - Domain Names:
   #   - www.myapp.tk (⭐ must include www prefix)
   #   - myapp.tk (optional, for redirect)
   # - Validation Method: DNS (easier) or Email
   # - Click "Request"
   # 
   # For DNS validation:
   # - Copy the CNAME record provided
   # - Add it to your domain provider's DNS settings (freedomain.one)
   # - Wait for validation (usually 5-15 minutes)
   ```

3. **Update Frontend ALB to HTTPS**
   ```bash
   # AWS Console → EC2 → Load Balancers → Select Frontend ALB
   # 
   # Add HTTPS Listener:
   # - Protocol: HTTPS (port 443)
   # - Certificate: Select the cert you created in step 2
   # - Forward to: Target group (rexpress-frontend-tg)
   #
   # Modify HTTP Listener:
   # - Protocol: HTTP (port 80)
   # - Action: Redirect to HTTPS (port 443)
   ```

4. **Add CNAME Record to Your Domain**
   - Go to freedomain.one (or your domain provider)
   - Navigate to Manage Domain → DNS Settings
   - Add CNAME Record:
     ```
     Subdomain/Name: www (⭐ This is critical!)
     Type: CNAME or Alias
     TTL: 3600
     Target/Value: rexpress-frontend-alb-123456.ap-south-1.elb.amazonaws.com
     ```
   - **Why www?** Apex domain (@) cannot use CNAME records pointing to ALB DNS

5. **Wait for DNS Propagation**
   ```bash
   # Check if DNS is pointing correctly (may take up to 24 hours)
   nslookup www.myapp.tk
   # Should return: ALB IP address
   ```

6. **Test HTTPS**
   ```bash
   # Open browser: https://www.myapp.tk
   # Should work with a secure lock icon ✓
   ```

7. **(Optional) Redirect Root Domain to www**
   - If you want `https://myapp.tk` to redirect to `https://www.myapp.tk`
   - Some DNS providers offer URL redirect/forwarding
   - Or add an A record redirect in your ALB if supported

#### Option 2: Using AWS Route53 (Traditional)

If you want to use Route53 instead:

**Steps**:
- Register domain in Route53 (AWS Console → Route53 → Registered Domains)
- Create SSL/TLS certificate (AWS Certificate Manager)
- Update ALB listeners to use HTTPS (port 443)
- Add Route53 A record pointing to ALB
- Redirect HTTP → HTTPS

---

#### Summary: Which Option to Choose?

| Option | Pros | Cons |
|--------|------|------|
| **Free Domain + CNAME** | Free, simple, no AWS fees | Free domain expires yearly, limited DNS features |
| **Route53** | Professional, managed DNS, easy setup | Costs money (~$0.50/month) |

**Recommendation**: Use **Option 1 (Free Domain + CNAME)** for learning/testing! 🚀

---

## 🚀 What's Next?

### 1. **CI/CD Pipeline (GitHub Actions)**

Automate deployment when you push code:

```
Push to GitHub → GitHub Actions runs:
  1. Runs tests
  2. Builds Docker images
  3. Pushes to ECR
  4. Updates ECS service
  5. Deploys automatically
```

**Benefit**: No more manual Docker builds and pushes!

---

### 2. **Enhanced Security**

- **Private Backend ALB**: Run backend ALB in private subnets only
- **IAM Roles**: Don't use AWS access keys; use roles instead
- **Secrets Management**: Use AWS Secrets Manager for API keys/passwords
- **WAF (Web Application Firewall)**: Protect against common attacks
- **Rate Limiting**: Prevent API abuse
- **Signed Requests**: Add authentication tokens to API calls

---

### 3. **Monitoring & Alerts**

- **CloudWatch Dashboards**: Monitor CPU, memory, request count
- **Alarms**: Get notified if something goes wrong
- **Application Insights**: Track errors and performance

---

### 4. **Scaling & Performance**

- **Auto Scaling**: Automatically scale tasks when traffic increases
- **Caching**: Add Redis for faster data access
- **CDN**: Use CloudFront to cache frontend content globally
- **Database**: Move from in-memory data to persistent database (RDS)

---

## 📚 Key Files & Their Purpose

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Container recipe for Express API |
| `frontend/Dockerfile` | Container recipe for React app |
| `frontend/nginx.conf` | Nginx config for reverse proxy & caching |
| `frontend/src/pages/Users.jsx` | React component that fetches API data |

---

## ❓ Troubleshooting Checklist

| Issue | Check This |
|-------|-----------|
| Site won't load | ALB DNS correct? Security group allows port 80? ECS tasks healthy? |
| Backend not accessible | Backend ALB DNS correct in nginx.conf? Rebuilt frontend? |
| API returns error | CloudWatch logs have details. Check `/health` endpoint first. |
| Changes not showing up | Did you rebuild & push image? Force new ECS deployment? |
| Connection times out | Security group blocking traffic? Task has public IP? |

---

## 🙏 Key Takeaways

1. **Docker** = Consistency (same environment everywhere)
2. **ECR** = Private image storage
3. **ECS Fargate** = Serverless containers (no servers to manage)
4. **ALB** = Load balancer distributes traffic
5. **Security Groups** = Firewall for AWS resources
6. **Nginx** = Reverse proxy (frontend routes `/api/*` to backend)

You now have a production-ready full-stack app deployed on AWS! 🚀

---

## 📖 Resources

- [AWS ECS Docs](https://docs.aws.amazon.com/ecs/)
- [Docker Docs](https://docs.docker.com/)
- [Nginx Reverse Proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [AWS Best Practices](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html)
