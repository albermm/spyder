# Production Deployment Guide

This guide covers deploying all three components of the RemoteEye system to production.

## Components

1. **Server** - Python/FastAPI backend (Render.com)
2. **Dashboard** - React/Vite web UI (Render.com)
3. **Mobile** - React Native iOS app (App Store)

## Prerequisites

- [Render.com](https://render.com) account
- [Apple Developer Account](https://developer.apple.com) ($99/year)
- Render CLI installed: `brew install render`
- Xcode installed (for iOS deployment)

---

## 1. Server & Dashboard Deployment (Render.com)

The server and dashboard are configured to deploy together using the `render.yaml` blueprint.

### Step 1: Connect to Render

```bash
# Login to Render
render login

# Verify login
render whoami
```

### Step 2: Deploy Using Blueprint

```bash
# From the project root directory
render blueprint launch

# Or push to GitHub and connect via Render dashboard
```

This will create:
- **spyder-server** - Backend API at `https://spyder-server.onrender.com`
- **spyder-dashboard** - Frontend at `https://spyder-dashboard.onrender.com`
- **remoteeye-db** - PostgreSQL database (free tier)

### Step 3: Verify Environment Variables

The following environment variables are auto-configured:

**Server:**
- `JWT_SECRET` - Auto-generated
- `SECRET_KEY` - Auto-generated
- `DATABASE_URL` - Auto-linked to PostgreSQL
- `CORS_ORIGINS` - Set to dashboard URL
- Other settings from `.env.example`

**Dashboard:**
- `NODE_ENV` - Set to production

### Step 4: Update Dashboard Server URL (if needed)

If your server deploys to a different URL, update:
```typescript
// dashboard/src/config/index.ts
const SERVER_URL = 'https://YOUR-SERVER-URL.onrender.com';
```

### Step 5: Verify Deployment

```bash
# Check server status
curl https://spyder-server.onrender.com/api/health

# Check dashboard (opens in browser)
open https://spyder-dashboard.onrender.com
```

### Manual Deployment (Alternative)

If you prefer deploying manually:

```bash
# Deploy server
cd server
render services create web \
  --name spyder-server \
  --runtime python \
  --buildCommand "pip install -r requirements.txt" \
  --startCommand "uvicorn app.main:socket_app --host 0.0.0.0 --port \$PORT"

# Deploy dashboard
cd dashboard
render services create web \
  --name spyder-dashboard \
  --runtime static \
  --buildCommand "npm install && npm run build" \
  --publish dist
```

---

## 2. iOS App Deployment (App Store)

### Prerequisites

1. Apple Developer Account enrolled
2. App Store Connect account access
3. Valid signing certificates and provisioning profiles
4. Xcode installed with latest iOS SDK

### Step 1: Configure App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+ (Add App)**
3. Fill in app information:
   - **Name**: Confyg (or your preferred name)
   - **Primary Language**: English
   - **Bundle ID**: Create new (e.g., `com.yourcompany.confyg`)
   - **SKU**: confyg-ios-001
   - **User Access**: Full Access

### Step 2: Configure Xcode Project

```bash
cd mobile/ios
open RemoteEyeMobile.xcworkspace
```

In Xcode:

1. **Select the project** in the navigator
2. **General tab**:
   - Set **Bundle Identifier** (must match App Store Connect)
   - Set **Version** to `1.0.0`
   - Set **Build** to `1`
   - Choose your **Team** (Apple Developer account)

3. **Signing & Capabilities**:
   - Enable **Automatically manage signing**
   - Select your **Team**
   - Verify **Provisioning Profile** is valid

4. **Info tab**: Verify all permissions are set:
   - Camera Usage Description
   - Microphone Usage Description
   - Location Usage Descriptions
   - Background Modes

### Step 3: Build for Release

1. In Xcode, select target device: **Any iOS Device (arm64)**
2. **Product** → **Scheme** → **Edit Scheme**
3. Set **Build Configuration** to **Release**
4. **Product** → **Archive**
5. Wait for build to complete

### Step 4: Upload to App Store Connect

1. Once archived, **Organizer** window opens automatically
2. Select your archive
3. Click **Distribute App**
4. Choose **App Store Connect**
5. Click **Upload**
6. Complete the upload process

### Step 5: Submit for Review

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Click **+ Version** if needed
4. Fill in required information:
   - Screenshots (required)
   - Description
   - Keywords
   - Support URL
   - Privacy Policy URL
5. Select the uploaded build
6. Answer questionnaire about encryption and privacy
7. Click **Submit for Review**

### TestFlight (Beta Testing)

Before submitting to App Store, test via TestFlight:

1. After uploading build, go to **TestFlight** tab
2. Add **Internal Testers** (your team)
3. Add **External Testers** (beta users)
4. Click **Start Testing**
5. Testers receive email with TestFlight invite

---

## 3. Post-Deployment Verification

### Server Health Check

```bash
curl https://spyder-server.onrender.com/api/health
# Expected: {"status": "ok"}
```

### WebSocket Connection Test

```bash
# Test WebSocket endpoint
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  https://spyder-server.onrender.com/socket.io/
```

### Dashboard Test

1. Visit `https://spyder-dashboard.onrender.com`
2. Create test account
3. Verify login works
4. Check console for connection errors

### Mobile App Test

1. Install app from TestFlight or App Store
2. Pair with dashboard using pairing code
3. Test camera streaming
4. Test audio streaming
5. Test location tracking
6. Test background modes
7. Test push notifications

---

## 4. Production Configuration

### Server Environment Variables

Update these in Render dashboard as needed:

```bash
# Security
JWT_SECRET=<auto-generated>
SECRET_KEY=<auto-generated>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=<auto-configured>

# CORS
CORS_ORIGINS=["https://spyder-dashboard.onrender.com","https://spyder-server.onrender.com"]

# App Settings
PAIRING_CODE_EXPIRE_MINUTES=10
RATE_LIMIT_PER_MINUTE=60
LOG_LEVEL=INFO
```

### Firebase Configuration (Mobile App)

The app uses Firebase Cloud Messaging for push notifications. Ensure:

1. `GoogleService-Info.plist` is in `mobile/ios/RemoteEyeMobile/`
2. Firebase project is configured with:
   - Cloud Messaging enabled
   - APNs certificate uploaded
   - Correct bundle ID registered

### Database Migrations

If you make schema changes:

```bash
# SSH into Render server (if needed)
render shell <service-name>

# Run migrations (if using Alembic)
alembic upgrade head
```

---

## 5. Monitoring & Maintenance

### Render Logs

```bash
# View server logs
render logs <service-name> --tail

# Or via dashboard
# https://dashboard.render.com → Services → Logs
```

### Database Backups

Render.com free tier includes:
- Automatic daily backups
- 7-day retention
- Manual backup option in dashboard

For production, consider upgrading to paid tier for:
- More frequent backups
- Longer retention
- Point-in-time recovery

### App Store Updates

When releasing updates:

1. Increment **Build** number (e.g., 1 → 2)
2. Update **Version** if needed (e.g., 1.0.0 → 1.0.1)
3. Build new archive
4. Upload to App Store Connect
5. Update "What's New" section
6. Submit for review

---

## 6. Troubleshooting

### Server Won't Start

Check logs for errors:
```bash
render logs spyder-server --tail
```

Common issues:
- Missing environment variables
- Database connection failed
- Port binding issues

### Dashboard Build Fails

Check build logs in Render dashboard. Common issues:
- Node version mismatch
- Missing dependencies
- TypeScript errors

### iOS Build Fails

Common issues:
- Signing certificates expired
- Provisioning profile invalid
- Missing entitlements
- Code signing mismatch

Fix:
1. **Xcode** → **Preferences** → **Accounts**
2. Download latest certificates
3. **Clean Build Folder** (Cmd+Shift+K)
4. Rebuild

### WebSocket Connection Issues

If dashboard can't connect to server:

1. Check CORS settings in server
2. Verify WebSocket endpoint is accessible
3. Check browser console for errors
4. Test with `wscat`:
   ```bash
   npm install -g wscat
   wscat -c wss://spyder-server.onrender.com/socket.io/
   ```

---

## 7. Scaling Considerations

### Free Tier Limitations

Render.com free tier:
- Server spins down after 15 min of inactivity
- Cold start can take 30+ seconds
- 750 hours/month (multiple services share this)
- PostgreSQL: 1GB storage, 100 connections

### Upgrading to Paid Tier

For production use, consider:
- **Starter Plan** ($7/month per service): Always on, no cold starts
- **Standard Plan** ($25/month): More resources, better performance
- **Database**: Paid tier for backups, more storage, better performance

### CDN for Dashboard

Consider using a CDN for the dashboard:
- Faster global access
- Better caching
- Lower bandwidth costs
- Options: Cloudflare, AWS CloudFront, Vercel

---

## 8. Security Checklist

- [ ] HTTPS enabled (Render provides this automatically)
- [ ] JWT secrets are strong and auto-generated
- [ ] Database credentials are secure
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation is in place
- [ ] API endpoints are authenticated
- [ ] Sensitive data is not logged
- [ ] Firebase APNs certificate is uploaded
- [ ] iOS app uses secure communication

---

## Support

For issues:
- Server/Dashboard: Check Render dashboard logs
- iOS: Check Xcode console and device logs
- GitHub Issues: Report bugs and feature requests

---

## Quick Reference

| Component | URL | Platform |
|-----------|-----|----------|
| Server API | `https://spyder-server.onrender.com` | Render.com |
| Dashboard | `https://spyder-dashboard.onrender.com` | Render.com |
| Mobile App | App Store | Apple |
| Database | Internal (PostgreSQL) | Render.com |

**Deployment Commands:**
```bash
# Deploy everything
render blueprint launch

# View logs
render logs spyder-server --tail

# SSH into server
render shell spyder-server
```
