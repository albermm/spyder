# DevOps Agent Guide - RemoteEye System

This guide contains all operational procedures, deployment workflows, and troubleshooting steps for managing the RemoteEye production infrastructure.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Infrastructure Overview](#infrastructure-overview)
3. [Deployment Procedures](#deployment-procedures)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance Tasks](#maintenance-tasks)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Security & Compliance](#security--compliance)
9. [Disaster Recovery](#disaster-recovery)

---

## Quick Reference

### Service URLs

| Service | URL | Status Check |
|---------|-----|--------------|
| Server API | `https://spyder-server.onrender.com` | `curl https://spyder-server.onrender.com/api/health` |
| Dashboard | `https://spyder-dashboard.onrender.com` | Browser check |
| Database | Internal (PostgreSQL) | Via server health endpoint |

### Key Commands

```bash
# Deploy everything
./deploy.sh
# or
render blueprint launch

# Monitor logs
render logs spyder-server --tail
render logs spyder-dashboard --tail

# Check deployment status
render services list

# SSH into server (if needed)
render shell spyder-server

# Restart services
render services restart spyder-server
render services restart spyder-dashboard

# View environment variables
render services env spyder-server

# Update environment variable
render services env spyder-server set KEY=value
```

### Emergency Contacts

- **Primary Contact**: [Add your contact]
- **Apple Developer**: [Add contact]
- **Render Support**: https://render.com/support

---

## Infrastructure Overview

### Architecture

```
┌─────────────────┐
│   iOS App       │
│   (Confyg)      │
└────────┬────────┘
         │
         ├─────────────────────┐
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│   Dashboard     │   │   Server API    │
│   (React/Vite)  │◄──┤   (FastAPI)     │
│   Static Site   │   │   WebSocket     │
└─────────────────┘   └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │   PostgreSQL    │
                      │   Database      │
                      └─────────────────┘
```

### Technology Stack

**Server:**
- Runtime: Python 3.11.6
- Framework: FastAPI + Socket.IO
- Database: PostgreSQL (SQLAlchemy + aiosqlite)
- Auth: JWT (python-jose)
- Deployment: Render.com

**Dashboard:**
- Framework: React 19 + TypeScript
- Build Tool: Vite 7
- Styling: Tailwind CSS 4
- Real-time: Socket.IO Client
- Deployment: Render.com (Static)

**Mobile:**
- Framework: React Native
- Platform: iOS
- Push: Firebase Cloud Messaging
- Deployment: App Store

### Resource Allocation

**Free Tier (Current):**
- Server: 512MB RAM, 0.5 CPU
- Database: 1GB storage, 100 connections
- Dashboard: Static hosting (unlimited bandwidth)
- Cold start: ~30s after 15min inactivity

**Recommended Production (Paid Tier):**
- Server: Starter ($7/mo) - Always on, 2GB RAM
- Database: Standard ($20/mo) - 10GB storage, backups
- Dashboard: Free tier sufficient

---

## Deployment Procedures

### 1. Server & Dashboard Deployment

#### Automated Deployment (Recommended)

```bash
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Run deployment script
./deploy.sh

# 3. Monitor deployment
render logs spyder-server --tail
```

#### Manual Deployment

```bash
# 1. Login to Render
render login

# 2. Deploy using blueprint
render blueprint launch

# 3. Or deploy individual services
render services create web \
  --name spyder-server \
  --runtime python \
  --rootDir server \
  --buildCommand "pip install -r requirements.txt" \
  --startCommand "uvicorn app.main:socket_app --host 0.0.0.0 --port \$PORT"

render services create web \
  --name spyder-dashboard \
  --runtime static \
  --rootDir dashboard \
  --buildCommand "npm install && npm run build" \
  --publish dist
```

#### Deployment Checklist

- [ ] All changes committed and pushed
- [ ] Tests passing locally
- [ ] Environment variables verified
- [ ] Database migrations ready (if needed)
- [ ] Backup created (if major change)
- [ ] Deployment window scheduled
- [ ] Team notified

#### Post-Deployment Verification

```bash
# 1. Check server health
curl https://spyder-server.onrender.com/api/health
# Expected: {"status": "ok"}

# 2. Test WebSocket connection
wscat -c wss://spyder-server.onrender.com/socket.io/

# 3. Test dashboard
open https://spyder-dashboard.onrender.com
# - Login should work
# - WebSocket should connect
# - No console errors

# 4. Test mobile app
# - Pairing should work
# - Camera streaming functional
# - Push notifications working
```

### 2. iOS App Deployment

#### Pre-Deployment

```bash
# 1. Update version/build number
# Edit mobile/ios/RemoteEyeMobile/Info.plist
# CFBundleShortVersionString: 1.0.0 -> 1.0.1
# CFBundleVersion: 1 -> 2

# 2. Clean and rebuild
cd mobile/ios
pod install
cd ..
npx react-native run-ios --configuration Release

# 3. Run tests
npm test
```

#### Build & Archive

```bash
# Via Xcode
# 1. Open mobile/ios/RemoteEyeMobile.xcworkspace
# 2. Select "Any iOS Device"
# 3. Product → Archive
# 4. Once complete, Organizer opens
# 5. Click "Distribute App"
# 6. Choose "App Store Connect"
# 7. Upload

# Via Command Line
xcodebuild -workspace ios/RemoteEyeMobile.xcworkspace \
  -scheme RemoteEyeMobile \
  -configuration Release \
  -archivePath ~/Desktop/RemoteEyeMobile.xcarchive \
  archive
```

#### TestFlight Deployment

1. After upload, go to App Store Connect
2. Navigate to TestFlight tab
3. Add internal testers
4. Click "Start Testing"
5. Testers receive invite email
6. Collect feedback
7. Fix issues if needed
8. Upload new build (increment build number)

#### App Store Submission

See `IOS_DEPLOYMENT_CHECKLIST.md` for complete checklist.

### 3. Hotfix Deployment

For critical production issues:

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-bug-fix

# 2. Make fix and test
# ... fix code ...
npm test  # or pytest for server

# 3. Commit and push
git add .
git commit -m "hotfix: Fix critical bug"
git push origin hotfix/critical-bug-fix

# 4. Merge to main
git checkout main
git merge hotfix/critical-bug-fix
git push origin main

# 5. Deploy immediately
./deploy.sh

# 6. Verify fix
curl https://spyder-server.onrender.com/api/health
# Test affected functionality

# 7. Delete hotfix branch
git branch -d hotfix/critical-bug-fix
git push origin --delete hotfix/critical-bug-fix
```

### 4. Rollback Procedure

If deployment fails or causes issues:

```bash
# 1. Via Render Dashboard
# - Go to https://dashboard.render.com
# - Select service
# - Click "Rollback" to previous deployment

# 2. Via Git revert
git revert HEAD
git push origin main
./deploy.sh

# 3. Via specific commit
git reset --hard <previous-commit-hash>
git push -f origin main  # CAREFUL!
./deploy.sh
```

---

## Monitoring & Alerts

### Health Checks

#### Automated Monitoring (Recommended Setup)

Use a service like UptimeRobot or Pingdom:

```yaml
# Server Health Check
URL: https://spyder-server.onrender.com/api/health
Method: GET
Expected Response: 200
Check Interval: 5 minutes
Alert After: 2 failed checks

# Dashboard Health Check
URL: https://spyder-dashboard.onrender.com
Method: GET
Expected Response: 200
Check Interval: 5 minutes
Alert After: 2 failed checks
```

#### Manual Health Checks

```bash
# Server health
curl -i https://spyder-server.onrender.com/api/health

# WebSocket connectivity
wscat -c wss://spyder-server.onrender.com/socket.io/

# Database connectivity (via server)
curl https://spyder-server.onrender.com/api/status

# Dashboard accessibility
curl -I https://spyder-dashboard.onrender.com
```

### Log Monitoring

```bash
# Real-time server logs
render logs spyder-server --tail

# Filter for errors
render logs spyder-server --tail | grep -i error

# Filter for warnings
render logs spyder-server --tail | grep -i warning

# Last 100 lines
render logs spyder-server --num 100

# Specific time range (via Render dashboard)
# https://dashboard.render.com → Service → Logs → Filter
```

### Key Metrics to Monitor

1. **Response Time**
   - Target: < 500ms for API calls
   - Check: Render dashboard metrics

2. **Error Rate**
   - Target: < 1% of requests
   - Check: Application logs

3. **WebSocket Connections**
   - Monitor active connections
   - Check for connection drops

4. **Database Performance**
   - Query time
   - Connection pool usage
   - Storage usage

5. **CPU & Memory Usage**
   - Server: < 80% sustained
   - Dashboard: N/A (static)

### Alert Thresholds

Set up alerts for:
- Server down for > 2 minutes
- Error rate > 5%
- Response time > 2s
- Database connections > 80
- Disk usage > 80%

---

## Troubleshooting

### Server Issues

#### Server Won't Start

**Symptoms:**
- Service shows as "Build failed" or "Deploy failed"
- Logs show import errors or missing dependencies

**Diagnosis:**
```bash
# Check logs
render logs spyder-server --tail

# Common error patterns
render logs spyder-server | grep -i "error\|failed\|exception"
```

**Solutions:**

1. **Missing Dependencies**
   ```bash
   # Verify requirements.txt is complete
   cat server/requirements.txt

   # Add missing packages
   pip freeze | grep <package-name> >> server/requirements.txt
   git commit -am "Add missing dependency"
   git push
   ```

2. **Python Version Mismatch**
   ```bash
   # Check runtime.txt
   cat server/runtime.txt
   # Should be: python-3.11.6
   ```

3. **Environment Variables Missing**
   ```bash
   # Check env vars
   render services env spyder-server

   # Add missing var
   render services env spyder-server set KEY=value
   ```

4. **Database Connection Failed**
   ```bash
   # Verify DATABASE_URL is set
   render services env spyder-server | grep DATABASE_URL

   # Check database status
   render databases list
   ```

#### Server Running but Not Responding

**Symptoms:**
- Service shows as "Live" but endpoints return errors
- Health check fails
- WebSocket connections fail

**Diagnosis:**
```bash
# Test connectivity
curl -v https://spyder-server.onrender.com/api/health

# Check recent logs
render logs spyder-server --num 100

# Test WebSocket
wscat -c wss://spyder-server.onrender.com/socket.io/
```

**Solutions:**

1. **Port Binding Issue**
   ```bash
   # Verify startCommand uses $PORT
   # Should be: uvicorn app.main:socket_app --host 0.0.0.0 --port $PORT
   ```

2. **CORS Issues**
   ```bash
   # Check CORS_ORIGINS env var
   render services env spyder-server | grep CORS_ORIGINS

   # Should include dashboard URL
   # '["https://spyder-dashboard.onrender.com","https://spyder-server.onrender.com"]'
   ```

3. **Database Not Ready**
   ```bash
   # Server may start before DB is ready
   # Check for connection retry logic in code
   # May need to restart service
   render services restart spyder-server
   ```

#### High Memory/CPU Usage

**Symptoms:**
- Service slow to respond
- Frequent restarts
- "Out of memory" errors

**Diagnosis:**
```bash
# Check metrics in Render dashboard
# https://dashboard.render.com → Service → Metrics

# Review logs for memory warnings
render logs spyder-server | grep -i "memory\|oom"
```

**Solutions:**

1. **Memory Leak**
   - Review recent code changes
   - Check for unclosed connections
   - Look for large object retention

2. **Too Many Connections**
   - Implement connection pooling
   - Set max connections limit
   - Add rate limiting

3. **Upgrade Plan**
   ```bash
   # Free tier: 512MB RAM
   # Starter: 2GB RAM ($7/mo)
   # Standard: 4GB RAM ($25/mo)
   ```

### Dashboard Issues

#### Build Fails

**Symptoms:**
- Deploy fails during build step
- "npm install" or "npm run build" errors

**Diagnosis:**
```bash
# Check dashboard logs
render logs spyder-dashboard --tail

# Test build locally
cd dashboard
npm install
npm run build
```

**Solutions:**

1. **Dependency Issues**
   ```bash
   # Update package-lock.json
   cd dashboard
   npm install
   git add package-lock.json
   git commit -m "Update dependencies"
   git push
   ```

2. **TypeScript Errors**
   ```bash
   # Check for type errors
   npm run build

   # Fix type errors in code
   ```

3. **Node Version**
   - Render uses Node 18+ by default
   - Verify compatibility

#### Dashboard Loads but Can't Connect to Server

**Symptoms:**
- Dashboard loads in browser
- Console shows WebSocket connection errors
- "Failed to connect to server" message

**Diagnosis:**
```bash
# Check browser console (F12)
# Look for CORS or WebSocket errors

# Verify server URL in config
cat dashboard/src/config/index.ts
```

**Solutions:**

1. **Wrong Server URL**
   ```typescript
   // dashboard/src/config/index.ts
   const SERVER_URL = 'https://spyder-server.onrender.com';
   // Ensure this matches actual server URL
   ```

2. **CORS Not Configured**
   ```bash
   # Update server CORS_ORIGINS
   render services env spyder-server set \
     CORS_ORIGINS='["https://spyder-dashboard.onrender.com","https://spyder-server.onrender.com"]'
   ```

3. **Server Down**
   ```bash
   # Check server health
   curl https://spyder-server.onrender.com/api/health
   ```

### Mobile App Issues

#### App Won't Build

**Symptoms:**
- Xcode build fails
- CocoaPods errors
- Signing errors

**Solutions:**

1. **CocoaPods Issues**
   ```bash
   cd mobile/ios
   pod deintegrate
   pod install
   ```

2. **Signing Issues**
   - Xcode → Preferences → Accounts
   - Download certificates
   - Xcode → Project → Signing & Capabilities
   - Select valid team and provisioning profile

3. **Derived Data**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData
   # Then rebuild in Xcode
   ```

#### App Won't Connect to Server

**Symptoms:**
- App installs but can't pair
- Network errors in console
- "Unable to connect" messages

**Solutions:**

1. **Wrong Server URL**
   ```typescript
   // mobile/src/config/index.ts
   const SERVER_URL = 'https://spyder-server.onrender.com';
   // Verify this is correct
   ```

2. **Server Not Accessible**
   ```bash
   # Test from mobile device browser
   # Open Safari on device
   # Navigate to: https://spyder-server.onrender.com/api/health
   ```

3. **Push Notifications Not Working**
   - Verify Firebase configuration
   - Check APNs certificate in Firebase console
   - Verify GoogleService-Info.plist is included

### Database Issues

#### Database Connection Errors

**Symptoms:**
- Server logs show "connection refused"
- "Database not available" errors

**Solutions:**

1. **Check Database Status**
   ```bash
   render databases list
   # Verify database is "available"
   ```

2. **Verify Connection String**
   ```bash
   render services env spyder-server | grep DATABASE_URL
   # Should be postgresql:// URL
   ```

3. **Connection Pool Exhausted**
   - Check for unclosed connections in code
   - Increase pool size if needed
   - Review connection handling

#### Database Performance Issues

**Symptoms:**
- Slow query performance
- Timeouts
- High CPU on database

**Solutions:**

1. **Add Indexes**
   ```sql
   -- Example: Add index on device_id
   CREATE INDEX idx_devices_device_id ON devices(device_id);
   ```

2. **Optimize Queries**
   - Review slow query logs
   - Use EXPLAIN to analyze queries
   - Add appropriate indexes

3. **Upgrade Database Plan**
   - Free tier: 1GB, limited performance
   - Paid tier: Better performance, backups

---

## Maintenance Tasks

### Daily Tasks

- [ ] Check service status
  ```bash
  render services list
  ```

- [ ] Review error logs
  ```bash
  render logs spyder-server | grep -i error | tail -20
  ```

- [ ] Monitor resource usage
  - Check Render dashboard metrics
  - CPU < 80%
  - Memory < 80%

### Weekly Tasks

- [ ] Review security alerts (GitHub Dependabot)
- [ ] Check disk usage
  ```bash
  # Via Render dashboard
  ```
- [ ] Review database performance
- [ ] Test backup restoration
- [ ] Update dependencies (if needed)
  ```bash
  # Server
  cd server
  pip list --outdated

  # Dashboard
  cd dashboard
  npm outdated
  ```

### Monthly Tasks

- [ ] Security audit
  - Review access logs
  - Check for unauthorized access
  - Verify SSL certificates

- [ ] Performance review
  - Analyze response times
  - Review error rates
  - Optimize slow endpoints

- [ ] Dependency updates
  ```bash
  # Update Python dependencies
  cd server
  pip install --upgrade <package>
  pip freeze > requirements.txt

  # Update Node dependencies
  cd dashboard
  npm update
  npm audit fix
  ```

- [ ] Database maintenance
  - Review table sizes
  - Vacuum if needed
  - Check for unused indexes

### Quarterly Tasks

- [ ] Disaster recovery drill
- [ ] Security penetration testing
- [ ] Performance benchmarking
- [ ] Infrastructure cost review
- [ ] Backup strategy review

### Database Backup

**Automatic Backups (Render):**
- Free tier: Daily backups, 7-day retention
- Paid tier: Configurable frequency and retention

**Manual Backup:**
```bash
# Via Render dashboard
# Services → Database → Backups → Create Backup

# Via pg_dump (if direct access)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**Restore from Backup:**
```bash
# Via Render dashboard
# Services → Database → Backups → Restore

# Manual restore
psql $DATABASE_URL < backup_20250202.sql
```

---

## CI/CD Pipeline

### GitHub Actions Setup (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install server dependencies
        working-directory: ./server
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio

      - name: Run server tests
        working-directory: ./server
        run: pytest

      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dashboard dependencies
        working-directory: ./dashboard
        run: npm ci

      - name: Build dashboard
        working-directory: ./dashboard
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Render
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
        run: |
          curl -X POST \
            -H "Authorization: Bearer $RENDER_API_KEY" \
            https://api.render.com/v1/services/<SERVICE_ID>/deploys
```

### Continuous Testing

```yaml
# .github/workflows/test.yml
name: Run Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [develop]

jobs:
  test-server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: |
          cd server
          pip install -r requirements.txt
          pytest --cov=app tests/

  test-dashboard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: |
          cd dashboard
          npm ci
          npm run lint
          npm run build

  test-mobile:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: |
          cd mobile
          npm ci
          npm test
```

---

## Security & Compliance

### Security Checklist

- [ ] HTTPS enabled (automatic on Render)
- [ ] JWT secrets rotated regularly
- [ ] Database credentials secure
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using ORM)
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Secrets not in code (use env vars)
- [ ] Dependencies regularly updated
- [ ] Security headers configured

### Environment Variables Security

```bash
# Never commit these to git
JWT_SECRET=<auto-generated>
SECRET_KEY=<auto-generated>
DATABASE_URL=<auto-configured>

# Rotate secrets regularly (quarterly)
render services env spyder-server set JWT_SECRET=<new-secret>
render services env spyder-server set SECRET_KEY=<new-secret>
```

### Security Headers

Ensure these headers are set (via FastAPI middleware):

```python
# server/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

### Vulnerability Scanning

```bash
# Python dependencies
pip install safety
safety check

# Node dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Manual review of high-severity issues
```

---

## Disaster Recovery

### Recovery Time Objective (RTO)
- Target: < 1 hour

### Recovery Point Objective (RPO)
- Target: < 24 hours (daily backups)

### Disaster Scenarios

#### 1. Complete Service Outage

**Recovery Steps:**

1. **Check Render Status**
   - Visit https://status.render.com
   - Check for platform-wide issues

2. **Verify Services**
   ```bash
   render services list
   ```

3. **Restart Services**
   ```bash
   render services restart spyder-server
   render services restart spyder-dashboard
   ```

4. **If Services Won't Start**
   - Check logs for errors
   - Rollback to previous deployment
   - Deploy from backup

#### 2. Database Corruption/Loss

**Recovery Steps:**

1. **Stop Server**
   ```bash
   render services suspend spyder-server
   ```

2. **Restore from Backup**
   - Go to Render dashboard
   - Database → Backups
   - Select latest backup
   - Click "Restore"

3. **Verify Data**
   ```bash
   # Connect to database
   psql $DATABASE_URL

   # Check critical tables
   SELECT COUNT(*) FROM devices;
   SELECT COUNT(*) FROM controllers;
   ```

4. **Resume Service**
   ```bash
   render services resume spyder-server
   ```

#### 3. Accidental Data Deletion

**Recovery Steps:**

1. **Identify Scope**
   - What was deleted?
   - When did it happen?

2. **Stop Further Damage**
   - Suspend service if needed
   - Revoke API keys if compromised

3. **Restore from Backup**
   - Use point-in-time recovery if available
   - Or restore full backup

4. **Verify Recovery**
   - Check data integrity
   - Test application functionality

#### 4. Security Breach

**Immediate Actions:**

1. **Contain**
   ```bash
   # Suspend services
   render services suspend spyder-server

   # Rotate all secrets
   render services env spyder-server set JWT_SECRET=<new>
   render services env spyder-server set SECRET_KEY=<new>
   ```

2. **Investigate**
   - Review access logs
   - Identify breach vector
   - Document findings

3. **Remediate**
   - Patch vulnerabilities
   - Update dependencies
   - Strengthen security

4. **Notify**
   - Notify affected users
   - Report to authorities if required

5. **Resume**
   - Deploy patched version
   - Monitor closely

### Backup Strategy

**What to Back Up:**
- Database (automatic via Render)
- Application code (in Git)
- Environment variables (document separately)
- SSL certificates (automatic via Render)

**Backup Schedule:**
- Database: Daily (automatic)
- Code: Every commit (Git)
- Config: Weekly manual export

**Testing Backups:**
- Monthly: Restore backup to staging
- Quarterly: Full disaster recovery drill

---

## Performance Optimization

### Server Optimization

```python
# Enable caching
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

@app.on_event("startup")
async def startup():
    FastAPICache.init(InMemoryBackend())

# Add cache to endpoints
@app.get("/api/devices")
@cache(expire=60)
async def get_devices():
    # ...
```

### Database Optimization

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_devices_controller_id ON devices(controller_id);
CREATE INDEX idx_recordings_device_id ON recordings(device_id);
CREATE INDEX idx_recordings_created_at ON recordings(created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM devices WHERE controller_id = '...';
```

### Dashboard Optimization

```javascript
// Code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Image optimization
// Use WebP format
// Lazy load images

// Bundle size analysis
npm run build
npx vite-bundle-visualizer
```

---

## Cost Optimization

### Current Costs (Free Tier)
- Server: $0
- Database: $0
- Dashboard: $0
- **Total: $0/month**

**Limitations:**
- 750 hours/month shared across services
- Server spins down after 15min inactivity
- 30s cold start time
- 1GB database storage

### Recommended Production Setup
- Server: Starter ($7/mo)
- Database: Standard ($20/mo)
- Dashboard: Free
- **Total: $27/month**

**Benefits:**
- Always on (no cold starts)
- 10GB database storage
- Daily backups with 30-day retention
- Better performance
- Priority support

### Cost Monitoring

```bash
# Via Render dashboard
# Billing → Usage

# Set up billing alerts
# Dashboard → Settings → Billing → Alerts
```

---

## Quick Troubleshooting Decision Tree

```
Service Issue?
│
├─ Server not responding
│  ├─ Check logs → render logs spyder-server --tail
│  ├─ Check status → render services list
│  └─ Restart → render services restart spyder-server
│
├─ Dashboard not loading
│  ├─ Check build status → Render dashboard
│  ├─ Check server connection → Browser console
│  └─ Verify URL → dashboard/src/config/index.ts
│
├─ Mobile app can't connect
│  ├─ Check server URL → mobile/src/config/index.ts
│  ├─ Test server → curl https://spyder-server.onrender.com/api/health
│  └─ Check Firebase config → GoogleService-Info.plist
│
├─ Database issues
│  ├─ Check connection → render databases list
│  ├─ Check logs → render logs spyder-server | grep database
│  └─ Verify env var → render services env spyder-server | grep DATABASE
│
└─ Performance issues
   ├─ Check metrics → Render dashboard
   ├─ Review logs → Look for slow queries
   └─ Consider upgrade → Paid tier
```

---

## References

- [Render Documentation](https://render.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Documentation](https://react.dev)
- [React Native Documentation](https://reactnative.dev)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Socket.IO Documentation](https://socket.io/docs/)

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-02-02 | 1.0.0 | Initial DevOps guide created | Claude |

---

**Last Updated**: 2025-02-02
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
