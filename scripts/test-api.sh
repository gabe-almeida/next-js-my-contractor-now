#!/bin/bash

BASE_URL="http://localhost:3002"
BUYER_ID="25e8aa15-3b20-438b-89c0-c7debc908cf7"
SERVICE_ID="1fefd5b3-f999-4ea0-b967-0142a5a71ee1"

echo "Testing POST - Add new ZIP codes..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/buyers/$BUYER_ID/zip-codes" \
  -H "Content-Type: application/json" \
  -d "{\"serviceTypeId\":\"$SERVICE_ID\",\"zipCodes\":[\"99999\",\"99998\"],\"priority\":8,\"maxLeadsPerDay\":15}")
echo "$RESPONSE" | jq '{success, created: (.data | length), message}'

# Get the created ZIP code IDs
ZIP_ID=$(echo "$RESPONSE" | jq -r '.data[0].id')

echo -e "\nTesting PUT - Update ZIP code priority..."
curl -s -X PUT "$BASE_URL/api/admin/buyers/$BUYER_ID/zip-codes" \
  -H "Content-Type: application/json" \
  -d "{\"zipCodeIds\":[\"$ZIP_ID\"],\"updates\":{\"priority\":10}}" | jq '{success, updatedCount, message}'

echo -e "\nTesting DELETE - Remove ZIP codes..."
curl -s -X DELETE "$BASE_URL/api/admin/buyers/$BUYER_ID/zip-codes?ids=$ZIP_ID" | jq '{success, deletedCount, message}'

echo -e "\nAll tests completed!"
