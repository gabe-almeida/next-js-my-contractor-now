import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

class SentryExampleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SentryExampleError";
  }
}

export function GET() {
  throw new SentryExampleError("Sentry Server Error Test");
  return NextResponse.json({ error: "This should not be reached" });
}
