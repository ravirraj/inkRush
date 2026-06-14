# inkRush Client Application

The frontend client of **inkRush** is an interactive Single Page Application (SPA) built using React, Vite, HTML5 Canvas, and standard CSS. It implements a retro-futuristic theme styled with glowing neon borders, glitch logo effects, CRT scanline overlays, and monospace fonts.

---

## 🎨 Design System: Retro-Futurism

The visual theme is defined in [DESIGN.md](file:///home/yami/Code/Projects/inkRush/DESIGN.md) and implemented in [index.css](file:///home/yami/Code/Projects/inkRush/client/src/index.css). 

### CSS Variables Style Guide
```css
:root {
  --neon-blue: #0080ff;        /* Accent highlight, cards border */
  --hot-pink: #ff006e;         /* Primary buttons and logo */
  --cyan: #00ffff;             /* Active status, hints, titles */
  --deep-black: #0b0b16;       /* Primary canvas background */
  --surface-purple: #1a1a2e;   /* Cards surface area */
  --font-mono: 'Share Tech Mono', monospace;
}
```

### Visual Effects
*   **CRT Scanline overlay:** Appends a fine linear gradient overlay to the page body via `body::after` to replicate old scanline terminals.
*   **Glitch text animation:** Applied to headings to flicker and skew text randomly.

---

## 📐 Normalized Canvas Drawing System

To support canvas synchronization across devices with different screen widths, coordinates are converted into percentages of the client's screen size before transmission:

1.  **Normalization on Broadcast:**
    When drawing, mouse coordinates `x` and `y` are divided by the canvas element's client dimensions:
    $$\text{normalizedX} = \frac{\text{clientX} - \text{rect.left}}{\text{rect.width}}$$
    $$\text{normalizedY} = \frac{\text{clientY} - \text{rect.top}}{\text{rect.height}}$$
2.  **Re-Scaling on Receive:**
    When a stroke is received from another user, the normalized numbers are multiplied by the local canvas width and height:
    $$\text{localX} = \text{normalizedX} \times \text{canvas.width}$$
    $$\text{localY} = \text{normalizedY} \times \text{canvas.height}$$

This ensures that the draw coordinates map correctly regardless of the window dimension or client viewport.

---

## 📂 Code Directories

*   **`src/App.jsx`:** Main controller. Manages state for session authorization, room details, chat history, scoreboard, and updates game loops.
*   **`src/components/HomeScreen.jsx`:** The login and invitation gateway. Intercepts invite query parameters `?room=XXXXXX` and prompts join actions.
*   **`src/components/Lobby.jsx`:** Standby screen mapping connected players and generating copy-pasteable invite URLs.
*   **`src/components/GameScreen.jsx`:** The core interface. Manages HTML5 Canvas context, toolbars (color picker, brush sizes, undo history buffers, eraser modes), chat guess inputs, and turn summaries.
*   **`src/services/websocket.js`:** Pure ES6 class abstraction wrapping standard browser WebSocket interactions.
*   **`src/hooks/useWebSocket.js`:** React lifecycle hook providing reactive states for connection changes and centralized event distribution.

---

## ⚙️ Environment Configuration

Set the backend WebSocket server URL inside `.env`:

```env
VITE_WS_URL=ws://localhost:8080/ws
```
