#!/bin/bash

# iOS App Deployment Helper Script
# This script helps prepare and build the iOS app for App Store submission

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📱 iOS App Deployment Helper"
echo "============================="
echo ""

# Navigate to iOS directory
cd "$(dirname "$0")/mobile/ios"

echo "📋 Current Configuration:"
echo "------------------------"
BUNDLE_ID=$(xcodebuild -showBuildSettings -workspace RemoteEyeMobile.xcworkspace -scheme RemoteEyeMobile 2>/dev/null | grep "PRODUCT_BUNDLE_IDENTIFIER" | head -1 | awk '{print $3}')
VERSION=$(xcodebuild -showBuildSettings -workspace RemoteEyeMobile.xcworkspace -scheme RemoteEyeMobile 2>/dev/null | grep "MARKETING_VERSION" | head -1 | awk '{print $3}')
BUILD=$(xcodebuild -showBuildSettings -workspace RemoteEyeMobile.xcworkspace -scheme RemoteEyeMobile 2>/dev/null | grep "CURRENT_PROJECT_VERSION" | head -1 | awk '{print $3}')

echo -e "${BLUE}Bundle ID:${NC} $BUNDLE_ID"
echo -e "${BLUE}Version:${NC} $VERSION"
echo -e "${BLUE}Build:${NC} $BUILD"
echo ""

echo "🔍 Pre-Deployment Checks:"
echo "------------------------"

# Check 1: GoogleService-Info.plist
if [ -f "RemoteEyeMobile/GoogleService-Info.plist" ]; then
    echo -e "${GREEN}✓${NC} GoogleService-Info.plist found"
else
    echo -e "${RED}✗${NC} GoogleService-Info.plist missing!"
    exit 1
fi

# Check 2: Workspace exists
if [ -d "RemoteEyeMobile.xcworkspace" ]; then
    echo -e "${GREEN}✓${NC} Xcode workspace found"
else
    echo -e "${RED}✗${NC} Xcode workspace missing!"
    exit 1
fi

# Check 3: CocoaPods
echo -n "  Checking CocoaPods... "
if command -v pod &> /dev/null; then
    echo -e "${GREEN}installed${NC}"
else
    echo -e "${RED}not installed${NC}"
    echo "  Install with: sudo gem install cocoapods"
    exit 1
fi

echo ""
echo "🔧 Updating Dependencies:"
echo "------------------------"
echo "Running pod install..."
pod install

echo ""
echo "✅ Pre-deployment checks complete!"
echo ""
echo "📦 Next Steps:"
echo "-------------"
echo "1. Open Xcode workspace:"
echo "   ${BLUE}open RemoteEyeMobile.xcworkspace${NC}"
echo ""
echo "2. In Xcode:"
echo "   a. Select 'Any iOS Device' as build target"
echo "   b. Verify signing: Signing & Capabilities tab"
echo "   c. Product → Archive"
echo ""
echo "3. After archiving:"
echo "   - Window → Organizer"
echo "   - Select your archive"
echo "   - Click 'Distribute App'"
echo "   - Choose 'App Store Connect'"
echo "   - Upload"
echo ""
echo "4. In App Store Connect:"
echo "   - https://appstoreconnect.apple.com"
echo "   - Add screenshots and metadata"
echo "   - Submit for TestFlight or App Store review"
echo ""
echo "📝 See IOS_DEPLOYMENT_CHECKLIST.md for detailed steps"
echo ""
