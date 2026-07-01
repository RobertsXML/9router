"use client";

import { useEffect, useEffectEvent, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { marked } from "marked";
import { GITHUB_CONFIG } from "@/shared/constants/config";

marked.setOptions({ gfm: true, breaks: true });

function sanitizeHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?iframe[^>]*>/gi, "")
    .replace(/<\/?object[^>]*>/gi, "")
    .replace(/<\/?embed[^>]*>/gi, "")
    .replace(/<\/?form[^>]*>/gi, "")
    .replace(/\son\w+\s*=/gi, " data-sanitized=")
    .replace(/\bhref\s*=\s*["']?\s*javascript\s*:/gi, 'href="javascript:void(0)"')
    .replace(/\bsrc\s*=\s*["']?\s*javascript\s*:/gi, 'src=""');
}

function changelogReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START': return { ...state, loading: true };
    case 'FETCH_SUCCESS': return { html: action.html, loading: false, error: "" };
    case 'FETCH_ERROR': return { html: "", loading: false, error: action.error };
    case 'RESET': return { html: "", loading: false, error: "" };
    default: return state;
  }
}

export default function ChangelogModal({ isOpen, onClose }) {
  const [{ html, loading, error }, dispatch] = useReducer(changelogReducer, { html: "", loading: false, error: "" });
  const modalRef = useRef(null);

  const isOpenRef = useRef(false);
  useEffect(function fetchChangelog() {
    if (!isOpen) { isOpenRef.current = false; dispatch({ type: 'RESET' }); return; }
    if (isOpenRef.current) return;
    isOpenRef.current = true;
    const controller = new AbortController();
    dispatch({ type: 'FETCH_START' });
    function onResponse(res) { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); }
    function onMarkdown(md) { if (!controller.signal.aborted) dispatch({ type: 'FETCH_SUCCESS', html: marked.parse(md) }); }
    function onError(err) { if (!controller.signal.aborted) dispatch({ type: 'FETCH_ERROR', error: err.message || "Failed to load" }); }
    fetch(GITHUB_CONFIG.changelogUrl, { signal: controller.signal })
      .then(onResponse)
      .then(onMarkdown)
      .catch(onError);
    return () => controller.abort();
  }, [isOpen]);

  const handleClose = useEffectEvent(() => onClose());
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className="relative w-full bg-surface border border-black/10 dark:border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-w-3xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-black/5 dark:border-white/5">
          <h2 className="text-lg font-semibold text-text-main">Change Log</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-10 text-text-muted">
              <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
              Loading...
            </div>
          )}
          {error && (
            <div className="text-red-500 py-4">Failed to load changelog: {error}</div>
          )}
          {!loading && !error && html && (
            <div
              className="changelog-body text-text-main"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

ChangelogModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
