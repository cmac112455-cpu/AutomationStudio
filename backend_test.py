#!/usr/bin/env python3
"""
Backend API Testing for Workflow Execution with Image Generation
Tests workflow creation, execution, and monitoring functionality with REAL-TIME log monitoring
"""

import requests
import json
import time
import os
import subprocess
import threading
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
        self.log_monitor_active = False
        self.captured_logs = []
        
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
    
    def start_log_monitoring(self):
        """Start monitoring backend logs in real-time"""
        self.log_monitor_active = True
        self.captured_logs = []
        
        def monitor_logs():
            try:
                # Monitor backend error logs
                process = subprocess.Popen(
                    ['tail', '-f', '/var/log/supervisor/backend.err.log'],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    universal_newlines=True
                )
                
                print("🔍 Starting REAL-TIME backend log monitoring...")
                
                while self.log_monitor_active:
                    line = process.stdout.readline()
                    if line:
                        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                        log_entry = f"[{timestamp}] {line.strip()}"
                        self.captured_logs.append(log_entry)
                        print(f"📋 LOG: {log_entry}")
                    elif process.poll() is not None:
                        break
                        
                process.terminate()
                
            except Exception as e:
                print(f"⚠️  Log monitoring error: {str(e)}")
        
        # Start monitoring in background thread
        self.log_thread = threading.Thread(target=monitor_logs, daemon=True)
        self.log_thread.start()
        time.sleep(1)  # Give thread time to start
    
    def stop_log_monitoring(self):
        """Stop log monitoring and return captured logs"""
        self.log_monitor_active = False
        if hasattr(self, 'log_thread'):
            self.log_thread.join(timeout=2)
        
        print(f"🛑 Stopped log monitoring. Captured {len(self.captured_logs)} log entries.")
        return self.captured_logs.copy()
    
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
    
    def test_workflow_execution_with_logs(self, workflow_id):
        """Test executing the workflow with REAL-TIME log monitoring"""
        if not self.auth_token or not workflow_id:
            self.log_result("Workflow Execution with Logs", False, "No auth token or workflow ID available")
            return False, None
            
        try:
            print("\n🚀 STARTING WORKFLOW EXECUTION WITH REAL-TIME LOG MONITORING")
            print("=" * 80)
            
            # Start log monitoring BEFORE execution
            self.start_log_monitoring()
            
            # Execute workflow
            print("📤 Sending workflow execution request...")
            response = self.session.post(f"{self.base_url}/workflows/{workflow_id}/execute")
            
            if response.status_code == 200:
                data = response.json()
                execution_id = data.get("execution_id")
                status = data.get("status")
                
                if execution_id:
                    print(f"✅ Workflow execution started! Execution ID: {execution_id}")
                    print(f"📊 Initial Status: {status}")
                    print("\n🔄 MONITORING EXECUTION PROGRESS...")
                    print("-" * 60)
                    
                    # Monitor execution with logs
                    success = self.monitor_execution_with_logs(execution_id)
                    
                    # Stop log monitoring
                    captured_logs = self.stop_log_monitoring()
                    
                    if success:
                        self.log_result("Workflow Execution with Logs", True, 
                                      f"Workflow execution completed successfully with real-time log monitoring", 
                                      f"Execution ID: {execution_id}, Logs captured: {len(captured_logs)}")
                        return True, execution_id
                    else:
                        self.log_result("Workflow Execution with Logs", False, 
                                      f"Workflow execution failed during monitoring", 
                                      f"Execution ID: {execution_id}, Logs captured: {len(captured_logs)}")
                        return False, execution_id
                else:
                    self.stop_log_monitoring()
                    self.log_result("Workflow Execution with Logs", False, "No execution ID returned")
                    return False, None
            else:
                self.stop_log_monitoring()
                self.log_result("Workflow Execution with Logs", False, 
                              f"Workflow execution failed with status {response.status_code}", response.text)
                return False, None
                
        except Exception as e:
            self.stop_log_monitoring()
            self.log_result("Workflow Execution with Logs", False, f"Workflow execution error: {str(e)}")
            return False, None
    
    def monitor_execution_with_logs(self, execution_id):
        """Monitor execution progress with real-time log correlation"""
        try:
            # Monitor execution progress with extended timeout for image generation
            max_wait_time = 120  # 2 minutes timeout for image generation
            start_time = time.time()
            final_status = None
            final_progress = 0
            last_progress = -1
            
            print(f"⏱️  Starting execution monitoring (timeout: {max_wait_time}s)")
            
            while time.time() - start_time < max_wait_time:
                response = self.session.get(f"{self.base_url}/workflows/executions/{execution_id}")
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "unknown")
                    progress = data.get("progress", 0)
                    current_node = data.get("current_node", "")
                    results = data.get("results", {})
                    execution_log = data.get("execution_log", [])
                    
                    # Only print progress updates when they change
                    if progress != last_progress:
                        elapsed = int(time.time() - start_time)
                        print(f"📊 [{elapsed:3d}s] Progress: {progress:3d}% | Status: {status:10s} | Node: {current_node}")
                        last_progress = progress
                    
                    if status == "completed":
                        final_status = status
                        final_progress = progress
                        elapsed = int(time.time() - start_time)
                        
                        print(f"\n🎉 WORKFLOW COMPLETED in {elapsed}s!")
                        print("=" * 50)
                        
                        # Analyze results
                        print("📋 EXECUTION RESULTS:")
                        for node_id, result in results.items():
                            node_status = result.get("status", "unknown")
                            print(f"   • {node_id}: {node_status}")
                            
                            # Special handling for image generation
                            if "imagegen" in node_id:
                                if result.get("status") == "success":
                                    image_data = result.get("image_base64", "")
                                    print(f"     ✅ Image generated successfully ({len(image_data)} chars)")
                                else:
                                    error = result.get("error", "Unknown error")
                                    print(f"     ❌ Image generation failed: {error}")
                        
                        # Check execution log
                        print(f"\n📝 EXECUTION LOG ({len(execution_log)} entries):")
                        for log_entry in execution_log[-5:]:  # Show last 5 entries
                            print(f"   • {log_entry}")
                        
                        # Verify image generation success
                        image_gen_result = None
                        for node_id, result in results.items():
                            if "imagegen" in node_id:
                                image_gen_result = result
                                break
                        
                        if image_gen_result and image_gen_result.get("status") == "success":
                            print("\n✅ IMAGE GENERATION: SUCCESS")
                            return True
                        else:
                            print(f"\n❌ IMAGE GENERATION: FAILED - {image_gen_result}")
                            return False
                    
                    elif status == "failed":
                        error = data.get("error", "Unknown error")
                        elapsed = int(time.time() - start_time)
                        print(f"\n💥 WORKFLOW FAILED after {elapsed}s: {error}")
                        return False
                    
                    # Continue monitoring if still running
                    time.sleep(3)  # Check every 3 seconds
                else:
                    print(f"❌ Failed to get execution status: {response.status_code}")
                    return False
            
            # Timeout reached
            elapsed = int(time.time() - start_time)
            print(f"\n⏰ EXECUTION TIMEOUT after {elapsed}s")
            print(f"   Final status: {final_status}, Progress: {final_progress}%")
            return False
                
        except Exception as e:
            print(f"💥 Execution monitoring error: {str(e)}")
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
                    
                    # Show recent executions
                    if executions:
                        print("\n📋 RECENT EXECUTIONS:")
                        for i, exec_data in enumerate(executions[:3]):  # Show top 3
                            status = exec_data.get("status", "unknown")
                            workflow_name = exec_data.get("workflow_name", "Unknown")
                            started_at = exec_data.get("started_at", "")
                            print(f"   {i+1}. {workflow_name} - {status} - {started_at}")
                    
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
    
    def test_mongodb_persistence(self, execution_id):
        """Test if execution record exists in MongoDB via API"""
        if not self.auth_token or not execution_id:
            self.log_result("MongoDB Persistence", False, "No auth token or execution ID available")
            return False
            
        try:
            # Get specific execution record
            response = self.session.get(f"{self.base_url}/workflows/executions/{execution_id}")
            
            if response.status_code == 200:
                execution_data = response.json()
                
                # Verify required fields exist
                required_fields = ["id", "workflow_id", "user_id", "status", "started_at"]
                missing_fields = [field for field in required_fields if field not in execution_data]
                
                if not missing_fields:
                    status = execution_data.get("status")
                    progress = execution_data.get("progress", 0)
                    results = execution_data.get("results", {})
                    
                    self.log_result("MongoDB Persistence", True, 
                                  f"Execution record persisted correctly in MongoDB", 
                                  f"Status: {status}, Progress: {progress}%, Results: {len(results)} nodes")
                    
                    print(f"\n💾 MONGODB RECORD VERIFICATION:")
                    print(f"   • Execution ID: {execution_data.get('id')}")
                    print(f"   • Workflow ID: {execution_data.get('workflow_id')}")
                    print(f"   • Status: {execution_data.get('status')}")
                    print(f"   • Progress: {execution_data.get('progress', 0)}%")
                    print(f"   • Started: {execution_data.get('started_at')}")
                    print(f"   • Completed: {execution_data.get('completed_at', 'N/A')}")
                    print(f"   • Results: {len(execution_data.get('results', {}))} node results")
                    
                    return True
                else:
                    self.log_result("MongoDB Persistence", False, 
                                  f"Execution record missing required fields: {missing_fields}")
                    return False
            else:
                self.log_result("MongoDB Persistence", False, 
                              f"Failed to retrieve execution record: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("MongoDB Persistence", False, f"MongoDB persistence check error: {str(e)}")
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

    def run_comprehensive_workflow_test(self):
        """Run comprehensive workflow test with real-time log monitoring"""
        print("🚀 COMPREHENSIVE WORKFLOW EXECUTION TEST WITH REAL-TIME LOG MONITORING")
        print(f"Backend URL: {self.base_url}")
        print("Test Scenario: Start -> Image Gen (prompt: 'a cute cow on a beach') -> End")
        print("=" * 80)
        
        # Step 1: Authentication
        print("\n📝 STEP 1: USER AUTHENTICATION")
        auth_success = self.test_user_registration()
        if not auth_success:
            print("Registration failed, trying fallback login...")
            auth_success = self.test_user_login_fallback()
        
        if not auth_success:
            print("❌ Authentication failed. Cannot proceed with workflow tests.")
            return self.generate_summary()
        
        # Step 2: Workflow Creation
        print("\n🔧 STEP 2: WORKFLOW CREATION")
        workflow_success, workflow_id = self.test_workflow_creation()
        
        if not workflow_success or not workflow_id:
            print("❌ Workflow creation failed. Cannot proceed.")
            return self.generate_summary()
        
        # Step 3: Workflow Retrieval Verification
        print("\n🔍 STEP 3: WORKFLOW RETRIEVAL VERIFICATION")
        self.test_workflow_retrieval(workflow_id)
        
        # Step 4: Workflow Execution with Real-time Log Monitoring
        print("\n⚡ STEP 4: WORKFLOW EXECUTION WITH REAL-TIME LOG MONITORING")
        execution_success, execution_id = self.test_workflow_execution_with_logs(workflow_id)
        
        if execution_id:
            # Step 5: MongoDB Persistence Check
            print("\n💾 STEP 5: MONGODB PERSISTENCE VERIFICATION")
            self.test_mongodb_persistence(execution_id)
        
        # Step 6: Execution History Check
        print("\n📋 STEP 6: EXECUTION HISTORY VERIFICATION")
        self.test_execution_history()
        
        # Step 7: Log Analysis
        print("\n📊 STEP 7: LOG ANALYSIS")
        if self.captured_logs:
            print(f"Captured {len(self.captured_logs)} log entries during execution:")
            for log in self.captured_logs[-10:]:  # Show last 10 logs
                print(f"   {log}")
        else:
            print("No backend logs captured during execution.")
        
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