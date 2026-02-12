import { useEffect, useState, useCallback } from 'react';

export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: {
    uploadId: string;
    objectName: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    details?: Record<string, unknown>;
  };
  signature?: string;
  receivedAt: string;
}

const WEBHOOK_ENDPOINT = '/api/webhooks';
const POLL_INTERVAL = 2000;

interface UseWebhookEventsOptions {
  enabled?: boolean;
}

export const useWebhookEvents = (options?: UseWebhookEventsOptions) => {
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isPolling, setIsPolling] = useState(options?.enabled ?? true);
  
  useEffect(() => {
    if (options?.enabled !== undefined) {
      setIsPolling(options.enabled);
    }
  }, [options?.enabled]);

  const fetchWebhookEvents = useCallback(async () => {
    try {
      const response = await fetch(WEBHOOK_ENDPOINT);
      if (!response.ok) {
        throw new Error(`Failed to fetch webhooks: ${response.statusText}`);
      }

      const events = await response.json();
      setWebhookEvents(events);
    } catch (error) {
      console.error('[WEBHOOK_POLL] Error:', error);
    }
  }, []);

  useEffect(() => {
    if (!isPolling) return;

    fetchWebhookEvents();

    const interval = setInterval(() => {
      fetchWebhookEvents();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isPolling, fetchWebhookEvents]);

  const clearWebhookEvents = useCallback(async () => {
    try {
      const response = await fetch(WEBHOOK_ENDPOINT, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear webhooks');
      }

      setWebhookEvents([]);
    } catch (error) {
      console.error('[WEBHOOK_POLL] Error:', error);
    }
  }, []);

  const togglePolling = useCallback(() => {
    setIsPolling((prev) => !prev);
  }, []);

  return {
    webhookEvents,
    clearWebhookEvents,
    isPolling,
    setIsPolling,
    togglePolling,
  };
};
