import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getEnabledModel, enableModel, disableModel } from '@/lib/db/compat/enabled-models';

/**
 * POST /api/models/enabled
 * Enable a model (set enabled=1 in database)
 * Body: { modelId: string }
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { modelId } = body;

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID required' }, { status: 400 });
    }

    // Check if model exists
    const existingModel = await getEnabledModel(modelId);
    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found in database' }, { status: 404 });
    }

    // Enable the model
    await enableModel(modelId);

    return NextResponse.json({ 
      success: true, 
      modelId,
      enabled: true,
      message: `Model ${modelId} enabled`
    });
  } catch (error) {
    console.error('[Models Enabled] Failed to enable model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enable model' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/models/enabled
 * Disable a model (set enabled=0 in database)
 * Body: { modelId: string }
 */
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superuser')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { modelId } = body;

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID required' }, { status: 400 });
    }

    // Check if model exists
    const existingModel = await getEnabledModel(modelId);
    if (!existingModel) {
      return NextResponse.json({ error: 'Model not found in database' }, { status: 404 });
    }

    // Disable the model
    await disableModel(modelId);

    return NextResponse.json({ 
      success: true, 
      modelId,
      enabled: false,
      message: `Model ${modelId} disabled`
    });
  } catch (error) {
    console.error('[Models Enabled] Failed to disable model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disable model' },
      { status: 500 }
    );
  }
}