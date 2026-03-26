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
import json

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

# AI Config
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

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

class IntensityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    INTENSE = "INTENSE"

# ========================
# MODELS (Entities)
# ========================

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    fitness_goal: Optional[ProgramType] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    created_at: str
    fitness_goal: Optional[str] = None

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
    intensity: Optional[str] = "MEDIUM"
    duration_mins: Optional[int] = 30
    ai_generated: Optional[bool] = False

class DashboardResponse(BaseModel):
    total_workouts: int
    completed_workouts: int
    streak: int
    completion_percentage: float
    motivational_message: str
    intensity_level: str
    weekly_target: int
    weekly_completed: int

class StreakResponse(BaseModel):
    streak: int
    last_workout_date: Optional[str]

class AIWorkoutPlanRequest(BaseModel):
    program_type: ProgramType
    days: int = Field(default=7, ge=1, le=14)

class AIWorkoutPlanResponse(BaseModel):
    workouts: List[WorkoutResponse]
    coach_message: str
    recommended_intensity: str
    weekly_schedule: str

class CoachMessageResponse(BaseModel):
    message: str
    tip_of_the_day: str
    encouragement: str

class UserGoalUpdate(BaseModel):
    fitness_goal: ProgramType

class WeeklyProgressResponse(BaseModel):
    week_data: List[dict]
    total_this_week: int
    completed_this_week: int
    percentage: float

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
    
    @staticmethod
    async def update_fitness_goal(email: str, fitness_goal: str) -> bool:
        result = await db.users.update_one(
            {"email": email},
            {"$set": {"fitness_goal": fitness_goal}}
        )
        return result.modified_count > 0

class WorkoutRepository:
    @staticmethod
    async def create_many(workouts: List[dict]) -> List[dict]:
        if workouts:
            await db.workouts.insert_many(workouts)
        return [{k: v for k, v in w.items() if k != "_id"} for w in workouts]
    
    @staticmethod
    async def find_by_user_email(email: str) -> List[dict]:
        workouts = await db.workouts.find({"user_email": email}, {"_id": 0}).sort("date", -1).to_list(1000)
        return workouts
    
    @staticmethod
    async def find_by_id(workout_id: str) -> Optional[dict]:
        workout = await db.workouts.find_one({"id": workout_id}, {"_id": 0})
        return workout
    
    @staticmethod
    async def update_completed(workout_id: str, completed: bool) -> bool:
        result = await db.workouts.update_one(
            {"id": workout_id},
            {"$set": {"completed": completed, "completed_at": datetime.now(timezone.utc).isoformat() if completed else None}}
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
    
    @staticmethod
    async def get_recent_workouts(email: str, days: int = 7) -> List[dict]:
        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
        workouts = await db.workouts.find(
            {"user_email": email, "date": {"$gte": cutoff_date}},
            {"_id": 0}
        ).to_list(100)
        return workouts
    
    @staticmethod
    async def get_weekly_stats(email: str) -> dict:
        today = datetime.now(timezone.utc).date()
        start_of_week = today - timedelta(days=today.weekday())
        
        week_data = []
        for i in range(7):
            day = start_of_week + timedelta(days=i)
            day_str = day.isoformat()
            count = await db.workouts.count_documents({
                "user_email": email,
                "date": day_str,
                "completed": True
            })
            week_data.append({
                "day": day.strftime("%a"),
                "date": day_str,
                "completed": count
            })
        
        total = await db.workouts.count_documents({
            "user_email": email,
            "date": {"$gte": start_of_week.isoformat(), "$lte": today.isoformat()}
        })
        completed = await db.workouts.count_documents({
            "user_email": email,
            "date": {"$gte": start_of_week.isoformat(), "$lte": today.isoformat()},
            "completed": True
        })
        
        return {
            "week_data": week_data,
            "total": total,
            "completed": completed
        }

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

class AICoachService:
    """AI-powered workout recommendation service with fallback to rules-based logic"""
    
    MOTIVATIONAL_MESSAGES = {
        "new_user": [
            "Welcome to your fitness journey! Every champion was once a beginner.",
            "The first step is always the hardest. You've already taken it!",
            "Your body can do it. It's your mind you need to convince."
        ],
        "low_streak": [
            "Don't let yesterday's setback stop today's progress!",
            "Every workout counts. Let's build momentum together!",
            "Small progress is still progress. Keep moving forward!"
        ],
        "medium_streak": [
            "You're building great habits! Keep the fire burning!",
            "Consistency is key, and you're proving it every day!",
            "Your dedication is showing. The results will follow!"
        ],
        "high_streak": [
            "You're on fire! Your commitment is truly inspiring!",
            "Champions are made through daily dedication like yours!",
            "Your streak is impressive! You're unstoppable!"
        ],
        "completed_all": [
            "Perfect week! You're a true fitness warrior!",
            "100% completion! Your discipline is legendary!",
            "Outstanding commitment! You've earned your rest!"
        ]
    }
    
    TIPS_BY_GOAL = {
        ProgramType.BEGINNER: [
            "Focus on form over speed - quality reps build a strong foundation.",
            "Rest days are growth days. Don't skip recovery!",
            "Hydrate before, during, and after your workout."
        ],
        ProgramType.WEIGHT_LOSS: [
            "Combine cardio with strength training for optimal fat loss.",
            "Small, frequent meals keep your metabolism active.",
            "Sleep is crucial for weight loss - aim for 7-8 hours."
        ],
        ProgramType.MUSCLE: [
            "Progressive overload is your best friend for muscle growth.",
            "Protein intake should be 0.8-1g per pound of body weight.",
            "Compound movements give you the most bang for your buck."
        ],
        ProgramType.FLEXIBILITY: [
            "Never bounce during stretches - slow and steady wins.",
            "Breathe deeply into each stretch for better results.",
            "Consistency beats intensity in flexibility training."
        ],
        ProgramType.HOME: [
            "Use household items as weights - creativity is key!",
            "Schedule your workout like an important meeting.",
            "Small spaces need big creativity - vertical exercises work!"
        ],
        ProgramType.REHAB: [
            "Listen to your body - pain is a signal, not a challenge.",
            "Slow and controlled movements promote healing.",
            "Ice after exercise if you feel any discomfort."
        ]
    }
    
    INTENSITY_RULES = {
        "new_user": IntensityLevel.LOW,
        "low_completion": IntensityLevel.LOW,
        "medium_completion": IntensityLevel.MEDIUM,
        "high_completion": IntensityLevel.HIGH,
        "champion": IntensityLevel.INTENSE
    }
    
    @staticmethod
    def determine_intensity(completion_percentage: float, streak: int, total_workouts: int) -> IntensityLevel:
        """Rules-based intensity determination"""
        if total_workouts < 5:
            return IntensityLevel.LOW
        if completion_percentage < 30:
            return IntensityLevel.LOW
        if completion_percentage < 60:
            return IntensityLevel.MEDIUM
        if completion_percentage < 85 or streak < 7:
            return IntensityLevel.HIGH
        return IntensityLevel.INTENSE
    
    @staticmethod
    def get_motivational_message(streak: int, completion_percentage: float, total_workouts: int) -> str:
        """Get appropriate motivational message based on user progress"""
        import random
        
        if total_workouts == 0:
            return random.choice(AICoachService.MOTIVATIONAL_MESSAGES["new_user"])
        if completion_percentage >= 100:
            return random.choice(AICoachService.MOTIVATIONAL_MESSAGES["completed_all"])
        if streak >= 7:
            return random.choice(AICoachService.MOTIVATIONAL_MESSAGES["high_streak"])
        if streak >= 3:
            return random.choice(AICoachService.MOTIVATIONAL_MESSAGES["medium_streak"])
        return random.choice(AICoachService.MOTIVATIONAL_MESSAGES["low_streak"])
    
    @staticmethod
    def get_tip_of_day(program_type: Optional[ProgramType]) -> str:
        """Get a tip based on user's fitness goal"""
        import random
        
        if program_type and program_type in AICoachService.TIPS_BY_GOAL:
            return random.choice(AICoachService.TIPS_BY_GOAL[program_type])
        return random.choice(AICoachService.TIPS_BY_GOAL[ProgramType.BEGINNER])
    
    @staticmethod
    async def generate_ai_workout_plan(
        user_email: str,
        program_type: ProgramType,
        days: int,
        user_stats: dict
    ) -> dict:
        """Generate AI-powered workout plan with fallback to rules-based"""
        
        try:
            if EMERGENT_LLM_KEY:
                return await AICoachService._generate_with_ai(
                    user_email, program_type, days, user_stats
                )
        except Exception as e:
            logger.warning(f"AI generation failed, falling back to rules-based: {e}")
        
        # Fallback to rules-based generation
        return await AICoachService._generate_rules_based(
            user_email, program_type, days, user_stats
        )
    
    @staticmethod
    async def _generate_with_ai(
        user_email: str,
        program_type: ProgramType,
        days: int,
        user_stats: dict
    ) -> dict:
        """Generate workouts using GPT-5.2"""
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        intensity = AICoachService.determine_intensity(
            user_stats.get("completion_percentage", 0),
            user_stats.get("streak", 0),
            user_stats.get("total_workouts", 0)
        )
        
        system_prompt = """You are an expert fitness coach AI. Generate personalized workout plans based on user data.
        
        IMPORTANT: Respond ONLY with valid JSON in this exact format:
        {
            "workouts": [
                {
                    "title": "Exercise Name",
                    "description": "Detailed instructions with sets, reps, and form tips",
                    "duration_mins": 30
                }
            ],
            "coach_message": "Personalized motivational message",
            "weekly_schedule": "Brief weekly schedule recommendation"
        }
        
        Guidelines:
        - Adjust workout difficulty based on intensity level
        - Include warm-up and cool-down in the plan
        - Make descriptions actionable and clear
        - Coach message should be motivational and personal
        """
        
        user_prompt = f"""Create a {days}-day workout plan for:

Program Type: {program_type.value}
Intensity Level: {intensity.value}
User Stats:
- Total Workouts Completed: {user_stats.get('total_workouts', 0)}
- Completion Rate: {user_stats.get('completion_percentage', 0)}%
- Current Streak: {user_stats.get('streak', 0)} days
- Weekly Completed: {user_stats.get('weekly_completed', 0)}

Generate exactly {days} workouts appropriate for the {program_type.value} program at {intensity.value} intensity."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"workout-{user_email}-{datetime.now().timestamp()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(text=user_prompt))
        
        # Parse AI response
        try:
            # Extract JSON from response
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            ai_plan = json.loads(response_text)
            
            # Create workout objects
            today = datetime.now(timezone.utc).date()
            workouts = []
            
            for i, workout_data in enumerate(ai_plan.get("workouts", [])[:days]):
                workout_date = today + timedelta(days=i)
                workout = {
                    "id": str(uuid.uuid4()),
                    "title": workout_data.get("title", f"Workout Day {i+1}"),
                    "description": workout_data.get("description", "Complete this workout"),
                    "program_type": program_type.value,
                    "date": workout_date.isoformat(),
                    "completed": False,
                    "user_email": user_email,
                    "intensity": intensity.value,
                    "duration_mins": workout_data.get("duration_mins", 30),
                    "ai_generated": True
                }
                workouts.append(workout)
            
            # Save to database
            if workouts:
                await WorkoutRepository.create_many(workouts)
            
            return {
                "workouts": [WorkoutResponse(**w) for w in workouts],
                "coach_message": ai_plan.get("coach_message", AICoachService.get_motivational_message(
                    user_stats.get("streak", 0),
                    user_stats.get("completion_percentage", 0),
                    user_stats.get("total_workouts", 0)
                )),
                "recommended_intensity": intensity.value,
                "weekly_schedule": ai_plan.get("weekly_schedule", "Follow the plan consistently for best results!")
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            raise Exception("AI response parsing failed")
    
    @staticmethod
    async def _generate_rules_based(
        user_email: str,
        program_type: ProgramType,
        days: int,
        user_stats: dict
    ) -> dict:
        """Fallback rules-based workout generation"""
        
        intensity = AICoachService.determine_intensity(
            user_stats.get("completion_percentage", 0),
            user_stats.get("streak", 0),
            user_stats.get("total_workouts", 0)
        )
        
        templates = WorkoutService.get_enhanced_templates(program_type, intensity)
        today = datetime.now(timezone.utc).date()
        
        workouts = []
        for i in range(min(days, len(templates))):
            template = templates[i % len(templates)]
            workout_date = today + timedelta(days=i)
            workout = {
                "id": str(uuid.uuid4()),
                "title": template["title"],
                "description": template["description"],
                "program_type": program_type.value,
                "date": workout_date.isoformat(),
                "completed": False,
                "user_email": user_email,
                "intensity": intensity.value,
                "duration_mins": template.get("duration_mins", 30),
                "ai_generated": False
            }
            workouts.append(workout)
        
        if workouts:
            await WorkoutRepository.create_many(workouts)
        
        coach_message = AICoachService.get_motivational_message(
            user_stats.get("streak", 0),
            user_stats.get("completion_percentage", 0),
            user_stats.get("total_workouts", 0)
        )
        
        return {
            "workouts": [WorkoutResponse(**w) for w in workouts],
            "coach_message": coach_message,
            "recommended_intensity": intensity.value,
            "weekly_schedule": f"Complete your {program_type.value.replace('_', ' ').title()} workouts consistently for optimal results!"
        }
    
    @staticmethod
    async def get_coach_message(user_email: str) -> CoachMessageResponse:
        """Get personalized coach message"""
        user = await UserRepository.find_by_email(user_email)
        stats = await WorkoutService.get_dashboard(user_email)
        
        program_type = None
        if user and user.get("fitness_goal"):
            try:
                program_type = ProgramType(user["fitness_goal"])
            except ValueError:
                pass
        
        message = AICoachService.get_motivational_message(
            stats.streak,
            stats.completion_percentage,
            stats.total_workouts
        )
        
        tip = AICoachService.get_tip_of_day(program_type)
        
        # Generate encouragement based on time of day
        hour = datetime.now().hour
        if 5 <= hour < 12:
            encouragement = "Great morning energy! Early workouts set the tone for success."
        elif 12 <= hour < 17:
            encouragement = "Afternoon power! A midday workout boosts productivity."
        elif 17 <= hour < 21:
            encouragement = "Evening warrior! End your day strong with this workout."
        else:
            encouragement = "Late night dedication! Remember to get good sleep for recovery."
        
        return CoachMessageResponse(
            message=message,
            tip_of_the_day=tip,
            encouragement=encouragement
        )

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
            "created_at": datetime.now(timezone.utc).isoformat(),
            "fitness_goal": user_data.fitness_goal.value if user_data.fitness_goal else None
        }
        
        await UserRepository.create(user_dict)
        
        token = JwtService.create_token(user_data.email)
        user_response = UserResponse(
            id=user_dict["id"],
            name=user_dict["name"],
            email=user_dict["email"],
            created_at=user_dict["created_at"],
            fitness_goal=user_dict.get("fitness_goal")
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
            created_at=user["created_at"],
            fitness_goal=user.get("fitness_goal")
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
            created_at=user["created_at"],
            fitness_goal=user.get("fitness_goal")
        )
    
    @staticmethod
    async def update_goal(email: str, goal: ProgramType) -> UserResponse:
        await UserRepository.update_fitness_goal(email, goal.value)
        return await AuthService.get_profile(email)

class WorkoutService:
    WORKOUT_TEMPLATES = {
        ProgramType.BEGINNER: {
            IntensityLevel.LOW: [
                {"title": "Gentle Warm-up", "description": "5-minute light walking in place and gentle arm swings", "duration_mins": 20},
                {"title": "Wall Push-ups", "description": "3 sets of 8 reps - Stand arm's length from wall, push away", "duration_mins": 15},
                {"title": "Seated Leg Raises", "description": "3 sets of 10 reps each leg - Sit in chair, extend leg", "duration_mins": 15},
                {"title": "Standing Balance", "description": "Hold onto chair, lift each foot for 20 seconds", "duration_mins": 10},
                {"title": "Relaxation Stretch", "description": "5-minute seated stretching routine", "duration_mins": 15},
            ],
            IntensityLevel.MEDIUM: [
                {"title": "Dynamic Warm-up", "description": "5-minute light cardio: marching, arm circles, hip rotations", "duration_mins": 25},
                {"title": "Bodyweight Squats", "description": "3 sets of 12 reps - Focus on form and depth", "duration_mins": 20},
                {"title": "Modified Push-ups", "description": "3 sets of 10 reps - Knee push-ups with good form", "duration_mins": 20},
                {"title": "Plank Hold", "description": "3 sets of 30 seconds - Keep core engaged", "duration_mins": 15},
                {"title": "Full Body Stretch", "description": "8-minute comprehensive stretch routine", "duration_mins": 20},
            ],
            IntensityLevel.HIGH: [
                {"title": "Active Warm-up", "description": "7-minute cardio: jumping jacks, high knees, butt kicks", "duration_mins": 30},
                {"title": "Squat Pulses", "description": "4 sets of 15 reps - Add pulse at bottom", "duration_mins": 25},
                {"title": "Standard Push-ups", "description": "4 sets of 12 reps - Full range of motion", "duration_mins": 25},
                {"title": "Plank Variations", "description": "Side planks and forearm planks, 45 seconds each", "duration_mins": 20},
                {"title": "Active Recovery", "description": "Yoga flow for flexibility and recovery", "duration_mins": 25},
            ],
            IntensityLevel.INTENSE: [
                {"title": "HIIT Warm-up", "description": "10-minute high-energy warm-up with burpee variations", "duration_mins": 35},
                {"title": "Jump Squats", "description": "4 sets of 15 reps - Explosive movement", "duration_mins": 30},
                {"title": "Decline Push-ups", "description": "4 sets of 15 reps - Feet elevated on chair", "duration_mins": 30},
                {"title": "Plank Challenge", "description": "Mountain climbers, plank jacks, shoulder taps", "duration_mins": 25},
                {"title": "Intense Stretch", "description": "Deep stretching and foam rolling", "duration_mins": 30},
            ],
        },
        ProgramType.WEIGHT_LOSS: {
            IntensityLevel.LOW: [
                {"title": "Walking Cardio", "description": "20-minute brisk walk or march in place", "duration_mins": 25},
                {"title": "Step Touches", "description": "10 minutes of side steps with arm movements", "duration_mins": 15},
                {"title": "Seated Core", "description": "Seated twists and leg lifts, 3 sets of 12", "duration_mins": 15},
                {"title": "Standing Kickbacks", "description": "3 sets of 10 each leg - Hold chair for balance", "duration_mins": 15},
                {"title": "Cool Down Walk", "description": "5-minute slow walking and stretching", "duration_mins": 15},
            ],
            IntensityLevel.MEDIUM: [
                {"title": "Cardio Intervals", "description": "20-minute alternating walk/jog intervals", "duration_mins": 30},
                {"title": "Squat + Punch", "description": "4 sets of 15 reps - Squat then punch forward", "duration_mins": 20},
                {"title": "Mountain Climbers", "description": "4 sets of 30 seconds - Moderate pace", "duration_mins": 20},
                {"title": "Bicycle Crunches", "description": "4 sets of 20 reps - Controlled movement", "duration_mins": 20},
                {"title": "Active Stretch", "description": "Dynamic stretching to maintain heart rate", "duration_mins": 20},
            ],
            IntensityLevel.HIGH: [
                {"title": "HIIT Cardio Blast", "description": "25-minute high-intensity intervals: 40s work, 20s rest", "duration_mins": 35},
                {"title": "Burpee Variations", "description": "4 sets of 12 reps - Full body fat burner", "duration_mins": 25},
                {"title": "Speed Mountain Climbers", "description": "4 sets of 45 seconds - Fast pace", "duration_mins": 25},
                {"title": "Jump Rope Simulation", "description": "5 sets of 1-minute with 30s rest", "duration_mins": 25},
                {"title": "Tabata Core", "description": "4 minutes: 20s all-out, 10s rest x 8", "duration_mins": 25},
            ],
            IntensityLevel.INTENSE: [
                {"title": "Ultimate HIIT", "description": "30-minute extreme intervals: burpees, jumps, sprints", "duration_mins": 45},
                {"title": "Burpee + Tuck Jump", "description": "5 sets of 15 reps - Maximum effort", "duration_mins": 35},
                {"title": "Sprint Intervals", "description": "10 x 30-second all-out sprints", "duration_mins": 30},
                {"title": "Core Crusher", "description": "Non-stop core circuit for 15 minutes", "duration_mins": 30},
                {"title": "Finisher Circuit", "description": "5 rounds: 10 burpees, 20 squats, 30 jumping jacks", "duration_mins": 35},
            ],
        },
        ProgramType.MUSCLE: {
            IntensityLevel.LOW: [
                {"title": "Resistance Intro", "description": "Light resistance band exercises for all major muscles", "duration_mins": 25},
                {"title": "Bodyweight Rows", "description": "3 sets of 10 reps using table or doorframe", "duration_mins": 20},
                {"title": "Wall Sits", "description": "4 sets of 30 seconds - Build leg endurance", "duration_mins": 20},
                {"title": "Incline Push-ups", "description": "3 sets of 12 reps - Hands on elevated surface", "duration_mins": 20},
                {"title": "Mobility Work", "description": "Joint mobility and light stretching", "duration_mins": 20},
            ],
            IntensityLevel.MEDIUM: [
                {"title": "Full Body Strength", "description": "Compound movements targeting all muscle groups", "duration_mins": 35},
                {"title": "Push-up Progressions", "description": "4 sets of 12 reps - Standard to wide grip", "duration_mins": 25},
                {"title": "Lunges + Squats", "description": "4 sets of 10 each - Alternate exercises", "duration_mins": 30},
                {"title": "Inverted Rows", "description": "4 sets of 10 reps - Under a table", "duration_mins": 25},
                {"title": "Core Stability", "description": "Planks, dead bugs, and bird dogs", "duration_mins": 25},
            ],
            IntensityLevel.HIGH: [
                {"title": "Strength Circuit", "description": "High-volume compound movements", "duration_mins": 45},
                {"title": "Diamond Push-ups", "description": "4 sets of 12 reps - Tricep focus", "duration_mins": 30},
                {"title": "Bulgarian Split Squats", "description": "4 sets of 10 each leg - Deep range", "duration_mins": 35},
                {"title": "Pike Push-ups", "description": "4 sets of 10 reps - Shoulder builder", "duration_mins": 30},
                {"title": "Weighted Core", "description": "Add resistance to core exercises", "duration_mins": 30},
            ],
            IntensityLevel.INTENSE: [
                {"title": "Power Strength", "description": "Explosive movements with maximal effort", "duration_mins": 50},
                {"title": "Archer Push-ups", "description": "4 sets of 8 each side - Advanced chest", "duration_mins": 35},
                {"title": "Pistol Squat Progressions", "description": "Work toward single-leg squats", "duration_mins": 40},
                {"title": "Handstand Work", "description": "Wall handstands and shoulder strength", "duration_mins": 35},
                {"title": "Muscle-Up Prep", "description": "Pull-up and dip progressions", "duration_mins": 40},
            ],
        },
        ProgramType.FLEXIBILITY: {
            IntensityLevel.LOW: [
                {"title": "Gentle Stretching", "description": "Basic stretches held for 30 seconds each", "duration_mins": 20},
                {"title": "Neck & Shoulders", "description": "Release tension with gentle movements", "duration_mins": 15},
                {"title": "Seated Forward Fold", "description": "Hamstring stretch with proper breathing", "duration_mins": 15},
                {"title": "Hip Circles", "description": "Gentle hip mobility exercises", "duration_mins": 15},
                {"title": "Relaxation Pose", "description": "5-minute savasana with deep breathing", "duration_mins": 15},
            ],
            IntensityLevel.MEDIUM: [
                {"title": "Dynamic Mobility", "description": "Moving stretches for all joints", "duration_mins": 25},
                {"title": "Sun Salutation A", "description": "5 rounds of classic yoga flow", "duration_mins": 25},
                {"title": "Hip Opener Sequence", "description": "Pigeon, frog, and lizard poses", "duration_mins": 25},
                {"title": "Shoulder Mobility", "description": "Wall slides and arm circles", "duration_mins": 20},
                {"title": "Deep Stretch", "description": "Hold stretches for 45-60 seconds", "duration_mins": 25},
            ],
            IntensityLevel.HIGH: [
                {"title": "Power Yoga Flow", "description": "Challenging vinyasa sequence", "duration_mins": 35},
                {"title": "Sun Salutation B", "description": "7 rounds with warrior variations", "duration_mins": 30},
                {"title": "Advanced Hip Work", "description": "Deep hip openers and splits prep", "duration_mins": 30},
                {"title": "Backbend Series", "description": "Bridge progressions and cobra poses", "duration_mins": 30},
                {"title": "Full Body Release", "description": "Comprehensive yin yoga session", "duration_mins": 35},
            ],
            IntensityLevel.INTENSE: [
                {"title": "Advanced Yoga", "description": "Arm balances and inversions practice", "duration_mins": 45},
                {"title": "Contortion Prep", "description": "Extreme flexibility training", "duration_mins": 40},
                {"title": "Splits Training", "description": "Front and middle splits work", "duration_mins": 40},
                {"title": "Deep Backbends", "description": "Wheel pose and advanced variations", "duration_mins": 40},
                {"title": "Recovery Session", "description": "Restorative poses with props", "duration_mins": 40},
            ],
        },
        ProgramType.HOME: {
            IntensityLevel.LOW: [
                {"title": "Living Room Warm-up", "description": "Gentle movement around your space", "duration_mins": 20},
                {"title": "Couch Exercises", "description": "Tricep dips and incline push-ups on couch", "duration_mins": 20},
                {"title": "Towel Workout", "description": "Use a towel for resistance exercises", "duration_mins": 20},
                {"title": "Chair Squats", "description": "Sit-to-stand from chair, 3 sets of 12", "duration_mins": 20},
                {"title": "Floor Stretching", "description": "Basic stretches on your living room floor", "duration_mins": 20},
            ],
            IntensityLevel.MEDIUM: [
                {"title": "Home Circuit", "description": "5 exercises, 3 rounds using household items", "duration_mins": 30},
                {"title": "Stair Workout", "description": "Step-ups, calf raises, and stair runs", "duration_mins": 25},
                {"title": "Water Bottle Weights", "description": "Use bottles for resistance training", "duration_mins": 25},
                {"title": "Backpack Squats", "description": "Add books to backpack for weighted squats", "duration_mins": 25},
                {"title": "Active Rest", "description": "Yoga and mobility in your bedroom", "duration_mins": 25},
            ],
            IntensityLevel.HIGH: [
                {"title": "HIIT at Home", "description": "High-intensity circuit with no equipment", "duration_mins": 40},
                {"title": "Furniture Workout", "description": "Advanced exercises using chairs and tables", "duration_mins": 35},
                {"title": "Plyometric Circuit", "description": "Jump squats, burpees, and bounds", "duration_mins": 35},
                {"title": "Heavy Backpack Workout", "description": "Loaded carries and weighted exercises", "duration_mins": 35},
                {"title": "Skill Practice", "description": "Work on handstands and L-sits", "duration_mins": 35},
            ],
            IntensityLevel.INTENSE: [
                {"title": "Ultimate Home HIIT", "description": "45-minute extreme bodyweight circuit", "duration_mins": 50},
                {"title": "Apartment-Friendly Cardio", "description": "Low-impact but high-intensity moves", "duration_mins": 45},
                {"title": "Furniture Challenge", "description": "Creative exercises using all furniture", "duration_mins": 45},
                {"title": "Endurance Circuit", "description": "Non-stop movement for 30+ minutes", "duration_mins": 45},
                {"title": "Cool Down & Recover", "description": "Deep stretching and foam rolling", "duration_mins": 40},
            ],
        },
        ProgramType.REHAB: {
            IntensityLevel.LOW: [
                {"title": "Gentle Joint Circles", "description": "Very slow circles for all joints", "duration_mins": 15},
                {"title": "Breathing Exercises", "description": "Diaphragmatic breathing practice", "duration_mins": 15},
                {"title": "Seated Stretches", "description": "Gentle stretches while seated", "duration_mins": 15},
                {"title": "Isometric Holds", "description": "Light muscle activation without movement", "duration_mins": 15},
                {"title": "Relaxation", "description": "Progressive muscle relaxation technique", "duration_mins": 20},
            ],
            IntensityLevel.MEDIUM: [
                {"title": "Joint Mobility", "description": "Controlled movements for joint health", "duration_mins": 20},
                {"title": "Light Resistance", "description": "Resistance band exercises at low intensity", "duration_mins": 25},
                {"title": "Balance Training", "description": "Single-leg stands and weight shifts", "duration_mins": 20},
                {"title": "Core Activation", "description": "Gentle core exercises for stability", "duration_mins": 20},
                {"title": "Foam Rolling", "description": "Self-myofascial release for recovery", "duration_mins": 25},
            ],
            IntensityLevel.HIGH: [
                {"title": "Active Rehab", "description": "Progressive loading exercises", "duration_mins": 30},
                {"title": "Functional Movement", "description": "Movement patterns for daily life", "duration_mins": 30},
                {"title": "Strength Rebuild", "description": "Rebuilding strength with proper form", "duration_mins": 30},
                {"title": "Dynamic Balance", "description": "Challenging balance exercises", "duration_mins": 25},
                {"title": "Integration", "description": "Combining movements into flows", "duration_mins": 30},
            ],
            IntensityLevel.INTENSE: [
                {"title": "Return to Sport", "description": "Sport-specific movement preparation", "duration_mins": 40},
                {"title": "Power Development", "description": "Explosive movements with control", "duration_mins": 35},
                {"title": "Agility Training", "description": "Direction changes and quick feet", "duration_mins": 35},
                {"title": "Full Function", "description": "Complete functional fitness test", "duration_mins": 40},
                {"title": "Performance Ready", "description": "Final rehab phase exercises", "duration_mins": 40},
            ],
        },
    }
    
    @staticmethod
    def get_enhanced_templates(program_type: ProgramType, intensity: IntensityLevel) -> List[dict]:
        """Get workout templates based on program type and intensity"""
        templates = WorkoutService.WORKOUT_TEMPLATES.get(program_type, {})
        return templates.get(intensity, templates.get(IntensityLevel.MEDIUM, []))
    
    @staticmethod
    async def generate_workouts(program_type: ProgramType, user_email: str) -> List[WorkoutResponse]:
        """Generate standard workouts (non-AI)"""
        # Get user stats for intensity calculation
        total = await WorkoutRepository.count_by_user(user_email)
        completed = await WorkoutRepository.count_completed_by_user(user_email)
        completion_pct = (completed * 100 / total) if total > 0 else 0
        streak_data = await WorkoutService.calculate_streak(user_email)
        
        intensity = AICoachService.determine_intensity(completion_pct, streak_data.streak, total)
        templates = WorkoutService.get_enhanced_templates(program_type, intensity)
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
                "user_email": user_email,
                "intensity": intensity.value,
                "duration_mins": template.get("duration_mins", 30),
                "ai_generated": False
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
        
        sorted_dates = sorted([datetime.fromisoformat(d).date() for d in completed_dates], reverse=True)
        today = datetime.now(timezone.utc).date()
        
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
        weekly_stats = await WorkoutRepository.get_weekly_stats(user_email)
        
        completion_percentage = (completed * 100 / total) if total > 0 else 0
        
        # Get motivational message
        motivational_message = AICoachService.get_motivational_message(
            streak_data.streak, completion_percentage, total
        )
        
        # Determine intensity level
        intensity = AICoachService.determine_intensity(completion_percentage, streak_data.streak, total)
        
        return DashboardResponse(
            total_workouts=total,
            completed_workouts=completed,
            streak=streak_data.streak,
            completion_percentage=round(completion_percentage, 1),
            motivational_message=motivational_message,
            intensity_level=intensity.value,
            weekly_target=5,  # Default weekly target
            weekly_completed=weekly_stats["completed"]
        )
    
    @staticmethod
    async def get_weekly_progress(user_email: str) -> WeeklyProgressResponse:
        stats = await WorkoutRepository.get_weekly_stats(user_email)
        percentage = (stats["completed"] * 100 / stats["total"]) if stats["total"] > 0 else 0
        
        return WeeklyProgressResponse(
            week_data=stats["week_data"],
            total_this_week=stats["total"],
            completed_this_week=stats["completed"],
            percentage=round(percentage, 1)
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
    description="Production-ready AI-powered health coaching platform",
    version="2.0.0"
)

api_router = APIRouter(prefix="/api")

# ========================
# CONTROLLERS (Routes)
# ========================

# Health check
@api_router.get("/")
async def root():
    return {"message": "AI HealthCoach API v2.0.0", "status": "healthy", "ai_enabled": bool(EMERGENT_LLM_KEY)}

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

@api_router.put("/user/goal", response_model=UserResponse)
async def update_goal(goal_data: UserGoalUpdate, current_user: str = Depends(get_current_user)):
    """Update user fitness goal"""
    return await AuthService.update_goal(current_user, goal_data.fitness_goal)

# Workout Controller
@api_router.post("/workout/generate/{program_type}", response_model=List[WorkoutResponse])
async def generate_workouts(
    program_type: ProgramType,
    current_user: str = Depends(get_current_user)
):
    """Generate workouts for a program type (rules-based)"""
    return await WorkoutService.generate_workouts(program_type, current_user)

@api_router.post("/workout/ai-plan", response_model=AIWorkoutPlanResponse)
async def generate_ai_workout_plan(
    request: AIWorkoutPlanRequest,
    current_user: str = Depends(get_current_user)
):
    """Generate AI-powered personalized workout plan"""
    # Get user stats
    total = await WorkoutRepository.count_by_user(current_user)
    completed = await WorkoutRepository.count_completed_by_user(current_user)
    streak_data = await WorkoutService.calculate_streak(current_user)
    weekly_stats = await WorkoutRepository.get_weekly_stats(current_user)
    
    user_stats = {
        "total_workouts": total,
        "completed_workouts": completed,
        "completion_percentage": (completed * 100 / total) if total > 0 else 0,
        "streak": streak_data.streak,
        "weekly_completed": weekly_stats["completed"]
    }
    
    result = await AICoachService.generate_ai_workout_plan(
        current_user, request.program_type, request.days, user_stats
    )
    
    return AIWorkoutPlanResponse(**result)

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
    """Get dashboard analytics with motivational message"""
    return await WorkoutService.get_dashboard(current_user)

@api_router.get("/workout/weekly-progress", response_model=WeeklyProgressResponse)
async def get_weekly_progress(current_user: str = Depends(get_current_user)):
    """Get weekly progress data for charts"""
    return await WorkoutService.get_weekly_progress(current_user)

@api_router.get("/coach/message", response_model=CoachMessageResponse)
async def get_coach_message(current_user: str = Depends(get_current_user)):
    """Get personalized coach message"""
    return await AICoachService.get_coach_message(current_user)

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
