# inkRush

A real-time multiplayer drawing and guessing game inspired by Skribbl.io, designed with a retro-futuristic synthwave aesthetic.

---

## 🚀 Key Features

*   **Real-time Synced Canvas:** Instant coordinate broadcast using normalized canvas bounds to ensure consistent resolution rendering on all devices.
*   **Room-Based Multiplayer:** Instant room creation, join codes, and invite links.
*   **Live Chat & Guesses:** Dual-purpose comms panel that acts as standard chat during lobby states, and switches to correct guess filtering during turns.
*   **Automatic Game Loop:** Server-driven game phases (word selection, drawing, turn transition) managed via tick timers.
*   **Secure Session IDs:** Predictable IDs are replaced with high-entropy cryptographic strings.
*   **Robust Disconnect Logic:** Gracefully manages player departures and transitions turns instantly if the drawer leaves.
*   **Client Connection Rate Limiter:** Protects resources by dropping socket message flooding.

---

## 🛠️ Tech Stack

### Frontend
*   **React + Vite:** Single Page Application (SPA).
*   **HTML5 Canvas API:** Interactive drawer controls (color palette, brush size, eraser, undo actions).
*   **Custom Hooks & Services:** Encapsulated WebSocket management (`useWebSocket` hook + `WebSocketService`).
*   **Aesthetics:** Retro-Futuristic styling (Share Tech Mono Google font, neon glow animations, CRT scanline overlay, styling variables).

### Backend
*   **Go (Golang):** High-concurrency network runtime.
*   **Gin Gonic:** Web routing and health endpoints.
*   **Gorilla WebSocket:** Robust TCP socket upgrades and frame transmissions.
*   **Thread-Safe Memory Stores:** Concurrent repository mappings protected by `sync.Mutex`.

---

## 📂 Project Structure

```text
.
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # UI screens (HomeScreen, Lobby, GameScreen)
│   │   ├── hooks/          # React hooks (useWebSocket.js)
│   │   ├── services/       # Core services (websocket.js)
│   │   ├── index.css       # Retro-futurism theme and styles
│   │   └── App.jsx         # App state coordinator
│   └── dockerfile
├── server/                 # Go backend server
│   ├── cmd/
│   │   └── api/            # main.go entry point
│   ├── internal/
│   │   ├── app/            # App setup and routing engine
│   │   ├── domain/         # Domain models (game, room, player)
│   │   ├── pkg/            # Utility helpers (RandomID, word list/masking)
│   │   ├── store/          # Safe memory store repositories
│   │   └── transport/      # WebSocket server protocols and handler
│   └── dockerfile
├── docs/                   # Full system architecture documentation
├── docker-compose.yml      # Orchestration file
└── README.md               # Root repository guide
```

---

## ⚡ Quick Start (Docker Compose)

The entire application can be spun up locally in production-mimicked mode with a single command.

```bash
docker compose up --build
```

*   **Frontend Client:** Access at [http://localhost:5173](http://localhost:5173)
*   **Backend Server:** Available at [http://localhost:8080](http://localhost:8080) (WebSocket path: `ws://localhost:8080/ws`)

---

## 🔧 Local Development Setup

### Backend Server Setup
1. Move to the server directory:
   ```bash
   cd server
   ```
2. Build and run the server (dependencies will install automatically):
   ```bash
   go run ./cmd/api
   ```

### Frontend Client Setup
1. Move to the client directory:
   ```bash
   cd client
   ```
2. Create your local `.env` configuration file:
   ```bash
   cp .env.sample .env
   ```
3. Install dependencies and start the Vite dev server:
   ```bash
   npm install
   npm run dev
   ```