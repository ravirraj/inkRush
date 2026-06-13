# Backend Structure

server

├── cmd
│   └── api
│
├── internal
│   ├── game
│   ├── room
│   ├── session
│   ├── player
│   ├── websocket
│   └── store
│
├── pkg
│
└── main.go

---

## Game Domain

Responsible for:

- Turns
- Scoring
- Hints
- Word selection

---

## Room Domain

Responsible for:

- Room lifecycle
- Player management

---

## Session Domain

Responsible for:

- Connection tracking
- Session management