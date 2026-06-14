export class WebSocketService {
  constructor(url, onMessage, onClose, onError, onOpen) {
    this.url = url;
    this.onMessageCallback = onMessage;
    this.onCloseCallback = onClose;
    this.onErrorCallback = onError;
    this.onOpenCallback = onOpen;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = (e) => {
      if (this.onOpenCallback) {
        this.onOpenCallback(e);
      }
    };
    this.ws.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        this.onMessageCallback(parsed);
      } catch (err) {
        console.error("Failed to parse websocket message", err, e.data);
      }
    };
    this.ws.onclose = (e) => {
      this.onCloseCallback(e);
    };
    this.ws.onerror = (e) => {
      this.onErrorCallback(e);
    };
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn("WebSocket is not open. State:", this.ws ? this.ws.readyState : "null");
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
