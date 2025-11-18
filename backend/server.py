from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.responses import Response
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
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration
import random
from fastapi import UploadFile, File
import base64
import aiohttp
import json as json_lib
import time
import requests

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
    use_multi_ai: bool = False  # User must explicitly enable multi-AI mode
    preferred_model: Optional[str] = None  # 'intelligent', 'gpt5', 'claude', 'gemini'

class ChatResponse(BaseModel):
    response: str
    session_id: str
    model_used: str
    generated_images: Optional[List[str]] = None  # Base64 encoded images
    generated_videos: Optional[List[str]] = None  # Base64 encoded videos

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

class AILearning(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    learning_type: str  # "conversation_insight", "research_finding", "strategy_pattern"
    category: str  # e.g., "lead_generation", "pricing", "niche_strategy"
    insight: str
    source: str  # "user_conversation", "web_research", "pattern_detection"
    confidence_score: float = 1.0
    applied_count: int = 0
    success_rate: Optional[float] = None
    related_business_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_applied: Optional[datetime] = None

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
        logging.info(f"[AUTH] Validating token: {token[:20]}...")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            logging.error("[AUTH] Token missing user_id")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        logging.info(f"[AUTH] Token valid for user: {user_id}")
        return user_id
    except jwt.ExpiredSignatureError:
        logging.error("[AUTH] Token expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logging.error(f"[AUTH] Invalid token: {str(e)}")
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

from fastapi import Form

@api_router.post("/copilot/chat", response_model=ChatResponse)
async def chat_with_copilot(
    message: str = Form(...),
    session_id: Optional[str] = Form(None),
    task_id: Optional[str] = Form(None),
    use_multi_ai: bool = Form(False),
    preferred_model: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
    user_id: str = Depends(get_current_user)
):
    # Get or create session ID
    session_id = session_id or str(uuid.uuid4())
    
    # Process uploaded files
    file_contents = []
    image_contents = []
    has_vision_files = False
    
    if files:
        for file in files:
            content = await file.read()
            file_info = {
                'filename': file.filename,
                'content': base64.b64encode(content).decode('utf-8'),
                'content_type': file.content_type
            }
            file_contents.append(file_info)
            
            # Check if it's an image or video that requires vision
            if file.content_type and (file.content_type.startswith('image/') or file.content_type.startswith('video/')):
                has_vision_files = True
                # Create ImageContent for vision models
                image_contents.append(ImageContent(
                    image_base64=file_info['content']
                ))
    
    # Get user's business profile for context
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get AI learnings for this user
    learnings = list(await db.ai_learnings.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("confidence_score", -1).limit(10).to_list(10))
    
    # Check if this is a task-specific chat
    is_task_chat = task_id is not None
    task_context = ""
    session_type = "general"
    
    if is_task_chat:
        task = await db.tasks.find_one({"id": task_id, "user_id": user_id}, {"_id": 0})
        if task:
            task_context = f"\n\nTASK CONTEXT:\nTask: {task['title']}\nDescription: {task['description']}\nPriority: {task['priority']}\nDeadline: {task.get('deadline', 'Not set')}\n"
            session_type = "task"
            
            # Update task with chat session ID if not set
            if not task.get('chat_session_id'):
                await db.tasks.update_one(
                    {"id": task_id},
                    {"$set": {"chat_session_id": session_id}}
                )
    
    # Get full chat history for this session
    chat_history = list(await db.chat_messages.find(
        {"user_id": user_id, "session_id": session_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(50))
    
    # Get recent messages from ALL other sessions for broader context
    all_recent_messages = list(await db.chat_messages.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(30).to_list(30))
    
    # Build conversation history context - includes current session + context from other sessions
    conversation_context = ""
    
    # Add current session history
    if chat_history:
        conversation_context = "\n\nCurrent conversation:\n"
        for msg in chat_history[-10:]:  # Last 10 messages for context
            role = "User" if msg['role'] == 'user' else "Assistant"
            conversation_context += f"{role}: {msg['content'][:150]}...\n"
    
    # Add context from other recent conversations
    other_sessions_context = []
    for msg in all_recent_messages:
        if msg.get('session_id') != session_id and msg['role'] == 'user':
            other_sessions_context.append(msg['content'][:100])
    
    if other_sessions_context:
        conversation_context += "\n\nContext from recent conversations across sessions:\n"
        for idx, content in enumerate(other_sessions_context[:5]):  # Top 5 recent from other sessions
            conversation_context += f"- {content}...\n"
    
    # Add learned insights to context
    learned_context = ""
    if learnings:
        learned_context = "\n\nAI LEARNED INSIGHTS (Apply these to personalize your response):\n"
        for learning in learnings[:5]:
            learned_context += f"- [{learning['category']}] {learning['insight'][:150]}...\n"
        learned_context += "\nUse these insights to tailor your advice to this specific user's preferences and situation."
    
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
    
    UNCONVENTIONAL STRATEGY FRAMEWORK:
    Think OUTSIDE the box. Mix conventional + unconventional approaches:
    
    1. **Scraping & Automation Hacks**:
       - Instagram follower list scraping → AI bio analysis for keywords
       - LinkedIn Sales Navigator workarounds (free 30-day trials)
       - Twitter/X list scraping for niche communities
       - Reddit comment scraping for pain points
       - Chrome extensions for bulk data extraction
       - Use Instant Data Scraper (free Chrome extension)
       - PhantomBuster free tier for automation
    
    2. **Guerrilla Lead Generation**:
       - Scrape competitor's Google reviews → reach out to 1-star reviewers
       - Find Facebook group members via Chrome inspect → export to CSV
       - Use WayBack Machine to find old client lists from competitor sites
       - Scrape Yelp/Google Maps for business lists by category + location
       - YouTube comment sections for engaged audiences
    
    3. **Free Tool Stacking**:
       - Zapier free tier + Google Sheets + free APIs = automation
       - n8n.io (free self-hosted) for complex workflows
       - Make.com free tier for integrations
       - Supabase (free DB) + Vercel (free hosting) = full app
       - GPT-4 free via Perplexity.ai, Claude via Poe.com
    
    4. **Unconventional Outreach**:
       - Loom videos embedded in LinkedIn connection requests
       - Voice notes on Instagram DMs (higher response rate)
       - Audit their website live → send personalized Notion doc
       - Create custom landing page with their company name (look-ai-agency-name.com)
       - Send physical mail (costs $2 but 80%+ open rate)
    
    5. **Grey Hat (Legal but Creative)**:
       - Join paid communities with free trial → extract member list before canceling
       - LinkedIn profile viewers → scrape who viewed you
       - Create lead magnets that require email → use in FB groups (most allow this)
       - Reverse engineer competitor ads via FB Ad Library
       - Use multiple emails for tool trials (10minutemail.com)
    
    HYPER-SPECIFIC EXAMPLE STYLE:
    Bad: "Use social media to find leads"
    Good: "Use **PhantomBuster** (free tier: 14 days) to scrape 500 Instagram followers of @realestate_agent_123. Export to CSV. Run through **ChatGPT** (free) with prompt: 'Extract emails and phone numbers from these bios: [paste list]'. Filter for keywords 'flooring', 'contractor', 'renovation'. You'll get 50-100 hyper-targeted leads in 2 hours. Cost: $0."
    
    DYNAMIC TASK MANAGEMENT:
    If during this conversation you discover:
    - A BETTER strategy that makes current tasks obsolete
    - A prerequisite task that must be done first
    - A more profitable opportunity
    
    **Explicitly suggest**: "I recommend we update your task list. This new approach means Task #3 should become Task #1, and we should add a new task: [specific task]. Should I update your tasks?"
    
    Decision Framework:
    1. Free option exists + works well = ALWAYS choose it
    2. Free option exists + has limitations = Explain limitations, suggest free first
    3. No good free option = Recommend best paid option with clear ROI justification
    
    Always provide:
    - UNCONVENTIONAL but legal strategy
    - Immediate next step (What to do RIGHT NOW)
    - Exact tools/websites to use (with free options)
    - Expected time to complete
    - Expected outcome/result with numbers
    - Screenshot/video tutorials when relevant{task_context}"""
    
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
    
    Tone & Style - CRITICAL RULES:
    - **NOT PUSHY** - Use suggestive language: "you could", "consider", "one option is", "alternatively"
    - **PRESENT OPTIONS** - Always give 2-3 different approaches, not just one "best" way
    - **USER DECIDES** - Don't make decisions for them, present trade-offs and let them choose
    - **FREE FIRST** - Always prioritize free/cheap methods that work well
    - **ACKNOWLEDGE ALTERNATIVES** - Even when recommending something, mention other valid approaches
    - Be DIRECT and ACTIONABLE - no fluff
    - Focus on immediate next steps
    - Embody the $1M/month mindset but respect user's autonomy
    
    Example NON-PUSHY Response with Options:
    "You have a few solid approaches to consider:
    
    **Option 1: Outbound-First** (Free, Fast)
    - Use Apollo.io or Hunter.io (free tiers) to find 100 prospects
    - Send personalized Loom videos (free)
    - Could get 10 clients in 30 days
    
    **Option 2: Content + Organic** (Free, Slower)
    - Post daily on LinkedIn with case studies
    - Join relevant communities
    - Takes 60-90 days but builds authority
    
    **Option 3: Hybrid** (Small budget)
    - Combine outbound + $100 in targeted ads
    - Fastest results but requires some spend
    
    > Trade-off: Option 1 is fastest but requires more daily effort. Option 2 is more passive but slower. You could also combine them."
    
    Example UNCONVENTIONAL Response:
    "Here are three unconventional approaches you could consider:
    
    **Free Option**: Scrape competitor's Instagram followers using **Instant Data Scraper** (Chrome extension, free). Filter bios for keywords. Reach out with voice DMs (80% open rate vs 20% for text).
    
    **Alternative**: Use **WayBack Machine** to find old client testimonials from competitor sites. These businesses already bought similar services - reach out with improvement offers.
    
    **Different Angle**: Create a fake competitor analysis of their business (using free tools). Send it unsolicited. 40% will reply asking for more.
    
    All three are free. Pick based on your comfort level with each approach."
    
    Remember: 
    - START SHORT, go LONG only when needed
    - ALWAYS give options, not orders
    - FREE methods first, paid only if significantly better
    - Let user decide based on trade-offs
    - Use markdown for better readability
    - Apply learned insights about this user to personalize advice{task_guidance}{conversation_context}{learned_context}"""
    
    # Add file context to message if files were uploaded
    full_message = message
    if file_contents:
        full_message += f"\n\n[User uploaded {len(file_contents)} file(s): {', '.join([f['filename'] for f in file_contents])}]"
    
    # Check if user is requesting image generation (but not video)
    message_lower = message.lower()
    image_gen_keywords = ['generate image', 'create image', 'make image', 'draw', 'generate picture', 
                         'create picture', 'make picture', 'generate photo', 'create photo', 
                         'show me image', 'show me picture', 'image of', 'picture of']
    is_image_generation_request = (any(keyword in message_lower for keyword in image_gen_keywords) and 
                                   'video' not in message_lower and 'animation' not in message_lower)
    
    # Check if user is requesting video generation 
    # Simple and reliable: if message mentions "video" or "animation", assume they want video generation
    message_lower = message.lower()
    is_video_generation_request = ('video' in message_lower or 'animation' in message_lower or 
                                   'animate' in message_lower or 'clip' in message_lower or
                                   'footage' in message_lower)
    
    generated_images = []
    generated_videos = []
    
    # AI Response System
    try:
        # Handle video generation requests (prioritize over image if both detected)
        if is_video_generation_request:
            try:
                # Create video generator instance
                video_gen = OpenAIVideoGeneration(api_key=os.environ.get('EMERGENT_LLM_KEY'))
                
                # Generate video with Sora 2
                video_bytes = video_gen.text_to_video(
                    prompt=message,
                    model="sora-2",  # Can be "sora-2" or "sora-2-pro"
                    size="1280x720",  # Standard HD
                    duration=4,  # 4 seconds for faster generation
                    max_wait_time=600  # 10 minutes timeout
                )
                
                if video_bytes:
                    # Convert to base64
                    video_base64 = base64.b64encode(video_bytes).decode('utf-8')
                    generated_videos.append(video_base64)
                    response = f"I've generated a video based on your request: \"{message}\"\n\nThe video is 4 seconds long in HD quality (1280x720)."
                    model_used = "sora-2 (Video Generation)"
                else:
                    response = "I attempted to generate a video but encountered an issue. Please try rephrasing your request or simplifying the prompt."
                    model_used = "sora-2"
            except Exception as e:
                logging.error(f"Video generation error: {str(e)}")
                response = f"I encountered an error while generating the video. This could be due to timeout or API issues. Please try a simpler prompt or try again later."
                model_used = "sora-2 (Error)"
        
        # Handle image generation requests
        elif is_image_generation_request:
            try:
                # Extract the image prompt from the message
                image_gen = OpenAIImageGeneration(api_key=os.environ.get('EMERGENT_LLM_KEY'))
                
                # Generate image
                images = await image_gen.generate_images(
                    prompt=message,
                    model="gpt-image-1",
                    number_of_images=1
                )
                
                # Convert to base64
                if images and len(images) > 0:
                    image_base64 = base64.b64encode(images[0]).decode('utf-8')
                    generated_images.append(image_base64)
                    response = f"I've generated an image based on your request: \"{message}\""
                    model_used = "gpt-image-1 (Image Generation)"
                else:
                    response = "I attempted to generate an image but encountered an issue. Please try rephrasing your request."
                    model_used = "gpt-image-1"
            except Exception as e:
                logging.error(f"Image generation error: {str(e)}")
                response = f"I encountered an error while generating the image: {str(e)}"
                model_used = "gpt-image-1 (Error)"
        
        # Force vision-capable model if images/videos are present
        elif has_vision_files:
            # Use GPT-4o for vision (best vision model available)
            chat = LlmChat(
                api_key=os.environ.get('EMERGENT_LLM_KEY'),
                session_id=session_id,
                system_message=system_message
            ).with_model('openai', 'gpt-4o')
            
            # Create user message with images
            user_message = UserMessage(
                text=full_message,
                file_contents=image_contents
            )
            response = await chat.send_message(user_message)
            model_used = "gpt-4o (Vision)"
            
        elif use_multi_ai:
            # Multi-AI Collaboration (4x API calls - user explicitly enabled)
            models = [
                ('openai', 'gpt-5', 'GPT-5'),
                ('anthropic', 'claude-4-sonnet-20250514', 'Claude'),
                ('gemini', 'gemini-2.5-pro', 'Gemini')
            ]
            
            individual_responses = []
            
            for provider, model, name in models:
                try:
                    chat = LlmChat(
                        api_key=os.environ.get('EMERGENT_LLM_KEY'),
                        session_id=f"{session_id}_{name}",
                        system_message=system_message
                    ).with_model(provider, model)
                    
                    user_message = UserMessage(text=full_message)
                    model_response = await chat.send_message(user_message)
                    individual_responses.append({
                        'model': name,
                        'response': model_response
                    })
                except Exception as e:
                    logging.error(f"{name} error: {str(e)}")
                    continue
            
            # Synthesize responses
            if len(individual_responses) >= 2:
                reasoning_prompt = f"""Synthesize the best response from multiple AI models.

User's Question: {full_message}

{chr(10).join([f"**{resp['model']}**: {resp['response']}" for resp in individual_responses])}

Combine the best insights, present 2-3 options, prioritize free methods, be non-pushy."""

                reasoning_chat = LlmChat(
                    api_key=os.environ.get('EMERGENT_LLM_KEY'),
                    session_id=session_id,
                    system_message="Synthesis expert. Create helpful, option-rich response."
                ).with_model('openai', 'gpt-5')
                
                reasoning_message = UserMessage(text=reasoning_prompt)
                response = await reasoning_chat.send_message(reasoning_message)
                model_used = "Multi-AI (GPT-5 + Claude + Gemini) - 4x credits"
            else:
                response = individual_responses[0]['response'] if individual_responses else "Error processing request."
                model_used = individual_responses[0]['model'] if individual_responses else "fallback"
        else:
            # Single model (1x API call - default, cost-efficient)
            # Check if user has a preferred model
            if preferred_model and preferred_model != 'intelligent':
                # Use user's specific model choice
                if preferred_model == 'gpt5':
                    model_provider, model_name = 'openai', 'gpt-5'
                elif preferred_model == 'claude':
                    model_provider, model_name = 'anthropic', 'claude-4-sonnet-20250514'
                elif preferred_model == 'gemini':
                    model_provider, model_name = 'gemini', 'gemini-2.5-pro'
                else:
                    # Fallback to intelligent routing
                    query_lower = message.lower()
                    if any(word in query_lower for word in ['strategy', 'plan', 'roadmap']):
                        model_provider, model_name = 'openai', 'gpt-5'
                    elif any(word in query_lower for word in ['analyze', 'data', 'performance']):
                        model_provider, model_name = 'anthropic', 'claude-4-sonnet-20250514'
                    else:
                        model_provider, model_name = 'gemini', 'gemini-2.5-pro'
            else:
                # Intelligent routing based on query content
                query_lower = message.lower()
                
                if any(word in query_lower for word in ['strategy', 'plan', 'roadmap']):
                    model_provider, model_name = 'openai', 'gpt-5'
                elif any(word in query_lower for word in ['analyze', 'data', 'performance']):
                    model_provider, model_name = 'anthropic', 'claude-4-sonnet-20250514'
                else:
                    model_provider, model_name = 'gemini', 'gemini-2.5-pro'
            
            chat = LlmChat(
                api_key=os.environ.get('EMERGENT_LLM_KEY'),
                session_id=session_id,
                system_message=system_message
            ).with_model(model_provider, model_name)
            
            user_message = UserMessage(text=full_message)
            response = await chat.send_message(user_message)
            model_used = f"{model_provider}/{model_name}"
        
        # Save user message
        user_msg = ChatMessage(
            user_id=user_id,
            session_id=session_id,
            session_type=session_type,
            task_id=task_id,
            role="user",
            content=full_message
        )
        user_msg_dict = user_msg.model_dump()
        user_msg_dict['created_at'] = user_msg_dict['created_at'].isoformat()
        await db.chat_messages.insert_one(user_msg_dict)
        
        # Save assistant message
        assistant_msg = ChatMessage(
            user_id=user_id,
            session_id=session_id,
            session_type=session_type,
            task_id=task_id,
            role="assistant",
            content=response,
            model_used=model_used
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
                "task_id": task_id,
                "title": session_title,
                "last_message": message[:100],
                "last_updated": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        # Automatic learning DISABLED to save credits
        # User can manually trigger via "AI Research Mode" button
        # message_count = await db.chat_messages.count_documents({"user_id": user_id})
        # if message_count % 10 == 0:
        #     logging.info(f"User {user_id} eligible for learning analysis")
        
        return ChatResponse(
            response=response,
            session_id=session_id,
            model_used=model_used,
            generated_images=generated_images if generated_images else None,
            generated_videos=generated_videos if generated_videos else None
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

@api_router.delete("/copilot/sessions/{session_id}")
async def delete_chat_session(session_id: str, user_id: str = Depends(get_current_user)):
    # Delete all messages in the session
    messages_result = await db.chat_messages.delete_many({
        "user_id": user_id,
        "session_id": session_id
    })
    
    # Delete the session itself
    session_result = await db.chat_sessions.delete_one({
        "id": session_id,
        "user_id": user_id
    })
    
    if session_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # If this was a task-specific chat, clear the chat_session_id from the task
    if messages_result.deleted_count > 0:
        await db.tasks.update_many(
            {"user_id": user_id, "chat_session_id": session_id},
            {"$set": {"chat_session_id": None}}
        )
    
    return {
        "message": "Chat session deleted successfully",
        "messages_deleted": messages_result.deleted_count
    }

# ============ TASK PLANNER ENDPOINTS ============

@api_router.get("/tasks")
async def get_tasks(user_id: str = Depends(get_current_user)):
    tasks = list(await db.tasks.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100))
    return {"tasks": tasks}

@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, user_id: str = Depends(get_current_user)):
    # Check for duplicate task (case-insensitive title match)
    existing_task = await db.tasks.find_one({
        "user_id": user_id,
        "title": {"$regex": f"^{task_data.title}$", "$options": "i"},
        "status": {"$ne": "completed"}
    })
    
    if existing_task:
        raise HTTPException(status_code=400, detail="A similar task already exists")
    
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

@api_router.post("/tasks/remove-duplicates")
async def remove_duplicate_tasks(user_id: str = Depends(get_current_user)):
    # Get all active tasks for user
    all_tasks = list(await db.tasks.find(
        {"user_id": user_id, "status": {"$ne": "completed"}},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000))
    
    seen_titles = set()
    duplicates_removed = 0
    
    for task in all_tasks:
        title_lower = task['title'].lower().strip()
        
        if title_lower in seen_titles:
            # This is a duplicate, delete it
            await db.tasks.delete_one({"id": task['id']})
            duplicates_removed += 1
            logging.info(f"Removed duplicate task: {task['title']}")
        else:
            seen_titles.add(title_lower)
    
    return {
        "duplicates_removed": duplicates_removed,
        "message": f"Removed {duplicates_removed} duplicate tasks"
    }

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
        # Check for duplicate task (case-insensitive title match)
        existing_task = await db.tasks.find_one({
            "user_id": user_id,
            "title": {"$regex": f"^{task_data['title']}$", "$options": "i"},
            "status": {"$ne": "completed"}
        })
        
        # Skip if duplicate exists
        if existing_task:
            logging.info(f"Skipping duplicate task: {task_data['title']}")
            continue
        
        # Calculate deadline based on priority
        days_until_deadline = 3 if task_data['priority'] == 'high' else 7 if task_data['priority'] == 'medium' else 14
        deadline = datetime.now(timezone.utc) + timedelta(days=days_until_deadline)
        
        task = Task(
            user_id=user_id,
            **task_data,
            status="todo",
            ai_generated=True,
            priority_number=len(created_tasks) + 1,
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

@api_router.post("/tasks/update-from-insights")
async def update_tasks_from_insights(user_id: str = Depends(get_current_user)):
    # AI analyzes current tasks and chat context to update priorities
    try:
        # Get current active tasks
        current_tasks = list(await db.tasks.find(
            {"user_id": user_id, "status": {"$ne": "completed"}},
            {"_id": 0}
        ).to_list(20))
        
        # Get recent chat messages
        recent_chats = list(await db.chat_messages.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(20).to_list(20))
        
        if not recent_chats:
            return {"tasks_updated": 0, "tasks_created": 0, "message": "No chat context to analyze"}
        
        # Build context for AI
        conversation_summary = "Recent conversations:\n"
        for msg in reversed(recent_chats[-10:]):
            role = "User" if msg['role'] == 'user' else "AI"
            conversation_summary += f"{role}: {msg['content'][:150]}...\n"
        
        current_tasks_summary = "\nCurrent active tasks:\n"
        for idx, task in enumerate(current_tasks[:10]):
            current_tasks_summary += f"{idx+1}. [{task['priority']}] {task['title']} - {task['description']}\n"
        
        profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
        business_context = profile.get('business_idea') or profile.get('business_name', 'the business')
        
        analysis_prompt = f"""Based on the conversation and current tasks for {business_context}, analyze and provide:

{conversation_summary}
{current_tasks_summary}

Provide a JSON response with:
1. "tasks_to_create": NEW tasks that emerged from conversation (max 3)
2. "tasks_to_update": Existing tasks to update priority (by title match)
3. "tasks_to_remove": Tasks that are no longer relevant (by title match)
4. "reasoning": Brief explanation of changes

Format:
{{
  "tasks_to_create": [
    {{"title": "...", "description": "...", "priority": "high"}}
  ],
  "tasks_to_update": [
    {{"title": "existing task title", "new_priority": "high", "reason": "..."}}
  ],
  "tasks_to_remove": ["task title to remove"],
  "reasoning": "Based on the conversation about X, we should focus on Y first..."
}}

Only suggest changes if there's clear new information or better strategy."""
        
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are a strategic task manager. Return ONLY valid JSON, no markdown."
        ).with_model('openai', 'gpt-5')
        
        user_message = UserMessage(text=analysis_prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON
        import json
        if '```json' in response:
            response = response.split('```json')[1].split('```')[0].strip()
        elif '```' in response:
            response = response.split('```')[1].split('```')[0].strip()
        
        task_changes = json.loads(response)
        
        tasks_created = 0
        tasks_updated = 0
        
        # Create new tasks
        for new_task in task_changes.get('tasks_to_create', [])[:3]:
            task_title = new_task.get('title')
            
            # Check for duplicate
            existing_task = await db.tasks.find_one({
                "user_id": user_id,
                "title": {"$regex": f"^{task_title}$", "$options": "i"},
                "status": {"$ne": "completed"}
            })
            
            # Skip if duplicate exists
            if existing_task:
                logging.info(f"Skipping duplicate task from insights: {task_title}")
                continue
            
            task = Task(
                user_id=user_id,
                title=task_title,
                description=new_task.get('description', ''),
                priority=new_task.get('priority', 'medium'),
                status="todo",
                ai_generated=True,
                priority_number=None
            )
            
            task_dict = task.model_dump()
            task_dict['created_at'] = task_dict['created_at'].isoformat()
            task_dict['updated_at'] = task_dict['updated_at'].isoformat()
            
            await db.tasks.insert_one(task_dict)
            tasks_created += 1
        
        # Update existing tasks
        for update in task_changes.get('tasks_to_update', []):
            await db.tasks.update_one(
                {"user_id": user_id, "title": update['title']},
                {"$set": {"priority": update['new_priority']}}
            )
            tasks_updated += 1
        
        # Remove tasks
        for title in task_changes.get('tasks_to_remove', []):
            await db.tasks.delete_one({"user_id": user_id, "title": title})
        
        return {
            "tasks_created": tasks_created,
            "tasks_updated": tasks_updated,
            "reasoning": task_changes.get('reasoning', ''),
            "message": f"Updated task list based on new insights"
        }
        
    except Exception as e:
        logging.error(f"Task update from insights error: {str(e)}")
        return {"tasks_created": 0, "tasks_updated": 0, "message": "Failed to update tasks"}

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
            # Check for duplicate
            task_title = task_data.get('title', 'Untitled Task')
            existing_task = await db.tasks.find_one({
                "user_id": user_id,
                "title": {"$regex": f"^{task_title}$", "$options": "i"},
                "status": {"$ne": "completed"}
            })
            
            # Skip if duplicate exists
            if existing_task:
                logging.info(f"Skipping duplicate task from chat: {task_title}")
                continue
            
            task = Task(
                user_id=user_id,
                title=task_title,
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

# ============ AI SELF-LEARNING & RESEARCH ============

async def web_search(query: str) -> str:
    """Perform web search using a search API"""
    try:
        # Using a simple web search approach
        async with aiohttp.ClientSession() as session:
            # You can replace this with actual search API like Serper, Tavily, etc.
            # For now, we'll use a simulated search
            return f"Search results for: {query} (Web search integration placeholder)"
    except Exception as e:
        logging.error(f"Web search error: {str(e)}")
        return ""

@api_router.post("/ai/research")
async def trigger_ai_research(user_id: str = Depends(get_current_user)):
    """AI researches strategies for user's business type"""
    try:
        profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
        if not profile:
            return {"message": "No business profile found"}
        
        business_type = profile.get('business_idea') or profile.get('business_name', 'business')
        industry = profile.get('desired_industry') or profile.get('industry', 'general')
        
        # Research queries
        research_queries = [
            f"successful {industry} business low follower count high revenue case studies",
            f"how to make $10k-30k per month in {industry} with small audience",
            f"unconventional {industry} marketing strategies that work",
            f"profitable {business_type} strategies 2024 2025",
            f"micro-influencer success stories {industry} monetization"
        ]
        
        research_prompt = f"""Research and analyze successful strategies for a {business_type} in {industry}.

Focus on:
1. **Micro-success stories** - People with <1000 followers making $10-30k/month
2. **Unconventional methods** - Strategies most people don't know about
3. **High-leverage tactics** - Small effort, big results
4. **Free/cheap methods** - Prioritize low-cost approaches

Research queries to consider:
{chr(10).join([f"- {q}" for q in research_queries])}

Provide 5-7 key insights in this format:
**Insight #X: [Title]**
- Strategy: [What they did]
- Why it worked: [Key factors]
- How to apply: [Actionable steps]
- Cost: [Free/Paid]
- Time to results: [Timeframe]

Be specific with examples and numbers."""

        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are a business research expert. Find unconventional, proven strategies from real success stories."
        ).with_model('openai', 'gpt-5')
        
        user_message = UserMessage(text=research_prompt)
        research_results = await chat.send_message(user_message)
        
        # Store learnings in database
        learnings_created = 0
        
        # Extract insights (simple parsing)
        insights = research_results.split("**Insight #")
        for insight in insights[1:]:  # Skip first empty split
            if insight.strip():
                learning = AILearning(
                    user_id=user_id,
                    learning_type="research_finding",
                    category=industry.lower().replace(" ", "_"),
                    insight=f"Insight #{insight.strip()}",
                    source="ai_research",
                    related_business_type=business_type,
                    confidence_score=0.8
                )
                
                learning_dict = learning.model_dump()
                learning_dict['created_at'] = learning_dict['created_at'].isoformat()
                if learning_dict.get('last_applied'):
                    learning_dict['last_applied'] = learning_dict['last_applied'].isoformat()
                
                await db.ai_learnings.insert_one(learning_dict)
                learnings_created += 1
        
        return {
            "research_completed": True,
            "insights_found": learnings_created,
            "research_summary": research_results[:500] + "...",
            "message": f"AI researched {learnings_created} insights for your {business_type}"
        }
        
    except Exception as e:
        logging.error(f"AI research error: {str(e)}")
        return {"research_completed": False, "error": str(e)}

@api_router.post("/ai/learn-from-conversation")
async def learn_from_conversation(user_id: str = Depends(get_current_user)):
    """AI extracts learnings from recent conversations"""
    try:
        # Get recent conversations
        recent_messages = list(await db.chat_messages.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(50))
        
        if not recent_messages:
            return {"learnings_extracted": 0}
        
        # Build conversation summary
        conversation_text = ""
        for msg in reversed(recent_messages[-20:]):
            role = "User" if msg['role'] == 'user' else "AI"
            conversation_text += f"{role}: {msg['content']}\n\n"
        
        profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
        business_context = profile.get('business_idea') or profile.get('business_name', 'business') if profile else 'business'
        
        learning_prompt = f"""Analyze this conversation and extract key learnings about the user's business and strategies.

Business Context: {business_context}

Conversation:
{conversation_text}

Extract 3-5 key insights about:
1. User's preferences (free vs paid tools, time vs money, risk tolerance)
2. Strategies they're interested in
3. Pain points or challenges mentioned
4. Patterns in their questions
5. What worked/didn't work for them

Format as JSON:
{{
  "learnings": [
    {{
      "category": "user_preference|strategy_interest|pain_point|pattern",
      "insight": "Brief insight description",
      "confidence": 0.0-1.0
    }}
  ]
}}

Return ONLY the JSON, no other text."""

        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=str(uuid.uuid4()),
            system_message="You are a pattern detection expert. Extract actionable insights from conversations."
        ).with_model('anthropic', 'claude-4-sonnet-20250514')
        
        user_message = UserMessage(text=learning_prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON
        if '```json' in response:
            response = response.split('```json')[1].split('```')[0].strip()
        elif '```' in response:
            response = response.split('```')[1].split('```')[0].strip()
        
        learnings_data = json_lib.loads(response)
        learnings_created = 0
        
        for learning_item in learnings_data.get('learnings', []):
            learning = AILearning(
                user_id=user_id,
                learning_type="conversation_insight",
                category=learning_item.get('category', 'general'),
                insight=learning_item.get('insight', ''),
                source="conversation_analysis",
                confidence_score=learning_item.get('confidence', 0.7)
            )
            
            learning_dict = learning.model_dump()
            learning_dict['created_at'] = learning_dict['created_at'].isoformat()
            if learning_dict.get('last_applied'):
                learning_dict['last_applied'] = learning_dict['last_applied'].isoformat()
            
            await db.ai_learnings.insert_one(learning_dict)
            learnings_created += 1
        
        return {
            "learnings_extracted": learnings_created,
            "message": f"Extracted {learnings_created} insights from your conversations"
        }
        
    except Exception as e:
        logging.error(f"Conversation learning error: {str(e)}")
        return {"learnings_extracted": 0, "error": str(e)}

@api_router.get("/ai/learnings")
async def get_ai_learnings(user_id: str = Depends(get_current_user)):
    """Get all AI learnings for user"""
    learnings = list(await db.ai_learnings.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50))
    return {"learnings": learnings, "total": len(learnings)}

# ============ ROOT & HEALTH ============

@api_router.get("/")
async def root():
    return {"message": "APOE API - Autonomous Profit Optimization Engine"}

# ============ WORKFLOW AUTOMATION ENDPOINTS ============

class WorkflowNode(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any]

class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Optional[str] = None

class Workflow(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkflowCreate(BaseModel):
    name: str
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]

@api_router.post("/workflows", response_model=Workflow)
async def create_workflow(workflow: WorkflowCreate, user_id: str = Depends(get_current_user)):
    workflow_doc = Workflow(
        user_id=user_id,
        name=workflow.name,
        nodes=workflow.nodes,
        edges=workflow.edges
    )
    
    await db.workflows.insert_one(workflow_doc.model_dump())
    return workflow_doc

@api_router.get("/workflows", response_model=List[Workflow])
async def get_workflows(user_id: str = Depends(get_current_user)):
    workflows = await db.workflows.find({"user_id": user_id}, {"_id": 0}).to_list(length=None)
    return workflows

@api_router.get("/workflows/executions")
async def get_executions(user_id: str = Depends(get_current_user)):
    executions = await db.workflow_executions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("started_at", -1).limit(50).to_list(length=50)
    return executions

@api_router.get("/workflows/executions/{execution_id}")
async def get_execution(execution_id: str, user_id: str = Depends(get_current_user)):
    execution = await db.workflow_executions.find_one(
        {"id": execution_id, "user_id": user_id},
        {"_id": 0}
    )
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution

# ============ INTEGRATIONS ENDPOINTS ============

class IntegrationConfig(BaseModel):
    apiKey: str

@api_router.get("/integrations")
async def get_integrations(user_id: str = Depends(get_current_user)):
    """Get user's integration configurations"""
    logging.info(f"[INTEGRATIONS] Getting integrations for user: {user_id}")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
    integrations = user.get("integrations", {}) if user else {}
    logging.info(f"[INTEGRATIONS] Found integrations: {list(integrations.keys())}")
    return integrations

@api_router.post("/integrations/{service}")
async def save_integration(service: str, config: IntegrationConfig, user_id: str = Depends(get_current_user)):
    """Save integration API key for a service"""
    
    # Validate the API key before saving
    if service == "elevenlabs":
        try:
            # Test the API key by fetching available voices
            test_url = "https://api.elevenlabs.io/v1/voices"
            test_headers = {"xi-api-key": config.apiKey}
            
            response = requests.get(test_url, headers=test_headers, timeout=10)
            
            if response.status_code != 200:
                logging.error(f"ElevenLabs API key validation failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid ElevenLabs API key. Please check your key and try again."
                )
            
            logging.info(f"ElevenLabs API key validated successfully for user {user_id}")
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to validate ElevenLabs API key: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail="Failed to validate API key. Please check your key and internet connection."
            )
    
    # Update user's integrations
    await db.users.update_one(
        {"id": user_id},
        {"$set": {f"integrations.{service}": {"apiKey": config.apiKey}}}
    )
    return {"status": "success", "service": service}

@api_router.delete("/integrations/{service}")
async def delete_integration(service: str, user_id: str = Depends(get_current_user)):
    """Remove integration API key for a service"""
    await db.users.update_one(
        {"id": user_id},
        {"$unset": {f"integrations.{service}": ""}}
    )
    return {"status": "success", "service": service}

# ============ TTS PREVIEW ENDPOINT ============

class TTSPreviewRequest(BaseModel):
    text: str
    voice: str = 'Rachel'
    model_id: str = 'eleven_turbo_v2_5'
    stability: float = 0.5
    similarity_boost: float = 0.75
    style: float = 0
    speaker_boost: bool = False
    speed: float = 1.0  # New: Speaking rate (0.7-1.2)

@api_router.get("/tts/voices")
async def get_elevenlabs_voices(user_id: str = Depends(get_current_user), include_library: bool = True):
    """Fetch all available voices from ElevenLabs API including Voice Library"""
    try:
        # Get ElevenLabs API key from user's integrations
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey")
        
        if not elevenlabs_key:
            raise HTTPException(
                status_code=400,
                detail="ElevenLabs API key not configured. Please add it in Integrations page."
            )
        
        headers = {"xi-api-key": elevenlabs_key}
        all_voices = []
        
        # 1. Fetch user's voices (includes pre-made + cloned + voices added from library)
        logging.info(f"[TTS_VOICES] Fetching voices from account...")
        voices_url = "https://api.elevenlabs.io/v1/voices"
        voices_response = requests.get(voices_url, headers=headers, timeout=10)
        
        if voices_response.status_code == 200:
            voices_data = voices_response.json()
            user_voices = voices_data.get('voices', [])
            
            # Mark user voices
            for voice in user_voices:
                if 'labels' not in voice:
                    voice['labels'] = {}
                voice['labels']['source'] = 'My Voices'
            
            all_voices.extend(user_voices)
            logging.info(f"[TTS_VOICES] Fetched {len(user_voices)} voices from account")
        else:
            logging.error(f"[TTS_VOICES] Voices error: {voices_response.status_code} - {voices_response.text}")
            raise HTTPException(status_code=400, detail="Failed to fetch account voices")
        
        # 2. Search shared Voice Library for popular/featured voices
        if include_library:
            logging.info(f"[TTS_VOICES] Searching shared Voice Library...")
            
            # Use the search endpoint to get public library voices
            # Try different search terms to get diverse results
            search_terms = ["", "a", "e", "i", "o", "u"]  # Get different batches
            library_voice_ids = set()  # Track IDs to avoid duplicates
            
            for search_term in search_terms:
                try:
                    # Using the shared voices endpoint
                    search_url = f"https://api.elevenlabs.io/v1/shared-voices"
                    params = {"page_size": 100}
                    if search_term:
                        params["search"] = search_term
                    
                    search_response = requests.get(search_url, headers=headers, params=params, timeout=15)
                    
                    if search_response.status_code == 200:
                        search_data = search_response.json()
                        library_voices = search_data.get('voices', [])
                        
                        for voice in library_voices:
                            voice_id = voice.get('voice_id') or voice.get('public_owner_id')
                            if voice_id and voice_id not in library_voice_ids:
                                library_voice_ids.add(voice_id)
                                
                                # Format library voice to match user voice structure
                                formatted_voice = {
                                    'voice_id': voice_id,
                                    'name': voice.get('name', 'Unknown'),
                                    'labels': voice.get('labels', {})
                                }
                                formatted_voice['labels']['source'] = 'Shared Library'
                                
                                # Add preview if available
                                if 'preview_url' in voice:
                                    formatted_voice['preview_url'] = voice['preview_url']
                                
                                all_voices.append(formatted_voice)
                        
                        logging.info(f"[TTS_VOICES] Search '{search_term}': Found {len(library_voices)} library voices")
                    else:
                        logging.warning(f"[TTS_VOICES] Search '{search_term}' error: {search_response.status_code}")
                        
                except Exception as e:
                    logging.warning(f"[TTS_VOICES] Error searching library with '{search_term}': {str(e)}")
                    continue
            
            logging.info(f"[TTS_VOICES] Total unique library voices: {len(library_voice_ids)}")
        
        logging.info(f"[TTS_VOICES] TOTAL voices available: {len(all_voices)}")
        
        # Log sample voices
        if all_voices:
            voice_names = [f"{v.get('name')} ({v.get('voice_id', 'N/A')[:8]}...)" for v in all_voices[:5]]
            logging.info(f"[TTS_VOICES] Sample voices: {', '.join(voice_names)}")
        
        return {"voices": all_voices, "total": len(all_voices)}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TTS_VOICES] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch voices: {str(e)}")

@api_router.post("/tts/preview")
async def preview_tts(request: TTSPreviewRequest, user_id: str = Depends(get_current_user)):
    """Generate a preview of text-to-speech with current settings"""
    try:
        logging.info(f"[TTS_PREVIEW] Starting preview for user: {user_id}")
        
        # Get ElevenLabs API key from user's integrations
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        logging.info(f"[TTS_PREVIEW] User data retrieved: {user is not None}")
        
        if not user:
            raise HTTPException(
                status_code=400,
                detail="User not found"
            )
        
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey")
        logging.info(f"[TTS_PREVIEW] API key found: {elevenlabs_key is not None}")
        
        if not elevenlabs_key:
            raise HTTPException(
                status_code=400,
                detail="ElevenLabs API key not configured. Please add it in Integrations page."
            )
        
        # Map voice names to IDs (for backward compatibility)
        voice_map = {
            'rachel': '21m00Tcm4TlvDq8ikWAM',
            'adam': 'pNInz6obpgDQGcFmaJgB',
            'bella': 'EXAVITQu4vr4xnSDxMaL',
            'antoni': 'ErXwobaYiN019PkySvjV',
            'josh': 'TxGEqnHWrfWFTfGW9XjX',
            'arnold': 'VR6AewLTigWG4xSOukaG',
            'sam': 'yoZ06aMxZJJ28mfd3POQ',
            'domi': 'AZnzlk1XvdvUeBnXmlld',
            'elli': 'MF3mGyEYCl7XYWbV9V6O',
        }
        
        # Use voice directly if it looks like an ID (contains letters and numbers), otherwise map it
        voice_id = voice_map.get(request.voice.lower(), request.voice)
        
        logging.info(f"[TTS_PREVIEW] Voice received: {request.voice}")
        logging.info(f"[TTS_PREVIEW] Using voice_id: {voice_id}")
        
        # Call ElevenLabs API
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_key
        }
        
        # Build voice settings
        voice_settings = {
            "stability": float(request.stability),
            "similarity_boost": float(request.similarity_boost),
        }
        
        if request.style > 0:
            voice_settings["style"] = float(request.style)
        if request.speaker_boost:
            voice_settings["use_speaker_boost"] = True
        
        payload = {
            "text": request.text,
            "model_id": request.model_id,
            "voice_settings": voice_settings
        }
        
        # Add speed parameter if not default (1.0)
        if request.speed != 1.0:
            payload["speed"] = float(request.speed)
        
        logging.info(f"[TTS_PREVIEW] Generating preview with voice: {request.voice}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        
        if response.status_code != 200:
            logging.error(f"[TTS_PREVIEW] ElevenLabs API error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=400,
                detail=f"ElevenLabs API error: {response.text}"
            )
        
        # Return audio data
        from fastapi.responses import Response
        return Response(
            content=response.content,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=preview.mp3"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TTS_PREVIEW] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")

# ============ VOICE STUDIO ENDPOINTS ============

@api_router.post("/voice-studio/generate-speech")
async def generate_speech_studio(request: TTSPreviewRequest, user_id: str = Depends(get_current_user)):
    """Generate speech in Voice Studio and save completion"""
    try:
        logging.info(f"[VOICE_STUDIO] Generating speech for user: {user_id}")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey")
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Map voice names to IDs
        voice_map = {
            'rachel': '21m00Tcm4TlvDq8ikWAM',
            'adam': 'pNInz6obpgDQGcFmaJgB',
            'bella': 'EXAVITQu4vr4xnSDxMaL',
            'antoni': 'ErXwobaYiN019PkySvjV',
            'josh': 'TxGEqnHWrfWFTfGW9XjX',
            'arnold': 'VR6AewLTigWG4xSOukaG',
            'sam': 'yoZ06aMxZJJ28mfd3POQ',
            'domi': 'AZnzlk1XvdvUeBnXmlld',
            'elli': 'MF3mGyEYCl7XYWbV9V6O',
        }
        
        voice_id = voice_map.get(request.voice.lower(), request.voice)
        
        # Call ElevenLabs API
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_key
        }
        
        voice_settings = {
            "stability": float(request.stability),
            "similarity_boost": float(request.similarity_boost),
        }
        
        if request.style > 0:
            voice_settings["style"] = float(request.style)
        if request.speaker_boost:
            voice_settings["use_speaker_boost"] = True
        
        payload = {
            "text": request.text,
            "model_id": request.model_id,
            "voice_settings": voice_settings
        }
        
        if request.speed != 1.0:
            payload["speed"] = float(request.speed)
        
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        
        if response.status_code != 200:
            logging.error(f"[VOICE_STUDIO] ElevenLabs API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=400, detail=f"ElevenLabs API error: {response.text}")
        
        # Save completion to database
        completion_id = str(uuid.uuid4())
        audio_base64 = base64.b64encode(response.content).decode('utf-8')
        
        completion = {
            "id": completion_id,
            "user_id": user_id,
            "type": "voice",
            "text": request.text,
            "voice_name": request.voice,
            "voice_id": voice_id,
            "model_id": request.model_id,
            "settings": {
                "stability": request.stability,
                "similarity_boost": request.similarity_boost,
                "style": request.style,
                "speaker_boost": request.speaker_boost,
                "speed": request.speed
            },
            "status": "completed",
            "audio_base64": audio_base64,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "saved": False,
            "log": ["Speech generated successfully"]
        }
        
        await db.voice_completions.insert_one(completion)
        logging.info(f"[VOICE_STUDIO] Completion saved: {completion_id}")
        
        # Return audio
        from fastapi.responses import Response
        return Response(
            content=response.content,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"inline; filename=voice_{completion_id}.mp3"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[VOICE_STUDIO] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")

@api_router.post("/voice-studio/generate-music")
async def generate_music_studio(request: dict, user_id: str = Depends(get_current_user)):
    """Generate music in Voice Studio and save completion"""
    try:
        prompt = request.get("prompt")
        duration_seconds = request.get("duration_seconds", 120)
        
        logging.info(f"[MUSIC_STUDIO] Generating music for user: {user_id}")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey")
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Create completion record
        completion_id = str(uuid.uuid4())
        completion = {
            "id": completion_id,
            "user_id": user_id,
            "type": "music",
            "prompt": prompt,
            "duration": duration_seconds,
            "status": "processing",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "saved": False,
            "log": ["Music generation started"]
        }
        
        await db.voice_completions.insert_one(completion)
        
        # Generate music
        import time
        generate_url = "https://api.elevenlabs.io/v1/music/generate"
        headers = {
            "xi-api-key": elevenlabs_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "prompt": prompt,
            "duration_seconds": int(duration_seconds)
        }
        
        logging.info(f"[MUSIC_STUDIO] Sending generation request: {payload}")
        gen_response = requests.post(generate_url, json=payload, headers=headers, timeout=30)
        
        logging.info(f"[MUSIC_STUDIO] Generation response status: {gen_response.status_code}")
        logging.info(f"[MUSIC_STUDIO] Generation response Content-Type: {gen_response.headers.get('Content-Type', 'unknown')}")
        logging.info(f"[MUSIC_STUDIO] Generation response Content-Length: {len(gen_response.content)}")
        
        if gen_response.status_code != 200:
            await db.voice_completions.update_one(
                {"id": completion_id},
                {"$set": {"status": "failed", "error": gen_response.text}}
            )
            raise HTTPException(status_code=400, detail=f"Music generation request failed: {gen_response.text}")
        
        # Check if ElevenLabs returned audio directly (new API behavior)
        # or JSON with generation_id (old API behavior requiring polling)
        content_type = gen_response.headers.get('Content-Type', '')
        content_length = len(gen_response.content)
        
        if 'audio' in content_type or 'mpeg' in content_type or content_length > 10000:
            # API returned audio directly (new behavior)
            logging.info(f"[MUSIC_STUDIO] Received audio directly: {content_length} bytes")
            audio_bytes = gen_response.content
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            
            # Update completion
            await db.voice_completions.update_one(
                {"id": completion_id},
                {"$set": {
                    "status": "completed",
                    "audio_base64": audio_base64,
                    "log": ["Music generated successfully (direct response)"]
                }}
            )
            
            # Return audio
            from fastapi.responses import Response
            return Response(
                content=audio_bytes,
                media_type="audio/mpeg",
                headers={"Content-Disposition": f"inline; filename=music_{completion_id}.mp3"}
            )
        
        # Otherwise, parse as JSON with generation_id (old behavior)
        try:
            gen_data = gen_response.json()
        except Exception as e:
            logging.error(f"[MUSIC_STUDIO] Failed to parse response as JSON and it's not audio!")
            logging.error(f"[MUSIC_STUDIO] Response (first 1000 bytes): {gen_response.content[:1000]}")
            raise HTTPException(status_code=500, detail=f"Invalid API response: {str(e)}")
        
        generation_id = gen_data.get("generation_id") or gen_data.get("id")
        
        if not generation_id:
            logging.error(f"[MUSIC_STUDIO] No generation_id in response: {gen_data}")
            raise HTTPException(status_code=500, detail="No generation ID returned from API")
        
        logging.info(f"[MUSIC_STUDIO] Generation ID: {generation_id}, polling for completion...")
        
        # Poll for completion
        retrieve_url = f"https://api.elevenlabs.io/v1/music/generate/{generation_id}"
        max_attempts = 60
        attempt = 0
        
        while attempt < max_attempts:
            time.sleep(5)
            attempt += 1
            
            logging.info(f"[MUSIC_STUDIO] Polling attempt {attempt}/{max_attempts}")
            retrieve_response = requests.get(retrieve_url, headers=headers, timeout=30)
            
            if retrieve_response.status_code == 200:
                content_type = retrieve_response.headers.get('Content-Type', '')
                content_length = len(retrieve_response.content)
                
                logging.info(f"[MUSIC_STUDIO] Poll Content-Type: {content_type}, Length: {content_length}")
                
                # Check if this is audio data (either by content-type or size)
                if 'audio' in content_type or 'mpeg' in content_type or content_length > 1000:
                    # Got the audio
                    audio_bytes = retrieve_response.content
                    logging.info(f"[MUSIC_STUDIO] Received audio from polling: {len(audio_bytes)} bytes")
                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                    
                    # Update completion
                    await db.voice_completions.update_one(
                        {"id": completion_id},
                        {"$set": {
                            "status": "completed",
                            "audio_base64": audio_base64,
                            "log": ["Music generated successfully (via polling)"]
                        }}
                    )
                    
                    # Return audio
                    from fastapi.responses import Response
                    return Response(
                        content=audio_bytes,
                        media_type="audio/mpeg",
                        headers={"Content-Disposition": f"inline; filename=music_{completion_id}.mp3"}
                    )
                else:
                    # Small response - try to parse as status JSON
                    try:
                        status_data = retrieve_response.json()
                        logging.info(f"[MUSIC_STUDIO] Status: {status_data}")
                        if status_data.get("status") == "failed":
                            raise HTTPException(status_code=500, detail="Music generation failed on server")
                    except Exception as json_error:
                        logging.warning(f"[MUSIC_STUDIO] Could not parse status JSON: {str(json_error)}")
            elif retrieve_response.status_code == 404:
                logging.warning(f"[MUSIC_STUDIO] Generation not found (404), continuing to poll...")
            else:
                logging.warning(f"[MUSIC_STUDIO] Unexpected status code: {retrieve_response.status_code}")
        
        # Timeout
        await db.voice_completions.update_one(
            {"id": completion_id},
            {"$set": {"status": "failed", "error": "Generation timed out"}}
        )
        raise HTTPException(status_code=408, detail="Music generation timed out")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[MUSIC_STUDIO] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Music generation failed: {str(e)}")

@api_router.get("/voice-studio/completions")
async def get_voice_completions(user_id: str = Depends(get_current_user)):
    """Get all Voice Studio completions for user"""
    try:
        completions = await db.voice_completions.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(length=100)
        
        return {"completions": completions}
    except Exception as e:
        logging.error(f"[VOICE_STUDIO] Error fetching completions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch completions")

# ============================================================
# CONVERSATIONAL AI AGENTS API ENDPOINTS
# ============================================================

@api_router.get("/conversational-ai/agents")
async def get_agents(user_id: str = Depends(get_current_user)):
    """Get all conversational AI agents for user"""
    try:
        agents = await db.conversational_agents.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=100)
        
        return agents
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error fetching agents: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch agents")

@api_router.post("/conversational-ai/agents")
async def create_agent(agent_data: dict, user_id: str = Depends(get_current_user)):
    """Create a new conversational AI agent"""
    try:
        agent = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": agent_data.get("name"),
            "description": agent_data.get("description", ""),
            "systemPrompt": agent_data.get("systemPrompt", ""),
            "voice": agent_data.get("voice", ""),
            "model": agent_data.get("model", "gpt-4o"),
            "firstMessage": agent_data.get("firstMessage", ""),
            "language": agent_data.get("language", "en"),
            "elevenlabs_agent_id": agent_data.get("elevenlabs_agent_id", ""),
            "maxDuration": agent_data.get("maxDuration", 600),
            "temperature": agent_data.get("temperature", 0.7),
            "responseDelay": agent_data.get("responseDelay", 100),
            "enableInterruption": agent_data.get("enableInterruption", True),
            "enableFallback": agent_data.get("enableFallback", True),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Insert and don't return the MongoDB result
        await db.conversational_agents.insert_one(agent.copy())
        
        # Return only the agent data without MongoDB _id
        return {"message": "Agent created successfully", "agent_id": agent["id"]}
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error creating agent: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create agent")

@api_router.put("/conversational-ai/agents/{agent_id}")
async def update_agent(agent_id: str, agent_data: dict, user_id: str = Depends(get_current_user)):
    """Update a conversational AI agent"""
    try:
        update_data = {
            "name": agent_data.get("name"),
            "description": agent_data.get("description", ""),
            "systemPrompt": agent_data.get("systemPrompt", ""),
            "voice": agent_data.get("voice", ""),
            "model": agent_data.get("model", "gpt-4o"),
            "firstMessage": agent_data.get("firstMessage", ""),
            "language": agent_data.get("language", "en"),
            "elevenlabs_agent_id": agent_data.get("elevenlabs_agent_id", ""),
            "maxDuration": agent_data.get("maxDuration", 600),
            "temperature": agent_data.get("temperature", 0.7),
            "responseDelay": agent_data.get("responseDelay", 100),
            "enableInterruption": agent_data.get("enableInterruption", True),
            "enableFallback": agent_data.get("enableFallback", True),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await db.conversational_agents.update_one(
            {"id": agent_id, "user_id": user_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {"message": "Agent updated successfully"}
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error updating agent: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update agent")

@api_router.delete("/conversational-ai/agents/{agent_id}")
async def delete_agent(agent_id: str, user_id: str = Depends(get_current_user)):
    """Delete a conversational AI agent"""
    try:
        result = await db.conversational_agents.delete_one(
            {"id": agent_id, "user_id": user_id}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {"message": "Agent deleted successfully"}
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error deleting agent: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete agent")

@api_router.post("/conversational-ai/agents/{agent_id}/knowledge-base/upload")
async def upload_knowledge_base_file(agent_id: str, file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    """Upload a file to ElevenLabs knowledge base and link to agent"""
    try:
        # Verify agent ownership
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent is not linked to ElevenLabs")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        logging.info(f"[KNOWLEDGE_BASE] Uploading file: {file.filename} for agent {agent_id}")
        
        # Read file content
        file_content = await file.read()
        
        # Step 1: Upload to ElevenLabs knowledge base
        response = requests.post(
            "https://api.elevenlabs.io/v1/convai/knowledge-base",
            headers={"xi-api-key": elevenlabs_key},
            files={"file": (file.filename, file_content, file.content_type)}
        )
        
        if response.status_code not in [200, 201]:
            logging.error(f"[KNOWLEDGE_BASE] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        kb_data = response.json()
        documentation_id = kb_data.get("document_id") or kb_data.get("id")
        logging.info(f"[KNOWLEDGE_BASE] File uploaded successfully: {documentation_id}")
        
        # Step 2: Get current agent knowledge base IDs
        agent_response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if agent_response.status_code != 200:
            logging.error(f"[KNOWLEDGE_BASE] Error fetching agent: {agent_response.text}")
            raise HTTPException(status_code=agent_response.status_code, detail="Failed to fetch agent")
        
        agent_data = agent_response.json()
        current_kb_ids = agent_data.get("knowledge_base", [])
        
        # Add new document ID to the list
        if documentation_id not in current_kb_ids:
            current_kb_ids.append(documentation_id)
        
        # Step 3: Update agent with new knowledge base IDs
        link_response = requests.patch(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json"
            },
            json={"knowledge_base": current_kb_ids}
        )
        
        if link_response.status_code not in [200, 201]:
            logging.error(f"[KNOWLEDGE_BASE] Error linking KB to agent: {link_response.text}")
            raise HTTPException(status_code=link_response.status_code, detail=f"Failed to link KB to agent: {link_response.text}")
        
        logging.info(f"[KNOWLEDGE_BASE] ✅ KB linked to agent successfully")
        
        return {"message": "File uploaded and linked to agent", "document_id": documentation_id, **kb_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[KNOWLEDGE_BASE] Error uploading file: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@api_router.post("/conversational-ai/agents/{agent_id}/knowledge-base/add-text")
async def add_knowledge_base_text(agent_id: str, text_data: dict, user_id: str = Depends(get_current_user)):
    """Add text to ElevenLabs knowledge base and link to agent"""
    try:
        # Verify agent ownership
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent is not linked to ElevenLabs")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        name = text_data.get("name")
        text = text_data.get("text")
        
        if not name or not text:
            raise HTTPException(status_code=400, detail="Name and text are required")
        
        logging.info(f"[KNOWLEDGE_BASE] Adding text: {name} for agent {agent_id}")
        
        # Step 1: Add to ElevenLabs knowledge base (text endpoint)
        response = requests.post(
            "https://api.elevenlabs.io/v1/convai/knowledge-base/text",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json"
            },
            json={
                "name": name,
                "text": text
            }
        )
        
        if response.status_code not in [200, 201]:
            logging.error(f"[KNOWLEDGE_BASE] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        kb_data = response.json()
        documentation_id = kb_data.get("document_id") or kb_data.get("id")
        logging.info(f"[KNOWLEDGE_BASE] Text added successfully: {documentation_id}")
        
        # Step 2: Get current agent knowledge base IDs
        agent_response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if agent_response.status_code != 200:
            logging.error(f"[KNOWLEDGE_BASE] Error fetching agent: {agent_response.text}")
            raise HTTPException(status_code=agent_response.status_code, detail="Failed to fetch agent")
        
        agent_data = agent_response.json()
        current_kb_ids = agent_data.get("knowledge_base", [])
        
        # Add new document ID to the list
        if documentation_id not in current_kb_ids:
            current_kb_ids.append(documentation_id)
        
        # Step 3: Update agent with new knowledge base IDs
        link_response = requests.patch(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json"
            },
            json={"knowledge_base": current_kb_ids}
        )
        
        if link_response.status_code not in [200, 201]:
            logging.error(f"[KNOWLEDGE_BASE] Error linking KB to agent: {link_response.text}")
            raise HTTPException(status_code=link_response.status_code, detail=f"Failed to link KB to agent: {link_response.text}")
        
        logging.info(f"[KNOWLEDGE_BASE] ✅ Text KB linked to agent successfully")
        
        return {"message": "Text added and linked to agent", "document_id": documentation_id, **kb_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[KNOWLEDGE_BASE] Error adding text: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to add text: {str(e)}")

@api_router.get("/conversational-ai/agents/{agent_id}/knowledge-base/list")
async def list_knowledge_base(agent_id: str, user_id: str = Depends(get_current_user)):
    """List knowledge base items for a specific agent from ElevenLabs"""
    try:
        # Verify agent ownership
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            return {"knowledge_base": []}  # Return empty if not linked
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Fetch agent details to get knowledge base IDs
        agent_response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if agent_response.status_code != 200:
            logging.error(f"[KNOWLEDGE_BASE] Error fetching agent: {agent_response.text}")
            raise HTTPException(status_code=agent_response.status_code, detail="Failed to fetch agent")
        
        agent_data = agent_response.json()
        
        # Get knowledge base document IDs from agent
        kb_doc_ids = agent_data.get("knowledge_base", [])
        
        if not kb_doc_ids:
            logging.info(f"[KNOWLEDGE_BASE] No KB items for agent {agent_id}")
            return {"knowledge_base": []}
        
        # Fetch details for each KB item
        kb_items = []
        for doc_id in kb_doc_ids:
            try:
                doc_response = requests.get(
                    f"https://api.elevenlabs.io/v1/convai/knowledge-base/{doc_id}",
                    headers={"xi-api-key": elevenlabs_key}
                )
                
                if doc_response.status_code == 200:
                    kb_items.append(doc_response.json())
                else:
                    logging.warning(f"[KNOWLEDGE_BASE] Failed to fetch doc {doc_id}: {doc_response.text}")
            except Exception as e:
                logging.warning(f"[KNOWLEDGE_BASE] Error fetching doc {doc_id}: {str(e)}")
        
        logging.info(f"[KNOWLEDGE_BASE] Found {len(kb_items)} KB items for agent {agent_id}")
        
        return {"knowledge_base": kb_items}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[KNOWLEDGE_BASE] Error fetching knowledge base: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch knowledge base: {str(e)}")

@api_router.delete("/conversational-ai/agents/{agent_id}/knowledge-base/{kb_id}")
async def delete_knowledge_base_item(agent_id: str, kb_id: str, user_id: str = Depends(get_current_user)):
    """Remove knowledge base item from agent and optionally delete from ElevenLabs"""
    try:
        # Verify agent ownership
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent is not linked to ElevenLabs")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Get current agent knowledge base IDs
        agent_response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if agent_response.status_code != 200:
            logging.error(f"[KNOWLEDGE_BASE] Error fetching agent: {agent_response.text}")
            raise HTTPException(status_code=agent_response.status_code, detail="Failed to fetch agent")
        
        agent_data = agent_response.json()
        current_kb_ids = agent_data.get("knowledge_base", [])
        
        # Remove the document ID from the list
        if kb_id in current_kb_ids:
            current_kb_ids.remove(kb_id)
        
        # Update agent with new knowledge base IDs
        remove_response = requests.patch(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json"
            },
            json={"knowledge_base": current_kb_ids}
        )
        
        if remove_response.status_code not in [200, 201, 204]:
            logging.error(f"[KNOWLEDGE_BASE] Error removing KB from agent: {remove_response.text}")
            raise HTTPException(status_code=remove_response.status_code, detail=f"Failed to remove from agent: {remove_response.text}")
        
        logging.info(f"[KNOWLEDGE_BASE] ✅ Removed KB {kb_id} from agent {agent_id}")
        
        return {"message": "Knowledge base item removed from agent successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[KNOWLEDGE_BASE] Error deleting item: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {str(e)}")

@api_router.post("/conversational-ai/sync-elevenlabs-agents")
async def sync_elevenlabs_agents(user_id: str = Depends(get_current_user)):
    """Sync agents from ElevenLabs account"""
    try:
        # Get ElevenLabs API key from user integrations
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        logging.info(f"[CONVERSATIONAL_AI] Syncing ElevenLabs agents for user {user_id}")
        
        # Fetch agents from ElevenLabs
        import requests
        response = requests.get(
            "https://api.elevenlabs.io/v1/convai/agents",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if response.status_code != 200:
            logging.error(f"[CONVERSATIONAL_AI] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        elevenlabs_agents = response.json().get("agents", [])
        logging.info(f"[CONVERSATIONAL_AI] Found {len(elevenlabs_agents)} agents from ElevenLabs")
        
        synced_count = 0
        updated_count = 0
        
        for el_agent in elevenlabs_agents:
            agent_id = el_agent.get("agent_id")
            agent_name = el_agent.get("name", "Unnamed Agent")
            
            logging.info(f"[CONVERSATIONAL_AI] Processing agent: {agent_name} (ID: {agent_id})")
            logging.info(f"[CONVERSATIONAL_AI] Agent data: {el_agent}")
            
            # Check if agent already exists
            existing = await db.conversational_agents.find_one(
                {"user_id": user_id, "elevenlabs_agent_id": agent_id},
                {"_id": 0}
            )
            
            logging.info(f"[CONVERSATIONAL_AI] Existing agent found: {bool(existing)}")
            
            agent_data = {
                "name": agent_name,
                "description": f"Synced from ElevenLabs",
                "systemPrompt": el_agent.get("conversation_config", {}).get("agent", {}).get("prompt", {}).get("prompt", ""),
                "voice": el_agent.get("conversation_config", {}).get("tts", {}).get("voice_id", ""),
                "model": "gpt-4o",  # Default
                "firstMessage": el_agent.get("conversation_config", {}).get("agent", {}).get("first_message", ""),
                "language": el_agent.get("conversation_config", {}).get("conversation", {}).get("language", "en"),
                "elevenlabs_agent_id": agent_id,
                "synced_from_elevenlabs": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            logging.info(f"[CONVERSATIONAL_AI] Prepared agent data: {agent_data}")
            
            if existing:
                # Update existing agent
                result = await db.conversational_agents.update_one(
                    {"user_id": user_id, "elevenlabs_agent_id": agent_id},
                    {"$set": agent_data}
                )
                updated_count += 1
                logging.info(f"[CONVERSATIONAL_AI] ✅ Updated agent: {agent_name} ({agent_id}) - Modified: {result.modified_count}")
            else:
                # Create new agent
                new_agent = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    **agent_data,
                    "maxDuration": 600,
                    "temperature": 0.7,
                    "responseDelay": 100,
                    "enableInterruption": True,
                    "enableFallback": True,
                    "status": "active",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                result = await db.conversational_agents.insert_one(new_agent)
                synced_count += 1
                logging.info(f"[CONVERSATIONAL_AI] ✅ Created new agent: {agent_name} ({agent_id}) - Inserted ID: {result.inserted_id}")
        
        return {
            "message": f"Successfully synced {synced_count} new agents and updated {updated_count} existing agents",
            "synced": synced_count,
            "updated": updated_count,
            "total": len(elevenlabs_agents)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error syncing agents: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to sync agents: {str(e)}")

@api_router.get("/conversational-ai/agents/{agent_id}/signed-url")
async def get_elevenlabs_signed_url(agent_id: str, user_id: str = Depends(get_current_user)):
    """Get ElevenLabs signed URL for WebSocket connection"""
    try:
        # Get the agent
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Get ElevenLabs agent ID from agent config
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent not configured with ElevenLabs agent ID")
        
        # Get ElevenLabs API key from user integrations
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        logging.info(f"[CONVERSATIONAL_AI] Getting signed URL for ElevenLabs agent {elevenlabs_agent_id}")
        
        # Request signed URL from ElevenLabs
        import requests
        response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
            params={"agent_id": elevenlabs_agent_id},
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if response.status_code != 200:
            logging.error(f"[CONVERSATIONAL_AI] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        signed_url = response.json().get("signed_url")
        
        # Create call log entry
        call_log = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "agent_id": agent_id,
            "agent_name": agent.get("name", "Unknown"),
            "status": "started",
            "exchanges_count": 0,
            "backend_logs": {
                "call_initiated": True,
                "using_elevenlabs_websocket": True
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.conversational_call_logs.insert_one(call_log)
        logging.info(f"[CONVERSATIONAL_AI] Call log created: {call_log['id']}")
        
        return {
            "signed_url": signed_url,
            "call_log_id": call_log["id"],
            "agent_name": agent.get("name")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error getting signed URL: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/conversational-ai/agents/{agent_id}/tools")
async def get_agent_tools(agent_id: str, user_id: str = Depends(get_current_user)):
    """Get agent's tools configuration from ElevenLabs"""
    try:
        # Get agent to verify ownership and get elevenlabs_agent_id
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            return {"built_in_tools": [], "tool_ids": [], "workspace_tools": []}
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Fetch agent details from ElevenLabs
        response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if response.status_code != 200:
            logging.error(f"[TOOLS] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        agent_data = response.json()
        
        # Navigate to the correct location: conversation_config.agent.prompt
        conversation_config = agent_data.get("conversation_config", {})
        agent_config = conversation_config.get("agent", {})
        prompt_config = agent_config.get("prompt", {})
        
        # Log the full structure for debugging
        logging.info(f"[TOOLS] ============ AGENT STRUCTURE DEBUG ============")
        logging.info(f"[TOOLS] Agent data keys: {list(agent_data.keys())}")
        logging.info(f"[TOOLS] Conversation config keys: {list(conversation_config.keys())}")
        logging.info(f"[TOOLS] Agent config keys: {list(agent_config.keys())}")
        logging.info(f"[TOOLS] Prompt config keys: {list(prompt_config.keys())}")
        logging.info(f"[TOOLS] Full prompt config: {prompt_config}")
        logging.info(f"[TOOLS] ================================================")
        
        # Extract tools from the correct nested structure
        # ElevenLabs stores system tools in the 'tools' array as of June 2025
        tools_array = prompt_config.get("tools", [])
        tool_ids = prompt_config.get("tool_ids", [])
        
        logging.info(f"[TOOLS] ============ LOADING FROM ELEVENLABS ============")
        logging.info(f"[TOOLS] Tools array has {len(tools_array)} items")
        logging.info(f"[TOOLS] Tool IDs has {len(tool_ids)} items")
        
        # Map backend tool names to frontend names
        backend_to_frontend = {
            "end_call": "end_call",
            "language_detection": "detect_language",
            "transfer_to_agent": "transfer_to_agent",
            "transfer_to_number": "transfer_to_number",
            "skip_turn": "skip_turn",
            "play_keypad_touch_tone": "keypad",
            "voicemail_detection": "voicemail"
        }
        
        # Extract enabled tools from the tools array
        enabled_tools = []
        tool_configs = {}
        
        for tool_config in tools_array:
            if isinstance(tool_config, dict) and tool_config.get('name'):
                backend_name = tool_config['name']
                frontend_name = backend_to_frontend.get(backend_name, backend_name)
                enabled_tools.append(frontend_name)
                tool_configs[frontend_name] = tool_config
                logging.info(f"[TOOLS]   ✅ {backend_name} -> {frontend_name}")
        
        logging.info(f"[TOOLS] Enabled tools (frontend format): {enabled_tools}")
        logging.info(f"[TOOLS] Tool IDs: {tool_ids}")
        logging.info(f"[TOOLS] ================================================")
        
        return {
            "built_in_tools": enabled_tools,  # List of enabled tool names for frontend
            "tool_ids": tool_ids,            # Custom workspace tool IDs
            "tool_configs": tool_configs      # Full configs for each enabled tool
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TOOLS] Error fetching tools: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch tools: {str(e)}")


@api_router.get("/conversational-ai/agents/{agent_id}/analysis-config")
async def get_agent_analysis_config(agent_id: str, user_id: str = Depends(get_current_user)):
    """Get agent's analysis configuration (evaluation criteria & data collection)"""
    try:
        # Get agent to verify ownership and get elevenlabs_agent_id
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")


        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            # Return empty config if not linked to ElevenLabs
            return {
                "evaluation_criteria": [],
                "data_collection": []
            }
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Fetch agent details from ElevenLabs
        response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if response.status_code != 200:
            logging.error(f"[ANALYSIS_CONFIG] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        agent_data = response.json()
        
        # Extract from platform_settings where ElevenLabs actually stores this data
        platform_settings = agent_data.get("platform_settings", {})
        
        # Get evaluation criteria from platform_settings.evaluation.criteria
        evaluation = platform_settings.get("evaluation", {})
        evaluation_criteria = evaluation.get("criteria", [])
        
        # Get data_collection from platform_settings.data_collection
        # Note: ElevenLabs stores this as an object/dict, convert to list of items
        data_collection_dict = platform_settings.get("data_collection", {})
        
        # Convert dict to list format expected by frontend
        data_collection = []
        for identifier, config in data_collection_dict.items():
            data_collection.append({
                "identifier": identifier,
                "data_type": config.get("type", "string"),
                "description": config.get("description", "")
            })
        
        logging.info(f"[ANALYSIS_CONFIG] ✅ Loaded config for agent {agent_id}: {len(evaluation_criteria)} criteria, {len(data_collection)} data items")
        logging.info(f"[ANALYSIS_CONFIG] Criteria: {evaluation_criteria}")
        logging.info(f"[ANALYSIS_CONFIG] Data items: {data_collection}")
        
        return {
            "evaluation_criteria": evaluation_criteria,
            "data_collection": data_collection
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ANALYSIS_CONFIG] Error fetching config: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch analysis config: {str(e)}")


@api_router.patch("/conversational-ai/agents/{agent_id}/analysis-config")
async def update_agent_analysis_config(
    agent_id: str,
    config_update: dict,
    user_id: str = Depends(get_current_user)
):
    """Update agent's analysis configuration (evaluation criteria & data collection)"""
    try:
        # Get agent to verify ownership and get elevenlabs_agent_id
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent is not linked to ElevenLabs")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # First, get current agent configuration
        get_response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if get_response.status_code != 200:
            logging.error(f"[ANALYSIS_CONFIG] Error getting agent: {get_response.text}")
            raise HTTPException(status_code=get_response.status_code, detail="Failed to get agent configuration")
        
        current_agent = get_response.json()
        
        # Get current platform_settings
        platform_settings = current_agent.get("platform_settings", {})
        
        # Update evaluation criteria in platform_settings.evaluation.criteria
        if "evaluation_criteria" in config_update:
            if "evaluation" not in platform_settings:
                platform_settings["evaluation"] = {}
            platform_settings["evaluation"]["criteria"] = config_update["evaluation_criteria"]
            logging.info(f"[ANALYSIS_CONFIG] Updating evaluation criteria: {len(config_update['evaluation_criteria'])} items")
            logging.info(f"[ANALYSIS_CONFIG] New criteria: {config_update['evaluation_criteria']}")
        
        # Update data collection in platform_settings.data_collection
        # Convert list format from frontend to dict format for ElevenLabs
        if "data_collection" in config_update:
            data_collection_dict = {}
            for item in config_update["data_collection"]:
                identifier = item.get("identifier")
                data_collection_dict[identifier] = {
                    "type": item.get("data_type", "string"),
                    "description": item.get("description", "")
                }
            
            platform_settings["data_collection"] = data_collection_dict
            logging.info(f"[ANALYSIS_CONFIG] Updating data collection: {len(config_update['data_collection'])} items")
            logging.info(f"[ANALYSIS_CONFIG] New data_collection dict: {data_collection_dict}")
        
        # Build update payload with platform_settings
        update_payload = {
            "platform_settings": platform_settings
        }
        
        logging.info(f"[ANALYSIS_CONFIG] Sending update to ElevenLabs for agent {elevenlabs_agent_id}")
        logging.info(f"[ANALYSIS_CONFIG] Update payload: {json_lib.dumps(update_payload, indent=2)}")
        
        patch_response = requests.patch(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json"
            },
            json=update_payload
        )
        
        if patch_response.status_code not in [200, 204]:
            logging.error(f"[ANALYSIS_CONFIG] ElevenLabs API error: {patch_response.text}")
            raise HTTPException(status_code=patch_response.status_code, detail=f"ElevenLabs API error: {patch_response.text}")
        
        logging.info(f"[ANALYSIS_CONFIG] ✅ Successfully updated analysis config for agent {agent_id}")
        logging.info(f"[ANALYSIS_CONFIG] ElevenLabs response status: {patch_response.status_code}")
        
        # Verify the update by fetching the agent again
        verify_response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if verify_response.status_code == 200:
            verified_data = verify_response.json()
            verified_platform = verified_data.get("platform_settings", {})
            verified_eval = verified_platform.get("evaluation", {})
            verified_criteria = verified_eval.get("criteria", [])
            logging.info(f"[ANALYSIS_CONFIG] ✅ VERIFICATION: ElevenLabs now has {len(verified_criteria)} criteria")
            logging.info(f"[ANALYSIS_CONFIG] Verified criteria: {verified_criteria}")
        
        # Parse response to see what ElevenLabs returned
        try:
            response_data = patch_response.json()
            logging.info(f"[ANALYSIS_CONFIG] Response has evaluation_criteria: {response_data.get('evaluation_criteria', 'NOT FOUND')}")
            logging.info(f"[ANALYSIS_CONFIG] Response has data_collection: {response_data.get('data_collection', 'NOT FOUND')}")
            logging.info(f"[ANALYSIS_CONFIG] Response metadata: {response_data.get('metadata', {})}")
            logging.info(f"[ANALYSIS_CONFIG] Response platform_settings: {response_data.get('platform_settings', {})}")
        except:
            logging.info(f"[ANALYSIS_CONFIG] Could not parse response JSON")
        
        return {
            "message": "Analysis configuration updated successfully",
            "evaluation_criteria": config_update.get("evaluation_criteria", []),
            "data_collection": config_update.get("data_collection", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ANALYSIS_CONFIG] Error updating config: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to update analysis config: {str(e)}")



# ============ AGENT TOOLS ENDPOINTS ============

@api_router.get("/conversational-ai/workspace-tools")
async def get_workspace_tools(user_id: str = Depends(get_current_user)):
    """Get workspace server tools and client tools from ElevenLabs"""
    try:
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Fetch workspace server tools
        server_tools_response = requests.get(
            "https://api.elevenlabs.io/v1/convai/server-tools",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        server_tools = []
        if server_tools_response.status_code == 200:
            server_tools = server_tools_response.json().get("tools", [])
        else:
            logging.warning(f"[WORKSPACE_TOOLS] Could not fetch server tools: {server_tools_response.status_code}")
        
        # Fetch workspace client tools
        client_tools_response = requests.get(
            "https://api.elevenlabs.io/v1/convai/client-tools",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        client_tools = []
        if client_tools_response.status_code == 200:
            client_tools = client_tools_response.json().get("tools", [])
        else:
            logging.warning(f"[WORKSPACE_TOOLS] Could not fetch client tools: {client_tools_response.status_code}")
        
        logging.info(f"[WORKSPACE_TOOLS] Loaded {len(server_tools)} server tools, {len(client_tools)} client tools")
        
        return {
            "server_tools": server_tools,
            "client_tools": client_tools
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[WORKSPACE_TOOLS] Error fetching workspace tools: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch workspace tools: {str(e)}")


@api_router.get("/conversational-ai/available-agents")
async def get_available_agents(user_id: str = Depends(get_current_user)):
    """Get list of available agents for transfer"""
    try:
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Fetch all agents
        response = requests.get(
            "https://api.elevenlabs.io/v1/convai/agents",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if response.status_code != 200:
            logging.error(f"[AVAILABLE_AGENTS] Error fetching agents: {response.text}")
            return {"agents": []}
        
        agents_data = response.json()
        agents = agents_data.get("agents", [])
        
        # Return simplified agent list with id and name
        agent_list = [
            {
                "agent_id": agent.get("agent_id"),
                "name": agent.get("name", "Unnamed Agent")
            }
            for agent in agents
            if agent.get("agent_id")
        ]
        
        logging.info(f"[AVAILABLE_AGENTS] Loaded {len(agent_list)} available agents")
        
        return {"agents": agent_list}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[AVAILABLE_AGENTS] Error fetching agents: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch agents: {str(e)}")


@api_router.patch("/conversational-ai/agents/{agent_id}/tools")
async def update_agent_tools(
    agent_id: str,
    tools_update: dict,
    user_id: str = Depends(get_current_user)
):
    """Update agent's tools configuration in ElevenLabs"""
    try:
        # Get agent to verify ownership and get elevenlabs_agent_id
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent is not linked to ElevenLabs")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Get current agent configuration
        get_response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if get_response.status_code != 200:
            logging.error(f"[TOOLS] Error getting agent: {get_response.text}")
            raise HTTPException(status_code=get_response.status_code, detail="Failed to get agent configuration")
        
        current_agent = get_response.json()
        conversation_config = current_agent.get("conversation_config", {})
        agent_config = conversation_config.get("agent", {})
        prompt_config = agent_config.get("prompt", {})
        
        # Get current built_in_tools object structure
        current_built_in_tools = prompt_config.get("built_in_tools", {})
        
        # Update tools in the correct nested location: conversation_config.agent.prompt
        if "built_in_tools" in tools_update:
            # Frontend sends array of tool names: ["end_call", "detect_language"]
            tool_names_to_enable = tools_update["built_in_tools"]
            custom_tool_configs = tools_update.get("tool_configs", {})
            
            logging.info(f"[TOOLS] ============ SAVE OPERATION ============")
            logging.info(f"[TOOLS] Received from frontend: {tool_names_to_enable}")
            logging.info(f"[TOOLS] Custom configs provided: {list(custom_tool_configs.keys())}")
            
            # Map frontend names to backend names
            frontend_to_backend = {
                "end_call": "end_call",
                "detect_language": "language_detection",
                "transfer_to_agent": "transfer_to_agent",
                "transfer_to_number": "transfer_to_number",
                "skip_turn": "skip_turn",
                "keypad": "play_keypad_touch_tone",
                "voicemail": "voicemail_detection"
            }
            
            # Build simplified tools array based on ElevenLabs 2025 structure
            # According to docs: tools array should contain objects with type, name, and optional description
            tools_array = []
            
            for frontend_name in tool_names_to_enable:
                backend_name = frontend_to_backend.get(frontend_name, frontend_name)
                
                # Check if custom config exists
                custom_config = custom_tool_configs.get(frontend_name, {})
                
                # Create tool object matching ACTUAL ElevenLabs structure (verified from API)
                # Structure from GET /v1/convai/agents shows params DIRECTLY on tool, NOT under system!
                tool_obj = {
                    "type": "system",
                    "name": backend_name,
                    "description": custom_config.get("description", ""),
                    "response_timeout_secs": custom_config.get("response_timeout_secs", 20),
                    "disable_interruptions": custom_config.get("disable_interruptions", False),
                    "force_pre_tool_speech": custom_config.get("force_pre_tool_speech", False),
                    "assignments": custom_config.get("assignments", []),
                    "tool_call_sound": custom_config.get("tool_call_sound"),
                    "tool_call_sound_behavior": custom_config.get("tool_call_sound_behavior", "auto")
                }
                
                # Build ONLY system.params structure (no root-level params!)
                # Error path: tools[4].system.params.transfer_to_agent.transfers
                if backend_name == "transfer_to_agent":
                    # Transfer to agent - system.params with system_tool_type + transfer_to_agent.transfers
                    transfers = custom_config.get("params", {}).get("transfer_to_agent", {}).get("transfers", [])
                    tool_obj["system"] = {
                        "params": {
                            "system_tool_type": backend_name,
                            "transfer_to_agent": {
                                "transfers": transfers
                            }
                        }
                    }
                elif backend_name == "transfer_to_number":
                    # Transfer to number - system.params with system_tool_type + transfer_to_number.transfers
                    transfers = custom_config.get("params", {}).get("transfer_to_number", {}).get("transfers", [])
                    tool_obj["system"] = {
                        "params": {
                            "system_tool_type": backend_name,
                            "transfer_to_number": {
                                "transfers": transfers
                            }
                        }
                    }
                elif backend_name == "voicemail_detection":
                    # Voicemail - system.params with system_tool_type + voicemail_message
                    tool_obj["system"] = {
                        "params": {
                            "system_tool_type": backend_name,
                            "voicemail_message": custom_config.get("params", {}).get("voicemail_message") or ""
                        }
                    }
                else:
                    # Simple tools - system.params with system_tool_type only
                    tool_obj["system"] = {
                        "params": {
                            "system_tool_type": backend_name
                        }
                    }
                
                tools_array.append(tool_obj)
                logging.info(f"[TOOLS] ✅ Added tool: {backend_name} (from frontend: {frontend_name})")
                import json
                logging.info(f"[TOOLS]    Full tool object: {json.dumps(tool_obj, indent=2)}")
            
            # Set the tools array - this is the SOURCE OF TRUTH for ElevenLabs
            prompt_config["tools"] = tools_array
            
            # CRITICAL: Remove built_in_tools if it exists (prevents corruption)
            if "built_in_tools" in prompt_config:
                del prompt_config["built_in_tools"]
                logging.info(f"[TOOLS] 🧹 Removed built_in_tools object to prevent corruption")
            
            logging.info(f"[TOOLS] Built simplified ElevenLabs structure:")
            logging.info(f"[TOOLS]   - {len(tools_array)} tools ENABLED")
            logging.info(f"[TOOLS] Enabled tools: {[t['name'] for t in tools_array]}")
        
        if "tool_ids" in tools_update:
            prompt_config["tool_ids"] = tools_update["tool_ids"]
            logging.info(f"[TOOLS] Updating tool IDs: {tools_update['tool_ids']}")
        
        # Update prompt config back into agent config
        agent_config["prompt"] = prompt_config
        conversation_config["agent"] = agent_config
        
        # Send update to ElevenLabs
        update_payload = {
            "conversation_config": conversation_config
        }
        
        logging.info(f"[TOOLS] ============ SENDING TO ELEVENLABS ============")
        logging.info(f"[TOOLS] Agent ID: {elevenlabs_agent_id}")
        logging.info(f"[TOOLS] Tools array being sent:")
        import json
        logging.info(json.dumps(prompt_config.get('tools', []), indent=2))
        logging.info(f"[TOOLS] Tool IDs: {prompt_config.get('tool_ids', [])}")
        logging.info(f"[TOOLS] ================================================")
        
        patch_response = requests.patch(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json"
            },
            json=update_payload
        )
        
        logging.info(f"[TOOLS] ========== ELEVENLABS RESPONSE ==========")
        logging.info(f"[TOOLS] Response status: {patch_response.status_code}")
        
        if patch_response.status_code not in [200, 201]:
            error_text = patch_response.text
            logging.error(f"[TOOLS] ❌ ElevenLabs API ERROR:")
            logging.error(f"[TOOLS] Status: {patch_response.status_code}")
            logging.error(f"[TOOLS] Error: {error_text}")
            
            # Try to parse error details
            try:
                error_json = patch_response.json()
                error_detail = error_json.get('detail', error_text)
                logging.error(f"[TOOLS] Parsed error: {error_detail}")
            except:
                error_detail = error_text
            
            logging.info(f"[TOOLS] ==============================================")
            raise HTTPException(
                status_code=patch_response.status_code, 
                detail=f"ElevenLabs API error: {error_detail}"
            )
        
        # Log what ElevenLabs actually saved
        response_data = patch_response.json()
        response_conversation_config = response_data.get("conversation_config", {})
        response_agent_config = response_conversation_config.get("agent", {})
        response_prompt_config = response_agent_config.get("prompt", {})
        response_tools_array = response_prompt_config.get("tools", [])
        
        logging.info(f"[TOOLS] ✅ Save successful!")
        logging.info(f"[TOOLS] Tools saved in ElevenLabs:")
        for tool in response_tools_array:
            if isinstance(tool, dict):
                logging.info(f"[TOOLS]   ✅ {tool.get('name', 'unknown')}")
        logging.info(f"[TOOLS] Total tools: {len(response_tools_array)}")
        logging.info(f"[TOOLS] ==============================================")
        
        # Get updated agent data to return
        updated_response = patch_response.json()
        updated_conversation_config = updated_response.get("conversation_config", {})
        updated_agent_config = updated_conversation_config.get("agent", {})
        updated_prompt_config = updated_agent_config.get("prompt", {})
        
        # Convert built_in_tools object back to array for frontend
        updated_built_in_tools_obj = updated_prompt_config.get("built_in_tools", {})
        updated_enabled_tools = []
        if isinstance(updated_built_in_tools_obj, dict):
            # Map backend names to frontend names
            backend_to_frontend = {
                "end_call": "end_call",
                "language_detection": "detect_language",
                "transfer_to_agent": "transfer_to_agent",
                "transfer_to_number": "transfer_to_number",
                "skip_turn": "skip_turn",
                "play_keypad_touch_tone": "keypad",
                "voicemail_detection": "voicemail"
            }
            for tool_name, tool_config in updated_built_in_tools_obj.items():
                if tool_config is not None:
                    frontend_name = backend_to_frontend.get(tool_name, tool_name)
                    updated_enabled_tools.append(frontend_name)
        
        logging.info(f"[TOOLS] ✅ Successfully updated tools for agent {agent_id}")
        logging.info(f"[TOOLS] Returning enabled tools to frontend: {updated_enabled_tools}")
        
        return {
            "message": "Tools updated successfully",
            "built_in_tools": updated_enabled_tools,
            "tool_ids": updated_prompt_config.get("tool_ids", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TOOLS] Error updating tools: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to update tools: {str(e)}")


@api_router.post("/conversational-ai/agents/{agent_id}/repair")
async def repair_agent_configuration(agent_id: str, user_id: str = Depends(get_current_user)):
    """
    Emergency repair endpoint to fix corrupted agent configuration
    This removes duplicate fields and resets tools to a clean state
    """
    try:
        logging.info(f"[REPAIR] ============ AGENT REPAIR STARTED ============")
        logging.info(f"[REPAIR] Agent ID: {agent_id}")
        logging.info(f"[REPAIR] User ID: {user_id}")
        
        # Get agent to verify ownership and get elevenlabs_agent_id
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent is not linked to ElevenLabs")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Step 1: Get current agent configuration
        logging.info(f"[REPAIR] Step 1: Fetching current agent configuration...")
        get_response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if get_response.status_code != 200:
            logging.error(f"[REPAIR] Error getting agent: {get_response.text}")
            raise HTTPException(status_code=get_response.status_code, detail="Failed to get agent configuration")
        
        agent_data = get_response.json()
        logging.info(f"[REPAIR] ✅ Agent fetched successfully")
        
        # Step 2: Build a CLEAN configuration
        logging.info(f"[REPAIR] Step 2: Building clean configuration...")
        
        conversation_config = agent_data.get("conversation_config", {})
        agent_config = conversation_config.get("agent", {})
        prompt_config = agent_config.get("prompt", {})
        
        # Build a completely clean prompt configuration - removing ALL problematic fields
        # Only include the essential fields that ElevenLabs requires
        clean_prompt = {
            "prompt": prompt_config.get("prompt", ""),
            "llm": prompt_config.get("llm", "gpt-4o"),
            "temperature": prompt_config.get("temperature", 0.7),
            "max_tokens": -1,  # Always -1, no duplicates
            "tools": [],  # Empty tools array - completely clean
            "tool_ids": [],  # Empty tool_ids - completely clean
            "knowledge_base": prompt_config.get("knowledge_base", []),
            "custom_llm": prompt_config.get("custom_llm"),
            "rag": prompt_config.get("rag", {
                "enabled": False,
                "embedding_model": "e5_mistral_7b_instruct",
                "max_vector_distance": 0.6,
                "max_documents_length": 50000,
                "max_retrieved_rag_chunks_count": 20
            }),
            "timezone": prompt_config.get("timezone"),
            "backup_llm_config": prompt_config.get("backup_llm_config", {"preference": "default"}),
            "ignore_default_personality": prompt_config.get("ignore_default_personality", False)
        }
        
        # Add optional fields only if they exist
        if "reasoning_effort" in prompt_config:
            clean_prompt["reasoning_effort"] = prompt_config["reasoning_effort"]
        if "thinking_budget" in prompt_config:
            clean_prompt["thinking_budget"] = prompt_config["thinking_budget"]
        if "mcp_server_ids" in prompt_config:
            clean_prompt["mcp_server_ids"] = prompt_config.get("mcp_server_ids", [])
        if "native_mcp_server_ids" in prompt_config:
            clean_prompt["native_mcp_server_ids"] = prompt_config.get("native_mcp_server_ids", [])
        
        # CRITICAL: Do NOT include built_in_tools at all - this is causing the corruption
        
        logging.info(f"[REPAIR] ✅ Clean configuration built")
        logging.info(f"[REPAIR]    - Removed all duplicate fields")
        logging.info(f"[REPAIR]    - Removed corrupted built_in_tools object")
        logging.info(f"[REPAIR]    - Set clean tools array: []")
        logging.info(f"[REPAIR]    - Set clean tool_ids: []")
        logging.info(f"[REPAIR]    - Preserved knowledge base: {len(clean_prompt['knowledge_base'])} items")
        
        # Step 3: Send the clean configuration
        logging.info(f"[REPAIR] Step 3: Sending clean configuration to ElevenLabs...")
        
        clean_agent_config = {
            "prompt": clean_prompt,
            "first_message": agent_config.get("first_message", ""),
            "language": agent_config.get("language", "en")
        }
        
        clean_conversation_config = {
            "agent": clean_agent_config,
            "tts": conversation_config.get("tts", {}),
            "asr": conversation_config.get("asr", {})
        }
        
        update_payload = {
            "conversation_config": clean_conversation_config
        }
        
        import json
        logging.info(f"[REPAIR] Sending clean payload:")
        logging.info(json.dumps(clean_prompt, indent=2))
        
        patch_response = requests.patch(
            f"https://api.elevenlabs.io/v1/convai/agents/{elevenlabs_agent_id}",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json"
            },
            json=update_payload
        )
        
        logging.info(f"[REPAIR] Response status: {patch_response.status_code}")
        
        if patch_response.status_code not in [200, 201]:
            error_text = patch_response.text
            logging.error(f"[REPAIR] ❌ REPAIR FAILED:")
            logging.error(f"[REPAIR] Status: {patch_response.status_code}")
            logging.error(f"[REPAIR] Error: {error_text}")
            raise HTTPException(
                status_code=patch_response.status_code,
                detail=f"Failed to repair agent: {error_text}"
            )
        
        logging.info(f"[REPAIR] ✅ SUCCESS! Agent repaired successfully!")
        logging.info(f"[REPAIR] ==============================================")
        
        return {
            "message": "Agent configuration repaired successfully",
            "details": "All duplicate fields removed, tools reset to clean state",
            "next_steps": "You can now add tools back through the UI"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[REPAIR] Error repairing agent: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to repair agent: {str(e)}")



@api_router.post("/conversational-ai/agents/{agent_id}/start-call")
async def start_call_with_agent(agent_id: str, user_id: str = Depends(get_current_user)):
    """Start a call session with an agent"""
    try:
        # Get the agent
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        logging.info(f"[CONVERSATIONAL_AI] Starting call with agent {agent_id}")
        
        # Create call session
        call_session = {
            "id": str(uuid.uuid4()),
            "agent_id": agent_id,
            "user_id": user_id,
            "status": "active",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "conversation": []
        }
        
        await db.call_sessions.insert_one(call_session.copy())
        
        # Create initial call log entry
        call_log = {
            "id": str(uuid.uuid4()),
            "session_id": call_session["id"],
            "user_id": user_id,
            "agent_id": agent_id,
            "agent_name": agent.get("name", "Unknown"),
            "status": "started",
            "exchanges_count": 0,
            "backend_logs": {
                "call_initiated": True,
                "greeting_sent": bool(agent.get("firstMessage")),
                "voice_configured": bool(agent.get("voice"))
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.conversational_call_logs.insert_one(call_log)
        logging.info(f"[CONVERSATIONAL_AI] Call log created: {call_log['id']}")
        
        return {
            "session_id": call_session["id"],
            "call_log_id": call_log["id"],
            "agent_name": agent.get("name"),
            "first_message": agent.get("firstMessage", "")
        }
        
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error starting call: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/conversational-ai/agents/{agent_id}/greeting")
async def generate_greeting(agent_id: str, greeting_data: dict, user_id: str = Depends(get_current_user)):
    """Generate audio for agent's first message"""
    try:
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not agent or not agent.get("firstMessage"):
            return {"audio_url": None}
        
        call_log_id = greeting_data.get("call_log_id")
        audio_url = None
        
        # Generate audio for first message
        if agent.get("voice"):
            # Get ElevenLabs API key from user integrations
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
            elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
            
            if elevenlabs_key:
                
                import requests
                tts_url = f"https://api.elevenlabs.io/v1/text-to-speech/{agent['voice']}"
                
                tts_response = requests.post(
                    tts_url,
                    headers={
                        "xi-api-key": elevenlabs_key,
                        "Content-Type": "application/json"
                    },
                    json={
                        "text": agent["firstMessage"],
                        "model_id": "eleven_turbo_v2_5",
                        "voice_settings": {
                            "stability": 0.5,
                            "similarity_boost": 0.75
                        }
                    },
                    timeout=30
                )
                
                if tts_response.status_code == 200:
                    audio_bytes = tts_response.content
                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                    audio_url = f"data:audio/mpeg;base64,{audio_base64}"
        
        # Update call log with greeting info
        if call_log_id:
            try:
                await db.conversational_call_logs.update_one(
                    {"id": call_log_id, "user_id": user_id},
                    {
                        "$set": {
                            "response": agent["firstMessage"],
                            "audio_url": audio_url,
                            "audio_generated": bool(audio_url),
                            "backend_logs.greeting_generated": True,
                            "backend_logs.greeting_tts_success": bool(audio_url)
                        }
                    }
                )
                logging.info(f"[CONVERSATIONAL_AI] Updated call log {call_log_id} with greeting")
            except Exception as log_error:
                logging.error(f"[CONVERSATIONAL_AI] Failed to update call log: {str(log_error)}")
        
        return {"audio_url": audio_url}
        
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error generating greeting: {str(e)}")
        return {"audio_url": None}

@api_router.post("/conversational-ai/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, chat_data: dict, user_id: str = Depends(get_current_user)):
    """Chat with a conversational AI agent"""
    try:
        # Get the agent
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        message = chat_data.get("message")
        conversation_history = chat_data.get("conversation_history", [])
        
        logging.info(f"[CONVERSATIONAL_AI] Agent {agent_id} received message: {message[:100]}")
        
        # Get LLM response using LlmChat
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        
        load_dotenv()
        
        # Initialize chat with system message
        chat_client = LlmChat(
            api_key=os.getenv("EMERGENT_LLM_KEY"),
            session_id=f"agent_{agent_id}_{user_id}",
            system_message=agent.get("systemPrompt", "You are a helpful assistant.")
        ).with_model("openai", agent.get("model", "gpt-4o"))
        
        # Create user message
        user_msg = UserMessage(text=message)
        
        # Send and get response
        response_text = await chat_client.send_message(user_msg)
        
        logging.info(f"[CONVERSATIONAL_AI] LLM Response: {response_text[:100]}")
        
        # Generate audio using ElevenLabs if voice is configured
        audio_url = None
        if agent.get("voice"):
            try:
                # Get ElevenLabs API key from user integrations
                user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
                elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
                
                if elevenlabs_key:
                    
                    # Generate speech
                    import requests
                    tts_url = f"https://api.elevenlabs.io/v1/text-to-speech/{agent['voice']}"
                    
                    tts_response = requests.post(
                        tts_url,
                        headers={
                            "xi-api-key": elevenlabs_key,
                            "Content-Type": "application/json"
                        },
                        json={
                            "text": response_text,
                            "model_id": "eleven_turbo_v2_5",
                            "voice_settings": {
                                "stability": 0.5,
                                "similarity_boost": 0.75
                            }
                        },
                        timeout=30
                    )
                    
                    if tts_response.status_code == 200:
                        audio_bytes = tts_response.content
                        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                        audio_url = f"data:audio/mpeg;base64,{audio_base64}"
                        logging.info(f"[CONVERSATIONAL_AI] Generated audio: {len(audio_bytes)} bytes")
                    
            except Exception as audio_error:
                logging.error(f"[CONVERSATIONAL_AI] Audio generation error: {str(audio_error)}")
                # Continue without audio
        
        return {
            "response": response_text,
            "audio_url": audio_url,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error in chat: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

@api_router.post("/conversational-ai/agents/{agent_id}/voice-chat")
async def voice_chat_with_agent(agent_id: str, voice_data: dict, user_id: str = Depends(get_current_user)):
    """Voice chat with a conversational AI agent (speech-to-text + chat + text-to-speech)"""
    try:
        logging.info(f"[CONVERSATIONAL_AI] ========== VOICE CHAT REQUEST RECEIVED ==========")
        logging.info(f"[CONVERSATIONAL_AI] Agent ID: {agent_id}")
        logging.info(f"[CONVERSATIONAL_AI] User ID: {user_id}")
        
        # Get the agent
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not agent:
            logging.error(f"[CONVERSATIONAL_AI] Agent not found: {agent_id}")
            raise HTTPException(status_code=404, detail="Agent not found")
        
        logging.info(f"[CONVERSATIONAL_AI] Agent found: {agent.get('name')}")
        
        audio_base64 = voice_data.get("audio")
        conversation_history = voice_data.get("conversation_history", [])
        call_log_id = voice_data.get("call_log_id")
        
        logging.info(f"[CONVERSATIONAL_AI] Audio size: {len(audio_base64) if audio_base64 else 0} chars")
        logging.info(f"[CONVERSATIONAL_AI] Call log ID: {call_log_id}")
        logging.info(f"[CONVERSATIONAL_AI] Conversation history: {len(conversation_history)} messages")
        
        if not audio_base64:
            logging.error(f"[CONVERSATIONAL_AI] No audio data received!")
            raise HTTPException(status_code=400, detail="No audio data provided")
        
        logging.info(f"[CONVERSATIONAL_AI] Voice chat for agent {agent_id}")
        
        # Step 1: Convert speech to text using OpenAI Whisper
        logging.info(f"[CONVERSATIONAL_AI] ===== STEP 1: SPEECH-TO-TEXT =====")
        
        from emergentintegrations.llm.openai import OpenAISpeechToText
        from dotenv import load_dotenv
        import tempfile
        import os as os_module
        
        load_dotenv()
        
        api_key = os.getenv("EMERGENT_LLM_KEY")
        logging.info(f"[CONVERSATIONAL_AI] API key loaded: {bool(api_key)}")
        
        if not api_key:
            raise Exception("EMERGENT_LLM_KEY not found in environment")
        
        # Initialize Whisper
        logging.info(f"[CONVERSATIONAL_AI] Initializing Whisper...")
        stt = OpenAISpeechToText(api_key=api_key)
        
        # Decode base64 audio
        logging.info(f"[CONVERSATIONAL_AI] Decoding audio from base64...")
        audio_bytes = base64.b64decode(audio_base64)
        logging.info(f"[CONVERSATIONAL_AI] Audio decoded: {len(audio_bytes)} bytes")
        
        # Save original audio to temp file
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_input_path = temp_audio.name
        
        logging.info(f"[CONVERSATIONAL_AI] Audio saved to: {temp_input_path}")
        
        # Convert to WAV using FFmpeg (Whisper works best with WAV)
        temp_output_path = temp_input_path.replace('.webm', '.wav')
        
        logging.info(f"[CONVERSATIONAL_AI] Converting audio to WAV using FFmpeg...")
        
        import subprocess
        
        # Skip FFmpeg if file is too small (likely empty/corrupted)
        if len(audio_bytes) < 1000:
            logging.warning(f"[CONVERSATIONAL_AI] ⚠️ Audio too small ({len(audio_bytes)} bytes), skipping FFmpeg")
            raise Exception(f"Audio file too small: {len(audio_bytes)} bytes. Please speak longer and louder.")
        
        try:
            # Convert using ffmpeg - hide banner and loglevel
            result = subprocess.run([
                'ffmpeg', '-hide_banner', '-loglevel', 'error',
                '-i', temp_input_path,
                '-ar', '16000',  # 16kHz sample rate (good for speech)
                '-ac', '1',       # Mono
                '-f', 'wav',      # Force WAV format
                '-y',             # Overwrite output
                temp_output_path
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and os_module.path.exists(temp_output_path):
                wav_size = os_module.path.getsize(temp_output_path)
                logging.info(f"[CONVERSATIONAL_AI] ✅ FFmpeg conversion successful")
                logging.info(f"[CONVERSATIONAL_AI] Input: {len(audio_bytes)} bytes → Output: {wav_size} bytes")
                
                if wav_size > 1000:  # Valid WAV file
                    temp_audio_path = temp_output_path
                else:
                    logging.error(f"[CONVERSATIONAL_AI] ❌ Converted file too small: {wav_size} bytes")
                    raise Exception("FFmpeg produced invalid audio file")
            else:
                logging.error(f"[CONVERSATIONAL_AI] ❌ FFmpeg failed (code {result.returncode})")
                logging.error(f"[CONVERSATIONAL_AI] STDERR: {result.stderr}")
                logging.error(f"[CONVERSATIONAL_AI] STDOUT: {result.stdout}")
                raise Exception(f"FFmpeg conversion failed: {result.stderr}")
                
        except Exception as ffmpeg_error:
            logging.error(f"[CONVERSATIONAL_AI] ❌ FFmpeg error: {str(ffmpeg_error)}")
            raise Exception(f"Audio conversion failed: {str(ffmpeg_error)}")
        
        try:
            # Transcribe audio
            logging.info(f"[CONVERSATIONAL_AI] Calling Whisper API...")
            with open(temp_audio_path, 'rb') as audio_file:
                transcription = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json"
                )
            
            user_message = transcription.text
            logging.info(f"[CONVERSATIONAL_AI] ✅ Transcribed successfully: {user_message[:100]}")
            
        except Exception as whisper_error:
            logging.error(f"[CONVERSATIONAL_AI] ❌ Whisper transcription failed: {str(whisper_error)}")
            import traceback
            logging.error(traceback.format_exc())
            raise
        finally:
            # Clean up temp files
            try:
                if 'temp_input_path' in locals():
                    os_module.unlink(temp_input_path)
                if 'temp_output_path' in locals() and os_module.path.exists(temp_output_path):
                    os_module.unlink(temp_output_path)
            except Exception as cleanup_error:
                logging.warning(f"[CONVERSATIONAL_AI] Cleanup error: {str(cleanup_error)}")
        
        # Step 2: Get LLM response using LlmChat
        logging.info(f"[CONVERSATIONAL_AI] ===== STEP 2: LLM CHAT =====")
        
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        logging.info(f"[CONVERSATIONAL_AI] Initializing LLM chat...")
        logging.info(f"[CONVERSATIONAL_AI] Model: {agent.get('model', 'gpt-4o')}")
        logging.info(f"[CONVERSATIONAL_AI] Session ID: agent_{agent_id}_{user_id}")
        
        # Initialize chat with system message
        chat_client = LlmChat(
            api_key=os.getenv("EMERGENT_LLM_KEY"),
            session_id=f"agent_{agent_id}_{user_id}",
            system_message=agent.get("systemPrompt", "You are a helpful assistant.")
        ).with_model("openai", agent.get("model", "gpt-4o"))
        
        # Create user message
        user_msg = UserMessage(text=user_message)
        logging.info(f"[CONVERSATIONAL_AI] Sending message to LLM: {user_message[:100]}")
        
        # Send and get response
        try:
            response_text = await chat_client.send_message(user_msg)
            logging.info(f"[CONVERSATIONAL_AI] ✅ LLM Response received: {response_text[:100]}")
        except Exception as llm_error:
            logging.error(f"[CONVERSATIONAL_AI] ❌ LLM call failed: {str(llm_error)}")
            import traceback
            logging.error(traceback.format_exc())
            raise
        
        # Step 3: Generate audio response
        logging.info(f"[CONVERSATIONAL_AI] ===== STEP 3: TEXT-TO-SPEECH =====")
        
        audio_url = None
        voice_id = agent.get("voice")
        
        logging.info(f"[CONVERSATIONAL_AI] Agent voice configured: {voice_id}")
        
        if voice_id:
            try:
                # Get ElevenLabs API key from user integrations (same as Voice Studio)
                logging.info(f"[CONVERSATIONAL_AI] Fetching ElevenLabs API key from user integrations...")
                user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
                elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
                
                logging.info(f"[CONVERSATIONAL_AI] ElevenLabs API key found: {bool(elevenlabs_key)}")
                
                if elevenlabs_key:
                    
                    logging.info(f"[CONVERSATIONAL_AI] Generating TTS for voice {voice_id}")
                    logging.info(f"[CONVERSATIONAL_AI] Text to synthesize: {response_text[:100]}...")
                    
                    import requests
                    tts_url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                    
                    tts_response = requests.post(
                        tts_url,
                        headers={
                            "xi-api-key": elevenlabs_key,
                            "Content-Type": "application/json"
                        },
                        json={
                            "text": response_text,
                            "model_id": "eleven_turbo_v2_5",
                            "voice_settings": {
                                "stability": 0.5,
                                "similarity_boost": 0.75
                            }
                        },
                        timeout=30
                    )
                    
                    logging.info(f"[CONVERSATIONAL_AI] TTS response status: {tts_response.status_code}")
                    
                    if tts_response.status_code == 200:
                        audio_bytes_response = tts_response.content
                        audio_base64_response = base64.b64encode(audio_bytes_response).decode('utf-8')
                        audio_url = f"data:audio/mpeg;base64,{audio_base64_response}"
                        logging.info(f"[CONVERSATIONAL_AI] ✅ Generated audio: {len(audio_bytes_response)} bytes")
                    else:
                        logging.error(f"[CONVERSATIONAL_AI] ❌ TTS failed with status {tts_response.status_code}: {tts_response.text}")
                else:
                    logging.warning(f"[CONVERSATIONAL_AI] ⚠️ No ElevenLabs API key found in user integrations")
                    
            except Exception as audio_error:
                logging.error(f"[CONVERSATIONAL_AI] ❌ Audio generation error: {str(audio_error)}")
                import traceback
                logging.error(traceback.format_exc())
        else:
            logging.warning(f"[CONVERSATIONAL_AI] ⚠️ No voice configured for agent")
        
        # Update or create call log
        try:
            if call_log_id:
                # Update existing log
                await db.conversational_call_logs.update_one(
                    {"id": call_log_id, "user_id": user_id},
                    {
                        "$set": {
                            "status": "completed",
                            "transcription": user_message,
                            "response": response_text,
                            "audio_url": audio_url,
                            "audio_generated": bool(audio_url),
                            "exchanges_count": len(conversation_history) // 2 + 1,
                            "backend_logs.whisper_success": True,
                            "backend_logs.llm_success": True,
                            "backend_logs.tts_success": bool(audio_url),
                            "backend_logs.voice_configured": bool(agent.get("voice")),
                            "backend_logs.api_key_found": bool(voice_id and elevenlabs_key) if 'elevenlabs_key' in locals() else False,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                logging.info(f"[CONVERSATIONAL_AI] Updated call log {call_log_id}")
            else:
                # Create new log if no ID provided (fallback)
                call_log = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "agent_id": agent_id,
                    "agent_name": agent.get("name", "Unknown"),
                    "status": "completed",
                    "transcription": user_message,
                    "response": response_text,
                    "audio_url": audio_url,
                    "audio_generated": bool(audio_url),
                    "exchanges_count": len(conversation_history) // 2 + 1,
                    "backend_logs": {
                        "whisper_success": True,
                        "llm_success": True,
                        "tts_success": bool(audio_url),
                        "voice_configured": bool(agent.get("voice")),
                        "api_key_found": bool(voice_id and elevenlabs_key) if 'elevenlabs_key' in locals() else False
                    },
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.conversational_call_logs.insert_one(call_log)
                logging.info(f"[CONVERSATIONAL_AI] Created new call log {call_log['id']}")
        except Exception as log_error:
            logging.error(f"[CONVERSATIONAL_AI] Failed to save call log: {str(log_error)}")
        
        return {
            "transcription": user_message,
            "response": response_text,
            "audio_url": audio_url,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        # Log failed call with detailed error info
        try:
            import traceback
            error_traceback = traceback.format_exc()
            
            call_log_id = voice_data.get("call_log_id") if 'voice_data' in locals() else None
            
            if call_log_id:
                # Update existing log
                await db.conversational_call_logs.update_one(
                    {"id": call_log_id, "user_id": user_id},
                    {
                        "$set": {
                            "status": "failed",
                            "error": str(e),
                            "error_traceback": error_traceback,
                            "backend_logs.whisper_success": 'user_message' in locals(),
                            "backend_logs.llm_success": 'response_text' in locals(),
                            "backend_logs.tts_success": 'audio_url' in locals() and bool(locals().get('audio_url')),
                            "backend_logs.voice_configured": agent.get("voice") if 'agent' in locals() else False,
                            "backend_logs.error_stage": "transcription" if 'user_message' not in locals() else "llm" if 'response_text' not in locals() else "tts",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                logging.error(f"[CONVERSATIONAL_AI] Updated call log {call_log_id} with error")
            else:
                # Create new error log
                call_log = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "agent_id": agent_id,
                    "agent_name": agent.get("name", "Unknown") if 'agent' in locals() else "Unknown",
                    "status": "failed",
                    "error": str(e),
                    "error_traceback": error_traceback,
                    "backend_logs": {
                        "whisper_success": 'user_message' in locals(),
                        "llm_success": 'response_text' in locals(),
                        "tts_success": 'audio_url' in locals() and bool(locals().get('audio_url')),
                        "voice_configured": agent.get("voice") if 'agent' in locals() else False,
                        "error_stage": "transcription" if 'user_message' not in locals() else "llm" if 'response_text' not in locals() else "tts"
                    },
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.conversational_call_logs.insert_one(call_log)
                logging.error(f"[CONVERSATIONAL_AI] Created error call log")
        except Exception as log_error:
            logging.error(f"[CONVERSATIONAL_AI] Failed to save error log: {str(log_error)}")
        
        logging.error(f"[CONVERSATIONAL_AI] Error in voice chat: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to process voice chat: {str(e)}")

@api_router.post("/conversational-ai/call-logs")
async def create_call_log(log_data: dict, user_id: str = Depends(get_current_user)):
    """Save a call log entry for debugging and history"""
    try:
        log_entry = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "agent_id": log_data.get("agent_id"),
            "agent_name": log_data.get("agent_name"),
            "status": log_data.get("status", "unknown"),  # 'started', 'completed', 'failed'
            "error": log_data.get("error"),
            "transcription": log_data.get("transcription"),
            "response": log_data.get("response"),
            "audio_generated": log_data.get("audio_generated", False),
            "duration": log_data.get("duration"),
            "exchanges_count": log_data.get("exchanges_count", 0),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.conversational_call_logs.insert_one(log_entry)
        
        return {"id": log_entry["id"], "message": "Log saved successfully"}
        
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error saving call log: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save call log")

@api_router.get("/conversational-ai/call-logs")
async def get_call_logs(user_id: str = Depends(get_current_user), limit: int = 50):
    """Get call logs for the user"""
    try:
        logs = await db.conversational_call_logs.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        return logs
        
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error fetching call logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch call logs")

@api_router.get("/conversational-ai/call-logs/{agent_id}")
async def get_agent_call_logs(agent_id: str, user_id: str = Depends(get_current_user), limit: int = 50):
    """Get call logs for a specific agent"""
    try:
        logs = await db.conversational_call_logs.find(
            {"user_id": user_id, "agent_id": agent_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        return logs
        
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error fetching agent call logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch agent call logs")

@api_router.patch("/conversational-ai/call-logs/{log_id}")
async def update_call_log(log_id: str, update_data: dict, user_id: str = Depends(get_current_user)):
    """Update a call log entry"""
    try:
        # Add updated timestamp
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await db.conversational_call_logs.update_one(
            {"id": log_id, "user_id": user_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        return {"message": "Call log updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error updating call log: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update call log")

@api_router.post("/conversational-ai/call-logs/{log_id}/add-exchange")
async def add_call_exchange(log_id: str, exchange_data: dict, user_id: str = Depends(get_current_user)):
    """Add a conversation exchange to call log"""
    try:
        # Get current log
        log = await db.conversational_call_logs.find_one(
            {"id": log_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not log:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        # Update with new exchange data
        update_data = {
            "transcription": exchange_data.get("user_transcript"),
            "response": exchange_data.get("agent_response"),
            "audio_url": exchange_data.get("audio_url"),
            "exchanges_count": log.get("exchanges_count", 0) + 1,
            "status": "active",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update backend logs if provided
        if "backend_logs" in exchange_data:
            update_data["backend_logs"] = exchange_data["backend_logs"]
        
        await db.conversational_call_logs.update_one(
            {"id": log_id, "user_id": user_id},
            {"$set": update_data}
        )
        
        return {"message": "Exchange added successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CONVERSATIONAL_AI] Error adding exchange: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to add exchange")


# ============ CONVERSATIONAL AI ANALYTICS ENDPOINTS ============

@api_router.get("/conversational-ai/agents/{agent_id}/analytics/usage")
async def get_agent_usage_analytics(
    agent_id: str,
    user_id: str = Depends(get_current_user),
    aggregation_interval: Optional[str] = "day"
):
    """Get usage analytics for an agent from ElevenLabs"""
    try:
        # Get agent to verify ownership and get elevenlabs_agent_id
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent is not linked to ElevenLabs")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Calculate start and end unix timestamps based on aggregation interval
        end_unix = int(datetime.now(timezone.utc).timestamp())
        
        # Calculate start time based on interval
        if aggregation_interval == "day":
            start_time = datetime.now(timezone.utc) - timedelta(days=1)
        elif aggregation_interval == "week":
            start_time = datetime.now(timezone.utc) - timedelta(weeks=1)
        elif aggregation_interval == "month":
            start_time = datetime.now(timezone.utc) - timedelta(days=30)
        else:
            start_time = datetime.now(timezone.utc) - timedelta(weeks=1)  # Default to week
        
        start_unix = int(start_time.timestamp())
        
        # Build query parameters with required unix timestamps
        params = {
            "start_unix": start_unix,
            "end_unix": end_unix
        }
        
        logging.info(f"[ANALYTICS] Fetching usage for agent {agent_id} from {start_unix} to {end_unix}")
        
        # Fetch usage data from ElevenLabs
        response = requests.get(
            "https://api.elevenlabs.io/v1/usage/character-stats",
            headers={"xi-api-key": elevenlabs_key},
            params=params
        )
        
        if response.status_code != 200:
            logging.error(f"[ANALYTICS] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        usage_data = response.json()
        logging.info(f"[ANALYTICS] Fetched usage data for agent {agent_id}")
        
        return usage_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ANALYTICS] Error fetching usage analytics: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch usage analytics: {str(e)}")


@api_router.get("/conversational-ai/agents/{agent_id}/analytics/conversations")
async def get_agent_conversations(
    agent_id: str,
    user_id: str = Depends(get_current_user),
    page_size: Optional[int] = 50,
    cursor: Optional[str] = None,
    call_duration_min_secs: Optional[int] = None,
    call_duration_max_secs: Optional[int] = None,
    call_start_after_unix: Optional[int] = None,
    call_start_before_unix: Optional[int] = None
):
    """Get conversations list for an agent from ElevenLabs"""
    try:
        # Get agent to verify ownership and get elevenlabs_agent_id
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        elevenlabs_agent_id = agent.get("elevenlabs_agent_id")
        if not elevenlabs_agent_id:
            raise HTTPException(status_code=400, detail="Agent is not linked to ElevenLabs")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Build query parameters
        params = {
            "agent_id": elevenlabs_agent_id,
            "page_size": page_size
        }
        if cursor:
            params["cursor"] = cursor
        if call_duration_min_secs is not None:
            params["call_duration_min_secs"] = call_duration_min_secs
        if call_duration_max_secs is not None:
            params["call_duration_max_secs"] = call_duration_max_secs
        if call_start_after_unix is not None:
            params["call_start_after_unix"] = call_start_after_unix
        if call_start_before_unix is not None:
            params["call_start_before_unix"] = call_start_before_unix
        
        # Fetch conversations from ElevenLabs
        response = requests.get(
            "https://api.elevenlabs.io/v1/convai/conversations",
            headers={"xi-api-key": elevenlabs_key},
            params=params
        )
        
        if response.status_code != 200:
            logging.error(f"[ANALYTICS] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        conversations_data = response.json()
        logging.info(f"[ANALYTICS] Fetched {len(conversations_data.get('conversations', []))} conversations for agent {agent_id}")
        
        return conversations_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ANALYTICS] Error fetching conversations: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversations: {str(e)}")


@api_router.get("/conversational-ai/agents/{agent_id}/analytics/conversations/{conversation_id}")
async def get_conversation_details(
    agent_id: str,
    conversation_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get detailed conversation data from ElevenLabs"""
    try:
        # Verify agent ownership
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Fetch conversation details from ElevenLabs
        response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if response.status_code != 200:
            logging.error(f"[ANALYTICS] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        conversation_data = response.json()
        logging.info(f"[ANALYTICS] Fetched conversation details for {conversation_id}")
        
        # Log the keys available to see what data we have
        logging.info(f"[ANALYTICS] Conversation data keys: {conversation_data.keys()}")
        logging.info(f"[ANALYTICS] Has analysis: {conversation_data.get('analysis')}")
        logging.info(f"[ANALYTICS] Has transcript: {len(conversation_data.get('transcript', []))} items")
        
        return conversation_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ANALYTICS] Error fetching conversation details: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversation details: {str(e)}")



@api_router.get("/conversational-ai/agents/{agent_id}/analytics/conversations/{conversation_id}/audio")
async def get_conversation_audio(
    agent_id: str,
    conversation_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get audio recording URL for a conversation from ElevenLabs"""
    try:
        # Verify agent ownership
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0, "elevenlabs_agent_id": 1}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Fetch audio from ElevenLabs
        logging.info(f"[ANALYTICS] 🎵 Fetching audio for conversation {conversation_id}")
        response = requests.get(
            f"https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/audio",
            headers={"xi-api-key": elevenlabs_key},
            stream=True
        )
        
        logging.info(f"[ANALYTICS] Audio response status: {response.status_code}")
        logging.info(f"[ANALYTICS] Audio content-type: {response.headers.get('content-type')}")
        logging.info(f"[ANALYTICS] Audio content-length: {response.headers.get('content-length')}")
        
        if response.status_code != 200:
            logging.error(f"[ANALYTICS] ElevenLabs audio API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        logging.info(f"[ANALYTICS] ✅ Successfully fetched audio for conversation {conversation_id}")
        
        # Return the audio content with proper headers
        # Note: We need to allow inline playback, not force download
        content_type = response.headers.get('content-type', 'audio/mpeg')
        
        return Response(
            content=response.content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'inline; filename="conversation_{conversation_id}.mp3"',
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ANALYTICS] Error fetching conversation audio: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversation audio: {str(e)}")


@api_router.get("/conversational-ai/agents/{agent_id}/analytics/dashboard")
async def get_analytics_dashboard(
    agent_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get custom dashboard configuration from ElevenLabs"""
    try:
        # Verify agent ownership
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Fetch dashboard configuration from ElevenLabs
        response = requests.get(
            "https://api.elevenlabs.io/v1/convai/dashboard",
            headers={"xi-api-key": elevenlabs_key}
        )
        
        if response.status_code != 200:
            logging.error(f"[ANALYTICS] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        dashboard_data = response.json()
        logging.info(f"[ANALYTICS] Fetched dashboard configuration for agent {agent_id}")
        
        return dashboard_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ANALYTICS] Error fetching dashboard: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard: {str(e)}")


@api_router.patch("/conversational-ai/agents/{agent_id}/analytics/dashboard")
async def update_analytics_dashboard(
    agent_id: str,
    dashboard_config: dict,
    user_id: str = Depends(get_current_user)
):
    """Update custom dashboard configuration in ElevenLabs"""
    try:
        # Verify agent ownership
        agent = await db.conversational_agents.find_one(
            {"id": agent_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Get ElevenLabs API key
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey") if user else None
        
        if not elevenlabs_key:
            raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
        
        # Update dashboard configuration in ElevenLabs
        response = requests.patch(
            "https://api.elevenlabs.io/v1/convai/dashboard",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json"
            },
            json=dashboard_config
        )
        
        if response.status_code != 200:
            logging.error(f"[ANALYTICS] ElevenLabs API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs API error: {response.text}")
        
        dashboard_data = response.json()
        logging.info(f"[ANALYTICS] Updated dashboard configuration for agent {agent_id}")
        
        return dashboard_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[ANALYTICS] Error updating dashboard: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to update dashboard: {str(e)}")


@api_router.post("/voice-studio/completions/{completion_id}/save")
async def save_completion(completion_id: str, user_id: str = Depends(get_current_user)):
    """Mark a completion as saved"""
    try:
        result = await db.voice_completions.update_one(
            {"id": completion_id, "user_id": user_id},
            {"$set": {"saved": True}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Completion not found")
        
        return {"message": "Completion saved"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[VOICE_STUDIO] Error saving completion: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save completion")

@api_router.get("/workflows/{workflow_id}", response_model=Workflow)
async def get_workflow(workflow_id: str, user_id: str = Depends(get_current_user)):
    workflow = await db.workflows.find_one({"id": workflow_id, "user_id": user_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@api_router.put("/workflows/{workflow_id}", response_model=Workflow)
async def update_workflow(workflow_id: str, workflow: WorkflowCreate, user_id: str = Depends(get_current_user)):
    existing = await db.workflows.find_one({"id": workflow_id, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    update_doc = {
        "name": workflow.name,
        "nodes": [node.model_dump() for node in workflow.nodes],
        "edges": [edge.model_dump() for edge in workflow.edges],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.workflows.update_one(
        {"id": workflow_id, "user_id": user_id},
        {"$set": update_doc}
    )
    
    return await get_workflow(workflow_id, user_id)

@api_router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str, user_id: str = Depends(get_current_user)):
    result = await db.workflows.delete_one({"id": workflow_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"message": "Workflow deleted successfully"}

class WorkflowExecution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    workflow_name: str
    user_id: str
    status: str  # 'running', 'completed', 'failed'
    progress: int = 0
    current_node: Optional[str] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    duration: Optional[int] = None  # milliseconds
    execution_log: List[str] = []
    results: Dict[str, Any] = {}
    error: Optional[str] = None

# Execution routes moved above to avoid route conflicts

@api_router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, user_id: str = Depends(get_current_user)):
    workflow = await db.workflows.find_one({"id": workflow_id, "user_id": user_id}, {"_id": 0})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Create execution record
    execution = WorkflowExecution(
        workflow_id=workflow_id,
        workflow_name=workflow.get('name', 'Unnamed Workflow'),
        user_id=user_id,
        status='running'
    )
    await db.workflow_executions.insert_one(execution.model_dump())
    
    # Store execution_id for use in nested function scope
    execution_id = execution.id
    
    # Build execution graph
    nodes_dict = {node['id']: node for node in workflow['nodes']}
    edges_dict = {}
    for edge in workflow['edges']:
        source = edge['source']
        if source not in edges_dict:
            edges_dict[source] = []
        edges_dict[source].append(edge['target'])
    
    # Find start node
    start_nodes = [node for node in workflow['nodes'] if node['type'] == 'start']
    if not start_nodes:
        raise HTTPException(status_code=400, detail="Workflow must have a start node")
    
    # Execute workflow
    results = {}
    execution_log = []
    total_nodes = len(workflow['nodes'])
    completed_nodes = 0
    
    async def execute_node(node_id: str, input_data: Any = None):
        node = nodes_dict.get(node_id)
        if not node:
            return None
        
        node_type = node['type']
        node_data = node['data']
        
        execution_log.append(f"Executing {node_type} node: {node_id}")
        
        try:
            if node_type == 'start':
                result = {"status": "started", "data": input_data}
            
            elif node_type == 'gemini':
                # Execute AI chat node with conversation history and context from previous AI nodes
                prompt = node_data.get('prompt', 'Hello')
                model = node_data.get('model', 'gemini-2.5-pro')
                
                # Build context from all previous AI responses in this workflow
                context_history = []
                audio_specs_found = False
                
                for prev_node_id, prev_result in results.items():
                    if isinstance(prev_result, dict) and 'response' in prev_result and 'model' in prev_result:
                        # This was an AI node - include its response in context
                        response_text = prev_result['response']
                        context_history.append({
                            'node_id': prev_node_id,
                            'response': response_text
                        })
                        
                        # Check if this response contains audio/voice specifications
                        if any(keyword in response_text.upper() for keyword in ['VOICE:', 'SPEAKING:', 'BACKGROUND AUDIO:', 'VOICEOVER']):
                            audio_specs_found = True
                
                # Build enriched prompt with context
                if context_history:
                    context_text = "\n\n" + "="*80 + "\n"
                    context_text += "PREVIOUS AI RESPONSES - USE FOR CONTEXT AND CONTINUITY\n"
                    context_text += "="*80 + "\n"
                    
                    for idx, ctx in enumerate(context_history, 1):
                        context_text += f"\n--- Previous AI Node {idx} ({ctx['node_id']}) ---\n{ctx['response']}\n"
                    
                    context_text += "\n" + "="*80 + "\n"
                    context_text += "YOUR CURRENT TASK\n"
                    context_text += "="*80 + "\n\n"
                    
                    if audio_specs_found:
                        enriched_prompt = context_text + prompt + "\n\n[CRITICAL INSTRUCTIONS:\n- If the previous AI specified VOICE/AUDIO characteristics, you MUST use the EXACT SAME specifications for perfect audio continuity\n- Copy voice gender, age, tone, speaking pace, background audio EXACTLY as specified\n- This ensures the same voice and sounds throughout all videos\n- For script continuation, complete the incomplete sentence naturally\n- Maintain visual and narrative continuity as well]"
                    else:
                        enriched_prompt = context_text + prompt + "\n\n[Remember: Use the previous AI responses above as context to maintain continuity and coherence in your response.]"
                else:
                    enriched_prompt = prompt
                
                logging.info(f"[GEMINI] Node {node_id} executing with {len(context_history)} previous AI context(s)")
                
                # Use execution-specific session to maintain conversation history within workflow
                chat = LlmChat(
                    api_key=os.environ.get('EMERGENT_LLM_KEY'),
                    session_id=f"{workflow_id}_{execution_id}",  # Unique per workflow execution
                    system_message="You are a helpful AI assistant in an automation workflow. When provided with previous AI responses, use them as context to maintain continuity, consistency, and logical flow in your responses."
                ).with_model('gemini', model)
                
                user_message = UserMessage(text=enriched_prompt)
                response = await chat.send_message(user_message)
                result = {"response": response, "model": model, "original_prompt": prompt}
            
            elif node_type == 'http':
                # Execute HTTP request
                url = node_data.get('url', '')
                method = node_data.get('method', 'GET').upper()
                
                async with aiohttp.ClientSession() as session:
                    if method == 'GET':
                        async with session.get(url) as resp:
                            result = {"status": resp.status, "data": await resp.text()}
                    elif method == 'POST':
                        body = node_data.get('body', {})
                        async with session.post(url, json=body) as resp:
                            result = {"status": resp.status, "data": await resp.text()}
                    else:
                        result = {"error": "Unsupported HTTP method"}
            
            elif node_type == 'database':
                # Execute database read
                collection = node_data.get('collection', 'users')
                query_str = node_data.get('query', '{}')
                try:
                    query = json_lib.loads(query_str) if isinstance(query_str, str) else query_str
                except:
                    query = {}
                
                docs = await db[collection].find(query, {"_id": 0}).limit(10).to_list(length=10)
                result = {"count": len(docs), "data": docs}
            
            elif node_type == 'elevenlabs':
                # Execute ElevenLabs TTS
                text = node_data.get('text', '')
                voice = node_data.get('voice', 'rachel')
                api_key = node_data.get('apiKey', '')
                
                result = {"status": "TTS conversion would happen here", "text": text, "voice": voice}
            
            elif node_type == 'manychat':
                # Execute ManyChat action
                action = node_data.get('action', 'send_message')
                message = node_data.get('message', '')
                
                result = {"status": f"ManyChat {action} would execute", "message": message}
            
            elif node_type == 'videogen':
                # Execute Video Generation
                # Get prompt from node config OR from previous node's response
                prompt = node_data.get('prompt', '')
                
                # If no prompt in config, try to get from previous node's output
                if not prompt and isinstance(input_data, dict):
                    prompt = input_data.get('response', input_data.get('prompt', ''))
                
                # Fallback to input_data as string if it's a direct prompt
                if not prompt and isinstance(input_data, str):
                    prompt = input_data
                
                duration = node_data.get('duration', 4)
                size = node_data.get('size', '1280x720')  # Get size from node config
                
                if not prompt:
                    result = {"status": "error", "error": "No prompt provided for video generation"}
                else:
                    try:
                        video_gen = OpenAIVideoGeneration(api_key=os.environ.get('EMERGENT_LLM_KEY'))
                        video_bytes = video_gen.text_to_video(
                            prompt=prompt,
                            model="sora-2",
                            size=size,
                            duration=duration,
                            max_wait_time=600
                        )
                        
                        if video_bytes:
                            video_base64 = base64.b64encode(video_bytes).decode('utf-8')
                            result = {"status": "success", "video_base64": video_base64, "duration": duration, "size": size, "prompt": prompt}
                        else:
                            result = {"status": "failed", "error": "Video generation returned no data"}
                    except Exception as e:
                        result = {"status": "error", "error": f"Video generation failed: {str(e)}"}
            
            elif node_type == 'imagetovideo':
                # Execute Image-To-Video Generation (Sora 2)
                
                # ENHANCED LOGGING: Log input_data received
                logging.info(f"[IMAGETOVIDEO] Node {node_id} executing")
                logging.info(f"[IMAGETOVIDEO] input_data type: {type(input_data)}")
                if isinstance(input_data, dict):
                    logging.info(f"[IMAGETOVIDEO] input_data keys: {list(input_data.keys())}")
                    # Log first 100 chars of each value to avoid huge logs
                    for key, val in input_data.items():
                        val_preview = str(val)[:100] if not key.endswith('base64') else f"<base64 data, length={len(str(val))}>"
                        logging.info(f"[IMAGETOVIDEO] input_data['{key}']: {val_preview}")
                else:
                    logging.info(f"[IMAGETOVIDEO] input_data: {str(input_data)[:100]}")
                
                # Log results dict
                logging.info(f"[IMAGETOVIDEO] results dict has {len(results)} nodes")
                for res_node_id, res_data in results.items():
                    if isinstance(res_data, dict):
                        res_keys = list(res_data.keys())
                        has_image = 'image_base64' in res_data
                        has_video = 'video_base64' in res_data
                        logging.info(f"[IMAGETOVIDEO] results['{res_node_id}']: keys={res_keys}, has_image={has_image}, has_video={has_video}")
                
                # Get prompt from node config OR from previous node's response
                prompt = node_data.get('prompt', '')
                
                # If no prompt in config, try to get from input or from any previous AI node
                if not prompt and isinstance(input_data, dict):
                    prompt = input_data.get('response', input_data.get('prompt', ''))
                
                if not prompt and isinstance(input_data, str):
                    prompt = input_data
                
                # If still no prompt, search previous AI chat nodes
                if not prompt:
                    for node_id_search, result in results.items():
                        if isinstance(result, dict) and result.get('model') and result.get('response'):
                            prompt = result.get('response')
                            logging.info(f"[IMAGETOVIDEO] Found prompt from AI node: {node_id_search}")
                            break
                
                logging.info(f"[IMAGETOVIDEO] Prompt resolved: {prompt[:100] if prompt else 'NONE'}")
                
                # Get image from uploaded config, previous node, or search all screenshot nodes
                image_base64 = node_data.get('uploadedImage')  # Check for uploaded image first
                
                # Remove data URL prefix if present
                if image_base64 and 'base64,' in image_base64:
                    image_base64 = image_base64.split('base64,')[1]
                
                # If no uploaded image, try to get from input
                if not image_base64 and isinstance(input_data, dict):
                    image_base64 = input_data.get('image_base64')
                    if image_base64:
                        logging.info(f"[IMAGETOVIDEO] Found image in input_data")
                
                # If still no image, search all previous screenshot nodes
                if not image_base64:
                    logging.info(f"[IMAGETOVIDEO] Searching for image in {len(results)} previous nodes")
                    for node_id_search, result in results.items():
                        if isinstance(result, dict) and result.get('image_base64'):
                            image_base64 = result.get('image_base64')
                            logging.info(f"[IMAGETOVIDEO] Found image from node: {node_id_search}")
                            break
                    if not image_base64:
                        logging.error(f"[IMAGETOVIDEO] No image found in any previous node. Results keys: {list(results.keys())}")
                
                duration = node_data.get('duration', 4)
                size = node_data.get('size', '1280x720')
                
                if not prompt:
                    result = {"status": "error", "error": "No prompt provided for image-to-video generation"}
                elif not image_base64:
                    result = {"status": "error", "error": "No image data found from previous node. Connect a Screenshot node before Image-To-Video node."}
                else:
                    try:
                        logging.info(f"[IMAGETOVIDEO] Starting image-to-video generation with prompt: {prompt[:100]}")
                        logging.info(f"[IMAGETOVIDEO] Parameters: duration={duration}, size={size}")
                        
                        # Call OpenAI Sora 2 API directly with correct input_reference parameter
                        import requests
                        import time
                        from emergentintegrations.llm.utils import get_integration_proxy_url, get_app_identifier
                        
                        api_key = os.environ.get('EMERGENT_LLM_KEY')
                        proxy_url = get_integration_proxy_url()
                        base_url = proxy_url + "/llm/openai/v1"
                        
                        headers = {
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        }
                        
                        app_url = get_app_identifier()
                        if app_url:
                            headers['X-App-ID'] = app_url
                        
                        # Decode the base64 image data
                        image_bytes = base64.b64decode(image_base64)
                        
                        # Prepare multipart form data (Sora 2 expects file upload, not JSON)
                        files = {
                            'input_reference': ('image.png', image_bytes, 'image/png')
                        }
                        
                        data = {
                            "model": "sora-2",
                            "prompt": prompt,
                            "size": size,
                            "seconds": str(duration)
                        }
                        
                        logging.info(f"[IMAGETOVIDEO] Sending multipart request to {base_url}/videos")
                        logging.info(f"[IMAGETOVIDEO] Data fields: {data.keys()}")
                        logging.info(f"[IMAGETOVIDEO] Image size: {len(image_bytes)} bytes")
                        
                        # Update headers for multipart/form-data (remove Content-Type, requests will set it)
                        upload_headers = {k: v for k, v in headers.items() if k.lower() != 'content-type'}
                        
                        # Initiate video generation with multipart form data
                        response = requests.post(f"{base_url}/videos", headers=upload_headers, data=data, files=files, timeout=30)
                        
                        if response.status_code != 200:
                            logging.error(f"[IMAGETOVIDEO] API error {response.status_code}: {response.text}")
                        
                        response.raise_for_status()
                        
                        data = response.json()
                        operation_id = data.get("id") or data.get("operation_id")
                        
                        if not operation_id:
                            logging.error(f"[IMAGETOVIDEO] No operation ID in response: {data}")
                            result = {"status": "error", "error": "No operation ID returned from API"}
                        else:
                            logging.info(f"[IMAGETOVIDEO] Video generation initiated with ID: {operation_id}")
                            
                            # Wait for completion
                            operation_url = f"{base_url}/videos/{operation_id}"
                            start_time = time.time()
                            max_wait_time = 600  # 10 minutes
                            poll_interval = 10
                            
                            video_uri = None
                            while time.time() - start_time < max_wait_time:
                                time.sleep(poll_interval)
                                
                                status_response = requests.get(operation_url, headers=headers, timeout=30)
                                status_response.raise_for_status()
                                status_data = status_response.json()
                                
                                status = status_data.get("status", "").lower()
                                
                                if status in ["completed", "complete", "succeeded", "success"]:
                                    logging.info(f"[IMAGETOVIDEO] Video generation completed!")
                                    
                                    # Get video URL or construct it
                                    video_uri = (status_data.get("video_url") or status_data.get("url") or
                                               status_data.get("download_url") or 
                                               f"{base_url}/videos/{operation_id}/content")
                                    
                                    logging.info(f"[IMAGETOVIDEO] Video URI: {video_uri}")
                                    break
                                    
                                elif status in ["failed", "error"]:
                                    error_msg = status_data.get("error", "Unknown error")
                                    logging.error(f"[IMAGETOVIDEO] Generation failed: {error_msg}")
                                    result = {"status": "error", "error": f"Video generation failed: {error_msg}"}
                                    break
                                    
                                else:
                                    progress = status_data.get("progress", 0)
                                    elapsed = int(time.time() - start_time)
                                    logging.info(f"[IMAGETOVIDEO] Still processing... ({elapsed}s elapsed, status: {status}, progress: {progress}%)")
                            
                            # Download the video if URI was obtained
                            if video_uri:
                                logging.info(f"[IMAGETOVIDEO] Downloading video from: {video_uri}")
                                
                                download_response = requests.get(video_uri, headers=headers, stream=True, timeout=120)
                                download_response.raise_for_status()
                                
                                video_bytes = b""
                                for chunk in download_response.iter_content(chunk_size=8192):
                                    if chunk:
                                        video_bytes += chunk
                                
                                logging.info(f"[IMAGETOVIDEO] Downloaded {len(video_bytes)} bytes")
                                
                                if len(video_bytes) > 1000:
                                    video_base64_encoded = base64.b64encode(video_bytes).decode('utf-8')
                                    result = {
                                        "status": "success",
                                        "video_base64": video_base64_encoded,
                                        "duration": duration,
                                        "size": size,
                                        "prompt": prompt
                                    }
                                    logging.info(f"[IMAGETOVIDEO] Success! Video encoded to base64")
                                else:
                                    result = {"status": "error", "error": f"Video data too small: {len(video_bytes)} bytes"}
                            else:
                                if 'result' not in locals():
                                    result = {"status": "error", "error": "Timeout waiting for video generation"}
                                    
                    except Exception as e:
                        import traceback
                        logging.error(f"[IMAGETOVIDEO] Exception: {str(e)}")
                        logging.error(f"[IMAGETOVIDEO] Traceback: {traceback.format_exc()}")
                        result = {"status": "error", "error": f"Image-to-video generation failed: {str(e)}"}
            
            elif node_type == 'imagegen':
                # Execute Image Generation
                prompt = node_data.get('prompt', '')
                size = node_data.get('size', '1024x1024')  # Get size from node config
                
                try:
                    image_gen = OpenAIImageGeneration(api_key=os.environ.get('EMERGENT_LLM_KEY'))
                    images = await image_gen.generate_images(
                        prompt=prompt,
                        model="gpt-image-1",
                        number_of_images=1
                    )
                    
                    if images and len(images) > 0:
                        image_base64 = base64.b64encode(images[0]).decode('utf-8')
                        result = {"status": "success", "image_base64": image_base64, "size": size, "prompt": prompt}
                    else:
                        result = {"status": "failed", "error": "Image generation failed"}
                except Exception as e:
                    result = {"status": "error", "error": str(e)}
            
            elif node_type == 'screenshot':
                # Execute Screenshot Extraction from Video
                try:
                    # Get video from previous node's result
                    video_base64 = None
                    if isinstance(input_data, dict):
                        video_base64 = input_data.get('video_base64')
                    
                    if not video_base64:
                        result = {"status": "error", "error": "No video data found from previous node. Connect a Video Gen node before Screenshot node."}
                    else:
                        import cv2
                        import numpy as np
                        from io import BytesIO
                        
                        # Decode video from base64
                        video_bytes = base64.b64decode(video_base64)
                        
                        # Save temporarily to process with opencv
                        temp_video_path = f"/tmp/temp_video_{str(uuid.uuid4())}.mp4"
                        with open(temp_video_path, 'wb') as f:
                            f.write(video_bytes)
                        
                        # Open video with opencv
                        cap = cv2.VideoCapture(temp_video_path)
                        
                        # Get total frames
                        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        
                        if total_frames > 0:
                            # Set to last frame
                            cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames - 1)
                            
                            # Read last frame
                            ret, frame = cap.read()
                            
                            if ret:
                                # Convert BGR to RGB
                                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                                
                                # Encode frame as PNG
                                from PIL import Image
                                img = Image.fromarray(frame_rgb)
                                img_byte_arr = BytesIO()
                                img.save(img_byte_arr, format='PNG')
                                img_byte_arr = img_byte_arr.getvalue()
                                
                                # Convert to base64
                                screenshot_base64 = base64.b64encode(img_byte_arr).decode('utf-8')
                                
                                result = {
                                    "status": "success",
                                    "image_base64": screenshot_base64,
                                    "size": f"{frame.shape[1]}x{frame.shape[0]}",
                                    "prompt": "Last frame screenshot from video"
                                }
                            else:
                                result = {"status": "error", "error": "Failed to read last frame from video"}
                        else:
                            result = {"status": "error", "error": "Video has no frames"}
                        
                        # Cleanup
                        cap.release()
                        if os.path.exists(temp_video_path):
                            os.remove(temp_video_path)
                        
                except Exception as e:
                    result = {"status": "error", "error": f"Screenshot extraction failed: {str(e)}"}
            
            elif node_type == 'stitch':
                # Execute Video Stitching - combine multiple videos
                try:
                    logging.info(f"[STITCH] Node {node_id} executing")
                    logging.info(f"[STITCH] Searching for videos in {len(results)} previous nodes")
                    
                    # Get video data from node config or collect from results
                    # The stitch node should collect all videos from previous nodes in the workflow
                    video_list = []
                    video_sources = []
                    
                    # Collect video_base64 from all previous nodes' results
                    for node_id_search, node_result in results.items():
                        if isinstance(node_result, dict) and node_result.get('video_base64'):
                            video_data = node_result['video_base64']
                            video_list.append(video_data)
                            video_sources.append(node_id_search)
                            logging.info(f"[STITCH] Found video from node: {node_id_search} ({len(video_data)} chars)")
                    
                    logging.info(f"[STITCH] Total videos found: {len(video_list)}")
                    logging.info(f"[STITCH] Video sources: {video_sources}")
                    
                    if len(video_list) < 2:
                        result = {"status": "error", "error": f"Need at least 2 videos to stitch. Found {len(video_list)} videos from nodes: {video_sources}"}
                    else:
                        import subprocess
                        import tempfile
                        
                        # Save all videos to temporary files
                        temp_files = []
                        temp_dir = tempfile.mkdtemp()
                        
                        for idx, video_base64 in enumerate(video_list):
                            video_bytes = base64.b64decode(video_base64)
                            temp_path = f"{temp_dir}/video_{idx}.mp4"
                            with open(temp_path, 'wb') as f:
                                f.write(video_bytes)
                            temp_files.append(temp_path)
                        
                        # Output file
                        output_path = f"{temp_dir}/stitched_output.mp4"
                        
                        # Build ffmpeg command with seamless audio crossfading
                        # For 2+ videos, we'll use complex filter to:
                        # 1. Normalize audio for each clip
                        # 2. Add 0.5 second crossfade between audio tracks
                        # 3. Concatenate videos
                        
                        logging.info(f"[STITCH] Stitching {len(temp_files)} videos with audio crossfading")
                        
                        if len(temp_files) == 2:
                            # For 2 videos, use direct acrossfade
                            cmd = [
                                'ffmpeg',
                                '-i', temp_files[0],
                                '-i', temp_files[1],
                                '-filter_complex',
                                # Video: concatenate
                                '[0:v][1:v]concat=n=2:v=1:a=0[vout];'
                                # Audio: normalize each, then crossfade
                                '[0:a]loudnorm=I=-16:LRA=11:TP=-1.5[a0];'
                                '[1:a]loudnorm=I=-16:LRA=11:TP=-1.5[a1];'
                                '[a0][a1]acrossfade=d=0.5:c1=tri:c2=tri[aout]',
                                '-map', '[vout]',
                                '-map', '[aout]',
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                                '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                                '-pix_fmt', 'yuv420p',
                                '-y',
                                output_path
                            ]
                        else:
                            # For 3+ videos, use concat demuxer with audio normalization
                            # Create concat file
                            concat_file = f"{temp_dir}/concat.txt"
                            with open(concat_file, 'w') as f:
                                for temp_path in temp_files:
                                    f.write(f"file '{temp_path}'\n")
                            
                            cmd = [
                                'ffmpeg', '-f', 'concat', '-safe', '0',
                                '-i', concat_file,
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                                # Advanced audio filter: normalize + smooth transitions
                                '-af', 'loudnorm=I=-16:LRA=11:TP=-1.5,afade=t=in:st=0:d=0.3,afade=t=out:st={duration-0.3}:d=0.3',
                                '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                                '-pix_fmt', 'yuv420p',
                                '-y',
                                output_path
                            ]
                        
                        logging.info(f"[STITCH] Running ffmpeg with seamless audio")
                        logging.info(f"[STITCH] Command: {' '.join(cmd)}")
                        result_proc = subprocess.run(cmd, capture_output=True, text=True)
                        
                        if result_proc.returncode != 0:
                            logging.error(f"[STITCH] ffmpeg failed with code {result_proc.returncode}")
                            logging.error(f"[STITCH] ffmpeg stderr: {result_proc.stderr}")
                            raise Exception(f"ffmpeg failed: {result_proc.stderr}")
                        
                        logging.info(f"[STITCH] ffmpeg completed successfully with normalized audio")
                        
                        # Read stitched video
                        with open(output_path, 'rb') as f:
                            stitched_video_bytes = f.read()
                        
                        logging.info(f"[STITCH] Stitched video size: {len(stitched_video_bytes)} bytes")
                        
                        # Encode to base64
                        stitched_video_base64 = base64.b64encode(stitched_video_bytes).decode('utf-8')
                        
                        # Cleanup
                        import shutil
                        shutil.rmtree(temp_dir)
                        
                        result = {
                            "status": "success",
                            "video_base64": stitched_video_base64,
                            "videos_stitched": len(video_list),
                            "prompt": f"Stitched {len(video_list)} videos together"
                        }
                        logging.info(f"[STITCH] Successfully stitched {len(video_list)} videos")
                        
                except Exception as e:
                    import traceback
                    logging.error(f"[STITCH] Exception: {str(e)}")
                    logging.error(f"[STITCH] Traceback: {traceback.format_exc()}")
                    result = {"status": "error", "error": f"Video stitching failed: {str(e)}"}

            elif node_type == 'texttospeech':
                # Execute Text-to-Speech using ElevenLabs
                try:
                    logging.info(f"[TTS] Node {node_id} executing")
                    
                    # Get text from node config or from previous AI node's response
                    text = node_data.get('text', '')
                    
                    if not text and isinstance(input_data, dict):
                        text = input_data.get('response', input_data.get('text', ''))
                    
                    if not text and isinstance(input_data, str):
                        text = input_data
                    
                    # If still no text, collect from all AI responses in the workflow
                    if not text:
                        logging.info(f"[TTS] No direct text, collecting from AI nodes")
                        text_parts = []
                        for prev_node_id, prev_result in results.items():
                            if isinstance(prev_result, dict) and 'response' in prev_result:
                                # Extract voiceover text if formatted
                                response_text = prev_result['response']
                                if 'VOICEOVER' in response_text.upper():
                                    # Extract voiceover lines
                                    lines = response_text.split('\n')
                                    for line in lines:
                                        if 'VOICEOVER' in line.upper() and ':' in line:
                                            voiceover = line.split(':', 1)[1].strip().strip('"')
                                            text_parts.append(voiceover)
                                else:
                                    text_parts.append(response_text)
                        
                        text = ' '.join(text_parts)
                        logging.info(f"[TTS] Collected text from {len(text_parts)} AI nodes")
                    
                    voice = node_data.get('voice', 'Rachel')  # Default ElevenLabs voice
                    
                    if not text:
                        result = {"status": "error", "error": "No text provided for text-to-speech"}
                    else:
                        logging.info(f"[TTS] Generating speech for {len(text)} characters with voice: {voice}")
                        
                        # Get ElevenLabs API key from user's integrations
                        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
                        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey")
                        
                        if not elevenlabs_key:
                            result = {"status": "error", "error": "ElevenLabs API key not configured. Please add it in Integrations page."}
                        else:
                            # Call ElevenLabs API
                            import requests
                            
                            # Get voice ID (map common names to IDs or use directly)
                            voice_map = {
                                'rachel': '21m00Tcm4TlvDq8ikWAM',
                                'adam': 'pNInz6obpgDQGcFmaJgB',
                                'bella': 'EXAVITQu4vr4xnSDxMaL',
                                'antoni': 'ErXwobaYiN019PkySvjV',
                                'josh': 'TxGEqnHWrfWFTfGW9XjX',
                                'arnold': 'VR6AewLTigWG4xSOukaG',
                                'sam': 'yoZ06aMxZJJ28mfd3POQ',
                                'domi': 'AZnzlk1XvdvUeBnXmlld',
                                'elli': 'MF3mGyEYCl7XYWbV9V6O',
                            }
                            voice_id = voice_map.get(voice.lower(), voice)
                            
                            # Get customization settings from node config
                            model_id = node_data.get('model_id', 'eleven_turbo_v2_5')
                            stability = node_data.get('stability', 0.5)
                            similarity_boost = node_data.get('similarity_boost', 0.75)
                            style = node_data.get('style', 0)
                            speaker_boost = node_data.get('speaker_boost', False)
                            speed = node_data.get('speed', 1.0)
                            
                            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                            headers = {
                                "Accept": "audio/mpeg",
                                "Content-Type": "application/json",
                                "xi-api-key": elevenlabs_key
                            }
                            
                            # Build voice settings with all customizations
                            voice_settings = {
                                "stability": float(stability),
                                "similarity_boost": float(similarity_boost),
                            }
                            
                            # Add optional settings
                            if style > 0:
                                voice_settings["style"] = float(style)
                            if speaker_boost:
                                voice_settings["use_speaker_boost"] = True
                            
                            payload = {
                                "text": text,
                                "model_id": model_id,
                                "voice_settings": voice_settings
                            }
                            
                            # Add speed parameter if not default
                            if speed != 1.0:
                                payload["speed"] = float(speed)
                            
                            logging.info(f"[TTS] Voice settings: stability={stability}, similarity={similarity_boost}, style={style}, boost={speaker_boost}, speed={speed}")
                            
                            response = requests.post(url, json=payload, headers=headers, timeout=60)
                            
                            if response.status_code == 200:
                                audio_bytes = response.content
                                audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                                
                                logging.info(f"[TTS] Generated {len(audio_bytes)} bytes of audio")
                                
                                result = {
                                    "status": "success",
                                    "audio_base64": audio_base64,
                                    "text": text,
                                    "voice": voice,
                                    "format": "mp3"
                                }
                            else:
                                logging.error(f"[TTS] ElevenLabs API error: {response.status_code} - {response.text}")
                                result = {"status": "error", "error": f"ElevenLabs API error: {response.text}"}
                
                except Exception as e:
                    import traceback
                    logging.error(f"[TTS] Exception: {str(e)}")
                    logging.error(f"[TTS] Traceback: {traceback.format_exc()}")
                    result = {"status": "error", "error": f"Text-to-speech failed: {str(e)}"}
            
            elif node_type == 'audiooverlay':
                # Execute Audio Overlay - combine video with voiceover
                try:
                    logging.info(f"[AUDIO_OVERLAY] Node {node_id} executing")
                    
                    # Find video from previous nodes
                    video_base64 = None
                    for prev_node_id, prev_result in results.items():
                        if isinstance(prev_result, dict) and prev_result.get('video_base64'):
                            video_base64 = prev_result['video_base64']
                            logging.info(f"[AUDIO_OVERLAY] Found video from node: {prev_node_id}")
                            break
                    
                    # Find audio from previous TTS node
                    audio_base64 = None
                    for prev_node_id, prev_result in results.items():
                        if isinstance(prev_result, dict) and prev_result.get('audio_base64'):
                            audio_base64 = prev_result['audio_base64']
                            logging.info(f"[AUDIO_OVERLAY] Found audio from node: {prev_node_id}")
                            break
                    
                    if not video_base64:
                        result = {"status": "error", "error": "No video found from previous nodes"}
                    elif not audio_base64:
                        result = {"status": "error", "error": "No audio found from previous TTS node"}
                    else:
                        import tempfile
                        import subprocess
                        
                        # Create temp directory
                        temp_dir = tempfile.mkdtemp()
                        
                        # Save video
                        video_bytes = base64.b64decode(video_base64)
                        video_path = f"{temp_dir}/input_video.mp4"
                        with open(video_path, 'wb') as f:
                            f.write(video_bytes)
                        
                        # Save audio
                        audio_bytes = base64.b64decode(audio_base64)
                        audio_path = f"{temp_dir}/voiceover.mp3"
                        with open(audio_path, 'wb') as f:
                            f.write(audio_bytes)
                        
                        # Output path
                        output_path = f"{temp_dir}/final_video.mp4"
                        
                        logging.info(f"[AUDIO_OVERLAY] Overlaying audio onto video with ffmpeg")
                        
                        # Use ffmpeg to overlay audio on video
                        # Replace original audio with voiceover, or mix if desired
                        cmd = [
                            'ffmpeg',
                            '-i', video_path,
                            '-i', audio_path,
                            '-c:v', 'copy',  # Copy video stream (no re-encode for speed)
                            '-map', '0:v:0',  # Use video from first input
                            '-map', '1:a:0',  # Use audio from second input (voiceover)
                            '-c:a', 'aac',
                            '-b:a', '192k',
                            '-shortest',  # End when shortest stream ends
                            '-y',
                            output_path
                        ]
                        
                        result_proc = subprocess.run(cmd, capture_output=True, text=True)
                        
                        if result_proc.returncode != 0:
                            logging.error(f"[AUDIO_OVERLAY] ffmpeg failed: {result_proc.stderr}")
                            raise Exception(f"ffmpeg failed: {result_proc.stderr}")
                        
                        # Read final video
                        with open(output_path, 'rb') as f:
                            final_video_bytes = f.read()
                        
                        logging.info(f"[AUDIO_OVERLAY] Created final video: {len(final_video_bytes)} bytes")
                        
                        # Encode to base64
                        final_video_base64 = base64.b64encode(final_video_bytes).decode('utf-8')
                        
                        # Cleanup
                        import shutil
                        shutil.rmtree(temp_dir)
                        
                        result = {
                            "status": "success",
                            "video_base64": final_video_base64,
                            "prompt": "Video with voiceover overlay"
                        }
                        logging.info(f"[AUDIO_OVERLAY] Successfully added voiceover to video")
                
                except Exception as e:
                    import traceback
                    logging.error(f"[AUDIO_OVERLAY] Exception: {str(e)}")
                    logging.error(f"[AUDIO_OVERLAY] Traceback: {traceback.format_exc()}")
                    result = {"status": "error", "error": f"Audio overlay failed: {str(e)}"}
            
            elif node_type == 'texttomusic':
                # Execute Text-to-Music using ElevenLabs Music API
                try:
                    logging.info(f"[TEXT_TO_MUSIC] Node {node_id} executing")
                    
                    # Get prompt from node config or from previous AI node's response
                    prompt = node_data.get('prompt', '')
                    
                    if not prompt and isinstance(input_data, dict):
                        prompt = input_data.get('response', input_data.get('text', input_data.get('prompt', '')))
                    
                    if not prompt and isinstance(input_data, str):
                        prompt = input_data
                    
                    # Get additional settings
                    duration_seconds = node_data.get('duration_seconds', 120)  # Default 2 minutes
                    
                    if not prompt:
                        result = {"status": "error", "error": "No prompt provided for music generation"}
                    else:
                        logging.info(f"[TEXT_TO_MUSIC] Generating music: {prompt[:100]}... (duration: {duration_seconds}s)")
                        
                        # Get ElevenLabs API key from user's integrations
                        user = await db.users.find_one({"id": user_id}, {"_id": 0, "integrations": 1})
                        elevenlabs_key = user.get("integrations", {}).get("elevenlabs", {}).get("apiKey")
                        
                        if not elevenlabs_key:
                            result = {"status": "error", "error": "ElevenLabs API key not configured. Please add it in Integrations page."}
                        else:
                            import requests
                            import time
                            
                            # Step 1: Create music generation task
                            generate_url = "https://api.elevenlabs.io/v1/music/generate"
                            headers = {
                                "xi-api-key": elevenlabs_key,
                                "Content-Type": "application/json"
                            }
                            
                            payload = {
                                "prompt": prompt,
                                "duration_seconds": int(duration_seconds)
                            }
                            
                            logging.info(f"[TEXT_TO_MUSIC] Submitting generation request...")
                            gen_response = requests.post(generate_url, json=payload, headers=headers, timeout=30)
                            
                            logging.info(f"[TEXT_TO_MUSIC] Response status: {gen_response.status_code}, Content-Type: {gen_response.headers.get('Content-Type', 'unknown')}, Length: {len(gen_response.content)}")
                            
                            if gen_response.status_code != 200:
                                logging.error(f"[TEXT_TO_MUSIC] Generation request failed: {gen_response.status_code} - {gen_response.text}")
                                result = {"status": "error", "error": f"Music generation request failed: {gen_response.text}"}
                            else:
                                # Check if ElevenLabs returned audio directly (new API behavior)
                                content_type = gen_response.headers.get('Content-Type', '')
                                content_length = len(gen_response.content)
                                
                                if 'audio' in content_type or 'mpeg' in content_type or content_length > 10000:
                                    # API returned audio directly (new behavior)
                                    logging.info(f"[TEXT_TO_MUSIC] Received audio directly: {content_length} bytes")
                                    audio_bytes = gen_response.content
                                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                                    
                                    result = {
                                        "status": "success",
                                        "audio_base64": audio_base64,
                                        "music_base64": audio_base64,
                                        "prompt": prompt,
                                        "duration": duration_seconds,
                                        "format": "mp3"
                                    }
                                else:
                                    # Parse JSON for generation_id (old API behavior)
                                    try:
                                        gen_data = gen_response.json()
                                        generation_id = gen_data.get("generation_id") or gen_data.get("id")
                                        
                                        if not generation_id:
                                            result = {"status": "error", "error": "No generation ID in response"}
                                        else:
                                            logging.info(f"[TEXT_TO_MUSIC] Generation ID: {generation_id}, polling...")
                                            
                                            # Poll for completion and retrieve the music
                                            retrieve_url = f"https://api.elevenlabs.io/v1/music/generate/{generation_id}"
                                            max_attempts = 60  # 5 minutes max wait (5s intervals)
                                            attempt = 0
                                            
                                            while attempt < max_attempts:
                                                time.sleep(5)  # Wait 5 seconds between polls
                                                attempt += 1
                                                
                                                logging.info(f"[TEXT_TO_MUSIC] Polling attempt {attempt}/{max_attempts}...")
                                                
                                                retrieve_response = requests.get(retrieve_url, headers=headers, timeout=30)
                                                
                                                if retrieve_response.status_code == 200:
                                                    # Check if response is audio (content-type or size)
                                                    content_type = retrieve_response.headers.get('Content-Type', '')
                                                    content_length = len(retrieve_response.content)
                                                    
                                                    logging.info(f"[TEXT_TO_MUSIC] Content-Type: {content_type}, Content-Length: {content_length}")
                                                    
                                                    # ElevenLabs returns binary MP3 directly when ready (typically >100KB)
                                                    # Status updates are small JSON responses (<1KB)
                                                    if 'audio' in content_type or 'mpeg' in content_type or content_length > 1000:
                                                        # Got the audio file
                                                        audio_bytes = retrieve_response.content
                                                        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                                                        
                                                        logging.info(f"[TEXT_TO_MUSIC] Generated {len(audio_bytes)} bytes of music")
                                                        
                                                        result = {
                                                            "status": "success",
                                                            "audio_base64": audio_base64,
                                                            "music_base64": audio_base64,  # Alias for clarity
                                                            "prompt": prompt,
                                                            "duration": duration_seconds,
                                                            "format": "mp3"
                                                        }
                                                        break
                                                    else:
                                                        # Small response - try to parse as status JSON
                                                        try:
                                                            status_data = retrieve_response.json()
                                                            current_status = status_data.get("status", "unknown")
                                                            logging.info(f"[TEXT_TO_MUSIC] Current status: {current_status}")
                                                            
                                                            if current_status == "failed":
                                                                result = {"status": "error", "error": "Music generation failed on server"}
                                                                break
                                                        except Exception as json_error:
                                                            logging.warning(f"[TEXT_TO_MUSIC] Could not parse status JSON: {str(json_error)}")
                                                else:
                                                    logging.warning(f"[TEXT_TO_MUSIC] Retrieve failed: {retrieve_response.status_code}")
                                            
                                            if attempt >= max_attempts and 'result' not in locals():
                                                result = {"status": "error", "error": "Music generation timed out after 5 minutes"}
                                    except Exception as parse_error:
                                        logging.error(f"[TEXT_TO_MUSIC] Failed to parse initial response: {str(parse_error)}")
                                        result = {"status": "error", "error": f"Invalid API response: {str(parse_error)}"}
                
                except Exception as e:
                    import traceback
                    logging.error(f"[TEXT_TO_MUSIC] Exception: {str(e)}")
                    logging.error(f"[TEXT_TO_MUSIC] Traceback: {traceback.format_exc()}")
                    result = {"status": "error", "error": f"Text-to-music failed: {str(e)}"}

            
            elif node_type == 'audiostitch':
                # Execute Audio Stitch - combines audio tracks with stitched video
                try:
                    logging.info(f"[AUDIO_STITCH] Node {node_id} executing")
                    
                    # Step 1: Find the stitched video from previous stitch node
                    stitched_video_base64 = None
                    for prev_node_id in execution_order:
                        if prev_node_id == node_id:
                            break
                        prev_result = results.get(prev_node_id, {})
                        if prev_result.get('status') == 'success':
                            # Check if it's from a stitch node
                            prev_node = next((n for n in workflow['nodes'] if n['id'] == prev_node_id), None)
                            if prev_node and prev_node.get('type') == 'stitch':
                                stitched_video_base64 = prev_result.get('video_base64')
                                if stitched_video_base64:
                                    logging.info(f"[AUDIO_STITCH] Found stitched video from node {prev_node_id}")
                                    break
                    
                    if not stitched_video_base64:
                        result = {"status": "error", "error": "No stitched video found from previous stitch node"}
                        logging.error("[AUDIO_STITCH] No stitched video found")
                    else:
                        # Step 2: Find audio tracks from TTS and Music nodes
                        tts_audio_base64 = None
                        music_audio_base64 = None
                        
                        for prev_node_id in execution_order:
                            if prev_node_id == node_id:
                                break
                            prev_result = results.get(prev_node_id, {})
                            if prev_result.get('status') == 'success':
                                prev_node = next((n for n in workflow['nodes'] if n['id'] == prev_node_id), None)
                                if prev_node:
                                    node_type_check = prev_node.get('type')
                                    # Check for TTS audio
                                    if node_type_check == 'texttospeech' and not tts_audio_base64:
                                        tts_audio_base64 = prev_result.get('audio_base64')
                                        if tts_audio_base64:
                                            logging.info(f"[AUDIO_STITCH] Found TTS audio from node {prev_node_id}")
                                    # Check for Music audio
                                    elif node_type_check == 'texttomusic' and not music_audio_base64:
                                        music_audio_base64 = prev_result.get('music_base64') or prev_result.get('audio_base64')
                                        if music_audio_base64:
                                            logging.info(f"[AUDIO_STITCH] Found Music audio from node {prev_node_id}")
                        
                        if not tts_audio_base64 and not music_audio_base64:
                            result = {"status": "error", "error": "No audio tracks found from TTS or Music nodes"}
                            logging.error("[AUDIO_STITCH] No audio tracks found")
                        else:
                            import tempfile
                            import subprocess
                            import shutil
                            
                            temp_dir = tempfile.mkdtemp()
                            logging.info(f"[AUDIO_STITCH] Using temp directory: {temp_dir}")
                            
                            try:
                                # Save video
                                video_path = f"{temp_dir}/input_video.mp4"
                                video_bytes = base64.b64decode(stitched_video_base64)
                                with open(video_path, 'wb') as f:
                                    f.write(video_bytes)
                                
                                # Get video duration
                                probe_cmd = [
                                    'ffprobe', '-v', 'error', 
                                    '-show_entries', 'format=duration',
                                    '-of', 'default=noprint_wrappers=1:nokey=1',
                                    video_path
                                ]
                                probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
                                video_duration = float(probe_result.stdout.strip())
                                logging.info(f"[AUDIO_STITCH] Video duration: {video_duration}s")
                                
                                # Prepare audio track(s)
                                audio_inputs = []
                                filter_complex_parts = []
                                
                                if tts_audio_base64 and music_audio_base64:
                                    # Both audio tracks - mix them intelligently
                                    logging.info("[AUDIO_STITCH] Mixing TTS and Music audio")
                                    
                                    # Save TTS audio
                                    tts_path = f"{temp_dir}/tts_audio.mp3"
                                    tts_bytes = base64.b64decode(tts_audio_base64)
                                    with open(tts_path, 'wb') as f:
                                        f.write(tts_bytes)
                                    audio_inputs.append(tts_path)
                                    
                                    # Save Music audio
                                    music_path = f"{temp_dir}/music_audio.mp3"
                                    music_bytes = base64.b64decode(music_audio_base64)
                                    with open(music_path, 'wb') as f:
                                        f.write(music_bytes)
                                    audio_inputs.append(music_path)
                                    
                                    # Mix: TTS at 100% volume, Music at 30% (background)
                                    # Trim both to video length
                                    filter_complex = (
                                        f"[1:a]atrim=0:{video_duration},volume=1.0[tts];"
                                        f"[2:a]atrim=0:{video_duration},volume=0.3[music];"
                                        f"[tts][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"
                                    )
                                    audio_map = "[aout]"
                                    
                                elif tts_audio_base64:
                                    # Only TTS audio
                                    logging.info("[AUDIO_STITCH] Using TTS audio only")
                                    tts_path = f"{temp_dir}/tts_audio.mp3"
                                    tts_bytes = base64.b64decode(tts_audio_base64)
                                    with open(tts_path, 'wb') as f:
                                        f.write(tts_bytes)
                                    audio_inputs.append(tts_path)
                                    
                                    # Trim to video length
                                    filter_complex = f"[1:a]atrim=0:{video_duration}[aout]"
                                    audio_map = "[aout]"
                                    
                                else:
                                    # Only Music audio
                                    logging.info("[AUDIO_STITCH] Using Music audio only")
                                    music_path = f"{temp_dir}/music_audio.mp3"
                                    music_bytes = base64.b64decode(music_audio_base64)
                                    with open(music_path, 'wb') as f:
                                        f.write(music_bytes)
                                    audio_inputs.append(music_path)
                                    
                                    # Trim to video length
                                    filter_complex = f"[1:a]atrim=0:{video_duration}[aout]"
                                    audio_map = "[aout]"
                                
                                # Build FFmpeg command
                                output_path = f"{temp_dir}/final_video.mp4"
                                
                                cmd = ['ffmpeg', '-i', video_path]
                                for audio_input in audio_inputs:
                                    cmd.extend(['-i', audio_input])
                                
                                cmd.extend([
                                    '-filter_complex', filter_complex,
                                    '-map', '0:v:0',  # Video from input
                                    '-map', audio_map,  # Audio from filter
                                    '-c:v', 'copy',  # Copy video (no re-encode)
                                    '-c:a', 'aac',
                                    '-b:a', '192k',
                                    '-shortest',
                                    '-y',
                                    output_path
                                ])
                                
                                logging.info(f"[AUDIO_STITCH] Running FFmpeg command")
                                ffmpeg_result = subprocess.run(cmd, capture_output=True, text=True)
                                
                                if ffmpeg_result.returncode != 0:
                                    logging.error(f"[AUDIO_STITCH] FFmpeg failed: {ffmpeg_result.stderr}")
                                    raise Exception(f"FFmpeg failed: {ffmpeg_result.stderr}")
                                
                                # Read final video
                                with open(output_path, 'rb') as f:
                                    final_video_bytes = f.read()
                                
                                logging.info(f"[AUDIO_STITCH] Created final video with audio: {len(final_video_bytes)} bytes")
                                
                                # Encode to base64
                                final_video_base64 = base64.b64encode(final_video_bytes).decode('utf-8')
                                
                                result = {
                                    "status": "success",
                                    "video_base64": final_video_base64,
                                    "audio_type": "mixed" if (tts_audio_base64 and music_audio_base64) else ("tts" if tts_audio_base64 else "music"),
                                    "duration": video_duration
                                }
                                
                            finally:
                                # Cleanup
                                shutil.rmtree(temp_dir)
                
                except Exception as e:
                    import traceback
                    logging.error(f"[AUDIO_STITCH] Exception: {str(e)}")
                    logging.error(f"[AUDIO_STITCH] Traceback: {traceback.format_exc()}")
                    result = {"status": "error", "error": f"Audio stitch failed: {str(e)}"}
            
            elif node_type == 'taskplanner':
                # Execute Task Planner action
                action = node_data.get('action', 'create')
                title = node_data.get('title', 'New Task')
                description = node_data.get('description', '')
                priority = node_data.get('priority', 5)
                
                if action == 'create':
                    # Create new task
                    task_doc = {
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "title": title,
                        "description": description,
                        "priority": priority,
                        "status": "pending",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.tasks.insert_one(task_doc)
                    result = {"status": "success", "action": "created", "task_id": task_doc['id']}
                else:
                    result = {"status": "Task action executed", "action": action}
            
            elif node_type == 'condition':
                # Execute conditional logic
                operator = node_data.get('operator', 'equals')
                compare_value = node_data.get('compareValue', '')
                
                # Get value from previous node
                check_value = input_data.get('response') if isinstance(input_data, dict) else str(input_data)
                
                condition_met = False
                if operator == 'equals':
                    condition_met = str(check_value) == str(compare_value)
                elif operator == 'not_equals':
                    condition_met = str(check_value) != str(compare_value)
                elif operator == 'greater_than':
                    try:
                        condition_met = float(check_value) > float(compare_value)
                    except:
                        condition_met = False
                elif operator == 'less_than':
                    try:
                        condition_met = float(check_value) < float(compare_value)
                    except:
                        condition_met = False
                elif operator == 'contains':
                    condition_met = str(compare_value).lower() in str(check_value).lower()
                
                result = {
                    "condition_met": condition_met,
                    "branch": "true" if condition_met else "false",
                    "checked_value": check_value
                }
            
            elif node_type == 'switch':
                # Execute switch logic
                switch_value = node_data.get('switchValue', '')
                cases_str = node_data.get('cases', '[]')
                
                try:
                    cases = json_lib.loads(cases_str) if isinstance(cases_str, str) else cases_str
                except:
                    cases = []
                
                # Get value from previous node
                check_value = input_data.get('response') if isinstance(input_data, dict) else str(input_data)
                
                matched_case = None
                for case in cases:
                    if str(case).lower() in str(check_value).lower():
                        matched_case = case
                        break
                
                result = {
                    "matched_case": matched_case or "default",
                    "checked_value": check_value
                }
            
            elif node_type == 'loop':
                # Execute loop logic
                loop_type = node_data.get('loopType', 'forEach')
                
                if loop_type == 'forEach':
                    array_data = input_data.get('data', []) if isinstance(input_data, dict) else []
                    result = {
                        "loop_type": "forEach",
                        "iterations": len(array_data),
                        "items": array_data
                    }
                elif loop_type == 'count':
                    iterations = int(node_data.get('iterations', 1))
                    result = {
                        "loop_type": "count",
                        "iterations": iterations,
                        "current": 0
                    }
                else:
                    result = {
                        "loop_type": loop_type,
                        "status": "Loop executed"
                    }
            
            elif node_type == 'delay':
                # Execute delay
                duration = int(node_data.get('duration', 1))
                unit = node_data.get('unit', 'seconds')
                
                # Convert to seconds
                seconds = duration
                if unit == 'minutes':
                    seconds = duration * 60
                elif unit == 'hours':
                    seconds = duration * 3600
                
                import asyncio
                await asyncio.sleep(min(seconds, 10))  # Cap at 10 seconds for demo
                
                result = {
                    "delayed": f"{duration} {unit}",
                    "seconds": seconds
                }
            
            elif node_type == 'end':
                result = {"status": "completed", "final_data": input_data}
            
            else:
                result = {"error": f"Unknown node type: {node_type}"}
            
            results[node_id] = result
            execution_log.append(f"Completed {node_type} node: {node_id}")
            
            # Update progress
            nonlocal completed_nodes
            completed_nodes += 1
            progress = int((completed_nodes / total_nodes) * 100)
            
            await db.workflow_executions.update_one(
                {"id": execution_id},
                {"$set": {
                    "progress": progress,
                    "current_node": node_id,
                    "execution_log": execution_log,
                    "results": results
                }}
            )
            
            # Execute next nodes
            next_nodes = edges_dict.get(node_id, [])
            for next_node_id in next_nodes:
                await execute_node(next_node_id, result)
            
            return result
            
        except Exception as e:
            error_result = {"error": str(e), "node_type": node_type}
            results[node_id] = error_result
            error_msg = f"Error in {node_type} node: {str(e)}"
            execution_log.append(error_msg)
            logging.error(f"Workflow execution error - Node: {node_id}, Type: {node_type}, Error: {str(e)}")
            return error_result
    
    # Start execution
    try:
        await execute_node(start_nodes[0]['id'])
        
        # Mark as completed
        completed_at = datetime.now(timezone.utc)
        duration = int((completed_at - execution.started_at).total_seconds() * 1000)
        
        await db.workflow_executions.update_one(
            {"id": execution.id},
            {"$set": {
                "status": "completed",
                "progress": 100,
                "completed_at": completed_at.isoformat(),
                "duration": duration,
                "execution_log": execution_log,
                "results": results
            }}
        )
        
        return {
            "execution_id": execution.id,
            "workflow_id": workflow_id,
            "status": "completed",
            "execution_log": execution_log,
            "results": results
        }
    except Exception as e:
        # Mark as failed
        error_message = str(e)
        logging.error(f"Workflow execution failed - Workflow ID: {workflow_id}, Error: {error_message}")
        await db.workflow_executions.update_one(
            {"id": execution.id},
            {"$set": {
                "status": "failed",
                "error": error_message,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "execution_log": execution_log
            }}
        )
        raise

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