import { NextResponse } from "next/server";

const KILO_MODELS_URL = "https://api.kilo.ai/api/gateway/models";

// In-memory cache with TTL — const object to avoid mutable module state (server-no-mutable-module-state)
const _cache = { models: null, timestamp: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  const now = Date.now();

  // Return cached result if still valid
  if (_cache.models && now - _cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ models: _cache.models, cached: true });
  }

  try {
    const res = await fetch(KILO_MODELS_URL, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Kilo API returned ${res.status}`);
    }

    const json = await res.json();
    const allModels = json.data || [];

    const freeModels = [];
    for (const m of allModels) {
      if (m.isFree === true) freeModels.push({ id: m.id, name: m.name, isFree: true, context_length: m.context_length || 0 });
    }

    _cache.models = freeModels;
    _cache.timestamp = now;

    return NextResponse.json({ models: freeModels, cached: false });
  } catch (error) {
    // Return cached data if available, even if expired
    if (_cache.models) {
      return NextResponse.json({ models: _cache.models, cached: true, warning: error.message });
    }

    return NextResponse.json(
      { models: [], error: `Failed to fetch Kilo models: ${error.message}` },
      { status: 502 }
    );
  }
}
