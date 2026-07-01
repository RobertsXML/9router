// Adapter singleton — extracted from driver.js to break circular dependency:
//   driver.js → migrate.js → metaStore.js → (was driver.js, now dbState.js)

// Use global to survive Next.js dev hot-reload (module state resets on reload)
if (!global._dbAdapter) global._dbAdapter = { instance: null, initPromise: null, logged: false };
const state = global._dbAdapter;

let _initFn = null;

// Called once by driver.js to register its initAdapter
export function registerInit(fn) {
  _initFn = fn;
}

export async function getAdapter() {
  if (state.instance) return state.instance;
  if (!state.initPromise) {
    if (!_initFn) throw new Error("[DB] driver not loaded — registerInit() not called");
    state.initPromise = _initFn().then((a) => { state.instance = a; return a; });
  }
  return state.initPromise;
}

export function getAdapterSync() {
  if (!state.instance) throw new Error("[DB] adapter not initialized — await getAdapter() first");
  return state.instance;
}

export function getState() {
  return state;
}
