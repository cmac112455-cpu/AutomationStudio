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
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
import random
from fastapi import UploadFile, File
import base64
import aiohttp
import json as json_lib

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
    
    # AI Response System - Use vision model if images/videos present
    try:
        # Force vision-capable model if images/videos are present
        if has_vision_files:
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
            model_used=model_used
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