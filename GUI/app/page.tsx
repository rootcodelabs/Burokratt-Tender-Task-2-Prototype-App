'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUploadManager } from '@/lib/useUploadManager';
import { useWebhookEvents } from '@/lib/useWebhookEvents';
import { s3FerryClient } from '@/lib/s3-ferry-client';
import { FileUploadForm } from './components/FileUploadForm';
import { LogsPanel } from './components/LogsPanel';
import { MetricsTable } from './components/MetricsTable';

export default function Home() {
  const {
    metrics,
    logs,
    initiateUpload,
    uploadChunk,
    completeUpload,
    resumeUpload,
    addLog,
    pauseUpload,
    resumePausedUpload,
    isUploadPaused,
    deleteUpload,
    clearLocalStorage,
  } = useUploadManager();
  
  const [webhookPollingEnabled, setWebhookPollingEnabled] = useState(true);
  
  const { webhookEvents, isPolling, clearWebhookEvents } = useWebhookEvents({ enabled: webhookPollingEnabled });
  const [isUploading, setIsUploading] = useState(false);
  
  useEffect(() => {
    const saved = localStorage.getItem('webhook-polling-enabled');
    if (saved !== null) {
      setWebhookPollingEnabled(saved === 'true');
    }
  }, []);

  const allLogs = useCallback(() => {
    const combined = [...logs];
    
    webhookEvents.forEach((event) => {
      const timestamp = new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false });
      combined.push(
        `[${timestamp}] 🔔 Webhook: ${event.event} (${event.data.fileName})`
      );
    });
    
    combined.sort((a, b) => {
      const timeA = a.match(/\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || '';
      const timeB = b.match(/\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || '';
      return timeA.localeCompare(timeB);
    });
    
    return combined;
  }, [logs, webhookEvents]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('webhook-polling-enabled', String(webhookPollingEnabled));
    }
  }, [webhookPollingEnabled]);

  useEffect(() => {
    addLog('Demo initialized - S3-Ferry upload manager ready');
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [addLog, isUploading]);
  
  const handleToggleWebhookPolling = useCallback(() => {
    setWebhookPollingEnabled((prev) => {
      const newValue = !prev;
      addLog(`Webhook polling ${newValue ? 'enabled' : 'disabled'}`);
      return newValue;
    });
  }, [addLog]);

  const waitWhilePaused = useCallback(
    async (uploadId: string) => {
      while (isUploadPaused(uploadId)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
    [isUploadPaused],
  );

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setIsUploading(true);

      for (const file of files) {
        try {
          addLog(`Starting upload: ${file.name}`);

          const { uploadId, response } = await initiateUpload(file);
          const parts = [];

          for (const chunk of response.chunks) {
            await waitWhilePaused(uploadId);
            const chunkData = file.slice(
              chunk.startByte,
              Math.min(chunk.endByte + 1, file.size),
            );

            try {
              const etag = await uploadChunk(uploadId, chunk.chunkNumber, chunkData);
              
              parts.push({
                partNumber: chunk.chunkNumber,
                partSize: chunkData.size,
                etag,
              });
            } catch {
              addLog(
                `Chunk ${chunk.chunkNumber} failed, attempting resume...`,
              );

              try {
                const resumeResponse = await resumeUpload(uploadId, file);

                for (const resumeChunk of resumeResponse.chunks) {
                  await waitWhilePaused(uploadId);
                  const missingChunkData = file.slice(
                    resumeChunk.startByte,
                    Math.min(resumeChunk.endByte + 1, file.size),
                  );

                  const etag = await uploadChunk(
                    uploadId,
                    resumeChunk.chunkNumber,
                    missingChunkData,
                  );
                  
                  const existingPartIdx = parts.findIndex(
                    (p) => p.partNumber === resumeChunk.chunkNumber,
                  );
                  if (existingPartIdx >= 0) {
                    parts[existingPartIdx].etag = etag;
                  } else {
                    parts.push({
                      partNumber: resumeChunk.chunkNumber,
                      partSize: missingChunkData.size,
                      etag,
                    });
                  }
                }
              } catch (resumeError) {
                addLog(`Resume failed: ${resumeError}`);
                throw resumeError;
              }
            }
          }

          await completeUpload(uploadId, parts);
          addLog(`✅ Upload completed successfully: ${file.name}`);
        } catch (error) {
          addLog(
            `❌ Upload failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      setIsUploading(false);
    },
    [initiateUpload, uploadChunk, completeUpload, resumeUpload, addLog, waitWhilePaused],
  );

  const handleDownload = useCallback(
    async (uploadId: string) => {
      const metric = metrics.get(uploadId);
      if (!metric || !metric.objectName) {
        addLog('⚠️ Cannot download: object name not found');
        return;
      }

      try {
        addLog(`📥 Requesting download URL for: ${metric.fileName}`);
        const response = await s3FerryClient.getDownloadUrl({
          objectName: metric.objectName,
        });
        
        addLog(`📥 Opening download: ${metric.fileName}`);
        window.open(response.url, '_blank');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        addLog(`⚠️ Failed to get download URL: ${errorMsg}`);
      }
    },
    [metrics, addLog],
  );

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">
            S3-Ferry Upload Demo
          </h1>
          <p className="mt-2 text-gray-600">
            Bulk file upload interface with performance metrics and webhook integration
          </p>
          <div className="mt-4 text-xs text-gray-500">
            <p>🔗 S3-Ferry API: http://localhost:3000</p>
            <p>📡 Webhooks enabled for real-time event tracking</p>
            <p>📊 Live metrics and performance analytics</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleToggleWebhookPolling}
              className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                isPolling
                  ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                  : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {isPolling ? '✓ Webhook Polling ON' : '✗ Webhook Polling OFF'}
            </button>
            <button
              onClick={() => {
                clearLocalStorage();
                clearWebhookEvents();
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear All Logs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <FileUploadForm
              onFilesSelected={handleFilesSelected}
              isUploading={isUploading}
            />
          </div>
          <div className="space-y-6">
            <LogsPanel logs={allLogs()} maxHeight="h-96" />
          </div>
        </div>

        <MetricsTable
          metrics={metrics}
          onPause={pauseUpload}
          onResume={resumePausedUpload}
          onDelete={deleteUpload}
          onDownload={handleDownload}
          isPaused={isUploadPaused}
          webhookEvents={webhookEvents}
        />
      </div>
    </main>
  );
}

