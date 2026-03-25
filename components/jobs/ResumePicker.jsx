import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Check,
  Clock,
  Trash2,
  Star,
} from "lucide-react";

/**
 * ResumePicker — Resume selector + uploader with LRU cache display.
 * Fully theme-aware via CSS custom properties.
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function ResumePicker({
  cachedResumes = [],
  selectedResumeId,
  onSelectResume,
  onUpload,
  uploading = false,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PDF and DOC/DOCX files are accepted");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File size must be under 5MB");
      return false;
    }
    setError(null);
    return true;
  };

  const handleFileSelect = (file) => {
    if (validateFile(file)) {
      onUpload?.(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h4
        style={{
          margin: 0,
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        Select Resume
      </h4>

      {/* Cached resumes */}
      {cachedResumes.length > 0 && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "6px" }}
        >
          {cachedResumes.map((resume) => {
            const isSelected = selectedResumeId === resume._id;
            return (
              <motion.button
                key={resume._id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectResume?.(resume)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: isSelected
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border-subtle)",
                  background: isSelected
                    ? "var(--accent-bg)"
                    : "var(--bg-surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: isSelected
                      ? "var(--accent-bg)"
                      : "var(--hover-overlay-medium)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected ? (
                    <Check size={14} style={{ color: "var(--accent-text)" }} />
                  ) : (
                    <FileText
                      size={14}
                      style={{ color: "var(--text-muted)" }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {resume.fileName}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Clock size={10} />
                    {new Date(resume.uploadedAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" },
                    )}
                  </p>
                </div>
                {resume.isDefault && (
                  <Star
                    size={12}
                    style={{ color: "var(--warning)" }}
                    fill="currentColor"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Upload area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: "20px",
          borderRadius: "12px",
          border: dragOver
            ? "2px dashed var(--accent)"
            : "2px dashed var(--border-subtle)",
          background: dragOver
            ? "var(--accent-bg)"
            : "transparent",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          transition: "all 0.2s",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
          style={{ display: "none" }}
        />

        {uploading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{
              width: "24px",
              height: "24px",
              border: "2px solid var(--spinner-track)",
              borderTop: "2px solid var(--spinner-fill)",
              borderRadius: "50%",
            }}
          />
        ) : (
          <Upload
            size={20}
            style={{
              color: dragOver
                ? "var(--accent-text)"
                : "var(--text-muted)",
            }}
          />
        )}
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: dragOver
              ? "var(--accent-text)"
              : "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {uploading
            ? "Uploading..."
            : "Drop resume here or click to browse"}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "10px",
            color: "var(--text-muted)",
          }}
        >
          PDF, DOC, DOCX • Max 5MB
        </p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--error)",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "var(--error-bg)",
            }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
