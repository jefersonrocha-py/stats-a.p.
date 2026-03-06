import { requireRequestAuth } from "@lib/auth";
import { addClient } from "@lib/sse";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRequestAuth(req);
  if ("response" in auth) return auth.response;

  const { signal } = req;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const remove = addClient(controller);
      const encoder = new TextEncoder();

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));
        } catch {
          closed = true;
          clearInterval(heartbeat);
          remove();
          try {
            controller.close();
          } catch {}
        }
      }, 20000);

      const onAbort = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        remove();
        try {
          controller.close();
        } catch {}
      };

      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
