# Frontend Project Layout

The client-side React code compiles into a Single Page Application (SPA). Below is the layout guide.

---

## 📂 Layout Diagram

```text
client/
└── src/
    ├── App.jsx             # Root controller. Manages state, updates data.
    ├── main.jsx            # Mounting index point.
    ├── index.css           # Styling theme (retro neon, animations).
    ├── components/
    │   ├── HomeScreen.jsx  # Landing entry. Handles nick inputs and code checks.
    │   ├── Lobby.jsx       # Player standby lobby.
    │   └── GameScreen.jsx  # Interactive canvas UI and guess controls.
    ├── hooks/
    │   └── useWebSocket.js # React custom hook wrapping socket interactions.
    └── services/
        └── websocket.js    # Core WebSocket Service class helper.
```

---

## 🎨 Layout Roles

### 1. Networking Layer
*   **`services/websocket.js`:** Pure Javascript class encapsulation. Manages standard websocket interactions, connections, close conditions, and message delivery.
*   **`hooks/useWebSocket.js`:** React lifecycle integration. Hooks socket instances to functional rendering loops, providing connection status states and an event submission function (`sendEvent`).

### 2. State & UI Layout
*   **`App.jsx`:** Manages global state variables (chat history, player profile IDs, scoreboard structures) and updates UI screens dynamically.
*   **`GameScreen.jsx`:** Encapsulates HTML5 Canvas interaction logic. Binds touch and mouse inputs, converts coordinates into normalized values before broadcasting, and handles drawing toolbars (brush size, color pickers, and local undo queues).