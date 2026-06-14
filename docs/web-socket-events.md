# WebSocket JSON Events Catalog

All socket messaging is framed inside a common envelope containing `type` and `payload` properties:

```json
{
  "type": "event:name",
  "payload": { ... }
}
```

---

## 📥 Client to Server Events

### `session:init`
Registers a player profile.
```json
{
  "nickname": "CyberPainter"
}
```

### `room:create`
Generates a new room lobby.
```json
{
  "playerID": "CyberPainter_1a2b3c"
}
```

### `room:join`
Joins an existing room.
```json
{
  "code": "X8Y2ZP",
  "playerID": "CyberPainter_1a2b3c"
}
```

### `game:start`
Initiates active gameplay rounds (Host only).
```json
{
  "playerId": "CyberPainter_1a2b3c"
}
```

### `word:select`
Selects the drawing keyword (Active Drawer only).
```json
{
  "playerId": "CyberPainter_1a2b3c",
  "word": "Sun"
}
```

### `draw:stroke`
Broadcasts real-time mouse/touch line coordinates.
```json
{
  "playerId": "CyberPainter_1a2b3c",
  "prevX": 0.452,
  "prevY": 0.128,
  "currentX": 0.461,
  "currentY": 0.134,
  "color": "#ff006e",
  "lineWidth": 6,
  "isEraser": false
}
```

---

## 📤 Server to Client Events

### `session:ready`
Confirms session validation.
```json
{
  "nickname": "CyberPainter",
  "playerId": "CyberPainter_1a2b3c"
}
```

### `room:ready`
Pushes lobby list changes.
```json
{
  "code": "X8Y2ZP",
  "hostPlayerID": "CyberPainter_1a2b3c",
  "players": [
    { "nickname": "CyberPainter", "playerId": "CyberPainter_1a2b3c" }
  ]
}
```

### `turn:started`
Initiates a new drawing turn.
```json
{
  "code": "X8Y2ZP",
  "currentRound": 1,
  "currentDrawerPlayerId": "CyberPainter_1a2b3c",
  "status": "in_progress",
  "word": "Sun",
  "maskedWord": "_,_,_,"
}
```

### `guess:result`
Broadcasts guess results and updated scores.
```json
{
  "playerId": "GuessUser_4d5e6f",
  "isCorrect": true,
  "nickname": "GuessUser",
  "pointsAwarded": 92,
  "drawerPoints": 20,
  "score": {
    "CyberPainter_1a2b3c": 20,
    "GuessUser_4d5e6f": 92
  },
  "correctWord": "Sun"
}
```

### `hint:reveal`
Partially reveals drawing characters to guessers.
```json
{
  "maskedWord": "S,_,_,"
}
```