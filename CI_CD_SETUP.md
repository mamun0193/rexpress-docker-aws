# 🚀 CI/CD Setup Guide for Rexpress

## ✅ What's Ready

- ✅ GitHub Actions workflow file created: `.github/workflows/deploy.yml`
- ✅ ECS Cluster: `rexpress-cluster`
- ✅ ECS Services:
  - `rexpress-frontend-service`
  - `rexpress-backend-service`
- ✅ ECR Repositories:
  - `rexpress-frontend`
  - `rexpress-backend`

---

## 🔐 Step 1: Add GitHub Secrets

Go to your GitHub repository:

```
Settings → Secrets and variables → Actions → New repository secret
```

Add these **4 secrets** (copy-paste the values):

### Secret 1: `AWS_ACCESS_KEY_ID`
- Value: Your AWS Access Key ID
- Get it from: AWS IAM Console → Your user → Security Credentials

### Secret 2: `AWS_SECRET_ACCESS_KEY`
- Value: Your AWS Secret Access Key
- Get it from: AWS IAM Console → Your user → Security Credentials

### Secret 3: `AWS_REGION`
- Value: `ap-south-1`

### Secret 4: `AWS_ACCOUNT_ID`
- Value: `007066145257`

**⚠️ IMPORTANT: Keep these secrets secure. Never commit them to the repo!**

---

## 📁 Step 2: Commit and Push

The workflow file is already created at `.github/workflows/deploy.yml`

Push it to GitHub:

```bash
git add .
git commit -m "ci: add GitHub Actions ECS deployment workflow"
git push origin main
```

---

## 🚀 Step 3: Verify Pipeline

Go to your GitHub repository:

```
Actions → Deploy rexpress to ECS
```

You should see the workflow running. It will:

1. ✅ Checkout code
2. ✅ Configure AWS credentials
3. ✅ Login to ECR
4. ✅ Build & push backend image
5. ✅ Build & push frontend image
6. ✅ Update backend ECS service
7. ✅ Update frontend ECS service
8. ✅ Wait for deployment to complete

**Expected duration: 2-5 minutes**

---

## 🔄 How It Works (Every Push)

```
git push main
   ↓
GitHub Actions triggered
   ↓
Docker builds both images
   ↓
Images pushed to ECR (latest tag)
   ↓
ECS services updated with --force-new-deployment
   ↓
Rolling deployment starts
   ↓
New containers replace old ones (zero downtime)
   ↓
Site updates automatically ✅
```

---

## 🧪 Test the Pipeline

Make a small change to the app:

```bash
# Edit a file
echo "Updated!" >> frontend/src/App.jsx

# Commit and push
git add .
git commit -m "test: trigger CI/CD"
git push origin main
```

Then watch:
- GitHub Actions runs
- ECR gets new images
- ECS service updates
- Live site refreshes

---

## ❌ Troubleshooting

### Pipeline fails at "Login to Amazon ECR"
- Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct
- Verify IAM user has `AmazonEC2ContainerRegistryFullAccess` permission

### Pipeline fails at "Build & Push Backend"
- Check Dockerfile path is correct
- Ensure backend/Dockerfile exists
- Check Docker build syntax

### Pipeline fails at "Update Backend ECS Service"
- Check AWS_REGION is correct
- Verify service name: `rexpress-backend-service`
- Ensure cluster name: `rexpress-cluster`

### ECS service updates but app doesn't change
- Wait 2-3 minutes for rolling deployment
- Check CloudWatch logs: `/ecs/rexpress-frontend`
- Force browser refresh (Ctrl+Shift+Delete)

---

## 🎯 Next Steps

### Day 8: Rollback Strategy
- Tag images with commit SHA
- Keep old images for quick rollback

### Day 9: Notifications
- Send Slack/Email on deployment success/failure
- Add GitHub PR checks before merging

### Day 10: Blue-Green Deployment
- Run 2 ECS services in parallel
- Zero-downtime deployments

---

## 📚 Reference

**Workflow File**: `.github/workflows/deploy.yml`

**ECS Services**:
- Frontend: `rexpress-frontend-service`
- Backend: `rexpress-backend-service`

**ECR Repositories**:
- Frontend: `rexpress-frontend`
- Backend: `rexpress-backend`

**AWS Region**: `ap-south-1`

**AWS Account ID**: `007066145257`
