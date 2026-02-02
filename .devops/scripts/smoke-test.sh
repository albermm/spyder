#!/bin/bash

# RemoteEye Smoke Test
# Run after deployment to verify critical functionality

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
SERVER_URL="https://spyder-server.onrender.com"
DASHBOARD_URL="https://spyder-dashboard.onrender.com"

echo "🔥 RemoteEye Smoke Test"
echo "======================="
echo "Time: $(date)"
echo "Server: $SERVER_URL"
echo "Dashboard: $DASHBOARD_URL"
echo ""

# Counters
total_tests=0
passed_tests=0
failed_tests=0

# Helper function to run test
run_test() {
    local test_name=$1
    local test_command=$2

    total_tests=$((total_tests + 1))
    echo -n "[$total_tests] $test_name... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        passed_tests=$((passed_tests + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        failed_tests=$((failed_tests + 1))
        return 1
    fi
}

echo "🧪 Running Smoke Tests"
echo "====================="
echo ""

# Test 1: Server responds
run_test "Server responds" \
    "curl -s -f $SERVER_URL/api/health"

# Test 2: Health check returns OK
run_test "Health check returns OK" \
    "curl -s $SERVER_URL/api/health | grep -q '\"status\":\"ok\"'"

# Test 3: Dashboard loads
run_test "Dashboard loads" \
    "curl -s -f -I $DASHBOARD_URL | grep -q '200'"

# Test 4: Dashboard is HTML
run_test "Dashboard returns HTML" \
    "curl -s -I $DASHBOARD_URL | grep -q 'text/html'"

# Test 5: WebSocket endpoint accessible
run_test "WebSocket endpoint accessible" \
    "curl -s -I $SERVER_URL/socket.io/ | grep -qE '200|101'"

# Test 6: CORS headers present
run_test "CORS headers configured" \
    "curl -s -I -H 'Origin: https://spyder-dashboard.onrender.com' $SERVER_URL/api/health | grep -q 'access-control-allow-origin'"

# Test 7: SSL certificate valid
run_test "SSL certificate valid" \
    "echo | openssl s_client -servername spyder-server.onrender.com -connect spyder-server.onrender.com:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep -q notAfter"

# Test 8: Response time acceptable
run_test "Server response time < 2s" \
    "[ \$(curl -s -o /dev/null -w '%{time_total}' $SERVER_URL/api/health | cut -d'.' -f1) -lt 2 ]"

# Test 9: Security headers present
run_test "Security headers present" \
    "curl -s -I $SERVER_URL/api/health | grep -qE 'x-content-type-options|x-frame-options'"

# Test 10: API documentation accessible (if Swagger/OpenAPI enabled)
# Uncomment if you have API docs
# run_test "API documentation accessible" \
#     "curl -s -f $SERVER_URL/docs"

echo ""
echo "📊 Test Results"
echo "==============="
echo "Total tests: $total_tests"
echo -e "Passed: ${GREEN}$passed_tests${NC}"

if [ $failed_tests -gt 0 ]; then
    echo -e "Failed: ${RED}$failed_tests${NC}"
    echo ""
    echo -e "${RED}❌ SMOKE TEST FAILED${NC}"
    echo "Some tests failed. Please investigate before proceeding."
    exit 1
else
    echo ""
    echo -e "${GREEN}✅ ALL SMOKE TESTS PASSED${NC}"
    echo "Deployment appears to be successful!"
    exit 0
fi
