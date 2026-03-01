import { useCallback, useEffect, useRef, useState } from "react";
import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";
import { useHeyGenAvatar } from "../../hooks/useHeyGenAvatar";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { useCamera } from "../../hooks/useCamera";

// Session protection constants
const MAX_SESSION_MS = 5 * 60 * 1000;
const IDLE_WARNING_MS = 90 * 1000;
const IDLE_KILL_MS = 2 * 60 * 1000;

interface Props {
  sessionId: string;
  onFallbackToFast: () => void;
}

export default function CameraConversationStep({ sessionId, onFallbackToFast }: Props) {
  const {
    session,
    business,
    messages,
    inputMode,
    addMessage,
    setCurrentStep,
    setAnalysisResult,
    setReviewText,
    setInputMode,
  } = useFlowStore();

  const [textInput, setTextInput] = useState("");
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [showGuidance, setShowGuidance] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const greetingAddedRef = useRef(false);
  const completingRef = useRef(false);

  // Ref for stale-closure-safe access to latest handler
  const handleSendRef = useRef<((content: string, source?: string) => Promise<void>) | null>(null);

  const { cameraVideoRef, isCameraActive, startCamera, stopCamera } = useCamera();

  const { videoRef: avatarVideoRef, isAvatarReady, speakText, startAvatar, stopAvatar, error: avatarError } =
    useHeyGenAvatar();

  const onTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        setInterimTranscript("");
        handleSendRef.current?.(text, "voice");
      } else {
        setInterimTranscript(text);
      }
    },
    []
  );

  const { isRecording, startRecording, stopRecording, permissionDenied, error: audioError } =
    useAudioRecorder({ sessionId, onTranscript });

  // --- Session timeout protection ---
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleKillRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleKillRef.current) clearTimeout(idleKillRef.current);
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
  }, []);

  const resetIdleTimers = useCallback(() => {
    setIdleWarning(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleKillRef.current) clearTimeout(idleKillRef.current);

    idleTimerRef.current = setTimeout(() => {
      setIdleWarning(true);
    }, IDLE_WARNING_MS);

    idleKillRef.current = setTimeout(() => {
      if (!completingRef.current) {
        handleComplete();
      }
    }, IDLE_KILL_MS);
  }, []);

  // Start camera and avatar on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      const cameraOk = await startCamera();
      if (!mounted) return;

      if (!cameraOk) {
        onFallbackToFast();
        return;
      }
      setCameraReady(true);
      startAvatar();
    }

    init();

    // 5-minute hard cap
    sessionTimerRef.current = setTimeout(() => {
      if (!completingRef.current) {
        handleComplete();
      }
    }, MAX_SESSION_MS);
    resetIdleTimers();

    return () => {
      mounted = false;
      stopCamera();
      stopAvatar();
      stopRecording();
      clearAllTimers();
    };
  }, []);

  // Speak greeting when avatar is ready
  useEffect(() => {
    if (isAvatarReady && session?.greeting) {
      speakText(session.greeting);
    }
  }, [isAvatarReady, session?.greeting]);

  // Add greeting — guarded against StrictMode double-fire
  useEffect(() => {
    if (session?.greeting && messages.length === 0 && !greetingAddedRef.current) {
      greetingAddedRef.current = true;
      addMessage({ role: "assistant", content: session.greeting, source: "text" });
    }
  }, [session?.greeting]);

  // Start recording when avatar is ready OR when avatar has failed
  useEffect(() => {
    if (inputMode === "voice" && !isRecording && !permissionDenied) {
      if (isAvatarReady || avatarError) {
        startRecording();
      }
    }
  }, [inputMode, isAvatarReady, avatarError]);

  // If mic denied, switch to text input (camera stays)
  useEffect(() => {
    if (permissionDenied && inputMode === "voice") {
      setInputMode("text");
    }
  }, [permissionDenied]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  // Auto-dismiss guidance after 5 seconds
  useEffect(() => {
    if (showGuidance && cameraReady) {
      const timer = setTimeout(() => setShowGuidance(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showGuidance, cameraReady]);

  const handleSendMessage = async (content: string, source: string = "text") => {
    if (!content.trim() || sending || completingRef.current) return;
    setSending(true);
    resetIdleTimers();

    addMessage({ role: "user", content, source: source as "voice" | "text" });

    try {
      const { data } = await flowApi.sendMessage(sessionId, content, source);
      addMessage({ role: "assistant", content: data.text, source: "text" });

      if (isAvatarReady) {
        speakText(data.text);
      }

      if (data.ready_to_complete) {
        await handleComplete();
      }
    } catch {
      addMessage({
        role: "assistant",
        content: "Sorry, something went wrong. Let me try again.",
        source: "text",
      });
    } finally {
      setSending(false);
    }
  };

  // Keep ref always pointing to latest handleSendMessage
  handleSendRef.current = handleSendMessage;

  const handleComplete = async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);
    stopRecording();
    stopCamera();
    stopAvatar(); // Fix #16: stop avatar to stop burning HeyGen credits
    clearAllTimers();

    try {
      const { data } = await flowApi.completeSession(sessionId);
      setAnalysisResult(data);

      if (data.flow === "positive" && data.rewritten_review) {
        setReviewText(data.rewritten_review);
        setCurrentStep("review_confirm");
      } else {
        setCurrentStep("empathy");
      }
    } catch {
      completingRef.current = false;
      setCompleting(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      handleSendMessage(textInput.trim(), "text");
      setTextInput("");
    }
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Layer 1: Camera background — full screen */}
      <video
        ref={cameraVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/20" style={{ zIndex: 1 }} />

      {/* Idle warning */}
      {idleWarning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-500 text-white text-sm rounded-full shadow-lg animate-pulse">
          Still there? Session will end soon if idle.
        </div>
      )}

      {/* Layer 2: Avatar overlay — PiP bubble bottom-right */}
      <div
        className="absolute bottom-28 right-3 w-44 h-44 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30"
        style={{ zIndex: 10 }}
      >
        <video
          ref={avatarVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {!isAvatarReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
          </div>
        )}
      </div>

      {/* Layer 3: UI controls */}
      <div className="relative flex-1 flex flex-col" style={{ zIndex: 5 }}>
        {/* Top bar: Switch to Fast Mode */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            {isCameraActive && (
              <span className="flex items-center gap-1 px-2 py-1 bg-green-500/80 text-white text-xs rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <button
            onClick={onFallbackToFast}
            className="px-3 py-1.5 bg-white/80 backdrop-blur-sm text-gray-700 text-xs font-medium rounded-full hover:bg-white transition-colors"
          >
            Switch to Fast Mode
          </button>
        </div>

        {/* Guidance overlay */}
        {showGuidance && cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20 }}>
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-6 mx-6 max-w-sm text-center">
              <p className="text-white text-base font-medium">
                AR Mode — your space is the backdrop!
              </p>
              <p className="text-white/70 text-sm mt-2">
                Hold phone at chest or eye height. Not seeing the room? Tilt up.
              </p>
              <button
                onClick={() => setShowGuidance(false)}
                className="mt-4 px-6 py-2 bg-white text-gray-900 font-medium rounded-full text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Messages — scrollable area in the middle */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm backdrop-blur-sm ${
                  msg.role === "user"
                    ? "bg-white/90 text-gray-900 rounded-br-md"
                    : "bg-black/50 text-white rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {interimTranscript && (
            <div className="flex justify-end">
              <div className="max-w-[75%] px-3 py-2 rounded-2xl text-sm bg-white/60 text-gray-700 rounded-br-md backdrop-blur-sm">
                {interimTranscript}...
              </div>
            </div>
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-2xl bg-black/50 rounded-bl-md backdrop-blur-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area — bottom of screen */}
        {completing ? (
          <div className="px-4 py-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto" />
            <p className="mt-2 text-sm text-white/80">Analyzing your feedback...</p>
          </div>
        ) : inputMode === "text" ? (
          <form
            onSubmit={handleTextSubmit}
            className="px-3 py-3 flex gap-2"
          >
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your feedback..."
              className="flex-1 px-4 py-2 bg-white/90 backdrop-blur-sm border border-white/30 rounded-full focus:ring-2 focus:ring-white/50 focus:border-transparent outline-none text-sm"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || sending}
              className="p-2 rounded-full text-white disabled:opacity-50"
              style={{ backgroundColor: business?.branding.primary_color }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        ) : (
          <div className="px-4 py-3 sm:py-4 flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isRecording
                    ? "bg-red-500 animate-pulse"
                    : "bg-white/90"
                }`}
              >
                <svg
                  className={`w-7 h-7 sm:w-8 sm:h-8 ${isRecording ? "text-white" : ""}`}
                  style={!isRecording ? { color: business?.branding.primary_color } : undefined}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              <button
                onClick={() => setInputMode("text")}
                className="px-3 py-2 bg-white/70 backdrop-blur-sm rounded-full text-xs font-medium text-gray-700"
              >
                Type instead
              </button>
            </div>
            {audioError && (
              <p className="text-xs text-red-300 text-center">{audioError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
