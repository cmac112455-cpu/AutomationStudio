#!/usr/bin/env python3
"""
Final comprehensive test of Multi-AI functionality
"""

import requests
import json
import time

BACKEND_URL = "https://smart-workflow-hub-3.preview.emergentagent.com/api"

def main():
    session = requests.Session()
    
    print("🚀 Final Multi-AI Toggle Test")
    print("=" * 50)
    
    # Register new user
    test_email = f"finaltest_{int(time.time())}@example.com"
    response = session.post(f"{BACKEND_URL}/auth/register", json={
        "email": test_email,
        "password": "testpass123"
    }, timeout=15)
    
    if response.status_code == 200:
        data = response.json()
        auth_token = data.get("access_token")
        session.headers.update({"Authorization": f"Bearer {auth_token}"})
        print(f"✅ User registered: {data.get('user_id')}")
    else:
        print(f"❌ Registration failed: {response.status_code}")
        return
    
    # Test 1: Single AI mode
    print("\n🔄 Testing Single AI mode...")
    try:
        start_time = time.time()
        response = session.post(f"{BACKEND_URL}/copilot/chat", json={
            "message": "Give me 3 marketing tips",
            "use_multi_ai": False
        }, timeout=30)
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            model = data.get("model_used", "")
            is_single = not ("Multi-AI" in model or "4x credits" in model)
            
            print(f"✅ Single AI: {'PASS' if is_single else 'FAIL'}")
            print(f"   Duration: {duration:.1f}s")
            print(f"   Model: {model}")
        else:
            print(f"❌ Single AI failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Single AI error: {str(e)}")
    
    # Test 2: Multi-AI mode with extended timeout
    print("\n🔄 Testing Multi-AI mode (may take 2+ minutes)...")
    try:
        start_time = time.time()
        response = session.post(f"{BACKEND_URL}/copilot/chat", json={
            "message": "How do I get my first 10 customers quickly?",
            "use_multi_ai": True
        }, timeout=150)  # 2.5 minute timeout
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            model = data.get("model_used", "")
            response_text = data.get("response", "")
            is_multi = "Multi-AI" in model and "4x credits" in model
            
            print(f"✅ Multi-AI: {'PASS' if is_multi else 'FAIL'}")
            print(f"   Duration: {duration:.1f}s")
            print(f"   Model: {model}")
            print(f"   Response length: {len(response_text)} chars")
            
            if is_multi:
                print("✅ Multi-AI mode working correctly!")
            else:
                print("❌ Multi-AI mode not working as expected")
        else:
            print(f"❌ Multi-AI failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        duration = time.time() - start_time
        print(f"❌ Multi-AI error after {duration:.1f}s: {str(e)}")
    
    print("\n" + "=" * 50)
    print("🏁 Test Complete")

if __name__ == "__main__":
    main()