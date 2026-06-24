export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  timestamp: string;
}
