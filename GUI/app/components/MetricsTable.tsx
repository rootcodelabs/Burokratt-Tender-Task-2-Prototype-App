'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle, AlertCircle, Clock, Download } from 'lucide-react';
import { UploadMetrics } from '@/lib/useUploadManager';
import type { WebhookEvent } from '@/lib/useWebhookEvents';

interface MetricsTableProps {
  metrics: Map<string, UploadMetrics>;
  onPause: (uploadId: string) => void;
  onResume: (uploadId: string) => void;
  onDelete: (uploadId: string) => void;
  onDownload: (uploadId: string) => void;
  isPaused: (uploadId: string) => boolean;
  webhookEvents: WebhookEvent[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(2) + 's';
}

function formatTimestamp(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

export function MetricsTable({
  metrics,
  onPause,
  onResume,
  onDelete,
  onDownload,
  isPaused,
  webhookEvents,
}: MetricsTableProps) {
  const tableData = useMemo(() => {
    return Array.from(metrics.values())
      .sort((a, b) => b.startTime - a.startTime)
      .map((metric) => {
      const duration = metric.endTime
        ? metric.endTime - metric.startTime
        : Date.now() - metric.startTime;
      const throughput =
        duration > 0
          ? (metric.uploadedBytes / (1024 * 1024)) / (duration / 1000)
          : 0;
      const progress = Math.round(
        (metric.uploadedChunks / metric.totalChunks) * 100,
      );

      const completedChunkTimes = Array.from(metric.chunkTimings.values())
        .filter((timing) => timing.endTime)
        .map((timing) => (timing.endTime! - timing.startTime));
      const avgChunkMs = completedChunkTimes.length
        ? completedChunkTimes.reduce((sum, t) => sum + t, 0) /
          completedChunkTimes.length
        : 0;

      const endEvents = ['file_validated', 'file_flagged', 'file_deleted'];
      const endEvent = webhookEvents
        .filter(
          (event) =>
            event.data?.uploadId === metric.uploadId &&
            endEvents.includes(event.event),
        )
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )[0];

      const endToEndMs = endEvent
        ? new Date(endEvent.timestamp).getTime() - metric.startTime
        : undefined;

      return {
        ...metric,
        duration,
        throughput,
        progress,
        avgChunkMs,
        endToEndMs,
      };
    });
  }, [metrics, webhookEvents]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
      case 'resuming':
      case 'paused':
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-900';
      case 'failed':
        return 'bg-red-50 text-red-900';
      case 'uploading':
      case 'resuming':
      case 'paused':
        return 'bg-blue-50 text-blue-900';
      default:
        return 'bg-gray-50 text-gray-900';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Upload Metrics</h2>
        <p className="text-sm text-gray-600">Performance data for each upload</p>
      </div>

      {tableData.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No uploads yet. Start uploading files to see metrics.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  File Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Size
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Uploaded
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Progress
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Chunks
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Started
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Ended
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Duration
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Throughput
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Avg Chunk
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  End to end
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tableData.map((data) => (
                <tr key={data.uploadId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    <div className="max-w-[180px] truncate font-medium">
                      {data.fileName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatBytes(data.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatBytes(data.uploadedBytes)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-32">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${data.progress}%` }}
                          />
                        </div>
                        <span className="ml-2 text-xs font-medium text-gray-600">
                          {data.progress}%
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {data.uploadedChunks}/{data.totalChunks}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatTimestamp(data.startTime)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatTimestamp(data.endTime)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDuration(data.duration)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {data.throughput.toFixed(2)} MB/s
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {data.avgChunkMs ? `${data.avgChunkMs.toFixed(0)} ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {data.endToEndMs ? formatDuration(data.endToEndMs) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(data.status)}
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(data.status)}`}
                      >
                        {data.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isPaused(data.uploadId) ? (
                        <button
                          onClick={() => onResume(data.uploadId)}
                          className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={() => onPause(data.uploadId)}
                          className="rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
                          disabled={
                            data.status === 'completed' || data.status === 'failed'
                          }
                        >
                          Pause
                        </button>
                      )}
                      <button
                        onClick={() => onDownload(data.uploadId)}
                        className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        disabled={data.status !== 'completed'}
                        title={data.status !== 'completed' ? 'Only completed uploads can be downloaded' : 'Download file'}
                      >
                        <Download className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onDelete(data.uploadId)}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tableData.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-4 rounded-lg bg-gray-50 p-4 text-sm">
          <div>
            <p className="text-gray-600">Total Files</p>
            <p className="text-xl font-bold text-gray-900">{tableData.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Total Data</p>
            <p className="text-xl font-bold text-gray-900">
              {formatBytes(
                tableData.reduce((sum, d) => sum + d.fileSize, 0),
              )}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Completed</p>
            <p className="text-xl font-bold text-green-600">
              {tableData.filter((d) => d.status === 'completed').length}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Failed</p>
            <p className="text-xl font-bold text-red-600">
              {tableData.filter((d) => d.status === 'failed').length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
