#!/usr/bin/env python3
"""
Simple Backend Test for Multi-AI Toggle Functionality
"""

import requests
import json
import time

BACKEND_URL = "https://smart-advisor-27.preview.emergentagent.com/api"

def test_auth_and_chat():
    """Test authentication and chat functionality"""
    session = requests.Session()
    
    print("🚀 Testing Multi-AI Toggle Functionality")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 50)
    
    # Test 1: Health check
    try:
        response = session.get(f"{BACKEND_URL}/", timeout=10)
        if response.status_code == 200:
            print("✅ Backend health check: PASS")
        else:
            print(f"❌ Backend health check: FAIL ({response.status_code})")
            return
    except Exception as e:
        print(f"❌ Backend health check: FAIL ({str(e)})")
        return
    
    # Test 2: User registration
    test_email = f"testuser_{int(time.time())}@example.com"
    try:
        response = session.post(f"{BACKEND_URL}/auth/register", json={
            "email": test_email,
            "password": "testpassword123"
        }, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            auth_token = data.get("access_token")
            user_id = data.get("user_id")
            session.headers.update({"Authorization": f"Bearer {auth_token}"})
            print(f"✅ User registration: PASS (User ID: {user_id})")
        else:
            print(f"❌ User registration: FAIL ({response.status_code})")
            # Try fallback login
            response = session.post(f"{BACKEND_URL}/auth/login", json={
                "email": "test@example.com",
                "password": "password123"
            }, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                auth_token = data.get("access_token")
                user_id = data.get("user_id")
                session.headers.update({"Authorization": f"Bearer {auth_token}"})
                print(f"✅ Fallback login: PASS (User ID: {user_id})")
            else:
                print(f"❌ Authentication: FAIL - Cannot proceed with chat tests")
                return
    except Exception as e:
        print(f"❌ Authentication: FAIL ({str(e)})")
        return
    
    # Test 3: Chat with Single AI (use_multi_ai = false)
    try:
        response = session.post(f"{BACKEND_URL}/copilot/chat", json={
            "message": "What are the best lead generation strategies?",
            "use_multi_ai": False
        }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            model_used = data.get("model_used", "")
            response_text = data.get("response", "")
            session_id = data.get("session_id", "")
            
            # Check if it's single AI mode
            is_single_ai = not ("Multi-AI" in model_used or "4x credits" in model_used)
            
            if is_single_ai and response_text:
                print(f"✅ Single AI Chat: PASS")
                print(f"   Model: {model_used}")
                print(f"   Response length: {len(response_text)} chars")
                print(f"   Session ID: {session_id}")
            else:
                print(f"❌ Single AI Chat: FAIL - Unexpected response format")
                print(f"   Model: {model_used}")
        else:
            print(f"❌ Single AI Chat: FAIL ({response.status_code})")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Single AI Chat: FAIL ({str(e)})")
    
    # Test 4: Chat with Multi-AI (use_multi_ai = true)
    try:
        response = session.post(f"{BACKEND_URL}/copilot/chat", json={
            "message": "How can I scale my business to $10k monthly revenue?",
            "use_multi_ai": True
        }, timeout=60)  # Longer timeout for multi-AI
        
        if response.status_code == 200:
            data = response.json()
            model_used = data.get("model_used", "")
            response_text = data.get("response", "")
            session_id = data.get("session_id", "")
            
            # Check if it's multi-AI mode
            is_multi_ai = "Multi-AI" in model_used and "4x credits" in model_used
            
            if is_multi_ai and response_text:
                print(f"✅ Multi-AI Chat: PASS")
                print(f"   Model: {model_used}")
                print(f"   Response length: {len(response_text)} chars")
                print(f"   Session ID: {session_id}")
            else:
                print(f"❌ Multi-AI Chat: FAIL - Expected multi-AI response")
                print(f"   Model: {model_used}")
                print(f"   Response preview: {response_text[:100]}...")
        else:
            print(f"❌ Multi-AI Chat: FAIL ({response.status_code})")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Multi-AI Chat: FAIL ({str(e)})")
    
    # Test 5: Default behavior (no use_multi_ai field)
    try:
        response = session.post(f"{BACKEND_URL}/copilot/chat", json={
            "message": "What marketing channels work best?"
        }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            model_used = data.get("model_used", "")
            response_text = data.get("response", "")
            
            # Should default to single AI
            is_single_ai = not ("Multi-AI" in model_used or "4x credits" in model_used)
            
            if is_single_ai and response_text:
                print(f"✅ Default Behavior: PASS (defaults to single AI)")
                print(f"   Model: {model_used}")
            else:
                print(f"❌ Default Behavior: FAIL - Should default to single AI")
                print(f"   Model: {model_used}")
        else:
            print(f"❌ Default Behavior: FAIL ({response.status_code})")
    except Exception as e:
        print(f"❌ Default Behavior: FAIL ({str(e)})")
    
    print("\n" + "=" * 50)
    print("🏁 Testing Complete")

if __name__ == "__main__":
    test_auth_and_chat()