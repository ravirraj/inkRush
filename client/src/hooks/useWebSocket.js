import { useEffect, useRef, useState } from "react";
import { WebSocketService } from "../services/websocket";

export function useWebSocket(url, onEventReceived) {
  const serviceRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [ws, setWs] = useState(null);

  const callbackRef = useRef(onEventReceived);
  useEffect(() => {
    callbackRef.current = onEventReceived;
  }, [onEventReceived]);

  useEffect(() => {
    if (!url) return;

    const service = new WebSocketService(
      url,
      (event) => {
        if (callbackRef.current) {
          callbackRef.current(event);
        }
      },
      () => {
        console.log("WebSocket connection closed");
        setIsConnected(false);
        setIsOpen(false);
        setWs(null);
      },
      (err) => {
        console.error("WebSocket connection error occurred");
        setIsConnected(false);
        setIsOpen(false);
        setWs(null);
      },
      () => {
        console.log("WebSocket opened successfully");
        setIsOpen(true);
      }
    );

    serviceRef.current = service;
    setIsConnected(true);
    setWs(service.ws);

    return () => {
      service.close();
    };
  }, [url]);

  const sendEvent = (type, payload = {}) => {
    if (serviceRef.current) {
      serviceRef.current.send(type, payload);
    }
  };

  return { sendEvent, isConnected, isOpen, ws };
}
