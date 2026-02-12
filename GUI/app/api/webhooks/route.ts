import { NextRequest, NextResponse } from 'next/server';

export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: {
    uploadId: string;
    objectName: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    details?: Record<string, any>;
  };
  signature?: string;
}

let webhookEvents: (WebhookEvent & { receivedAt: string })[] = [];

export async function POST(request: NextRequest) {
  try {
    const body: WebhookEvent = await request.json();

    const eventWithTimestamp = {
      ...body,
      receivedAt: new Date().toISOString(),
    };

    webhookEvents.push(eventWithTimestamp);

    if (webhookEvents.length > 1000) {
      webhookEvents = webhookEvents.slice(-1000);
    }

    return NextResponse.json(
      { success: true, message: 'Event recorded' },
      { status: 200 },
    );
  } catch (error) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process webhook' },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json(webhookEvents, { status: 200 });
}

export async function DELETE() {
  webhookEvents = [];
  return NextResponse.json(
    { success: true, message: 'Events cleared' },
    { status: 200 },
  );
}
