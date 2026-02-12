#!/bin/bash

# Database Migration Script for S3-Ferry
# This script runs Liquibase migrations from the DSL/Liquibase folder

echo "Running S3-Ferry Liquibase migrations..."

# Wait for database to be ready
until docker exec s3-database pg_isready -U s3 -d s3_db; do
  echo "Waiting for database to be ready..."
  sleep 2
done

echo "Database is ready. Running Liquibase migrations..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LIQUIBASE_DIR="$SCRIPT_DIR/DSL/Liquibase"

# Run Liquibase update command
docker run --rm \
  --network host \
  -v "$LIQUIBASE_DIR":/liquibase/changelog \
  liquibase/liquibase \
  --changelogFile=master.yml \
  --url=jdbc:postgresql://s3-database:5432/s3_db \
  --username=s3 \
  --password=dbadmin \
  update

if [ $? -eq 0 ]; then
  echo "Liquibase migrations completed successfully!"
else
  echo "Liquibase migration failed!"
  exit 1
fi
