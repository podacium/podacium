# ADR-007: Infrastructure Configuration & Secrets Management

## Status
Accepted

## Context
The platform requires multiple external services, secrets, and infrastructure components to run. This ADR documents every configuration dependency so that any engineer can set up the full stack from scratch without tribal knowledge.

---

## 1. Environment Variables (Backend)

All backend secrets live in `services/api/.env` (never committed). Generate with `scripts/rotate-secrets.sh` or create manually.

### Required for Local Development

| Variable | Purpose | How to Generate |
|----------|---------|-----------------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://podacium:localdev_only@localhost:5432/podacium` |
| `JWT_SECRET_KEY` | Signs JWT tokens | `openssl rand -hex 64` |
| `SECRET_KEY` | General app secret | `openssl rand -hex 32` |
| `OAUTH_STATE_SECRET` | CSRF protection for OAuth | `openssl rand -hex 32` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379/0` |
| `CELERY_BROKER_URL` | Celery task queue | `redis://localhost:6379/1` |
| `CELERY_RESULT_BACKEND` | Celery results | `redis://localhost:6379/1` |
| `FRONTEND_URL` | Frontend origin for CORS/redirects | `http://localhost:3001` |
| `CORS_ORIGINS` | Allowed CORS origins (JSON array) | `["http://localhost:3000","http://localhost:3001"]` |
| `ENVIRONMENT` | Runtime environment | `development` |

### Required for Production (additional)

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `GOOGLE_CLIENT_ID` | Google OAuth | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Same as above |
| `GITHUB_CLIENT_ID` | GitHub OAuth | [GitHub Developer Settings](https://github.com/settings/developers) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth | Same as above |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth | [LinkedIn Developers](https://www.linkedin.com/developers) |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth | Same as above |
| `CHARGILY_API_KEY` | Payment gateway | [Chargily Dashboard](https://pay.chargily.com) → Developers Corner |
| `CHARGILY_SECRET_KEY` | Payment gateway | Same as above |
| `CHARGILY_WEBHOOK_SECRET` | Webhook HMAC verification (set to same value as `CHARGILY_SECRET_KEY`) | Same as above |
| `SMTP_HOST` | Email delivery | Your SMTP provider |
| `SMTP_PORT` | Email delivery | Usually 587 (TLS) |
| `SMTP_USER` | Email delivery | Your SMTP credentials |
| `SMTP_PASSWORD` | Email delivery | Your SMTP credentials |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone verification | [Meta Business Suite](https://business.facebook.com) |
| `WHATSAPP_ACCESS_TOKEN` | Phone verification | Same as above |
| `SENTRY_DSN` | Error monitoring | [Sentry.io](https://sentry.io) → Project Settings → Client Keys |
| `AWS_ACCESS_KEY_ID` | S3/CloudFront/MediaConvert | AWS IAM Console |
| `AWS_SECRET_ACCESS_KEY` | AWS services | AWS IAM Console |
| `AWS_S3_VIDEO_BUCKET` | Video storage | Create in S3 Console |
| `CLOUDFRONT_DOMAIN` | CDN for videos | CloudFront Console |
| `CLOUDFRONT_KEY_PAIR_ID` | Signed URLs | CloudFront Key Groups |
| `CLOUDFRONT_PRIVATE_KEY_PATH` | Signed URLs | Generate keypair, store on VPS |
| `MEDIACONVERT_ROLE_ARN` | Video transcoding | IAM Role ARN |
| `MEDIACONVERT_ENDPOINT` | Video transcoding | MediaConvert Console → Account |
| `COOKIE_DOMAIN` | Cookie scope | `.podacium.com` (production) |

### Required for Frontend (`apps/web/.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (`https://backend-api.podacium.com`) |
| `NEXT_PUBLIC_BASE_URL` | Frontend base URL (`https://podacium.com`) |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend error tracking (Sentry) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (file storage) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

---

## 2. Docker Configuration

### Local Development

```bash
# Start infrastructure only (Postgres + Redis)
docker compose up -d postgres redis

# Or start everything
docker compose up -d
```

Services:
- `postgres` — PostgreSQL 16 on port 5432
- `redis` — Redis 7 on port 6379
- `api` — FastAPI on port 8000
- `celery-worker` — Background task processor
- `celery-beat` — Scheduled task scheduler

### Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Differences from dev:
- No ports exposed to host (only internal Docker network)
- Resource limits (memory/CPU) enforced
- Redis has `maxmemory 256mb` with LRU eviction
- Higher Celery concurrency (4 workers)
- API bound to `127.0.0.1:8000` (Nginx proxies)

---

## 3. Nginx Configuration

File: `infra/nginx/podacium.conf`

### Prerequisites
1. Install Nginx: `apt install nginx`
2. Install Certbot: `apt install certbot python3-certbot-nginx`
3. Obtain SSL certificate: `certbot --nginx -d podacium.com -d www.podacium.com -d backend-api.podacium.com`
4. Add rate limit zone to `/etc/nginx/nginx.conf` inside `http {}`:
   ```
   limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
   ```
5. Copy config: `cp infra/nginx/podacium.conf /etc/nginx/sites-available/podacium`
6. Enable: `ln -s /etc/nginx/sites-available/podacium /etc/nginx/sites-enabled/`
7. Test: `nginx -t`
8. Reload: `systemctl reload nginx`

---

## 4. Database Setup

### Initial Setup
```bash
# Generate Prisma client
cd services/api
prisma generate --schema=prisma/schema.prisma

# Run all migrations
prisma migrate deploy --schema=prisma/schema.prisma
```

### Migrations include:
- `20251113` — Change module ID to string
- `20251206` — Add freelancing performance indexes
- `20251226` — Baseline schema
- `20260512` — Add video storage fields
- `20260530` — Add financial CHECK constraints
- `20260530` — Add support ticket model

---

## 5. AWS Infrastructure (Terraform)

File: `infra/terraform/main.tf`

### Bootstrap (one-time)
```bash
# Create state storage
aws s3 mb s3://podacium-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket podacium-terraform-state --versioning-configuration Status=Enabled

# Create lock table
aws dynamodb create-table \
  --table-name podacium-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Provision
```bash
cd infra/terraform
terraform init
terraform plan -var="db_password=$(openssl rand -hex 16)" -var="environment=staging"
terraform apply -var="db_password=$(openssl rand -hex 16)" -var="environment=staging"
```

### Resources Created
- VPC with public/private subnets (2 AZs)
- RDS PostgreSQL 16 (encrypted, performance insights)
- ElastiCache Redis (encrypted in transit + at rest)
- ECS Cluster (container insights enabled)
- ALB (application load balancer)
- S3 buckets (videos, content)
- Security groups (least-privilege)

### Estimated Cost
- Staging: ~$50-80/month (t3.micro instances, single NAT)
- Production: ~$200-400/month (t3.medium, multi-AZ, failover)

---

## 6. Monitoring Setup

### Sentry
1. Create project at [sentry.io](https://sentry.io)
2. Get DSN from Project Settings → Client Keys
3. Set `SENTRY_DSN` in backend `.env`
4. Set `NEXT_PUBLIC_SENTRY_DSN` in frontend `.env.local`

### Prometheus
- Alert rules: `infra/prometheus/alerts.yml`
- Grafana dashboard: `infra/prometheus/grafana-dashboard.json`
- Import dashboard: Grafana → Dashboards → Import → Upload JSON

### Log Aggregation
- API logs: `/var/log/nginx/api-access.log`, `/var/log/nginx/api-error.log`
- Frontend logs: `/var/log/nginx/podacium-access.log`, `/var/log/nginx/podacium-error.log`
- Application logs: `docker compose logs -f api`

---

## 7. CI/CD Secrets (GitHub Actions)

Configure in: Repository → Settings → Secrets and variables → Actions

| Secret | Purpose |
|--------|---------|
| `STAGING_HOST` | Staging server IP/hostname |
| `STAGING_USER` | SSH user for staging |
| `STAGING_SSH_KEY` | SSH private key for staging |
| `PRODUCTION_HOST` | Production server IP/hostname |
| `PRODUCTION_USER` | SSH user for production |
| `PRODUCTION_SSH_KEY` | SSH private key for production |

### GitHub Environments
Create two environments in Repository → Settings → Environments:
- `staging` — auto-deploy on `develop` push
- `production` — requires manual approval, deploys on `main` push

---

## 8. DNS Configuration

| Record | Type | Value |
|--------|------|-------|
| `podacium.com` | A | VPS IP address |
| `www.podacium.com` | CNAME | `podacium.com` |
| `backend-api.podacium.com` | A | VPS IP address (same server) |

---

## 9. Credential Rotation Schedule

| Credential | Rotation Frequency | Procedure |
|------------|-------------------|-----------|
| JWT_SECRET_KEY | On compromise only | Rotate → all sessions invalidated |
| OAuth secrets | Annually | Regenerate at provider → update .env |
| CHARGILY keys | On compromise | Regenerate at dashboard → update .env |
| AWS keys | Quarterly | IAM → Create new key → delete old |
| SMTP password | Annually | Regenerate app password |
| Database password | On compromise | Change in RDS → update DATABASE_URL |

See `scripts/rotate-secrets.sh` in repo root for the secret rotation script.

---

## Consequences
- **Positive**: Any engineer can set up the full stack from this document alone
- **Positive**: No tribal knowledge required for infrastructure
- **Positive**: Clear cost expectations for AWS provisioning
- **Negative**: Must be kept up-to-date as services are added/removed

---

## 10. Undocumented Variables Found in Code Audit

The following are referenced in source code but missing from `.env.example`:

| Variable | Used In | Action Required |
|----------|---------|-----------------|
| `SLACK_CLIENT_ID` | `app/services/integrations_service.py` | Add to .env.example if Slack integration is needed |
| `SLACK_CLIENT_SECRET` | `app/services/integrations_service.py` | Same |
| `COOKIE_DOMAIN` | `app/core/config.py` | Must be `.podacium.com` in production |
| `POSTGRES_DB` | `docker-compose.prod.yml` healthcheck | Add to .env for Docker postgres init |
| `POSTGRES_USER` | `docker-compose.prod.yml` healthcheck | Same |
| `POSTGRES_PASSWORD` | `docker-compose.prod.yml` | Same |
| `NEXT_PUBLIC_SENTRY_DSN` | `apps/web/sentry.client.config.ts` | Add to frontend .env.example |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | `apps/web/.env.example` | For Google Search Console |
| `NEXT_PUBLIC_ENABLE_HLS` | `apps/web/.env.example` | Feature flag for HLS video |
| `NEXT_PUBLIC_ENABLE_AWS_VIDEO` | `apps/web/.env.example` | Feature flag for AWS video pipeline |
| `NEXT_PUBLIC_CLOUDFRONT_DOMAIN` | `apps/web/.env.example` | CDN domain for video playback |

---

## 11. Complete Launch Documentation

For the full step-by-step production launch guide with every account, secret, and verification step, see:

**→ [`docs/LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)**
