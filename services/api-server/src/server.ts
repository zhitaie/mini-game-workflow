import { createApp } from './app.js';

export function startServer(): { name: string } {
  return createApp();
}
