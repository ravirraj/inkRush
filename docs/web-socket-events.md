# WebSocket Events

## Session

### session:init

Client → Server

```json
{
  "type": "session:init",
  "payload": {
    "nickname": "raviraj"
  }
}

{
  "type": "session:ready",
  "payload": {
    "playerId": "player-id"
  }
}