#!/usr/bin/env python3
"""
Verify image generation is working by creating and executing a simple workflow
"""

import requests
import json
import time
import base64

BACKEND_URL = "https://workflow-wizard-37.preview.emergentagent.com/api"

def test_image_generation():
    print("🧪 VERIFYING IMAGE GENERATION FUNCTIONALITY")
    print("=" * 60)
    
    # Register user
    test_email = f"imagetest_{int(time.time())}@example.com"
    response = requests.post(f"{BACKEND_URL}/auth/register", json={
        "email": test_email,
        "password": "securepassword123"
    })
    
    if response.status_code != 200:
        print(f"❌ User registration failed: {response.status_code}")
        return False
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"✅ User registered: {test_email}")
    
    # Create simple image generation workflow
    workflow_data = {
        "name": "Image Generation Verification",
        "nodes": [
            {
                "id": "start-1",
                "type": "start",
                "position": {"x": 100, "y": 100},
                "data": {}
            },
            {
                "id": "imagegen-1", 
                "type": "imagegen",
                "position": {"x": 300, "y": 100},
                "data": {
                    "prompt": "a cute cow on a beach",
                    "size": "1024x1024"
                }
            },
            {
                "id": "end-1",
                "type": "end", 
                "position": {"x": 500, "y": 100},
                "data": {}
            }
        ],
        "edges": [
            {"id": "edge-1", "source": "start-1", "target": "imagegen-1"},
            {"id": "edge-2", "source": "imagegen-1", "target": "end-1"}
        ]
    }
    
    response = requests.post(f"{BACKEND_URL}/workflows", json=workflow_data, headers=headers)
    if response.status_code != 200:
        print(f"❌ Workflow creation failed: {response.status_code}")
        return False
    
    workflow_id = response.json()["id"]
    print(f"✅ Workflow created: {workflow_id}")
    
    # Execute workflow
    response = requests.post(f"{BACKEND_URL}/workflows/{workflow_id}/execute", headers=headers)
    if response.status_code != 200:
        print(f"❌ Workflow execution failed: {response.status_code}")
        return False
    
    execution_id = response.json()["execution_id"]
    print(f"✅ Workflow execution started: {execution_id}")
    
    # Monitor execution
    max_wait = 90  # 90 seconds for image generation
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        response = requests.get(f"{BACKEND_URL}/workflows/executions/{execution_id}", headers=headers)
        if response.status_code != 200:
            print(f"❌ Failed to get execution status: {response.status_code}")
            return False
        
        data = response.json()
        status = data.get("status")
        progress = data.get("progress", 0)
        
        print(f"📊 Progress: {progress}% - Status: {status}")
        
        if status == "completed":
            results = data.get("results", {})
            
            # Check image generation result
            for node_id, result in results.items():
                if "imagegen" in node_id:
                    if result.get("status") == "success":
                        image_data = result.get("image_base64", "")
                        
                        print(f"\n🎉 IMAGE GENERATION SUCCESSFUL!")
                        print(f"📊 Image data length: {len(image_data)} characters")
                        print(f"🖼️  Image size: {result.get('size', 'unknown')}")
                        
                        # Validate base64
                        try:
                            decoded = base64.b64decode(image_data)
                            print(f"✅ Base64 validation: VALID ({len(decoded)} bytes)")
                            
                            # Check if it looks like image data (starts with common image headers)
                            if decoded.startswith(b'\xff\xd8\xff'):  # JPEG
                                print("🖼️  Image format: JPEG")
                            elif decoded.startswith(b'\x89PNG'):  # PNG
                                print("🖼️  Image format: PNG")
                            elif decoded.startswith(b'GIF'):  # GIF
                                print("🖼️  Image format: GIF")
                            else:
                                print("🖼️  Image format: Unknown/Other")
                            
                            return True
                        except Exception as e:
                            print(f"❌ Base64 validation failed: {e}")
                            return False
                    else:
                        error = result.get("error", "Unknown error")
                        print(f"❌ Image generation failed: {error}")
                        return False
            
            print("❌ No image generation result found")
            return False
        
        elif status == "failed":
            error = data.get("error", "Unknown error")
            print(f"❌ Workflow execution failed: {error}")
            return False
        
        time.sleep(3)
    
    print(f"⏰ Execution timed out after {max_wait} seconds")
    return False

if __name__ == "__main__":
    success = test_image_generation()
    if success:
        print("\n✅ IMAGE GENERATION VERIFICATION: PASSED")
    else:
        print("\n❌ IMAGE GENERATION VERIFICATION: FAILED")