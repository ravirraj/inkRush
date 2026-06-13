
---

# 4. docs/frontend-structure.md

```md
# Frontend Structure

src
├── App.jsx
├── main.jsx
├── index.css
│
├── components
│   ├── HomeScreen.jsx
│   ├── Lobby.jsx
│   └── GameScreen.jsx
│
├── hooks
│   ├── useWebSocket.js
│   ├── useRoom.js
│   └── useGame.js
│
├── services
│   └── websocket.js
│
└── utils

---

## Responsibilities

### App.jsx

Root application state.

### HomeScreen

Create and join rooms.

### Lobby

Display connected players.

### GameScreen

Main gameplay UI.

Contains:

- Drawing canvas
- Chat
- Scoreboard
- Word display
- Toolbar