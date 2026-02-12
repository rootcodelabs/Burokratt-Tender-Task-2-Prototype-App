import { useState, useCallback, useRef, useEffect } from 'react';
import {
  s3FerryClient,
  InitiateUploadResponse,
  CompleteUploadResponse,
} from '@/lib/s3-ferry-client';

export interface PartInfo {
  partNumber: number;
  partSize: number;
  etag: string;
}

export interface UploadMetrics {
  uploadId: string;
  fileName: string;
  fileSize: number;
  startTime: number;
  endTime?: number;
  totalChunks: number;
  uploadedChunks: number;
  failedChunks: number;
  chunkTimings: Map<number, { startTime: number; endTime?: number }>;
  totalBytes: number;
  uploadedBytes: number;
  status:
    | 'initiating'
    | 'uploading'
    | 'resuming'
    | 'paused'
    | 'completing'
    | 'completed'
    | 'failed';
  error?: string;
  presignedUrls?: Map<number, string>;
  objectName?: string;
  retries: number;
  parts?: PartInfo[];
}

const STORAGE_UPLOADS_KEY = 's3-ferry-uploads';
const STORAGE_LOGS_KEY = 's3-ferry-logs';

const metricsToStorage = (metrics: Map<string, UploadMetrics>) => {
  const obj: Record<string, any> = {};
  metrics.forEach((metric, key) => {
    obj[key] = {
      ...metric,
      chunkTimings: Object.fromEntries(metric.chunkTimings),
      presignedUrls: Object.fromEntries(metric.presignedUrls || new Map()),
    };
  });
  return obj;
};

const metricsFromStorage = (obj: Record<string, any>): Map<string, UploadMetrics> => {
  const metrics = new Map<string, UploadMetrics>();
  Object.entries(obj).forEach(([key, value]: [string, any]) => {
    metrics.set(key, {
      ...value,
      chunkTimings: new Map(Object.entries(value.chunkTimings || {})),
      presignedUrls: new Map(Object.entries(value.presignedUrls || {})),
    });
  });
  return metrics;
};

export const useUploadManager = () => {
  const [metrics, setMetrics] = useState<Map<string, UploadMetrics>>(new Map());
  const [logs, setLogs] = useState<string[]>([]);
  const metricsRef = useRef<Map<string, UploadMetrics>>(new Map());
  const logsRef = useRef<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedMetrics = localStorage.getItem(STORAGE_UPLOADS_KEY);
        const storedLogs = localStorage.getItem(STORAGE_LOGS_KEY);

        if (storedMetrics) {
          const loaded = metricsFromStorage(JSON.parse(storedMetrics));
          metricsRef.current = loaded;
          setMetrics(new Map(loaded));
        }

        if (storedLogs) {
          const loadedLogs = JSON.parse(storedLogs);
          logsRef.current = loadedLogs;
          setLogs([...loadedLogs]);
        }
      } catch (error) {
        console.error('Failed to load from localStorage:', error);
      }
    }
  }, []);

  const addLog = useCallback((message: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
    const logEntry = `[${timestamp}] ${message}`;
    logsRef.current.push(logEntry);
    setLogs([...logsRef.current]);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logsRef.current.slice(-500)));
      } catch (error) {
        console.error('Failed to save logs to localStorage:', error);
      }
    }
  }, []);

  const initiateUpload = useCallback(
    async (file: File) => {
      const localId = Math.random().toString(36).substring(7);
      const mimeType = file.type || 'application/octet-stream';

      const newMetric: UploadMetrics = {
        uploadId: localId,
        fileName: file.name,
        fileSize: file.size,
        startTime: Date.now(),
        totalChunks: 0,
        uploadedChunks: 0,
        failedChunks: 0,
        chunkTimings: new Map(),
        totalBytes: file.size,
        uploadedBytes: 0,
        status: 'initiating',
        presignedUrls: new Map(),
        retries: 0,
        parts: [],
      };

      metricsRef.current.set(localId, newMetric);
      setMetrics(new Map(metricsRef.current));
      
      addLog(`Initiating upload: ${file.name} (${file.size} bytes, mimeType: ${mimeType})`);

      try {
        const payload = {
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          storageType: 'S3' as const,
        };

        const response = await s3FerryClient.initiateUpload(payload);
        const backendUploadId = response.uploadId;
        
        const updated = metricsRef.current.get(localId)!;
        updated.uploadId = backendUploadId;
        updated.objectName = response.objectName;
        updated.totalChunks = response.totalChunks;
        updated.status = 'uploading';

        response.chunks.forEach((chunk) => {
          updated.presignedUrls!.set(chunk.chunkNumber, chunk.presignedUrl);
          updated.chunkTimings.set(chunk.chunkNumber, {
            startTime: Date.now(),
          });
        });

        metricsRef.current.delete(localId);
        metricsRef.current.set(backendUploadId, updated);
        setMetrics(new Map(metricsRef.current));

        addLog(`Upload initiated: ${response.uploadId} with ${response.totalChunks} chunks`);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_UPLOADS_KEY, JSON.stringify(metricsToStorage(metricsRef.current)));
          } catch (error) {
            console.error('Failed to save metrics to localStorage:', error);
          }
        }

        return { file, uploadId: backendUploadId, response };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const updated = metricsRef.current.get(localId)!;
        updated.status = 'failed';
        updated.error = errorMsg;
        metricsRef.current.set(localId, updated);
        setMetrics(new Map(metricsRef.current));
        addLog(`Upload initiation failed: ${errorMsg}`);
        throw error;
      }
    },
    [addLog],
  );

  const uploadChunk = useCallback(
    async (uploadId: string, chunkNumber: number, chunk: Blob) => {
      const metric = metricsRef.current.get(uploadId);
      if (!metric) {
        throw new Error(`Upload ${uploadId} not found`);
      }

      const presignedUrl = metric.presignedUrls?.get(chunkNumber);
      if (!presignedUrl) {
        throw new Error(`Presigned URL for chunk ${chunkNumber} not found`);
      }

      try {
        const chunkTiming = metric.chunkTimings.get(chunkNumber)!;
        const etag = await s3FerryClient.uploadChunk(
          presignedUrl,
          chunk,
          (progress) => {},
        );

        chunkTiming.endTime = Date.now();
        metric.uploadedChunks += 1;
        metric.uploadedBytes += chunk.size;

        if (!metric.parts) {
          metric.parts = [];
        }
        
        const partIndex = metric.parts.findIndex(p => p.partNumber === chunkNumber);
        if (partIndex >= 0) {
          metric.parts[partIndex] = { partNumber: chunkNumber, partSize: chunk.size, etag };
        } else {
          metric.parts.push({ partNumber: chunkNumber, partSize: chunk.size, etag });
        }

        metricsRef.current.set(uploadId, metric);
        setMetrics(new Map(metricsRef.current));

        addLog(`Chunk ${chunkNumber}/${metric.totalChunks} uploaded (${chunk.size} bytes)`);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_UPLOADS_KEY, JSON.stringify(metricsToStorage(metricsRef.current)));
          } catch (error) {
            console.error('Failed to save metrics to localStorage:', error);
          }
        }

        return etag;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        metric.failedChunks += 1;
        metric.status = 'failed';
        metric.error = errorMsg;
        metricsRef.current.set(uploadId, metric);
        setMetrics(new Map(metricsRef.current));
        addLog(`Chunk ${chunkNumber} upload failed: ${errorMsg}`);
        throw error;
      }
    },
    [addLog],
  );

  const completeUpload = useCallback(
    async (uploadId: string, parts: Array<{ partNumber: number; partSize: number; etag: string }>) => {
      const metric = metricsRef.current.get(uploadId);
      if (!metric || !metric.objectName) {
        throw new Error(`Upload ${uploadId} not found or incomplete`);
      }

      metric.status = 'completing';
      metricsRef.current.set(uploadId, metric);
      setMetrics(new Map(metricsRef.current));

      const payload = {
        uploadId,
        objectName: metric.objectName,
        parts,
      };

      addLog(`Completing upload: ${uploadId} with ${parts.length} parts`);

      try {
        const response = await s3FerryClient.completeUpload(payload);

        metric.status = 'completed';
        metric.endTime = Date.now();
        const duration = (metric.endTime - metric.startTime) / 1000;
        const throughput = (metric.totalBytes / (1024 * 1024)) / duration;

        metricsRef.current.set(uploadId, metric);
        setMetrics(new Map(metricsRef.current));

        addLog(`Upload completed in ${duration.toFixed(2)}s, throughput: ${throughput.toFixed(2)} MB/s`);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_UPLOADS_KEY, JSON.stringify(metricsToStorage(metricsRef.current)));
          } catch (error) {
            console.error('Failed to save metrics to localStorage:', error);
          }
        }

        return response;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        metric.status = 'failed';
        metric.error = errorMsg;
        metricsRef.current.set(uploadId, metric);
        setMetrics(new Map(metricsRef.current));
        addLog(`Upload completion failed: ${errorMsg}`);
        throw error;
      }
    },
    [addLog],
  );

  const resumeUpload = useCallback(
    async (uploadId: string, file: File) => {
      const metric = metricsRef.current.get(uploadId);
      if (!metric || !metric.objectName) {
        throw new Error(`Upload ${uploadId} not found`);
      }

      metric.status = 'resuming';
      metric.retries += 1;
      metricsRef.current.set(uploadId, metric);
      setMetrics(new Map(metricsRef.current));

      const payload = {
        uploadId,
        objectName: metric.objectName,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      };

      addLog(`Resuming upload: ${uploadId} (attempt ${metric.retries})`);

      try {
        const response = await s3FerryClient.resumeUpload(payload);

        metric.totalChunks = response.totalChunks;
        metric.presignedUrls = new Map();

        response.chunks.forEach((chunk) => {
          metric.presignedUrls!.set(chunk.chunkNumber, chunk.presignedUrl);
        });

        metric.status = 'uploading';
        metricsRef.current.set(uploadId, metric);
        setMetrics(new Map(metricsRef.current));

        addLog(`Resume generated ${response.missingChunks.length} new URLs for missing chunks`);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_UPLOADS_KEY, JSON.stringify(metricsToStorage(metricsRef.current)));
          } catch (error) {
            console.error('Failed to save metrics to localStorage:', error);
          }
        }

        return response;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        metric.status = 'failed';
        metric.error = errorMsg;
        metricsRef.current.set(uploadId, metric);
        setMetrics(new Map(metricsRef.current));
        addLog(`Resume upload failed: ${errorMsg}`);
        throw error;
      }
    },
    [addLog],
  );

  const pauseUpload = useCallback(
    (uploadId: string) => {
      const metric = metricsRef.current.get(uploadId);
      if (!metric) {
        return;
      }

      if (metric.status === 'completed' || metric.status === 'failed') {
        return;
      }

      metric.status = 'paused';
      metricsRef.current.set(uploadId, metric);
      setMetrics(new Map(metricsRef.current));
      addLog(`⏸️ Upload paused: ${metric.fileName}`);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            STORAGE_UPLOADS_KEY,
            JSON.stringify(metricsToStorage(metricsRef.current)),
          );
        } catch (error) {
          console.error('Failed to save metrics to localStorage:', error);
        }
      }
    },
    [addLog],
  );

  const resumePausedUpload = useCallback(
    (uploadId: string) => {
      const metric = metricsRef.current.get(uploadId);
      if (!metric) {
        return;
      }

      if (metric.status !== 'paused') {
        return;
      }

      metric.status = 'uploading';
      metricsRef.current.set(uploadId, metric);
      setMetrics(new Map(metricsRef.current));
      addLog(`▶️ Upload resumed: ${metric.fileName}`);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            STORAGE_UPLOADS_KEY,
            JSON.stringify(metricsToStorage(metricsRef.current)),
          );
        } catch (error) {
          console.error('Failed to save metrics to localStorage:', error);
        }
      }
    },
    [addLog],
  );

  const isUploadPaused = useCallback((uploadId: string) => {
    const metric = metricsRef.current.get(uploadId);
    return metric?.status === 'paused';
  }, []);

  const deleteUpload = useCallback(
    async (uploadId: string) => {
      const metric = metricsRef.current.get(uploadId);
      if (!metric) {
        return;
      }

      if (metric.objectName) {
        try {
          await s3FerryClient.deleteS3Object({ objectName: metric.objectName });
          addLog(`🗑️ Deleted from S3: ${metric.objectName}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          addLog(`⚠️ Failed to delete from S3: ${errorMsg}`);
        }
      }

      metricsRef.current.delete(uploadId);
      setMetrics(new Map(metricsRef.current));

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            STORAGE_UPLOADS_KEY,
            JSON.stringify(metricsToStorage(metricsRef.current)),
          );
        } catch (error) {
          console.error('Failed to save metrics to localStorage:', error);
        }
      }
    },
    [addLog],
  );

  const clearLocalStorage = useCallback(() => {
    metricsRef.current = new Map();
    logsRef.current = [];
    setMetrics(new Map());
    setLogs([]);

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_UPLOADS_KEY);
        localStorage.removeItem(STORAGE_LOGS_KEY);
      } catch (error) {
        console.error('Failed to clear localStorage:', error);
      }
    }
  }, []);

  return {
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
  };
};
