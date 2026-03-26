import requests
import sys
import json
from datetime import datetime

class AIEndpointsTest:
    def __init__(self, base_url="https://ai-workout-hub-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def login_test_user(self):
        """Login with test user"""
        login_data = {
            "email": "test@example.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Login Test User",
            "POST",
            "user/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✓ Token obtained for testing")
            return True
        return False

    def test_coach_message(self):
        """Test GET /api/coach/message"""
        if not self.token:
            self.log_test("Coach Message API", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Coach Message API",
            "GET",
            "coach/message",
            200
        )
        
        if success:
            print(f"   ✓ Message: {response.get('message', 'N/A')[:50]}...")
            print(f"   ✓ Tip: {response.get('tip_of_the_day', 'N/A')[:50]}...")
            print(f"   ✓ Encouragement: {response.get('encouragement', 'N/A')[:50]}...")
        return success

    def test_ai_workout_plan(self):
        """Test POST /api/workout/ai-plan"""
        if not self.token:
            self.log_test("AI Workout Plan", False, "No token available")
            return False
            
        ai_plan_data = {
            "program_type": "WEIGHT_LOSS",
            "days": 5
        }
        
        success, response = self.run_test(
            "AI Workout Plan Generation",
            "POST",
            "workout/ai-plan",
            200,
            data=ai_plan_data
        )
        
        if success:
            workouts = response.get('workouts', [])
            print(f"   ✓ Generated {len(workouts)} AI workouts")
            print(f"   ✓ Coach message: {response.get('coach_message', 'N/A')[:50]}...")
            print(f"   ✓ Intensity: {response.get('recommended_intensity', 'N/A')}")
            print(f"   ✓ Schedule: {response.get('weekly_schedule', 'N/A')[:50]}...")
            
            # Check if workouts have AI flag
            ai_workouts = [w for w in workouts if w.get('ai_generated', False)]
            print(f"   ✓ AI-generated workouts: {len(ai_workouts)}")
        return success

    def test_weekly_progress(self):
        """Test GET /api/workout/weekly-progress"""
        if not self.token:
            self.log_test("Weekly Progress API", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Weekly Progress API",
            "GET",
            "workout/weekly-progress",
            200
        )
        
        if success:
            week_data = response.get('week_data', [])
            print(f"   ✓ Week data points: {len(week_data)}")
            print(f"   ✓ Total this week: {response.get('total_this_week', 0)}")
            print(f"   ✓ Completed this week: {response.get('completed_this_week', 0)}")
            print(f"   ✓ Percentage: {response.get('percentage', 0)}%")
        return success

    def test_user_goal_update(self):
        """Test PUT /api/user/goal"""
        if not self.token:
            self.log_test("User Goal Update", False, "No token available")
            return False
            
        goal_data = {
            "fitness_goal": "MUSCLE"
        }
        
        success, response = self.run_test(
            "User Goal Update",
            "PUT",
            "user/goal",
            200,
            data=goal_data
        )
        
        if success and isinstance(response, dict):
            print(f"   ✓ Updated goal: {response.get('fitness_goal', 'N/A')}")
        return success

def main():
    print("🚀 Testing AI HealthCoach Specific Endpoints")
    print("=" * 60)
    
    tester = AIEndpointsTest()
    
    # Login first
    if not tester.login_test_user():
        print("❌ Failed to login, cannot test protected endpoints")
        return 1
    
    print("\n📋 Testing AI-Specific Endpoints")
    tester.test_coach_message()
    tester.test_ai_workout_plan()
    tester.test_weekly_progress()
    tester.test_user_goal_update()
    
    # Final Results
    print("\n" + "=" * 60)
    print("📊 AI ENDPOINTS TEST SUMMARY")
    print("=" * 60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())