-- ==============================================================================
-- AMS IDEMPOTENCY FOUNDATION
-- ==============================================================================

CREATE TABLE api_idempotency_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller UUID NOT NULL, -- references external_users.id ideally
    operation VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    request_hash VARCHAR(255) NOT NULL,
    response_status INT,
    response_body JSONB,
    resource_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (caller, operation, idempotency_key)
);

ALTER TABLE api_idempotency_records ENABLE ROW LEVEL SECURITY;
-- Internal server endpoints will bypass RLS.
