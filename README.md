# 🚀 Rexpress - Production-Ready Full-Stack AWS Deployment

> A simple React + Express application deployed on AWS ECS with automated CI/CD, demonstrating production-grade cloud infrastructure and security practices.

[![AWS ECS](https://img.shields.io/badge/AWS-ECS_Fargate-orange)](https://aws.amazon.com/ecs/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue)](https://www.docker.com/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-green)](https://github.com/features/actions)

## 🎯 What is Rexpress?

A full-stack web application showcasing production-grade cloud deployment on AWS. Features:

- **Frontend**: React SPA with Vite + Nginx reverse proxy
- **Backend**: Express.js REST API with health checks
- **Infrastructure**: AWS ECS Fargate (serverless containers)
- **Security**: Network isolation with Security Groups
- **Caching**: Redis 7 (Local Docker & AWS ElastiCache)
- **CI/CD**: Automated deployments via GitHub Actions
- **Monitoring**: CloudWatch logging & health checks

## 📁 Project Structure

```bash
rexpress/
├── backend/              # Express.js API
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── frontend/             # React application
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
├── docs/                 # Detailed documentation
│   ├── DOCKER_GUIDE.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── ARCHITECTURE.md
│   ├── REDIS_INTEGRATION.md
│   ├── TROUBLESHOOTING.md
│   └── CI_CD_GUIDE.md
└── .github/workflows/deploy.yml
```

## 🏗️ Architecture Overview

```bash
Internet Users → Frontend ALB → Frontend Container (React + Nginx)
                                    ↓ /api/* requests
                              Backend ALB (Secured) → Backend Container (Express)
                                                            ↓ Cache/DB lookups
                              ElastiCache Redis (Private VPC)
```

**Security**:

- Backend is network-isolated—only the frontend can access it via AWS Security Groups.
- Redis is in private subnets—only backend ECS tasks can access it.

## 🚀 Quick Start

### Local Development

```bash
# Backend (Node.js)
cd backend && npm install && npm start  # http://localhost:5000

# Frontend (React)
cd frontend && npm install && npm run dev  # http://localhost:5173
```

### Docker Compose (with Redis)

```bash
# Start all services (frontend, backend, redis)
docker-compose up -d

# Test: http://localhost (frontend)
# API: curl http://localhost:5000/api/products
# Logs: docker-compose logs -f backend
```

### Docker Local Testing

```bash
docker build -t rexpress-backend ./backend
docker build -t rexpress-frontend ./frontend

docker network create rexpress-network
docker run -d --name redis --network rexpress-network -p 6379:6379 redis:7-alpine
docker run -d --name backend --network rexpress-network -p 5000:5000 -e REDIS_ENABLED=true -e REDIS_HOST=redis rexpress-backend
docker run -d --name frontend --network rexpress-network -p 80:80 rexpress-frontend

# Test: http://localhost (frontend), http://localhost:5000/api/products (backend)
# First call: source = "db", Second call: source = "cache"
```

## ☁️ AWS Deployment Overview

**High-level steps**:

1. Build Docker images & push to AWS ECR
2. Create ECS cluster with Fargate
3. Set up Application Load Balancers (frontend + backend)
4. Configure Security Groups for network isolation
5. Deploy ECS services with rolling updates
6. Secure backend by restricting access to frontend only

**Estimated setup time**: 30-45 minutes  
**Monthly cost**: ~$48 (ECS: $10, ALBs: $35, ECR/CloudWatch: $3)

For complete step-by-step instructions, see [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md).

## 🔄 CI/CD Pipeline

Every push to `main` triggers automated deployment:

- ✅ Builds Docker images
- ✅ Pushes to AWS ECR
- ✅ Updates ECS services
- ✅ Rolling deployment (zero downtime)

**Time**: 2-5 minutes from push to production

**Setup**: Add GitHub Secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_ACCOUNT_ID)

See [docs/CI_CD_GUIDE.md](docs/CI_CD_GUIDE.md) for complete setup.

## 🔐 Security Features

- **Network Isolation**: Backend only accessible from frontend
- **HTTPS Support**: SSL/TLS certificates via AWS ACM
- **Health Checks**: Automatic failure detection & recovery
- **CloudWatch Logs**: Centralized logging
- **Security Groups**: Network-level firewall rules

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| [DOCKER_GUIDE.md](docs/DOCKER_GUIDE.md) | Docker setup, building images, local testing |
| [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Complete AWS deployment walkthrough |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, security model, decisions |
| [REDIS_INTEGRATION.md](docs/REDIS_INTEGRATION.md) | Redis caching: local Docker & AWS ElastiCache |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues & debugging |
| [CI_CD_GUIDE.md](docs/CI_CD_GUIDE.md) | GitHub Actions setup & improvements |

## 🛠️ Technology Stack

**Frontend**: React 18, Vite, Nginx  
**Backend**: Node.js 18, Express.js  
**Caching**: Redis 7 (Local Docker & AWS ElastiCache)  
**Infrastructure**: AWS ECS Fargate, ECR, ALB, ElastiCache, CloudWatch  
**DevOps**: Docker, Docker Compose, GitHub Actions, AWS CLI

## ❓ Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection timeout | Check security group rules, ECS task public IP |
| Backend unreachable | Verify nginx.conf has correct backend ALB DNS |
| Stale content | Clear browser cache (Ctrl+F5) or check cache-control headers |
| Container won't start | Check CloudWatch logs: `aws logs tail /ecs/rexpress-backend --follow` |

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for comprehensive troubleshooting.

## 🧹 Cleanup (Stop AWS Charges)

```bash
# Scale services to 0
aws ecs update-service --cluster rexpress-cluster --service rexpress-frontend-service --desired-count 0 --region ap-south-1
aws ecs update-service --cluster rexpress-cluster --service rexpress-backend-service --desired-count 0 --region ap-south-1

# Delete services, load balancers, security groups, ECS cluster, ECR repos
```

See [docs/DEPLOYMENT_GUIDE.md#cleanup](docs/DEPLOYMENT_GUIDE.md#cleanup-stop-aws-charges) for complete cleanup.

## 🎓 What You'll Learn

- Building production containerized applications
- Deploying to AWS cloud infrastructure
- Network-level security & isolation
- Automated CI/CD pipelines
- Centralized logging & monitoring
- Zero-downtime deployments

## 🔮 Future Enhancements

- [x] Redis caching layer (Local Docker & AWS ElastiCache)
- [ ] Database integration (RDS)
- [ ] JWT authentication
- [ ] Infrastructure as Code (Terraform)
- [ ] Auto-scaling policies
- [ ] WAF for DDoS protection
- [ ] Multi-region deployment
- [ ] Redis Cluster mode for high availability

## 📖 Resources

- [AWS ECS Docs](https://docs.aws.amazon.com/ecs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Twelve-Factor App](https://12factor.net/)

---

**Ready to deploy?** Start with [docs/DOCKER_GUIDE.md](docs/DOCKER_GUIDE.md) or jump to [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)!

**The Problem**: "It works on my machine" syndrome