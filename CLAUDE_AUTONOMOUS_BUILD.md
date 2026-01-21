# RemoteEye - Autonomous Build Meta-Prompt for Claude Code

## 🎯 Mission Statement

You are Claude Code, tasked with **autonomously building a complete remote iPhone monitoring system**. You will operate as a self-directed AI development team, cycling through specialized agent roles to plan, architect, implement, test, and iterate until the project is complete and fully functional.

---

## 📋 Project Overview

**RemoteEye** - A remote monitoring system allowing a user to:
1. Leave an iPhone in another country
2. Control it remotely from their Mac via a web dashboard
3. Access camera, microphone, location, and photos remotely
4. Handle intermittent connectivity (power outages)

### Technology Stack
| Component | Technology |
|-----------|------------|
| **iPhone App** | React Native + Expo |
| **Mac Dashboard** | React + Vite + TailwindCSS |
| **Relay Server** | Python + FastAPI + python-socketio |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Deployment** | Render (server), Expo (mobile) |

---

## 🤖 Agent System Architecture

You will cycle through these agent roles. Each agent has specific responsibilities and outputs structured artifacts.

### Agent Roles

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS BUILD CYCLE                        │
│                                                                  │
│  ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌─────────┐ │
│  │ PROJECT  │───►│ ARCHITECT │───►│ DEVELOPER │───►│ TESTER  │ │
│  │ MANAGER  │    │           │    │           │    │         │ │
│  └──────────┘    └───────────┘    └───────────┘    └────┬────┘ │
│       ▲                                                  │      │
│       │              ┌───────────┐                       │      │
│       └──────────────│  REVIEWER │◄──────────────────────┘      │
│                      └───────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎭 Agent Definitions

### 1. PROJECT MANAGER Agent
**Trigger**: Start of project, after Review cycles, or when priorities change

**Responsibilities**:
- Maintain the master task backlog in `_management/backlog.md`
- Prioritize tasks based on dependencies and critical path
- Track progress in `_management/progress.md`
- Identify blockers and adjust plans
- Declare milestones and phase transitions

**Output Artifacts**:
```
_management/
├── backlog.md          # Prioritized task list
├── progress.md         # Current status, completed items
├── blockers.md         # Issues requiring attention
└── milestones.md       # Phase completion tracking
```

**Decision Framework**:
```python
if all_phase_n_tasks_complete and tests_passing:
    advance_to_phase_n_plus_1()
elif blocker_detected:
    log_blocker()
    reprioritize()
    assign_to_appropriate_agent()
else:
    current_task = select_highest_priority_incomplete_task()
    if current_task.needs_design:
        route_to_architect()
    else:
        route_to_developer()
```

---

### 2. ARCHITECT Agent
**Trigger**: New feature, complex implementation, or design decision needed

**Responsibilities**:
- Design system architecture and component structure
- Define API contracts and data models
- Create technical specifications for developers
- Make technology decisions with rationale
- Document architecture decisions in ADRs

**Output Artifacts**:
```
_architecture/
├── system-design.md        # Overall architecture
├── api-contracts/          # API specifications
│   ├── websocket-protocol.md
│   └── rest-endpoints.md
├── data-models.md          # Database schemas, Pydantic models
├── component-specs/        # Detailed component designs
│   ├── server/
│   ├── mobile/
│   └── dashboard/
└── decisions/              # Architecture Decision Records
    └── ADR-001-*.md
```

**Specification Template**:
```markdown
## Component: [Name]
### Purpose
[What this component does]

### Interface
[Public API, props, methods]

### Dependencies
[What it needs]

### Implementation Notes
[Key considerations]

### Acceptance Criteria
[How to verify it works]
```

---

### 3. DEVELOPER Agent
**Trigger**: Task with complete specification ready for implementation

**Responsibilities**:
- Implement features according to specifications
- Write clean, documented code
- Follow established patterns and conventions
- Create unit tests alongside implementation
- Update relevant documentation

**Workflow**:
```
1. Read specification from _architecture/
2. Check existing code patterns in codebase
3. Implement feature with tests
4. Run local tests to verify
5. Document any deviations or issues
6. Signal completion to TESTER agent
```

**Code Standards**:

**Python (Server)**:
- Type hints on all functions
- Pydantic models for data validation
- Black + Ruff for formatting/linting
- Docstrings (Google style) for public APIs
- async/await for I/O operations

**TypeScript (Mobile/Dashboard)**:
- Strict mode enabled
- ESLint + Prettier formatting
- Meaningful variable/function names
- JSDoc comments for public APIs
- Error handling with descriptive messages

---

### 4. TESTER Agent
**Trigger**: After DEVELOPER completes implementation

**Responsibilities**:
- Run automated test suites
- Perform integration testing
- Verify acceptance criteria from specs
- Document test results
- Report bugs with reproduction steps

**Output Artifacts**:
```
_testing/
├── test-results/
│   └── [date]-[component].md
├── bug-reports/
│   └── BUG-001-*.md
└── coverage-reports/
```

**Test Execution**:
```bash
# Server tests (Python)
cd server && pytest -v --cov=app --cov-report=term-missing

# Mobile tests
cd mobile && npm test

# Dashboard tests
cd dashboard && npm test

# Integration tests
cd server && pytest tests/integration/ -v
```

**Bug Report Template**:
```markdown
## BUG-[ID]: [Title]
**Severity**: Critical/High/Medium/Low
**Component**: [server/mobile/dashboard]
**Steps to Reproduce**:
1. ...
**Expected**: ...
**Actual**: ...
**Logs/Screenshots**: ...
```

---

### 5. REVIEWER Agent
**Trigger**: After TESTER completes, or periodically

**Responsibilities**:
- Review code quality and patterns
- Check for security vulnerabilities
- Verify documentation completeness
- Assess test coverage
- Provide feedback for improvements

**Review Checklist**:
- [ ] Code follows established patterns
- [ ] No hardcoded secrets or credentials
- [ ] Error handling is comprehensive
- [ ] Tests cover happy path and edge cases
- [ ] Documentation is up to date
- [ ] No obvious security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Type hints complete (Python)
- [ ] Pydantic models validate inputs

---

## 📁 Project Structure

```
remote-eye/
├── _management/              # Project management artifacts
│   ├── backlog.md
│   ├── progress.md
│   └── milestones.md
│
├── _architecture/            # Design documents
│   ├── system-design.md
│   ├── api-contracts/
│   └── decisions/
│
├── _testing/                 # Test artifacts
│   ├── test-results/
│   └── bug-reports/
│
├── server/                   # Python FastAPI relay server
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI application
│   │   ├── config.py         # Pydantic Settings
│   │   ├── models/           # Pydantic & SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── device.py
│   │   │   ├── command.py
│   │   │   └── recording.py
│   │   ├── routes/           # API endpoints
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── devices.py
│   │   │   └── recordings.py
│   │   ├── services/         # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── websocket.py  # Socket.IO handlers
│   │   │   ├── device_manager.py
│   │   │   ├── command_queue.py
│   │   │   └── auth.py
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py   # SQLAlchemy setup
│   │   │   └── crud.py       # Database operations
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── logger.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py       # Pytest fixtures
│   │   ├── test_auth.py
│   │   ├── test_devices.py
│   │   ├── test_websocket.py
│   │   └── integration/
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── Dockerfile
│
├── mobile/                   # React Native + Expo app
│   ├── src/
│   │   ├── App.tsx
│   │   ├── screens/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── components/
│   ├── app.json
│   └── package.json
│
├── dashboard/                # React web dashboard
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   └── hooks/
│   ├── package.json
│   └── vite.config.ts
│
├── shared/                   # Shared TypeScript types
│   ├── types/
│   │   └── index.ts
│   └── package.json
│
└── docker-compose.yml        # Local development
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Server Core)
**Goal**: Working WebSocket server with basic auth

**Tasks**:
1. [ ] Initialize Python project with FastAPI + pyproject.toml
2. [ ] Set up python-socketio with ASGI
3. [ ] Create Pydantic models for all data types
4. [ ] Set up SQLAlchemy with async SQLite
5. [ ] Implement device registration endpoint
6. [ ] Implement WebSocket connection handling
7. [ ] Create command queue system
8. [ ] Add JWT authentication with python-jose
9. [ ] Write pytest tests for all endpoints
10. [ ] Test with wscat/Postman

**Success Criteria**:
- Server starts: `uvicorn app.main:app --reload`
- Can register a device via REST API
- Can establish WebSocket connection
- Commands are queued and delivered
- All tests pass with >80% coverage

---

### Phase 2: Mobile App Core
**Goal**: React Native app that connects to server

**Tasks**:
1. [ ] Initialize Expo project with TypeScript
2. [ ] Create WebSocket service (socket.io-client)
3. [ ] Implement auto-reconnection logic
4. [ ] Add camera access with expo-camera
5. [ ] Implement MJPEG frame capture and send
6. [ ] Add microphone access with expo-av
7. [ ] Implement audio recording and streaming
8. [ ] Add sound level detection
9. [ ] Implement location tracking
10. [ ] Add background task handling
11. [ ] Write tests for services

**Success Criteria**:
- App connects to server reliably
- Camera frames sent over WebSocket
- Audio recording works
- Sound detection triggers recording
- Location updates sent to server
- Reconnects after disconnect

---

### Phase 3: Dashboard
**Goal**: Web dashboard to control the iPhone

**Tasks**:
1. [ ] Initialize Vite + React + TypeScript project
2. [ ] Set up TailwindCSS
3. [ ] Create WebSocket service
4. [ ] Build device status dashboard
5. [ ] Implement live camera viewer (MJPEG)
6. [ ] Create audio player component
7. [ ] Add photo gallery view
8. [ ] Integrate Leaflet for location map
9. [ ] Add settings panel for sound threshold
10. [ ] Implement toast notifications
11. [ ] Write component tests with Vitest

**Success Criteria**:
- Dashboard shows device online/offline
- Live camera feed displays
- Can hear remote audio
- Photos load in gallery
- Location shows on map
- Can adjust settings

---

### Phase 4: Integration & Polish
**Goal**: Complete end-to-end functionality

**Tasks**:
1. [ ] End-to-end testing all features
2. [ ] Handle edge cases (offline, reconnect)
3. [ ] Optimize video frame rate/quality
4. [ ] Add battery level monitoring
5. [ ] Performance optimization
6. [ ] Documentation (README, API docs)
7. [ ] Deployment setup (Render, Expo)

**Success Criteria**:
- Full workflow works: Mac → Server → iPhone → response
- Handles power outages gracefully
- Acceptable latency (<2s for video)
- Deployed and accessible remotely

---

## 🔄 Autonomous Execution Loop

```python
while not project_complete:

    # 1. Project Manager assesses state
    run_agent("PROJECT_MANAGER")
    current_task = select_highest_priority_task()

    if current_task.needs_design:
        # 2. Architect designs solution
        run_agent("ARCHITECT", current_task)
        save_specification()

    # 3. Developer implements
    run_agent("DEVELOPER", current_task)
    write_code()
    write_tests()

    # 4. Tester validates
    run_agent("TESTER", current_task)
    test_results = run_tests()

    if test_results.failed:
        create_bug_report()
        continue  # Loop back, PM will prioritize fix

    # 5. Reviewer checks quality
    run_agent("REVIEWER", current_task)

    if review.issues_found:
        create_improvement_tasks()
        continue

    mark_task_complete()
    update_progress()

    if phase_complete():
        run_integration_tests()
        advance_to_next_phase()

print("🎉 Project Complete!")
```

---

## 🛠️ Agent Invocation Commands

Use these to explicitly switch agent modes:

```
[PM] - Switch to Project Manager mode
[ARCH] - Switch to Architect mode
[DEV] - Switch to Developer mode
[TEST] - Switch to Tester mode
[REV] - Switch to Reviewer mode
[AUTO] - Run autonomous loop
```

---

## 📝 Progress Tracking Format

### backlog.md format:
```markdown
# Backlog

## Current Sprint
| ID | Task | Status | Agent | Priority |
|----|------|--------|-------|----------|
| T-001 | Initialize Python server | 🔄 In Progress | DEV | P0 |
| T-002 | WebSocket service | ⏳ Pending | DEV | P0 |

## Upcoming
| ID | Task | Depends On | Priority |
|----|------|------------|----------|
| T-010 | Camera service | T-002 | P1 |
```

### progress.md format:
```markdown
# Progress Report

## Current Phase: 1 - Foundation
**Started**: 2024-01-20
**Target**: 2024-01-21

## Completed Tasks
- [x] T-001: Initialize Python server (2024-01-20)

## In Progress
- [ ] T-002: WebSocket service (60% complete)

## Blockers
None

## Next Up
- T-003: Device registration
```

---

## 🚦 Start Command

To begin autonomous building, execute this prompt:

```
I am starting the RemoteEye autonomous build.

PHASE 1: Initialize as PROJECT MANAGER
- Create _management/ folder structure
- Create initial backlog from Phase 1 tasks
- Create progress.md with starting state

PHASE 2: Switch to ARCHITECT
- Create _architecture/ folder structure
- Design system architecture
- Define WebSocket protocol
- Define REST API contracts
- Define Pydantic models
- Create component specifications for server

PHASE 3: Switch to DEVELOPER
- Initialize Python FastAPI server
- Implement based on specifications
- Write pytest tests

PHASE 4: Switch to TESTER
- Run all tests with coverage
- Document results

PHASE 5: Switch to REVIEWER
- Review implementation
- Check type hints and validation

PHASE 6: Return to PROJECT MANAGER
- Update progress
- Select next task
- CONTINUE LOOP

Execute autonomously until Phase 1 is complete.
```

---

## 🔐 Security Requirements

1. **No hardcoded secrets** - Use Pydantic Settings + .env
2. **JWT for auth** - python-jose with short-lived tokens
3. **TLS everywhere** - HTTPS/WSS only in production
4. **Input validation** - Pydantic models for ALL inputs
5. **Rate limiting** - slowapi middleware
6. **Device pairing** - One-time secure pairing code
7. **Password hashing** - passlib with bcrypt

---

## ⚡ Quick Reference

### Key Commands
```bash
# Server (Python)
cd server && uvicorn app.main:app --reload --port 8000  # Dev server
cd server && pytest -v --cov=app                        # Run tests
cd server && black app tests && ruff check app          # Format & lint

# Mobile
cd mobile && npx expo start       # Start Expo dev
cd mobile && npm test             # Run tests
cd mobile && eas build            # Build app

# Dashboard
cd dashboard && npm run dev       # Start Vite dev
cd dashboard && npm test          # Run tests
cd dashboard && npm run build     # Build for production
```

### Environment Variables
```env
# Server (.env)
PORT=8000
SECRET_KEY=your-super-secret-key-change-in-production
DATABASE_URL=sqlite+aiosqlite:///./data/remoteeye.db
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# Mobile (app.config.js)
EXPO_PUBLIC_SERVER_URL=http://localhost:8000
EXPO_PUBLIC_WS_URL=ws://localhost:8000

# Dashboard (.env)
VITE_SERVER_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## 🐍 Python Server Dependencies

### pyproject.toml
```toml
[project]
name = "remoteeye-server"
version = "1.0.0"
description = "RemoteEye relay server"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "python-socketio>=5.11.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "aiosqlite>=0.19.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.6",
    "aiofiles>=23.2.0",
    "slowapi>=0.1.9",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "httpx>=0.26.0",
    "black>=24.1.0",
    "ruff>=0.1.0",
]

[tool.black]
line-length = 88
target-version = ["py311"]

[tool.ruff]
line-length = 88
select = ["E", "F", "I", "N", "W", "UP"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## 📦 Server Pydantic Models Reference

```python
# app/models/device.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum

class DeviceStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"

class CameraQuality(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class SoundDetectionSettings(BaseModel):
    enabled: bool = True
    threshold: float = Field(default=-30, ge=-60, le=0)  # dB
    record_duration: int = Field(default=30, ge=5, le=300)  # seconds

class CameraSettings(BaseModel):
    quality: CameraQuality = CameraQuality.MEDIUM
    fps: int = Field(default=10, ge=1, le=30)

class LocationSettings(BaseModel):
    tracking_enabled: bool = True
    update_interval: int = Field(default=300, ge=60, le=3600)  # seconds

class DeviceSettings(BaseModel):
    sound_detection: SoundDetectionSettings = SoundDetectionSettings()
    camera: CameraSettings = CameraSettings()
    location: LocationSettings = LocationSettings()

class DeviceInfo(BaseModel):
    name: str
    model: str
    os_version: str
    app_version: str

class DeviceCreate(BaseModel):
    pairing_code: str
    name: str
    device_info: DeviceInfo

class DeviceResponse(BaseModel):
    id: str
    name: str
    status: DeviceStatus
    last_seen: Optional[datetime]
    settings: DeviceSettings

    class Config:
        from_attributes = True
```

---

## ✅ Definition of Done

The project is complete when:

1. ✅ Server deployed to Render and accessible
2. ✅ Mobile app builds and installs on iPhone
3. ✅ Dashboard accessible via web browser
4. ✅ Can view live camera feed from iPhone on dashboard
5. ✅ Can hear live audio from iPhone on dashboard
6. ✅ Sound detection auto-records and uploads
7. ✅ Can capture photos remotely
8. ✅ Location tracking works
9. ✅ System recovers from power outages
10. ✅ All tests pass (>80% coverage)
11. ✅ Documentation complete

---

## 🎬 BEGIN AUTONOMOUS BUILD

**Instruction to Claude Code**:

Read this entire document. You are now the autonomous development team for RemoteEye. Begin by assuming the PROJECT MANAGER role, create the management artifacts, then cycle through agents to build the complete system.

Work autonomously, making decisions based on the frameworks provided. When you encounter ambiguity, make reasonable assumptions and document them. Test continuously. Iterate until complete.

**START NOW.**
