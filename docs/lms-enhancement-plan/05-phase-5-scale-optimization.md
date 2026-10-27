# Phase 5: Scale & Optimization

**Duration:** Weeks 17–20  
**Target Score:** 95/100 tech, 95/100 launch readiness  
**Dependencies:** Phases 1–4

---

## Overview

Phase 5 prepares Podacium for production scale: hundreds of thousands of concurrent users across MENA. This phase is about performance, reliability, and operational excellence — not new features.

### Architecture Decisions Register

| Decision | Choice | Alternatives Rejected | Rationale |
|----------|--------|----------------------|-----------|
| **Caching layer** | Redis (existing) + application-level caching | Varnish, CDN caching | Redis already in stack. Application caching is more flexible for dynamic data. |
| **Load testing** | k6 | Locust, Artillery | k6 has best CI integration, TypeScript support, and MENA cloud runners. |
| **Container orchestration** | Kubernetes + DigitalOcean/OVHcloud | AWS ECS, self-managed Swarm | K8s is standard. OVHcloud has data centers in Algeria/Morocco for data residency. |
| **CDN** | CloudFront + Cloudflare | Akamai, Fastly | CloudFront integrates with S3. Cloudflare for DNS + DDoS protection. |
| **Database scaling** | Read replicas (PostgreSQL) + connection pooling (PgBouncer) | Sharding, NoSQL | Read replicas handle analytics queries. PgBouncer reduces connection overhead. |

---

## Section 1: Performance Optimization (Week 17)

### 1.1 Caching Strategy

| Data | Cache Key | TTL | Invalidation |
|------|-----------|-----|-------------|
| **Module list (public)** | `modules:public:list:{filters}` | 60s | On module create/update/delete |
| **Module detail (public)** | `modules:public:{id}` | 120s | On module update |
| **Path list (public)** | `paths:public:list` | 60s | On path create/update/delete |
| **Course catalog page** | `catalog:page:{page}:{locale}` | 300s | On module publish/unpublish |
| **User enrollments** | `enrollments:{userId}` | 30s | On enrollment change |
| **Lesson progress** | `progress:{userId}:{lessonId}` | 15s | On progress update |
| **AI conversation history** | `ai_conv:{agent}:{userId}` | 3600s | On new message |
| **Static content** (Next.js ISR) | Path-based | On-demand revalidation | Webhook on content change |

### 1.2 Redis Cache Implementation

Add caching service at `services/api/app/services/cache_service.py`:

```python
class CacheService:
    """Application-level Redis caching with consistent key patterns."""

    KEY_PREFIX = "podacium:"
    DEFAULT_TTL = 60

    async def get_or_set(self, key: str, ttl: int, fetch_func: Callable) -> Any:
        """Cache-aside pattern: check cache, if miss → fetch → store → return."""
        cached = await self._get(key)
        if cached is not None:
            return cached
        value = await fetch_func()
        await self._set(key, value, ttl)
        return value

    async def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching pattern (e.g., 'modules:public:*')."""
        keys = await self._redis.keys(f"{self.KEY_PREFIX}{pattern}")
        if keys:
            await self._redis.delete(*keys)
```

### 1.3 Frontend Performance

| Technique | Implementation | Impact |
|-----------|---------------|--------|
| **ISR (Incremental Static Regeneration)** | Course catalog pages: `revalidate = 60` | First load < 100ms |
| **Image optimization** | Already have `image_optimization_service` | Enable WebP + responsive sizes |
| **Code splitting** | Dynamic imports for heavy components (VideoPlayer, QuizEngine) | Already done — verify all |
| **Bundle analysis** | `next build --analyze` | Identify and split large bundles |
| **Font optimization** | Preload critical fonts, `font-display: swap` | Prevent layout shift |
| **Lazy load below-fold** | Intersection Observer for non-critical sections | ~30% fewer resources on first paint |

### 1.4 Database Performance

| Issue | Solution |
|-------|----------|
| **N+1 queries in education_service** | Review `get_modules()`, `get_module()` for batch queries (already has some — verify completeness) |
| **Analytics queries slow** | Add database read replica for `/education/instructor/` routes |
| **Connection pool exhaustion** | Add PgBouncer between API and PostgreSQL |
| **Missing indexes** | Audit slow queries with `EXPLAIN ANALYZE` for all education endpoints |

---

## Section 2: Load Testing (Week 18)

### 2.1 k6 Test Scenarios

| Scenario | Virtual Users | Duration | Endpoints Tested | Target |
|----------|--------------|----------|-----------------|--------|
| **Catalog browsing** | 5,000 | 30 min | GET /modules, GET /modules/{id}, GET /paths | p95 < 500ms |
| **Enrollment flow** | 1,000 | 15 min | POST /enroll/module/{id}, GET /me/enrollments | p95 < 1s |
| **Quiz taking** | 500 | 15 min | GET /quizzes/{id}, POST /quizzes/{id}/start, POST /submit | p95 < 2s |
| **AI agent chat** | 200 | 10 min | POST /ai/chat/teaching_assistant | p95 < 5s |
| **Mixed workload** | 10,000 | 60 min | All above simultaneously | No endpoint exceeds 5s p99 |

### 2.2 Infrastructure for Load Testing

```yaml
# k6-test.yml — Docker Compose for load testing
services:
  k6:
    image: grafana/k6:latest
    command: run /scripts/stress-test.js
    environment:
      - K6_OUT=influxdb=http://influxdb:8086/k6
    volumes:
      - ./scripts/k6:/scripts
    depends_on:
      - influxdb
      - grafana

  influxdb:
    image: influxdb:1.8
    environment:
      - INFLUXDB_DB=k6

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3002:3000"
```

### 2.3 Stress Test Scenarios

| Test | Goal | Threshold | Failure Action |
|------|------|-----------|---------------|
| **Ramp-up** | Find max concurrent users | 10k users | Identify bottleneck (DB, Redis, API workers) |
| **Spike** | Handle sudden traffic (e.g., enrollment campaign) | 5k → 15k in 30s | Auto-scale K8s pods |
| **Soak** | Detect memory leaks | 5k users for 4 hours | Monitor memory growth, restart pods if > 80% |
| **Stability** | 24h production simulation | Realistic traffic pattern | No crash, p99 < 5s |

---

## Section 3: Kubernetes Migration (Week 19)

### 3.1 Docker Compose → Kubernetes

Current: Docker Compose with postgres, redis, api, celery-worker, celery-beat  
Target: Kubernetes with:

| Component | Pods (min/max) | Resources | Notes |
|-----------|----------------|-----------|-------|
| **API** | 3/20 | 1CPU, 2GB RAM | HPA based on CPU > 70% |
| **Celery Worker** | 2/10 | 1CPU, 4GB RAM | HPA based on queue depth |
| **Celery Beat** | 1/1 | 0.5CPU, 1GB RAM | Singleton |
| **PostgreSQL** | 1 (StatefulSet) | 4CPU, 16GB RAM | Managed DB recommended (DigitalOcean/OVHcloud) |
| **Redis** | 1 (StatefulSet) | 1CPU, 2GB RAM | Managed Redis recommended |
| **Ingress** | 2/5 | 0.5CPU, 1GB RAM | nginx-ingress with SSL termination |

### 3.2 MENA Cloud Providers

| Provider | Data Centers | Managed K8s | Notes |
|----------|-------------|-------------|-------|
| **OVHcloud** | Algeria, Morocco, France | ✓ Managed K8s | Best for North Africa data residency |
| **DigitalOcean** | Netherlands, NYC, SFO | ✓ DOKS | Simple, good for MVP. No MENA DC. |
| **AWS Bahrain** | Bahrain (MENA hub) | ✓ EKS | Best for GCC customers. Highest cost. |
| **Hetzner** | Germany, Finland | ✗ Self-managed | Cheapest. Good for non-sensitive workloads. |

**Recommendation:** DigitalOcean (MVP) → OVHcloud (Phase 5, for data residency in North Africa).

### 3.3 Helm Charts Structure

```
deploy/charts/
├── podacium-api/
│   ├── Chart.yaml
│   ├── templates/
│   │   ├── deployment.yaml
│   │   ├── hpa.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   └── values.yaml  # dev/staging/prod overrides
├── podacium-celery/
│   ├── Chart.yaml
│   └── templates/
│       └── deployment.yaml
└── podacium-db-migrate/
    ├── Chart.yaml
    └── templates/
        └── job.yaml  # Run as K8s Job, not Deployment
```

---

## Section 4: CDN & Video Optimization (Week 20)

### 4.1 Current State

Video is served via CloudFront signed URLs (`/education/video/signed-url` endpoint exists). No CDN for static assets beyond what Next.js provides.

### 4.2 Target CDN Architecture

```
User ──► Cloudflare (DNS + DDoS protection)
         │
         ├── *.podacium.com ──► CloudFront ──► Next.js (ISR pages)
         │                           │
         │                           └── S3 (static assets, images)
         │
         └── cdn.podacium.com ──► CloudFront ──► S3 (videos, uploads)
                                           │
                                           └── Signed URLs (JWT auth)
```

### 4.3 Video Optimization

| Feature | Implementation | Impact |
|---------|---------------|--------|
| **Adaptive Bitrate (ABR)** | HLS with 4 renditions (240p, 480p, 720p, 1080p) | Students on slow connections get lower quality |
| **Transcoding** | AWS Elemental MediaConvert | Input videos → HLS segments |
| **Signed URLs** | Existing `get_video_signed_url` (CloudFront signed cookies) | Prevents hotlinking |
| **Thumbnail generation** | MediaConvert sprites + existing `thumbnail_url` | Timeline preview |
| **MENA edge caching** | CloudFront edge locations in Dubai, Bahrain, Cairo | < 50ms latency for most MENA users |

### 4.4 Monitoring & Alerting

| Tool | What It Monitors | Alert Threshold |
|------|-----------------|----------------|
| **Sentry** (existing) | API errors, frontend errors | Error rate > 1% |
| **Prometheus** (existing) | API latency, Redis, PostgreSQL | p99 latency > 2s |
| **Grafana** | Dashboards for all metrics | CPU > 80%, memory > 80% |
| **Uptime Kuma** | External uptime monitoring | Down for > 60s |
| **Lighthouse CI** | Frontend performance regression | Performance score drop > 5 |

---

## Phase 5 Success Criteria

- [ ] Redis caching implemented for module list, detail, paths, enrollments
- [ ] Cache invalidation working on content changes
- [ ] k6 tests written and passing for 5 scenarios
- [ ] Ramp-up test finds max concurrent users (target: 10k)
- [ ] No endpoints exceed p99 5s under load
- [ ] Kubernetes manifests for API, Celery, Redis, PostgreSQL
- [ ] Helm charts with dev/staging/prod values
- [ ] HPA configured for API and Celery workers
- [ ] CDN configured (CloudFront + Cloudflare)
- [ ] Video ABR + signed URLs working end-to-end
- [ ] Monitoring dashboards in Grafana
- [ ] Alerting configured for all critical metrics
- [ ] Database query audit completed (no N+1 in hot paths)
- [ ] Frontend Lighthouse score > 90 for mobile and desktop
