export function connectSSE(onEvent: (e: MessageEvent) => void) {
  const ev = new EventSource("/api/events");
  ev.onmessage = onEvent;
  ev.onerror = () => {
    // EventSource já tenta reconectar automaticamente
  };
  return () => ev.close();
}
