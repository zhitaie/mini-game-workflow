declare module 'node:fs' {
  export function mkdirSync(
    path: string,
    options?: {
      recursive?: boolean;
    }
  ): void;
}

declare module 'node:http' {
  export interface IncomingMessage extends AsyncIterable<unknown> {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  }

  export interface ServerResponse {
    setHeader(name: string, value: string): void;
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(body?: string | Uint8Array): void;
  }

  export interface AddressInfo {
    address: string;
    port: number;
  }

  export interface Server {
    listen(port?: number, hostname?: string, listeningListener?: () => void): void;
    close(callback?: (error?: Error) => void): void;
    address(): AddressInfo | null;
  }

  export function createServer(
    requestListener: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  ): Server;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:sqlite' {
  export interface RunResult {
    lastInsertRowid: number | bigint;
    changes: number;
  }

  export interface StatementSync {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exitCode?: number;
};
