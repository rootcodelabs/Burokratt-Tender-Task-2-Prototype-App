-- Store upload initiation data
INSERT INTO uploads (
    upload_id,
    object_name,
    file_name,
    file_size,
    mime_type,
    storage_type,
    status,
    total_chunks,
    initiated_at,
    created_at
) VALUES (
    :uploadId,
    :objectName,
    :fileName,
    :fileSize,
    :mimeType,
    :storageType,
    :status,
    :totalChunks,
    :initiatedAt::timestamp,
    NOW()
)
ON CONFLICT (upload_id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = NOW()
RETURNING *;
