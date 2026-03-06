const NAMED_EVENTS = [
  "connected",
  "ping",
  "antenna.created",
  "antenna.updated",
  "antenna.deleted",
  "status.changed",
] as const;

function wrapEvent(event: MessageEvent, type: string) {
  let payload: unknown = event.data;

  try {
    payload = JSON.parse(event.data);
  } catch {}

  const data =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { event: type, ...(payload as Record<string, unknown>) }
      : { event: type, data: payload };

  return new MessageEvent("message", {
    data: JSON.stringify(data),
  });
}

export function connectSSE(onEvent: (e: MessageEvent) => void) {
  const source = new EventSource("/api/events");

  const listeners = NAMED_EVENTS.map((type) => {
    const listener = (event: Event) => {
      onEvent(wrapEvent(event as MessageEvent, type));
    };
    source.addEventListener(type, listener);
    return { type, listener };
  });

  source.onmessage = onEvent;
  source.onerror = () => {};

  return () => {
    for (const { type, listener } of listeners) {
      source.removeEventListener(type, listener);
    }
    source.close();
  };
}
