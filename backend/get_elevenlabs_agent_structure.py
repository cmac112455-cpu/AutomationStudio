#!/usr/bin/env python3
"""
Get actual working agent structure from ElevenLabs to see correct format
"""
import requests
import json
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def get_agent_structure():
    # Connect to MongoDB to get user's API key and agent ID
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['conversational_ai_db']
    
    # Get the first agent with an elevenlabs_agent_id
    agent = await db.conversational_agents.find_one(
        {"elevenlabs_agent_id": {"$exists": True, "$ne": None}},
        {"elevenlabs_agent_id": 1, "user_id": 1}
    )
    
    if not agent:
        print("No agent found with elevenlabs_agent_id")
        return
    
    # Get user's ElevenLabs API key
    user = await db.users.find_one(
        {"id": agent["user_id"]},
        {"integrations.elevenlabs.apiKey": 1}
    )
    
    if not user or not user.get("integrations", {}).get("elevenlabs", {}).get("apiKey"):
        print("No ElevenLabs API key found for user")
        return
    
    api_key = user["integrations"]["elevenlabs"]["apiKey"]
    agent_id = agent["elevenlabs_agent_id"]
    
    print(f"Fetching agent structure from ElevenLabs...")
    print(f"Agent ID: {agent_id}")
    print("=" * 80)
    
    # Get agent from ElevenLabs
    response = requests.get(
        f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}",
        headers={"xi-api-key": api_key}
    )
    
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return
    
    agent_data = response.json()
    
    # Navigate to tools
    tools = agent_data.get("conversation_config", {}).get("agent", {}).get("prompt", {}).get("tools", [])
    
    print(f"\n✅ Found {len(tools)} tools in agent")
    print("=" * 80)
    
    for i, tool in enumerate(tools):
        print(f"\n📋 Tool {i + 1}: {tool.get('name', 'unknown')}")
        print(json.dumps(tool, indent=2))
        print("-" * 80)
    
    # Save to file
    with open('/app/backend/elevenlabs_tools_structure.json', 'w') as f:
        json.dump(tools, f, indent=2)
    
    print(f"\n✅ Saved to: /app/backend/elevenlabs_tools_structure.json")

if __name__ == "__main__":
    asyncio.run(get_agent_structure())
