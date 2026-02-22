import { jsPDF } from "jspdf";

// ─── Color constants (matching UI) ──────────────────────────────────
const COLORS = {
  // Header
  headerBg: [255, 255, 255],
  title: [30, 41, 59], // slate-800
  metaText: [100, 116, 139], // slate-500

  // Status badges
  completedBg: [209, 250, 229], // emerald-100
  completedText: [4, 120, 87], // emerald-700
  activeBg: [219, 234, 254], // blue-100
  activeText: [29, 78, 216], // blue-700

  // Message bubbles
  userBubbleBg: [37, 99, 235], // blue-600
  userBubbleText: [255, 255, 255],
  aiBubbleBg: [255, 255, 255],
  aiBubbleText: [51, 65, 85], // slate-700
  aiBubbleBorder: [226, 232, 240], // slate-200

  // Avatars
  userAvatarStart: [59, 130, 246], // blue-500
  userAvatarEnd: [79, 70, 229], // indigo-600
  aiAvatarBg: [255, 255, 255],
  aiAvatarBorder: [226, 232, 240],
  aiAvatarIcon: [147, 51, 234], // purple-600

  // General
  pageBg: [248, 250, 252], // slate-50
  labelText: [148, 163, 184], // slate-400
  divider: [241, 245, 249], // slate-100
};

// ─── Layout constants ───────────────────────────────────────────────
const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const AVATAR_R = 5; // avatar circle radius
const AVATAR_D = AVATAR_R * 2;
const BUBBLE_GAP = 3; // gap between avatar and bubble
const BUBBLE_MAX_W = CONTENT_W * 0.72;
const BUBBLE_PAD_X = 5;
const BUBBLE_PAD_Y = 4;
const BUBBLE_RADIUS = 3; // rounded corner radius
const MSG_FONT_SIZE = 9;
const MSG_LINE_H = 4.2;
const LABEL_FONT_SIZE = 6.5;
const MESSAGE_SPACING = 8;
const HEADER_HEIGHT = 32;

// ─── Helpers ────────────────────────────────────────────────────────

/** Draw a rounded rectangle (filled, optionally stroked) */
function roundedRect(doc, x, y, w, h, r, { fill, stroke, notchSide } = {}) {
  // notchSide: "tl" / "tr" means that corner is square (no rounding)
  const tl = notchSide === "tl" ? 0 : r;
  const tr = notchSide === "tr" ? 0 : r;
  const br = r;
  const bl = r;

  doc.roundedRect(x, y, w, h, r, r, fill && stroke ? "FD" : fill ? "F" : "S");

  // Overwrite the notch corner with a square corner
  if (notchSide) {
    const [nx, ny] = notchSide === "tl" ? [x, y] : [x + w - r, y];
    if (fill) {
      doc.rect(nx, ny, r, r, "F");
    }
  }
}

/** Wrap text to fit within maxWidth, returning array of lines */
function wrapText(doc, text, maxWidth) {
  if (!text) return [""];
  const lines = [];
  // Split by actual newlines first
  const paragraphs = text.split("\n");

  for (const para of paragraphs) {
    if (para.trim() === "") {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.getTextWidth(testLine);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length ? lines : [""];
}

/** Draw a simple circle avatar with a letter inside */
function drawAvatar(doc, cx, cy, isUser) {
  if (isUser) {
    // Blue-indigo gradient — approximate with solid blue
    doc.setFillColor(...COLORS.userAvatarStart);
    doc.circle(cx, cy, AVATAR_R, "F");
    // "U" letter
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("U", cx, cy + 1.2, { align: "center" });
  } else {
    // White circle with border
    doc.setFillColor(...COLORS.aiAvatarBg);
    doc.setDrawColor(...COLORS.aiAvatarBorder);
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, AVATAR_R, "FD");
    // "AI" letter
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.aiAvatarIcon);
    doc.setFont("helvetica", "bold");
    doc.text("AI", cx, cy + 1, { align: "center" });
  }
}

// ─── Main Export ─────────────────────────────────────────────────────

/**
 * Generate and download a styled PDF transcript.
 *
 * @param {Object} params
 * @param {Object} params.interview          – The interview object
 * @param {Array}  params.visibleHistory      – Filtered message array
 * @param {Function} params.parseMessageText  – Parses JSON AI responses
 * @param {Function} params.getQuestionIndexForMessage – Returns 1-based Q index
 */
export default async function generateTranscriptPdf({
  interview,
  visibleHistory,
  parseMessageText,
  getQuestionIndexForMessage,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let cursorY = MARGIN;

  // ─── Helper: ensure space, add page if needed ───────────────────
  const ensureSpace = (needed) => {
    if (cursorY + needed > PAGE_H - MARGIN) {
      doc.addPage();
      // Page background
      doc.setFillColor(...COLORS.pageBg);
      doc.rect(0, 0, PAGE_W, PAGE_H, "F");
      cursorY = MARGIN;
    }
  };

  // ─── Page background (first page) ───────────────────────────────
  doc.setFillColor(...COLORS.pageBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // ═══════════════════════════════════════════════════════════════════
  //  HEADER
  // ═══════════════════════════════════════════════════════════════════
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(MARGIN, cursorY, CONTENT_W, HEADER_HEIGHT, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.title);
  const titleText = interview.role || "Interview Transcript";
  doc.text(titleText, MARGIN + 3, cursorY + 7);

  // Status badge
  const statusText = (interview.status || "").toUpperCase();
  const isCompleted = statusText === "COMPLETED";
  const badgeBg = isCompleted ? COLORS.completedBg : COLORS.activeBg;
  const badgeText = isCompleted ? COLORS.completedText : COLORS.activeText;

  const badgeX = MARGIN + 3 + doc.getTextWidth(titleText) + 4;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const badgeW = doc.getTextWidth(statusText) + 6;
  doc.setFillColor(...badgeBg);
  doc.roundedRect(badgeX, cursorY + 2.5, badgeW, 6.5, 3, 3, "F");
  doc.setTextColor(...badgeText);
  doc.text(statusText, badgeX + 3, cursorY + 7);

  // Meta row: Candidate | Date | Duration
  cursorY += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.metaText);

  const metaParts = [];
  if (interview.user?.name) metaParts.push(`Name: ${interview.user.name}`);
  if (interview.date)
    metaParts.push(
      `Date: ${new Date(interview.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`,
    );
  if (interview.durationSeconds)
    metaParts.push(
      `Duration: ${Math.round(interview.durationSeconds / 60)} min`,
    );
  doc.text(metaParts.join("     "), MARGIN + 3, cursorY + 5);

  cursorY += 12;

  // Divider line
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, cursorY, MARGIN + CONTENT_W, cursorY);
  cursorY += 6;

  // ═══════════════════════════════════════════════════════════════════
  //  MESSAGES
  // ═══════════════════════════════════════════════════════════════════
  // Compute first model index offset (same logic as component)
  const firstModelIndex = (interview.history || []).findIndex(
    (m) => m.role === "model",
  );
  const offset = firstModelIndex === -1 ? 0 : firstModelIndex;

  for (let idx = 0; idx < visibleHistory.length; idx++) {
    const msg = visibleHistory[idx];
    const isUser = msg.role === "user";
    const originalIndex = offset + idx;

    // ── Determine display text ──────────────────────────────────
    let displayText;
    if (isUser) {
      const isPlaceholder =
        msg.content ===
          "Please evaluate my answer and ask the next question." ||
        msg.content === "🎤 Audio Answer Submitted";

      if (msg.content && !isPlaceholder) {
        displayText = msg.content;
      } else {
        displayText = "(Audio response)";
      }
    } else {
      const parts = msg.parts || (msg.content ? [{ text: msg.content }] : []);
      const rawText = parts.map((p) => p.text).join("");
      displayText = parseMessageText(rawText);
    }

    // ── Wrap text & measure bubble ──────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(MSG_FONT_SIZE);
    const textMaxW = BUBBLE_MAX_W - 2 * BUBBLE_PAD_X;
    const wrappedLines = wrapText(doc, displayText, textMaxW);
    const bubbleTextH = wrappedLines.length * MSG_LINE_H;
    const bubbleH = bubbleTextH + 2 * BUBBLE_PAD_Y;
    const bubbleW = Math.min(
      BUBBLE_MAX_W,
      Math.max(...wrappedLines.map((l) => doc.getTextWidth(l)), 20) +
        2 * BUBBLE_PAD_X,
    );

    // Total row height = avatar + bubble + label
    const rowH = Math.max(AVATAR_D, bubbleH) + LABEL_FONT_SIZE + 4;
    ensureSpace(rowH + MESSAGE_SPACING);

    // ── Compute X positions ─────────────────────────────────────
    let avatarCx, bubbleX;
    if (isUser) {
      // Right-aligned
      avatarCx = MARGIN + CONTENT_W - AVATAR_R;
      bubbleX = MARGIN + CONTENT_W - AVATAR_D - BUBBLE_GAP - bubbleW;
    } else {
      // Left-aligned
      avatarCx = MARGIN + AVATAR_R;
      bubbleX = MARGIN + AVATAR_D + BUBBLE_GAP;
    }

    const avatarCy = cursorY + AVATAR_R;

    // ── Draw avatar ─────────────────────────────────────────────
    drawAvatar(doc, avatarCx, avatarCy, isUser);

    // ── Draw bubble ─────────────────────────────────────────────
    if (isUser) {
      doc.setFillColor(...COLORS.userBubbleBg);
      roundedRect(doc, bubbleX, cursorY, bubbleW, bubbleH, BUBBLE_RADIUS, {
        fill: true,
        notchSide: "tr",
      });
      doc.setTextColor(...COLORS.userBubbleText);
    } else {
      doc.setFillColor(...COLORS.aiBubbleBg);
      doc.setDrawColor(...COLORS.aiBubbleBorder);
      doc.setLineWidth(0.3);
      roundedRect(doc, bubbleX, cursorY, bubbleW, bubbleH, BUBBLE_RADIUS, {
        fill: true,
        stroke: true,
        notchSide: "tl",
      });
      doc.setTextColor(...COLORS.aiBubbleText);
    }

    // ── Draw text inside bubble ─────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(MSG_FONT_SIZE);
    let textY = cursorY + BUBBLE_PAD_Y + MSG_LINE_H * 0.7;
    for (const line of wrappedLines) {
      doc.text(line, bubbleX + BUBBLE_PAD_X, textY);
      textY += MSG_LINE_H;
    }

    // ── Sender label beneath bubble ─────────────────────────────
    const labelY = cursorY + bubbleH + 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(LABEL_FONT_SIZE);
    doc.setTextColor(...COLORS.labelText);
    const labelText = isUser
      ? interview.user?.name || "Unknown User"
      : "Interviewer AI";
    if (isUser) {
      doc.text(labelText, bubbleX + bubbleW, labelY, { align: "right" });
    } else {
      doc.text(labelText, bubbleX, labelY);
    }

    cursorY = labelY + MESSAGE_SPACING;
  }

  // ─── Save ─────────────────────────────────────────────────────────
  const filename = `transcript_${(interview.role || "interview").replace(/\s+/g, "_")}_${new Date(interview.date || Date.now()).toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
