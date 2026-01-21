# 🔄 CI/CD Guide for Rexpress

Automated deployment pipeline using GitHub Actions to deploy to AWS ECS.

---

## Overview

Every time you push code to the `main` branch, GitHub Actions automatically:
1. ✅ Builds Docker images for backend and frontend
2. ✅ Pushes images to AWS ECR
3. ✅ Updates ECS services with new images
4. ✅ Performs rolling deployment (zero downtime)

**Time**: 2-5 minutes from push to production

---

## Prerequisites

Before setting up CI/CD, ensure you have:

1. ✅ ECS Cluster: `rexpress-cluster`
2. ✅ ECS Services:
   - `rexpress-frontend-service`
   - `rexpress-backend-service`
3. ✅ ECR Repositories:
   - `rexpress-frontend`
   - `rexpress-backend`
4. ✅ GitHub repository with code

---

## Step 1: Create IAM User for GitHub Actions

GitHub Actions needs AWS credentials to deploy.

### 1a: Create IAM User

```bash
# Using AWS Console:
1. Go to IAM → Users → Add users
2. User name: github-cicd
3. Select "Programmatic access"
4. Click Next
```

### 1b: Attach Policies

Attach these managed policies:
- `AmazonECS_FullAccess` - For ECS deployments
- `AmazonEC2ContainerRegistryFullAccess` - For pushing images to ECR

### 1c: Create Access Keys

1. After creating user, go to **Security credentials** tab
2. Click **Create access key**
3. Select **Application running outside AWS**
4. **Save these values** (you'll need them in Step 2):
   - Access key ID
   - Secret access key

---

## Step 2: Add GitHub Secrets

Go to your GitHub repository:

```
Settings → Secrets and variables → Actions → New repository secret
```

Add these **4 secrets**:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `AWS_ACCESS_KEY_ID` | Your AWS Access Key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | Your AWS region | `ap-south-1` |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID | `007066145257` |

⚠️ **IMPORTANT**: Keep these secrets secure. Never commit them to the repository!

---

## Step 3: Create Workflow File

The workflow file is already created at `.github/workflows/deploy.yml`:

```yaml
name: Deploy rexpress to ECS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ secrets.AWS_REGION }}
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build & Push Backend
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: rexpress-backend
        IMAGE_TAG: latest
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG ./backend
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    
    - name: Build & Push Frontend
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: rexpress-frontend
        IMAGE_TAG: latest
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG ./frontend
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    
    - name: Update Backend ECS Service
      run: |
        aws ecs update-service \
          --cluster rexpress-cluster \
          --service rexpress-backend-service \
          --force-new-deployment \
          --region ${{ secrets.AWS_REGION }}
    
    - name: Update Frontend ECS Service
      run: |
        aws ecs update-service \
          --cluster rexpress-cluster \
          --service rexpress-frontend-service \
          --force-new-deployment \
          --region ${{ secrets.AWS_REGION }}
```

---

## Step 4: Trigger Your First Deployment

### Push to Main Branch

```bash
git add .
git commit -m "ci: add GitHub Actions ECS deployment workflow"
git push origin main
```

### Monitor Deployment

1. Go to your GitHub repository
2. Click **Actions** tab
3. You'll see "Deploy rexpress to ECS" workflow running
4. Click on it to see live logs

### Expected Steps

1. ✅ Checkout code (5 seconds)
2. ✅ Configure AWS credentials (5 seconds)
3. ✅ Login to ECR (10 seconds)
4. ✅ Build & push backend image (1-2 minutes)
5. ✅ Build & push frontend image (1-2 minutes)
6. ✅ Update backend ECS service (5 seconds)
7. ✅ Update frontend ECS service (5 seconds)
8. ✅ ECS rolling deployment (1-2 minutes)

**Total time**: ~2-5 minutes

---

## How It Works

### Workflow Trigger

```yaml
on:
  push:
    branches: [ main ]
```

Pipeline runs on every push to `main` branch.

### Docker Build & Push

```yaml
- name: Build & Push Backend
  run: |
    docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:latest ./backend
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
```

Builds Docker image and pushes to ECR with `latest` tag.

### ECS Update

```yaml
- name: Update Backend ECS Service
  run: |
    aws ecs update-service \
      --cluster rexpress-cluster \
      --service rexpress-backend-service \
      --force-new-deployment
```

Forces ECS to pull the new `latest` image and perform rolling deployment.

### Rolling Deployment

ECS automatically:
1. Starts new tasks with new image
2. Waits for health checks to pass
3. Routes traffic to new tasks
4. Drains old tasks
5. Stops old tasks
6. **Result**: Zero downtime deployment! 🎉

---

## Testing the Pipeline

### Make a Small Change

```bash
# Edit a file
echo "// Updated!" >> frontend/src/App.jsx

# Commit and push
git add .
git commit -m "test: trigger CI/CD pipeline"
git push origin main
```

### Watch the Magic

1. **GitHub**: Actions tab shows workflow running
2. **AWS ECR**: New images appear with `latest` tag
3. **AWS ECS**: Services show "Deployment in progress"
4. **CloudWatch**: Logs show new containers starting
5. **Browser**: Refresh site after 2-3 minutes to see changes

---

## Monitoring Deployments

### GitHub Actions

View live logs:
```
Repository → Actions → Deploy rexpress to ECS → Click on run
```

### AWS ECS Console

Check deployment status:
```
ECS → Clusters → rexpress-cluster → Services → Events tab
```

### CloudWatch Logs

View container logs:
```bash
aws logs tail /ecs/rexpress-frontend --follow --region ap-south-1
aws logs tail /ecs/rexpress-backend --follow --region ap-south-1
```

### Check Live Site

After deployment completes:
```
http://<FRONTEND_ALB_DNS>
```

Force refresh (Ctrl+F5) to clear browser cache.

---

## Troubleshooting

### Pipeline Fails at "Login to Amazon ECR"

**Error**: `Unable to locate credentials`

**Solution**: 
- Check GitHub Secrets are set correctly
- Verify IAM user has ECR permissions

### Pipeline Fails at "Build & Push Backend"

**Error**: `docker: command not found` or build error

**Solution**:
- Check Dockerfile exists at `./backend/Dockerfile`
- Check Dockerfile syntax is valid
- Test build locally: `docker build -t test ./backend`

### Pipeline Fails at "Update Backend ECS Service"

**Error**: `Service not found` or `Cluster not found`

**Solution**:
- Verify cluster name is exactly: `rexpress-cluster`
- Verify service names match exactly:
  - `rexpress-backend-service`
  - `rexpress-frontend-service`
- Check AWS region matches: `ap-south-1`

### ECS Service Updates but App Doesn't Change

**Possible causes:**
- Browser cache (force refresh with Ctrl+F5)
- Rolling deployment still in progress (wait 2-3 minutes)
- Health checks failing (check CloudWatch logs)

**Solution**:
```bash
# Check deployment status
aws ecs describe-services \
  --cluster rexpress-cluster \
  --services rexpress-frontend-service \
  --region ap-south-1

# Check task status
aws ecs list-tasks \
  --cluster rexpress-cluster \
  --service-name rexpress-frontend-service \
  --region ap-south-1
```

### Pipeline Hangs on Deployment

**Check ECS service events:**
```
ECS → Clusters → rexpress-cluster → Services → Events
```

Common issues:
- Failed to pull image from ECR
- Health checks failing
- Insufficient capacity

---

## CI/CD Improvements

### 1. Image Tagging with Commit SHA

Instead of always using `latest`, tag with commit SHA for traceability:

```yaml
- name: Build & Push Backend
  env:
    IMAGE_TAG: ${{ github.sha }}
  run: |
    docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG ./backend
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
```

Benefits:
- Easy rollback to specific version
- Clear audit trail
- Can deploy any commit

### 2. Pre-Deploy Smoke Tests

Test images before deploying to ECS:

```yaml
- name: Smoke Test Backend
  run: |
    docker run -d --name test-backend -p 5000:5000 $ECR_REGISTRY/rexpress-backend:$IMAGE_TAG
    sleep 5
    curl -f http://localhost:5000/health || exit 1
    docker rm -f test-backend
```

### 3. Deployment Notifications

Send notifications to Slack or email:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment to ECS completed'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 4. Environment-Based Deployments

Deploy to staging first, then production:

```yaml
on:
  push:
    branches:
      - main  # Deploy to production
      - develop  # Deploy to staging
```

### 5. Manual Approval for Production

Require manual approval before production deployment:

```yaml
jobs:
  deploy:
    environment:
      name: production
      url: http://<FRONTEND_ALB_DNS>
```

Then in GitHub:
```
Settings → Environments → production → Required reviewers
```

---

## Security Best Practices

### Use GitHub OIDC Instead of Access Keys

More secure than long-lived credentials:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v2
  with:
    role-to-assume: arn:aws:iam::ACCOUNT_ID:role/GitHubActionsRole
    aws-region: ap-south-1
```

### Limit IAM Permissions

Instead of full access, use least-privilege:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices"
      ],
      "Resource": [
        "arn:aws:ecs:ap-south-1:ACCOUNT_ID:service/rexpress-cluster/*"
      ]
    }
  ]
}
```

### Scan Images for Vulnerabilities

Add vulnerability scanning:

```yaml
- name: Scan Image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    severity: 'CRITICAL,HIGH'
```

---

## Performance Optimization

### Docker Build Cache

Speed up builds using cache:

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2

- name: Build & Push Backend
  uses: docker/build-push-action@v4
  with:
    context: ./backend
    push: true
    tags: $ECR_REGISTRY/rexpress-backend:$IMAGE_TAG
    cache-from: type=registry,ref=$ECR_REGISTRY/rexpress-backend:cache
    cache-to: type=registry,ref=$ECR_REGISTRY/rexpress-backend:cache,mode=max
```

### Parallel Builds

Build backend and frontend in parallel:

```yaml
jobs:
  build-backend:
    runs-on: ubuntu-latest
    steps: [...]
  
  build-frontend:
    runs-on: ubuntu-latest
    steps: [...]
  
  deploy:
    needs: [build-backend, build-frontend]
    runs-on: ubuntu-latest
    steps: [...]
```

---

## Rollback Strategy

### Quick Rollback to Previous Version

If deployment fails, quickly rollback:

```bash
# List previous task definitions
aws ecs list-task-definitions \
  --family-prefix rexpress-frontend-task \
  --region ap-south-1

# Update service to previous revision
aws ecs update-service \
  --cluster rexpress-cluster \
  --service rexpress-frontend-service \
  --task-definition rexpress-frontend-task:5 \
  --region ap-south-1
```

### Automated Rollback

Add health check step:

```yaml
- name: Check Deployment Health
  run: |
    sleep 60  # Wait for deployment
    curl -f http://<FRONTEND_ALB_DNS>/health || exit 1

- name: Rollback on Failure
  if: failure()
  run: |
    aws ecs update-service \
      --cluster rexpress-cluster \
      --service rexpress-frontend-service \
      --task-definition rexpress-frontend-task:${{ env.PREVIOUS_REVISION }} \
      --region ap-south-1
```

---

## Next Steps

- **Blue-Green Deployment**: See AWS CodeDeploy integration
- **Canary Deployments**: Gradually roll out to subset of users
- **Multi-Region**: Deploy to multiple AWS regions
- **Infrastructure as Code**: Convert to Terraform/CloudFormation

---

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS ECS Deployment](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [CI/CD Best Practices](https://aws.amazon.com/devops/continuous-delivery/)
