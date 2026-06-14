# System Architecture

This document describes the high-level architecture of the **inkRush** multiplayer application.

---

## 📐 High-Level Design

Communication between the frontend client and the backend server happens almost exclusively via persistent full-duplex **WebSockets**. The Gin HTTP engine is used only for initialization health checks.

```text
  [ Client (React SPA) ]
            ↕
    (WebSocket /ws)
            ↕
  [ Server (Go / Gin / Gorilla) ]
            ↓
  [ WebSocket Handler / Game Engine ]
       ↙          ↘
[ Room Store ]  [ Session Store ]
```

---

## 🧩 Architectural Components

### 1. Ingress & Transport
*   **Gorilla Upgrade Gateway:** Upgrades incoming HTTP connection requests to full-duplex WebSocket connections.
*   **JSON Envelope Multiplexer:** Demarshals frames into generic envelopes, inspects event types, and triggers target sub-handler methods.

### 2. Thread-Safe Repository Stores
*   **Session Store:** Thread-safe map tracking active player details (`nickname`, `id`, `currentRoomCode`).
*   **Room Store:** Maps room codes to their respective Game State machine data structures.
*   **Connection Store:** Associates player IDs with active raw WebSocket connection objects for targeted event broadcasting.

### 3. Game State Coordinator
*   **Active Word Select Ticker:** Spawns a 15-second background sleep routine. If the drawer fails to select a word, a random dictionary fallback is chosen.
*   **Turn Expiry Ticker:** Tracks the 80-second drawing turn window. Automatically ends the turn and transitions scoreboard states.
*   **Automatic Hint Scheduler:** Orchestrates non-blocking callbacks to reveal random word letters at the 20-second, 40-second, and 60-second markers.
*   **Drawer Exit Remediator:** Intercepts drawer disconnections, recalculates turn queues to prevent skipping players, and transitions turns immediately.