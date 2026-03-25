import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, CheckCircle2, Clock, Loader2,
  User, Mail, Phone, Briefcase, Globe, ChevronRight, Sparkles, AlertTriangle,
} from "lucide-react";
import { jobService } from "../../services/jobService";

/**
 * ApplicationForm — Premium application form with resume card selection.
 *
 * Features:
 *   - Pre-filled from savedProfile (User model fallback)
 *   - Resume card carousel with selection ring
 *   - Upload new resume via server-side Gemini Vision extraction
 *   - Theme-aware via CSS custom properties
 *   - "Save details for all applications" checkbox consent
 */

// ── Input Field Component ────────────────────────────────────────
function InputField({ label, icon: Icon, value, onChange, type = "text", disabled = false, placeholder = "" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{
        fontSize: "12px",
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}>
        {label}
      </label>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 14px",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        background: disabled ? "var(--bg-inset)" : "var(--bg-surface)",
        transition: "all 0.2s ease",
      }}>
        {Icon && <Icon size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: disabled ? "var(--text-muted)" : "var(--text-primary)",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily: "inherit",
          }}
        />
      </div>
    </div>
  );
}

// ── Resume Card Component ────────────────────────────────────────
function ResumeCard({ resume, isSelected, isDefault, onClick }) {
  const uploadDate = resume.uploadedAt
    ? new Date(resume.uploadedAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px 16px",
        borderRadius: "14px",
        border: isSelected
          ? "2px solid var(--accent)"
          : "1.5px solid var(--border)",
        background: isSelected
          ? "var(--accent-bg)"
          : "var(--bg-surface)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.2s ease",
        boxShadow: isSelected
          ? "0 0 0 3px var(--accent-bg), var(--shadow-sm)"
          : "var(--shadow-xs)",
      }}
    >
      {/* File icon */}
      <div style={{
        width: "40px",
        height: "40px",
        borderRadius: "10px",
        background: isSelected
          ? "var(--accent-gradient)"
          : "var(--bg-inset)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <FileText size={18} style={{
          color: isSelected ? "#fff" : "var(--text-muted)",
        }} />
      </div>

      {/* File info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {resume.fileName}
        </div>
        <div style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          marginTop: "2px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}>
          <Clock size={11} />
          {uploadDate}
        </div>
      </div>

      {/* Default badge */}
      {isDefault && (
        <span style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          padding: "3px 8px",
          borderRadius: "6px",
          background: "var(--accent-bg)",
          color: "var(--accent-text)",
        }}>
          Default
        </span>
      )}

      {/* Radio indicator */}
      <div style={{
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        border: isSelected ? "none" : "2px solid var(--border)",
        background: isSelected ? "var(--accent-gradient)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "all 0.2s ease",
      }}>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#fff",
            }}
          />
        )}
      </div>
    </motion.button>
  );
}

// ── Upload Zone Component ────────────────────────────────────────
function UploadZone({ onFileSelect, isUploading }) {
  const fileInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      disabled={isUploading}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "14px 16px",
        borderRadius: "14px",
        border: "2px dashed var(--border)",
        background: "transparent",
        cursor: isUploading ? "not-allowed" : "pointer",
        color: "var(--text-muted)",
        fontSize: "13px",
        fontWeight: 600,
        fontFamily: "inherit",
        transition: "all 0.2s ease",
        opacity: isUploading ? 0.6 : 1,
      }}
    >
      {isUploading ? (
        <>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          Extracting text & processing…
        </>
      ) : (
        <>
          <Upload size={16} />
          Upload New Resume
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,image/jpeg,image/png"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
      />
    </motion.button>
  );
}

// ── Main ApplicationForm Component ───────────────────────────────
export default function ApplicationForm({
  job,
  savedProfile,
  cachedResumes = [],
  defaultResumeId,
  onSubmit,
  onCancel,
  editMode = false,
}) {
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [experience, setExperience] = useState("");
  const [country, setCountry] = useState("");
  const [saveDetails, setSaveDetails] = useState(true);

  // Resume state
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [selectedResumeText, setSelectedResumeText] = useState("");
  const [selectedResumeS3Key, setSelectedResumeS3Key] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Pre-fill from savedProfile
  useEffect(() => {
    if (savedProfile) {
      setFirstName(savedProfile.firstName || "");
      setLastName(savedProfile.lastName || "");
      setEmail(savedProfile.email || "");
      setPhone(savedProfile.phone || "");
      setExperience(savedProfile.experience?.toString() || "");
      setCountry(savedProfile.country || "");
      
      // Default to true unless the user explicitly saved it as false
      if (savedProfile._fromUser) {
        setSaveDetails(true);
      } else {
        setSaveDetails(savedProfile.savedDetails !== false);
      }
    }
  }, [savedProfile]);

  // Pre-fill resumes
  useEffect(() => {
    if (cachedResumes?.length) {
      setResumes(cachedResumes);
      // Auto-select default resume
      if (defaultResumeId) {
        const defResume = cachedResumes.find(
          (r) => r._id === defaultResumeId || r._id?.toString() === defaultResumeId?.toString(),
        );
        if (defResume) {
          setSelectedResumeId(defResume._id?.toString());
          setSelectedResumeS3Key(defResume.resumeKey || "");
        }
      } else if (cachedResumes.length === 1) {
        setSelectedResumeId(cachedResumes[0]._id?.toString());
        setSelectedResumeS3Key(cachedResumes[0].resumeKey || "");
      }
    }
  }, [cachedResumes, defaultResumeId]);

  // Handle resume selection
  const handleResumeSelect = useCallback((resume) => {
    setSelectedResumeId(resume._id?.toString());
    setSelectedResumeS3Key(resume.resumeKey || "");
    setSelectedResumeText(""); // Will use cached text from backend
    setUploadError("");
  }, []);

  // Handle file upload via server
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError("File size must be under 10MB");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const result = await jobService.uploadApplicationResume(file);
      if (result.success && result.data) {
        const newResume = {
          _id: result.data.resumeId,
          fileName: result.data.fileName,
          resumeKey: result.data.resumeS3Key,
          uploadedAt: new Date().toISOString(),
        };

        setResumes((prev) => [newResume, ...prev]);
        setSelectedResumeId(result.data.resumeId);
        setSelectedResumeS3Key(result.data.resumeS3Key || "");
        setSelectedResumeText(result.data.extractedText || "");
      } else {
        setUploadError(result.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload resume");
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Submit handler
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!selectedResumeId && !selectedResumeText) {
        setUploadError("Please select or upload a resume");
        return;
      }

      onSubmit({
        firstName,
        lastName,
        email,
        phone,
        experience: Number(experience) || 0,
        country,
        saveDetails,
        resumeId: selectedResumeId,
        resumeS3Key: selectedResumeS3Key,
        resumeText: selectedResumeText,
      });
    },
    [firstName, lastName, email, phone, experience, country, saveDetails,
     selectedResumeId, selectedResumeS3Key, selectedResumeText, onSubmit],
  );

  const isFormValid = firstName.trim() && email.trim() && (selectedResumeId || selectedResumeText);

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0",
      }}
    >
      {/* ── Section 1: Personal Details ──────────────────────────── */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "7px",
            background: "var(--accent-gradient)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <User size={12} color="#fff" />
          </div>
          <span style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "0.2px",
          }}>
            Personal Details
          </span>
        </div>

        {/* Name row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "12px",
        }}>
          <InputField
            label="First Name"
            icon={null}
            value={firstName}
            onChange={setFirstName}
            placeholder="John"
          />
          <InputField
            label="Last Name"
            icon={null}
            value={lastName}
            onChange={setLastName}
            placeholder="Doe"
          />
        </div>

        {/* Email — read-only if from saved profile */}
        <div style={{ marginBottom: "12px" }}>
          <InputField
            label="Email"
            icon={Mail}
            value={email}
            onChange={setEmail}
            type="email"
            disabled={!!savedProfile?.email && !savedProfile?._fromUser}
            placeholder="john@example.com"
          />
        </div>

        {/* Phone + Experience row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}>
          <InputField
            label="Phone"
            icon={Phone}
            value={phone}
            onChange={setPhone}
            placeholder="+1 234 567 8900"
          />
          <InputField
            label="Experience (years)"
            icon={Briefcase}
            value={experience}
            onChange={setExperience}
            type="number"
            placeholder="3"
          />
        </div>
      </div>

      {/* ── Section 2: Resume Selection ──────────────────────────── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "14px",
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            borderRadius: "7px",
            background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <FileText size={12} color="#fff" />
          </div>
          <span style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "0.2px",
          }}>
            Resume
          </span>
          {resumes.length > 0 && (
            <span style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              fontWeight: 500,
            }}>
              ({resumes.length} saved)
            </span>
          )}
        </div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}>
          <AnimatePresence>
            {resumes.map((resume) => (
              <motion.div
                key={resume._id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ResumeCard
                  resume={resume}
                  isSelected={
                    selectedResumeId === resume._id?.toString() ||
                    selectedResumeId === resume._id
                  }
                  isDefault={
                    defaultResumeId === resume._id?.toString() ||
                    defaultResumeId === resume._id
                  }
                  onClick={() => handleResumeSelect(resume)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Upload zone */}
          <UploadZone onFileSelect={handleFileUpload} isUploading={isUploading} />

          {/* Upload error */}
          {uploadError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                margin: 0,
                fontSize: "12px",
                color: "var(--error)",
                fontWeight: 500,
                paddingLeft: "4px",
              }}
            >
              {uploadError}
            </motion.p>
          )}
        </div>
      </div>

      {/* ── Save Details Checkbox ────────────────────────────────── */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "12px",
          background: saveDetails ? "var(--accent-bg)" : "var(--bg-inset)",
          border: `1px solid ${saveDetails ? "var(--accent)" : "var(--border-subtle)"}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
          marginBottom: "20px",
        }}
      >
        <div style={{
          width: "18px",
          height: "18px",
          borderRadius: "5px",
          border: saveDetails ? "none" : "2px solid var(--border)",
          background: saveDetails ? "var(--accent-gradient)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "1px",
          transition: "all 0.15s ease",
        }}>
          {saveDetails && <CheckCircle2 size={14} color="#fff" />}
        </div>
        <div>
          <div style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            lineHeight: 1.4,
          }}>
            Save details for all applications
          </div>
          <div style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            lineHeight: 1.4,
            marginTop: "2px",
          }}>
            Skip this form next time — your profile & selected resume will be used automatically
          </div>
        </div>
        <input
          type="checkbox"
          checked={saveDetails}
          onChange={(e) => setSaveDetails(e.target.checked)}
          style={{ display: "none" }}
        />
      </label>

      {/* ── Unchecked Warning ──────────────────────────────────────── */}
      <AnimatePresence>
        {!saveDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: "20px" }}
          >
            <div style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}>
              <AlertTriangle size={16} color="#F59E0B" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div style={{
                fontSize: "12.5px",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}>
                <strong style={{ color: "#F59E0B", fontWeight: 700 }}>Note:</strong> By unchecking this, you will need to manually fill out this form and upload your resume every time you apply for a job.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action Buttons ──────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "12px",
      }}>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          style={{
            padding: "11px 24px",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "inherit",
            transition: "all 0.2s ease",
          }}
        >
          Cancel
        </motion.button>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.02, boxShadow: "0 8px 24px rgba(124,58,237,0.25)" }}
          whileTap={{ scale: 0.98 }}
          disabled={!isFormValid || isUploading}
          style={{
            padding: "11px 28px",
            borderRadius: "12px",
            background: isFormValid && !isUploading
              ? "var(--accent-gradient)"
              : "var(--bg-inset)",
            border: "none",
            color: isFormValid && !isUploading ? "#fff" : "var(--text-muted)",
            cursor: isFormValid && !isUploading ? "pointer" : "not-allowed",
            fontSize: "13px",
            fontWeight: 700,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          {editMode ? null : <Sparkles size={14} />}
          {editMode ? "Save Details" : "Submit Application"}
          {editMode ? null : <ChevronRight size={14} />}
        </motion.button>
      </div>
    </motion.form>
  );
}
