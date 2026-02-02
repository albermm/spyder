# Production Runbook - RemoteEye

Quick reference guide for common operational tasks.

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Primary On-Call | [Your contact] | 24/7 |
| Backup On-Call | [Backup contact] | 24/7 |
| Render Support | https://render.com/support | 24/7 |

## Critical Alerts & Response

### Alert: Server Down

**Severity**: CRITICAL
**Response Time**: Immediate

```bash
# 1. Check status
render services list

# 2. Check logs
render logs spyder-server --tail --num 50

# 3. Restart if needed
render services restart spyder-server

# 4. Monitor recovery
curl https://spyder-server.onrender.com/api/health

# 5. If restart fails, rollback
# Via Render dashboard: Services → Deployments → Rollback
```

### Alert: High Error Rate

**Severity**: HIGH
**Response Time**: < 15 minutes

```bash
# 1. Identify errors
render logs spyder-server --tail | grep -i error

# 2. Check recent deployments
render services deployments spyder-server

# 3. If recent deployment, rollback
# Dashboard → Service → Deployments → Rollback

# 4. Monitor error rate
render logs spyder-server --tail | grep -c error
```

### Alert: Database Connection Issues

**Severity**: CRITICAL
**Response Time**: Immediate

```bash
# 1. Check database status
render databases list

# 2. Check connection from server
render logs spyder-server | grep -i database

# 3. Verify DATABASE_URL
render services env spyder-server | grep DATABASE_URL

# 4. Restart server to reset connections
render services restart spyder-server

# 5. If persistent, contact Render support
```

### Alert: High Memory Usage

**Severity**: MEDIUM
**Response Time**: < 30 minutes

```bash
# 1. Check metrics
# Via Render dashboard → Service → Metrics

# 2. Check for memory leaks in logs
render logs spyder-server | grep -i "memory\|oom"

# 3. Restart service to clear
render services restart spyder-server

# 4. Monitor memory usage
# Dashboard → Metrics

# 5. If recurring, investigate code and consider upgrade
```

## Common Tasks

### Deploy New Version

```bash
# Standard deployment
./deploy.sh

# Manual deployment
git push origin main
render blueprint launch
```

### Rollback Deployment

```bash
# Via dashboard (recommended)
# Render Dashboard → Service → Deployments → Rollback

# Via git revert
git revert HEAD
git push origin main
```

### Update Environment Variable

```bash
# View all env vars
render services env spyder-server

# Set new value
render services env spyder-server set KEY=value

# Remove variable
render services env spyder-server unset KEY

# Restart to apply
render services restart spyder-server
```

### View Logs

```bash
# Real-time logs
render logs spyder-server --tail

# Last 100 lines
render logs spyder-server --num 100

# Filter for errors
render logs spyder-server --tail | grep -i error

# Dashboard logs
render logs spyder-dashboard --tail
```

### Database Operations

```bash
# List databases
render databases list

# Create backup
# Via Render dashboard: Database → Backups → Create Backup

# Connect to database
render shell spyder-server
# Then: psql $DATABASE_URL

# Run migration (if using Alembic)
render shell spyder-server
# Then: alembic upgrade head
```

### Restart Services

```bash
# Restart server
render services restart spyder-server

# Restart dashboard
render services restart spyder-dashboard

# Restart all services
render services list | grep spyder | awk '{print $1}' | xargs -I {} render services restart {}
```

### Check Service Status

```bash
# List all services
render services list

# Service details
render services get spyder-server

# Recent deployments
render services deployments spyder-server
```

## Scheduled Maintenance Windows

**Preferred Time**: Sunday 2-4 AM UTC (lowest traffic)

### Pre-Maintenance

```bash
# 1. Announce maintenance
# Update status page or notify users

# 2. Create backup
# Render Dashboard → Database → Backups → Create Backup

# 3. Document current state
render services list > pre_maintenance_status.txt
```

### During Maintenance

```bash
# 1. Put service in maintenance mode (if available)
# Or deploy maintenance page

# 2. Perform maintenance tasks
# - Update dependencies
# - Run migrations
# - Deploy new version

# 3. Test functionality
curl https://spyder-server.onrender.com/api/health
```

### Post-Maintenance

```bash
# 1. Verify all services running
render services list

# 2. Run smoke tests
./scripts/smoke-test.sh  # Create this

# 3. Monitor logs
render logs spyder-server --tail

# 4. Announce completion
# Update status page
```

## Health Check Procedures

### Daily Health Check

```bash
#!/bin/bash
# Save as: .devops/daily-health-check.sh

echo "🏥 Daily Health Check - $(date)"
echo "================================"

# 1. Service status
echo "1. Checking service status..."
render services list | grep spyder

# 2. Server health
echo "2. Checking server health..."
curl -s https://spyder-server.onrender.com/api/health

# 3. Dashboard accessibility
echo "3. Checking dashboard..."
curl -sI https://spyder-dashboard.onrender.com | head -1

# 4. Recent errors
echo "4. Checking for errors..."
render logs spyder-server --num 100 | grep -i error | tail -5

# 5. Database status
echo "5. Checking database..."
render databases list | grep remoteeye

echo "✅ Health check complete"
```

### Weekly Health Check

```bash
#!/bin/bash
# Save as: .devops/weekly-health-check.sh

# Run daily checks
./daily-health-check.sh

# Additional weekly checks
echo ""
echo "📊 Weekly Metrics"
echo "================"

# 1. Disk usage
echo "1. Database size:"
# Check via Render dashboard

# 2. Performance metrics
echo "2. Average response time:"
# Check via Render dashboard

# 3. Error rate
echo "3. Error rate (last 7 days):"
# Check logs

# 4. Uptime
echo "4. Uptime:"
render services list | grep spyder

# 5. Dependency updates
echo "5. Checking for updates:"
cd server && pip list --outdated
cd ../dashboard && npm outdated
```

## Incident Response

### Incident Severity Levels

**P0 - Critical**
- Complete service outage
- Data loss
- Security breach
- Response: Immediate

**P1 - High**
- Partial service degradation
- High error rate
- Performance issues affecting users
- Response: < 15 minutes

**P2 - Medium**
- Minor service degradation
- Intermittent errors
- Non-critical feature broken
- Response: < 1 hour

**P3 - Low**
- Cosmetic issues
- Documentation updates
- Non-urgent improvements
- Response: Next business day

### Incident Response Process

1. **Detect**
   - Monitor alerts
   - User reports
   - Health checks

2. **Respond**
   - Acknowledge incident
   - Assess severity
   - Assign owner

3. **Investigate**
   - Check logs
   - Review recent changes
   - Identify root cause

4. **Mitigate**
   - Apply quick fix
   - Or rollback if needed
   - Monitor recovery

5. **Resolve**
   - Verify fix
   - Update status
   - Close incident

6. **Learn**
   - Write post-mortem
   - Identify improvements
   - Update runbooks

### Incident Template

```markdown
# Incident Report

**Incident ID**: INC-YYYY-MM-DD-NNN
**Severity**: P0/P1/P2/P3
**Status**: Investigating/Mitigating/Resolved
**Start Time**: YYYY-MM-DD HH:MM UTC
**End Time**: YYYY-MM-DD HH:MM UTC
**Duration**: X hours Y minutes

## Summary
Brief description of the incident.

## Impact
- Number of users affected
- Services affected
- Data loss (if any)

## Timeline
- HH:MM - Incident detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Mitigation applied
- HH:MM - Service recovered
- HH:MM - Incident closed

## Root Cause
What caused the incident.

## Resolution
How it was fixed.

## Action Items
- [ ] Fix X
- [ ] Update Y
- [ ] Improve monitoring for Z

## Lessons Learned
What we learned and how to prevent recurrence.
```

## Performance Baselines

### Server Response Times
- Health endpoint: < 100ms
- API endpoints: < 500ms
- WebSocket connection: < 1s

### Dashboard Load Times
- Initial load: < 2s
- Time to interactive: < 3s

### Error Rates
- Target: < 0.1%
- Warning: > 1%
- Critical: > 5%

### Resource Usage
- CPU: < 60% average
- Memory: < 70% average
- Disk: < 80% capacity

## Quick Links

- [Render Dashboard](https://dashboard.render.com)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Firebase Console](https://console.firebase.google.com)
- [GitHub Repository](https://github.com/albermm/spyder)

---

**Last Updated**: 2025-02-02
**On-Call Rotation**: Update weekly
**Next Review**: 2025-03-02
