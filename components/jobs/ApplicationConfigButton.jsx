import React, { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Pencil } from "lucide-react";
import ApplicationFlowModal from "./ApplicationFlowModal";

/**
 * ApplicationConfigButton — Allows users to edit their saved application
 * profile (name, email, phone, resume) from the Job Openings page.
 *
 * Opens the ApplicationFlowModal in "edit mode" (just the form, no fitness scoring).
 */

export default function ApplicationConfigButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowModal(true)}
        title="Edit Application Profile"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: 600,
          fontFamily: "inherit",
          transition: "all 0.2s ease",
        }}
      >
        <Pencil size={13} />
        <span>Application Profile</span>
      </motion.button>

      {/* Reuse ApplicationFlowModal in edit mode */}
      {showModal && (
        <ApplicationFlowModal
          job={null}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
          editMode={true}
        />
      )}
    </>
  );
}
