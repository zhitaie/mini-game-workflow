import type { NetworkContext, NetworkRequestOptions } from '@mini-game-workflow/game-core-types';

export class NetworkBusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly data: unknown
  ) {
    super(message);
  }
}

export interface NetworkManager {
  init(context: NetworkContext): void;
  request<TData>(options: NetworkRequestOptions): Promise<TData>;
}

