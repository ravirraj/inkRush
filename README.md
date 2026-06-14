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

## 📊 UML Architecture & Sequence Diagrams

To visualize how the client and server communicate under the hood, these UML diagrams outline the messaging protocol, game loops, and reconnection flows.

### 1. Connection, Game Loop, & Reconnect Lifecycle

This sequence diagram illustrates a standard lifecycle from two players joining, launching a game, broadcasting real-time drawings, submitting guesses, and performing a page-refresh reconnection.

![Sequence Diagram](./docs/diagram/sequence_diagram.png)

<details>
<summary>💻 View Mermaid Source Code</summary>

```mermaid
sequenceDiagram
    autonumber
    actor Player A (Host)
    actor Player B
    participant Server (Go / Gin Engine)

    Note over Player A, Server: Session Initialization
    Player A->>Server: HTTP GET /ws (WebSocket Handshake)
    Server-->>Player A: WebSocket Established
    Player A->>Server: "session:init" { nickname: "CyberPainter" }
    Server-->>Player A: "session:ready" { playerID: "A_SECURE_TOKEN", nickname: "CyberPainter" }
    Player A->>Server: "room:create" { playerID: "A_SECURE_TOKEN" }
    Server-->>Player A: "room:ready" { code: "X8Y2ZP", hostPlayerID: "A_SECURE_TOKEN", players: [...] }

    Note over Player B, Server: Player B Joins Room
    Player B->>Server: HTTP GET /ws (WebSocket Handshake)
    Server-->>Player B: WebSocket Established
    Player B->>Server: "session:init" { nickname: "PixelArtist" }
    Server-->>Player B: "session:ready" { playerID: "B_SECURE_TOKEN", nickname: "PixelArtist" }
    Player B->>Server: "room:join" { code: "X8Y2ZP", playerID: "B_SECURE_TOKEN" }
    Server-->>Player A: "room:ready" (Updated lobby players list)
    Server-->>Player B: "room:ready" (Updated lobby players list)

    Note over Player A, Server: Game Initialization & Turn Lifecycle
    Player A->>Server: "game:start" { playerID: "A_SECURE_TOKEN" }
    Server-->>Player A: "word:options" (List of three random choice words)
    Player A->>Server: "word:select" { word: "Sun", playerID: "A_SECURE_TOKEN" }
    Server-->>Player A: "turn:started" { currentDrawerPlayerId: "A_SECURE_TOKEN", word: "Sun", maskedWord: "S,U,N" }
    Server-->>Player B: "turn:started" { currentDrawerPlayerId: "A_SECURE_TOKEN", word: "", maskedWord: "_,_,_," }

    Note over Player A, Player B: Real-Time Canvas Stroke Synchronization
    Player A->>Server: "draw:stroke" { prevX: 0.45, prevY: 0.12, currentX: 0.46, currentY: 0.13, color: "#ff006e", ... }
    Server-->>Player B: "draw:stroke" (Forwarded drawing vectors)

    Note over Player B, Server: Guessing & Round End
    Player B->>Server: "guess:submit" { word: "Sun", playerID: "B_SECURE_TOKEN" }
    Server-->>Server: Validate Guess (Matches "Sun" case-insensitive)
    Server-->>Player A: "guess:result" { isCorrect: true, nickname: "PixelArtist", pointsAwarded: 92 }
    Server-->>Player B: "guess:result" { isCorrect: true, nickname: "PixelArtist", pointsAwarded: 92 }

    Note over Player B, Server: Tab Refresh / Reconnection Handshake
    Player B->>Player B: User refreshes browser window (State stored in sessionStorage)
    Player B->>Server: HTTP GET /ws (New connection)
    Server-->>Player B: WebSocket Established
    Player B->>Server: "session:reconnect" { playerID: "B_SECURE_TOKEN", nickname: "PixelArtist", code: "X8Y2ZP" }
    Server-->>Player B: "room:ready" (Restores player session)
    Server-->>Player B: "turn:started" (Restores current game state, scores, and active canvas)
    Server-->>Player A: "chat:message" (System broadcast: "PixelArtist reconnected to the lobby")
```
</details>

### 2. Game Phase State Machine

Rooms transition through specific game phases on the backend server. These are communicated to clients via WebSocket state updates.

![State Diagram](./docs/diagram/state_diagram.png)

<details>
<summary>💻 View Mermaid Source Code</summary>

```mermaid
stateDiagram-v2
    [*] --> Lobby : room:create / room:join
    Lobby --> WordSelection : game:start (Host triggers)
    WordSelection --> DrawingPhase : word:select (Drawer choice) / 15s Timeout
    DrawingPhase --> TurnTransition : 80s Timer Expiry / All Players Guessed Correctly
    TurnTransition --> WordSelection : Next Drawer in list (Rounds <= MaxRounds)
    TurnTransition --> GameFinished : Game rounds complete (Rounds > MaxRounds)
    GameFinished --> Lobby : game:reset (Host restarts)
    GameFinished --> [*] : All players leave (Room Garbage Collected)
```
</details>

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