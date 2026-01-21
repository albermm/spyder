# RemoteEye - Milestones

## Milestone Tracker

### M1: Server Foundation ⏳
**Target**: Day 1
**Status**: Not Started

**Criteria**:
- [ ] Server starts and listens on configured port
- [ ] Device can register via POST /api/devices/register
- [ ] Device can connect via WebSocket
- [ ] Controller can connect via WebSocket
- [ ] Commands flow: Controller → Server → Device
- [ ] Responses flow: Device → Server → Controller
- [ ] JWT authentication works
- [ ] All unit tests pass (>80% coverage)

---

### M2: Mobile App Connects ⏳
**Target**: Day 2-3
**Status**: Not Started

**Criteria**:
- [ ] React Native CLI app builds and runs on iOS device (via Xcode)
- [ ] App connects to server WebSocket
- [ ] App reconnects automatically after disconnect
- [ ] Camera permission granted and frames captured (react-native-vision-camera)
- [ ] Microphone permission granted and audio recorded
- [ ] Location permission granted and coordinates tracked
- [ ] Sound detection triggers automatic recording
- [ ] App works in background (react-native-background-fetch)

---

### M3: Dashboard Control ⏳
**Target**: Day 4-5
**Status**: Not Started

**Criteria**:
- [ ] Dashboard loads in browser
- [ ] Shows device online/offline status
- [ ] Live camera feed displays (<2s latency)
- [ ] Audio playback works
- [ ] Photo gallery loads captured images
- [ ] Map shows device location
- [ ] Settings adjustable (sound threshold)
- [ ] Mobile-responsive design

---

### M4: Production Ready ⏳
**Target**: Day 6
**Status**: Not Started

**Criteria**:
- [ ] Server deployed to Render
- [ ] Mobile app builds for distribution
- [ ] End-to-end flow works over internet
- [ ] Handles network interruptions gracefully
- [ ] Reconnects after power outage simulation
- [ ] Performance acceptable (video latency <3s)
- [ ] Documentation complete
- [ ] Security review passed

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Server uptime | 99% | - |
| Video latency | <2s | - |
| Reconnect time | <10s | - |
| Test coverage | >80% | - |
| Build success | 100% | - |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| iOS background execution limits | High | High | Use significant location + silent push + react-native-background-fetch |
| Render free tier sleeps | Medium | High | Implement aggressive reconnection |
| Native module linking issues | Medium | Medium | Use autolinking, careful pod install |
| Network latency international | Medium | Medium | Optimize frame size, adaptive quality |
