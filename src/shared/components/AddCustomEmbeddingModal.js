"use client";

import { useState, useEffect, useMemo, useRef, useReducer } from "react";
import PropTypes from "prop-types";
import { Modal, Input, Button, Badge } from "@/shared/components";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function ValidationResult({ result }) {
  if (!result) return null;
  const { valid, error, dimensions } = result;
  if (valid) {
    return (
      <>
        <Badge variant="success">Valid</Badge>
        {dimensions && <span className="text-sm text-text-muted">{dimensions} dims</span>}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Badge variant="error">Invalid</Badge>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}

// Dual-mode modal: edit when `node` provided, add otherwise
function validationReducer(state, action) {
  switch (action.type) {
    case 'SET_KEY': return { ...state, checkKey: action.payload };
    case 'SET_MODEL_ID': return { ...state, checkModelId: action.payload };
    case 'VALIDATING': return { ...state, validating: true };
    case 'SET_RESULT': return { ...state, validating: false, validationResult: action.payload };
    case 'RESET': return { checkKey: "", checkModelId: "", validating: false, validationResult: null };
    default: return state;
  }
}

export default function AddCustomEmbeddingModal({ isOpen, onClose, onCreated, onSaved, node }) {
  const isEdit = !!node;
  const defaultFormData = useMemo(() => node
    ? { name: node.name || "", prefix: node.prefix || "", baseUrl: node.baseUrl || DEFAULT_BASE_URL }
    : { name: "", prefix: "", baseUrl: DEFAULT_BASE_URL },
    [node]
  );
  const [formData, setFormData] = useState(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [{ checkKey, checkModelId, validating, validationResult }, dispatchValidation] = useReducer(validationReducer, { checkKey: "", checkModelId: "", validating: false, validationResult: null });

  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setFormData(defaultFormData);
      dispatchValidation({ type: 'RESET' });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultFormData]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.prefix.trim() || !formData.baseUrl.trim()) return;
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/provider-nodes/${node.id}` : "/api/provider-nodes";
      const method = isEdit ? "PUT" : "POST";
      const payload = {
        name: formData.name,
        prefix: formData.prefix,
        baseUrl: formData.baseUrl,
      };
      if (!isEdit) payload.type = "custom-embedding";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if (isEdit) onSaved?.(data.node);
        else onCreated?.(data.node);
      }
    } catch (error) {
      console.log("Error saving custom embedding node:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async () => {
    dispatchValidation({ type: 'VALIDATING' });
    try {
      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          apiKey: checkKey,
          type: "custom-embedding",
          modelId: checkModelId.trim() || undefined,
        }),
      });
      const data = await res.json();
      dispatchValidation({ type: 'SET_RESULT', payload: data });
    } catch {
      dispatchValidation({ type: 'SET_RESULT', payload: { valid: false, error: "Network error" } });
    }
  };


  return (
    <Modal isOpen={isOpen} title={isEdit ? "Edit Custom Embedding" : "Add Custom Embedding"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Voyage AI"
          hint="Required. A friendly label for this embedding provider."
        />
        <Input
          label="Prefix"
          value={formData.prefix}
          onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
          placeholder="voyage"
          hint="Required. Used as the provider prefix for model IDs (e.g. voyage/voyage-3)."
        />
        <Input
          label="Base URL"
          value={formData.baseUrl}
          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          placeholder="https://api.voyageai.com/v1"
          hint="Most embedding APIs are OpenAI-compatible: Voyage, Cohere, Jina, Mistral, Together..."
        />
        <Input
          label="API Key (for Check)"
          type="password"
          value={checkKey}
          onChange={(e) => dispatchValidation({ type: 'SET_KEY', payload: e.target.value })}
        />
        <Input
          label="Model ID (for Check)"
          value={checkModelId}
          onChange={(e) => dispatchValidation({ type: 'SET_MODEL_ID', payload: e.target.value })}
          placeholder="e.g. voyage-3, embed-english-v3.0, text-embedding-3-small"
          hint="Required for validation. Will send a test embeddings request."
        />
        <div className="flex items-center gap-3">
          <Button
            onClick={handleValidate}
            disabled={!checkKey || !checkModelId.trim() || validating || !formData.baseUrl.trim()}
            variant="secondary"
          >
            {validating ? "Checking..." : "Check"}
          </Button>
          <ValidationResult result={validationResult} />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            fullWidth
            disabled={!formData.name.trim() || !formData.prefix.trim() || !formData.baseUrl.trim() || submitting}
          >
            {submitting ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save" : "Create")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

AddCustomEmbeddingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func,
  onSaved: PropTypes.func,
  node: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    prefix: PropTypes.string,
    baseUrl: PropTypes.string,
  }),
};
