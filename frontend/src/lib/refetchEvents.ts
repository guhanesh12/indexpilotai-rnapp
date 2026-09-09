type EventName = 'wallet:refresh' | 'autoSymbols:refresh' | 'trailing:refresh' | 'profile:refresh';
type Listener = (data?: any) => void;

const listeners: Record<string, Listener[]> = {};

export function onRefetch(event: EventName, listener: Listener): () => void {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(listener);

  // Return an unsubscribe function
  return () => {
    listeners[event] = listeners[event].filter(l => l !== listener);
  };
}

export function emitRefetch(event: EventName, data?: any): void {
  if (listeners[event]) {
    listeners[event].forEach(listener => listener(data));
  }
}