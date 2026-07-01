// Standalone registry — no imports from index.js, breaks circular dependency.
// Translator sub-modules import register() from here instead of index.js.

// var (not let): hoisted as undefined so register() can run during circular import (no TDZ).
var requestRegistry;
var responseRegistry;

// Register translator
export function register(from, to, requestFn, responseFn) {
  requestRegistry ??= new Map();
  responseRegistry ??= new Map();
  const key = `${from}:${to}`;
  if (requestFn) {
    requestRegistry.set(key, requestFn);
  }
  if (responseFn) {
    responseRegistry.set(key, responseFn);
  }
}

export function getRequestRegistry() {
  return requestRegistry;
}

export function getResponseRegistry() {
  return responseRegistry;
}
