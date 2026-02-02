# DevOps Documentation Index

Welcome to the RemoteEye DevOps documentation. This directory contains all operational procedures, deployment guides, and monitoring configurations.

## 📚 Documentation

### Core Guides

1. **[README.md](./README.md)** - Complete DevOps Agent Guide
   - Infrastructure overview
   - Deployment procedures (server, dashboard, iOS)
   - Monitoring & alerts setup
   - Troubleshooting guides
   - Maintenance tasks
   - CI/CD pipeline configuration
   - Security & compliance
   - Disaster recovery procedures

2. **[runbook.md](./runbook.md)** - Production Runbook
   - Emergency contacts
   - Critical alerts & response procedures
   - Common operational tasks
   - Scheduled maintenance windows
   - Health check procedures
   - Incident response process
   - Performance baselines

3. **[monitoring-setup.md](./monitoring-setup.md)** - Monitoring Configuration
   - Uptime monitoring (UptimeRobot)
   - Log aggregation
   - Error tracking (Sentry)
   - Application metrics
   - Alert configuration
   - Database monitoring
   - Mobile app monitoring

### Scripts

Located in `scripts/` directory:

- **[health-check.sh](./scripts/health-check.sh)** - Automated health checks
  - Verifies server, dashboard, database status
  - Tests SSL certificates
  - Measures response times
  - Run: `./scripts/health-check.sh`

- **[smoke-test.sh](./scripts/smoke-test.sh)** - Post-deployment smoke tests
  - Validates critical functionality after deployment
  - Tests all major endpoints
  - Verifies security headers
  - Run: `./scripts/smoke-test.sh`

## 🚀 Quick Start

### For New Team Members

1. **Read the basics**
   - [README.md](./README.md) - Start here for overview
   - [runbook.md](./runbook.md) - Daily operational tasks

2. **Set up access**
   - Get Render.com account access
   - Join on-call rotation
   - Configure alert notifications

3. **Familiarize with tools**
   ```bash
   # Install Render CLI
   brew install render

   # Login
   render login

   # Verify access
   render services list
   ```

4. **Run health check**
   ```bash
   ./scripts/health-check.sh
   ```

### For Deployments

1. **Pre-deployment**
   - Review [README.md#deployment-procedures](./README.md#deployment-procedures)
   - Check all tests pass
   - Create backup

2. **Deploy**
   ```bash
   # Automated deployment
   ./deploy.sh

   # Or manual
   render blueprint launch
   ```

3. **Post-deployment**
   ```bash
   # Run smoke tests
   ./scripts/smoke-test.sh

   # Monitor logs
   render logs spyder-server --tail
   ```

### For Incidents

1. **Check severity** - See [runbook.md#incident-severity-levels](./runbook.md#incident-severity-levels)
2. **Follow response procedure** - See [runbook.md#critical-alerts--response](./runbook.md#critical-alerts--response)
3. **Document in incident report** - Template in [runbook.md#incident-template](./runbook.md#incident-template)

## 📋 Common Tasks

### Check System Health
```bash
./scripts/health-check.sh
```

### View Logs
```bash
# Server logs
render logs spyder-server --tail

# Dashboard logs
render logs spyder-dashboard --tail

# Filter for errors
render logs spyder-server --tail | grep -i error
```

### Deploy New Version
```bash
./deploy.sh
```

### Restart Service
```bash
render services restart spyder-server
```

### Update Environment Variable
```bash
render services env spyder-server set KEY=value
```

### Rollback Deployment
Via Render dashboard: Services → Deployments → Rollback

## 🔍 Finding Information

| What you need | Where to find it |
|---------------|------------------|
| Deployment procedures | [README.md#deployment-procedures](./README.md#deployment-procedures) |
| Emergency response | [runbook.md#critical-alerts--response](./runbook.md#critical-alerts--response) |
| Troubleshooting | [README.md#troubleshooting](./README.md#troubleshooting) |
| Monitoring setup | [monitoring-setup.md](./monitoring-setup.md) |
| Health checks | [runbook.md#health-check-procedures](./runbook.md#health-check-procedures) |
| Incident response | [runbook.md#incident-response](./runbook.md#incident-response) |
| Database operations | [README.md#database-backup](./README.md#database-backup) |
| CI/CD pipeline | [README.md#cicd-pipeline](./README.md#cicd-pipeline) |
| Security checklist | [README.md#security--compliance](./README.md#security--compliance) |
| Disaster recovery | [README.md#disaster-recovery](./README.md#disaster-recovery) |

## 🎯 By Role

### On-Call Engineer
Priority reads:
1. [runbook.md#critical-alerts--response](./runbook.md#critical-alerts--response)
2. [runbook.md#common-tasks](./runbook.md#common-tasks)
3. [runbook.md#incident-response](./runbook.md#incident-response)

Daily tasks:
- Run `./scripts/health-check.sh`
- Review error logs
- Check monitoring dashboards

### DevOps/SRE
Priority reads:
1. [README.md](./README.md) - Complete guide
2. [monitoring-setup.md](./monitoring-setup.md) - Configure monitoring
3. [README.md#cicd-pipeline](./README.md#cicd-pipeline) - Automation

Weekly tasks:
- Review performance metrics
- Update dependencies
- Optimize infrastructure

### Developer
Priority reads:
1. [README.md#deployment-procedures](./README.md#deployment-procedures)
2. [README.md#troubleshooting](./README.md#troubleshooting)
3. [runbook.md#common-tasks](./runbook.md#common-tasks)

When needed:
- Deploy your changes
- Debug production issues
- Review logs

## 📊 Monitoring & Alerts

### Key Dashboards
- **Render Dashboard**: https://dashboard.render.com
- **UptimeRobot**: https://uptimerobot.com (once configured)
- **Sentry**: https://sentry.io (once configured)

### Critical Metrics
- Server uptime: 99.9% target
- Response time: < 500ms
- Error rate: < 0.1%
- Database connections: < 80

### Alert Channels
- Email: [Configure in monitoring-setup.md](./monitoring-setup.md#email-alerts)
- Slack: [Configure in monitoring-setup.md](./monitoring-setup.md#slack-alerts)
- SMS: [Configure in monitoring-setup.md](./monitoring-setup.md#sms-alerts)

## 🔐 Security

### Secrets Management
- All secrets in environment variables
- Never commit secrets to git
- Rotate secrets quarterly
- Use auto-generated values where possible

### Access Control
- Render.com account required for deployments
- GitHub repository access for code
- App Store Connect for iOS releases
- Firebase Console for mobile config

### Security Checklist
See [README.md#security--compliance](./README.md#security--compliance)

## 📅 Maintenance Schedule

### Daily
- Health checks
- Error log review
- Metrics review

### Weekly
- Security alerts review
- Database performance check
- Dependency updates (if needed)

### Monthly
- Security audit
- Performance review
- Documentation update

### Quarterly
- Disaster recovery drill
- Infrastructure cost review
- Secret rotation

## 🆘 Getting Help

### Internal Resources
- DevOps team: [Contact info]
- On-call engineer: See [runbook.md#emergency-contacts](./runbook.md#emergency-contacts)
- Team Slack: [Your Slack channel]

### External Support
- Render.com: https://render.com/support
- Apple Developer: https://developer.apple.com/support
- Firebase: https://firebase.google.com/support

### Documentation Issues
Found an error or outdated information?
1. Update the docs
2. Commit and push
3. Notify the team

## 📝 Contributing to Documentation

### When to Update
- After implementing new features
- After resolving incidents (update troubleshooting)
- When procedures change
- Monthly review cycle

### How to Update
1. Edit the relevant markdown file
2. Update "Last Updated" date
3. Commit with clear message
4. Push to repository

### Documentation Standards
- Use clear, concise language
- Include examples and code snippets
- Keep commands up-to-date
- Test all procedures before documenting

## 🔗 Related Documentation

### Project Root
- [DEPLOYMENT.md](../DEPLOYMENT.md) - User-friendly deployment guide
- [IOS_DEPLOYMENT_CHECKLIST.md](../IOS_DEPLOYMENT_CHECKLIST.md) - iOS deployment steps
- [deploy.sh](../deploy.sh) - Automated deployment script

### Architecture
- [system-design.md](../_architecture/system-design.md) - System architecture
- [api-contracts/](../_architecture/api-contracts/) - API specifications

### Code Repositories
- Server: `server/`
- Dashboard: `dashboard/`
- Mobile: `mobile/`

## 📈 Metrics & KPIs

Track these operational metrics:

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Uptime | 99.9% | < 99.5% |
| Mean Time to Recovery | < 30 min | > 1 hour |
| Deployment Frequency | Weekly | - |
| Change Failure Rate | < 5% | > 10% |
| Response Time (P95) | < 500ms | > 1s |
| Error Rate | < 0.1% | > 1% |

## 🎓 Learning Resources

### Recommended Reading
- [The Phoenix Project](https://itrevolution.com/book/the-phoenix-project/)
- [Site Reliability Engineering](https://sre.google/books/)
- [The DevOps Handbook](https://itrevolution.com/book/the-devops-handbook/)

### Tools Documentation
- [Render Docs](https://render.com/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [React Docs](https://react.dev)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

### Best Practices
- Infrastructure as Code
- Continuous Integration/Deployment
- Monitoring and Observability
- Incident Management
- Disaster Recovery Planning

---

## 📞 Quick Reference Card

### Emergency Response
```bash
# Check service status
render services list

# View logs
render logs spyder-server --tail

# Restart service
render services restart spyder-server

# Rollback deployment
# Use Render dashboard: Services → Deployments → Rollback
```

### Health Checks
```bash
# Automated health check
./scripts/health-check.sh

# Manual server check
curl https://spyder-server.onrender.com/api/health

# Check dashboard
curl -I https://spyder-dashboard.onrender.com
```

### Monitoring
- Render: https://dashboard.render.com
- Logs: `render logs <service> --tail`
- Metrics: Render Dashboard → Metrics

---

**Documentation Version**: 1.0.0
**Last Updated**: 2025-02-02
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
**Next Review**: 2025-03-02
