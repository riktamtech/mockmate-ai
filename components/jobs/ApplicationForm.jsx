import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Linkedin, Globe, Save } from "lucide-react";
import ResumePicker from "./ResumePicker";
import { jobService } from "../../services/jobService";

/**
 * ApplicationForm — Pre-filled form for job applications.
 * Loads candidate profile for auto-fill, includes resume picker.
 */

const FIELDS = [
  { key: "name", label: "Full Name", icon: User, type: "text" },
  { key: "email", label: "Email", icon: Mail, type: "email" },
  { key: "phone", label: "Phone", icon: Phone, type: "tel" },
  { key: "linkedIn", label: "LinkedIn", icon: Linkedin, type: "url" },
  { key: "portfolio", label: "Portfolio", icon: Globe, type: "url" },
];

export default function ApplicationForm({ jobId, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", linkedIn: "", portfolio: "",
    experience: "", resumeFile: null, resumeId: null,
  });
  const [cachedResumes, setCachedResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saveProfile, setSaveProfile] = useState(true);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const [profileRes, resumeRes] = await Promise.all([
        jobService.getCandidateProfile().catch(() => null),
        jobService.getCachedResumes().catch(() => null),
      ]);
      if (profileRes?.data) {
        const p = profileRes.data;
        setFormData(prev => ({
          ...prev,
          name: p.name || prev.name,
          email: p.email || prev.email,
          phone: p.phone || prev.phone,
          linkedIn: p.linkedIn || prev.linkedIn,
          portfolio: p.portfolio || prev.portfolio,
          experience: p.experience || prev.experience,
        }));
      }
      if (resumeRes?.data?.resumes) {
        setCachedResumes(resumeRes.data.resumes);
        if (resumeRes.data.defaultResumeId) {
          setSelectedResumeId(resumeRes.data.defaultResumeId);
          setFormData(prev => ({ ...prev, resumeId: resumeRes.data.defaultResumeId }));
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeUpload = async (file) => {
    setUploading(true);
    try {
      const res = await jobService.uploadResume(file);
      if (res?.data) {
        setFormData(prev => ({ ...prev, resumeFile: file, resumeId: res.data._id }));
        setSelectedResumeId(res.data._id);
        setCachedResumes(prev => [res.data, ...prev].slice(0, 5));
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email) return;
    if (!formData.resumeId && !formData.resumeFile) return;
    onSubmit?.({ ...formData, saveProfile });
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
    color: "#f1f1f4", fontSize: "13px", outline: "none",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ width: "24px", height: "24px", border: "2px solid rgba(139,92,246,0.2)", borderTop: "2px solid #8B5CF6", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#f1f1f4" }}>Apply for this Position</h3>

      {/* Form fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {FIELDS.map(({ key, label, icon: Icon, type }) => (
          <div key={key} style={{ position: "relative" }}>
            <Icon size={14} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: "12px", top: "12px" }} />
            <input
              type={type}
              placeholder={label}
              value={formData[key]}
              onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
              style={inputStyle}
            />
          </div>
        ))}
        <div style={{ position: "relative" }}>
          <input
            type="number"
            placeholder="Years of Experience"
            value={formData.experience}
            onChange={e => setFormData(prev => ({ ...prev, experience: e.target.value }))}
            style={{ ...inputStyle, paddingLeft: "12px" }}
            min="0" max="50"
          />
        </div>
      </div>

      {/* Resume */}
      <ResumePicker
        cachedResumes={cachedResumes}
        selectedResumeId={selectedResumeId}
        onSelectResume={r => { setSelectedResumeId(r._id); setFormData(prev => ({ ...prev, resumeId: r._id, resumeFile: null })); }}
        onUpload={handleResumeUpload}
        uploading={uploading}
      />

      {/* Save profile checkbox */}
      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
        <input type="checkbox" checked={saveProfile} onChange={e => setSaveProfile(e.target.checked)}
          style={{ accentColor: "#8B5CF6" }} />
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Save details for future applications</span>
      </label>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px" }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleSubmit}
          disabled={!formData.name || !formData.email || (!formData.resumeId && !formData.resumeFile)}
          style={{ flex: 2, padding: "12px", borderRadius: "10px", background: "linear-gradient(135deg,#8B5CF6,#3B82F6)", border: "none", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600, opacity: (!formData.name||!formData.email||(!formData.resumeId&&!formData.resumeFile)) ? 0.5 : 1 }}>
          Submit Application
        </motion.button>
      </div>
    </div>
  );
}
