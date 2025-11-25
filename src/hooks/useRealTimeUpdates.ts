'use client';

import { useState, useEffect, useRef } from 'react';
import { RealtimeUpdate } from '@/types';

interface UseRealTimeUpdatesOptions {
  enabled?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useRealTimeUpdates(options: UseRealTimeUpdatesOptions = {}) {
  const {
    enabled = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5
  } = options;

  const [updates, setUpdates] = useState<RealtimeUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (!enabled || eventSourceRef.current) return;

    try {
      // Using Server-Sent Events for real-time updates
      const eventSource = new EventSource('/api/admin/realtime');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('Real-time connection established');
        setIsConnected(true);
        setReconnectAttempts(0);
      };

      eventSource.onmessage = (event) => {
        try {
          const update: RealtimeUpdate = JSON.parse(event.data);
          setUpdates(prev => [update, ...prev.slice(0, 49)]); // Keep last 50 updates
        } catch (error) {
          console.error('Error parsing real-time update:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Real-time connection error:', error);
        setIsConnected(false);
        
        // Close current connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection if under limit
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };

      // Handle specific event types
      eventSource.addEventListener('lead_submitted', (event) => {
        const data = JSON.parse(event.data);
        setUpdates(prev => [{
          type: 'lead_submitted',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 49)]);
      });

      eventSource.addEventListener('auction_complete', (event) => {
        const data = JSON.parse(event.data);
        setUpdates(prev => [{
          type: 'auction_complete',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 49)]);
      });

      eventSource.addEventListener('buyer_response', (event) => {
        const data = JSON.parse(event.data);
        setUpdates(prev => [{
          type: 'buyer_response',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 49)]);
      });

      eventSource.addEventListener('system_alert', (event) => {
        const data = JSON.parse(event.data);
        setUpdates(prev => [{
          type: 'system_alert',
          data,
          timestamp: new Date()
        }, ...prev.slice(0, 49)]);
      });

    } catch (error) {
      console.error('Failed to establish real-time connection:', error);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
    setReconnectAttempts(0);
  };

  const clearUpdates = () => {
    setUpdates([]);
  };

  const getUpdatesByType = (type: RealtimeUpdate['type']) => {
    return updates.filter(update => update.type === type);
  };

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    updates,
    isConnected,
    reconnectAttempts,
    maxReconnectAttempts,
    connect,
    disconnect,
    clearUpdates,
    getUpdatesByType
  };
}

// Hook for WebSocket-based real-time updates (alternative implementation)
export function useWebSocketUpdates(url?: string) {
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const connect = () => {
    if (socket?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const update: RealtimeUpdate = JSON.parse(event.data);
          setUpdates(prev => [update, ...prev.slice(0, 49)]);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      setSocket(ws);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
    setIsConnected(false);
  };

  const sendMessage = (message: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    updates,
    isConnected,
    connect,
    disconnect,
    sendMessage
  };
}