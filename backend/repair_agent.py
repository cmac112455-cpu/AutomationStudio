#!/usr/bin/env python3
"""
Emergency repair script to fix corrupted agent configuration on ElevenLabs
This will clean up duplicate fields and corrupted built_in_tools structure
"""

import requests
import sys
import json

def repair_agent(agent_id, api_key):
    """
    Repair a corrupted agent by sending a clean configuration
    """
    print(f"🔧 Repairing agent: {agent_id}")
    print("=" * 60)
    
    # Step 1: Get current agent configuration
    print("\n📥 Step 1: Fetching current agent configuration...")
    get_url = f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}"
    headers = {"xi-api-key": api_key}
    
    response = requests.get(get_url, headers=headers)
    if response.status_code != 200:
        print(f"❌ Error fetching agent: {response.status_code}")
        print(response.text)
        return False
    
    agent_data = response.json()
    print("✅ Agent fetched successfully")
    
    # Step 2: Build a CLEAN configuration
    print("\n🧹 Step 2: Building clean configuration...")
    
    # Get the essential parts we want to keep
    conversation_config = agent_data.get("conversation_config", {})
    agent_config = conversation_config.get("agent", {})
    prompt_config = agent_config.get("prompt", {})
    
    # Build a completely clean prompt configuration
    clean_prompt = {
        "prompt": prompt_config.get("prompt", ""),
        "llm": prompt_config.get("llm", "gpt-4o"),
        "temperature": prompt_config.get("temperature", 0.7),
        "max_tokens": prompt_config.get("max_tokens", -1),
        "tools": [],  # Start with empty tools array - clean slate
        "tool_ids": [],  # Empty tool_ids
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
        "backup_llm_config": prompt_config.get("backup_llm_config", {"preference": "default"})
    }
    
    # Do NOT include built_in_tools at all - let it be managed by 'tools' array only
    
    print("✅ Clean configuration built")
    print(f"   - Tools: {len(clean_prompt['tools'])} (starting fresh)")
    print(f"   - Tool IDs: {len(clean_prompt['tool_ids'])}")
    print(f"   - Knowledge base: {len(clean_prompt['knowledge_base'])} items")
    
    # Step 3: Send the clean configuration
    print("\n📤 Step 3: Sending clean configuration to ElevenLabs...")
    
    # Build the update payload
    clean_agent_config = agent_config.copy()
    clean_agent_config["prompt"] = clean_prompt
    
    clean_conversation_config = conversation_config.copy()
    clean_conversation_config["agent"] = clean_agent_config
    
    update_payload = {
        "conversation_config": clean_conversation_config
    }
    
    # Send PATCH request
    patch_url = f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    print("\n📋 Payload summary:")
    print(f"   - Removing all duplicate fields")
    print(f"   - Removing corrupted built_in_tools object")
    print(f"   - Setting clean tools array: []")
    print(f"   - Setting clean tool_ids: []")
    
    response = requests.patch(patch_url, headers=headers, json=update_payload)
    
    print(f"\n📊 Response status: {response.status_code}")
    
    if response.status_code in [200, 201]:
        print("✅ SUCCESS! Agent repaired successfully!")
        print("\n🎉 Your agent should now be saveable on the ElevenLabs website")
        print("You can now add tools back one at a time through the UI")
        return True
    else:
        print(f"❌ FAILED: {response.status_code}")
        print(f"Error: {response.text}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python repair_agent.py <agent_id> <api_key>")
        print("Example: python repair_agent.py abc123 sk_xyz...")
        sys.exit(1)
    
    agent_id = sys.argv[1]
    api_key = sys.argv[2]
    
    success = repair_agent(agent_id, api_key)
    sys.exit(0 if success else 1)
