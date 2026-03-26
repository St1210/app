import requests
import sys
import json
from datetime import datetime

class HealthCoachAPITester:
    def __init__(self, base_url="https://ai-workout-hub-15.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)

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

        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Request error: {str(e)}")
            return False, {}
        except Exception as e:
            self.log_test(name, False, f"Unexpected error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_register_new_user(self):
        """Test user registration with new user"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user_data = {
            "name": f"Test User {timestamp}",
            "email": f"testuser{timestamp}@example.com",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "User Registration (New User)",
            "POST",
            "user/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            print(f"   ✓ Token received: {response['access_token'][:20]}...")
            print(f"   ✓ User created: {response['user']['name']}")
            return True, response
        return False, {}

    def test_register_existing_user(self):
        """Test registration with existing email"""
        existing_user_data = {
            "name": "Test User",
            "email": "test@example.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "User Registration (Existing Email)",
            "POST",
            "user/register",
            409,  # Conflict expected
            data=existing_user_data
        )
        return success

    def test_login_valid_credentials(self):
        """Test login with valid credentials"""
        login_data = {
            "email": "test@example.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "User Login (Valid Credentials)",
            "POST",
            "user/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✓ Token stored: {self.token[:20]}...")
            print(f"   ✓ User: {response['user']['name']} ({response['user']['email']})")
            return True, response
        return False, {}

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        login_data = {
            "email": "test@example.com",
            "password": "wrongpassword"
        }
        
        success, response = self.run_test(
            "User Login (Invalid Credentials)",
            "POST",
            "user/login",
            401,  # Unauthorized expected
            data=login_data
        )
        return success

    def test_get_profile(self):
        """Test getting user profile (protected route)"""
        if not self.token:
            self.log_test("Get User Profile", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get User Profile (Protected)",
            "GET",
            "user/profile",
            200
        )
        
        if success:
            print(f"   ✓ Profile: {response.get('name')} ({response.get('email')})")
        return success

    def test_get_profile_no_token(self):
        """Test getting profile without token"""
        old_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Get User Profile (No Token)",
            "GET",
            "user/profile",
            401  # Unauthorized expected
        )
        
        self.token = old_token  # Restore token
        return success

    def test_generate_workouts(self):
        """Test workout generation"""
        if not self.token:
            self.log_test("Generate Workouts", False, "No token available")
            return False, []
            
        success, response = self.run_test(
            "Generate Workouts (BEGINNER)",
            "POST",
            "workout/generate/BEGINNER",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✓ Generated {len(response)} workouts")
            for i, workout in enumerate(response[:2]):  # Show first 2
                print(f"   ✓ Workout {i+1}: {workout.get('title', 'N/A')}")
            return True, response
        return False, []

    def test_get_all_workouts(self):
        """Test getting all user workouts"""
        if not self.token:
            self.log_test("Get All Workouts", False, "No token available")
            return False, []
            
        success, response = self.run_test(
            "Get All Workouts",
            "GET",
            "workout/all",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✓ Found {len(response)} workouts")
            return True, response
        return False, []

    def test_complete_workout(self, workout_id):
        """Test completing a workout"""
        if not self.token or not workout_id:
            self.log_test("Complete Workout", False, "No token or workout ID")
            return False
            
        success, response = self.run_test(
            "Complete Workout",
            "PUT",
            f"workout/complete/{workout_id}",
            200
        )
        
        if success:
            print(f"   ✓ Workout completed: {response.get('completed', False)}")
        return success

    def test_get_dashboard(self):
        """Test dashboard analytics"""
        if not self.token:
            self.log_test("Get Dashboard", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Dashboard Analytics",
            "GET",
            "workout/dashboard",
            200
        )
        
        if success:
            print(f"   ✓ Total workouts: {response.get('total_workouts', 0)}")
            print(f"   ✓ Completed: {response.get('completed_workouts', 0)}")
            print(f"   ✓ Streak: {response.get('streak', 0)} days")
            print(f"   ✓ Completion rate: {response.get('completion_percentage', 0)}%")
        return success

    def test_get_streak(self):
        """Test streak calculation"""
        if not self.token:
            self.log_test("Get Streak", False, "No token available")
            return False
            
        success, response = self.run_test(
            "Get Workout Streak",
            "GET",
            "workout/streak",
            200
        )
        
        if success:
            print(f"   ✓ Current streak: {response.get('streak', 0)} days")
            print(f"   ✓ Last workout: {response.get('last_workout_date', 'None')}")
        return success

def main():
    print("🚀 Starting HealthCoach API Tests")
    print("=" * 50)
    
    tester = HealthCoachAPITester()
    
    # Test sequence
    print("\n📋 PHASE 1: Basic API Health")
    tester.test_health_check()
    
    print("\n📋 PHASE 2: Authentication Tests")
    tester.test_register_existing_user()  # Should fail with 409
    tester.test_register_new_user()       # Should succeed
    tester.test_login_invalid_credentials()  # Should fail with 401
    tester.test_login_valid_credentials()    # Should succeed and set token
    
    print("\n📋 PHASE 3: Protected Route Tests")
    tester.test_get_profile_no_token()    # Should fail with 401
    tester.test_get_profile()             # Should succeed
    
    print("\n📋 PHASE 4: Workout Management")
    success, workouts = tester.test_generate_workouts()
    tester.test_get_all_workouts()
    
    # Test workout completion if we have workouts
    if success and workouts and len(workouts) > 0:
        workout_id = workouts[0].get('id')
        if workout_id:
            tester.test_complete_workout(workout_id)
    
    print("\n📋 PHASE 5: Analytics & Dashboard")
    tester.test_get_dashboard()
    tester.test_get_streak()
    
    # Final Results
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    # Show failed tests
    failed_tests = [t for t in tester.test_results if not t['success']]
    if failed_tests:
        print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   • {test['test']}: {test['details']}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())