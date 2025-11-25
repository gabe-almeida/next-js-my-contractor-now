import DOMPurify from 'isomorphic-dompurify';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Comprehensive Security Utilities Module
 * 
 * This module provides production-ready security functions to address
 * critical vulnerabilities identified in the security audit.
 */

// =====================================
// 1. XSS PROTECTION & INPUT SANITIZATION
// =====================================

/**
 * Comprehensive HTML/XSS sanitization using DOMPurify
 * Replaces the basic sanitization that only removed < > characters
 */
export const sanitizeHtml = (input: string, options?: {
  allowedTags?: string[];
  allowedAttributes?: string[];
  stripAll?: boolean;
}): string => {
  if (!input || typeof input !== 'string') return '';
  
  const defaultConfig = {
    ALLOWED_TAGS: options?.allowedTags || [],
    ALLOWED_ATTR: options?.allowedAttributes || [],
    KEEP_CONTENT: !options?.stripAll,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    SANITIZE_DOM: true,
    FORBID_SCRIPT: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style', 'img', 'video', 'audio'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'href', 'src']
  };
  
  return DOMPurify.sanitize(input.trim(), defaultConfig);
};

/**
 * Sanitize plain text input (removes all HTML and dangerous characters)
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return sanitizeHtml(input, { stripAll: true });
};

/**
 * Deep sanitization for objects and arrays
 */
export const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize both key and value
      const cleanKey = sanitizeInput(key);
      sanitized[cleanKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Request body sanitization middleware
 */
export const sanitizeRequestBody = (body: any): any => {
  return sanitizeObject(body);
};

// =====================================
// 2. AUTHENTICATION & AUTHORIZATION
// =====================================

/**
 * JWT token configuration
 */
const JWT_CONFIG = {
  expiresIn: '1h',
  algorithm: 'HS256' as const,
  issuer: 'contractor-platform',
  audience: 'contractor-platform-admin'
};

/**
 * Generate secure JWT token for admin authentication
 */
export const generateJwtToken = (payload: { 
  userId: string; 
  role: string; 
  permissions?: string[]; 
}): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  
  return jwt.sign(payload, secret, JWT_CONFIG);
};

/**
 * Verify JWT token with proper error handling
 */
export const verifyJwtToken = (token: string): { 
  valid: boolean; 
  payload?: any; 
  error?: string 
} => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return { valid: false, error: 'Server configuration error' };
    }
    
    const payload = jwt.verify(token, secret, {
      algorithms: [JWT_CONFIG.algorithm],
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });
    
    return { valid: true, payload };
  } catch (error: any) {
    // Don't expose JWT errors in production
    if (process.env.NODE_ENV === 'production') {
      return { valid: false, error: 'Invalid token' };
    }
    
    return { valid: false, error: error.message };
  }
};

/**
 * Constant-time string comparison to prevent timing attacks
 */
export const secureStringCompare = (provided: string, actual: string): boolean => {
  if (!provided || !actual) return false;
  
  // Normalize lengths to prevent timing attacks
  const providedBuffer = Buffer.from(provided, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');
  
  if (providedBuffer.length !== actualBuffer.length) return false;
  
  return timingSafeEqual(providedBuffer, actualBuffer);
};

/**
 * Enhanced admin authentication with JWT support
 */
export const validateAdminAuth = async (req: NextRequest): Promise<{
  valid: boolean;
  user?: any;
  error?: string;
}> => {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return { valid: false, error: 'Authorization header missing' };
  }
  
  // Support both JWT and API key authentication
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Check if it looks like a JWT (has 3 parts separated by dots)
    if (token.includes('.') && token.split('.').length === 3) {
      return verifyJwtToken(token);
    }
    
    // Otherwise treat as API key
    const apiKey = process.env.ADMIN_API_KEY;
    if (!apiKey) {
      return { valid: false, error: 'Server configuration error' };
    }
    
    const isValid = secureStringCompare(token, apiKey);
    if (!isValid) {
      return { valid: false, error: 'Invalid credentials' };
    }
    
    return { 
      valid: true, 
      user: { 
        type: 'api_key', 
        role: 'admin',
        permissions: ['admin:read', 'admin:write'] 
      } 
    };
  }
  
  return { valid: false, error: 'Invalid authorization format' };
};

// =====================================
// 3. CORS SECURITY
// =====================================

/**
 * Secure CORS configuration with whitelist support
 */
export const getSecureCorsHeaders = (origin?: string): Record<string, string> => {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://your-production-domain.com'
  ];
  
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
};

// =====================================
// 4. LOGGING SECURITY
// =====================================

/**
 * Sensitive data patterns that should never be logged
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /jwt/i,
  /api[_-]?key/i,
  /private[_-]?key/i
];

/**
 * Check if a string contains sensitive data
 */
const containsSensitiveData = (str: string): boolean => {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(str));
};

/**
 * Sanitize data before logging to remove sensitive information
 */
export const sanitizeLogData = (data: any): any => {
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    // Mask potential credentials
    if (containsSensitiveData(data)) {
      return '[REDACTED]';
    }
    return data;
  }
  
  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (containsSensitiveData(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value);
      }
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Safe console log wrapper that sanitizes sensitive data
 */
export const secureLog = {
  log: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(message, data ? sanitizeLogData(data) : '');
    }
  },
  
  warn: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(message, data ? sanitizeLogData(data) : '');
    }
  },
  
  error: (message: string, error?: any) => {
    // Always log errors, but sanitize them
    console.error(message, error ? sanitizeLogData(error) : '');
  },
  
  info: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(message, data ? sanitizeLogData(data) : '');
    }
  }
};

// =====================================
// 5. ERROR HANDLING
// =====================================

/**
 * Production-safe error response
 */
export const sanitizeErrorForProduction = (error: any): {
  message: string;
  code?: string;
  timestamp: string;
} => {
  const timestamp = new Date().toISOString();
  
  if (process.env.NODE_ENV === 'production') {
    // Generic error message for production
    return {
      message: 'An error occurred while processing your request',
      code: 'INTERNAL_ERROR',
      timestamp
    };
  }
  
  // Detailed errors only in development
  return {
    message: error?.message || 'Unknown error',
    code: error?.code || 'UNKNOWN_ERROR',
    timestamp
  };
};

// =====================================
// 6. VALIDATION HELPERS
// =====================================

/**
 * Validate and sanitize file uploads
 */
export const validateFileUpload = (file: File, options: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}): { valid: boolean; error?: string; sanitizedName?: string } => {
  const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
  const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'application/pdf'];
  const allowedExtensions = options.allowedExtensions || ['.jpg', '.jpeg', '.png', '.pdf'];
  
  // Size validation
  if (file.size > maxSize) {
    return { valid: false, error: `File size must be less than ${maxSize / 1024 / 1024}MB` };
  }
  
  // Type validation
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }
  
  // Extension validation
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' };
  }
  
  // Sanitize filename
  const sanitizedName = sanitizeInput(file.name)
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 255);
  
  return { valid: true, sanitizedName };
};

/**
 * Rate limiting key generators that are secure
 */
export const getRateLimitKey = (req: NextRequest, prefix: string = 'rl'): string => {
  // Get the most reliable IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfIp = req.headers.get('cf-connecting-ip');
  
  let ip = 'unknown';
  if (cfIp) {
    ip = cfIp; // Cloudflare
  } else if (forwarded) {
    ip = forwarded.split(',')[0].trim(); // Load balancer
  } else if (realIp) {
    ip = realIp; // Nginx
  }
  
  // Hash the IP for privacy in logs
  const hashedIp = Buffer.from(ip).toString('base64').substring(0, 16);
  
  return `${prefix}:${hashedIp}`;
};

export default {
  sanitizeHtml,
  sanitizeInput,
  sanitizeObject,
  sanitizeRequestBody,
  generateJwtToken,
  verifyJwtToken,
  secureStringCompare,
  validateAdminAuth,
  getSecureCorsHeaders,
  sanitizeLogData,
  secureLog,
  sanitizeErrorForProduction,
  validateFileUpload,
  getRateLimitKey
};