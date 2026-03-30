#!/bin/bash
set -e

echo "=== SimPPL Dashboard Setup ==="

# Backend setup
echo "Setting up Python backend..."
cd backend
python3 -m pip install -r requirements.txt
cd ..

# Frontend setup
echo "Setting up frontend..."
cd frontend
npm install
echo "Building frontend..."
npm run build
cd ..

# Run tests
echo "Running backend tests..."
cd backend
python3 -m pytest tests/ -v --tb=short
cd ..

echo "=== Starting server ==="
echo "Dashboard will be at: http://localhost:8000"
echo "API docs at: http://localhost:8000/docs"
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
