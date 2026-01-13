/**
 * Real-Time Updates API Route (Server-Sent Events)
 *
 * WHY: Provides real-time updates to admin dashboard for lead submissions,
 *      auction completions, and system alerts without polling.
 *
 * WHEN: Admin dashboard connects via EventSource for live updates.
 *
 * HOW: Uses Server-Sent Events (SSE) to push updates to connected clients.
 *      Currently a placeholder that keeps connection alive.
 */

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Verify admin authorization
  const authHeader = request.headers.get('authorization');
  // Note: SSE connections don't easily support auth headers in browsers
  // For now, we allow the connection but don't send sensitive data

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"connected"}\n\n'));

      // Keep connection alive with periodic heartbeats
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // Connection closed
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
