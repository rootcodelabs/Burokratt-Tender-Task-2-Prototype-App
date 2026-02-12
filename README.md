
## Architecture Overview

```
┌─────────────┐      ┌──────────────────┐      ┌───────────┐      ┌──────────┐
│   UI (3003) │ ───▶ │ Ruuter-Private   │ ───▶│ S3-Ferry  │ ───▶│  MinIO   │
│   Next.js   │      │     (8088)       │      │   (3000)  │      │  (9000)  │
└─────────────┘      └──────────────────┘      └───────────┘      └──────────┘
                             │                        │
                             ▼                        ▼
                     ┌──────────────┐         ┌──────────────┐
                     │    Resql     │         │   ClamAV     │
                     │    (8082)    │         │   (3310)     │
                     └──────────────┘         └──────────────┘
                              │
                              ▼
                      ┌──────────────┐
                      │ S3 Database  │
                      │   (5432)     │
                      └──────────────┘
```
## Routing Flow

### 1. UI → Ruuter-Private
- **Endpoint**: `http://localhost:8088/s3-testing`
- **Purpose**: Entry point for all API calls from the UI
- **Cookie handling**: Cookies are sent with every request using `credentials: 'include'`

### 2. Ruuter-Private → S3-Ferry
- **Endpoint**: `http://s3-ferry:3000/v1/upload/*`
- **Purpose**: Ruuter routes the request to S3-Ferry microservice
- **DSL Files**: Located in `DSL/Ruuter.private/s3-testing/`

### 3. Ruuter-Private → Resql → Database
- **Endpoint**: `http://resql:8082/s3-testing`
- **Purpose**: Store upload tracking data in PostgreSQL
- **SQL Files**: Located in `DSL/Resql/s3-testing/`

## Environment Variables

### UI (.env.local)
```env
NEXT_PUBLIC_RUUTER_PRIVATE_URL=http://localhost:8088/s3-testing
NEXT_PUBLIC_S3_FERRY_URL=http://localhost:3000
```

### Docker Network (docker-compose.yml)
```yaml
GUI:
  environment:
    - NEXT_PUBLIC_RUUTER_PRIVATE_URL=http://ruuter-private:8088/s3-testing
    - NEXT_PUBLIC_S3_FERRY_URL=http://s3-ferry:3000
```

## API Endpoints

### Ruuter DSL Endpoints

| Method | Path | Ruuter DSL File | S3-Ferry Target |
|--------|------|-----------------|-----------------|
| POST | `/initiate-upload` | `POST/initiate-upload.yml` | `/v1/upload/initiate` |
| POST | `/resume-upload` | `POST/resume-upload.yml` | `/v1/upload/resume` |
| POST | `/complete-upload` | `POST/complete-upload.yml` | `/v1/upload/complete` |
| GET | `/upload-status` | `GET/upload-status.yml` | `/v1/upload/status` |
| DELETE | `/s3-object` | `DELETE/s3-object.yml` | `/v1/s3/delete` |

### Database Operations

| SQL File | Purpose |
|----------|---------|
| `POST/store-upload-data.sql` | Insert upload initiation data |
| `POST/update-upload-status.sql` | Update status when upload completes |
| `GET/get-upload-by-id.sql` | Retrieve specific upload record |
| `GET/get-uploads.sql` | List all uploads with filtering |



# Run Database Migration
./migrate-s3-tables.sh


## File Structure


Upgraded S3/
├── docker-compose.yml           # Main orchestration file
├── migrate-s3-tables.ps1        # Database migration script
├── DSL/
│   ├── Ruuter.private/
│   │   └── s3-testing/
│   │       ├── GET/
│   │       │   └── upload-status.yml
│   │       ├── POST/
│   │       │   ├── initiate-upload.yml
│   │       │   ├── resume-upload.yml
│   │       │   └── complete-upload.yml
│   │       └── DELETE/
│   │           └── s3-object.yml
│   ├── Resql/
│   │   └── s3-testing/
│   │       ├── GET/
│   │       │   ├── get-upload-by-id.sql
│   │       │   └── get-uploads.sql
│   │       └── POST/
│   │           ├── store-upload-data.sql
│   │           └── update-upload-status.sql
│   └── Liquibase/
│       └── create-uploads-table.sql
├── ui/
│   ├── lib/
│   │   └── s3-ferry-client.ts   # Updated to use Ruuter
│   ├── .env.local               # Local environment config
│   ├── .env.development         # Development environment config
│   ├── next.config.ts           # Next.js CORS & cookie config
│   └── Dockerfile               # UI container image
└── S3-Ferry/                    # S3-Ferry microservice

