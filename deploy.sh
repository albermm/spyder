#!/bin/bash

# RemoteEye Production Deployment Script
# This script helps deploy the server and dashboard to Render.com

set -e  # Exit on error

echo "🚀 RemoteEye Production Deployment"
echo "===================================="
echo ""

# Check if Render CLI is installed
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI not found!"
    echo "Install it with: brew install render"
    exit 1
fi

# Check if logged in to Render
echo "Checking Render login status..."
if ! render whoami &> /dev/null; then
    echo "❌ Not logged in to Render!"
    echo "Please run: render login"
    exit 1
fi

echo "✅ Logged in to Render as: $(render whoami)"
echo ""

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Warning: You have uncommitted changes!"
    echo ""
    git status -s
    echo ""
    read -p "Do you want to commit these changes before deploying? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Please commit your changes first, then run this script again."
        exit 1
    fi
fi

echo "📋 Deployment Configuration:"
echo "  - Server: spyder-server"
echo "  - Dashboard: spyder-dashboard"
echo "  - Database: remoteeye-db (PostgreSQL)"
echo ""
echo "This will deploy using render.yaml blueprint."
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "🚀 Deploying to Render..."
echo ""

# Deploy using blueprint
render blueprint launch

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📊 Monitor your deployment:"
echo "  - Dashboard: https://dashboard.render.com"
echo "  - Server URL: https://spyder-server.onrender.com"
echo "  - Dashboard URL: https://spyder-dashboard.onrender.com"
echo ""
echo "📝 View logs:"
echo "  render logs spyder-server --tail"
echo "  render logs spyder-dashboard --tail"
echo ""
echo "⏳ Note: First deployment may take 5-10 minutes."
echo ""
