import React, { useRef, useState, useCallback, useEffect } from "react";
import { X, RotateCcw, Check, PenLine } from "lucide-react";
import { Button } from "./ui/Button";

const TERMS_TEXT = `Terms & Conditions – Proctored Interview Profile Sharing

By signing below, you acknowledge and agree to the following:

1. PROFILE SHARING
Your interview performance data, scores, evaluation results, and professional profile information (including your resume, name, contact details, experience, and skills) may be shared with partner companies, recruiters, and hiring organizations associated with MockMate and Zinterview for the purpose of job placement and recruitment.

2. DATA USAGE
Your interview recordings (video and audio), responses, behavioral analysis, and proctoring data will be collected, processed, and stored to generate your interview report. This data may be used to:
  • Generate AI-powered evaluation and feedback
  • Calculate trust and integrity scores
  • Recommend your profile to relevant job openings
  • Improve our interview AI and assessment algorithms

3. CONSENT TO PROCTORING
You consent to being monitored during the interview through:
  • Camera recording (video)
  • Screen activity monitoring
  • Tab/window switching detection
  • Copy-paste and browser behavior analysis

4. INTERVIEW CONDUCT
You agree to:
  • Complete the interview honestly and independently
  • Not use unauthorized aids, materials, or third-party assistance
  • Not leave, refresh, or switch away from the interview window
  • Ensure a stable internet connection and working camera/microphone

5. PROFILE VISIBILITY
By proceeding, you grant permission for your profile and scores to be visible to any organization that has a relevant opening matching your skills and experience. You understand that:
  • Multiple companies may view your profile
  • Companies may contact you for interviews based on your scores
  • Your performance data remains on record for future matching

6. DATA RETENTION
Your interview data will be retained for a minimum of 12 months. You may request data deletion by contacting support.

7. REVOCATION
You may revoke this consent at any time by contacting us, however, data already shared with partner companies cannot be recalled.

By signing below, you confirm that you have read, understood, and agree to all the terms and conditions stated above.`;

/**
 * Consent modal with Terms & Conditions and digital signature pad.
 */
export const ConsentModal = React.memo(
  ({ isOpen, onClose, onAccept, isLoading = false }) => {
    const canvasRef = useRef(null);
    const svgPaths = useRef([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const [hasScrolled, setHasScrolled] = useState(false);

    // ── Canvas setup ────────────────────────────────────────────────────
    useEffect(() => {
      if (!isOpen || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 3.5;
    }, [isOpen]);

    const getPos = useCallback((e) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches?.[0];
      const clientX = touch?.clientX || e.clientX;
      const clientY = touch?.clientY || e.clientY;

      const dpr = window.devicePixelRatio || 1;
      const scaleX = canvas.width / (rect.width * dpr);
      const scaleY = canvas.height / (rect.height * dpr);

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }, []);

    const startDraw = useCallback(
      (e) => {
        e.preventDefault();
        const ctx = canvasRef.current.getContext("2d");
        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        svgPaths.current.push({
          type: "M",
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
        });
        setIsDrawing(true);
      },
      [getPos],
    );

    const draw = useCallback(
      (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext("2d");
        const { x, y } = getPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        svgPaths.current.push({
          type: "L",
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
        });
        setHasSigned(true);
      },
      [isDrawing, getPos],
    );

    const stopDraw = useCallback(() => {
      setIsDrawing(false);
    }, []);

    const clearSignature = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      svgPaths.current = [];
      setHasSigned(false);
    }, []);

    const handleAccept = useCallback(() => {
      if (!hasSigned || !acknowledged) return;

      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvas.width / dpr);
      const height = Math.round(canvas.height / dpr);
      const pathData = svgPaths.current
        .map((p) => `${p.type}${p.x} ${p.y}`)
        .join(" ");

      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
        <path d="${pathData}" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>`;

      onAccept(svgString);
    }, [hasSigned, acknowledged, onAccept]);

    const handleTermsScroll = useCallback((e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      if (scrollTop + clientHeight >= scrollHeight - 20) {
        setHasScrolled(true);
      }
    }, []);

    if (!isOpen) return null;

    const canProceed = hasSigned && acknowledged;

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col animate-fade-in-up overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Terms & Conditions
              </h2>
              <p className="text-xs text-slate-500">
                Please read and sign to continue
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Terms text */}
            <div
              className="bg-slate-50 rounded-xl p-4 max-h-72 overflow-y-auto text-xs text-slate-600 leading-relaxed whitespace-pre-wrap border border-slate-200"
              onScroll={handleTermsScroll}
            >
              {TERMS_TEXT}
            </div>
            {!hasScrolled && (
              <p className="text-xs text-amber-600 font-medium text-center">
                ↓ Please scroll to the bottom to read all terms
              </p>
            )}

            {/* Signature pad */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <PenLine size={14} className="text-blue-500" />
                  Your Digital Signature
                </label>
                {hasSigned && (
                  <button
                    onClick={clearSignature}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
                  >
                    <RotateCcw size={12} /> Clear
                  </button>
                )}
              </div>
              <canvas
                ref={canvasRef}
                className="signature-canvas w-full"
                style={{ height: 150 }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              {!hasSigned && (
                <p className="text-xs text-slate-400 text-center mt-1">
                  Draw your signature above
                </p>
              )}
            </div>

            {/* Acknowledgement checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                I have read and agree to the Terms & Conditions. I consent to my
                profile, resume, and interview performance being shared with
                partner companies for job placement purposes.
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-100 flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!canProceed}
              isLoading={isLoading}
              className={`flex-1 ${
                canProceed
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  : ""
              }`}
            >
              <Check size={18} className="mr-1.5" />
              Accept & Continue
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

ConsentModal.displayName = "ConsentModal";
