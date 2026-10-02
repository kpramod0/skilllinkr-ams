import { NextRequest, NextResponse } from 'next/server';
import { verifyMainServiceAssertion, resolveExternalActor } from '@/lib/auth/service-verifier';

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        
        // 1. Verify cryptographic signature and claims
        const payload = await verifyMainServiceAssertion(authHeader);
        
        // 2. Resolve external actor context
        const actor = await resolveExternalActor(payload.sub as string);
        
        // 3. Apply basic sanity checks
        if (actor.status !== 'active') {
            return NextResponse.json({ error: 'User is disabled in AMS' }, { status: 403 });
        }

        // Return trusted context
        return NextResponse.json({
            main_user_id: actor.mainAuthUserId,
            external_user_id: actor.externalUserId,
            user_type: actor.userType,
            institution_id: actor.institutionId,
            status: actor.status
        });
        
    } catch (error: any) {
        console.error('Context Endpoint Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 401 });
    }
}

