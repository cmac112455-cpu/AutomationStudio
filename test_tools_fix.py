#!/usr/bin/env python3
"""
Quick test script for the FIXED Tools Tab Backend Endpoints
"""

from backend_test import BackendTester

def main():
    print("🔧 TESTING FIXED TOOLS TAB BACKEND ENDPOINTS")
    print("=" * 60)
    
    tester = BackendTester()
    result = tester.run_conversational_ai_tools_test()
    
    print("\n🎯 TEST COMPLETED")
    return result

if __name__ == "__main__":
    main()