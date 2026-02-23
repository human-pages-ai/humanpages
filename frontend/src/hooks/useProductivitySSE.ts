import { useEffect, useRef, useCallback } from 'react';

interface SSECallbacks {
  onStaffActivity?: (data: unknown) => void;
  onIdleAlert?: (data: unknown) => void;
  onIdleResolved?: (data: unknown) => void;
}

export function useProductivitySSE(callbacks: SSECallbacks) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Clean up previous connection
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(`/api/admin/productivity/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.addEventListener('staff_activity', (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onStaffActivity?.(data);
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('idle_alert', (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onIdleAlert?.(data);
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('idle_resolved', (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onIdleResolved?.(data);
      } catch { /* ignore parse errors */ }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Auto-reconnect after 5 seconds
      reconnectTimer.current = setTimeout(connect, 5000);
    };
  }, [callbacks]);

  useEffect(() => {
    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [connect]);
}
