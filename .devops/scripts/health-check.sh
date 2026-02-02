#!/bin/bash

# RemoteEye Health Check Script
# Run this to verify all services are healthy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_URL="https://spyder-server.onrender.com"
DASHBOARD_URL="https://spyder-dashboard.onrender.com"

echo "🏥 RemoteEye Health Check"
echo "========================="
echo "Time: $(date)"
echo ""

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}

    echo -n "Checking $name... "

    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$http_code" -eq "$expected_code" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code, expected $expected_code)"
        return 1
    fi
}

# Function to check JSON response
check_json() {
    local url=$1
    local name=$2
    local expected_key=$3
    local expected_value=$4

    echo -n "Checking $name... "

    response=$(curl -s "$url")
    actual_value=$(echo "$response" | grep -o "\"$expected_key\":\"[^\"]*\"" | cut -d'"' -f4)

    if [ "$actual_value" = "$expected_value" ]; then
        echo -e "${GREEN}✓ OK${NC} ($expected_key: $actual_value)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (expected $expected_value, got $actual_value)"
        echo "Response: $response"
        return 1
    fi
}

# Function to measure response time
check_response_time() {
    local url=$1
    local name=$2
    local max_time=${3:-2}

    echo -n "Checking $name response time... "

    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$url")
    response_ms=$(echo "$response_time * 1000" | bc | cut -d'.' -f1)
    max_ms=$(echo "$max_time * 1000" | bc | cut -d'.' -f1)

    if [ "$response_ms" -lt "$max_ms" ]; then
        echo -e "${GREEN}✓ OK${NC} (${response_ms}ms)"
        return 0
    else
        echo -e "${YELLOW}⚠ SLOW${NC} (${response_ms}ms, threshold: ${max_ms}ms)"
        return 1
    fi
}

# Initialize counters
total_checks=0
passed_checks=0
failed_checks=0

# Test 1: Server Health Endpoint
echo "1. Server Health"
echo "----------------"
total_checks=$((total_checks + 1))
if check_http "$SERVER_URL/api/health" "Server health endpoint"; then
    passed_checks=$((passed_checks + 1))
else
    failed_checks=$((failed_checks + 1))
fi

total_checks=$((total_checks + 1))
if check_json "$SERVER_URL/api/health" "Server health status" "status" "ok"; then
    passed_checks=$((passed_checks + 1))
else
    failed_checks=$((failed_checks + 1))
fi

total_checks=$((total_checks + 1))
if check_response_time "$SERVER_URL/api/health" "Server" 1; then
    passed_checks=$((passed_checks + 1))
else
    failed_checks=$((failed_checks + 1))
fi

echo ""

# Test 2: Dashboard
echo "2. Dashboard"
echo "------------"
total_checks=$((total_checks + 1))
if check_http "$DASHBOARD_URL" "Dashboard"; then
    passed_checks=$((passed_checks + 1))
else
    failed_checks=$((failed_checks + 1))
fi

total_checks=$((total_checks + 1))
if check_response_time "$DASHBOARD_URL" "Dashboard" 2; then
    passed_checks=$((passed_checks + 1))
else
    failed_checks=$((failed_checks + 1))
fi

echo ""

# Test 3: WebSocket
echo "3. WebSocket"
echo "------------"
echo -n "Checking WebSocket endpoint... "

ws_response=$(curl -s -I "$SERVER_URL/socket.io/" | head -1)
if echo "$ws_response" | grep -q "200\|101"; then
    echo -e "${GREEN}✓ OK${NC}"
    total_checks=$((total_checks + 1))
    passed_checks=$((passed_checks + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $ws_response"
    total_checks=$((total_checks + 1))
    failed_checks=$((failed_checks + 1))
fi

echo ""

# Test 4: SSL/TLS
echo "4. SSL/TLS"
echo "----------"
echo -n "Checking SSL certificate... "

ssl_info=$(echo | openssl s_client -servername spyder-server.onrender.com -connect spyder-server.onrender.com:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)

if [ -n "$ssl_info" ]; then
    expiry=$(echo "$ssl_info" | grep "notAfter" | cut -d'=' -f2)
    echo -e "${GREEN}✓ OK${NC} (Expires: $expiry)"
    total_checks=$((total_checks + 1))
    passed_checks=$((passed_checks + 1))
else
    echo -e "${RED}✗ FAILED${NC}"
    total_checks=$((total_checks + 1))
    failed_checks=$((failed_checks + 1))
fi

echo ""

# Summary
echo "Summary"
echo "======="
echo "Total checks: $total_checks"
echo -e "Passed: ${GREEN}$passed_checks${NC}"

if [ $failed_checks -gt 0 ]; then
    echo -e "Failed: ${RED}$failed_checks${NC}"
fi

echo ""

# Exit code
if [ $failed_checks -gt 0 ]; then
    echo -e "${RED}❌ Health check FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All checks PASSED${NC}"
    exit 0
fi
