const API_BASE = process.env.NEXT_PUBLIC_RUUTER_PRIVATE_URL || 'http://localhost:8088/s3-testing';

export interface InitiateUploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageType: 'S3' | 'FS';
}

export interface InitiateUploadResponse {
  uploadId: string;
  objectName: string;
  totalChunks: number;
  chunkSize: number;
  lastChunkSize: number;
  totalSize: number;
  chunks: Array<{
    chunkNumber: number;
    size: number;
    startByte: number;
    endByte: number;
    presignedUrl: string;
    expiresAt: number;
  }>;
  initiatedAt: string;
  configuration: {
    maxFileSize: number;
    maxChunkSize: number;
    fileType: string;
  };
}

export interface UploadStatusResponse {
  uploadId: string;
  objectName: string;
  uploadedChunks: number;
  uploadedParts: Array<{
    partNumber: number;
    etag: string;
    size: number;
  }>;
  status: 'in-progress' | 'completed' | 'not-found';
}

export interface ResumeUploadRequest {
  uploadId: string;
  objectName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface ResumeUploadResponse {
  uploadId: string;
  objectName: string;
  chunks: Array<{
    chunkNumber: number;
    size: number;
    startByte: number;
    endByte: number;
    presignedUrl: string;
    expiresAt: number;
  }>;
  generatedAt: string;
  urlsGenerated: number;
  status: string;
  uploadedChunks: number;
  totalChunks: number;
  uploadedParts: Array<{
    partNumber: number;
    etag: string;
    size: number;
  }>;
  missingChunks: number[];
}

export interface CompleteUploadRequest {
  uploadId: string;
  objectName: string;
  parts: Array<{
    partNumber: number;
    partSize: number;
    etag: string;
  }>;
}

export interface CompleteUploadResponse {
  uploadId: string;
  objectName: string;
  status: 'completed';
  message: string;
  completedAt: string;
}

export interface DeleteS3ObjectRequest {
  objectName: string;
  bucketName?: string;
}

export interface DeleteS3ObjectResponse {
  objectName: string;
  bucketName: string;
  status: string;
  message: string;
  deletedAt: string;
}

export interface DownloadUrlRequest {
  objectName: string;
  bucketName?: string;
}

export interface DownloadUrlResponse {
  url: string;
  objectName: string;
  bucketName: string;
  expiresAt: number;
}

export const s3FerryClient = {
  async initiateUpload(
    req: InitiateUploadRequest,
  ): Promise<InitiateUploadResponse> {
    const response = await fetch(`${API_BASE}/initiate-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      await response.text();
      throw new Error(
        `Initiate upload failed: ${response.status} ${response.statusText}`,
      );
    }

    let data;
    try {
      const responseText = await response.text();
      data = JSON.parse(responseText);
    } catch {
      throw new Error('Failed to parse server response as JSON');
    }
    
    const actualData = data.response || data;
    
    if (!actualData.chunks || !Array.isArray(actualData.chunks)) {
      throw new Error('Invalid response: missing chunks array');
    }
    
    return actualData;
  },

  async getUploadStatus(
    uploadId: string,
    objectName: string,
  ): Promise<UploadStatusResponse> {
    const params = new URLSearchParams({ uploadId, objectName });
    const response = await fetch(`${API_BASE}/upload-status?${params}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      await response.text();
      throw new Error(
        `Get upload status failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.response || data;
  },

  async resumeUpload(
    req: ResumeUploadRequest,
  ): Promise<ResumeUploadResponse> {
    const response = await fetch(`${API_BASE}/resume-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      await response.text();
      throw new Error(
        `Resume upload failed: ${response.status} ${response.statusText}`,
      );
    }

    const responseText = await response.text();
    const data = JSON.parse(responseText);
    const actualData = data.response || data;
    
    if (!actualData.chunks || !Array.isArray(actualData.chunks)) {
      throw new Error('Invalid response: missing chunks array');
    }
    
    return actualData;
  },

  async completeUpload(
    req: CompleteUploadRequest,
  ): Promise<CompleteUploadResponse> {
    const response = await fetch(`${API_BASE}/complete-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      await response.text();
      throw new Error(
        `Complete upload failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.response || data;
  },

  async uploadChunk(
    presignedUrl: string,
    chunk: Blob,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          onProgress?.(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const etag = xhr.getResponseHeader('etag')?.replace(/"/g, '') || '';
          resolve(etag);
        } else {
          reject(
            new Error(
              `Chunk upload failed: ${xhr.status} ${xhr.statusText}`,
            ),
          );
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during chunk upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Chunk upload aborted'));
      });

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(chunk);
    });
  },

  async deleteS3Object(req: DeleteS3ObjectRequest): Promise<DeleteS3ObjectResponse> {
    const response = await fetch(`${API_BASE}/s3-object`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      await response.text();
      throw new Error(
        `Delete S3 object failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.response || data;
  },

  async getDownloadUrl(req: DownloadUrlRequest): Promise<DownloadUrlResponse> {
    const response = await fetch(`${API_BASE}/download-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      await response.text();
      throw new Error(
        `Get download URL failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.response || data;
  },
};
