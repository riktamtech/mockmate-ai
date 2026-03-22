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
 *
 * Shows last 5 resumes with selection, drag-and-drop upload,
 * and file validation.
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
          color: "#f1f1f4",
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
                    ? "1px solid rgba(139, 92, 246, 0.5)"
                    : "1px solid rgba(255, 255, 255, 0.06)",
                  background: isSelected
                    ? "rgba(139, 92, 246, 0.08)"
                    : "rgba(255, 255, 255, 0.02)",
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
                      ? "rgba(139, 92, 246, 0.15)"
                      : "rgba(255, 255, 255, 0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected ? (
                    <Check size={14} color="#8B5CF6" />
                  ) : (
                    <FileText
                      size={14}
                      color="rgba(255, 255, 255, 0.3)"
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
                        ? "#f1f1f4"
                        : "rgba(255, 255, 255, 0.6)",
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
                      color: "rgba(255, 255, 255, 0.3)",
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
                    color="#F59E0B"
                    fill="#F59E0B"
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
            ? "2px dashed rgba(139, 92, 246, 0.5)"
            : "2px dashed rgba(255, 255, 255, 0.08)",
          background: dragOver
            ? "rgba(139, 92, 246, 0.05)"
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
              border: "2px solid rgba(139, 92, 246, 0.2)",
              borderTop: "2px solid #8B5CF6",
              borderRadius: "50%",
            }}
          />
        ) : (
          <Upload
            size={20}
            color={
              dragOver
                ? "rgba(139, 92, 246, 0.8)"
                : "rgba(255, 255, 255, 0.3)"
            }
          />
        )}
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: dragOver
              ? "rgba(139, 92, 246, 0.8)"
              : "rgba(255, 255, 255, 0.35)",
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
            color: "rgba(255, 255, 255, 0.2)",
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
              color: "rgba(239, 68, 68, 0.8)",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.08)",
            }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
