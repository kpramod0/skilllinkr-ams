import * as jose from 'jose';
import { createClient } from '@supabase/supabase-js';

// Environment config (use local for testing if STAGING env vars are missing)
const EXPECTED_ISSUER = process.env.EXPECTED_ISSUER || 'skilllinkr-main-local';
const EXPECTED_AUDIENCE = process.env.EXPECTED_AUDIENCE || 'skilllinkr-ams-local';

// Load public key (in production this comes from an env var or a JWKS endpoint)
// We read it from the generated local file for this test phase.
let amsPublicKeyStr = process.env.AMS_API_PUBLIC_KEY || '';
if (!amsPublicKeyStr) {
  try {
    const fs = require('fs');
    amsPublicKeyStr = fs.readFileSync('public_key.pem', 'utf8');
  } catch (e) {
    console.error("No public key found.");
  }
}

// Local Supabase configuration for external_users resolution
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54331';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

/**
 * Validates the Main-to-AMS Service Assertion token
 */
export async function verifyMainServiceAssertion(authHeader?: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header format.');
  }

  const token = authHeader.split(' ')[1];
  
  if (!amsPublicKeyStr) {
     throw new Error('Server configuration error: missing public key.');
  }

  const publicKey = await jose.importSPKI(amsPublicKeyStr, 'RS256');

  try {
    const { payload } = await jose.jwtVerify(token, publicKey, {
      issuer: EXPECTED_ISSUER,
      audience: EXPECTED_AUDIENCE,
      algorithms: ['RS256'],
      maxTokenAge: '60s', // tokens should be very short-lived
    });

    if (!payload.exp || !payload.iat) {
      throw new Error("Token must have both exp and iat claims.");
    }
    const lifetime = payload.exp - payload.iat;
    if (lifetime > 60) { // 60 seconds max token lifetime
      throw new Error("Token expiry exceeds maximum permitted lifetime.");
    }
    
    if (!payload.sub) {
      throw new Error('Token is missing sub claim.');
    }
    if (!payload.jti) {
      throw new Error('Token is missing jti claim.');
    }
    
    // UUID basic validation
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(payload.sub)) {
        throw new Error('Token sub is not a valid UUID.');
    }

    return payload;
  } catch (e: any) {
    throw new Error(`Token verification failed: ${e.message}`);
  }
}

/**
 * Resolves the Main identity to an AMS internal actor context using the service role.
 */
export async function resolveExternalActor(mainAuthUserId: string) {
    if (!supabaseServiceKey) {
        throw new Error("Missing Supabase Service Role Key");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: user, error } = await supabaseAdmin
        .from('external_users')
        .select('*')
        .eq('main_auth_user_id', mainAuthUserId)
        .eq('source_system', 'skilllinkr-main')
        .single();
        
    if (error || !user) {
        throw new Error('External user resolution failed or user not found.');
    }
    
    // We can add additional checks here (e.g. status === 'active', etc.)

    return {
        externalUserId: user.id,
        mainAuthUserId: user.main_auth_user_id,
        institutionId: user.institution_id,
        userType: user.user_type,
        status: user.status || 'active'
    };
}
