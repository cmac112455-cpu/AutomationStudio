#!/usr/bin/env python3
"""
Backend API Testing for Workflow Execution with Image Generation
Tests workflow creation, execution, and monitoring functionality
"""

import requests
import json
import time
import os
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://workflow-wizard-37.preview.emergentagent.com/api"

class BackendTester:
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
        test_email = f"testuser_{int(time.time())}@example.com"
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
    
    def test_user_login_fallback(self):
        """Fallback login with test credentials"""
        try:
            response = self.session.post(f"{self.base_url}/auth/login", json={
                "email": "test@example.com",
                "password": "password123"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.user_id = data.get("user_id")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log_result("User Login (Fallback)", True, f"Logged in successfully with ID: {self.user_id}")
                return True
            else:
                self.log_result("User Login (Fallback)", False, f"Login failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("User Login (Fallback)", False, f"Login error: {str(e)}")
            return False
    
    # Removed old chat testing methods - focusing on workflow testing
    
    def test_chat_multi_ai_mode(self):
        """Test chat with use_multi_ai = true"""
        if not self.auth_token:
            self.log_result("Chat Multi AI Mode", False, "No authentication token available")
            return False
            
        try:
            chat_data = {
                "message": "How can I scale my business to $10k monthly revenue quickly?",
                "use_multi_ai": True
            }
            
            response = self.session.post(f"{self.base_url}/copilot/chat", json=chat_data)
            
            if response.status_code == 200:
                data = response.json()
                response_text = data.get("response", "")
                model_used = data.get("model_used", "")
                session_id = data.get("session_id", "")
                
                # Verify multi-AI response
                is_multi_ai = "Multi-AI" in model_used and "4x credits" in model_used
                
                if is_multi_ai and response_text and session_id:
                    self.log_result("Chat Multi AI Mode", True, 
                                  f"Multi-AI mode working correctly. Model: {model_used}", 
                                  f"Response length: {len(response_text)} chars, Session: {session_id}")
                    return True, session_id
                else:
                    self.log_result("Chat Multi AI Mode", False, 
                                  f"Multi-AI mode not working as expected. Model: {model_used}")
                    return False, None
            else:
                self.log_result("Chat Multi AI Mode", False, 
                              f"Multi-AI chat failed with status {response.status_code}", response.text)
                return False, None
                
        except Exception as e:
            self.log_result("Chat Multi AI Mode", False, f"Multi-AI chat error: {str(e)}")
            return False, None
    
    def test_chat_default_behavior(self):
        """Test chat without use_multi_ai field (should default to false)"""
        if not self.auth_token:
            self.log_result("Chat Default Behavior", False, "No authentication token available")
            return False
            
        try:
            chat_data = {
                "message": "What marketing channels work best for startups?"
                # Intentionally omitting use_multi_ai field
            }
            
            response = self.session.post(f"{self.base_url}/copilot/chat", json=chat_data)
            
            if response.status_code == 200:
                data = response.json()
                response_text = data.get("response", "")
                model_used = data.get("model_used", "")
                session_id = data.get("session_id", "")
                
                # Should default to single AI mode
                is_single_model = not ("Multi-AI" in model_used or "4x credits" in model_used)
                
                if is_single_model and response_text and session_id:
                    self.log_result("Chat Default Behavior", True, 
                                  f"Default behavior correct (single AI). Model: {model_used}", 
                                  f"Response length: {len(response_text)} chars")
                    return True
                else:
                    self.log_result("Chat Default Behavior", False, 
                                  f"Default behavior incorrect. Model: {model_used}")
                    return False
            else:
                self.log_result("Chat Default Behavior", False, 
                              f"Default chat failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Chat Default Behavior", False, f"Default chat error: {str(e)}")
            return False
    
    def test_session_management(self, session_id):
        """Test session management and chat history"""
        if not self.auth_token or not session_id:
            self.log_result("Session Management", False, "No auth token or session ID available")
            return False
            
        try:
            # Test getting chat history
            response = self.session.get(f"{self.base_url}/copilot/history/{session_id}")
            
            if response.status_code == 200:
                data = response.json()
                messages = data.get("messages", [])
                
                if len(messages) >= 2:  # Should have user message + AI response
                    self.log_result("Session Management", True, 
                                  f"Chat history retrieved successfully. {len(messages)} messages found")
                    return True
                else:
                    self.log_result("Session Management", False, 
                                  f"Expected at least 2 messages, got {len(messages)}")
                    return False
            else:
                self.log_result("Session Management", False, 
                              f"History retrieval failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Session Management", False, f"Session management error: {str(e)}")
            return False
    
    def test_chat_sessions_list(self):
        """Test getting list of chat sessions"""
        if not self.auth_token:
            self.log_result("Chat Sessions List", False, "No authentication token available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/copilot/sessions")
            
            if response.status_code == 200:
                data = response.json()
                sessions = data.get("sessions", [])
                
                if len(sessions) > 0:
                    self.log_result("Chat Sessions List", True, 
                                  f"Sessions list retrieved successfully. {len(sessions)} sessions found")
                    return True
                else:
                    self.log_result("Chat Sessions List", True, 
                                  "Sessions list retrieved (empty list is valid for new user)")
                    return True
            else:
                self.log_result("Chat Sessions List", False, 
                              f"Sessions list failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Chat Sessions List", False, f"Sessions list error: {str(e)}")
            return False
    
    def test_edge_cases(self):
        """Test edge cases"""
        if not self.auth_token:
            self.log_result("Edge Cases", False, "No authentication token available")
            return False
        
        edge_cases_passed = 0
        total_edge_cases = 3
        
        # Test 1: Empty message
        try:
            response = self.session.post(f"{self.base_url}/copilot/chat", json={
                "message": "",
                "use_multi_ai": False
            })
            
            if response.status_code in [200, 400]:  # Either works or properly rejects
                edge_cases_passed += 1
                print("   ✓ Empty message handled correctly")
            else:
                print(f"   ✗ Empty message test failed: {response.status_code}")
                
        except Exception as e:
            print(f"   ✗ Empty message test error: {str(e)}")
        
        # Test 2: Very long message
        try:
            long_message = "What are the best strategies? " * 100  # ~2700 chars
            response = self.session.post(f"{self.base_url}/copilot/chat", json={
                "message": long_message,
                "use_multi_ai": False
            })
            
            if response.status_code in [200, 400, 413]:  # Success, bad request, or payload too large
                edge_cases_passed += 1
                print("   ✓ Long message handled correctly")
            else:
                print(f"   ✗ Long message test failed: {response.status_code}")
                
        except Exception as e:
            print(f"   ✗ Long message test error: {str(e)}")
        
        # Test 3: Invalid session_id format
        try:
            response = self.session.post(f"{self.base_url}/copilot/chat", json={
                "message": "Test with custom session",
                "session_id": "custom-session-123",
                "use_multi_ai": False
            })
            
            if response.status_code == 200:
                edge_cases_passed += 1
                print("   ✓ Custom session ID handled correctly")
            else:
                print(f"   ✗ Custom session ID test failed: {response.status_code}")
                
        except Exception as e:
            print(f"   ✗ Custom session ID test error: {str(e)}")
        
        success = edge_cases_passed >= 2  # At least 2 out of 3 should pass
        self.log_result("Edge Cases", success, 
                      f"{edge_cases_passed}/{total_edge_cases} edge cases passed")
        return success
    
    def test_workflow_creation(self):
        """Test creating a workflow with Start -> Image Gen -> End"""
        if not self.auth_token:
            self.log_result("Workflow Creation", False, "No authentication token available")
            return False, None
            
        try:
            # Create workflow with Start -> Image Gen -> End
            workflow_data = {
                "name": "Image Generation Test Workflow",
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
            
            if response.status_code == 200:
                data = response.json()
                workflow_id = data.get("id")
                workflow_name = data.get("name")
                
                if workflow_id and workflow_name:
                    self.log_result("Workflow Creation", True, 
                                  f"Workflow created successfully: {workflow_name}", 
                                  f"Workflow ID: {workflow_id}")
                    return True, workflow_id
                else:
                    self.log_result("Workflow Creation", False, "Invalid workflow response format")
                    return False, None
            else:
                self.log_result("Workflow Creation", False, 
                              f"Workflow creation failed with status {response.status_code}", response.text)
                return False, None
                
        except Exception as e:
            self.log_result("Workflow Creation", False, f"Workflow creation error: {str(e)}")
            return False, None
    
    def test_workflow_execution(self, workflow_id):
        """Test executing the workflow and monitoring progress"""
        if not self.auth_token or not workflow_id:
            self.log_result("Workflow Execution", False, "No auth token or workflow ID available")
            return False, None
            
        try:
            # Execute workflow
            response = self.session.post(f"{self.base_url}/workflows/{workflow_id}/execute")
            
            if response.status_code == 200:
                data = response.json()
                execution_id = data.get("execution_id")
                status = data.get("status")
                
                if execution_id:
                    self.log_result("Workflow Execution", True, 
                                  f"Workflow execution started successfully. Status: {status}", 
                                  f"Execution ID: {execution_id}")
                    return True, execution_id
                else:
                    self.log_result("Workflow Execution", False, "No execution ID returned")
                    return False, None
            else:
                self.log_result("Workflow Execution", False, 
                              f"Workflow execution failed with status {response.status_code}", response.text)
                return False, None
                
        except Exception as e:
            self.log_result("Workflow Execution", False, f"Workflow execution error: {str(e)}")
            return False, None
    
    def test_execution_monitoring(self, execution_id):
        """Test monitoring execution progress and completion"""
        if not self.auth_token or not execution_id:
            self.log_result("Execution Monitoring", False, "No auth token or execution ID available")
            return False
            
        try:
            # Monitor execution progress with timeout
            max_wait_time = 120  # 2 minutes timeout for image generation
            start_time = time.time()
            final_status = None
            final_progress = 0
            
            while time.time() - start_time < max_wait_time:
                response = self.session.get(f"{self.base_url}/workflows/executions/{execution_id}")
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "unknown")
                    progress = data.get("progress", 0)
                    current_node = data.get("current_node", "")
                    results = data.get("results", {})
                    
                    print(f"   Progress: {progress}% - Status: {status} - Current Node: {current_node}")
                    
                    if status == "completed":
                        final_status = status
                        final_progress = progress
                        
                        # Check if image generation was successful
                        image_gen_result = None
                        for node_id, result in results.items():
                            if "imagegen" in node_id:
                                image_gen_result = result
                                break
                        
                        if image_gen_result and image_gen_result.get("status") == "success":
                            self.log_result("Execution Monitoring", True, 
                                          f"Workflow completed successfully with image generation", 
                                          f"Progress: {progress}%, Image result: {image_gen_result.get('status')}")
                            return True
                        else:
                            self.log_result("Execution Monitoring", False, 
                                          f"Workflow completed but image generation failed", 
                                          f"Image result: {image_gen_result}")
                            return False
                    
                    elif status == "failed":
                        error = data.get("error", "Unknown error")
                        self.log_result("Execution Monitoring", False, 
                                      f"Workflow execution failed: {error}")
                        return False
                    
                    # Continue monitoring if still running
                    time.sleep(5)  # Wait 5 seconds before next check
                else:
                    self.log_result("Execution Monitoring", False, 
                                  f"Failed to get execution status: {response.status_code}")
                    return False
            
            # Timeout reached
            self.log_result("Execution Monitoring", False, 
                          f"Execution monitoring timed out after {max_wait_time}s. Final status: {final_status}, Progress: {final_progress}%")
            return False
                
        except Exception as e:
            self.log_result("Execution Monitoring", False, f"Execution monitoring error: {str(e)}")
            return False
    
    def test_execution_history(self):
        """Test retrieving execution history"""
        if not self.auth_token:
            self.log_result("Execution History", False, "No authentication token available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/workflows/executions")
            
            if response.status_code == 200:
                executions = response.json()
                
                if isinstance(executions, list):
                    self.log_result("Execution History", True, 
                                  f"Execution history retrieved successfully. {len(executions)} executions found")
                    return True
                else:
                    self.log_result("Execution History", False, "Invalid execution history format")
                    return False
            else:
                self.log_result("Execution History", False, 
                              f"Execution history retrieval failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Execution History", False, f"Execution history error: {str(e)}")
            return False
    
    def test_workflow_retrieval(self, workflow_id):
        """Test retrieving workflow details"""
        if not self.auth_token or not workflow_id:
            self.log_result("Workflow Retrieval", False, "No auth token or workflow ID available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/workflows/{workflow_id}")
            
            if response.status_code == 200:
                data = response.json()
                nodes = data.get("nodes", [])
                edges = data.get("edges", [])
                
                # Verify workflow structure
                has_start = any(node.get("type") == "start" for node in nodes)
                has_imagegen = any(node.get("type") == "imagegen" for node in nodes)
                has_end = any(node.get("type") == "end" for node in nodes)
                
                if has_start and has_imagegen and has_end and len(edges) >= 2:
                    self.log_result("Workflow Retrieval", True, 
                                  f"Workflow retrieved successfully with correct structure", 
                                  f"Nodes: {len(nodes)}, Edges: {len(edges)}")
                    return True
                else:
                    self.log_result("Workflow Retrieval", False, 
                                  f"Workflow structure incorrect. Start: {has_start}, ImageGen: {has_imagegen}, End: {has_end}")
                    return False
            else:
                self.log_result("Workflow Retrieval", False, 
                              f"Workflow retrieval failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Workflow Retrieval", False, f"Workflow retrieval error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all workflow tests"""
        print("🚀 Starting Backend API Tests for Workflow Execution with Image Generation")
        print(f"Backend URL: {self.base_url}")
        print("=" * 80)
        
        # Authentication
        auth_success = self.test_user_registration()
        if not auth_success:
            print("Registration failed, trying fallback login...")
            auth_success = self.test_user_login_fallback()
        
        if not auth_success:
            print("❌ Authentication failed. Cannot proceed with workflow tests.")
            return self.generate_summary()
        
        # Workflow tests
        workflow_success, workflow_id = self.test_workflow_creation()
        
        if workflow_success and workflow_id:
            # Test workflow retrieval
            self.test_workflow_retrieval(workflow_id)
            
            # Test workflow execution
            execution_success, execution_id = self.test_workflow_execution(workflow_id)
            
            if execution_success and execution_id:
                # Monitor execution progress
                self.test_execution_monitoring(execution_id)
            
            # Test execution history
            self.test_execution_history()
        
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
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
        
        # Critical issues
        critical_failures = []
        for result in self.test_results:
            if not result["success"] and result["test"] in [
                "Chat Single AI Mode", "Chat Multi AI Mode", "Chat Default Behavior"
            ]:
                critical_failures.append(result["test"])
        
        if critical_failures:
            print(f"\n🚨 CRITICAL FAILURES: {', '.join(critical_failures)}")
        
        return {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "critical_failures": critical_failures,
            "results": self.test_results
        }

if __name__ == "__main__":
    tester = BackendTester()
    summary = tester.run_all_tests()