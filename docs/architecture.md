
---

# 2. docs/architecture.md

```md
# Architecture

## High Level Design

Frontend communicates with backend exclusively through WebSockets.

Client
↓
WebSocket
↓
Server
↓
Game Engine
↓
Room Store
↓
Session Store

---

## Components

### Session Manager

Responsible for:

- Player creation
- Session tracking
- Connection tracking

### Room Manager

Responsible for:

- Room creation
- Room joining
- Room lifecycle

### Game Engine

Responsible for:

- Turn management
- Word selection
- Score calculation
- Hint generation
- Game completion

---

## Data Flow

session:init
→ room:create / room:join
→ game:start
→ word:select
→ turn:start
→ draw events
→ guess events
→ turn:end
→ game:end