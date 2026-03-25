import type { ApiResponse } from '@mini-game-workflow/game-core-types';

export function ok<TData>(data: TData): ApiResponse<TData> {
  return {
    success: true,
    code: 'OK',
    message: '',
    data
  };
}

export function fail(code: string, message: string): ApiResponse<null> {
  return {
    success: false,
    code,
    message,
    data: null
  };
}

