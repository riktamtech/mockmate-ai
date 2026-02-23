import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { Landing } from "./Landing";
import { JDPaste } from "./JDPaste";
import { ResumeUpload } from "./ResumeUpload";
import { ChatInterface } from "./ChatInterface";
import { FeedbackView } from "./FeedbackView";
import { AppState } from "../types";
import {
  createCoordinatorChat,
  createResumeCoordinatorChat,
  createInterviewerChat,
  sendMessageStream,
  sendAudioMessage,
  sendResumeToChat,
  generateFeedback,
  convertHistoryToMessages,
} from "../services/geminiService";
import { speak, stop } from "../services/ttsPlayer";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";
import { SideDrawer } from "./SideDrawer";
import { MenuButton } from "./MenuButton";
import { Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const generateId = () => Math.random().toString(36).substring(2, 9);
const generateUniqueId = () => uuidv4();

// Helper to convert Blob to Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      if (base64String.includes(",")) {
        resolve(base64String.split(",")[1]);
      } else {
        resolve(base64String);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const CandidateSession = () => {
  const {
    appState,
    setAppState,
    language,
    activeInterviewId,
    setActiveInterviewId,
    interviewConfig,
    setInterviewConfig,
    resetSession,
  } = useAppStore();

  const navigate = useNavigate();

  const [totalQuestions, setTotalQuestions] = useState(7);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentQuestionCount, setCurrentQuestionCount] = useState(0);
  const [feedbackData, setFeedbackData] = useState(null);
  const [resumeContext, setResumeContext] = useState(null);
  const [isResuming, setIsResuming] = useState(!!activeInterviewId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState(null);
  const startTimeRef = useRef(Date.now());
  const autoStartTimerRef = useRef(null);

  const chatSessionRef = useRef(null);

  // Auto-start countdown: tick every second, auto-begin when it hits 0
  useEffect(() => {
    if (autoStartCountdown === null || autoStartCountdown < 0) return;

    if (autoStartCountdown === 0) {
      // Timer expired — auto-send the begin message
      autoStartTimerRef.current = null;
      setAutoStartCountdown(null);
      setSuggestions([]);
      handleCoordinatorMessage("Yes, let's start the interview!");
      return;
    }

    autoStartTimerRef.current = setTimeout(() => {
      setAutoStartCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
      }
    };
  }, [autoStartCountdown]);

  useEffect(() => {
    const initSession = async () => {
      if (activeInterviewId && !chatSessionRef.current) {
        setIsResuming(true);
        try {
          const interview = await api.getInterview(activeInterviewId);
          await resumeInterview(interview);
        } catch (e) {
          console.error("Failed to recover session", e);
          navigate("/mockmate/candidate/dashboard");
        } finally {
          setIsResuming(false);
        }
      }
    };
    initSession();
  }, [activeInterviewId]);

  useEffect(() => {
    if (
      appState === AppState.SETUP_ROLE_CHAT &&
      !chatSessionRef.current &&
      !activeInterviewId
    ) {
      startCoordinatorChat();
    }
  }, [appState]);

  const resumeInterview = async (interview) => {
    setActiveInterviewId(interview._id);
    const config = {
      type: "role_based",
      roleDetails: {
        role: interview.role,
        focusArea: interview.focusArea,
        level: interview.level,
      },
      language: interview.language,
    };
    setInterviewConfig(config);

    if (interview.totalQuestions) {
      setTotalQuestions(interview.totalQuestions);
    }

    const history = interview.history || [];
    const context = {
      ...config.roleDetails,
      language: config.language,
      totalQuestions: interview.totalQuestions || totalQuestions,
    };

    const chat = createInterviewerChat(context, history, interview._id);
    chatSessionRef.current = chat;

    const restoredMessages = convertHistoryToMessages(history);
    setMessages(restoredMessages);
    setCurrentQuestionCount(Math.floor(restoredMessages.length / 2));
    setAppState(AppState.INTERVIEW_ACTIVE);

    if (history.length === 0) {
      setIsStreaming(true);
      const botMsgId = generateUniqueId();
      setMessages([
        {
          id: botMsgId,
          role: "model",
          text: "Preparing interview...",
          timestamp: new Date(),
          isThinking: true,
        },
      ]);

      let fullText = "";
      const textResponse = await sendMessageStream(
        chat,
        "Start the interview now. Introduce yourself briefly and ask 'Tell me about yourself' as your first question.",
        (chunk) => {
          fullText += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId
                ? { ...m, text: fullText, isThinking: false }
                : m,
            ),
          );
        },
      );

      if (textResponse) {
        // Play intro
        await speak(textResponse, interview._id, null, false, null, language);
      }
      setIsStreaming(false);
    }
  };

  const handleSelectMode = (mode) => {
    if (mode === "jd") {
      setAppState(AppState.SETUP_JD);
    } else if (mode === "resume") {
      setAppState(AppState.SETUP_RESUME);
    } else {
      setAppState(AppState.SETUP_ROLE_CHAT);
      startCoordinatorChat();
    }
  };

  const handleBackToLanding = () => {
    stop();
    resetSession();
    navigate("/mockmate/candidate/dashboard");
  };

  const handleGoToDashboard = () => {
    stop();
    resetSession();
    navigate("/mockmate/candidate/dashboard");
  };

  const handleJDStart = (jdText) => {
    const config = { type: "jd", jdText, language };
    setInterviewConfig(config);
    startInterview(config);
  };

  const handlePlayAudio = async (text) => {
    try {
      setIsAudioPlaying(true);
      await speak(text, activeInterviewId, null, false, null, language);
    } catch (error) {
      console.error("Failed to play audio", error);
    } finally {
      setIsAudioPlaying(false);
    }
  };

  const handleResumeFileSelect = async (file) => {
    setIsStreaming(true);
    try {
      const base64 = await blobToBase64(file);
      setResumeContext({ base64, mimeType: file.type });

      const chat = createResumeCoordinatorChat(language);
      chatSessionRef.current = chat;

      const result = await sendResumeToChat(chat, base64, file.type, language);

      const responseText = result.text || result;

      if (result.analysis) {
        chatSessionRef.current.resumeAnalysis = result.analysis;
      }

      setAppState(AppState.SETUP_RESUME_CHAT);
      setMessages([
        {
          id: generateUniqueId(),
          role: "model",
          text: responseText,
          timestamp: new Date(),
          isThinking: false,
        },
      ]);

      if (result.analysis) {
        generateContextualSuggestions(responseText, result.analysis);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to analyze resume.");
      setAppState(AppState.SETUP_RESUME);
      setResumeContext(null);
    } finally {
      setIsStreaming(false);
    }
  };

  const generateContextualSuggestions = (aiMessage, analysis = null) => {
    const lowerMessage = aiMessage.toLowerCase();
    const newSuggestions = [];

    if (
      analysis?.suggestedRoles &&
      (lowerMessage.includes("which one") ||
        lowerMessage.includes("which role") ||
        lowerMessage.includes("choose one") ||
        lowerMessage.includes("select one") ||
        lowerMessage.includes("practice for"))
    ) {
      analysis.suggestedRoles.forEach((role, index) => {
        newSuggestions.push({
          label: `${index + 1}. ${role.role}`,
          value: `I'd like to practice for the ${role.role} role, focusing on ${role.focusArea}.`,
        });
      });
    } else if (
      lowerMessage.includes("experience level") ||
      lowerMessage.includes("seniority") ||
      lowerMessage.includes("how many years") ||
      lowerMessage.includes("what level")
    ) {
      newSuggestions.push(
        {
          label: "Entry Level / Fresher",
          value: "I am at entry level / fresher.",
        },
        {
          label: "Junior (1-2 years)",
          value: "I have 1-2 years of experience, junior level.",
        },
        {
          label: "Mid-Level (3-5 years)",
          value: "I have 3-5 years of experience, mid-level.",
        },
        {
          label: "Senior (5+ years)",
          value: "I have 5+ years of experience, senior level.",
        },
      );
    } else if (
      lowerMessage.includes("ready to start") ||
      lowerMessage.includes("shall we begin") ||
      lowerMessage.includes("start the interview") ||
      lowerMessage.includes("proceed with") ||
      lowerMessage.includes("is that correct") ||
      lowerMessage.includes("sound good") ||
      lowerMessage.includes("like to begin") ||
      lowerMessage.includes("want to change") ||
      lowerMessage.includes("change anything")
    ) {
      newSuggestions.push(
        {
          label: "Yes, let's start!",
          value: "Yes, let's start the interview!",
        },
        {
          label: "I want to change something",
          value: "Actually, I want to change the role or focus area.",
        },
      );

      // Start the auto-start countdown (15 seconds)
      setAutoStartCountdown(15);
    } else if (
      lowerMessage.includes("what role") ||
      lowerMessage.includes("what position") ||
      lowerMessage.includes("practicing for") ||
      lowerMessage.includes("interviewing for")
    ) {
      newSuggestions.push(
        {
          label: "Frontend Developer",
          value: "I want to practice for a Frontend Developer role.",
        },
        {
          label: "Backend Developer",
          value: "I want to practice for a Backend Developer role.",
        },
        {
          label: "Full-Stack Developer",
          value: "I want to practice for a Full-Stack Developer role.",
        },
        {
          label: "Software Engineer",
          value: "I want to practice for a Software Engineer role.",
        },
      );
    } else if (
      lowerMessage.includes("focus area") ||
      lowerMessage.includes("tech stack") ||
      lowerMessage.includes("technologies") ||
      lowerMessage.includes("skills") ||
      lowerMessage.includes("speciali")
    ) {
      newSuggestions.push(
        {
          label: "React / Frontend",
          value: "Focus on React, JavaScript, and frontend development.",
        },
        {
          label: "Node.js / Backend",
          value: "Focus on Node.js, Express, and backend development.",
        },
        {
          label: "MERN Stack",
          value: "Focus on the MERN stack (MongoDB, Express, React, Node.js).",
        },
        {
          label: "System Design",
          value: "Focus on system design and architecture.",
        },
        {
          label: "DSA & Problem Solving",
          value: "Focus on data structures, algorithms, and problem solving.",
        },
      );
    }

    setSuggestions(newSuggestions);
  };

  const getSuggestionChips = () => {
    if (
      appState !== AppState.SETUP_RESUME_CHAT &&
      appState !== AppState.SETUP_ROLE_CHAT
    )
      return [];
    return suggestions;
  };

  const handleSuggestionClick = (suggestion) => {
    // Clear the auto-start timer if running
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    setAutoStartCountdown(null);

    setSuggestions([]);
    const message =
      typeof suggestion === "string" ? suggestion : suggestion.value;
    handleCoordinatorMessage(message);
  };

  const startCoordinatorChat = async () => {
    const chat = createCoordinatorChat(language);
    chatSessionRef.current = chat;
    setMessages([]);

    setIsStreaming(true);
    const initialMsgId = generateUniqueId();
    setMessages([
      {
        id: initialMsgId,
        role: "model",
        text: "",
        timestamp: new Date(),
        isThinking: true,
      },
    ]);

    let fullResponse = "";
    let lastUpdateTime = 0;
    const updateInterval = 50;

    const structuredResponse = await sendMessageStream(
      chat,
      `Hello, I want to practice for an interview in ${language}.`,
      (chunk) => {
        if (
          chunk.startsWith("{") ||
          (fullResponse.startsWith("{") && chunk.includes('"message"'))
        ) {
          if (chunk.length > fullResponse.length) {
            fullResponse = chunk;
          } else {
            fullResponse += chunk;
          }
        } else {
          fullResponse += chunk;
        }

        const now = Date.now();
        if (now - lastUpdateTime > updateInterval) {
          lastUpdateTime = now;
          try {
            const parsed = JSON.parse(fullResponse);
            const displayText = parsed.message || "";
            if (displayText) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === initialMsgId
                    ? { ...m, text: displayText, isThinking: false }
                    : m,
                ),
              );
            }
          } catch (e) {
            const messageMatch = fullResponse.match(
              /"message"\s*:\s*"((?:[^"\\]|\\.)*)/,
            );
            if (messageMatch) {
              const displayText = messageMatch[1]
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === initialMsgId
                    ? {
                        ...m,
                        text: displayText,
                        isThinking: false,
                      }
                    : m,
                ),
              );
            }
          }
        }
      },
    );

    let displayText = fullResponse;
    if (structuredResponse && typeof structuredResponse === "object") {
      displayText = structuredResponse.message || fullResponse;
    } else {
      try {
        const parsed = JSON.parse(fullResponse);
        displayText = parsed.message || fullResponse;
      } catch (e) {
        displayText = filterJsonFromText(fullResponse);
      }
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === initialMsgId
          ? { ...m, text: displayText, isThinking: false }
          : m,
      ),
    );
    setIsStreaming(false);

    generateContextualSuggestions(displayText);
  };

  const filterJsonFromText = (text) => {
    return text
      .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, "")
      .replace(/\{[\s\S]*?"READY"[\s\S]*?\}/g, "")
      .trim();
  };

  const handleCoordinatorMessage = async (text) => {
    if (!chatSessionRef.current) return;

    setSuggestions([]);
    const userMsg = {
      id: generateUniqueId(),
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const botMsgId = generateUniqueId();
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        role: "model",
        text: "",
        timestamp: new Date(),
        isThinking: true,
      },
    ]);

    let fullResponse = "";
    let structuredResponse = null;
    let lastUpdateTime = 0;
    const updateInterval = 50;

    structuredResponse = await sendMessageStream(
      chatSessionRef.current,
      text,
      (chunk) => {
        if (
          chunk.startsWith("{") ||
          (fullResponse.startsWith("{") && chunk.includes('"message"'))
        ) {
          if (chunk.length > fullResponse.length) {
            fullResponse = chunk;
          } else {
            fullResponse += chunk;
          }
        } else {
          fullResponse += chunk;
        }

        const now = Date.now();

        if (now - lastUpdateTime > updateInterval) {
          lastUpdateTime = now;
          try {
            const parsed = JSON.parse(fullResponse);
            const displayText = parsed.message || "";
            if (displayText) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: displayText, isThinking: false }
                    : m,
                ),
              );
            }
          } catch (e) {
            const messageMatch = fullResponse.match(
              /"message"\s*:\s*"((?:[^"\\]|\\.)*)/,
            );
            if (messageMatch) {
              const displayText = messageMatch[1]
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? {
                        ...m,
                        text: displayText,
                        isThinking: false,
                      }
                    : m,
                ),
              );
            }
          }
        }
      },
    );

    setIsStreaming(false);

    if (structuredResponse && typeof structuredResponse === "object") {
      const displayText =
        structuredResponse.message || filterJsonFromText(fullResponse);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, text: displayText, isThinking: false }
            : m,
        ),
      );

      const analysis = chatSessionRef.current?.resumeAnalysis;
      generateContextualSuggestions(displayText, analysis);

      if (structuredResponse.READY && structuredResponse.role) {
        // Sanitize the role to strip out any hallucinated AI functions like strip_tags()
        const rawRole = structuredResponse.role || "";
        const cleanRole = rawRole
          .replace(/strip_tags\([^)]*\)/gi, "")
          .replace(/["',]+$/, "")
          .trim();
        const cleanFocusArea =
          (structuredResponse.focusArea || "").replace(/["',]+$/, "").trim() ||
          "General";

        const config = {
          type: "role_based",
          roleDetails: {
            role: cleanRole,
            focusArea: cleanFocusArea,
            level: structuredResponse.level || "Mid-Level",
          },
          resumeData: resumeContext || undefined,
          language,
        };
        setInterviewConfig(config);

        setTimeout(() => {
          startInterview(config);
        }, 1500);
      }
      return;
    }

    const analysis = chatSessionRef.current?.resumeAnalysis;
    generateContextualSuggestions(fullResponse, analysis);

    let jsonMatch = fullResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (!jsonMatch) {
      jsonMatch = fullResponse.match(/(\{[\s\S]*?"READY"[\s\S]*?\})/);
    }

    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1];
        const data = JSON.parse(jsonStr);

        if (data.READY && data.role) {
          const cleanedText = filterJsonFromText(fullResponse);
          const transitionMessage =
            cleanedText || `Great! Starting your ${data.role} interview now...`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId ? { ...m, text: transitionMessage } : m,
            ),
          );

          // Sanitize the role to strip out any hallucinated AI functions like strip_tags()
          const rawRole = data.role || "";
          const cleanRole = rawRole
            .replace(/strip_tags\([^)]*\)/gi, "")
            .replace(/["',]+$/, "")
            .trim();
          const cleanFocusArea =
            (data.focusArea || "").replace(/["',]+$/, "").trim() || "General";

          const config = {
            type: "role_based",
            roleDetails: {
              role: cleanRole,
              focusArea: cleanFocusArea,
              level: data.level || "Mid-Level",
            },
            resumeData: resumeContext || undefined,
            language,
          };
          setInterviewConfig(config);

          setTimeout(() => {
            startInterview(config);
          }, 1500);
        }
      } catch (e) {
        console.error("Failed to parse coordinator JSON", e);
      }
    }
  };

  const startInterview = async (config) => {
    let id = activeInterviewId;
    startTimeRef.current = Date.now();

    if (!id) {
      try {
        const newInterview = await api.createInterview({
          role: config.roleDetails?.role || "Custom JD",
          focusArea: config.roleDetails?.focusArea,
          level: config.roleDetails?.level,
          language: config.language,
          totalQuestions,
          history: [],
        });
        id = newInterview._id;
        setActiveInterviewId(id);
      } catch (e) {
        console.error("Failed to create interview session", e);
      }
    }

    setAppState(AppState.INTERVIEW_ACTIVE);
    setCurrentQuestionCount(1);

    const context =
      config.type === "jd"
        ? { jd: config.jdText, language: config.language, totalQuestions }
        : {
            ...config.roleDetails,
            resumeData: config.resumeData,
            language: config.language,
            totalQuestions,
          };

    const chat = createInterviewerChat(context, [], id);
    chatSessionRef.current = chat;
    setMessages([]);

    setIsStreaming(true);
    const botMsgId = generateUniqueId();
    setMessages([
      {
        id: botMsgId,
        role: "model",
        text: "Preparing interview...",
        timestamp: new Date(),
        isThinking: true,
      },
    ]);

    let fullText = "";
    let lastUpdateTime = 0;
    const updateInterval = 50;

    const structuredResponse = await sendMessageStream(
      chat,
      "Start the interview now. Introduce yourself briefly and ask 'Tell me about yourself' as your first question.",
      (chunk) => {
        if (
          chunk.startsWith("{") ||
          (fullText.startsWith("{") && chunk.includes('"response"'))
        ) {
          if (chunk.length > fullText.length) {
            fullText = chunk;
          } else {
            fullText += chunk;
          }
        } else {
          fullText += chunk;
        }

        const now = Date.now();
        if (now - lastUpdateTime > updateInterval) {
          lastUpdateTime = now;
          try {
            const parsed = JSON.parse(fullText);
            const displayText = parsed.response || "";
            if (displayText) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: displayText, isThinking: false }
                    : m,
                ),
              );
            }
          } catch (e) {
            const responseMatch = fullText.match(
              /"response"\s*:\s*"((?:[^"\\]|\\.)*)/,
            );
            if (responseMatch) {
              const displayText = responseMatch[1]
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? {
                        ...m,
                        text: displayText,
                        isThinking: false,
                      }
                    : m,
                ),
              );
            }
          }
        }
      },
    );

    let displayText = fullText;
    let aiHistoryId = null;
    if (structuredResponse && typeof structuredResponse === "object") {
      displayText = structuredResponse.response || fullText;
      aiHistoryId = structuredResponse._metadata?.aiHistoryId || null;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === botMsgId ? { ...m, text: displayText, isThinking: false } : m,
      ),
    );

    if (displayText) {
      // Intro message — pass historyId for precise TTS audio mapping
      await speak(displayText, id, 0, false, aiHistoryId, language);
    }

    setIsStreaming(false);
  };

  const handleInterviewMessage = async (text) => {
    if (!chatSessionRef.current) return;

    const userInteractionId = generateUniqueId();
    const userMsg = {
      id: userInteractionId,
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const botMsgId = generateUniqueId();
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        role: "model",
        text: "Thinking...",
        timestamp: new Date(),
        isThinking: true,
      },
    ]);

    try {
      let fullResponse = "";
      let lastUpdateTime = 0;
      const updateInterval = 50;

      const structuredResponse = await sendMessageStream(
        chatSessionRef.current,
        text,
        (chunk) => {
          if (
            chunk.startsWith("{") ||
            (fullResponse.startsWith("{") && chunk.includes('"response"'))
          ) {
            if (chunk.length > fullResponse.length) {
              fullResponse = chunk;
            } else {
              fullResponse += chunk;
            }
          } else {
            fullResponse += chunk;
          }

          const now = Date.now();
          if (now - lastUpdateTime > updateInterval) {
            lastUpdateTime = now;
            try {
              const parsed = JSON.parse(fullResponse);
              const displayText = parsed.response || fullResponse;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: displayText, isThinking: false }
                    : m,
                ),
              );
            } catch (e) {
              const responseMatch = fullResponse.match(
                /"response"\s*:\s*"([^"]*)/,
              );
              const displayText = responseMatch
                ? responseMatch[1]
                : fullResponse.replace(/[{}"]|response:|^\s*/g, "");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? {
                        ...m,
                        text: displayText || "Thinking...",
                        isThinking: !displayText,
                      }
                    : m,
                ),
              );
            }
          }
        },
        {
          questionIndex: currentQuestionCount,
          interactionId: userInteractionId,
        },
      );

      let displayText = fullResponse;
      let isInterviewComplete = false;
      let questionNumber = currentQuestionCount;
      let aiHistoryId = null;

      if (structuredResponse && typeof structuredResponse === "object") {
        displayText = structuredResponse.response || fullResponse;
        isInterviewComplete = structuredResponse.isInterviewComplete || false;
        questionNumber =
          structuredResponse.questionNumber || currentQuestionCount + 1;
        aiHistoryId = structuredResponse._metadata?.aiHistoryId || null;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, text: displayText, isThinking: false }
            : m,
        ),
      );

      setCurrentQuestionCount(Math.min(questionNumber, totalQuestions));

      if (activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api
          .updateInterview(activeInterviewId, {
            durationSeconds: elapsed,
          })
          .catch((err) => console.error("Failed to update interview:", err));
      }

      if (isInterviewComplete || questionNumber > totalQuestions) {
        // Interview complete: start feedback API immediately in background
        const fullHistory = convertHistoryToMessages(
          chatSessionRef.current.history,
        );
        const feedbackPromise = generateFeedback(
          fullHistory,
          language,
          activeInterviewId,
        );

        // Play last message audio fully before redirecting.
        // Pass historyId for precise TTS audio mapping
        if (displayText) {
          await speak(
            displayText,
            activeInterviewId,
            questionNumber,
            true,
            aiHistoryId,
            language,
          );
        }

        // Audio finished — now redirect to feedback
        await handleEndInterview(fullHistory, feedbackPromise);
      } else {
        if (displayText) {
          await speak(
            displayText,
            activeInterviewId,
            questionNumber,
            false,
            aiHistoryId,
            language,
          );
        }
      }
    } catch (error) {
      console.error("Interview Error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                text: "Error processing your response. Please try again.",
                isThinking: false,
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleInterviewAudio = async (audioBlob, transcript) => {
    if (!chatSessionRef.current) return;

    // Dual-track: Show Web Speech text with '...' as preview, or placeholder if none
    const webSpeechText =
      transcript && transcript.trim() !== "" ? transcript.trim() : null;
    const displayText = webSpeechText
      ? `${webSpeechText}...`
      : "[Audio Recorded - Transcribing...]";

    const userInteractionId = generateUniqueId();
    const userMsg = {
      id: userInteractionId,
      role: "user",
      text: displayText,
      timestamp: new Date(),
      isAudio: true,
      isTranscribing: true,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    // Background transcription: replace preview with accurate Gemini transcript
    api
      .transcribeAudio(audioBlob)
      .then(({ transcript: backendTranscript }) => {
        if (backendTranscript && backendTranscript !== "[Silent]") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userInteractionId
                ? { ...m, text: backendTranscript, isTranscribing: false }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userInteractionId ? { ...m, isTranscribing: false } : m,
            ),
          );
        }
      })
      .catch((err) => {
        console.error("Background transcription failed:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userInteractionId ? { ...m, isTranscribing: false } : m,
          ),
        );
      });

    try {
      const base64Audio = await blobToBase64(audioBlob);

      const botMsgId = generateUniqueId();
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: "model",
          text: "Listening and thinking...",
          timestamp: new Date(),
          isThinking: true,
        },
      ]);

      // Upload WITHOUT Web Speech transcript — backend always uses Gemini for DB
      // Note: We start the upload before getting the response metadata (userHistoryId)
      // because the audioController falls back to questionIndex matching.
      // When metadata arrives, we could retry with historyId but the initial upload
      // with questionIndex is sufficient for the race-condition backfill in chatStream.
      if (activeInterviewId) {
        api
          .uploadAudioRecording(
            activeInterviewId,
            audioBlob,
            currentQuestionCount,
            0,
            null,
            null, // historyId
            userInteractionId, // interactionId
          )
          .catch((err) => console.error("Audio upload failed:", err));
      }

      const response = await sendAudioMessage(
        chatSessionRef.current,
        base64Audio,
        audioBlob.type,
        currentQuestionCount,
        userInteractionId,
      );

      let displayText = response;
      let isInterviewComplete = false;
      let questionNumber = currentQuestionCount + 1;
      let aiHistoryId = null;

      if (response && typeof response === "object") {
        displayText = response.response || JSON.stringify(response);
        isInterviewComplete = response.isInterviewComplete || false;
        questionNumber = response.questionNumber || currentQuestionCount + 1;
        aiHistoryId = response._metadata?.aiHistoryId || null;
      }

      setCurrentQuestionCount(Math.min(questionNumber, totalQuestions));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, text: displayText, isThinking: false }
            : m,
        ),
      );

      if (activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api.updateInterview(activeInterviewId, {
          durationSeconds: elapsed,
        });
      }

      if (isInterviewComplete || questionNumber > totalQuestions) {
        // Interview complete: start feedback API immediately in background
        const fullHistory = convertHistoryToMessages(
          chatSessionRef.current.history,
        );
        const feedbackPromise = generateFeedback(
          fullHistory,
          language,
          activeInterviewId,
        );

        // Play last message audio fully before redirecting.
        // Pass historyId for precise TTS audio mapping
        if (displayText) {
          await speak(
            displayText,
            activeInterviewId,
            questionNumber,
            true,
            aiHistoryId,
            language,
          );
        }

        // Audio finished — now redirect to feedback
        await handleEndInterview(fullHistory, feedbackPromise);
      } else {
        if (displayText) {
          await speak(
            displayText,
            activeInterviewId,
            questionNumber,
            false,
            aiHistoryId,
            language,
          );
        }
      }
    } catch (error) {
      console.error("Interview Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateUniqueId(),
          role: "system",
          text: "Error processing audio. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveAndExit = async () => {
    stop();
    if (activeInterviewId) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      await api.updateInterview(activeInterviewId, {
        status: "IN_PROGRESS",
        durationSeconds: elapsed,
      });
    }
    handleGoToDashboard();
  };

  const handleEndInterview = async (
    finalMessages = null,
    feedbackPromise = null,
  ) => {
    // Don't call stop() — audio has already finished playing
    // (or was never playing if called from End Session button).
    // Only stop if there's no pre-started feedbackPromise (manual end session).
    if (!feedbackPromise) {
      stop();
    }

    setAppState(AppState.INTERVIEW_FEEDBACK);
    setMessages((prev) => [
      ...prev,
      {
        id: generateUniqueId(),
        role: "system",
        text: "Interview ended. Generating detailed performance report...",
        timestamp: new Date(),
      },
    ]);

    try {
      const msgsToAnalyze = finalMessages || messages;
      // Use pre-started feedback promise if available, otherwise start fresh
      const feedback = feedbackPromise
        ? await feedbackPromise
        : await generateFeedback(msgsToAnalyze, language, activeInterviewId);

      if (!feedback || typeof feedback.overallScore === "undefined") {
        console.error("Invalid feedback received:", feedback);
        setFeedbackData({
          overallScore: 0,
          communicationScore: 0,
          technicalScore: 0,
          strengths: ["Feedback generation encountered an issue"],
          weaknesses: ["Please try again"],
          suggestion:
            "We couldn't generate detailed feedback for this session. Please try another interview.",
        });
      } else {
        setFeedbackData(feedback);
      }

      if (feedback && activeInterviewId) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        await api.updateInterview(activeInterviewId, {
          feedback: feedback,
          status: "COMPLETED",
          durationSeconds: elapsed,
        });
      }
    } catch (err) {
      console.error("Failed to generate/save feedback", err);
      setFeedbackData({
        overallScore: 0,
        communicationScore: 0,
        technicalScore: 0,
        strengths: ["Interview completed"],
        weaknesses: ["Feedback generation failed"],
        suggestion:
          "We encountered an error while generating your feedback. Please check your interview history for details.",
      });
    }
  };

  if (isResuming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">
            Resuming Interview...
          </p>
        </div>
      </div>
    );
  }

  if (appState === AppState.INTERVIEW_FEEDBACK) {
    if (!feedbackData) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <h2 className="text-xl font-semibold text-slate-800">
            Generating Performance Report...
          </h2>
          <p className="text-slate-500">
            Analyzing your answers, tone, and technical accuracy in {language}.
          </p>
        </div>
      );
    }
    return <FeedbackView data={feedbackData} onHome={handleGoToDashboard} />;
  }

  return (
    <>
      {appState !== AppState.INTERVIEW_ACTIVE && (
        <div className="absolute top-6 right-6 z-30">
          <MenuButton onClick={() => setIsDrawerOpen(true)} />
        </div>
      )}
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {appState === AppState.LANDING && (
        <Landing
          onSelectMode={handleSelectMode}
          totalQuestions={totalQuestions}
          onTotalQuestionsChange={setTotalQuestions}
        />
      )}

      {appState === AppState.SETUP_JD && (
        <JDPaste onStart={handleJDStart} onBack={handleBackToLanding} />
      )}

      {appState === AppState.SETUP_RESUME && (
        <ResumeUpload
          onFileSelect={handleResumeFileSelect}
          onBack={handleBackToLanding}
          isLoading={isStreaming}
        />
      )}

      {(appState === AppState.SETUP_ROLE_CHAT ||
        appState === AppState.SETUP_RESUME_CHAT) && (
        <ChatInterface
          title={
            appState === AppState.SETUP_RESUME_CHAT
              ? "Resume Analysis"
              : "Interview Setup"
          }
          messages={messages}
          onSendMessage={handleCoordinatorMessage}
          isStreaming={isStreaming}
          showBackButton
          onBack={handleBackToLanding}
          placeholder="Answer the coordinator..."
          mode="text"
          suggestions={getSuggestionChips()}
          onSuggestionClick={handleSuggestionClick}
          autoStartCountdown={autoStartCountdown}
        />
      )}

      {appState === AppState.INTERVIEW_ACTIVE && (
        <ChatInterface
          title="Mock Interview Session"
          messages={messages}
          onSendMessage={handleInterviewMessage}
          onSendAudio={handleInterviewAudio}
          onPlayAudio={handlePlayAudio}
          isStreaming={isStreaming}
          onEndSession={() => handleEndInterview()}
          onSaveExit={handleSaveAndExit}
          placeholder="Type your answer or use microphone..."
          mode="audio"
          currentQuestion={currentQuestionCount}
          totalQuestions={totalQuestions}
          isAudioPlaying={isAudioPlaying}
        />
      )}
    </>
  );
};
