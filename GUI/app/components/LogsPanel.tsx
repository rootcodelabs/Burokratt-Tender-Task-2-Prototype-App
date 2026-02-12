'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';

interface LogsPanelProps {
  logs: string[];
  maxHeight?: string;
}

export function LogsPanel({ logs, maxHeight = 'h-64' }: LogsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogIcon = (log: string) => {
    if (log.includes('failed') || log.includes('error'))
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (log.includes('completed'))
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (log.includes('resuming') || log.includes('Resume'))
      return <Zap className="h-4 w-4 text-yellow-500" />;
    return <Clock className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Activity Logs</h2>
        <p className="text-sm text-gray-600">Real-time upload and webhook events</p>
      </div>

      <div
        ref={scrollRef}
        className={`${maxHeight} overflow-y-auto overflow-x-hidden rounded bg-gray-900 p-4 font-mono text-sm`}
      >
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No events yet. Start uploading to see logs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-3 text-gray-100"
              >
                <div className="mt-1 flex-shrink-0">
                  {getLogIcon(log)}
                </div>
                <div className="flex-1 break-words text-xs">
                  {log.includes('failed') || log.includes('error') ? (
                    <span className="text-red-400">{log}</span>
                  ) : log.includes('completed') ? (
                    <span className="text-green-400">{log}</span>
                  ) : log.includes('resuming') || log.includes('Resume') ? (
                    <span className="text-yellow-400">{log}</span>
                  ) : (
                    <span className="text-gray-300">{log}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
        <p>{logs.length} events</p>
      </div>
    </div>
  );
}
