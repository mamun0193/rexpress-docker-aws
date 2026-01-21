# 🚀 AWS Deployment Guide for Rexpress

This guide walks you through deploying Rexpress to AWS ECS with Application Load Balancers.

## Prerequisites

Before you start, ensure you have:

1. **Docker Desktop** installed and running
2. **AWS CLI** installed (`aws configure` with your credentials)
3. **An AWS Account** with permissions for ECR, ECS, EC2, CloudWatch
4. Basic terminal/command line knowledge
5. Your AWS Account ID (12-digit number)

---

## Phase 1: Build & Push Docker Images to ECR

### Step 1: Create ECR Repositories

ECR is AWS's container registry (like Docker Hub but private).

```bash
# Create repositories
aws ecr create-repository --repository-name rexpress-backend --region ap-south-1
aws ecr create-repository --repository-name rexpress-frontend --region ap-south-1
```

### Step 2: Build Docker Images

```bash
# Build backend
cd backend
docker build -t rexpress-backend .

# Build frontend
cd ../frontend
docker build -t rexpress-frontend .
```

### Step 3: Login to ECR

```bash
# Replace <ACCOUNT_ID> with your 12-digit AWS account ID
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com
```

### Step 4: Tag and Push Images

```bash
# Tag backend
docker tag rexpress-backend:latest \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-backend:latest

# Push backend
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-backend:latest

# Tag frontend
docker tag rexpress-frontend:latest \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest

# Push frontend
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest
```

---

## Phase 2: Set Up AWS Infrastructure

### Step 1: Create ECS Cluster

**Using AWS Console:**

1. Go to **AWS Console** → **ECS** → **Clusters**
2. Click **Create Cluster**
3. **Cluster name**: `rexpress-cluster`
4. **Infrastructure**: Select **AWS Fargate** (serverless)
5. Click **Create**

**Using AWS CLI:**

```bash
aws ecs create-cluster --cluster-name rexpress-cluster --region ap-south-1
```

### Step 2: Create CloudWatch Log Groups

```bash
aws logs create-log-group \
  --log-group-name /ecs/rexpress-backend \
  --region ap-south-1

aws logs create-log-group \
  --log-group-name /ecs/rexpress-frontend \
  --region ap-south-1
```

### Step 3: Create Task Definitions

#### Backend Task Definition

1. **ECS** → **Task Definitions** → **Create new task definition**
2. Fill in:
   - **Task family**: `rexpress-backend-task`
   - **Launch type**: Fargate
   - **OS/Arch**: Linux/X86_64
   - **CPU**: 0.25 vCPU
   - **Memory**: 0.5 GB
3. **Container Details**:
   - **Name**: `backend`
   - **Image**: `<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-backend:latest`
   - **Port mappings**: Container port `5000`, Protocol TCP
   - **Environment**: Leave default
   - **Logging**: 
     - Log driver: `awslogs`
     - Log group: `/ecs/rexpress-backend`
     - Region: `ap-south-1`
     - Stream prefix: `ecs`
4. Click **Create**

#### Frontend Task Definition

Same steps as backend, but:
- **Task family**: `rexpress-frontend-task`
- **Container name**: `frontend`
- **Image**: `<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest`
- **Port**: `80`
- **Log group**: `/ecs/rexpress-frontend`

### Step 4: Create Security Groups

#### Backend Security Group

1. **EC2** → **Security Groups** → **Create security group**
2. **Name**: `rexpress-backend-sg`
3. **Description**: Security group for backend containers
4. **VPC**: Default VPC
5. **Inbound Rules**:
   - Type: Custom TCP
   - Port: 5000
   - Source: 0.0.0.0/0 (we'll restrict this later)
6. Click **Create**

#### Frontend Security Group

1. **Name**: `rexpress-frontend-sg`
2. **Description**: Security group for frontend containers
3. **Inbound Rules**:
   - Type: HTTP, Port: 80, Source: 0.0.0.0/0
   - Type: HTTPS, Port: 443, Source: 0.0.0.0/0 (for SSL)
4. Click **Create**

### Step 5: Create Target Groups

#### Backend Target Group

1. **EC2** → **Target Groups** → **Create target group**
2. **Target type**: **IP addresses** (required for Fargate)
3. **Name**: `rexpress-backend-tg`
4. **Protocol**: HTTP
5. **Port**: 5000
6. **VPC**: Default VPC
7. **Health check**:
   - Path: `/health`
   - Interval: 30 seconds
   - Timeout: 5 seconds
   - Healthy threshold: 2
   - Unhealthy threshold: 2
8. Click **Next** → **Create**

#### Frontend Target Group

Same steps, but:
- **Name**: `rexpress-frontend-tg`
- **Port**: 80
- **Health check path**: `/` or `/health`

### Step 6: Create Application Load Balancers

#### Backend ALB

1. **EC2** → **Load Balancers** → **Create Load Balancer**
2. Select **Application Load Balancer**
3. **Name**: `rexpress-backend-alb`
4. **Scheme**: Internet-facing
5. **IP address type**: IPv4
6. **Network mapping**: Select 2+ availability zones
7. **Security groups**: Select `rexpress-backend-sg`
8. **Listeners**:
   - Protocol: HTTP
   - Port: 80
   - Default action: Forward to `rexpress-backend-tg`
9. Click **Create**
10. **📝 Copy the Backend ALB DNS name** - you'll need this!

#### Frontend ALB

Same steps, but:
- **Name**: `rexpress-frontend-alb`
- **Security groups**: `rexpress-frontend-sg`
- **Listener**: Forward to `rexpress-frontend-tg`

### Step 7: Update Frontend Configuration

Before creating ECS services, update the frontend to point to the backend:

1. Open `frontend/nginx.conf`
2. Find the `proxy_pass` line in the `/api/` location block
3. Update it to:
   ```nginx
   proxy_pass http://<YOUR_BACKEND_ALB_DNS>;
   ```
4. Save and rebuild the frontend image:
   ```bash
   cd frontend
   docker build -t rexpress-frontend .
   docker tag rexpress-frontend:latest \
     <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest
   docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rexpress-frontend:latest
   ```

### Step 8: Create ECS Services

#### Backend Service

1. **ECS** → **Clusters** → **rexpress-cluster** → **Create** (under Services)
2. **Compute configuration**: Launch type
3. **Launch type**: FARGATE
4. **Platform version**: LATEST
5. **Application type**: Service
6. **Task definition**: 
   - Family: `rexpress-backend-task`
   - Revision: LATEST
7. **Service name**: `rexpress-backend-service`
8. **Desired tasks**: 1
9. **Networking**:
   - **VPC**: Default VPC
   - **Subnets**: Select 2+ subnets
   - **Security group**: Use existing → `rexpress-backend-sg`
   - **Public IP**: ENABLED
10. **Load balancing**:
    - **Load balancer type**: Application Load Balancer
    - **Load balancer**: `rexpress-backend-alb`
    - **Listener**: Use existing listener (port 80)
    - **Target group**: Use existing → `rexpress-backend-tg`
    - **Container to load balance**: `backend:5000`
11. Click **Create**

#### Frontend Service

Same steps, but:
- **Task definition**: `rexpress-frontend-task`
- **Service name**: `rexpress-frontend-service`
- **Security group**: `rexpress-frontend-sg`
- **Load balancer**: `rexpress-frontend-alb`
- **Target group**: `rexpress-frontend-tg`
- **Container**: `frontend:80`

---

## Phase 3: Test Your Deployment

### Wait for Services to Start

It takes 2-3 minutes for ECS tasks to start and pass health checks.

**Check Task Status:**
1. **ECS** → **Clusters** → **rexpress-cluster** → **Services**
2. Click on each service
3. **Tasks** tab → Status should be "RUNNING"

### Test Backend API

```bash
# Replace with your backend ALB DNS
curl http://<BACKEND_ALB_DNS>/api/users

# Expected response:
# [{"id":1,"name":"John Doe"},{"id":2,"name":"Jane Smith"}]
```

### Test Frontend

Open your browser and go to:
```
http://<FRONTEND_ALB_DNS>
```

You should see:
- ✅ React app loads
- ✅ Home page displays
- ✅ Users page fetches and displays data from backend

---

## Phase 4: Secure Your Backend

Currently, anyone can access your backend directly. Let's fix that.

### Step 1: Find Security Group IDs

```bash
# Backend security group ID
aws ec2 describe-security-groups \
  --group-names rexpress-backend-sg \
  --region ap-south-1 \
  --query "SecurityGroups[0].GroupId" \
  --output text

# Frontend security group ID
aws ec2 describe-security-groups \
  --group-names rexpress-frontend-sg \
  --region ap-south-1 \
  --query "SecurityGroups[0].GroupId" \
  --output text
```

### Step 2: Update Backend Security Group Rules

```bash
# Remove public access from backend (replace sg-xxx with your backend SG ID)
aws ec2 revoke-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp --port 5000 --cidr 0.0.0.0/0 \
  --region ap-south-1

# Allow backend port 5000 from frontend SG only
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp --port 5000 \
  --source-group sg-yyy \
  --region ap-south-1

# Allow backend port 80 from frontend SG (for ALB health checks)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp --port 80 \
  --source-group sg-yyy \
  --region ap-south-1
```

### Step 3: Verify Security

**Test that public access is blocked:**
```bash
curl http://<BACKEND_ALB_DNS>/api/users
# Should timeout (connection refused)
```

**Test that frontend still works:**
```
http://<FRONTEND_ALB_DNS>/users
# Should still load and display data
```

---

## Phase 5: Set Up Custom Domain & HTTPS (Optional)

### Option 1: Free Domain with CNAME

1. **Register a free domain** at [freedomain.one](https://freedomain.one/) or Freenom
2. **Request SSL certificate** in AWS Certificate Manager:
   - Domain: `www.yourdomain.com`
   - Validation: DNS (add CNAME to your domain provider)
3. **Add HTTPS listener** to Frontend ALB:
   - Protocol: HTTPS (port 443)
   - Certificate: Select your certificate
   - Forward to: `rexpress-frontend-tg`
4. **Update HTTP listener** to redirect:
   - Action: Redirect to HTTPS (port 443)
5. **Add CNAME record** to your domain:
   - Name: `www`
   - Type: CNAME
   - Value: `<FRONTEND_ALB_DNS>`
6. **Update frontend security group**:
   - Add rule: HTTPS, Port 443, Source 0.0.0.0/0

### Option 2: AWS Route53

1. Register domain in Route53
2. Create hosted zone
3. Request certificate in ACM
4. Add A record (alias) pointing to ALB
5. Configure HTTPS listener on ALB

---

## Updating Your Application

### Force New Deployment

When you push new images to ECR:

```bash
# Update backend service
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-backend-service \
  --force-new-deployment \
  --region ap-south-1

# Update frontend service
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --force-new-deployment \
  --region ap-south-1
```

### Rolling Deployment

ECS will:
1. Start new tasks with new image
2. Wait for them to pass health checks
3. Stop old tasks
4. Zero downtime deployment! 🎉

---

## Monitoring Your Deployment

### CloudWatch Logs

```bash
# View backend logs
aws logs tail /ecs/rexpress-backend --follow --region ap-south-1

# View frontend logs
aws logs tail /ecs/rexpress-frontend --follow --region ap-south-1
```

### Check ALB Health

```bash
# Get target health
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN> \
  --region ap-south-1
```

### Check ECS Task Status

```bash
# List tasks
aws ecs list-tasks \
  --cluster rexpress-cluster \
  --service-name rexpress-backend-service \
  --region ap-south-1

# Describe task
aws ecs describe-tasks \
  --cluster rexpress-cluster \
  --tasks <TASK_ARN> \
  --region ap-south-1
```

---

## Cleanup (Stop AWS Charges)

When you're done testing, delete resources in this order:

```bash
# 1. Scale down services to 0
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --desired-count 0 --region ap-south-1

aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-backend-service \
  --desired-count 0 --region ap-south-1

# 2. Delete services (after tasks stop)
aws ecs delete-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --force --region ap-south-1

aws ecs delete-service \
  --cluster rexpress-cluster \
  --service rexpress-backend-service \
  --force --region ap-south-1

# 3. Delete load balancers (use AWS Console - easier)
# EC2 → Load Balancers → Select both → Delete

# 4. Delete target groups (wait 5 min after ALBs deleted)
# EC2 → Target Groups → Select both → Delete

# 5. Delete security groups
# EC2 → Security Groups → Select both → Delete

# 6. Delete ECS cluster
aws ecs delete-cluster \
  --cluster rexpress-cluster \
  --region ap-south-1

# 7. Delete ECR repositories
aws ecr delete-repository \
  --repository-name rexpress-backend \
  --force --region ap-south-1

aws ecr delete-repository \
  --repository-name rexpress-frontend \
  --force --region ap-south-1

# 8. Delete CloudWatch log groups
aws logs delete-log-group \
  --log-group-name /ecs/rexpress-backend \
  --region ap-south-1

aws logs delete-log-group \
  --log-group-name /ecs/rexpress-frontend \
  --region ap-south-1
```

---

## Next Steps

- **Set up CI/CD**: See [CI_CD_GUIDE.md](CI_CD_GUIDE.md)
- **Learn about architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Troubleshoot issues**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
