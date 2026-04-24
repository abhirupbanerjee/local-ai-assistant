import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRoutesSettings, setRoutesSettings } from '@/lib/db/compat/config';

/**
 * GET /api/admin/routes
 * 
 * Get current routes configuration
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const settings = await getRoutesSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[Routes API] Failed to get settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/routes
 * 
 * Update routes configuration
 * Body: { route1Enabled?: boolean, route2Enabled?: boolean, route3Enabled?: boolean, primaryRoute?: string }
 */
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { route1Enabled, route2Enabled, route3Enabled, primaryRoute } = body;

    const currentSettings = await getRoutesSettings();
    
    const updates: Partial<typeof currentSettings> = {};
    if (route1Enabled !== undefined) updates.route1Enabled = route1Enabled;
    if (route2Enabled !== undefined) updates.route2Enabled = route2Enabled;
    if (route3Enabled !== undefined) updates.route3Enabled = route3Enabled;
    if (primaryRoute !== undefined) updates.primaryRoute = primaryRoute;

    await setRoutesSettings(updates);
    
    const newSettings = await getRoutesSettings();
    return NextResponse.json({ settings: newSettings });
  } catch (error) {
    console.error('[Routes API] Failed to update settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}