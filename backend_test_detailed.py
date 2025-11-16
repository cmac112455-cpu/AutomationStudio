#!/usr/bin/env python3
"""
Detailed Backend API Testing for Workflow Execution with Image Generation
Tests the complete workflow with detailed verification of image generation results
"""

import requests
import json
import time
import os
import base64
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://workflow-wizard-37.preview.emergentagent.com/api"

class DetailedWorkflowTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
    
    def test_user_registration(self):
        """Test user registration"""
        test_email = f"detailed_test_{int(time.time())}@example.com"
        test_password = "securepassword123"
        
        try:
            response = self.session.post(f"{self.base_url}/auth/register", json={
                "email": test_email,
                "password": test_password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.user_id = data.get("user_id")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log_result("User Registration", True, f"User registered successfully with ID: {self.user_id}")
                return True
            else:
                self.log_result("User Registration", False, f"Registration failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("User Registration", False, f"Registration error: {str(e)}")
            return False
    
    def test_detailed_workflow_execution(self):
        """Test complete workflow execution with detailed verification"""
        if not self.auth_token:
            self.log_result("Detailed Workflow Test", False, "No authentication token available")
            return False
            
        try:
            # Step 1: Create workflow
            workflow_data = {
                "name": "Detailed Image Generation Test",
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
                            "prompt": "generate me a cow on a beach",
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
                    {
                        "id": "edge-1",
                        "source": "start-1",
                        "target": "imagegen-1"
                    },
                    {
                        "id": "edge-2", 
                        "source": "imagegen-1",
                        "target": "end-1"
                    }
                ]
            }
            
            response = self.session.post(f"{self.base_url}/workflows", json=workflow_data)
            if response.status_code != 200:
                self.log_result("Detailed Workflow Test", False, f"Workflow creation failed: {response.status_code}")
                return False
            
            workflow_id = response.json().get("id")
            print(f"   ✓ Workflow created: {workflow_id}")
            
            # Step 2: Execute workflow
            response = self.session.post(f"{self.base_url}/workflows/{workflow_id}/execute")
            if response.status_code != 200:
                self.log_result("Detailed Workflow Test", False, f"Workflow execution failed: {response.status_code}")
                return False
            
            execution_id = response.json().get("execution_id")
            print(f"   ✓ Execution started: {execution_id}")
            
            # Step 3: Monitor execution with detailed progress tracking
            max_wait_time = 120
            start_time = time.time()
            progress_updates = []
            
            while time.time() - start_time < max_wait_time:
                response = self.session.get(f"{self.base_url}/workflows/executions/{execution_id}")
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "unknown")
                    progress = data.get("progress", 0)
                    current_node = data.get("current_node", "")
                    results = data.get("results", {})
                    execution_log = data.get("execution_log", [])
                    
                    progress_updates.append({
                        "progress": progress,
                        "status": status,
                        "current_node": current_node,
                        "timestamp": time.time() - start_time
                    })
                    
                    print(f"   Progress: {progress}% - Status: {status} - Node: {current_node}")
                    
                    if status == "completed":
                        # Step 4: Detailed verification of results
                        print(f"   ✓ Workflow completed in {time.time() - start_time:.1f}s")
                        
                        # Verify execution log
                        expected_log_entries = ["start", "imagegen", "end"]
                        log_verification = all(any(entry in log for log in execution_log) for entry in expected_log_entries)
                        print(f"   ✓ Execution log verification: {'PASS' if log_verification else 'FAIL'}")
                        
                        # Verify image generation result
                        image_gen_result = None
                        for node_id, result in results.items():
                            if "imagegen" in node_id:
                                image_gen_result = result
                                break
                        
                        if image_gen_result:
                            image_status = image_gen_result.get("status")
                            has_image_data = "image_base64" in image_gen_result
                            
                            print(f"   ✓ Image generation status: {image_status}")
                            print(f"   ✓ Image data present: {has_image_data}")
                            
                            if image_status == "success" and has_image_data:
                                # Verify base64 image data
                                image_data = image_gen_result.get("image_base64", "")
                                if image_data and len(image_data) > 100:  # Should have substantial data
                                    try:
                                        # Try to decode base64 to verify it's valid
                                        decoded = base64.b64decode(image_data[:100] + "==")  # Add padding for test
                                        print(f"   ✓ Base64 image data is valid (sample decoded: {len(decoded)} bytes)")
                                        
                                        self.log_result("Detailed Workflow Test", True, 
                                                      f"Complete workflow execution successful with image generation",
                                                      f"Progress updates: {len(progress_updates)}, Image data length: {len(image_data)}")
                                        return True
                                    except Exception as e:
                                        print(f"   ✗ Base64 decode error: {str(e)}")
                                        self.log_result("Detailed Workflow Test", False, 
                                                      f"Image data validation failed: {str(e)}")
                                        return False
                                else:
                                    self.log_result("Detailed Workflow Test", False, 
                                                  f"Image data insufficient or missing")
                                    return False
                            else:
                                self.log_result("Detailed Workflow Test", False, 
                                              f"Image generation failed: {image_gen_result}")
                                return False
                        else:
                            self.log_result("Detailed Workflow Test", False, 
                                          f"No image generation result found in execution results")
                            return False
                    
                    elif status == "failed":
                        error = data.get("error", "Unknown error")
                        self.log_result("Detailed Workflow Test", False, 
                                      f"Workflow execution failed: {error}")
                        return False
                    
                    # Continue monitoring
                    time.sleep(3)
                else:
                    self.log_result("Detailed Workflow Test", False, 
                                  f"Failed to get execution status: {response.status_code}")
                    return False
            
            # Timeout
            self.log_result("Detailed Workflow Test", False, 
                          f"Execution timed out after {max_wait_time}s")
            return False
                
        except Exception as e:
            self.log_result("Detailed Workflow Test", False, f"Test error: {str(e)}")
            return False

    def run_detailed_test(self):
        """Run detailed workflow test"""
        print("🔍 Starting Detailed Backend API Test for Workflow Execution with Image Generation")
        print(f"Backend URL: {self.base_url}")
        print("=" * 90)
        
        # Authentication
        auth_success = self.test_user_registration()
        
        if not auth_success:
            print("❌ Authentication failed. Cannot proceed with detailed test.")
            return self.generate_summary()
        
        # Detailed workflow test
        self.test_detailed_workflow_execution()
        
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 90)
        print("📊 DETAILED TEST SUMMARY")
        print("=" * 90)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
            if result.get("details"):
                print(f"   Details: {result['details']}")
        
        return {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "results": self.test_results
        }

if __name__ == "__main__":
    tester = DetailedWorkflowTester()
    summary = tester.run_detailed_test()