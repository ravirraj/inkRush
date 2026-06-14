# System Architecture Diagrams

This directory holds references to inkRush system architecture designs.

---

## 🎨 Editorial System Architecture Diagram

Below is a pictorial view of the inkRush client-server design, covering the frontend components, connection protocols, and server stores:

![inkRush System Architecture](./system_architecture.png)

---

## 📐 Unified Flow & Component Layout (Mermaid)

```mermaid
graph TB
    subgraph Client ["Client (React UI)"]
        UI[React UI Components]
        Canvas[Canvas Canvas Drawing Context]
        Hooks[useWebSocket Hook]
        WSClass[WebSocket Service Instance]
        
        UI --> Canvas
        UI --> Hooks
        Hooks --> WSClass
    end

    subgraph Server ["Server (Go / Gin Engine)"]
        GinRouter[Gin Routing / HTTP Engine]
        WSHandler[WebSocket Events Handler]
        
        subgraph Session_Lobby ["Repository Store Layer"]
            SessionStore[Session Store]
            RoomStore[Room Store]
            ConnStore[Connection Store]
        end
        
        GinRouter --> WSHandler
        WSHandler --> SessionStore
        WSHandler --> RoomStore
        WSHandler --> ConnStore
    end

    WSClass -- "WS /ws Protocol (JSON)" --> GinRouter
```

