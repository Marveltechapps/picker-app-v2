type SessionInvalidatedHandler = () => void;

let onSessionInvalidated: SessionInvalidatedHandler | null = null;

export function setSessionInvalidationHandler(handler: SessionInvalidatedHandler | null) {
  onSessionInvalidated = handler;
}

export function notifySessionInvalidated() {
  try {
    onSessionInvalidated?.();
  } catch {
    // Avoid breaking fetch pipeline
  }
}
