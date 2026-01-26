"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-8">Sentry Test Page</h1>
      <div className="flex flex-col gap-4">
        <button
          type="button"
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={() => {
            throw new Error("Sentry Frontend Error Test");
          }}
        >
          Throw Client Error
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => {
            Sentry.captureMessage("Test message from Sentry example page");
            alert("Test message sent to Sentry!");
          }}
        >
          Send Test Message
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          onClick={async () => {
            const res = await fetch("/api/sentry-example-api");
            const data = await res.json();
            alert(data.error || "Server error thrown - check Sentry!");
          }}
        >
          Trigger Server Error
        </button>
      </div>
      <p className="mt-8 text-gray-600 text-center max-w-md">
        Click the buttons above to test Sentry error tracking.
        Check your Sentry dashboard to see the captured errors.
      </p>
    </div>
  );
}
