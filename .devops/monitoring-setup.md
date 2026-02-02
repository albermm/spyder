# Monitoring Setup Guide

This guide explains how to set up comprehensive monitoring for the RemoteEye production system.

## Overview

Monitoring stack:
- **Uptime Monitoring**: UptimeRobot (or Pingdom)
- **Log Aggregation**: Render built-in logs
- **Error Tracking**: Sentry (optional)
- **Application Metrics**: Render dashboard
- **Alerts**: Email/SMS/Slack

---

## 1. Uptime Monitoring (UptimeRobot)

### Setup

1. **Sign up for UptimeRobot**
   - Visit https://uptimerobot.com
   - Free tier: 50 monitors, 5-min intervals

2. **Create Server Monitor**
   ```
   Monitor Type: HTTP(s)
   Friendly Name: RemoteEye Server
   URL: https://spyder-server.onrender.com/api/health
   Monitoring Interval: 5 minutes
   Monitor Timeout: 30 seconds
   ```

3. **Create Dashboard Monitor**
   ```
   Monitor Type: HTTP(s)
   Friendly Name: RemoteEye Dashboard
   URL: https://spyder-dashboard.onrender.com
   Monitoring Interval: 5 minutes
   Monitor Timeout: 30 seconds
   ```

4. **Configure Alert Contacts**
   - Add email address
   - Add SMS number (if available)
   - Add Slack webhook (optional)

5. **Set Alert Threshold**
   - Alert when down: After 2 checks (10 minutes)
   - Re-alert: Every 30 minutes

### Expected Response

**Server Health:**
```json
{
  "status": "ok"
}
```

**Dashboard:**
- HTTP 200 OK
- Content-Type: text/html

---

## 2. Log Monitoring

### Render Built-in Logs

Access logs via:
```bash
# Real-time logs
render logs spyder-server --tail

# Last N lines
render logs spyder-server --num 100

# Dashboard logs
render logs spyder-dashboard --tail
```

### Log Levels

Configure in server environment:
```bash
render services env spyder-server set LOG_LEVEL=INFO
```

Levels:
- `DEBUG`: Detailed information for debugging
- `INFO`: General informational messages (recommended for production)
- `WARNING`: Warning messages for potential issues
- `ERROR`: Error messages for failures
- `CRITICAL`: Critical errors requiring immediate attention

### Important Log Patterns

Monitor for these patterns:

**Errors:**
```bash
render logs spyder-server | grep -i "error\|exception\|failed"
```

**Database Issues:**
```bash
render logs spyder-server | grep -i "database\|connection\|timeout"
```

**Performance:**
```bash
render logs spyder-server | grep -i "slow\|timeout"
```

**Security:**
```bash
render logs spyder-server | grep -i "unauthorized\|forbidden\|invalid token"
```

---

## 3. Error Tracking (Sentry)

### Setup Sentry

1. **Sign up for Sentry**
   - Visit https://sentry.io
   - Free tier: 5,000 events/month

2. **Create Project**
   - Platform: Python (for server)
   - Project name: remoteeye-server

3. **Install Sentry SDK**
   ```bash
   # Add to server/requirements.txt
   echo "sentry-sdk[fastapi]==1.40.0" >> server/requirements.txt
   ```

4. **Configure Server**
   ```python
   # server/app/main.py
   import sentry_sdk
   from sentry_sdk.integrations.fastapi import FastApiIntegration
   from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

   # Initialize Sentry
   if settings.SENTRY_DSN:
       sentry_sdk.init(
           dsn=settings.SENTRY_DSN,
           integrations=[
               FastApiIntegration(),
               SqlalchemyIntegration(),
           ],
           traces_sample_rate=0.1,  # 10% of transactions
           environment="production",
       )
   ```

5. **Add Environment Variable**
   ```bash
   render services env spyder-server set SENTRY_DSN=<your-sentry-dsn>
   ```

6. **Test Error Tracking**
   ```python
   # Add test endpoint
   @app.get("/api/test-error")
   async def test_error():
       raise Exception("Test error for Sentry")
   ```

### Dashboard Error Tracking

1. **Create Sentry Project**
   - Platform: React
   - Project name: remoteeye-dashboard

2. **Install Sentry SDK**
   ```bash
   cd dashboard
   npm install @sentry/react
   ```

3. **Configure Dashboard**
   ```typescript
   // dashboard/src/main.tsx
   import * as Sentry from "@sentry/react";

   Sentry.init({
     dsn: import.meta.env.VITE_SENTRY_DSN,
     environment: "production",
     tracesSampleRate: 0.1,
   });
   ```

4. **Add Environment Variable**
   ```bash
   # In Render dashboard for spyder-dashboard
   VITE_SENTRY_DSN=<your-sentry-dsn>
   ```

---

## 4. Application Metrics

### Render Dashboard Metrics

Access via: https://dashboard.render.com

**Available Metrics:**
- CPU usage
- Memory usage
- Network traffic
- Request count
- Response time
- HTTP status codes

**Monitoring Guidelines:**

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU | > 70% | > 90% |
| Memory | > 70% | > 85% |
| Response time | > 1s | > 2s |
| Error rate | > 1% | > 5% |
| 5xx errors | Any | > 10/min |

### Custom Metrics (Optional)

Add custom metrics to your application:

```python
# server/app/metrics.py
from collections import defaultdict
from datetime import datetime
import time

class Metrics:
    def __init__(self):
        self.request_count = defaultdict(int)
        self.error_count = defaultdict(int)
        self.response_times = []

    def record_request(self, endpoint: str):
        self.request_count[endpoint] += 1

    def record_error(self, endpoint: str):
        self.error_count[endpoint] += 1

    def record_response_time(self, duration: float):
        self.response_times.append(duration)
        # Keep only last 1000
        if len(self.response_times) > 1000:
            self.response_times = self.response_times[-1000:]

    def get_metrics(self):
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        return {
            "total_requests": sum(self.request_count.values()),
            "total_errors": sum(self.error_count.values()),
            "avg_response_time_ms": round(avg_response_time * 1000, 2),
            "error_rate": sum(self.error_count.values()) / sum(self.request_count.values()) if sum(self.request_count.values()) > 0 else 0,
        }

metrics = Metrics()

# Add middleware
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()

    try:
        response = await call_next(request)
        metrics.record_request(request.url.path)

        if response.status_code >= 500:
            metrics.record_error(request.url.path)

        duration = time.time() - start_time
        metrics.record_response_time(duration)

        return response
    except Exception as e:
        metrics.record_error(request.url.path)
        raise

# Metrics endpoint
@app.get("/api/metrics")
async def get_metrics():
    return metrics.get_metrics()
```

---

## 5. Alert Configuration

### Email Alerts

**UptimeRobot Email Alerts:**
1. Dashboard → My Settings → Alert Contacts
2. Add email address
3. Verify email
4. Configure when to alert:
   - When monitor goes down
   - When monitor comes back up

**Render Email Alerts:**
1. Dashboard → Account Settings → Notifications
2. Enable:
   - Deploy failures
   - Service down
   - High error rate

### Slack Alerts

**UptimeRobot Slack Integration:**
1. Create Slack webhook:
   - Slack → Apps → Incoming Webhooks
   - Add to channel
   - Copy webhook URL

2. UptimeRobot:
   - My Settings → Alert Contacts
   - Add new contact
   - Type: Webhook
   - URL: <slack-webhook-url>

**Sentry Slack Integration:**
1. Sentry → Settings → Integrations
2. Find Slack → Install
3. Choose channel for alerts
4. Configure alert rules

### SMS Alerts

**Twilio Integration:**
1. Sign up for Twilio
2. Get phone number
3. Create webhook to send SMS on alerts

---

## 6. Health Check Automation

### Cron Job for Health Checks

Create a cron job to run health checks:

```bash
# Run health check every 5 minutes
*/5 * * * * /path/to/spyder/.devops/scripts/health-check.sh >> /var/log/remoteeye-health.log 2>&1

# Run smoke test after every deployment
# Trigger manually or via CI/CD
```

### GitHub Actions for Monitoring

Create `.github/workflows/health-check.yml`:

```yaml
name: Scheduled Health Check

on:
  schedule:
    # Run every hour
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run health check
        run: |
          chmod +x .devops/scripts/health-check.sh
          ./.devops/scripts/health-check.sh

      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Health check failed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 7. Database Monitoring

### Query Performance

```sql
-- Enable query logging (if needed)
-- In PostgreSQL, check pg_stat_statements

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### Connection Monitoring

```bash
# Via Render dashboard
# Database → Metrics → Connections

# Alert if connections > 80
```

---

## 8. Mobile App Monitoring

### Crash Reporting

**Firebase Crashlytics:**
1. Already integrated via React Native Firebase
2. View crashes: Firebase Console → Crashlytics
3. Set up alerts for new crash types

### Analytics

**Firebase Analytics:**
1. Track key events:
   - App launches
   - Pairing successful
   - Camera started
   - Errors

2. Monitor user behavior:
   - Active users
   - Session duration
   - Feature usage

---

## 9. Dashboard Setup

### Create Monitoring Dashboard

**Option 1: Grafana (Self-hosted)**
- Visualize metrics from multiple sources
- Create custom dashboards
- Set up alerts

**Option 2: Datadog (SaaS)**
- All-in-one monitoring solution
- APM, logs, metrics
- Expensive but comprehensive

**Option 3: Simple Dashboard (Recommended for Start)**

Create HTML dashboard:

```html
<!-- .devops/dashboard.html -->
<!DOCTYPE html>
<html>
<head>
    <title>RemoteEye Status</title>
    <meta http-equiv="refresh" content="60">
    <style>
        body { font-family: Arial; margin: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .ok { background: #d4edda; color: #155724; }
        .warning { background: #fff3cd; color: #856404; }
        .error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <h1>RemoteEye System Status</h1>
    <div id="status"></div>

    <script>
        async function checkStatus() {
            const checks = [
                { name: 'Server', url: 'https://spyder-server.onrender.com/api/health' },
                { name: 'Dashboard', url: 'https://spyder-dashboard.onrender.com' },
            ];

            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = '';

            for (const check of checks) {
                try {
                    const response = await fetch(check.url);
                    const status = response.ok ? 'ok' : 'error';
                    const statusText = response.ok ? '✓ Online' : '✗ Offline';

                    statusDiv.innerHTML += `
                        <div class="status ${status}">
                            <strong>${check.name}:</strong> ${statusText}
                            (HTTP ${response.status})
                        </div>
                    `;
                } catch (error) {
                    statusDiv.innerHTML += `
                        <div class="status error">
                            <strong>${check.name}:</strong> ✗ Offline
                            (${error.message})
                        </div>
                    `;
                }
            }
        }

        checkStatus();
    </script>
</body>
</html>
```

---

## 10. Monitoring Checklist

### Daily
- [ ] Check UptimeRobot status
- [ ] Review error logs
- [ ] Check Sentry for new errors
- [ ] Verify metrics in Render dashboard

### Weekly
- [ ] Review performance metrics
- [ ] Check database size and performance
- [ ] Review security logs
- [ ] Update dependencies if needed

### Monthly
- [ ] Review all alerts and thresholds
- [ ] Analyze trends in metrics
- [ ] Review and update monitoring configuration
- [ ] Test alert notifications

---

## Quick Reference

### Status Pages
- UptimeRobot: https://uptimerobot.com
- Render Dashboard: https://dashboard.render.com
- Sentry: https://sentry.io
- Firebase: https://console.firebase.google.com

### Key Metrics
- Server uptime target: 99.9%
- Response time target: < 500ms
- Error rate target: < 0.1%
- Database connections: < 80

### Alert Contacts
- Email: [your-email]
- Slack: [your-slack-channel]
- Phone: [on-call-number]

---

**Last Updated**: 2025-02-02
**Review Frequency**: Monthly
