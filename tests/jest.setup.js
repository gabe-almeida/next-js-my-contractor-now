import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import fetch, { Headers, Request, Response } from 'node-fetch'

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.fetch = fetch
global.Headers = Headers
global.Request = Request
global.Response = Response

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock external compliance scripts
global.TrustedForm = {
  createCertificateUrl: jest.fn(() => 'https://cert.trustedform.com/test123'),
  getCertificateId: jest.fn(() => 'test123'),
}

global.jornaya_universal_leadid = 'jornaya_test_id'

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.RADAR_API_KEY = 'test_radar_key'
process.env.NEXT_PUBLIC_TRUSTEDFORM_ENABLED = 'true'
process.env.NEXT_PUBLIC_JORNAYA_ENABLED = 'true'

// Increase timeout for integration tests
jest.setTimeout(30000)

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})