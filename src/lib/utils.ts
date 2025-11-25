import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export class AppError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const measureExecutionTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
};

// Timer factory for middleware - creates a timer that can be ended later
export const createTimer = () => {
  const start = Date.now();
  return {
    end: () => Date.now() - start
  };
};

export const generateRequestId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

// API Response Helpers
export const successResponse = (data: any, requestId?: string) => {
  return {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString()
  };
};

export const errorResponse = (
  code: string,
  message: string,
  data?: any,
  field?: string,
  requestId?: string
) => {
  return {
    success: false,
    error: {
      code,
      message,
      ...(field && { field }),
      ...(data && { data })
    },
    requestId,
    timestamp: new Date().toISOString()
  };
};

export const rateLimitErrorResponse = (resetTime: number, requestId?: string) => {
  return errorResponse(
    'RATE_LIMIT_EXCEEDED',
    'Too many requests, please try again later',
    { resetTime },
    undefined,
    requestId
  );
};

export const getHttpStatusFromError = (code: string): number => {
  const statusMap: Record<string, number> = {
    'VALIDATION_ERROR': 400,
    'INVALID_ID': 400,
    'INVALID_API_URL': 400,
    'INVALID_STATUS': 400,
    'UNAUTHORIZED': 401,
    'BUYER_NOT_FOUND': 404,
    'LEAD_NOT_FOUND': 404,
    'SERVICE_NOT_FOUND': 404,
    'BUYER_NAME_EXISTS': 409,
    'BUYER_HAS_CONFIGS': 409,
    'FETCH_ERROR': 500,
    'UPDATE_ERROR': 500,
    'DELETE_ERROR': 500,
    'CREATION_ERROR': 500
  };
  return statusMap[code] || 500;
};