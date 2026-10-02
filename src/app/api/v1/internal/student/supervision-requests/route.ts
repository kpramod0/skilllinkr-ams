import { NextRequest, NextResponse } from 'next/server';
import { verifyMainServiceAssertion, resolveExternalActor } from '@/lib/auth/service-verifier';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54331';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const idempotencyKey = req.headers.get('idempotency-key');

        if (!idempotencyKey) {
            return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 });
        }

        const payload = await verifyMainServiceAssertion(authHeader);
        const actor = await resolveExternalActor(payload.sub as string);

        if (actor.userType !== 'student') {
            return NextResponse.json({ error: 'Forbidden: Students only' }, { status: 403 });
        }

        const bodyRaw = await req.text();
        let body: any = {};
        if (bodyRaw) {
             body = JSON.parse(bodyRaw);
        }
        const requestHash = crypto.createHash('sha256').update(bodyRaw).digest('hex');

        const supabase = createClient(supabaseUrl, supabaseServiceKey!);

        // Idempotency check
        const { data: existingRecord } = await supabase
            .from('api_idempotency_records')
            .select('*')
            .eq('caller', actor.externalUserId)
            .eq('operation', 'create_supervision_request')
            .eq('idempotency_key', idempotencyKey)
            .single();

        if (existingRecord) {
            if (existingRecord.request_hash !== requestHash) {
                return NextResponse.json({ error: 'Conflict: Idempotency key reused with different payload' }, { status: 409 });
            }
            return NextResponse.json(existingRecord.response_body, { status: existingRecord.response_status });
        }

        // --- BUSINESS LOGIC HERE ---
        // (For testing purposes, we simply mock the response and save it)
        const newRequestId = crypto.randomUUID();
        const responseStatus = 201;
        const responseBody = {
            id: newRequestId,
            status: 'pending',
            project_id: body.project_id || crypto.randomUUID(),
            student_id: actor.externalUserId,
            message: 'Synthetic testing request created successfully.'
        };

        // Save idempotency record
        await supabase.from('api_idempotency_records').insert({
            caller: actor.externalUserId,
            operation: 'create_supervision_request',
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            response_status: responseStatus,
            response_body: responseBody,
            resource_id: newRequestId,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
        });

        return NextResponse.json(responseBody, { status: responseStatus });

    } catch (error: any) {
        console.error('Mutation Endpoint Error:', error.message);
        return NextResponse.json({ error: 'Authentication or processing failed' }, { status: 401 });
    }
}
