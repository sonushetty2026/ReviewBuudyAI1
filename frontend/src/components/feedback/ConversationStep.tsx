import { useCallback, useEffect, useRef, useState } from "react";
import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";
import { useHeyGenAvatar } from "../../hooks/useHeyGenAvatar";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";

interface Props {
  sessionId: string;
}

export default function ConversationStep({ sessionId }: Props) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { videoRef, isAvatarReady, speakText, startAvatar, stopAvatar, error: avatarError } =
    useHeyGenAvatar();

  const onTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        setInterimTranscript("");
        handleSendMessage(text, "voice");
      } else {
        setInterimTranscript(text);
      }
    },
    [sessionId]
  );

  const { isRecording, startRecording, stopRecording, permissionDenied, error: audioError } =
    useAudioRecorder({ sessionId, onTranscript });

  // Start avatar on mount
  useEffect(() => {
    startAvatar();
    return () => {
      stopAvatar();
      stopRecording();
    };
  }, []);

  // Speak greeting when avatar is ready
  useEffect(() => {
    if (isAvatarReady && session?.greeting) {
      speakText(session.greeting);
    }
  }, [isAvatarReady, session?.greeting]);

  // Add greeting to messages on mount
  useEffect(() => {
    if (session?.greeting && messages.length === 0) {
      addMessage({ role: "assistant", content: session.greeting, source: "text" });
    }
  }, [session?.greeting]);

  // Start recording if voice mode and avatar ready
  useEffect(() => {
    if (inputMode === "voice" && isAvatarReady && !isRecording && !permissionDenied) {
      startRecording();
    }
  }, [inputMode, isAvatarReady]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  // Handle permission denied → switch to text
  useEffect(() => {
    if (permissionDenied && inputMode === "voice") {
      // Don't auto-switch, show recovery UI
    }
  }, [permissionDenied]);

  const handleSendMessage = async (content: string, source: string = "text") => {
    if (!content.trim() || sending) return;
    setSending(true);

    addMessage({ role: "user", content, source: source as "voice" | "text" });

    try {
      const { data } = await flowApi.sendMessage(sessionId, content, source);
      addMessage({ role: "assistant", content: data.text, source: "text" });

      // Make avatar speak
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

  const handleComplete = async () => {
    setCompleting(true);
    stopRecording();

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

  if (permissionDenied && inputMode === "voice") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Microphone Access Needed</h3>
        <p className="mt-2 text-gray-600 text-sm">
          To have a voice conversation, please allow microphone access in your browser settings.
        </p>
        <div className="mt-6 space-y-3 w-full max-w-xs">
          <button
            onClick={() => {
              startRecording();
            }}
            className="w-full py-3 px-4 rounded-lg font-medium text-white"
            style={{ backgroundColor: business?.branding.primary_color }}
          >
            Try Again
          </button>
          <button
            onClick={() => {
              setInputMode("text");
            }}
            className="w-full py-3 px-4 rounded-lg font-medium text-gray-600 hover:bg-gray-100"
          >
            Type Instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Avatar video */}
      <div className="relative bg-gray-900 aspect-video max-h-[40vh]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {!isAvatarReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
              <p className="mt-2 text-sm opacity-75">
                {avatarError || "Connecting avatar..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                msg.role === "user"
                  ? "bg-primary-600 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-900 rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {interimTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[80%] px-4 py-2 rounded-2xl text-sm bg-primary-200 text-primary-800 rounded-br-md opacity-70">
              {interimTranscript}...
            </div>
          </div>
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-2xl bg-gray-100 rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {completing ? (
        <div className="px-4 py-4 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Analyzing your feedback...</p>
        </div>
      ) : inputMode === "text" ? (
        <form onSubmit={handleTextSubmit} className="px-4 py-3 border-t border-gray-200 flex gap-2">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your feedback..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
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
        <div className="px-4 py-4 flex items-center justify-center gap-4">
          <button
            onClick={() => {
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? "bg-red-500 animate-pulse"
                : "bg-primary-600"
            } text-white shadow-lg`}
            style={!isRecording ? { backgroundColor: business?.branding.primary_color } : undefined}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          {audioError && (
            <p className="text-xs text-red-500">{audioError}</p>
          )}
        </div>
      )}
    </div>
  );
}
