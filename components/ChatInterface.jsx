import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  ArrowLeft,
  StopCircle,
  Volume2,
  Target,
  Keyboard,
  Mic,
  Save,
  HelpCircle,
} from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { Button } from "./ui/Button";
import { AudioRecorder } from "./AudioRecorder";

export const ChatInterface = ({
  messages,
  onSendMessage,
  onSendAudio,
  isStreaming,
  onEndSession,
  onSaveExit,
  title,
  placeholder = "Type your answer...",
  showBackButton,
  onBack,
  mode = "text",
  currentQuestion,
  totalQuestions,
  onPlayAudio,
  suggestions = [],
  onSuggestionClick,
  isAudioPlaying,
  autoStartCountdown = null,
}) => {
  const [activeInputMode, setActiveInputMode] = useState(mode);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Enable text input via localStorage flag OR if no audio handler is provided
  const enableTextInput =
    localStorage.getItem("enableTextInput") === "true" || !onSendAudio;

  useEffect(() => {
    setActiveInputMode(mode);
  }, [mode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeInputMode]);

  useEffect(() => {
    if (!isStreaming && activeInputMode === "text") {
      inputRef.current?.focus();
    }
  }, [isStreaming, activeInputMode]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const progressPercentage =
    currentQuestion !== undefined && totalQuestions
      ? Math.min((currentQuestion / totalQuestions) * 100, 100)
      : 0;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100">
      {/* Top Header */}
      {/* Top Header */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-20 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-6 py-4">
          {/* Left Section: Session Info & Quick Tips */}
          <div className="flex items-center gap-3 md:gap-5">
            {/* Title Block */}
            <div className="flex items-center gap-3">
              {showBackButton && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {title}
                </h1>
                <p className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                  {mode === "audio" ? (
                    <Volume2 size={14} className="text-blue-500" />
                  ) : (
                    <Send size={14} className="text-emerald-500" />
                  )}
                  <span
                    className={`w-2 h-2 rounded-full ${mode === "audio" ? "bg-blue-500" : "bg-emerald-500"} animate-pulse`}
                  ></span>
                  {mode === "audio" ? "Voice Session" : "Live Chat"}
                </p>
              </div>
            </div>

            {/* Quick Tips Hoverable - Moved here */}
            {/* Note: I added a subtle left border to visually separate it from the title */}
            <div className="relative group border-l border-slate-200 pl-3 hidden sm:block">
              <button className="flex items-center gap-2 p-2 text-slate-500 hover:text-blue-600 transition-colors">
                <span className="text-sm font-semibold">Quick Tips</span>
                <HelpCircle size={20} />
              </button>
              {/* Note: Changed right-0 to left-0 so the dropdown expands inward instead of off the screen */}
              <div className="absolute top-full left-6 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 p-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                  Quick Tips
                </h3>
                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    Take your time to structure your answers
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    To pause and resume your interview later, click on the save and exit button
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    To end interview at any point, click on the end interview button
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    Ask clarifying questions if needed
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Section: Progress & Actions */}
          <div className="flex items-center gap-6 md:gap-8">
            {/* Progress - Moved here */}
            {typeof currentQuestion !== "undefined" && totalQuestions > 0 && (
              <div className="flex flex-col items-end pr-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target size={14} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Progress
                  </span>
                </div>
                <p className="text-lg font-bold text-slate-800">
                  Question{" "}
                  <span className="text-blue-600">{currentQuestion}</span> /{" "}
                  <span className="text-slate-400">{totalQuestions}</span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              {onSaveExit && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onSaveExit}
                  className="flex items-center gap-2 font-semibold px-5"
                >
                  <Save size={18} />
                  Save & Exit
                </Button>
              )}
              {onEndSession && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={onEndSession}
                  className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold px-5"
                >
                  <StopCircle size={18} />
                  End Interview
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar - Thick line at bottom of header */}
        {typeof currentQuestion !== "undefined" && totalQuestions > 0 && (
          <div className="w-full bg-slate-100 h-[6px]">
            <div
              className="bg-blue-600 h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        )}
      </header>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0 bg-slate-50 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:px-12 xl:px-16 space-y-4 scroll-smooth">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-80">
              <p className="text-lg">
                {mode === "audio"
                  ? "The interviewer will start speaking..."
                  : "Send a message to start..."}
              </p>
            </div>
          )}
          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            const showRehear =
              isLastMessage && msg.role === "model" && !isStreaming;

            return (
              <ChatMessage
                key={msg.id}
                message={msg}
                onPlayAudio={onPlayAudio}
                showRehear={showRehear}
                isAudioPlaying={isAudioPlaying}
              />
            );
          })}
          {isStreaming && activeInputMode === "audio" && (
            <div className="flex justify-start w-full mb-6">
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                Interviewer is speaking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {suggestions.length > 0 && !isStreaming && (
          <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-3 pb-2 bg-white border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 font-medium">
                Quick replies
              </p>
              {autoStartCountdown !== null && autoStartCountdown > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 font-medium">
                    Interview begins in
                  </span>
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                      <circle
                        cx="16"
                        cy="16"
                        r="13"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="16"
                        cy="16"
                        r="13"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 13}`}
                        strokeDashoffset={`${2 * Math.PI * 13 * (1 - autoStartCountdown / 15)}`}
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                      />
                    </svg>
                    <span className="absolute text-xs font-bold text-blue-600">
                      {autoStartCountdown}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className="px-4 py-2 text-sm bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-full border border-slate-200 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
                >
                  {suggestion.label || suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div
          className={`px-4 md:px-8 lg:px-12 xl:px-16 py-6 bg-white ${suggestions.length === 0 || isStreaming ? "border-t border-slate-200" : ""} transition-all duration-300`}
        >
          {activeInputMode === "audio" && onSendAudio ? (
            <div className="flex flex-col items-center justify-center py-4 relative">
              <AudioRecorder
                onRecordingComplete={onSendAudio}
                disabled={isStreaming || isAudioPlaying}
                isProcessing={isStreaming}
              />
              {enableTextInput && (
                <button
                  onClick={() => setActiveInputMode("text")}
                  className="mt-4 flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  disabled={isStreaming}
                >
                  <Keyboard size={18} />
                  Type response instead
                </button>
              )}
            </div>
          ) : (
            <div className="relative max-w-4xl mx-auto w-full">
              <form
                onSubmit={handleSubmit}
                className="relative flex items-end gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-xl transition-all"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={isStreaming}
                  className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-base p-3 focus:outline-none resize-none max-h-32 min-h-[52px]"
                  rows={1}
                  style={{ height: "auto", minHeight: "52px" }}
                  onInput={(e) => {
                    const target = e.target;
                    target.style.height = "auto";
                    target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl text-white transition-all shadow-md shadow-blue-500/20 mb-[1px]"
                >
                  <Send size={20} />
                </button>
              </form>
              {onSendAudio && (
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => setActiveInputMode("audio")}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                    disabled={isStreaming}
                  >
                    <Mic size={18} />
                    Switch to Voice
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
