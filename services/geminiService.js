import { api } from "./api";

const extractDisplayText = (text) => {
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (parsed.response) return parsed.response;
    if (parsed.message) return parsed.message;
    return text;
  } catch (e) {
    return text;
  }
};

export const convertHistoryToMessages = (history) => {
  const messages = [];
  history.forEach((turn, index) => {
    if (turn.role === "model" || turn.role === "user") {
      // ── New MessageSchema format (embedded) ──
      // Has `content` (string) and optionally `audioS3Key`
      const isNewFormat = turn.content !== undefined && !turn.parts;

      let textToShow = "";
      let hasAudio = false;

      if (isNewFormat) {
        textToShow = turn.content || "";
        hasAudio = !!turn.audioS3Key;

        if (turn.role === "user" && hasAudio) {
          // Use embedded content directly — it's the authoritative transcript
          if (
            textToShow &&
            textToShow !== "[No transcript available]" &&
            textToShow !== "[Silent]" &&
            !textToShow.startsWith("[Transcription Failed")
          ) {
            textToShow = turn.content;
          } else {
            textToShow = "🎤 Audio Answer Submitted";
          }
        } else if (turn.role === "user") {
          textToShow = turn.content;
        } else if (turn.role === "model") {
          textToShow = extractDisplayText(textToShow);
        }
      } else {
        // ── Old format (parts-based, backward compatibility) ──
        const parts =
          turn.parts || (turn.content ? [{ text: turn.content }] : []);

        const hasInlineData = parts.some((p) => p.inlineData);
        const textPart = parts.find((p) => p.text);
        textToShow = textPart ? textPart.text : "";
        hasAudio =
          hasInlineData &&
          parts.some((p) => p.inlineData?.mimeType?.startsWith("audio/"));

        if (turn.role === "user") {
          if (hasAudio) {
            // For old format with audio, check if we have useful text
            if (
              !textToShow ||
              textToShow === "[Silent]" ||
              textToShow.startsWith("[Transcription Failed")
            ) {
              textToShow = "🎤 Audio Answer Submitted";
            }
          } else if (hasInlineData) {
            const mimeType =
              parts.find((p) => p.inlineData)?.inlineData?.mimeType || "";
            if (
              mimeType === "application/pdf" ||
              mimeType.startsWith("image/")
            ) {
              if (textToShow?.includes("Here is my resume")) {
                textToShow = "📄 Resume Uploaded";
              }
            }
          }
        } else if (turn.role === "model") {
          textToShow = extractDisplayText(textToShow);
        }
      }

      if (textToShow) {
        if (
          textToShow ===
          "Start the interview now. Introduce yourself briefly and ask 'Tell me about yourself' as your first question."
        ) {
          return;
        }
        messages.push({
          id: `hist-${index}`,
          role: turn.role,
          text: textToShow || "",
          timestamp: turn.timestamp
            ? new Date(turn.timestamp)
            : turn.createdAt
              ? new Date(turn.createdAt)
              : new Date(),
          isThinking: false,
          isAudio:
            turn.role === "user" &&
            hasAudio &&
            textToShow === "🎤 Audio Answer Submitted",
        });
      }
    }
  });
  return messages;
};

export class BackendChatSession {
  constructor(model, config, initialHistory = []) {
    this.modelName = model;
    this.instructionType = config.instructionType || null; // 'coordinator', 'resumeCoordinator', 'interviewer', 'setupVerifier'
    this.interviewContext = config.interviewContext || null; // { role, focusArea, level, jd, hasResume, totalQuestions }
    this.maxOutputTokens = config.maxOutputTokens || 1024;
    this.language = config.language || "English";
    this.history = initialHistory;
    this.interviewId = config.interviewId || null;
  }
}

export const createCoordinatorChat = (language = "English") => {
  return new BackendChatSession("mockmate-coordinator", {
    language,
    instructionType: "coordinator", // Backend handles the actual system instruction
  });
};

export const createResumeCoordinatorChat = (language = "English") => {
  return new BackendChatSession("mockmate-coordinator", {
    maxOutputTokens: 1024,
    language,
    instructionType: "resumeCoordinator", // Backend handles the actual system instruction
  });
};

export const formatResumeAnalysis = (analysis) => {
  const { greeting, strengthsSummary, suggestedRoles, suggestion } = analysis;

  let message = `${greeting} ${strengthsSummary}\n\n`;
  message += `Based on your background, I suggest we practice for one of these roles:\n\n`;

  suggestedRoles.forEach((role, index) => {
    message += `**${index + 1}. ${role.role}**: ${role.reason} *(Focus: ${role.focusArea})*\n\n`;
  });

  message += `${suggestion}`;

  return message;
};

export const analyzeResumeStructured = async (
  fileBase64,
  mimeType,
  language = "English",
) => {
  const analysis = await api.analyzeResume(fileBase64, mimeType, language);
  return analysis;
};

export const sendResumeToChat = async (
  chat,
  fileBase64,
  mimeType,
  language = "English",
) => {
  try {
    const analysis = await analyzeResumeStructured(
      fileBase64,
      mimeType,
      language,
    );

    const formattedMessage = formatResumeAnalysis(analysis);

    chat.resumeAnalysis = analysis;

    chat.history.push({
      role: "user",
      parts: [
        { inlineData: { mimeType, data: fileBase64 } },
        { text: "Here is my resume. Please analyze it." },
      ],
    });

    chat.history.push({
      role: "model",
      parts: [{ text: formattedMessage }],
    });

    return { text: formattedMessage, analysis };
  } catch (error) {
    console.error("Error in structured resume analysis:", error);
    let fullText = "";

    const messagePart = {
      parts: [
        { inlineData: { mimeType, data: fileBase64 } },
        {
          text: "Here is my resume. Please analyze it briefly, identify my top 2-3 strengths, and suggest 2-3 interview roles I could practice for. Keep it concise.",
        },
      ],
    };

    await sendMessageStream(chat, messagePart, (chunk) => {
      fullText += chunk;
    });

    return { text: fullText, analysis: null };
  }
};

export const createInterviewerChat = (
  context,
  existingHistory = [],
  interviewId = null,
) => {
  const interviewContext = {
    role: context.role || null,
    focusArea: context.focusArea || null,
    level: context.level || null,
    jd: context.jd || null,
    hasResume: !!context.resumeData,
    totalQuestions: context.totalQuestions || 10,
  };

  let history = existingHistory.length > 0 ? existingHistory : [];

  if (history.length === 0 && context.resumeData) {
    history = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: context.resumeData.base64,
              mimeType: context.resumeData.mimeType,
            },
          },
          {
            text: "Here is my resume. Please use it to tailor the interview questions, specifically asking about my projects and past experience.",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "I have reviewed your resume. I will now conduct the interview focusing on your specific experiences and the target role.",
          },
        ],
      },
    ];
  }

  return new BackendChatSession(
    "mockmate-interviewer",
    {
      instructionType: "interviewer",
      interviewContext, // Pass context params to backend
      language: context.language,
      interviewId: interviewId,
    },
    history,
  );
};

export const generateFeedback = async (
  history,
  language = "English",
  interviewId = null,
) => {
  const transcript = history
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  try {
    return await api.generateFeedback(transcript, language, interviewId);
  } catch (error) {
    console.error("Error generating feedback:", error);
    return {
      overallScore: 0,
      communicationScore: 0,
      technicalScore: 0,
      strengths: ["Could not generate feedback"],
      weaknesses: ["Backend Error"],
      suggestion: "Please try again.",
    };
  }
};

export const sendMessageStream = async (
  chatSession,
  messageInput,
  onChunk,
  { questionIndex, interactionId } = {},
) => {
  if (!chatSession) return;
  let fullText = "";
  let streamMetadata = null;

  let userContent;
  if (typeof messageInput === "string") {
    userContent = { role: "user", parts: [{ text: messageInput }] };
  } else if (messageInput.parts) {
    userContent = { role: "user", parts: messageInput.parts };
  } else {
    userContent = {
      role: "user",
      parts: [{ text: JSON.stringify(messageInput) }],
    };
  }

  try {
    const useStructuredOutput =
      chatSession.modelName === "mockmate-coordinator" ||
      chatSession.modelName === "mockmate-interviewer";

    const config = {
      instructionType: chatSession.instructionType,
      interviewContext: chatSession.interviewContext,
      modelName: chatSession.modelName,
      maxOutputTokens: chatSession.maxOutputTokens,
      language: chatSession.language,
      interviewId: chatSession.interviewId,
      useStructuredOutput,
      questionIndex,
      interactionId,
    };

    let previousLength = 0;

    await api.chatStream(
      chatSession.history,
      messageInput,
      config,
      (chunk) => {
        if (
          useStructuredOutput &&
          fullText.length > 0 &&
          chunk.startsWith(fullText)
        ) {
          const newPart = chunk.slice(fullText.length);
          fullText = chunk;
          if (newPart) onChunk(newPart);
        } else if (
          useStructuredOutput &&
          chunk.length > fullText.length &&
          fullText.length > 0 &&
          chunk.includes(fullText.slice(0, Math.min(50, fullText.length)))
        ) {
          fullText = chunk;
          onChunk(chunk);
        } else {
          fullText += chunk;
          onChunk(chunk);
        }
      },
      (metadata) => {
        // Capture metadata from stream trailer (historyIds)
        streamMetadata = metadata;
      },
    );

    chatSession.history.push(userContent);

    if (useStructuredOutput) {
      // Helper to try parsing JSON, with fallback to extracting the JSON block
      const parseJSONWithExtraction = (text) => {
        try {
          return JSON.parse(text);
        } catch (err) {
          const startIndex = text.indexOf("{");
          const endIndex = text.lastIndexOf("}");
          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            try {
              return JSON.parse(text.substring(startIndex, endIndex + 1));
            } catch (innerErr) {
              throw innerErr;
            }
          }
          throw err;
        }
      };

      try {
        const parsed = parseJSONWithExtraction(fullText);
        chatSession.history.push({
          role: "model",
          parts: [{ text: fullText }],
        });
        chatSession.lastStructuredResponse = parsed;
        // Attach metadata to return value
        if (streamMetadata) parsed._metadata = streamMetadata;
        return parsed;
      } catch (e) {
        chatSession.history.push({
          role: "model",
          parts: [{ text: fullText }],
        });
      }
    } else {
      chatSession.history.push({ role: "model", parts: [{ text: fullText }] });
    }
  } catch (error) {
    console.error("Error in chat stream:", error);
    onChunk("Error communicating with AI service.");
  }

  // For non-structured output, try to extract fields if it vaguely looks like JSON
  const fallback = { response: fullText, message: fullText };
  if (streamMetadata) fallback._metadata = streamMetadata;

  try {
    const qnMatch = fullText.match(/"questionNumber"\s*:\s*(\d+)/);
    if (qnMatch) fallback.questionNumber = parseInt(qnMatch[1], 10);

    const icMatch = fullText.match(/"isInterviewComplete"\s*:\s*(true|false)/);
    if (icMatch) fallback.isInterviewComplete = icMatch[1] === "true";

    const responseMatch = fullText.match(
      /"(response|message)"\s*:\s*"((?:[^"\\]|\\.)*)/,
    );
    if (responseMatch) {
      const field = responseMatch[1];
      fallback[field] = responseMatch[2]
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  } catch (_) {}

  return fallback;
};

export const sendAudioMessage = async (
  chatSession,
  base64Audio,
  mimeType,
  questionIndex,
  interactionId = null,
) => {
  if (!chatSession) return;
  const message = {
    parts: [
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Audio,
        },
      },
      {
        text: "Please evaluate my answer and ask the next question.",
      },
    ],
  };

  let fullText = "";
  const structuredResponse = await sendMessageStream(
    chatSession,
    message,
    (chunk) => {
      fullText += chunk;
    },
    { questionIndex, interactionId },
  );

  if (structuredResponse && typeof structuredResponse === "object") {
    // If it's the fallback wrapper, we can return it directly.
    return structuredResponse;
  }

  try {
    let parsed;
    try {
      parsed = JSON.parse(fullText);
    } catch (parseErr) {
      const startIndex = fullText.indexOf("{");
      const endIndex = fullText.lastIndexOf("}");
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        parsed = JSON.parse(fullText.substring(startIndex, endIndex + 1));
      } else {
        throw parseErr;
      }
    }

    // Preserve metadata if available
    if (structuredResponse?._metadata) {
      parsed._metadata = structuredResponse._metadata;
    }
    return parsed;
  } catch (e) {
    const fallback = { response: fullText };
    if (structuredResponse?._metadata)
      fallback._metadata = structuredResponse._metadata;

    try {
      const qnMatch = fullText.match(/"questionNumber"\s*:\s*(\d+)/);
      if (qnMatch) fallback.questionNumber = parseInt(qnMatch[1], 10);

      const icMatch = fullText.match(
        /"isInterviewComplete"\s*:\s*(true|false)/,
      );
      if (icMatch) fallback.isInterviewComplete = icMatch[1] === "true";

      const responseMatch = fullText.match(
        /"response"\s*:\s*"((?:[^"\\]|\\.)*)/,
      );
      if (responseMatch) {
        fallback.response = responseMatch[1]
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
    } catch (_) {}

    return fallback;
  }
};

export const verifySetupWithAI = async (inputText, language = "English") => {
  let fullResponse = "";

  await api.chatStream(
    [],
    inputText,
    {
      instructionType: "setupVerifier",
      modelName: "mockmate-coordinator",
      language,
      maxOutputTokens: 256,
    },
    (chunk) => {
      fullResponse += chunk;
    },
  );

  return fullResponse;
};

// ─── Legacy TTS Functions (Moved to ttsPlayer.js) ─────────────────────

export const generateSpeech = async (text) => {
  try {
    const data = await api.generateSpeech(text);
    if (!data.audio) return null;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)(
      { sampleRate: 24000 },
    );
    const audioBuffer = await decodeAudioData(
      decode(data.audio),
      audioContext,
      24000,
      1,
    );
    return audioBuffer;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
};

function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data, ctx, sampleRate, numChannels) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

let currentAudioContext = null;
let currentAudioSource = null;

export const playAudioBuffer = (buffer) => {
  stopAudio();

  currentAudioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 24000,
  });
  currentAudioSource = currentAudioContext.createBufferSource();
  currentAudioSource.buffer = buffer;
  currentAudioSource.connect(currentAudioContext.destination);
  currentAudioSource.start();

  currentAudioSource.onended = () => {
    currentAudioSource = null;
  };
};

export const stopAudio = () => {
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {}
    currentAudioSource = null;
  }
  if (currentAudioContext) {
    try {
      currentAudioContext.close();
    } catch (e) {}
    currentAudioContext = null;
  }
};
