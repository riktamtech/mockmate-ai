const { GoogleGenAI, Type, Modality } = require("@google/genai");
const mongoose = require("mongoose");
const Interview = require("../models/Interview");
const {
  getAudioUrl,
  getAudioBuffer,
  uploadAIResponseAudio,
} = require("../services/s3Service");
const ttsService = require("../services/ttsService");

if (!process.env.GOOGLE_API_KEY) {
  console.error(
    "FATAL: GOOGLE_API_KEY not set in environment variables. Backend will not function.",
  );
  console.error(
    "Set GOOGLE_API_KEY in your .env file before starting the server.",
  );
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

const MODEL_MAP = {
  "mockmate-coordinator": "gemini-3-flash-preview",
  "mockmate-interviewer": "gemini-3-flash-preview",
  "mockmate-tts": "gemini-2.5-flash-preview-tts",
};

const MODEL_PRICING = {
  "gemini-3-flash-preview": { input: 0.075, output: 0.3 },
  "gemini-2.5-flash-preview-tts": { input: 0.075, output: 0.3 },
};

const getActualModel = (prefixedName) => {
  return MODEL_MAP[prefixedName] || "gemini-3-flash-preview";
};

const calculateCost = (model, inputTokens, outputTokens) => {
  const pricing =
    MODEL_PRICING[model] || MODEL_PRICING["gemini-3-flash-preview"];
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
};

const updateTokenUsage = async (
  interviewId,
  operation,
  model,
  inputTokens,
  outputTokens,
) => {
  try {
    const cost = calculateCost(model, inputTokens, outputTokens);

    await Interview.updateOne(
      { _id: interviewId },
      {
        $inc: {
          "tokenUsage.totalInputTokens": inputTokens,
          "tokenUsage.totalOutputTokens": outputTokens,
          "tokenUsage.totalTokens": inputTokens + outputTokens,
          "tokenUsage.estimatedCost": cost,
        },
        $push: {
          "tokenUsage.breakdown": {
            timestamp: new Date(),
            operation,
            model,
            inputTokens,
            outputTokens,
            cost,
          },
        },
      },
    );
  } catch (err) {
    console.error("Failed to update token usage:", err);
  }
};

const SYSTEM_INSTRUCTIONS = {
  // Coordinator for manual role selection
  coordinator: `You are a friendly and efficient Interview Coordinator AI. 
Your goal is to gather three specific pieces of information from the user to set up a mock interview.
This interview can be for ANY role (Tech, Sales, Marketing, HR, etc.).

1. The Target Role (e.g., Frontend Dev, Sales Representative, Project Manager).
2. The Focus Area, Tech Stack, or Industry (e.g., React/Node, B2B SaaS, Agile methodologies).
3. The Experience Level (e.g., Junior, Senior, Staff, VP).

Instructions:
- Keep your conversational response brief and friendly in the 'message' field.
- Ask ONE question at a time in your message. Do not overwhelm the user.
- Start by asking what role they are practicing for.
- Set READY to false until ALL THREE pieces of information have been gathered AND the user has confirmed they want to start.
- Once you have gathered all three pieces of information clearly (role, focusArea, level), IMMEDIATELY summarize what you've gathered and ask if they'd like to begin or change something. For example: "Great! I have everything I need. We'll focus on a [level] [role] interview with [focusArea]. Shall we begin, or would you like to change anything?" Keep READY as false at this point.
- When the user explicitly confirms they want to start (e.g., "Yes", "Let's start", "Begin", etc.), THEN set READY to true and populate all fields (role, focusArea, level).
- CRITICAL: When you set READY to true, your message MUST be a SHORT transition message ONLY (e.g., "Great! Starting your interview now..."). You must NEVER ask any interview questions, introduce yourself as an interviewer, or start the interview in your message. The interview will be handled by a separate interviewer AI.
- IMPORTANT: Provide ONLY the raw text for the role, focusArea, and level fields. Keep them extremely concise (1-5 words max). DO NOT add any extra conversational filler, slashes, or repetitive text. DO NOT include any code, function calls, or template syntax (e.g. no 'strip_tags' or similar).
- Your message should always be conversational and helpful, never output raw JSON in the message field.
`,

  // Coordinator for resume-based role selection
  resumeCoordinator: `You are an expert Career Coach and Interview Coordinator.
The user has already had their resume analyzed. You have been provided with a structured analysis of their resume.
Your job now is to help them select ONE specific interview role and focus area from the suggested options.

Instructions:
- Keep your conversational response in the 'message' field BRIEF and CONVERSATIONAL (under 100 words).
- Set READY to false while gathering information.
- If the user picks a role, confirm it and ask for any specific focus or level adjustments in your message.
- Once they confirm a specific Role, Focus Area, and Level, set READY to true and populate all fields.
- CRITICAL: When you set READY to true, your message MUST be a SHORT transition message ONLY (e.g., "Perfect! Starting your interview now..."). You must NEVER ask any interview questions, introduce yourself as an interviewer, or start the interview in your message. The interview will be handled by a separate interviewer AI.
- Your message should always be conversational, never output raw JSON in the message field.
`,

  // Setup verifier for extracting interview details
  setupVerifier: `You are a strict JSON extractor.
Given the user's single message intended to set up an interview (role, focus/stack, experience level),
extract those three fields and output ONLY a JSON object. Use these keys exactly: READY (true if enough info to start), role, focusArea, level.
If you are uncertain about any field, set it to null and set READY to false. Do not include any explanation text.`,
};

const generateInterviewerInstruction = (context) => {
  let systemContext = "";
  if (context.jd) {
    systemContext = `The user has provided the following Job Description (JD):\n"""\n${context.jd}\n"""\nBase your interview questions and evaluation criteria strictly on this JD.`;
  } else {
    systemContext = `The user is practicing for a ${context.role || "General"} position.\nFocus Area/Skills: ${context.focusArea || "General"}\nExperience Level: ${context.level || "Mid-Level"}`;
  }

  const resumeInstruction = context.hasResume
    ? "A resume has been provided. You MUST ask at least 2 specific questions about the projects, experience, and skills listed in the user's resume. Verify their details and ask for deep dives into their past work."
    : "No resume provided. Ask standard questions for the role.";

  const totalQuestions = context.totalQuestions || 10;

  return `You are an expert Professional Interviewer conducting a mock interview.
${systemContext}
${resumeInstruction}

Your Responsibilities:
1. Conduct a professional, realistic interview tailored to the specific role and level.
2. YOUR FIRST QUESTION MUST ALWAYS BE: "Tell me about yourself" or "Please introduce yourself". This is mandatory.
3. After the introduction, if a resume is provided, prioritize asking about specific projects, metrics, and experiences mentioned in it.
4. If the role is technical, ask coding or system design questions. If non-technical (Sales, HR, etc.), ask situational, behavioral, or strategic questions.
5. Ask ONE question at a time. Wait for the user's response.
6. YOU MUST ASK EXACTLY ${totalQuestions} QUESTIONS IN TOTAL (including the "introduce yourself" question). Keep track of how many questions you have asked. Wait for the user to answer the ${totalQuestions}th question.
7. After the user answers the ${totalQuestions}th question, honestly evaluate their final answer, clearly state: "That concludes our interview. Thank you.", and set isInterviewComplete to true. DO NOT ask any more questions.
8. Start by introducing yourself briefly (name and role only) and then ask "Tell me about yourself".
9. Keep your responses concise enough to be spoken (approx 2-4 sentences is ideal for conversation).
10. If the user's answer is correct/good, briefly acknowledge it and move to a harder or related question.
11. If the user's answer is incorrect or vague, gently dig deeper or clarify.
12. Maintain a professional yet neutral tone.

IMPORTANT: You will receive audio input from the user. Respond with clear, spoken-style text. Do NOT output any JSON or code blocks during the interview.
`;
};

const generateFeedbackPrompt = (transcript) => {
  return `Analyze the following interview transcript and provide detailed feedback.
  
IMPORTANT: Address the candidate DIRECTLY using "you/your" language (e.g., "You demonstrated excellent understanding..." NOT "The candidate demonstrated...").
  
Transcript:
${transcript}
  
Provide output in the following JSON schema:
{
  "overallScore": number (0-100),
  "communicationScore": number (0-100),
  "technicalScore": number (0-100),
  "problemSolvingScore": number (0-100),
  "domainKnowledgeScore": number (0-100),
  "strengths": string[] (3-5 bullet points, written addressing the candidate directly with "you/your"),
  "weaknesses": string[] (3-5 bullet points, written addressing the candidate directly with "you/your"),
  "suggestion": string (A paragraph of constructive advice addressing the candidate directly with "you/your" language)
}

Note: All text in strengths, weaknesses, and suggestion MUST use second person ("you", "your") to address the candidate directly.`;
};

exports.analyzeResume = async (req, res) => {
  const { base64, mimeType, language } = req.body;

  if (!base64 || !mimeType) {
    return res.status(400).json({ error: "Missing base64 or mimeType" });
  }

  try {
    const actualModel = getActualModel("mockmate-coordinator");

    let languageInstruction = "";
    if (language && language !== "English") {
      languageInstruction = `\n\nIMPORTANT: Provide the analysis text fields (greeting, strengthsSummary, suggestion) in ${language}.`;
    }

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: `Analyze this resume and extract structured information about the candidate. Identify their core strengths, suggest 2-3 interview roles they would be well-suited for, and provide a brief professional assessment.${languageInstruction}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            candidateName: {
              type: Type.STRING,
              description: "Full name of the candidate",
            },
            currentRole: {
              type: Type.STRING,
              description: "Current or most recent job title",
            },
            experienceLevel: {
              type: Type.STRING,
              enum: [
                "fresher",
                "junior",
                "mid-level",
                "senior",
                "lead",
                "manager",
                "executive",
              ],
              description:
                "Experience level based on years and role progression",
            },
            yearsOfExperience: {
              type: Type.NUMBER,
              description: "Estimated total years of professional experience",
            },
            coreStrengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Top 3-5 core technical or professional strengths",
            },
            keyTechnologies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Primary technologies, tools, or skills the candidate is proficient in",
            },
            suggestedRoles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: {
                    type: Type.STRING,
                    description: "Suggested interview role title",
                  },
                  focusArea: {
                    type: Type.STRING,
                    description: "Key focus areas for this role",
                  },
                  reason: {
                    type: Type.STRING,
                    description:
                      "Brief reason why this role fits the candidate",
                  },
                },
                required: ["role", "focusArea", "reason"],
              },
              description: "2-3 suggested interview roles based on the resume",
            },
            greeting: {
              type: Type.STRING,
              description:
                "A brief personalized greeting addressing the candidate by name (1 sentence)",
            },
            strengthsSummary: {
              type: Type.STRING,
              description:
                "A concise summary of the candidate's core strengths (1-2 sentences)",
            },
            suggestion: {
              type: Type.STRING,
              description:
                "A brief suggestion asking them to choose a role for practice (1 sentence)",
            },
            roleType: {
              type: Type.STRING,
              enum: ["tech", "non-tech", "hybrid"],
              description:
                "Whether the candidate is primarily technical, non-technical, or hybrid",
            },
          },
          required: [
            "candidateName",
            "currentRole",
            "experienceLevel",
            "coreStrengths",
            "keyTechnologies",
            "suggestedRoles",
            "greeting",
            "strengthsSummary",
            "suggestion",
            "roleType",
          ],
        },
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    if (response.text) {
      const analysisData = JSON.parse(response.text);
      res.json(analysisData);
    } else {
      throw new Error("No analysis generated");
    }
  } catch (error) {
    console.error("Resume Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Helper: Build Gemini-compatible contents from embedded history ──
// Uses text-only history. Audio was already processed by Gemini on the original turn;
// re-downloading from S3 adds 5-10s latency and is unnecessary.
//
// If any recent user messages have empty content (transcription still in progress),
// we wait briefly (up to 2s) for the transcript to land. If still pending after
// polling, we download the audio from S3 and pass it inline so the AI can "hear"
// what the candidate said even without a text transcript.
const buildGeminiContents = async (interviewId, historyMessages) => {
  // Check if any user messages have empty content (transcription pending)
  const emptyUserMsgs = historyMessages.filter(
    (msg) => msg.role === "user" && !msg.content,
  );

  if (emptyUserMsgs.length > 0 && interviewId) {
    // Wait up to 2s for transcriptions to complete (poll every 500ms)
    const MAX_WAIT_MS = 2000;
    const POLL_INTERVAL_MS = 500;
    let waited = 0;

    while (waited < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      waited += POLL_INTERVAL_MS;

      const freshDoc = await Interview.findById(interviewId)
        .select("history")
        .lean();
      if (!freshDoc) break;

      // Check if all previously-empty messages now have content
      const stillEmpty = emptyUserMsgs.filter((emptyMsg) => {
        const freshMsg = freshDoc.history.find(
          (h) => h._id?.toString() === emptyMsg._id?.toString(),
        );
        return freshMsg && !freshMsg.content;
      });

      if (stillEmpty.length === 0) {
        // All transcriptions landed — use fresh history
        historyMessages = freshDoc.history;
        console.log(
          `[buildGeminiContents] Transcriptions landed after ${waited}ms wait`,
        );
        break;
      }

      if (waited >= MAX_WAIT_MS) {
        // Use fresh history (some may have landed)
        historyMessages = freshDoc.history;
        console.log(
          `[buildGeminiContents] Timed out after ${waited}ms, ${stillEmpty.length} message(s) still pending`,
        );
      }
    }
  }

  // Build contents — for pending transcripts with audio, download from S3 and inline
  const contentsPromises = historyMessages.map(async (msg) => {
    if (msg.content) {
      return { role: msg.role, parts: [{ text: msg.content }] };
    }

    // Empty content — try to provide audio inline if available
    if (msg.role === "user" && msg.audioS3Key) {
      try {
        const audioBuffer = await getAudioBuffer(msg.audioS3Key);
        if (audioBuffer && audioBuffer.length > 0) {
          console.log(
            `[buildGeminiContents] Using inline audio from S3 for pending transcript (historyId=${msg._id})`,
          );
          return {
            role: msg.role,
            parts: [
              {
                text: "[Candidate's spoken answer — transcription is still processing, listen to the audio below]:",
              },
              {
                inlineData: {
                  data: audioBuffer.toString("base64"),
                  mimeType: msg.audioMimeType || "audio/webm",
                },
              },
            ],
          };
        }
      } catch (err) {
        console.warn(
          `[buildGeminiContents] Failed to download audio from S3 for historyId=${msg._id}:`,
          err.message,
        );
      }
    }

    // Fallback: text placeholder
    const text =
      msg.role === "user"
        ? "[Candidate provided a spoken answer but transcription is still processing. Proceed with the next question - do not re-ask or penalize this answer.]"
        : "[AI response pending]";
    return { role: msg.role, parts: [{ text }] };
  });

  return (await Promise.all(contentsPromises)).filter(Boolean);
};

exports.chatStream = async (req, res) => {
  const {
    history,
    message,
    interviewId,
    modelName,
    maxOutputTokens,
    language,
    useStructuredOutput,
    instructionType, // 'coordinator', 'resumeCoordinator', 'interviewer', 'setupVerifier'
    interviewContext, // { role, focusArea, level, jd, hasResume, totalQuestions }
    questionIndex: reqQuestionIndex, // Which question this message corresponds to
    interactionId, // Unique frontend-generated ID for the user's turn
  } = req.body;
  const parsedQuestionIndex =
    reqQuestionIndex !== undefined && reqQuestionIndex !== null
      ? Number(reqQuestionIndex)
      : undefined;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const actualModel = getActualModel(modelName);
    let finalSystemInstruction = "";

    if (instructionType === "coordinator") {
      finalSystemInstruction = SYSTEM_INSTRUCTIONS.coordinator;
    } else if (instructionType === "resumeCoordinator") {
      finalSystemInstruction = SYSTEM_INSTRUCTIONS.resumeCoordinator;
    } else if (instructionType === "interviewer" && interviewContext) {
      finalSystemInstruction = generateInterviewerInstruction(interviewContext);
    } else if (instructionType === "setupVerifier") {
      finalSystemInstruction = SYSTEM_INSTRUCTIONS.setupVerifier;
    }

    if (language && language !== "English") {
      finalSystemInstruction += `\n\nIMPORTANT: You must conduct this entire interview/conversation in ${language}. Ensure all your responses are in ${language}.`;
    }

    let contents = [];
    let interviewDoc = null;
    let userHistoryId = null;

    if (interviewId) {
      interviewDoc = await Interview.findById(interviewId);
      if (interviewDoc) {
        // Build Gemini-compatible contents from embedded history (text-only, no S3 downloads)
        contents = await buildGeminiContents(interviewId, interviewDoc.history);

        // Build current user message parts
        let userParts = [];
        let userContentText = "";

        if (typeof message === "string") {
          userParts = [{ text: message }];
          userContentText = message;
        } else if (message.parts) {
          userParts = message.parts;
          // Extract text content for storage
          const textPart = message.parts.find((p) => p.text);
          userContentText = textPart ? textPart.text : "";
        }

        // Pre-generate _id so we know it without extra DB queries
        userHistoryId = new mongoose.Types.ObjectId();

        // Atomically push user message to Interview.history
        const userMsg = {
          _id: userHistoryId,
          role: "user",
          content:
            userContentText ||
            "Please evaluate my answer and ask the next question.",
          timestamp: new Date(),
        };

        // Tag with interactionId linking field
        if (interactionId) {
          userMsg.interactionId = interactionId;
        }

        // Tag with questionIndex if provided (kept for semantic/UI purposes)
        if (parsedQuestionIndex !== undefined) {
          userMsg.questionIndex = parsedQuestionIndex;
        }

        // If message has inline audio data, note that it needs S3 upload (handled by audioController)
        // We store the text content only — audio S3 key is set later by uploadAudioRecording
        if (message.parts) {
          const audioPart = message.parts.find((p) => p.inlineData);
          if (audioPart) {
            userMsg.audioMimeType =
              audioPart.inlineData.mimeType || "audio/webm";
          }
        }

        try {
          await Interview.updateOne(
            { _id: interviewDoc._id },
            { $push: { history: userMsg } },
          );
        } catch (err) {
          console.error("Failed to save user message to history:", err);
        }

        // ── Background TTS for text-only interview answers ──────────────
        // Generates audio so admins can listen to text answers too
        const hasInlineAudio = message.parts?.some((p) => p.inlineData);
        const isInitialPrompt =
          userContentText ===
          "Start the interview now. Introduce yourself briefly and ask 'Tell me about yourself' as your first question.";
        if (
          userContentText &&
          instructionType === "interviewer" &&
          !hasInlineAudio &&
          !isInitialPrompt
        ) {
          Promise.resolve().then(async () => {
            try {
              const ttsBuffer = await ttsService.synthesizeFull(
                userContentText,
                language || "English",
              );
              if (ttsBuffer && ttsBuffer.length > 0) {
                const uploadResult = await uploadAIResponseAudio(
                  ttsBuffer,
                  interviewId,
                  parsedQuestionIndex || 0,
                  "audio/mp3",
                );
                if (uploadResult?.s3Key) {
                  await Interview.updateOne(
                    { _id: interviewId, "history._id": userHistoryId },
                    {
                      $set: {
                        "history.$.audioS3Key": uploadResult.s3Key,
                        "history.$.audioMimeType": "audio/mp3",
                      },
                      $push: {
                        audioRecordings: {
                          _id: new mongoose.Types.ObjectId(),
                          s3Key: uploadResult.s3Key,
                          mimeType: "audio/mp3",
                          questionIndex: parsedQuestionIndex || 0,
                          durationSeconds: 0,
                          uploadedAt: new Date(),
                          ...(interactionId && { interactionId }),
                          historyId: userHistoryId.toString(),
                        },
                      },
                    },
                  );
                  console.log(
                    `[chatStream] Background TTS for text answer saved: ${uploadResult.s3Key}`,
                  );
                }
              }
            } catch (err) {
              console.error(
                "[chatStream] Background TTS for text answer failed:",
                err.message,
              );
            }
          });
        }

        contents.push({ role: "user", parts: userParts });
      }
    } else {
      contents = [...(history || [])];
      if (typeof message === "string") {
        contents.push({ role: "user", parts: [{ text: message }] });
      } else if (message.parts) {
        contents.push({ role: "user", parts: message.parts });
      }
    }

    const genConfig = {
      systemInstruction: finalSystemInstruction,
      maxOutputTokens: maxOutputTokens || 1024,
      temperature: instructionType === "interviewer" ? 0.7 : 0.2, // Lower temp for coordinator/setupVerifier to prevent repetition loops
    };

    if (useStructuredOutput) {
      genConfig.responseMimeType = "application/json";

      if (modelName === "mockmate-coordinator") {
        // Coordinator schema for setup
        genConfig.responseSchema = {
          type: Type.OBJECT,
          properties: {
            READY: {
              type: Type.BOOLEAN,
              description:
                "True if enough information is collected to start the interview",
            },
            role: {
              type: Type.STRING,
              description:
                "The target job role for the interview. Keep it concise (1-5 words max).",
            },
            focusArea: {
              type: Type.STRING,
              description:
                "The focus area, tech stack, or industry. Keep it concise (1-5 words max).",
            },
            level: {
              type: Type.STRING,
              description:
                "Experience level (e.g., Junior, Mid-level, Senior). Keep it concise (1-3 words max).",
            },
            message: {
              type: Type.STRING,
              description: "Conversational response to the user",
            },
          },
          required: ["READY", "message"],
        };
      } else if (modelName === "mockmate-interviewer") {
        // Interviewer schema for interview responses
        genConfig.responseSchema = {
          type: Type.OBJECT,
          properties: {
            response: {
              type: Type.STRING,
              description:
                "Your spoken response to the candidate - evaluation of their answer and/or your next question. Keep it conversational and natural.",
            },
            questionNumber: {
              type: Type.NUMBER,
              description:
                "The current question number you are asking (1-based). Increment after each question you ask.",
            },
            isInterviewComplete: {
              type: Type.BOOLEAN,
              description:
                "Set to true only after the candidate has answered the final question and you have given closing remarks.",
            },
            answerQuality: {
              type: Type.STRING,
              enum: [
                "excellent",
                "good",
                "average",
                "needs_improvement",
                "not_applicable",
              ],
              description:
                "Quick assessment of the candidate's last answer quality. Use not_applicable for the first interaction.",
            },
          },
          required: ["response", "questionNumber", "isInterviewComplete"],
        };
      }
    }

    const result = await ai.models.generateContentStream({
      model: actualModel,
      contents: contents,
      config: genConfig,
    });

    let fullResponse = "";
    let usageMetadata = null;

    for await (const chunk of result) {
      if (chunk.text) {
        res.write(chunk.text);
        fullResponse += chunk.text;
      }
      if (chunk.usageMetadata) {
        usageMetadata = chunk.usageMetadata;
      }
    }

    if (interviewDoc && fullResponse) {
      // Determine the AI's questionNumber from the response
      let aiQuestionIndex = parsedQuestionIndex;
      try {
        const parsed = JSON.parse(fullResponse);
        if (parsed.questionNumber !== undefined) {
          aiQuestionIndex = parsed.questionNumber;
        }
      } catch (_) {
        // Not JSON, that's fine
      }

      // Pre-generate _id so we know it without extra DB queries
      const aiHistoryId = new mongoose.Types.ObjectId();
      const aiInteractionId = new mongoose.Types.ObjectId().toString();

      // Atomically push AI response to Interview.history
      const aiMsg = {
        _id: aiHistoryId,
        interactionId: aiInteractionId,
        role: "model",
        content: fullResponse,
        timestamp: new Date(),
      };
      if (aiQuestionIndex !== undefined) {
        aiMsg.questionIndex = aiQuestionIndex;
      }

      try {
        await Interview.updateOne(
          { _id: interviewId },
          { $push: { history: aiMsg } },
        );
      } catch (pushErr) {
        console.error("Failed to push AI response to history:", pushErr);
      }

      // Stream metadata trailer with history _ids and interactionIds
      try {
        const metadata = {
          userHistoryId: userHistoryId ? userHistoryId.toString() : null,
          userInteractionId: interactionId || null,
          aiHistoryId: aiHistoryId.toString(),
          aiInteractionId: aiInteractionId,
        };
        res.write(`\n[METADATA]${JSON.stringify(metadata)}`);
      } catch (_) {
        // Non-critical — frontend will fall back gracefully
      }

      // ── Backfill user audio from audioRecordings ─────────────────────
      // If uploadAudioRecording completed before this point, the user's
      // audioS3Key is already in audioRecordings but may not be on the
      // history item yet (race condition). Check and backfill using _id.
      if (userHistoryId) {
        try {
          const freshDoc = await Interview.findById(interviewId)
            .select("audioRecordings")
            .lean();

          if (freshDoc && freshDoc.audioRecordings) {
            // Find the matching recording — prefer interactionId, then questionIndex, then latest
            let recording = null;
            if (interactionId) {
              recording = freshDoc.audioRecordings.find(
                (r) => r.interactionId === interactionId,
              );
            }
            if (!recording && parsedQuestionIndex !== undefined) {
              recording = [...freshDoc.audioRecordings]
                .reverse()
                .find((r) => r.questionIndex === parsedQuestionIndex);
            }
            if (!recording) {
              recording =
                freshDoc.audioRecordings[freshDoc.audioRecordings.length - 1];
            }

            if (recording) {
              // Priority 1: Match exactly by interactionId. Priority 2: Use historyId
              const queryMatch = interactionId
                ? { _id: interviewId, "history.interactionId": interactionId }
                : { _id: interviewId, "history._id": userHistoryId };

              const updateResult = await Interview.updateOne(queryMatch, {
                $set: {
                  "history.$.audioS3Key": recording.s3Key,
                  "history.$.audioMimeType": recording.mimeType,
                },
              });

              if (updateResult.modifiedCount > 0) {
                console.log(
                  `[chatStream] Backfill audioS3Key success for historyId=${userHistoryId}`,
                );
              }
            }
          }
        } catch (backfillErr) {
          console.error(
            "[chatStream] Backfill audioRecordings failed:",
            backfillErr,
          );
        }
      }

      if (usageMetadata) {
        await updateTokenUsage(
          interviewId,
          "chat",
          actualModel,
          usageMetadata.promptTokenCount || 0,
          usageMetadata.candidatesTokenCount || 0,
        );
      }
    }

    res.end();
  } catch (error) {
    console.error("AI Stream Error:", error);
    const errorMsg = error.message || "Unknown error occurred";

    if (
      errorMsg.includes("Could not load the default credentials") ||
      errorMsg.includes("GOOGLE_API_KEY")
    ) {
      console.error("Auth Error: GOOGLE_API_KEY is not set or invalid");
      if (!res.headersSent) {
        res.status(500).json({
          error:
            "API authentication failed. Ensure GOOGLE_API_KEY is set in server environment.",
        });
      }
    } else if (!res.headersSent) {
      res.status(500).json({ error: errorMsg });
    } else {
      res.end();
    }
  }
};

exports.generateFeedback = async (req, res) => {
  const { transcript, language, interviewId } = req.body;

  try {
    const actualModel = getActualModel("mockmate-interviewer");

    let feedbackPrompt = generateFeedbackPrompt(transcript);

    if (language && language !== "English") {
      feedbackPrompt += `\n\nPlease generate the analysis and feedback strictly in ${language}.`;
    }

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: feedbackPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            communicationScore: { type: Type.NUMBER },
            technicalScore: { type: Type.NUMBER },
            problemSolvingScore: { type: Type.NUMBER },
            domainKnowledgeScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestion: { type: Type.STRING },
          },
          required: [
            "overallScore",
            "communicationScore",
            "technicalScore",
            "strengths",
            "weaknesses",
            "suggestion",
          ],
        },
      },
    });

    if (response.usageMetadata && interviewId) {
      await updateTokenUsage(
        interviewId,
        "feedback",
        actualModel,
        response.usageMetadata.promptTokenCount || 0,
        response.usageMetadata.candidatesTokenCount || 0,
      );
    }

    if (response.text) {
      res.json(JSON.parse(response.text));
    } else {
      throw new Error("No feedback generated");
    }
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.refreshAudioUrl = async (req, res) => {
  const { interviewId, questionIndex, conversationId } = req.body;

  try {
    let freshUrl = null;

    if (interviewId && questionIndex !== undefined) {
      const interview = await Interview.findById(interviewId)
        .select("history")
        .lean();

      if (interview && interview.history) {
        let histItem;

        // Priority 1: Match by unique conversationId if provided
        if (conversationId) {
          histItem = interview.history.find(
            (h) => h._id?.toString() === conversationId,
          );
        }

        // Priority 2: Use the passed index as the absolute array index
        // The frontend InterviewDetailModal passes its array index directly
        if (!histItem) {
          const arrIndex = Number(questionIndex);
          histItem = interview.history[arrIndex];
        }

        if (histItem && histItem.audioS3Key) {
          freshUrl = await getAudioUrl(histItem.audioS3Key, 86400);

          // No need to store URL in DB — it's generated on demand
        }
      }
    }

    if (freshUrl) {
      res.json({ audioUrl: freshUrl });
    } else {
      res.status(404).json({ error: "Audio record or S3 key not found" });
    }
  } catch (error) {
    console.error("Refresh Audio URL Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.generateSpeechStream = async (req, res) => {
  const {
    text,
    interviewId,
    questionIndex,
    historyId,
    isFinalMessage,
    language,
  } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    console.warn("[TTS Controller] Empty or invalid text received");
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    // 1. Check if we already have this audio cached in S3
    if (interviewId && (historyId || questionIndex !== undefined)) {
      const interview = await Interview.findById(interviewId)
        .select("history")
        .lean();

      let historyItem;

      if (historyId) {
        // Primary: precise _id lookup — O(n) scan but no ambiguity
        historyItem = interview?.history?.find(
          (h) => h._id?.toString() === historyId,
        );
      } else {
        // Fallback: questionIndex-based lookup (backward compat)
        const qIndex = Number(questionIndex);
        if (isFinalMessage) {
          const modelMessages =
            interview?.history?.filter(
              (h) => h.role === "model" && h.questionIndex === qIndex,
            ) || [];
          historyItem = modelMessages[modelMessages.length - 1];
        } else {
          historyItem = interview?.history?.find(
            (h) => h.role === "model" && h.questionIndex === qIndex,
          );
        }
      }

      if (historyItem && historyItem.audioS3Key) {
        console.log(
          `[TTS] Cache hit for interview ${interviewId} historyId=${historyId || questionIndex}`,
        );
        const signedUrl = await getAudioUrl(historyItem.audioS3Key);
        return res.json({ audioUrl: signedUrl, isCached: true });
      }
    }

    // 2. Not cached - Generate Stream
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Content-Type-Options", "nosniff");
    }

    // Stream TTS chunks and get full buffer back
    const fullAudioBuffer = await ttsService.streamTtsChunks(
      text,
      res,
      language,
    );

    // 3. Robust Background S3 upload + history update with Retries
    if (interviewId && fullAudioBuffer && fullAudioBuffer.length > 0) {
      const qIndex =
        questionIndex !== undefined && questionIndex !== null
          ? Number(questionIndex)
          : null;

      // We need either historyId or qIndex to save audio
      if (historyId || qIndex !== null) {
        // Detached promise — does NOT block the response
        Promise.resolve().then(async () => {
          console.log(
            `[TTS] Starting background upload for Interview ${interviewId} historyId=${historyId || "none"} qIndex=${qIndex}`,
          );

          const MAX_RETRIES = 3;
          let attempt = 0;
          let uploaded = false;
          let uploadResult = null;
          let lastError = null;

          while (attempt < MAX_RETRIES && !uploaded) {
            try {
              attempt++;
              if (attempt > 1)
                console.log(`[TTS] Retry attempt ${attempt} for upload...`);

              const mimeType = "audio/mp3";
              uploadResult = await uploadAIResponseAudio(
                fullAudioBuffer,
                interviewId,
                qIndex || 0,
                mimeType,
              );

              if (uploadResult && uploadResult.s3Key) {
                uploaded = true;
              }
            } catch (err) {
              lastError = err;
              console.error(
                `[TTS] Upload attempt ${attempt} failed:`,
                err.message,
              );
              if (attempt < MAX_RETRIES)
                await new Promise((r) => setTimeout(r, 1000));
            }
          }

          if (uploaded && uploadResult) {
            try {
              if (historyId) {
                // Primary: _id-based update — simple and unambiguous
                const updateResult = await Interview.updateOne(
                  {
                    _id: interviewId,
                    "history._id": new mongoose.Types.ObjectId(historyId),
                  },
                  {
                    $set: {
                      "history.$.audioS3Key": uploadResult.s3Key,
                      "history.$.audioMimeType": "audio/mp3",
                      updatedAt: new Date(),
                    },
                  },
                );

                if (updateResult.modifiedCount > 0) {
                  console.log(
                    `[TTS] Background upload & save complete for historyId=${historyId}: ${uploadResult.s3Key}`,
                  );
                } else {
                  console.warn(
                    `[TTS] No history item updated for historyId=${historyId}`,
                  );
                }
              } else {
                // Fallback: questionIndex-based update (backward compat)
                const interviewDoc = await Interview.findById(interviewId)
                  .select("history")
                  .lean();
                let actualIndex = -1;
                if (interviewDoc && interviewDoc.history) {
                  if (isFinalMessage) {
                    for (let i = interviewDoc.history.length - 1; i >= 0; i--) {
                      if (
                        interviewDoc.history[i].role === "model" &&
                        interviewDoc.history[i].questionIndex === qIndex
                      ) {
                        actualIndex = i;
                        break;
                      }
                    }
                  } else {
                    for (let i = 0; i < interviewDoc.history.length; i++) {
                      if (
                        interviewDoc.history[i].role === "model" &&
                        interviewDoc.history[i].questionIndex === qIndex
                      ) {
                        actualIndex = i;
                        break;
                      }
                    }
                  }
                }

                if (actualIndex !== -1) {
                  const updateResult = await Interview.updateOne(
                    { _id: interviewId },
                    {
                      $set: {
                        [`history.${actualIndex}.audioS3Key`]:
                          uploadResult.s3Key,
                        [`history.${actualIndex}.audioMimeType`]: "audio/mp3",
                        updatedAt: new Date(),
                      },
                    },
                  );

                  if (updateResult.modifiedCount > 0) {
                    console.log(
                      `[TTS] Background upload & save complete for questionIndex=${qIndex}: ${uploadResult.s3Key}`,
                    );
                  }
                } else {
                  console.warn(
                    `[TTS] Could not find model message with questionIndex=${qIndex} to update audio`,
                  );
                }
              }
            } catch (dbError) {
              console.error("[TTS] Failed to update DB after upload:", dbError);
            }
          } else {
            console.error(
              `[TTS] PERMANENT FAILURE: Could not upload audio after ${MAX_RETRIES} attempts.`,
              lastError,
            );
          }
        });
      }
    }
  } catch (error) {
    console.error("[TTS Controller] Stream generation failed:", {
      error: error.message,
      stack: error.stack,
      textLength: text?.length,
    });

    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "TTS generation failed", message: error.message });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
};

// ─── Backup: Gemini TTS (Emergency switch) ─────────────────────────
exports.generateSpeechGemini = async (req, res) => {
  const { text, language = "English" } = req.body;

  if (!text) return res.status(400).json({ error: "Text required" });

  try {
    const actualModel = getActualModel("mockmate-tts");

    // Choose appropriate Gemini Voice Name based on language
    let voiceName = "Kore";
    if (
      language === "Hindi" ||
      language === "Mandarin" ||
      language === "Japanese" ||
      language === "Spanish" ||
      language === "Portuguese" ||
      language === "French" ||
      language === "German"
    ) {
      voiceName = "Aoede";
    } else {
      voiceName = "Puck"; // Using a clear English voice
    }

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = part?.inlineData?.data;

    if (base64Audio) {
      res.json({ audio: base64Audio });
    } else {
      res.status(400).json({ error: "No audio generated" });
    }
  } catch (error) {
    console.error("[TTS Gemini Backup] Error:", error);
    res.status(500).json({ error: error.message });
  }
};
