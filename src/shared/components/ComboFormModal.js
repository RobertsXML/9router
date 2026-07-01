"use client";

import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import ModelSelectModal from "./ModelSelectModal";

const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

function formReducer(state, action) {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.payload };
    case "SET_NAME_ERROR":
      return { ...state, nameError: action.payload };
    case "SET_MODELS":
      return { ...state, models: action.payload };
    case "SET_SHOW_MODEL_SELECT":
      return { ...state, showModelSelect: action.payload };
    case "SET_SAVING":
      return { ...state, saving: action.payload };
    case "SET_MODEL_ALIASES":
      return { ...state, modelAliases: action.payload };
    default:
      return state;
  }
}

// Inline editable model item
function ModelItem({ index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const [editing, setEditing] = useState(false);
  // eslint-disable-next-line react-doctor/no-derived-useState -- draft is an editable copy initialized from prop, modified independently by user
  const [draft, setDraft] = useState(model);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model) onEdit(trimmed);
    setEditing(false);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  };
  return (
    <div className="group flex min-w-0 items-center gap-1.5 rounded-md bg-black/[0.02] px-2 py-1 transition-colors hover:bg-black/[0.04] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
      <span className="text-[10px] font-medium text-text-muted w-3 text-center shrink-0">{index + 1}</span>
      {editing ? (
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={handleKeyDown} aria-label="Edit model name"
          className="min-w-0 flex-1 rounded border border-primary/40 bg-white px-1.5 py-0.5 font-mono text-xs text-text-main outline-none dark:bg-black/20" />
      ) : (
        <button type="button" className="min-w-0 flex-1 cursor-text truncate rounded px-1.5 py-0.5 font-mono text-xs text-text-main hover:bg-black/5 dark:hover:bg-white/5 text-left"
          onClick={() => { setDraft(model); setEditing(true); }} title="Click to edit">{model}</button>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={onMoveUp} disabled={isFirst}
          className={`p-0.5 rounded ${isFirst ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`} title="Move up">
          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
        </button>
        <button type="button" onClick={onMoveDown} disabled={isLast}
          className={`p-0.5 rounded ${isLast ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`} title="Move down">
          <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
        </button>
      </div>
      <button type="button" onClick={onRemove} className="p-0.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-all" title="Remove">
        <span className="material-symbols-outlined text-[12px]">close</span>
      </button>
    </div>
  );
}

// Reusable Combo create/edit modal. forcePrefix auto-prepends to name.
export default function ComboFormModal({ isOpen, combo, onClose, onSave, activeProviders, kindFilter = null, forcePrefix = "", title }) {
  const [state, dispatch] = useReducer(formReducer, {
    name: "",
    models: [],
    showModelSelect: false,
    saving: false,
    nameError: "",
    modelAliases: {},
  });
  const { name, models, showModelSelect, saving, nameError, modelAliases } = state;

  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Strip prefix when editing existing combo so user only edits suffix
      const editName = combo?.name
        ? (forcePrefix && combo.name.startsWith(forcePrefix) ? combo.name.slice(forcePrefix.length) : combo.name)
        : "";
      dispatch({ type: "SET_NAME", payload: editName });
      dispatch({ type: "SET_MODELS", payload: combo?.models || [] });
      dispatch({ type: "SET_NAME_ERROR", payload: "" });
    }
    prevIsOpenRef.current = isOpen;
    // eslint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- modal-init: only syncs form on open transition, not on every combo change
  }, [isOpen, combo, forcePrefix]);

  const fetchModelAliases = useCallback(() => {
    fetch("/api/models/alias").then((r) => r.ok ? r.json() : null).then((d) => d && dispatch({ type: "SET_MODEL_ALIASES", payload: d.aliases || {} })).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchModelAliases();
    return () => {};
  }, [isOpen, fetchModelAliases]);

  const validateName = (value) => {
    if (!value.trim()) { dispatch({ type: "SET_NAME_ERROR", payload: "Name is required" }); return false; }
    const full = forcePrefix + value;
    if (!VALID_NAME_REGEX.test(full)) { dispatch({ type: "SET_NAME_ERROR", payload: "Only letters, numbers, -, _ and . allowed" }); return false; }
    dispatch({ type: "SET_NAME_ERROR", payload: "" });
    return true;
  };

  const handleNameChange = (e) => {
    let value = e.target.value;
    // If user types prefix manually, strip it (we always prepend)
    if (forcePrefix && value.startsWith(forcePrefix)) value = value.slice(forcePrefix.length);
    dispatch({ type: "SET_NAME", payload: value });
    if (value) validateName(value); else dispatch({ type: "SET_NAME_ERROR", payload: "" });
  };

  const handleAddModel = (model) => {
    if (!models.includes(model.value)) dispatch({ type: "SET_MODELS", payload: [...models, model.value] });
  };
  const handleDeselectModel = (model) => {
    dispatch({ type: "SET_MODELS", payload: models.filter((m) => m !== model.value) });
  };
  const handleRemoveModel = (i) => dispatch({ type: "SET_MODELS", payload: models.filter((_, idx) => idx !== i) });
  const handleMoveUp = (i) => {
    if (i === 0) return;
    const a = [...models]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; dispatch({ type: "SET_MODELS", payload: a });
  };
  const handleMoveDown = (i) => {
    if (i === models.length - 1) return;
    const a = [...models]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; dispatch({ type: "SET_MODELS", payload: a });
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    dispatch({ type: "SET_SAVING", payload: true });
    await onSave({ name: forcePrefix + name.trim(), models });
    dispatch({ type: "SET_SAVING", payload: false });
  };

  const isEdit = !!combo;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title || (isEdit ? "Edit Combo" : "Create Combo")}>
        <div className="flex flex-col gap-3">
          <div>
            {forcePrefix ? (
              <>
                <label htmlFor="combo-name-input" className="text-sm font-medium mb-1 block">Combo Name</label>
                <div className="flex items-stretch">
                  <span className="inline-flex items-center px-2 rounded-l border border-r-0 border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.04] text-text-muted font-mono text-sm">{forcePrefix}</span>
                  <input id="combo-name-input" value={name} onChange={handleNameChange} placeholder="my-combo" aria-label="Combo name"
                    className="flex-1 min-w-0 rounded-r border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 px-2 py-1.5 font-mono text-sm outline-none focus:border-primary" />
                </div>
                {nameError && <p className="text-[11px] text-red-500 mt-0.5">{nameError}</p>}
              </>
            ) : (
              <Input label="Combo Name" value={name} onChange={handleNameChange} placeholder="my-combo" error={nameError} />
            )}
            <p className="text-[10px] text-text-muted mt-0.5">
              {forcePrefix ? `Auto-prefixed with "${forcePrefix}". ` : ""}Only letters, numbers, -, _ and . allowed
            </p>
          </div>

          <div>
            <span className="text-sm font-medium mb-1.5 block">Models</span>
            {models.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="material-symbols-outlined text-text-muted text-xl mb-1">layers</span>
                <p className="text-xs text-text-muted">No models added yet</p>
              </div>
            ) : (
              <div className="flex max-h-[55vh] min-w-0 flex-col gap-1 overflow-y-auto sm:max-h-[350px]">
                {models.map((model, index) => (
                  <ModelItem key={model} index={index} model={model}
                    isFirst={index === 0} isLast={index === models.length - 1}
                    onEdit={(v) => { const a = [...models]; a[index] = v; dispatch({ type: "SET_MODELS", payload: a }); }}
                    onMoveUp={() => handleMoveUp(index)}
                    onMoveDown={() => handleMoveDown(index)}
                    onRemove={() => handleRemoveModel(index)} />
                ))}
              </div>
            )}
            <button type="button" onClick={() => dispatch({ type: "SET_SHOW_MODEL_SELECT", payload: true })}
              className="w-full mt-2 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-primary font-medium hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Model
            </button>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">Cancel</Button>
            <Button onClick={handleSave} fullWidth size="sm" disabled={!name.trim() || !!nameError || saving}>
              {saving ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      <ModelSelectModal isOpen={showModelSelect} onClose={() => dispatch({ type: "SET_SHOW_MODEL_SELECT", payload: false })}
        onSelect={handleAddModel} onDeselect={handleDeselectModel}
        activeProviders={activeProviders} modelAliases={modelAliases}
        title="Add Model to Combo" kindFilter={kindFilter}
        addedModelValues={models} closeOnSelect={false} />
    </>
  );
}
