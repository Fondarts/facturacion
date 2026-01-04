#!/bin/bash

echo "========================================"
echo "  Iniciando Proyecto de Facturacion"
echo "========================================"
echo ""

echo "[1/2] Iniciando Backend (Node.js)..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

sleep 3

echo "[2/2] Iniciando Frontend (React)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "  Servicios iniciados!"
echo "========================================"
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "  PIDs: Backend=$BACKEND_PID, Frontend=$FRONTEND_PID"
echo "  Para detener: kill $BACKEND_PID $FRONTEND_PID"
echo ""

wait

