#!/bin/bash
# Docker execution script for running seed files
# Place this file in the same directory as your seed files

echo "🚀 Starting comprehensive auction seed in Docker..."

# Run the comprehensive seed first
echo "📦 Running comprehensive seed..."
docker exec -it auction-hub-server-1 node prisma/comprehensive-seed.js

if [ $? -eq 0 ]; then
    echo "✅ Comprehensive seed completed successfully!"
    
    # Ask if user wants to run extended scenarios
    echo ""
    echo "Do you want to run extended scenarios seed as well? (y/n)"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "📧 Running extended scenarios seed..."
        docker exec -it auction-hub-server-1 node prisma/extended-scenarios-seed.js
        
        if [ $? -eq 0 ]; then
            echo "✅ All seeds completed successfully!"
            echo ""
            echo "🎯 Your database now contains:"
            echo "   • 6 users with different roles"
            echo "   • 9 auctions in various states"
            echo "   • Complete bidding history"
            echo "   • Email notification scenarios"
            echo "   • Edge case test data"
            echo ""
            echo "📧 Ready to test the complete auction flow!"
        else
            echo "❌ Extended scenarios seed failed"
        fi
    else
        echo "ℹ️ Skipped extended scenarios. You can run it later with:"
        echo "   docker exec -it auction-hub-server-1 node prisma/extended-scenarios-seed.js"
    fi
else
    echo "❌ Comprehensive seed failed"
    exit 1
fi