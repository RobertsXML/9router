// Free OpenCode models that don't use the "-free" id suffix
const KNOWN_FREE_OPENCODE_MODELS = new Set(["big-pickle"]);

export const FILTERS = {
  "openrouter-free": (models) => {
    const result = [];
    for (const m of models) {
      if (m.pricing?.prompt === "0" && m.pricing?.completion === "0" && m.context_length >= 200000) result.push({ id: m.id, name: m.name, contextLength: m.context_length });
    }
    return result.toSorted((a, b) => b.contextLength - a.contextLength);
  },

  "opencode-free": (models) => {
    const result = [];
    for (const m of models) { if (m.id?.endsWith("-free") || KNOWN_FREE_OPENCODE_MODELS.has(m.id)) result.push({ id: m.id, name: m.id }); }
    return result;
  },

  "mimo-free": (models) => {
    const src = Array.isArray(models) ? models : [];
    const result = [];
    for (const m of src) { if (m.id?.startsWith("mimo") || m.name?.toLowerCase().includes("mimo")) result.push({ id: m.id, name: m.name || m.id }); }
    return result;
  },
};
