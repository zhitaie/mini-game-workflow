import { createApp } from './app';

export function startServer(): { name: string } {
  return createApp();
}

