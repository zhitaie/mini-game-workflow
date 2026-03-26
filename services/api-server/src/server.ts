import { createServer } from 'node:http';
import { createApp, type ApiApp, type CreateAppOptions } from './app.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;

export interface StartServerOptions extends CreateAppOptions {
  host?: string;
  port?: number;
}

export interface RunningServer {
  app: ApiApp;
  host: string;
  port: number;
  url: string;
  databaseFilePath: string;
  close(): Promise<void>;
}

function buildCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

function normalizeHeaders(headers: Record<string, string | string[] | undefined>): string[][] {
  const normalized: string[][] = [];

  Object.entries(headers).forEach(([key, value]) => {
    if (typeof value === 'string') {
      normalized.push([key, value]);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        normalized.push([key, item]);
      });
    }
  });

  return normalized;
}

async function readRequestBody(request: AsyncIterable<unknown>): Promise<string | undefined> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
      continue;
    }

    chunks.push(new TextEncoder().encode(String(chunk)));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return new TextDecoder().decode(merged);
}

function resolveRequestUrl(rawUrl: string | undefined, headers: Record<string, string | string[] | undefined>, host: string): string {
  const headerHost = typeof headers.host === 'string' ? headers.host : host;
  return new URL(rawUrl ?? '/', `http://${headerHost}`).toString();
}

export async function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  const app = createApp(options);
  const host = options.host ?? DEFAULT_HOST;
  const requestedPort = options.port ?? DEFAULT_PORT;
  const corsHeaders = buildCorsHeaders();

  const httpServer = createServer(async (request, response) => {
    try {
      if ((request.method ?? 'GET') === 'OPTIONS') {
        response.writeHead(204, corsHeaders);
        response.end();
        return;
      }

      if ((request.url ?? '/') === '/health') {
        response.writeHead(200, {
          ...corsHeaders,
          'Content-Type': 'application/json'
        });
        response.end(
          JSON.stringify({
            ok: true,
            name: app.name,
            databaseFilePath: app.databaseFilePath
          })
        );
        return;
      }

      const body = await readRequestBody(request);
      const fetchResponse = await app.fetch(resolveRequestUrl(request.url, request.headers, host), {
        method: request.method,
        headers: normalizeHeaders(request.headers),
        body
      });

      const headers: Record<string, string> = {
        ...corsHeaders
      };
      fetchResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });

      response.writeHead(fetchResponse.status, headers);
      const payload = new Uint8Array(await fetchResponse.arrayBuffer());
      response.end(payload);
    } catch (error) {
      response.writeHead(500, {
        ...corsHeaders,
        'Content-Type': 'application/json'
      });
      response.end(
        JSON.stringify({
          success: false,
          code: 'HTTP_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'http server error',
          data: null
        })
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    try {
      httpServer.listen(requestedPort, host, resolve);
    } catch (error) {
      reject(error);
    }
  });

  const actualPort = httpServer.address()?.port ?? requestedPort;

  return {
    app,
    host,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    databaseFilePath: app.databaseFilePath,
    async close(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      app.close();
    }
  };
}
