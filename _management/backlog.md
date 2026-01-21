# RemoteEye - Task Backlog

## Legend
- P0 - Critical (blocking)
- P1 - High priority
- P2 - Medium priority
- P3 - Nice to have

## Phase 1: Foundation (Python Server Core) - COMPLETE

### Completed Sprint
| ID | Task | Status | Agent | Priority | Dependencies |
|----|------|--------|-------|----------|--------------|
| T-001 | Initialize Python project with FastAPI + pyproject.toml | Done | DEV | P0 | - |
| T-002 | Create Pydantic models for all data types | Done | DEV | P0 | T-001 |
| T-003 | Design WebSocket protocol specification | Done | ARCH | P0 | - |
| T-004 | Design REST API contracts | Done | ARCH | P0 | - |
| T-005 | Set up SQLAlchemy with async SQLite | Done | DEV | P0 | T-001 |
| T-006 | Implement device registration endpoint | Done | DEV | P0 | T-002, T-004, T-005 |
| T-007 | Set up python-socketio with ASGI | Done | DEV | P0 | T-001, T-003 |
| T-008 | Implement WebSocket connection handling | Done | DEV | P0 | T-007 |
| T-009 | Implement command queue system | Done | DEV | P0 | T-008 |
| T-010 | Add JWT authentication with python-jose | Done | DEV | P1 | T-001 |
| T-011 | Write pytest tests for all endpoints | Done | TEST | P1 | T-006, T-008, T-009 |
| T-012 | Integration test with wscat/Postman | Done | TEST | P1 | T-011 |

### Phase 1 Exit Criteria - ALL PASSED
- [x] Server starts: `uvicorn app.main:app --reload`
- [x] Device registration works via REST API
- [x] WebSocket connections establish successfully
- [x] Commands queue and deliver to connected devices
- [x] JWT authentication protects endpoints
- [x] All pytest tests pass with >80% coverage

---

## Phase 2: Mobile App Core (React Native CLI - iOS Only) - 85% COMPLETE

### Completed Sprint
| ID | Task | Status | Agent | Priority | Dependencies |
|----|------|--------|-------|----------|--------------|
| T-020 | Initialize React Native CLI project with TypeScript | Done | DEV | P0 | Phase 1 |
| T-021 | Create WebSocket service with auto-reconnect (socket.io-client) | Done | DEV | P0 | T-020 |
| T-022 | Implement camera capture service (react-native-vision-camera) | Done | DEV | P0 | T-021 |
| T-023 | Implement MJPEG frame streaming | Done | DEV | P0 | T-022 |
| T-024 | Implement audio recording service (react-native-audio-recorder-player) | Done | DEV | P0 | T-021 |
| T-025 | Implement sound level detection | Done | DEV | P1 | T-024 |
| T-026 | Implement location tracking (@react-native-community/geolocation) | Done | DEV | P1 | T-021 |
| T-028 | Create status display UI | Done | DEV | P2 | T-021 |

### Remaining Sprint
| ID | Task | Status | Agent | Priority | Dependencies |
|----|------|--------|-------|----------|--------------|
| T-027 | Add background task handling (react-native-background-fetch) | Pending | DEV | P1 | T-021 |
| T-029 | Write mobile service tests | Pending | TEST | P1 | T-023, T-024, T-026 |

---

## Phase 3: Dashboard

### Backlog
| ID | Task | Status | Agent | Priority | Dependencies |
|----|------|--------|-------|----------|--------------|
| T-040 | Initialize Vite + React + TypeScript | Pending | DEV | P0 | Phase 1 |
| T-041 | Set up TailwindCSS | Pending | DEV | P0 | T-040 |
| T-042 | Create WebSocket service | Pending | DEV | P0 | T-040 |
| T-043 | Build device status dashboard | Pending | DEV | P0 | T-042 |
| T-044 | Implement live camera viewer | Pending | DEV | P0 | T-042 |
| T-045 | Create audio player component | Pending | DEV | P1 | T-042 |
| T-046 | Build photo gallery view | Pending | DEV | P1 | T-042 |
| T-047 | Add location map view (Leaflet) | Pending | DEV | P1 | T-042 |
| T-048 | Create settings panel | Pending | DEV | P2 | T-043 |
| T-049 | Write dashboard component tests (Vitest) | Pending | TEST | P1 | T-044, T-045 |

---

## Phase 4: Integration & Polish

### Backlog
| ID | Task | Status | Agent | Priority | Dependencies |
|----|------|--------|-------|----------|--------------|
| T-060 | End-to-end integration testing | Pending | TEST | P0 | Phase 2, Phase 3 |
| T-061 | Offline/reconnect edge case handling | Pending | DEV | P0 | T-060 |
| T-062 | Video quality/framerate optimization | Pending | DEV | P1 | T-060 |
| T-063 | Add battery level monitoring | Pending | DEV | P2 | T-060 |
| T-064 | Performance optimization | Pending | DEV | P2 | T-060 |
| T-065 | Write deployment documentation | Pending | DEV | P1 | T-060 |
| T-066 | Deploy server to Render | Pending | DEV | P0 | T-065 |
| T-067 | Build and test mobile app | Pending | TEST | P0 | T-066 |

---

## Notes
- Tasks are assigned to agents: ARCH (Architect), DEV (Developer), TEST (Tester)
- Dependencies must be completed before a task can start
- Priority determines order within available tasks
- Architecture specs (T-003, T-004) are complete in `_architecture/api-contracts/`
- Phase 1 server is fully functional at `/server/`
- Phase 2 mobile app is 85% complete at `/mobile/`
