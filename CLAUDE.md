# Spyder (RemoteEye) - Remote iPhone Monitoring System

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Name** | Spyder / RemoteEye |
| **Purpose** | Remote monitoring of an iPhone from Mac dashboard |
| **Status** | Development |

## Tech Stack

- **iPhone App:** React Native + Expo
- **Mac Dashboard:** React + Vite + TailwindCSS
- **Relay Server:** Python + FastAPI + python-socketio
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **Deployment:** Render (server), Expo (mobile)

## Key Documentation

- `CLAUDE_AUTONOMOUS_BUILD.md` - Detailed autonomous build prompt with agent system
- `DEPLOYMENT.md` - Deployment guide
- `IOS_DEPLOYMENT_CHECKLIST.md` - iOS-specific deployment steps
- `BACKGROUND_WAKE_SOLUTION.md` - Solution for iOS background wake challenges

## Agent Workflow

See `CLAUDE_AUTONOMOUS_BUILD.md` for the full autonomous agent system (Project Manager → Architect → Developer → Tester → Reviewer cycle).

## Contact

- **Owner:** Alberto Martin
- **Orchestrator:** Zeus (Clawdbot)

---

## 🤝 Agent Collective

This project is part of Alberto's agent network. Check the shared knowledge base for cross-project learnings.

**Repository:** https://github.com/albermm/agent-collective

**At session start:**
```bash
cd ~/Coding/agent-collective && git pull origin main
./tools/search.sh "your current task"  # Find relevant solutions
```

**Before ending:**
- Solved something hard? Add to `solutions/`
- Learned something useful? Add to `learnings/`
- Stuck on something? Add to `issues/`
- Had a good idea? Add to `ideas/`

**Scan for relevant knowledge:**
- Check `solutions/` for similar problems
- Check `patterns/` for best practices
- Check `monetization/` for business context

Commit and push your contributions. We learn from each other.
