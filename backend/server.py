from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
import random
from fastapi import UploadFile, File
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret_key')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============ MODELS ============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    profile_completed: bool = False

class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    profile_completed: bool

class BusinessProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    business_type: str  # "existing" or "starting"
    # For existing businesses
    business_name: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    target_audience: Optional[str] = None
    products_services: Optional[str] = None
    # For starting businesses
    business_idea: Optional[str] = None
    desired_industry: Optional[str] = None
    goals: Optional[str] = None
    # Common fields
    ad_copy_library: Optional[List[str]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BusinessProfileCreate(BaseModel):
    business_type: str
    business_name: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    target_audience: Optional[str] = None
    products_services: Optional[str] = None
    business_idea: Optional[str] = None
    desired_industry: Optional[str] = None
    goals: Optional[str] = None
    ad_copy_library: Optional[List[str]] = Field(default_factory=list)

class FinancialData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    month: str
    revenue: float
    expenses: float
    profit_margin: float
    calls_count: int = 0
    bookings_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FinancialDataCreate(BaseModel):
    month: str
    revenue: float
    expenses: float
    profit_margin: float
    calls_count: int = 0
    bookings_count: int = 0

class AdCampaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    campaign_name: str
    status: str  # "active", "paused", "completed"
    ctr: float  # Click-through rate
    cpc: float  # Cost per click
    roas: float  # Return on ad spend
    spend: float
    conversions: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommunicationFeeds(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    instagram_dm_count: int = 0
    twitter_mention_count: int = 0
    email_count: int = 0
    date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    description: str
    priority: str  # "high", "medium", "low"
    priority_number: Optional[int] = None  # 1-10 ranking
    status: str  # "todo", "in_progress", "completed"
    ai_generated: bool = True
    deadline: Optional[datetime] = None
    chat_session_id: Optional[str] = None  # For task-specific chat
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskCreate(BaseModel):
    title: str
    description: str
    priority: str = "medium"
    status: str = "todo"
    deadline: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[datetime] = None

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    session_type: str = "general"  # "general" or "task"
    task_id: Optional[str] = None  # If session_type is "task"
    role: str  # "user" or "assistant"
    content: str
    model_used: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_type: str  # "general" or "task"
    task_id: Optional[str] = None
    title: str
    last_message: str
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    task_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    model_used: str

class UploadedFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    filename: str
    file_type: str
    file_size: int
    content: str  # Base64 encoded or text content
    analysis: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        'user_id': user_id,
        'exp': expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password)
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Generate token
    token = create_access_token(user.id)
    
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        profile_completed=False
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    # Find user
    user_dict = await db.users.find_one({"email": user_data.email})
    if not user_dict:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(user_data.password, user_dict['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate token
    token = create_access_token(user_dict['id'])
    
    return TokenResponse(
        access_token=token,
        user_id=user_dict['id'],
        profile_completed=user_dict.get('profile_completed', False)
    )

@api_router.get("/auth/me")
async def get_current_user_info(user_id: str = Depends(get_current_user)):
    user_dict = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")
    return user_dict

# ============ BUSINESS PROFILE ENDPOINTS ============

@api_router.post("/profile")
async def create_business_profile(profile_data: BusinessProfileCreate, user_id: str = Depends(get_current_user)):
    # Check if profile already exists
    existing_profile = await db.business_profiles.find_one({"user_id": user_id})
    
    if existing_profile:
        # Update existing profile
        profile_dict = profile_data.model_dump(exclude_unset=True)
        profile_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await db.business_profiles.update_one(
            {"user_id": user_id},
            {"$set": profile_dict}
        )
        
        # Update user profile_completed status
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"profile_completed": True}}
        )
        
        updated_profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
        return updated_profile
    
    # Create new profile
    profile = BusinessProfile(
        user_id=user_id,
        **profile_data.model_dump()
    )
    
    profile_dict = profile.model_dump()
    profile_dict['created_at'] = profile_dict['created_at'].isoformat()
    profile_dict['updated_at'] = profile_dict['updated_at'].isoformat()
    
    await db.business_profiles.insert_one(profile_dict)
    
    # Update user profile_completed status
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"profile_completed": True}}
    )
    
    # Return profile without _id
    created_profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    return created_profile

@api_router.get("/profile")
async def get_business_profile(user_id: str = Depends(get_current_user)):
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

# ============ DASHBOARD DATA ENDPOINTS ============

@api_router.get("/dashboard")
async def get_dashboard_data(user_id: str = Depends(get_current_user)):
    # Get financial data (simulated)
    financial_data = list(await db.financial_data.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(6).to_list(6))
    
    # If no data, generate simulated data
    if not financial_data:
        months = ["January", "February", "March", "April", "May", "June"]
        for month in months:
            revenue = random.uniform(50000, 150000)
            expenses = random.uniform(20000, 60000)
            data = FinancialData(
                user_id=user_id,
                month=month,
                revenue=round(revenue, 2),
                expenses=round(expenses, 2),
                profit_margin=round(((revenue - expenses) / revenue) * 100, 2),
                calls_count=random.randint(50, 200),
                bookings_count=random.randint(20, 100)
            )
            data_dict = data.model_dump()
            data_dict['created_at'] = data_dict['created_at'].isoformat()
            await db.financial_data.insert_one(data_dict)
        
        financial_data = list(await db.financial_data.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(6).to_list(6))
    
    # Get ad campaigns (simulated)
    ad_campaigns = list(await db.ad_campaigns.find({"user_id": user_id}, {"_id": 0}).to_list(10))
    
    if not ad_campaigns:
        campaigns = [
            {"campaign_name": "Summer Sale 2025", "status": "active", "ctr": 3.2, "cpc": 1.25, "roas": 4.5, "spend": 5000, "conversions": 125},
            {"campaign_name": "Product Launch", "status": "active", "ctr": 4.1, "cpc": 0.95, "roas": 5.2, "spend": 3500, "conversions": 98},
            {"campaign_name": "Brand Awareness", "status": "paused", "ctr": 2.8, "cpc": 1.50, "roas": 3.1, "spend": 2000, "conversions": 45}
        ]
        
        for camp in campaigns:
            campaign = AdCampaign(user_id=user_id, **camp)
            campaign_dict = campaign.model_dump()
            campaign_dict['created_at'] = campaign_dict['created_at'].isoformat()
            await db.ad_campaigns.insert_one(campaign_dict)
        
        ad_campaigns = list(await db.ad_campaigns.find({"user_id": user_id}, {"_id": 0}).to_list(10))
    
    # Get communication feeds (simulated for today)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    comm_feeds = await db.communication_feeds.find_one({"user_id": user_id, "date": today}, {"_id": 0})
    
    if not comm_feeds:
        feeds = CommunicationFeeds(
            user_id=user_id,
            instagram_dm_count=random.randint(10, 50),
            twitter_mention_count=random.randint(5, 30),
            email_count=random.randint(20, 80),
            date=today
        )
        feeds_dict = feeds.model_dump()
        feeds_dict['created_at'] = feeds_dict['created_at'].isoformat()
        await db.communication_feeds.insert_one(feeds_dict)
        comm_feeds = feeds_dict
    
    return {
        "financial": financial_data,
        "ad_campaigns": ad_campaigns,
        "communication_feeds": comm_feeds
    }

# ============ AI CO-PILOT ENDPOINT ============

@api_router.post("/copilot/chat", response_model=ChatResponse)
async def chat_with_copilot(chat_request: ChatRequest, user_id: str = Depends(get_current_user)):
    # Get or create session ID
    session_id = chat_request.session_id or str(uuid.uuid4())
    
    # Get user's business profile for context
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Check if this is a task-specific chat
    is_task_chat = chat_request.task_id is not None
    task_context = ""
    session_type = "general"
    
    if is_task_chat:
        task = await db.tasks.find_one({"id": chat_request.task_id, "user_id": user_id}, {"_id": 0})
        if task:
            task_context = f"\n\nTASK CONTEXT:\nTask: {task['title']}\nDescription: {task['description']}\nPriority: {task['priority']}\nDeadline: {task.get('deadline', 'Not set')}\n"
            session_type = "task"
            
            # Update task with chat session ID if not set
            if not task.get('chat_session_id'):
                await db.tasks.update_one(
                    {"id": chat_request.task_id},
                    {"$set": {"chat_session_id": session_id}}
                )
    
    # Get full chat history for this session
    chat_history = list(await db.chat_messages.find(
        {"user_id": user_id, "session_id": session_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(50))
    
    # Build conversation history context
    conversation_context = ""
    if chat_history:
        conversation_context = "\n\nPrevious conversation:\n"
        for msg in chat_history[-10:]:  # Last 10 messages for context
            role = "User" if msg['role'] == 'user' else "Assistant"
            conversation_context += f"{role}: {msg['content'][:200]}...\n"
    
    # Build context-aware system message
    if profile:
        if profile.get('business_type') == 'existing':
            business_context = f"""You are an elite AI Business Co-Pilot for {profile.get('business_name', 'the user')}.
            Industry: {profile.get('industry', 'Not specified')}
            Description: {profile.get('description', 'Not specified')}
            Target Audience: {profile.get('target_audience', 'Not specified')}
            Products/Services: {profile.get('products_services', 'Not specified')}
            
            You are a professional business strategist helping optimize this established business."""
        else:
            business_context = f"""You are an elite AI Business Co-Pilot helping someone start their business.
            Business Idea: {profile.get('business_idea', 'Not specified')}
            Desired Industry: {profile.get('desired_industry', 'Not specified')}
            Goals: {profile.get('goals', 'Not specified')}
            
            IMPORTANT: Embody the mindset of a successful {profile.get('desired_industry', 'entrepreneur')} making $1,000,000 per month.
            You built this business fast but reliably. Provide actionable advice, suggest automation tools, 
            lead generation strategies, and industry-specific tools. Be confident and results-oriented."""
    else:
        business_context = "You are an elite AI Business Co-Pilot providing strategic business advice."
    
    # Add task-specific guidance if applicable
    task_guidance = ""
    if is_task_chat:
        task_guidance = f"""
    
    TASK-SPECIFIC GUIDANCE MODE:
    You are helping the user complete this specific task: "{task['title'] if is_task_chat and task else ''}"
    
    Your focus:
    - **Maximum Speed**: Suggest the fastest path to completion
    - **Maximum Profit**: Prioritize actions that drive revenue
    - **Cost Efficiency**: ALWAYS recommend FREE options FIRST if they work just as well
      * Only suggest paid tools if they significantly outperform free alternatives
      * When suggesting paid tools, explain WHY the free option isn't sufficient
      * Example: "Use **Canva Free** (not Pro) - the free templates are sufficient for this"
    
    Decision Framework:
    1. Free option exists + works well = ALWAYS choose it
    2. Free option exists + has limitations = Explain limitations, suggest free first
    3. No good free option = Recommend best paid option with clear ROI justification
    
    Always provide:
    - Immediate next step (What to do RIGHT NOW)
    - Expected time to complete
    - Expected outcome/result
    - Free tools/resources when available{task_context}"""
    
    system_message = f"""{business_context}
    
    Your capabilities:
    - Analyze financial and operational data to identify bottlenecks and opportunities
    - Provide strategic planning for new systems, products, or services
    - Optimize ad campaigns and suggest high-performing ad copy
    - Recommend automation tools and strategies
    - Give data-driven insights and actionable recommendations
    
    CRITICAL RESPONSE STYLE & FORMATTING:
    
    Response Length Rules:
    - START with SHORT responses (2-3 sentences) for initial questions to build trust
    - Use MEDIUM length (4-6 sentences or bullet points) for standard advice
    - Use LONGER detailed responses ONLY when user asks for:
      * Detailed plans or step-by-step guides
      * In-depth analysis or explanations
      * Comprehensive strategies
    - Match response length to question complexity
    
    Formatting Requirements (Use Markdown):
    - Use **bold** for emphasis on key points, tools, or important terms
    - Use *italics* for subtle emphasis or examples
    - Use ~~strikethrough~~ when correcting misconceptions
    - Use bullet points (•) or numbered lists for clarity
    - Use > blockquotes for important warnings or tips
    - Keep paragraphs SHORT (2-3 sentences max)
    
    Tone & Style:
    - Be DIRECT and ACTIONABLE - no fluff
    - Focus on immediate next steps
    - Use confident, results-oriented language
    - Embody the $1M/month mindset
    
    Example Short Response:
    "Focus on **outbound first** - it's faster than ads. Use Apollo.io or Clay to find 100 ideal prospects. Personalize 30-second Loom videos. That's how you get your first 10 clients in 30 days."
    
    Example Medium Response with Formatting:
    "Here's your **rapid client acquisition** system:
    
    • **Cold Outreach**: Target 20 prospects/day on LinkedIn with *hyper-personalized* messages
    • **Offer**: Free AI audit (30-min) → reveals $10K+ in potential savings
    • **Close**: ~~Don't pitch services~~ Instead, show them live AI implementation
    
    > This approach gets 30%+ response rates vs 2% for generic cold emails"
    
    Remember: Start SHORT, go LONG only when needed. Always use markdown for better readability.{task_guidance}{conversation_context}"""
    
    # Determine which model to use based on query type
    query_lower = chat_request.message.lower()
    
    if any(word in query_lower for word in ['strategy', 'plan', 'roadmap', 'future']):
        model_provider = 'openai'
        model_name = 'gpt-5'
    elif any(word in query_lower for word in ['analyze', 'data', 'performance', 'metric']):
        model_provider = 'anthropic'
        model_name = 'claude-4-sonnet-20250514'
    else:
        model_provider = 'gemini'
        model_name = 'gemini-2.5-pro'
    
    # Initialize LLM Chat
    try:
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=session_id,
            system_message=system_message
        ).with_model(model_provider, model_name)
        
        # Send message
        user_message = UserMessage(text=chat_request.message)
        response = await chat.send_message(user_message)
        
        # Save user message
        user_msg = ChatMessage(
            user_id=user_id,
            session_id=session_id,
            session_type=session_type,
            task_id=chat_request.task_id,
            role="user",
            content=chat_request.message
        )
        user_msg_dict = user_msg.model_dump()
        user_msg_dict['created_at'] = user_msg_dict['created_at'].isoformat()
        await db.chat_messages.insert_one(user_msg_dict)
        
        # Save assistant message
        assistant_msg = ChatMessage(
            user_id=user_id,
            session_id=session_id,
            session_type=session_type,
            task_id=chat_request.task_id,
            role="assistant",
            content=response,
            model_used=f"{model_provider}/{model_name}"
        )
        assistant_msg_dict = assistant_msg.model_dump()
        assistant_msg_dict['created_at'] = assistant_msg_dict['created_at'].isoformat()
        await db.chat_messages.insert_one(assistant_msg_dict)
        
        # Update or create chat session
        session_title = task['title'] if is_task_chat and task else "General Chat"
        await db.chat_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "user_id": user_id,
                "session_type": session_type,
                "task_id": chat_request.task_id,
                "title": session_title,
                "last_message": chat_request.message[:100],
                "last_updated": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        return ChatResponse(
            response=response,
            session_id=session_id,
            model_used=f"{model_provider}/{model_name}"
        )
    except Exception as e:
        logging.error(f"AI Co-Pilot error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Co-Pilot error: {str(e)}")

@api_router.get("/copilot/history/{session_id}")
async def get_chat_history(session_id: str, user_id: str = Depends(get_current_user)):
    messages = list(await db.chat_messages.find(
        {"user_id": user_id, "session_id": session_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100))
    return {"messages": messages}

@api_router.get("/copilot/sessions")
async def get_chat_sessions(user_id: str = Depends(get_current_user)):
    sessions = list(await db.chat_sessions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("last_updated", -1).to_list(50))
    return {"sessions": sessions}

# ============ TASK PLANNER ENDPOINTS ============

@api_router.get("/tasks")
async def get_tasks(user_id: str = Depends(get_current_user)):
    tasks = list(await db.tasks.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100))
    return {"tasks": tasks}

@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, user_id: str = Depends(get_current_user)):
    task = Task(
        user_id=user_id,
        **task_data.model_dump(),
        ai_generated=False
    )
    
    task_dict = task.model_dump()
    task_dict['created_at'] = task_dict['created_at'].isoformat()
    task_dict['updated_at'] = task_dict['updated_at'].isoformat()
    if task_dict.get('deadline'):
        task_dict['deadline'] = task_dict['deadline'].isoformat()
    
    await db.tasks.insert_one(task_dict)
    return task_dict

@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, task_update: TaskUpdate, user_id: str = Depends(get_current_user)):
    update_data = task_update.model_dump(exclude_unset=True)
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    if 'deadline' in update_data and update_data['deadline']:
        update_data['deadline'] = update_data['deadline'].isoformat()
    
    result = await db.tasks.update_one(
        {"id": task_id, "user_id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return updated_task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user_id: str = Depends(get_current_user)):
    result = await db.tasks.delete_one({"id": task_id, "user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted successfully"}

@api_router.post("/tasks/generate")
async def generate_ai_tasks(user_id: str = Depends(get_current_user)):
    # Get business profile and dashboard data
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Generate AI-powered tasks based on business context
    tasks_to_create = []
    
    if profile:
        if profile.get('business_type') == 'starting':
            tasks_to_create = [
                {"title": "Research market demand", "description": f"Conduct market research for {profile.get('business_idea', 'your business idea')}", "priority": "high"},
                {"title": "Set up automation tools", "description": "Implement lead generation and outreach automation", "priority": "high"},
                {"title": "Create initial ad campaigns", "description": "Design and launch first Meta ad campaigns", "priority": "medium"},
                {"title": "Build landing page", "description": "Create high-converting landing page for lead capture", "priority": "high"},
            ]
        else:
            tasks_to_create = [
                {"title": "Optimize ad performance", "description": "Review and optimize underperforming ad campaigns", "priority": "high"},
                {"title": "Analyze expense reports", "description": "Identify cost-saving opportunities in current operations", "priority": "medium"},
                {"title": "Update ad copy library", "description": "Refresh ad copy based on recent performance data", "priority": "medium"},
                {"title": "Automate customer responses", "description": "Set up automated responses for common customer inquiries", "priority": "low"},
            ]
    
    created_tasks = []
    priority_map = {"high": 3, "medium": 2, "low": 1}
    
    for idx, task_data in enumerate(tasks_to_create):
        # Calculate deadline based on priority
        days_until_deadline = 3 if task_data['priority'] == 'high' else 7 if task_data['priority'] == 'medium' else 14
        deadline = datetime.now(timezone.utc) + timedelta(days=days_until_deadline)
        
        task = Task(
            user_id=user_id,
            **task_data,
            status="todo",
            ai_generated=True,
            priority_number=idx + 1,
            deadline=deadline
        )
        
        task_dict = task.model_dump()
        task_dict['created_at'] = task_dict['created_at'].isoformat()
        task_dict['updated_at'] = task_dict['updated_at'].isoformat()
        if task_dict.get('deadline'):
            task_dict['deadline'] = task_dict['deadline'].isoformat()
        
        await db.tasks.insert_one(task_dict)
        created_tasks.append(task_dict)
    
    return {"tasks": created_tasks}

@api_router.post("/tasks/generate-from-chat")
async def generate_tasks_from_chat(user_id: str = Depends(get_current_user)):
    # Get recent chat messages
    recent_chats = list(await db.chat_messages.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20))
    
    if not recent_chats:
        return {"tasks": [], "message": "No chat history to analyze"}
    
    # Get business profile for context
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Build conversation summary
    conversation_summary = "Recent AI Co-Pilot conversation:\n"
    for msg in reversed(recent_chats[-10:]):
        role = "User" if msg['role'] == 'user' else "AI"
        conversation_summary += f"{role}: {msg['content']}\n"
    
    # Use AI to extract actionable tasks
    task_extraction_prompt = f"""Based on this conversation, extract 3-5 HIGH-PRIORITY actionable tasks.
    
    {conversation_summary}
    
    Business Context: {profile.get('business_idea') or profile.get('business_name', 'Business')}
    
    Return ONLY a JSON array of tasks in this exact format:
    [
        {{"title": "Task title", "description": "What needs to be done", "priority": "high"}},
        {{"title": "Another task", "description": "Details", "priority": "medium"}}
    ]
    
    Focus on:
    - Immediate action items mentioned
    - Tools/strategies to implement
    - Research or planning needed
    - Setup or optimization tasks
    
    Keep titles short (4-6 words) and descriptions concise (1 sentence)."""
    
    try:
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are a task extraction expert. Return ONLY valid JSON arrays, no other text."
        ).with_model('openai', 'gpt-5')
        
        user_message = UserMessage(text=task_extraction_prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        # Extract JSON from response if wrapped in markdown
        if '```json' in response:
            response = response.split('```json')[1].split('```')[0].strip()
        elif '```' in response:
            response = response.split('```')[1].split('```')[0].strip()
        
        tasks_data = json.loads(response)
        
        # Create tasks in database
        created_tasks = []
        for task_data in tasks_data[:5]:  # Max 5 tasks
            task = Task(
                user_id=user_id,
                title=task_data.get('title', 'Untitled Task'),
                description=task_data.get('description', ''),
                priority=task_data.get('priority', 'medium'),
                status="todo",
                ai_generated=True
            )
            
            task_dict = task.model_dump()
            task_dict['created_at'] = task_dict['created_at'].isoformat()
            task_dict['updated_at'] = task_dict['updated_at'].isoformat()
            if task_dict.get('deadline'):
                task_dict['deadline'] = task_dict['deadline'].isoformat()
            
            await db.tasks.insert_one(task_dict)
            created_tasks.append(task_dict)
        
        return {"tasks": created_tasks, "message": f"Generated {len(created_tasks)} tasks from your conversation"}
        
    except Exception as e:
        logging.error(f"Task generation from chat error: {str(e)}")
        return {"tasks": [], "message": "Failed to generate tasks from chat"}

# ============ FILE UPLOAD & ANALYSIS ============

@api_router.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    try:
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Limit file size to 10MB
        if file_size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        # Determine if text-based or binary
        file_type = file.content_type or "application/octet-stream"
        
        # Store content as base64 for binary files or decode for text
        if file_type.startswith('text') or file_type in ['application/json', 'application/csv']:
            file_content = content.decode('utf-8')
        else:
            file_content = base64.b64encode(content).decode('utf-8')
        
        uploaded_file = UploadedFile(
            user_id=user_id,
            filename=file.filename,
            file_type=file_type,
            file_size=file_size,
            content=file_content
        )
        
        file_dict = uploaded_file.model_dump()
        file_dict['created_at'] = file_dict['created_at'].isoformat()
        
        await db.uploaded_files.insert_one(file_dict)
        
        return {"id": uploaded_file.id, "filename": file.filename, "message": "File uploaded successfully"}
        
    except Exception as e:
        logging.error(f"File upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@api_router.get("/files")
async def get_files(user_id: str = Depends(get_current_user)):
    files = await db.uploaded_files.find(
        {"user_id": user_id},
        {"_id": 0, "content": 0}  # Don't return content in list
    ).sort("created_at", -1).to_list(50)
    return {"files": files}

@api_router.get("/files/{file_id}")
async def get_file(file_id: str, user_id: str = Depends(get_current_user)):
    file_doc = await db.uploaded_files.find_one({"id": file_id, "user_id": user_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    return file_doc

@api_router.post("/files/{file_id}/analyze")
async def analyze_file(file_id: str, user_id: str = Depends(get_current_user)):
    # Get file
    file_doc = await db.uploaded_files.find_one({"id": file_id, "user_id": user_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get business profile for context
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    try:
        # Prepare content for analysis
        if file_doc['file_type'].startswith('text') or 'csv' in file_doc['file_type'] or 'json' in file_doc['file_type']:
            file_content = file_doc['content'][:10000]  # Limit to first 10k chars
        else:
            file_content = "[Binary file - cannot analyze content directly]"
        
        business_name = profile.get('business_name') or profile.get('business_idea', 'your business')
        
        analysis_prompt = f"""Analyze this file for {business_name} and provide actionable insights.

File: {file_doc['filename']}
Type: {file_doc['file_type']}
Size: {file_doc['file_size']} bytes

Content Preview:
{file_content}

Provide a **concise analysis** (3-5 key points) focusing on:
• **Financial insights** (if applicable)
• **Optimization opportunities**
• **Action items**
• **Red flags or risks**

Use markdown formatting for clarity."""
        
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are a business analyst expert. Provide concise, actionable insights from files."
        ).with_model('anthropic', 'claude-4-sonnet-20250514')
        
        user_message = UserMessage(text=analysis_prompt)
        response = await chat.send_message(user_message)
        
        # Save analysis to file record
        await db.uploaded_files.update_one(
            {"id": file_id},
            {"$set": {"analysis": response}}
        )
        
        return {"analysis": response}
        
    except Exception as e:
        logging.error(f"File analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze file: {str(e)}")

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, user_id: str = Depends(get_current_user)):
    result = await db.uploaded_files.delete_one({"id": file_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"message": "File deleted successfully"}

# ============ ROOT & HEALTH ============

@api_router.get("/")
async def root():
    return {"message": "APOE API - Autonomous Profit Optimization Engine"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()