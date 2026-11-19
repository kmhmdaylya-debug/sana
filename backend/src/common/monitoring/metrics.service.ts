import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // HTTP Request Metrics
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;

  // Database Query Metrics
  readonly dbQueryDuration: Histogram;
  readonly dbConnectionsActive: Gauge;

  // Business Metrics
  readonly activeUsers: Gauge;
  readonly pendingApprovals: Gauge;
  readonly backupStatus: Gauge;
  readonly backupAgeHours: Gauge;
  readonly workflowCompletionTotal: Counter;

  constructor() {
    this.registry = new Registry();

    // Collect default Node.js metrics (CPU, memory, event loop, etc.)
    collectDefaultMetrics({ register: this.registry, prefix: 'nodejs_' });

    // HTTP Requests Total Counter
    this.httpRequestsTotal = new Counter({
      name: 'sana_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP Request Duration Histogram
    this.httpRequestDuration = new Histogram({
      name: 'sana_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // Database Query Duration Histogram
    this.dbQueryDuration = new Histogram({
      name: 'sana_db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    // Database Connections Active Gauge
    this.dbConnectionsActive = new Gauge({
      name: 'sana_db_connections_active',
      help: 'Number of active database connections in the pool',
      labelNames: ['pool'],
      registers: [this.registry],
    });

    // Active Users Gauge
    this.activeUsers = new Gauge({
      name: 'sana_active_users',
      help: 'Number of currently active user sessions',
      registers: [this.registry],
    });

    // Pending Approvals Gauge
    this.pendingApprovals = new Gauge({
      name: 'sana_pending_approvals',
      help: 'Number of pending approval requests',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // Backup Status Gauge (1 = success, 0 = failed)
    this.backupStatus = new Gauge({
      name: 'sana_backup_status',
      help: 'Last backup status (1 = success, 0 = failed)',
      labelNames: ['database'],
      registers: [this.registry],
    });

    // Backup Age Hours Gauge
    this.backupAgeHours = new Gauge({
      name: 'sana_backup_age_hours',
      help: 'Hours since last successful backup',
      labelNames: ['database'],
      registers: [this.registry],
    });

    // Workflow Completion Counter
    this.workflowCompletionTotal = new Counter({
      name: 'sana_workflow_completion_total',
      help: 'Total number of critical workflow completions',
      labelNames: ['workflow', 'status'],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Initialize gauges with default values
    this.dbConnectionsActive.set({ pool: 'prisma' }, 0);
    this.activeUsers.set(0);
    this.pendingApprovals.set({ type: 'all' }, 0);
    this.backupStatus.set({ database: 'sana_hrms' }, 1);
    this.backupAgeHours.set({ database: 'sana_hrms' }, 0);
  }

  getRegistry(): Registry {
    return this.registry;
  }

  // Helper methods for updating metrics
  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: String(statusCode) });
  }

  observeHttpDuration(method: string, route: string, statusCode: number, durationSeconds: number): void {
    this.httpRequestDuration.observe({ method, route, status_code: String(statusCode) }, durationSeconds);
  }

  observeDbQueryDuration(queryType: string, table: string, durationSeconds: number): void {
    this.dbQueryDuration.observe({ query_type: queryType, table }, durationSeconds);
  }

  setDbConnectionsActive(count: number): void {
    this.dbConnectionsActive.set({ pool: 'prisma' }, count);
  }

  setActiveUsers(count: number): void {
    this.activeUsers.set(count);
  }

  setPendingApprovals(type: string, count: number): void {
    this.pendingApprovals.set({ type }, count);
  }

  setBackupStatus(database: string, success: boolean): void {
    this.backupStatus.set({ database }, success ? 1 : 0);
  }

  setBackupAgeHours(database: string, hours: number): void {
    this.backupAgeHours.set({ database }, hours);
  }

  incrementWorkflowCompletion(workflow: string, status: 'success' | 'failure'): void {
    this.workflowCompletionTotal.inc({ workflow, status });
  }
}