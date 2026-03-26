# AI HealthCoach Web Application - PRD

## Original Problem Statement
Build a production-ready AI HealthCoach platform with user authentication, workout generation based on fitness goals, workout tracking, streak system, and dashboard analytics. Initially requested Java/Spring Boot but adapted to FastAPI/React/MongoDB for environment compatibility.

## Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │  Login  │ │Register │ │Dashboard│ │Workouts │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                   Backend (FastAPI)                      │
│  ┌────────────────────────────────────────────────┐     │
│  │              Controller Layer (Routes)          │     │
│  │  /api/user/* │ /api/workout/*                  │     │
│  └──────────────┬─────────────────────────────────┘     │
│  ┌──────────────▼─────────────────────────────────┐     │
│  │               Service Layer                     │     │
│  │  AuthService │ WorkoutService │ JwtService     │     │
│  └──────────────┬─────────────────────────────────┘     │
│  ┌──────────────▼─────────────────────────────────┐     │
│  │              Repository Layer                   │     │
│  │  UserRepository │ WorkoutRepository            │     │
│  └──────────────┬─────────────────────────────────┘     │
└─────────────────┼───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                    MongoDB Database                      │
│  Collections: users, workouts                           │
└─────────────────────────────────────────────────────────┘
```

## User Personas
1. **Fitness Beginner** - Needs guided workout programs
2. **Weight Loss Seeker** - Focused on calorie-burning routines
3. **Muscle Builder** - Strength training focus
4. **Home Exerciser** - No gym equipment
5. **Rehab Patient** - Recovery-focused gentle exercises

## Core Requirements (Static)
- [x] User registration with email/password
- [x] User login with JWT authentication
- [x] Protected routes requiring authentication
- [x] Workout generation by program type (6 types)
- [x] Workout completion tracking
- [x] Streak calculation
- [x] Dashboard analytics

## What's Been Implemented (March 26, 2026)

### Backend (FastAPI)
- ✅ Clean layered architecture (Controller → Service → Repository)
- ✅ JWT authentication with 1-hour expiry
- ✅ BCrypt password encryption
- ✅ Global exception handling (401, 403, 404, 409)
- ✅ All REST APIs implemented

### Frontend (React)
- ✅ Login/Register pages with hero images
- ✅ Dashboard with stats cards and progress
- ✅ Workouts page with program type selection
- ✅ Profile page with achievements
- ✅ Responsive design (dark theme)
- ✅ Toast notifications

### APIs
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/user/register | POST | No | Register new user |
| /api/user/login | POST | No | Login, get JWT |
| /api/user/profile | GET | Yes | Get user profile |
| /api/workout/generate/{type} | POST | Yes | Generate workouts |
| /api/workout/all | GET | Yes | Get all user workouts |
| /api/workout/complete/{id} | PUT | Yes | Toggle completion |
| /api/workout/streak | GET | Yes | Get streak info |
| /api/workout/dashboard | GET | Yes | Get analytics |

## Prioritized Backlog

### P0 (Completed)
- [x] User auth system
- [x] Workout CRUD
- [x] Streak tracking
- [x] Dashboard

### P1 (Future)
- [ ] AI-powered workout recommendations
- [ ] Diet planning module
- [ ] User profile editing
- [ ] Password reset

### P2 (Nice to have)
- [ ] Social features (share workouts)
- [ ] Workout reminders
- [ ] Export data to CSV
- [ ] Dark/Light theme toggle

## Next Tasks
1. Add AI workout recommendations using GPT
2. Implement diet planning module
3. Add user profile editing
4. Implement password reset flow
