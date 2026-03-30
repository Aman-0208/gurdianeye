# GuardianEye 👁 — AI-Powered Monitoring System

A full-stack AI surveillance platform using MERN + Python (YOLOv8).

## Architecture
```
Browser (React) ←→ Node.js/Express + Socket.io ←→ Python Flask AI
                              ↓
                        MongoDB (local)
```

## Prerequisites
- **Node.js** 18+ · [nodejs.org](https://nodejs.org)
- **Python** 3.9+ · [python.org](https://python.org)
- **MongoDB** Community · [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)

---

## Quick Start (Windows)

```powershell
# From the guardianeye\ directory:
.\start.ps1
```

This starts all three services automatically.

---

## Manual Setup

### 1. MongoDB
```powershell
# Start MongoDB service (run as Administrator if needed)
net start MongoDB
```

### 2. Python AI Service
```powershell
cd ai_service
pip install -r requirements.txt
python app.py
# → Starts on http://localhost:5001
# → Downloads yolov8n.pt (~6MB) on first run
```

### 3. Node.js Server
```powershell
cd server
npm install
npm run dev
# → Starts on http://localhost:4000
```

### 4. React Client
```powershell
cd client
npm install
npm run dev
# → Opens on http://localhost:5173
```

---

## Input Modes

| Mode | Description | AI Analysis |
|---|---|---|
| 📹 **Live Cam** | Browser webcam via getUserMedia | ✅ Yes |
| 📁 **Upload** | Video file (MP4/AVI/MOV, max 20 MB) | ✅ Yes |
| ▶ **YouTube** | Embed YouTube/live stream | ❌ Display only |
| 🛸 **Drone/IP** | MJPEG IP camera stream URL | ✅ Yes |

## AI Detection Methods
- **YOLOv8n** — Object detection (persons, vehicles, weapons)
- **OpenCV MOG2** — Motion anomaly detection
- **Brightness Analysis** — Overexposure / near-darkness
- **Edge Density** — Scene complexity analysis

## Ports
| Service | Port |
|---|---|
| React Frontend | 5173 |
| Node.js Backend | 4000 |
| Python AI Service | 5001 |
| MongoDB | 27017 |
