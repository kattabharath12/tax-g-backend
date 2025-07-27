
#!/bin/bash

# Tax Filing Backend API Test Script
# This script tests all major API endpoints

BASE_URL="http://localhost:8001"
echo "🧪 Testing Tax Filing Backend API at $BASE_URL"
echo "=================================================="

# Test 1: Health Check
echo "1. Testing Health Check..."
curl -s "$BASE_URL/health" | head -5
echo -e "\n"

# Test 2: User Registration
echo "2. Testing User Registration..."
curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test User",
    "email": "apitest@example.com",
    "password": "testpass123"
  }' | head -5
echo -e "\n"

# Test 3: User Login
echo "3. Testing User Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

echo "$LOGIN_RESPONSE" | head -5

# Extract token for authenticated requests
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token extracted: ${TOKEN:0:20}..."
echo -e "\n"

# Test 4: Get Tax Returns (Authenticated)
echo "4. Testing Get Tax Returns..."
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/tax-returns" | head -5
echo -e "\n"

# Test 5: Create Tax Return (Authenticated)
echo "5. Testing Create Tax Return..."
curl -s -X POST "$BASE_URL/api/tax-returns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taxYear": 2024,
    "filingStatus": "SINGLE"
  }' | head -5
echo -e "\n"

# Test 6: AI Tax Strategies (Authenticated)
echo "6. Testing AI Tax Strategies..."
curl -s -X POST "$BASE_URL/api/ai/tax-strategies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taxReturnData": {
      "income": 75000,
      "filingStatus": "SINGLE"
    }
  }' | head -10
echo -e "\n"

echo "=================================================="
echo "✅ API Testing Complete!"
echo "📊 Server Status: $(curl -s $BASE_URL/health | grep -o '"status":"[^"]*' | cut -d'"' -f4)"
echo "🔗 Full API Documentation: See README.md"
