from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security config
SECRET_KEY = os.environ.get('JWT_SECRET', 'healthcoach-super-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 1

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========================
# ENUMS
# ========================

class ProgramType(str, Enum):
    BEGINNER = "BEGINNER"
    WEIGHT_LOSS = "WEIGHT_LOSS"
    MUSCLE = "MUSCLE"
    FLEXIBILITY = "FLEXIBILITY"
    HOME = "HOME"
    REHAB = "REHAB"

# ========================
# MODELS (Entities)
# ========================

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class WorkoutResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    description: str
    program_type: str
    date: str
    completed: bool
    user_email: str

class DashboardResponse(BaseModel):
    total_workouts: int
    completed_workouts: int
    streak: int
    completion_percentage: float

class StreakResponse(BaseModel):
    streak: int
    last_workout_date: Optional[str]

# ========================
# REPOSITORY LAYER
# ========================

class UserRepository:
    @staticmethod
    async def find_by_email(email: str) -> Optional[dict]:
        user = await db.users.find_one({"email": email}, {"_id": 0})
        return user
    
    @staticmethod
    async def create(user_data: dict) -> dict:
        await db.users.insert_one(user_data)
        return {k: v for k, v in user_data.items() if k != "_id"}
    
    @staticmethod
    async def exists_by_email(email: str) -> bool:
        count = await db.users.count_documents({"email": email})
        return count > 0

class WorkoutRepository:
    @staticmethod
    async def create_many(workouts: List[dict]) -> List[dict]:
        if workouts:
            await db.workouts.insert_many(workouts)
        return [{k: v for k, v in w.items() if k != "_id"} for w in workouts]
    
    @staticmethod
    async def find_by_user_email(email: str) -> List[dict]:
        workouts = await db.workouts.find({"user_email": email}, {"_id": 0}).to_list(1000)
        return workouts
    
    @staticmethod
    async def find_by_id(workout_id: str) -> Optional[dict]:
        workout = await db.workouts.find_one({"id": workout_id}, {"_id": 0})
        return workout
    
    @staticmethod
    async def update_completed(workout_id: str, completed: bool) -> bool:
        result = await db.workouts.update_one(
            {"id": workout_id},
            {"$set": {"completed": completed}}
        )
        return result.modified_count > 0
    
    @staticmethod
    async def count_by_user(email: str) -> int:
        return await db.workouts.count_documents({"user_email": email})
    
    @staticmethod
    async def count_completed_by_user(email: str) -> int:
        return await db.workouts.count_documents({"user_email": email, "completed": True})
    
    @staticmethod
    async def get_completed_dates(email: str) -> List[str]:
        workouts = await db.workouts.find(
            {"user_email": email, "completed": True},
            {"_id": 0, "date": 1}
        ).to_list(1000)
        return list(set([w["date"] for w in workouts]))

# ========================
# SERVICE LAYER
# ========================

class JwtService:
    @staticmethod
    def create_token(email: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        payload = {
            "sub": email,
            "exp": expire,
            "iat": datetime.now(timezone.utc)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    @staticmethod
    def validate_token(token: str) -> Optional[str]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email: str = payload.get("sub")
            return email
        except JWTError:
            return None

class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    async def register(user_data: UserCreate) -> dict:
        if await UserRepository.exists_by_email(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        
        user_dict = {
            "id": str(uuid.uuid4()),
            "name": user_data.name,
            "email": user_data.email,
            "password": AuthService.hash_password(user_data.password),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await UserRepository.create(user_dict)
        
        token = JwtService.create_token(user_data.email)
        user_response = UserResponse(
            id=user_dict["id"],
            name=user_dict["name"],
            email=user_dict["email"],
            created_at=user_dict["created_at"]
        )
        
        return {"access_token": token, "token_type": "bearer", "user": user_response}
    
    @staticmethod
    async def login(credentials: UserLogin) -> dict:
        user = await UserRepository.find_by_email(credentials.email)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        if not AuthService.verify_password(credentials.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        token = JwtService.create_token(credentials.email)
        user_response = UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            created_at=user["created_at"]
        )
        
        return {"access_token": token, "token_type": "bearer", "user": user_response}
    
    @staticmethod
    async def get_profile(email: str) -> UserResponse:
        user = await UserRepository.find_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            created_at=user["created_at"]
        )

class WorkoutService:
    WORKOUT_TEMPLATES = {
        ProgramType.BEGINNER: [
            {"title": "Basic Warm-up", "description": "5-minute light cardio: jumping jacks, high knees, and arm circles"},
            {"title": "Bodyweight Squats", "description": "3 sets of 10 reps - Focus on form and depth"},
            {"title": "Push-ups (Modified)", "description": "3 sets of 8 reps - Knee push-ups if needed"},
            {"title": "Plank Hold", "description": "3 sets of 20 seconds - Keep core tight"},
            {"title": "Cool Down Stretch", "description": "5-minute full body stretch routine"},
        ],
        ProgramType.WEIGHT_LOSS: [
            {"title": "HIIT Cardio Blast", "description": "20-minute high-intensity intervals: 30s work, 15s rest"},
            {"title": "Burpees Circuit", "description": "4 sets of 12 reps - Full body fat burner"},
            {"title": "Mountain Climbers", "description": "4 sets of 30 seconds - Keep pace fast"},
            {"title": "Jump Rope Intervals", "description": "5 sets of 1-minute with 30s rest"},
            {"title": "Tabata Finisher", "description": "4 minutes: 20s all-out effort, 10s rest x 8"},
        ],
        ProgramType.MUSCLE: [
            {"title": "Barbell Squats", "description": "4 sets of 8-10 reps - Progressive overload focus"},
            {"title": "Bench Press", "description": "4 sets of 8-10 reps - Control the eccentric"},
            {"title": "Deadlifts", "description": "4 sets of 6-8 reps - Maintain neutral spine"},
            {"title": "Overhead Press", "description": "3 sets of 10 reps - Full range of motion"},
            {"title": "Barbell Rows", "description": "4 sets of 8-10 reps - Squeeze at the top"},
        ],
        ProgramType.FLEXIBILITY: [
            {"title": "Dynamic Stretching", "description": "10-minute mobility flow for all joints"},
            {"title": "Yoga Sun Salutation", "description": "5 complete rounds - Flow with breath"},
            {"title": "Hip Opener Sequence", "description": "Pigeon pose, frog stretch, 90/90 stretch"},
            {"title": "Shoulder Mobility", "description": "Wall slides, band pull-aparts, thoracic rotations"},
            {"title": "Deep Stretch Session", "description": "15-minute static holds for major muscle groups"},
        ],
        ProgramType.HOME: [
            {"title": "Living Room Circuit", "description": "5 exercises, 3 rounds: squats, lunges, push-ups, dips, planks"},
            {"title": "Stair Workout", "description": "10 rounds: walk up, jog down, add calf raises at top"},
            {"title": "Chair Exercises", "description": "Tricep dips, step-ups, incline push-ups using chair"},
            {"title": "Resistance Band Full Body", "description": "Rows, curls, lateral raises, squats with bands"},
            {"title": "Core on the Floor", "description": "Dead bugs, bird dogs, crunches, leg raises"},
        ],
        ProgramType.REHAB: [
            {"title": "Joint Warm-up", "description": "Gentle circles for ankles, knees, hips, shoulders, neck"},
            {"title": "Foam Rolling", "description": "10-minute myofascial release for tight areas"},
            {"title": "Balance Training", "description": "Single leg stands, heel-to-toe walks, stability exercises"},
            {"title": "Resistance Band Rehab", "description": "Light resistance exercises for injured area"},
            {"title": "Breathing & Relaxation", "description": "Diaphragmatic breathing and progressive muscle relaxation"},
        ],
    }
    
    @staticmethod
    async def generate_workouts(program_type: ProgramType, user_email: str) -> List[WorkoutResponse]:
        templates = WorkoutService.WORKOUT_TEMPLATES.get(program_type, [])
        today = datetime.now(timezone.utc).date()
        
        workouts = []
        for i, template in enumerate(templates):
            workout_date = today + timedelta(days=i)
            workout = {
                "id": str(uuid.uuid4()),
                "title": template["title"],
                "description": template["description"],
                "program_type": program_type.value,
                "date": workout_date.isoformat(),
                "completed": False,
                "user_email": user_email
            }
            workouts.append(workout)
        
        await WorkoutRepository.create_many(workouts)
        return [WorkoutResponse(**w) for w in workouts]
    
    @staticmethod
    async def get_user_workouts(user_email: str) -> List[WorkoutResponse]:
        workouts = await WorkoutRepository.find_by_user_email(user_email)
        return [WorkoutResponse(**w) for w in workouts]
    
    @staticmethod
    async def complete_workout(workout_id: str, user_email: str) -> WorkoutResponse:
        workout = await WorkoutRepository.find_by_id(workout_id)
        
        if not workout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout not found"
            )
        
        if workout["user_email"] != user_email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify this workout"
            )
        
        new_status = not workout["completed"]
        await WorkoutRepository.update_completed(workout_id, new_status)
        workout["completed"] = new_status
        
        return WorkoutResponse(**workout)
    
    @staticmethod
    async def calculate_streak(user_email: str) -> StreakResponse:
        completed_dates = await WorkoutRepository.get_completed_dates(user_email)
        
        if not completed_dates:
            return StreakResponse(streak=0, last_workout_date=None)
        
        # Sort dates in descending order
        sorted_dates = sorted([datetime.fromisoformat(d).date() for d in completed_dates], reverse=True)
        today = datetime.now(timezone.utc).date()
        
        streak = 0
        current_date = today
        
        for date in sorted_dates:
            if date == current_date or date == current_date - timedelta(days=1):
                if date == current_date - timedelta(days=1):
                    current_date = date
                streak += 1
                current_date = date
            elif date < current_date - timedelta(days=1):
                break
        
        # Recalculate to handle consecutive days properly
        streak = 0
        check_date = today
        
        while check_date in sorted_dates or (check_date - timedelta(days=1)) in sorted_dates:
            if check_date in sorted_dates:
                streak += 1
            check_date -= timedelta(days=1)
            if check_date not in sorted_dates and (check_date) not in sorted_dates:
                break
        
        # Simple streak calculation
        streak = 0
        for i, date in enumerate(sorted_dates):
            expected_date = today - timedelta(days=i)
            if date == expected_date:
                streak += 1
            else:
                break
        
        return StreakResponse(
            streak=streak,
            last_workout_date=sorted_dates[0].isoformat() if sorted_dates else None
        )
    
    @staticmethod
    async def get_dashboard(user_email: str) -> DashboardResponse:
        total = await WorkoutRepository.count_by_user(user_email)
        completed = await WorkoutRepository.count_completed_by_user(user_email)
        streak_data = await WorkoutService.calculate_streak(user_email)
        
        completion_percentage = (completed * 100 / total) if total > 0 else 0
        
        return DashboardResponse(
            total_workouts=total,
            completed_workouts=completed,
            streak=streak_data.streak,
            completion_percentage=round(completion_percentage, 1)
        )

# ========================
# AUTH MIDDLEWARE
# ========================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    email = JwtService.validate_token(token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    user = await UserRepository.find_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return email

# ========================
# FASTAPI APP SETUP
# ========================

app = FastAPI(
    title="AI HealthCoach API",
    description="Production-ready health coaching platform",
    version="1.0.0"
)

api_router = APIRouter(prefix="/api")

# ========================
# CONTROLLERS (Routes)
# ========================

# Health check
@api_router.get("/")
async def root():
    return {"message": "AI HealthCoach API v1.0.0", "status": "healthy"}

# Auth Controller
@api_router.post("/user/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user"""
    return await AuthService.register(user_data)

@api_router.post("/user/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login and get JWT token"""
    return await AuthService.login(credentials)

@api_router.get("/user/profile", response_model=UserResponse)
async def get_profile(current_user: str = Depends(get_current_user)):
    """Get current user profile (Protected)"""
    return await AuthService.get_profile(current_user)

# Workout Controller
@api_router.post("/workout/generate/{program_type}", response_model=List[WorkoutResponse])
async def generate_workouts(
    program_type: ProgramType,
    current_user: str = Depends(get_current_user)
):
    """Generate workouts for a program type"""
    return await WorkoutService.generate_workouts(program_type, current_user)

@api_router.get("/workout/all", response_model=List[WorkoutResponse])
async def get_all_workouts(current_user: str = Depends(get_current_user)):
    """Get all workouts for current user"""
    return await WorkoutService.get_user_workouts(current_user)

@api_router.put("/workout/complete/{workout_id}", response_model=WorkoutResponse)
async def complete_workout(
    workout_id: str,
    current_user: str = Depends(get_current_user)
):
    """Toggle workout completion status"""
    return await WorkoutService.complete_workout(workout_id, current_user)

@api_router.get("/workout/streak", response_model=StreakResponse)
async def get_streak(current_user: str = Depends(get_current_user)):
    """Get user's workout streak"""
    return await WorkoutService.calculate_streak(current_user)

@api_router.get("/workout/dashboard", response_model=DashboardResponse)
async def get_dashboard(current_user: str = Depends(get_current_user)):
    """Get dashboard analytics"""
    return await WorkoutService.get_dashboard(current_user)

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
