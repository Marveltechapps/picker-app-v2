/**
 * WebSocket service for Picker app - real-time status updates.
 * Connects to backend Socket.IO at /hhd-socket.io.
 * Gracefully handles connection failures with throttled logging.
 */

import { io, Socket } from "socket.io-client";
import { getAuthToken } from "@/utils/apiClient";
import { getBackendOrigin } from "@/utils/backendUrl";

const CONNECT_ERROR_LOG_INTERVAL_MS = 30000; // Log at most once per 30s to avoid spam

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private lastConnectErrorLog = 0;

  connect() {
    getAuthToken().then((token) => {
      if (!token) return;

      // Already connected
      if (this.socket?.connected) return;

      // Reuse existing socket: trigger reconnect if needed
      if (this.socket) {
        this.socket.connect();
        return;
      }

      const origin = getBackendOrigin();
      this.socket = io(origin, {
        path: "/hhd-socket.io",
        auth: { token },
        transports: ["polling", "websocket"], // Polling first, then upgrade
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 5000,
        reconnectionDelayMax: 15000,
        timeout: 10000,
      });

      this.socket.on("connect", () => {
        this.lastConnectErrorLog = 0; // Reset on success
        if (__DEV__) console.log("[Picker WebSocket] Connected");
      });

      this.socket.on("disconnect", (reason) => {
        if (__DEV__) console.log("[Picker WebSocket] Disconnected:", reason);
      });

      this.socket.on("connect_error", (err) => {
        if (__DEV__) {
          const now = Date.now();
          if (now - this.lastConnectErrorLog >= CONNECT_ERROR_LOG_INTERVAL_MS) {
            this.lastConnectErrorLog = now;
            console.warn("[Picker WebSocket] Connection error:", err.message);
          }
        }
      });

      this.socket.on("reconnect_failed", () => {
        if (__DEV__) {
          const now = Date.now();
          if (now - this.lastConnectErrorLog >= CONNECT_ERROR_LOG_INTERVAL_MS) {
            this.lastConnectErrorLog = now;
            console.warn("[Picker WebSocket] Reconnection failed after max attempts");
          }
        }
      });

      this.reattachListeners();
    });
  }

  private reattachListeners() {
    if (!this.socket) return;
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => this.socket!.on(event, cb));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  on(event: string, callback: (data: unknown) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (data: unknown) => void) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    } else {
      this.listeners.get(event)?.clear();
      this.socket?.off(event);
    }
  }
}

export const pickerWebSocketService = new WebSocketService();
