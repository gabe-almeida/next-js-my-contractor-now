/**
 * PostHog Funnel Sync Service
 *
 * WHY: Auto-creates/updates/deletes PostHog funnel insights when service types
 *      change in the database, so each service type always has a matching funnel
 *      with the correct steps, filters, and breakdown.
 * WHEN: Called from service-type API routes after CREATE, UPDATE, or DELETE.
 * HOW: Uses PostHog's REST API to manage insights. Tags funnels with a
 *      convention so we can find and update them later.
 *
 * Required env vars:
 *   POSTHOG_PERSONAL_API_KEY - Personal API key from PostHog settings
 *   POSTHOG_PROJECT_ID       - Project ID (visible in PostHog project URL)
 */

const POSTHOG_API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

/** Tag prefix used to link PostHog insights back to our service types */
const FUNNEL_TAG = 'auto-funnel';

function isConfigured(): boolean {
  return !!(POSTHOG_API_KEY && POSTHOG_PROJECT_ID);
}

function getHeaders() {
  return {
    'Authorization': `Bearer ${POSTHOG_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function getBaseUrl() {
  return `${POSTHOG_API_HOST}/api/projects/${POSTHOG_PROJECT_ID}`;
}

/** Build the standard funnel filter for a service type */
function buildFunnelFilters(serviceSlug: string) {
  const serviceFilter = {
    key: 'service_type',
    value: [serviceSlug],
    operator: 'exact',
    type: 'event',
  };

  return {
    insight: 'FUNNELS',
    funnel_viz_type: 'steps',
    date_from: '-30d',
    funnel_window_days: 14,
    funnel_order_type: 'ordered',
    events: [
      {
        id: 'service_selected',
        order: 0,
        name: 'service_selected',
        type: 'events',
        properties: [serviceFilter],
      },
      {
        id: 'form_step_viewed',
        order: 1,
        name: 'form_step_viewed',
        type: 'events',
        properties: [serviceFilter],
      },
      {
        id: 'form_step_completed',
        order: 2,
        name: 'form_step_completed',
        type: 'events',
        properties: [serviceFilter],
      },
      {
        id: 'form_submitted',
        order: 3,
        name: 'form_submitted',
        type: 'events',
        properties: [serviceFilter],
      },
      {
        id: 'lead_converted',
        order: 4,
        name: 'lead_converted',
        type: 'events',
        properties: [serviceFilter],
      },
    ],
  };
}

/**
 * Find an existing auto-created funnel insight for a service type.
 * Uses the description field to store our tag: "auto-funnel:{slug}"
 */
async function findExistingFunnel(serviceSlug: string): Promise<{ id: number; short_id: string } | null> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/insights/?limit=100&short_id=&search=${encodeURIComponent(`${FUNNEL_TAG}:${serviceSlug}`)}`,
      { headers: getHeaders() }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const match = data.results?.find(
      (insight: any) => insight.description === `${FUNNEL_TAG}:${serviceSlug}`
    );

    return match ? { id: match.id, short_id: match.short_id } : null;
  } catch (error) {
    console.error(`[PostHog Funnel] Error searching for funnel "${serviceSlug}":`, error);
    return null;
  }
}

/**
 * Create or update a PostHog funnel insight for a service type.
 * Called after service type CREATE or UPDATE.
 */
export async function syncPostHogFunnel(serviceSlug: string, displayName: string): Promise<void> {
  if (!isConfigured()) {
    console.log('[PostHog Funnel] Skipping sync — POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID not set');
    return;
  }

  try {
    const existing = await findExistingFunnel(serviceSlug);
    const funnelName = `${displayName} Funnel`;
    const body = {
      name: funnelName,
      description: `${FUNNEL_TAG}:${serviceSlug}`,
      filters: buildFunnelFilters(serviceSlug),
      saved: true,
    };

    if (existing) {
      // Update existing funnel
      const res = await fetch(`${getBaseUrl()}/insights/${existing.id}/`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      if (res.ok) {
        console.log(`[PostHog Funnel] Updated funnel "${funnelName}" (ID: ${existing.id})`);
      } else {
        const errText = await res.text();
        console.error(`[PostHog Funnel] Failed to update funnel "${funnelName}": ${res.status} ${errText}`);
      }
    } else {
      // Create new funnel
      const res = await fetch(`${getBaseUrl()}/insights/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json();
        console.log(`[PostHog Funnel] Created funnel "${funnelName}" (ID: ${result.id})`);
      } else {
        const errText = await res.text();
        console.error(`[PostHog Funnel] Failed to create funnel "${funnelName}": ${res.status} ${errText}`);
      }
    }
  } catch (error) {
    // Non-blocking — don't fail the service type operation if PostHog sync fails
    console.error(`[PostHog Funnel] Error syncing funnel for "${serviceSlug}":`, error);
  }
}

/**
 * Delete the PostHog funnel insight for a service type.
 * Called after service type DELETE or deactivation.
 */
export async function deletePostHogFunnel(serviceSlug: string): Promise<void> {
  if (!isConfigured()) return;

  try {
    const existing = await findExistingFunnel(serviceSlug);
    if (!existing) return;

    const res = await fetch(`${getBaseUrl()}/insights/${existing.id}/`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    if (res.ok || res.status === 204) {
      console.log(`[PostHog Funnel] Deleted funnel for "${serviceSlug}" (ID: ${existing.id})`);
    } else {
      console.error(`[PostHog Funnel] Failed to delete funnel for "${serviceSlug}": ${res.status}`);
    }
  } catch (error) {
    console.error(`[PostHog Funnel] Error deleting funnel for "${serviceSlug}":`, error);
  }
}

/**
 * Sync all service types — creates funnels for any that don't have one yet.
 * Useful as a one-time backfill for existing service types.
 */
export async function syncAllFunnels(
  serviceTypes: Array<{ name: string; displayName: string | null }>
): Promise<void> {
  if (!isConfigured()) {
    console.log('[PostHog Funnel] Skipping bulk sync — not configured');
    return;
  }

  for (const st of serviceTypes) {
    await syncPostHogFunnel(st.name, st.displayName || st.name);
  }
}
