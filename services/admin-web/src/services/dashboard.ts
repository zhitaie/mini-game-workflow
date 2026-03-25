import type { AdminDashboardSummary } from '@mini-game-workflow/game-core-types';
import { request } from './api-client.js';

export async function fetchDashboardSummary(gameKey: string): Promise<AdminDashboardSummary> {
  const response = await request<{ summary: AdminDashboardSummary }>('/api/admin/dashboard', {
    query: {
      gameKey
    }
  });

  return response.summary;
}
