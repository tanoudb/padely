export class HttpError extends Error {
  constructor(statusCode, message, publicMessage) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.publicMessage = publicMessage ?? message;
  }
}

export async function readJson(req, { maxBytes = 64 * 1024 } = {}) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw new HttpError(413, 'Request body too large', 'Payload too large');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}
