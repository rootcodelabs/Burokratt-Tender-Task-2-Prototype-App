-- Get all uploads with optional filtering
SELECT 
    upload_id,
    object_name,
    file_name,
    file_size,
    mime_type,
    storage_type,
    status,
    total_chunks,
    initiated_at,
    completed_at,
    created_at,
    updated_at
FROM 
    uploads
WHERE 
    (:status::text IS NULL OR status = :status)
ORDER BY 
    created_at DESC
LIMIT :limit OFFSET :offset;
