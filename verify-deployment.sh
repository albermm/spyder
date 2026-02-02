#!/bin/bash

# Quick deployment verification script

echo "🔍 Verifying Deployment"
echo "======================="
echo ""

echo "1. Checking Server Health..."
echo "----------------------------"
SERVER_HEALTH=$(curl -s https://spyder-server.onrender.com/api/health)
echo "Response: $SERVER_HEALTH"

if echo "$SERVER_HEALTH" | grep -qE '"status":"(ok|healthy)"'; then
    echo "✅ Server is healthy!"
else
    echo "❌ Server health check failed"
fi

echo ""
echo "2. Checking Dashboard..."
echo "------------------------"
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://spyder-dashboard.onrender.com)
echo "HTTP Status: $DASHBOARD_STATUS"

if [ "$DASHBOARD_STATUS" = "200" ]; then
    echo "✅ Dashboard is accessible!"
else
    echo "❌ Dashboard is not accessible (HTTP $DASHBOARD_STATUS)"
fi

echo ""
echo "3. Service URLs:"
echo "----------------"
echo "Server API: https://spyder-server.onrender.com"
echo "Dashboard:  https://spyder-dashboard.onrender.com"
echo ""
echo "4. Next Steps:"
echo "--------------"
echo "- Open dashboard: open https://spyder-dashboard.onrender.com"
echo "- Run smoke tests: ./.devops/scripts/smoke-test.sh"
echo "- View server logs: render logs spyder-server --tail -o text"
echo "- View dashboard logs: render logs spyder-dashboard --tail -o text"
echo ""
