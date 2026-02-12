-- Create uploads table for tracking S3-Ferry uploads
CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    upload_id VARCHAR(255) UNIQUE NOT NULL,
    object_name VARCHAR(500) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    storage_type VARCHAR(50) DEFAULT 'S3',
    status VARCHAR(50) NOT NULL DEFAULT 'initiated',
    total_chunks INTEGER,
    initiated_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_uploads_upload_id ON uploads(upload_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_object_name ON uploads(object_name);

-- Add comments
COMMENT ON TABLE uploads IS 'Tracks S3-Ferry multipart upload operations';
COMMENT ON COLUMN uploads.upload_id IS 'Unique identifier for the upload from S3-Ferry';
COMMENT ON COLUMN uploads.object_name IS 'Object name in S3 storage';
COMMENT ON COLUMN uploads.status IS 'Upload status: initiated, in-progress, completed, failed';
