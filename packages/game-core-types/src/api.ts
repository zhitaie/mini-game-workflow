export interface ApiResponse<TData> {
  success: boolean;
  code: string;
  message: string;
  data: TData;
}

