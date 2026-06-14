# Backend Project Layout

The Go server codebase is structured inside nested packages. Below is a layout guide of directories and files.

---

## 📂 Layout Diagram

```text
server/
├── cmd/
│   └── api/
│       └── main.go          # Entry point. Spawns App, runs Go program.
└── internal/
    ├── app/
    │   ├── app.go          # Setups ports, loads Gin engine.
    │   └── router.go       # Registers /ws and /health HTTP routes.
    ├── domain/
    │   ├── game/
    │   │   └── game.go     # GameStruct definition (scores, rounds, timers).
    │   ├── player/
    │   │   └── player.go   # Player model definition (nicknames, rooms).
    │   └── room/
    │   │   └── room.go     # Room structure wrapper.
    │   └── session/        # (Obsolete - consolidated into store)
    ├── pkg/
    │   ├── RandomID/
    │   │   └── randomIDGen.go # Generates random 6-character room codes.
    │   └── words/
    │       └── words.go    # Vocabulary, character masking, and hints compiler.
    ├── store/memory/
    │   ├── room_store.go      # Thread-safe repository map for rooms.
    │   ├── session_store.go   # Thread-safe repository map for session players.
    │   └── connection_store.go # Thread-safe repository map for sockets.
    └── transport/websoc/
        ├── handler/
        │   └── ws_handler.go  # CORE Engine. Controls game loops & messaging.
        └── protocol/
            ├── envelope.go    # Outer frame structure.
            ├── events.go      # Constants mapping routing event strings.
            └── payload.go     # Structured JSON payloads.
```

---

## 🎯 Component Responsibilities

*   **`ws_handler.go`:** Acts as the primary application coordinator. Handles connection upgrades, parses incoming events, checks business validation rules, runs background timer routines, and handles client disconnections.
*   **`store/memory`:** Exposes a thread-safe data layer. They protect underlying Go map structures from concurrent read/write panics using `sync.Mutex`.
*   **`pkg/words`:** Implements character masking and indexing logic to ensure guessers cannot view drawing words while giving hints periodically.