#!/bin/bash

# Production deployment script for ride-app backend

echo "🚀 Starting production deployment..."

# Build the application
echo "📦 Building TypeScript..."
npm run build

# Check if build succeeded
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Start the application
echo "🏃 Starting server..."
npm start