#!/bin/bash

BASE_URL="http://localhost:3002"

echo "=========================================="
echo "Testing Buyer Management API"
echo "=========================================="

echo -e "\n1. GET /api/admin/buyers - List all buyers"
curl -s "$BASE_URL/api/admin/buyers" | jq '{success: .success, buyerCount: (.data.buyers | length), pagination: .data.pagination, firstBuyer: .data.buyers[0].name}'

echo -e "\n2. GET /api/admin/buyers with filters - NETWORK type only"
curl -s "$BASE_URL/api/admin/buyers?type=NETWORK" | jq '{success: .success, buyerCount: (.data.buyers | length), buyers: [.data.buyers[].name]}'

echo -e "\n3. GET /api/admin/buyers/[id] - Get HomeAdvisor details"
BUYER_ID=$(curl -s "$BASE_URL/api/admin/buyers" | jq -r '.data.buyers[0].id')
curl -s "$BASE_URL/api/admin/buyers/$BUYER_ID" | jq '{success: .success, name: .data.name, type: .data.type, serviceConfigs: (.data.serviceConfigs | length), stats: .data.stats}'

echo -e "\n4. POST /api/admin/buyers - Create new buyer"
NEW_BUYER=$(curl -s -X POST "$BASE_URL/api/admin/buyers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Contractor LLC",
    "type": "CONTRACTOR",
    "apiUrl": "https://api.testcontractor.com/leads",
    "authConfig": {
      "type": "bearer",
      "credentials": {
        "token": "test_token_123"
      }
    },
    "contactName": "Test Contact",
    "contactEmail": "test@testcontractor.com",
    "active": true
  }')
echo "$NEW_BUYER" | jq '{success: .success, created: .data.name, id: .data.id}'
NEW_ID=$(echo "$NEW_BUYER" | jq -r '.data.id')

echo -e "\n5. PUT /api/admin/buyers/[id] - Update the new buyer"
curl -s -X PUT "$BASE_URL/api/admin/buyers/$NEW_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "contactPhone": "555-TEST-123",
    "active": false
  }' | jq '{success: .success, name: .data.name, contactPhone: .data.contactPhone, active: .data.active}'

echo -e "\n6. DELETE /api/admin/buyers/[id] - Delete the test buyer"
curl -s -X DELETE "$BASE_URL/api/admin/buyers/$NEW_ID" | jq '{success: .success, message: .data.message}'

echo -e "\n=========================================="
echo "All tests completed!"
echo "=========================================="
