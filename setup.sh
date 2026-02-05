#!/bin/bash
set -e

echo "🚀 Setting up Humans Marketplace..."

# Check for required tools
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
cd docker
docker compose up -d
cd ..

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Generate Prisma client and run migrations
echo "🗄️ Setting up database..."
npx prisma generate
npx prisma migrate dev --name init

# Seed the database
echo "🌱 Seeding database..."
npm run db:seed
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install MCP server dependencies
echo "📦 Installing MCP server dependencies..."
cd mcp-server
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the development servers, run:"
echo "  Backend:  cd backend && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "API will be available at http://localhost:3001"
echo "Frontend will be available at http://localhost:3000"
echo ""
echo "Test accounts (password: password123):"
echo "  - alice@example.com"
echo "  - bob@example.com"
echo "  - carol@example.com"
