'use client';

import { useState, useCallback } from 'react';
import { Upload, X } from 'lucide-react';

interface FileUploadFormProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
}

export function FileUploadForm({
  onFilesSelected,
  isUploading = false,
}: FileUploadFormProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files) {
        const newFiles = Array.from(files);
        setSelectedFiles((prev) => [...prev, ...newFiles]);
      }
    },
    [],
  );

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
      setSelectedFiles([]);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Bulk File Upload</h2>
        <p className="text-sm text-gray-600">
          Drag files here or click to select. Multiple files supported.
        </p>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <div className="mb-4">
          <Upload className="mx-auto h-10 w-10 text-gray-400" />
        </div>
        <p className="mb-2 text-sm font-medium text-gray-900">
          Drop files here or click to browse
        </p>

        <input
          type="file"
          multiple
          onChange={handleInputChange}
          disabled={isUploading}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Select Files
        </label>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Selected Files ({selectedFiles.length})
            </h3>
            <button
              onClick={handleClear}
              disabled={isUploading}
              className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded bg-gray-50 p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveFile(index)}
                  disabled={isUploading}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || isUploading}
        className="w-full rounded bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:bg-gray-400 disabled:opacity-50"
      >
        {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}
