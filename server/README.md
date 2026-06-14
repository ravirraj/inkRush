# inkRush Backend Server

The backend of **inkRush** is written in Go (Golang) and operates as a real-time event distribution and state synchronization server. It upgrades client connections to WebSockets and routes messages using JSON envelopes.

---

## 📡 WebSocket Event Catalog

Every socket transmission follows a framed JSON structure containing a `type` routing string and a dynamic `payload`:

```json
{
  "type": "session:init",
  "payload": {
    "nickname": "CyberPainter"
  }
}
```

### Protocol Mappings

#### 1. Setup & Ingress
*   `session:init` $\rightarrow$ `session:ready`: Registers nickname and generates a cryptographically secure token ID.
*   `room:create` $\rightarrow$ `room:ready`: Creates a 6-character room code and registers the player as Host.
*   `room:join` $\rightarrow$ `room:ready`: Adds player to room and broadcasts updated room player lists.

#### 2. Game Loops
*   `game:start` $\rightarrow$ `game:started`: Shuffles player orders and initiates the first round.
*   `word:select` $\rightarrow$ `turn:started`: Drawer selects drawing keyword. Guessers receive a masked representation (e.g., `_ , _ , _ , `).
*   `guess:submit` $\rightarrow$ `guess:result`: Validates guess. Correct match awards points and notifies the room.
*   `hint:reveal`: Automatically broadcasts partially revealed characters to guessers at 20s, 40s, and 60s.
*   `turn:ended`: Broadcasts scoreboard at the end of the turn timer.
*   `game:ended`: Triggered after round limit matches. Computes final winners.
*   `game:reset`: Reverts room back to Lobby state.

#### 3. Real-time Drawing Sync
*   `draw:stroke`: Transmits coordinate segments (`prevX`, `prevY`, `currentX`, `currentY`), brush thickness, color, and eraser flag.
*   `draw:clear`: Clears drawing canvas for all users in the room.

---

## 📂 Backend Project Structure

```text
server/
├── cmd/
│   └── api/                # main.go entry point (spawns App)
└── internal/
    ├── app/                # app.go (Gin init), router.go (HTTP routes)
    ├── domain/             # Game, Player, Room entities
    ├── pkg/
    │   ├── RandomID/       # 6-character room code generator
    │   └── words/          # Noun list, masking, and hint compilers
    ├── store/memory/       # Safe thread-safe maps repositories
    └── transport/websoc/
        ├── handler/        # ws_handler.go (Core Game Engine)
        └── protocol/       # JSON payloads, event const mappings
```

---

## 🔒 Thread Safety & Concurrency

Since the server stores player sessions and rooms entirely in-memory, concurrent socket read/write loops can trigger race conditions. To prevent this:
*   Repositories inside `internal/store/memory` (`session_store.go`, `room_store.go`, `connection_store.go`) wrap standard Go maps inside `sync.Mutex` locks.
*   Operations like adding, fetching, or removing players lock read and write threads safely:
    ```go
    func (c *ConnStore) Add(playerID string, conn *websocket.Conn) {
        c.mu.Lock()
        c.conn[playerID] = conn
        c.mu.Unlock()
    }
    ```

---

## ⚡ Rate Limiting

To prevent socket spam or connection exhaustion (DoS), the WebSocket loop tracks message frequency. If a single client submits more than 25 events within a 2-second sliding window, the server flags the packet and pushes an error alert (`system:error`) back to the client.
