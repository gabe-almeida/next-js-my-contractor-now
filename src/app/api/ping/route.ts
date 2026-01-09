import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ 
    status: 'received', 
    body: body,
    timestamp: new Date().toISOString() 
  });
}
