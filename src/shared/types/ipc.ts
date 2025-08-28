/**
 * IPC Communication Types
 * Shared interfaces for communication between main and renderer processes
 */

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}