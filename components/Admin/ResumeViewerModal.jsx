import React from "react";
import { createPortal } from "react-dom";
import { api } from "../../services/api";
import { FileText, ExternalLink, Download, X, Loader2 } from "lucide-react";

const ResumeViewerModal = ({ resumeModal, setResumeModal }) => {
  if (!resumeModal.open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center px-4"
      onClick={() =>
        setResumeModal({
          open: false,
          url: "",
          fileName: "",
          id: null,
          loading: false,
        })
      }
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header bar */}
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 backdrop-blur rounded-xl">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Resume Viewer</h3>
              <p className="text-white/70 text-xs">{resumeModal.fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {resumeModal.url && (
              <>
                <a
                  href={resumeModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all backdrop-blur"
                >
                  <ExternalLink size={14} />
                  Open
                </a>
                <button
                  onClick={async () => {
                    try {
                      const data = await api.getAdminProctoredResumeUrl(
                        resumeModal.id,
                        true,
                      );
                      const tempLink = document.createElement("a");
                      tempLink.href = data.url;
                      tempLink.download = resumeModal.fileName || "resume.pdf";
                      document.body.appendChild(tempLink);
                      tempLink.click();
                      document.body.removeChild(tempLink);
                    } catch (err) {
                      console.error("Download failed:", err);
                      window.open(resumeModal.url, "_blank");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all backdrop-blur"
                >
                  <Download size={14} />
                  Download
                </button>
              </>
            )}
            <button
              onClick={() =>
                setResumeModal({
                  open: false,
                  url: "",
                  fileName: "",
                  id: null,
                  loading: false,
                })
              }
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all backdrop-blur ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden relative bg-slate-100 flex items-center justify-center p-4">
          {resumeModal.loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-violet-600 animate-spin" />
              <p className="text-sm text-slate-500 font-medium">
                Loading resume...
              </p>
            </div>
          ) : resumeModal.url ? (
            <iframe
              src={`${resumeModal.url}#toolbar=0&navpanes=0`}
              className="w-full h-full rounded-xl shadow-inner border border-slate-200 bg-white"
              title="Resume Viewer"
            />
          ) : (
            <div className="text-center">
              <FileText size={48} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                No resume matched or failed to load.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ResumeViewerModal;
