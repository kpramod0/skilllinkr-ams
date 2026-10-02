
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  email text PRIMARY KEY,
  otp_hash text NOT NULL,
  attempts integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
