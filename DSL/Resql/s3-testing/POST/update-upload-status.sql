-- Update upload status when completed
UPDATE uploads 
SET 
    status = :status,
    completed_at = :completedAt::timestamp,
    updated_at = NOW()
WHERE 
    upload_id = :uploadId 
    AND object_name = :objectName
RETURNING *;
