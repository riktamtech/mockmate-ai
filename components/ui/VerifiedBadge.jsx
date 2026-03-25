import React from "react";
import { motion } from "framer-motion";
import VerifiedBadgeIcon from "./VerifiedBadgeIcon";

/**
 * VerifiedBadge — A beautiful, shiny, glassmorphism badge
 * to represent Zinterview Verified Hiring.
 */
export default function VerifiedBadge({ showText = true, style = {}, className = "" }) {
  // Use a premium blurple/coral theme or transparent container
  // It gives a "premium/exclusive" feel which draws attention
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -2 }}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: showText ? "6px" : "0px",
        padding: showText ? "4px 12px" : "0px",
        borderRadius: showText ? "20px" : "50%",
        background: showText ? "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)" : "transparent",
        border: showText ? "1px solid rgba(99, 102, 241, 0.3)" : "none",
        color: showText ? "#F97316" : "inherit",
        backdropFilter: showText ? "blur(12px)" : "none",
        boxShadow: showText ? "0 4px 16px rgba(99, 102, 241, 0.2), inset 0 0 12px rgba(255, 255, 255, 0.05)" : "none",
        fontSize: "12px",
        fontWeight: 700,
        position: "relative",
        overflow: showText ? "hidden" : "visible",
        ...style,
      }}
    >
      {showText && (
        <motion.div
          animate={{ x: ["-200%", "300%"] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
            repeatDelay: 1,
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "40%",
            height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)",
            transform: "skewX(-20deg)",
            pointerEvents: "none",
          }}
        />
      )}
      <VerifiedBadgeIcon 
        size={showText ? 20 : 30} 
      />
      {showText && (
        <span style={{ 
          letterSpacing: "0.3px", 
          textShadow: "0 1px 2px rgba(0,0,0,0.1)",
          position: "relative",
          zIndex: 1 
        }}>
          Verified Hiring
        </span>
      )}
    </motion.div>
  );
}
