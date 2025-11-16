#!/usr/bin/env python3
"""
Test session management and edge cases
"""

import requests
import json
import time

BACKEND_URL = "https://smart-advisor-27.preview.emergentagent.com/api"

def main():
    session = requests.Session()
    
    print("🔄 Testing Session Management & Edge Cases")
    print("=" * 50)
    
    # Use existing user
    test_email = f"sessiontest_{int(time.time())}@example.com"
    response = session.post(f"{BACKEND_URL}/auth/register", json={
        "email": test_email,
        "password": "testpass123"
    }, timeout=15)
    
    if response.status_code == 200:
        data = response.json()
        auth_token = data.get("access_token")
        session.headers.update({"Authorization": f"Bearer {auth_token}"})
        print(f"✅ Authenticated")
    else:
        print(f"❌ Auth failed")
        return
    
    # Test 1: Chat and get session ID
    response = session.post(f"{BACKEND_URL}/copilot/chat", json={
        "message": "Hello, this is a test message",
        "use_multi_ai": False
    }, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        session_id = data.get("session_id")
        print(f"✅ Chat created session: {session_id}")
        
        # Test 2: Get chat history
        history_response = session.get(f"{BACKEND_URL}/copilot/history/{session_id}", timeout=10)
        if history_response.status_code == 200:
            history_data = history_response.json()
            messages = history_data.get("messages", [])
            print(f"✅ Chat history: {len(messages)} messages")
        else:
            print(f"❌ Chat history failed: {history_response.status_code}")
        
        # Test 3: Get sessions list
        sessions_response = session.get(f"{BACKEND_URL}/copilot/sessions", timeout=10)
        if sessions_response.status_code == 200:
            sessions_data = sessions_response.json()
            sessions = sessions_data.get("sessions", [])
            print(f"✅ Sessions list: {len(sessions)} sessions")
        else:
            print(f"❌ Sessions list failed: {sessions_response.status_code}")
    else:
        print(f"❌ Initial chat failed: {response.status_code}")
        return
    
    # Test 4: Default behavior (no use_multi_ai field)
    response = session.post(f"{BACKEND_URL}/copilot/chat", json={
        "message": "Test default behavior"
    }, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        model = data.get("model_used", "")
        is_single = not ("Multi-AI" in model or "4x credits" in model)
        print(f"✅ Default behavior: {'PASS' if is_single else 'FAIL'} (defaults to single AI)")
        print(f"   Model: {model}")
    else:
        print(f"❌ Default behavior test failed: {response.status_code}")
    
    # Test 5: Custom session ID
    custom_session = f"custom-session-{int(time.time())}"
    response = session.post(f"{BACKEND_URL}/copilot/chat", json={
        "message": "Test with custom session ID",
        "session_id": custom_session,
        "use_multi_ai": False
    }, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        returned_session = data.get("session_id")
        if returned_session == custom_session:
            print(f"✅ Custom session ID: PASS")
        else:
            print(f"❌ Custom session ID: FAIL (expected {custom_session}, got {returned_session})")
    else:
        print(f"❌ Custom session ID test failed: {response.status_code}")
    
    # Test 6: Empty message (edge case)
    response = session.post(f"{BACKEND_URL}/copilot/chat", json={
        "message": "",
        "use_multi_ai": False
    }, timeout=30)
    
    if response.status_code in [200, 400]:
        print(f"✅ Empty message: PASS (handled correctly with status {response.status_code})")
    else:
        print(f"❌ Empty message: FAIL (unexpected status {response.status_code})")
    
    print("\n" + "=" * 50)
    print("🏁 Session & Edge Case Tests Complete")

if __name__ == "__main__":
    main()