# Podacium On-Call Runbook

## Alert Definitions

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| **HighErrorRate** | Error rate > 1% for 5 min | P1 (Critical) | Check Sentry, review recent deploys |
| **HighLatency** | p99 > 500ms for 5 min | P2 (High) | Check DB queries, Redis, Celery backlog |
| **CeleryTaskFailure** | >10 failed tasks in 5 min | P2 (High) | Check Flower dashboard, review task logs |
| **DatabaseDown** | Health check fails 3x | P1 (Critical) | Check RDS status, connection pool, disk |
| **RedisDown** | Health check fails 3x | P1 (Critical) | Check ElastiCache, memory usage |
| **DiskSpaceLow** | <10% free | P2 (High) | Clean logs, expand volume |
| **MemoryHigh** | >90% for 10 min | P2 (High) | Check for memory leaks, restart pods |
| **SSLExpiringSoon** | <7 days to expiry | P3 (Medium) | Renew certificate |

## Playbooks

### P1: High Error Rate (>1%)

1. **Check Sentry** → identify the error type and affected endpoint
2. **Check recent deploys** → was anything deployed in the last hour?
3. **Check database** → `SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`
4. **Check Redis** → `redis-cli info memory` — is it OOM?
5. **If deploy-related** → rollback: `git revert HEAD && deploy`
6. **If DB-related** → check connection pool exhaustion, restart API pods
7. **Escalate** if not resolved in 15 minutes

### P1: Database Down

1. **Check RDS console** → is the instance running?
2. **Check security groups** → can ECS reach port 5432?
3. **Check connections** → `SELECT count(*) FROM pg_stat_activity` (from bastion)
4. **If connection exhaustion** → restart API pods to release connections
5. **If disk full** → increase storage in Terraform, apply
6. **If RDS crashed** → check for automated recovery, failover to read replica

### P2: High Latency (p99 > 500ms)

1. **Identify slow endpoints** → check API logs for `SLOW-REQ` entries
2. **Check DB queries** → `SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10`
3. **Check Redis** → `redis-cli --latency` — is it slow?
4. **Check Celery backlog** → Flower dashboard, are tasks queuing?
5. **If N+1 query** → add missing `include` or batch the query
6. **If Redis slow** → check memory, eviction policy
7. **If Celery backlog** → scale workers: increase `--concurrency` or add pods

### P2: Celery Task Failures

1. **Check Flower** → which tasks are failing?
2. **Check task logs** → `celery -A app.core.celery inspect active`
3. **Common causes:**
   - DB connection timeout → restart worker
   - External API down (Chargily, WhatsApp) → check provider status
   - Memory limit → increase worker memory
4. **Retry failed tasks** → `celery -A app.core.celery call <task_name>`

## Escalation Path

1. **L1 (On-call engineer)** → 15 min response time
2. **L2 (Senior engineer)** → escalate if not resolved in 30 min
3. **L3 (CTO/Founder)** → escalate if P1 not resolved in 1 hour

## Contact Information

- **PagerDuty**: [Configure in PagerDuty dashboard]
- **Sentry**: https://sentry.io/organizations/podacium/
- **Flower (Celery)**: http://localhost:5555 (internal only)
- **AWS Console**: https://console.aws.amazon.com

## Post-Incident

After every P1/P2 incident:
1. Write a brief incident report (what happened, timeline, root cause)
2. Create action items to prevent recurrence
3. Update this runbook if new patterns discovered
