function parseSseChunk(buffer, onEvent) {
  let rest = buffer.replace(/\r/g, '');
  let cursor = rest.indexOf('\n\n');

  while (cursor !== -1) {
    const rawEvent = rest.slice(0, cursor);
    rest = rest.slice(cursor + 2);

    const lines = rawEvent.split('\n');
    let eventName = 'message';
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length > 0) {
      try {
        const parsed = JSON.parse(dataLines.join('\n'));
        onEvent?.({ event: eventName, data: parsed });
      } catch {
        // Ignore malformed events.
      }
    }

    cursor = rest.indexOf('\n\n');
  }

  return rest;
}

export function createLiveScoreSubscription({
  apiUrl,
  matchId,
  token,
  onEvent,
  onError,
}) {
  const controller = new AbortController();
  let pollingTimer = null;

  async function startPollingFallback() {
    const poll = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/matches/${encodeURIComponent(matchId)}/live/state`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const payload = await res.json();
        onEvent?.({ event: 'snapshot', data: payload });
      } catch (error) {
        onError?.(error);
      }
    };

    await poll();
    pollingTimer = setInterval(poll, 2000);
  }

  async function startStream() {
    try {
      const res = await fetch(`${apiUrl}/api/v1/matches/${encodeURIComponent(matchId)}/live`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.body || typeof res.body.getReader !== 'function') {
        await startPollingFallback();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseChunk(buffer, onEvent);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      await startPollingFallback();
      onError?.(error);
    }
  }

  startStream();

  return () => {
    controller.abort();
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };
}
