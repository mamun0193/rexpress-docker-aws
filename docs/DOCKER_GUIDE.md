# 🐳 Docker Guide for Rexpress

## What is Docker? (A Quick Intro)

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

---

## Building Docker Images Locally

### Build Backend

```bash
cd backend
docker build -t rexpress-backend .
```

### Build Frontend

```bash
cd ../frontend
docker build -t rexpress-frontend .
```

---

## Testing Locally with Docker

Before pushing to AWS, test locally to ensure everything works:

### Step 1: Create a Docker Network

```bash
docker network create rexpress-network
```

### Step 2: Run Backend Container

```bash
docker run -d \
  --name backend \
  --network rexpress-network \
  -p 5000:5000 \
  rexpress-backend
```

### Step 3: Run Frontend Container

```bash
docker run -d \
  --name frontend \
  --network rexpress-network \
  -p 80:80 \
  rexpress-frontend
```

### Step 4: Test the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:5000/api/users
- **Health Check**: http://localhost:5000/health

### Step 5: View Logs

```bash
# Backend logs
docker logs backend

# Frontend logs
docker logs frontend

# Follow logs in real-time
docker logs -f backend
```

### Step 6: Cleanup

```bash
# Stop containers
docker stop backend frontend

# Remove containers
docker rm backend frontend

# Remove network
docker network rm rexpress-network
```

---

## Understanding Dockerfiles

### Backend Dockerfile Structure

```dockerfile
# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Start command
CMD ["node", "src/server.js"]
```

### Frontend Dockerfile Structure

```dockerfile
# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Docker Best Practices

### 1. Use Multi-Stage Builds

Frontend uses multi-stage builds to:
- Keep final image size small (only production artifacts)
- Separate build dependencies from runtime dependencies

### 2. Use .dockerignore

Create a `.dockerignore` file to exclude unnecessary files:

```
node_modules
npm-debug.log
.git
.env
.DS_Store
```

### 3. Order Layers Efficiently

- Put least-changing commands first (COPY package.json)
- Put most-changing commands last (COPY source code)
- This optimizes Docker's layer caching

### 4. Use Specific Tags

Instead of `node:latest`, use `node:18-alpine` for:
- Predictable builds
- Smaller image sizes (alpine is minimal)

### 5. Run as Non-Root User

Add security by running as non-root:

```dockerfile
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs
```

---

## Common Docker Commands

### Image Management

```bash
# List images
docker images

# Remove image
docker rmi rexpress-backend

# Remove unused images
docker image prune
```

### Container Management

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Stop container
docker stop <container-id>

# Start container
docker start <container-id>

# Remove container
docker rm <container-id>

# Remove all stopped containers
docker container prune
```

### Debugging

```bash
# Execute command in running container
docker exec -it backend sh

# Inspect container
docker inspect backend

# View container resource usage
docker stats

# View container processes
docker top backend
```

---

## Troubleshooting Docker Issues

### Issue: Image Build Fails

**Solution**: Check Dockerfile syntax and paths

```bash
# Build with verbose output
docker build -t rexpress-backend . --progress=plain
```

### Issue: Container Exits Immediately

**Solution**: Check container logs

```bash
docker logs backend
```

Common causes:
- Application error in startup
- Missing environment variables
- Port already in use

### Issue: Cannot Connect to Container

**Solution**: Verify port mappings

```bash
# Check if port is exposed
docker port backend

# Check container network
docker network inspect rexpress-network
```

### Issue: Container Cannot Reach Another Container

**Solution**: Ensure both containers are on the same network

```bash
# List container networks
docker inspect backend --format='{{json .NetworkSettings.Networks}}'
```

---

## Next Steps

- **Deploy to AWS**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Set up CI/CD**: See [CI_CD_GUIDE.md](CI_CD_GUIDE.md)
- **Production Best Practices**: See [ARCHITECTURE.md](ARCHITECTURE.md)
