#!/usr/bin/env python3
"""
Test Multi-AI with longer timeout
"""

import requests
import json
import time

BACKEND_URL = "https://workflow-wizard-37.preview.emergentagent.com/api"

def test_multi_ai():
    session = requests.Session()
    
    # Login with existing user
    response = session.post(f"{BACKEND_URL}/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    }, timeout=15)
    
    if response.status_code == 200:
        data = response.json()
        auth_token = data.get("access_token")
        session.headers.update({"Authorization": f"Bearer {auth_token}"})
        print("✅ Authenticated successfully")
    else:
        print("❌ Authentication failed")
        return
    
    print("🔄 Testing Multi-AI with 120 second timeout...")
    start_time = time.time()
    
    try:
        response = session.post(f"{BACKEND_URL}/copilot/chat", json={
            "message": "What are 3 quick ways to get my first 100 customers?",
            "use_multi_ai": True
        }, timeout=120)
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response.status_code == 200:
            data = response.json()
            model_used = data.get("model_used", "")
            response_text = data.get("response", "")
            
            print(f"✅ Multi-AI Chat: SUCCESS")
            print(f"   Duration: {duration:.1f} seconds")
            print(f"   Model: {model_used}")
            print(f"   Response length: {len(response_text)} chars")
            print(f"   Response preview: {response_text[:200]}...")
            
            # Verify it's actually multi-AI
            if "Multi-AI" in model_used and "4x credits" in model_used:
                print("✅ Multi-AI mode confirmed")
            else:
                print("❌ Multi-AI mode not detected")
        else:
            print(f"❌ Multi-AI Chat failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        print(f"❌ Multi-AI Chat failed after {duration:.1f}s: {str(e)}")

if __name__ == "__main__":
    test_multi_ai()