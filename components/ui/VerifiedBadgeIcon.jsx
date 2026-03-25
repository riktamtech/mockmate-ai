import React from "react";
import { motion } from "framer-motion";
import verifiedBadgeImg from "../assets/Verified_Badge.jpeg";

export default function VerifiedBadgeIcon({ size = 20, style = {}, className = "" }) {
  return (
    <div 
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style
      }}
    >
      {/* Glow effect matching the blurple/coral theme */}
      <div style={{
        position: "absolute",
        inset: -2,
        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.6) 0%, rgba(249, 115, 22, 0.5) 100%)",
        filter: "blur(6px)",
        borderRadius: "50%",
        zIndex: 0,
      }} />
      
      {/* Inner container to hold image and its shimmer overlay */}
      <div style={{
        width: "100%",
        height: "100%",
        position: "relative",
        borderRadius: "50%",
        overflow: "hidden",
        zIndex: 1,
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 2px 10px rgba(99, 102, 241, 0.3)"
      }}>
        <img 
          src={verifiedBadgeImg} 
          alt="Verified Badge" 
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }} 
        />
        {/* Shimmer Overlay */}
        <motion.div
           animate={{ x: ["-100%", "200%"] }}
           transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
           style={{
             position: "absolute",
             top: 0,
             left: 0,
             width: "50%",
             height: "100%",
             background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
             transform: "skewX(-20deg)",
             pointerEvents: "none"
           }}
        />
      </div>
    </div>
  );
}
