#!/usr/bin/env python3
"""
Script to fetch and inspect the actual structure of an ElevenLabs agent
This will help us understand the correct JSON structure
"""
import requests
import json
import sys

def inspect_agent(agent_id, api_key):
    """Fetch and display the full structure of an ElevenLabs agent"""
    
    url = f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}"
    headers = {"xi-api-key": api_key}
    
    print(f"Fetching agent: {agent_id}")
    print("=" * 80)
    
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return
    
    agent_data = response.json()
    
    # Navigate to tools
    conversation_config = agent_data.get("conversation_config", {})
    agent_config = conversation_config.get("agent", {})
    prompt_config = agent_config.get("prompt", {})
    tools = prompt_config.get("tools", [])
    
    print(f"Found {len(tools)} tools in agent configuration")
    print("=" * 80)
    
    for i, tool in enumerate(tools):
        print(f"\nTool {i}:")
        print(json.dumps(tool, indent=2))
        print("-" * 80)
    
    # Also check if there's a built_in_tools field
    built_in_tools = prompt_config.get("built_in_tools", {})
    if built_in_tools:
        print("\nFound built_in_tools object:")
        print(json.dumps(built_in_tools, indent=2))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python inspect_elevenlabs_agent.py <agent_id> <api_key>")
        sys.exit(1)
    
    agent_id = sys.argv[1]
    api_key = sys.argv[2]
    
    inspect_agent(agent_id, api_key)
