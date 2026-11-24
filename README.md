# Simple MERN + Socket.io Chat App

Basic real-time 1-to-1 chat app built with **React**, **Express**, **Socket.io**, and **MongoDB** — ready to run locally and deploy on **Railway**.

## Features
- Simple **Register / Login** (username + password, hashed with `bcryptjs` + JWT)
- Real-time messaging using **Socket.io**
- Messages saved in **MongoDB** (`Mongoose`)
- Live **Online / Offline** status indicator
- Uses `sessionStorage` so you can open **two tabs in the same browser**, log in as two users, and demo chatting immediately!

## Run Locally
1. Install backend & frontend dependencies and build:
   ```bash
   npm install
   npm run build
   ```
2. Start in production mode (serves both API + React build on `http://localhost:5000`):
   ```bash
   npm start
   ```
   *(Or run backend + Vite dev server separately with `npm run dev:server` and `npm run dev:client`.)*

> Note: If you have a MongoDB Atlas URI, create a `.env` file (copy `.env.example`) and set `MONGODB_URI`. In development without local MongoDB installed, the server automatically starts an in-memory MongoDB for quick testing.

## Deploy to Railway
1. Push this folder to a **GitHub** repository:
   ```bash
   git init
   git add .
   git commit -m "Initial simple chat app"
   git branch -M main
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git push -u origin main
   ```
2. On [Railway](https://railway.app):
   - Click **New Project** -> **Deploy from GitHub repo** -> select your repo.
   - Click **+ New** -> **Database** -> **Add MongoDB** (or add your MongoDB Atlas URI as `MONGODB_URI` in Variables).
   - In your app service's **Variables** tab, add:
     - `MONGODB_URI` = `${{MongoDB.MONGO_URL}}` *(if using Railway's MongoDB service, or paste your Atlas URL)*
     - `JWT_SECRET` = any random secret string
   - Railway automatically runs `npm install && npm run build` and `npm start` (configured in `railway.json`).
   - Generate a public domain under **Settings -> Networking -> Generate Domain** and open it!
