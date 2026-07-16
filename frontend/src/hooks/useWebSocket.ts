import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket() {
    const queryClient = useQueryClient();
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Mở kết nối WebSocket
        const wsBase = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';
        const ws = new WebSocket(`${wsBase}/api/v1/dashboard/ws/realtime`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connection opened');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Update React Query cache trực tiếp để các component tự động re-render
                queryClient.setQueryData(['mapData'], data.provinces || data);
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed');
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [queryClient]);
}
