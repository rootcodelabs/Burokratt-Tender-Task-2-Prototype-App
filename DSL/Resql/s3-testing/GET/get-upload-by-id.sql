-- Get upload history by upload ID
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
    upload_id = :uploadId
LIMIT 1;
