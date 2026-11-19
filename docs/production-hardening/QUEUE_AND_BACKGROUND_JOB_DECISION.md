# Sana HRMS - Queue and Background Job Decision

**Version:** 1.0  
**Date:** 2026-11-19  
**Classification:** INTERNAL  

---

## 1. Decision

**Do not implement Bull/BullMQ queue system for MVP launch.**

Current in-process background job architecture is sufficient for MVP launch. Queue system deferred to Sprint 1 (0-30 days post go-live).

---

## 2. Current Background Job Architecture

### 2.1 Active Jobs

| Job | Schedule | Implementation | Reliability |
|-----|----------|----------------|-------------|
| Daily Attendance Closing | Every 1 minute | `setInterval` in `DailyAttendanceService` | In-process, no persistence |
| Database Backup | Daily 02:00 | Host cron → API call | Manual retry |
| Backup Cleanup | Daily 03:00 | Host cron → Prisma delete | Log only |
| Offsite Sync | Post-backup | Host cron → `aws s3 sync` | Manual retry |
| Audit Outbox Processing | Every 5 seconds | Polling loop in `AuditOutboxProcessor` | In-process, retry 3x |

### 2.2 Gap Analysis

| Requirement | Current | Gap |
|-------------|---------|-----|
| Persistence | In-memory only | Job lost on restart |
| Retry Policy | Manual / 3x (audit) | No exponential backoff |
| Dead Letter Queue | None | Failed jobs lost |
| Duplicate Prevention | None (idempotency keys on API) | Race conditions possible |
| Monitoring | Log-based | No Prometheus metrics |
| Priority | None | All equal |
| Scaling | Single process | Cannot distribute |

---

## 3. Risk Assessment

| Risk | Likelihood | Impact | Current Mitigation |
|------|------------|--------|-------------------|
| Job lost on restart | Medium | Medium | Daily attendance re-runs on next interval |
| Silent job failure | Low | Medium | Log monitoring; manual retry |
| Duplicate payroll run | Low | High | Idempotency keys on API; DB constraints |
| Notification loss | Medium | Low | Email/SMS fire-and-forget |
| Backup failure | Low | High | Alert on failure; manual retry |

**Overall Risk:** **Acceptable for MVP** — No payroll/notification queue yet; current jobs are low-criticality or have manual fallback.

---

## 4. Decision Rationale

### 4.1 Why Not Queue System for MVP?

1. **No payroll/notification queue yet** — Payroll runs synchronously via API; notifications fire-and-forget
2. **Adds Redis dependency** — New infrastructure component, operational complexity
3. **Operational overhead** — Bull Board UI, worker scaling, Redis HA
3. **Current jobs are simple** — In-process timers + cron sufficient for current workload
4. **Time-to-market** — Queue system adds 1-2 weeks; MVP deadline prioritized

### 4.2 When Queue System Becomes Necessary

| Trigger | Timeline |
|---------|----------|
| Payroll async processing | Sprint 1 |
| Notification volume > 1000/day | Sprint 1 |
| Report generation queue | Sprint 1 |
| Audit outbox lag > 1000 | Sprint 1 |
| Background job monitoring needed | Sprint 1 |

---

## 3. Sprint 1 Implementation Plan

### 3.1 Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API       │────▶│   Redis     │────▶│  Workers    │
│  (Producer) │     │  (Queue)    │     │ (Consumers) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌───────────┐ ┌───────────┐
              │  Payroll  │ │ Notifica- │
              │  Queue    │ │  tion Q   │
              └───────────┘ └───────────┘
```

### 3.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Queue | Bull/BullMQ | Latest |
| Redis | Redis | 7.x (Alpine) |
| Monitoring | Bull Board + Prometheus | Built-in |

### 3.3 Queue Design

| Queue | Priority | Retry Policy | DLQ | Idempotency |
|-------|----------|--------------|-----|-------------|
| Payroll | High | Exponential (3x) | Yes | Period ID |
| Notifications | Normal | Exponential (5x) | Yes | Notification ID |
| Reports | Normal | Exponential (3x) | Yes | Report ID |
| Audit | High | Exponential (3x) | Yes | Outbox ID |

### 3.4 Redis Configuration

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  volumes:
    - redis-data:/data
  deploy:
    resources:
      limits:
        memory: 512M
```

---

## 4. Migration Plan (Sprint 1)

### Week 1: Infrastructure
- [ ] Add Redis container to docker-compose
- [ ] Install Bull/BullMQ dependencies
- [ ] Create queue configuration module

### Week 2: Core Queues
- [ ] Payroll queue (high priority)
- [ ] Notification queue
- [ ] Worker container deployment

### Week 3: Advanced Features
- [ ] Retry policy with exponential backoff
- [ ] Dead letter queue handling
- [ ] Job metrics (Prometheus)
- [ ] Bull Board dashboard

### Week 4: Migration & Testing
- [ ] Migrate audit outbox to queue
- [ ] Migrate payroll to async queue
- [ ] Load test with 5000 employees
- [ ] Documentation & runbooks

---

## 4. Monitoring Requirements

| Metric | Name | Type |
|--------|------|------|
| Queue depth | `bull_queue_depth` | Gauge |
| Job duration | `bull_job_duration_seconds` | Histogram |
| Job success | `bull_job_success_total` | Counter |
| Job failure | `bull_job_failure_total` | Counter |
| Retry count | `bull_job_retry_total` | Counter |
| DLQ size | `bull_dlq_size` | Gauge |

---

## 5. Conclusion

**Decision:** Defer queue system to Sprint 1.

**Justification:** Current architecture sufficient for MVP; queue system adds operational complexity without immediate business value. Sprint 1 implementation aligns with payroll async processing and notification scaling needs.

**Risk:** Acceptable — Current jobs have manual fallback; no critical path depends on queue system.

---

**Document Version:** 1.0  
**Date:** 2026-11-19  
**Status:** Decision Documented — Sprint 1 Implementation Planned  
**Classification:** INTERNAL