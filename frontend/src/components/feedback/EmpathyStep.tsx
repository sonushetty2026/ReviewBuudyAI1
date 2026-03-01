import { useEffect } from "react";
import { useFlowStore } from "../../stores/flowStore";
import { useHeyGenAvatar } from "../../hooks/useHeyGenAvatar";

interface Props {
  sessionId: string;
}

export default function EmpathyStep({ sessionId: _sessionId }: Props) {
  const { business, analysisResult, setCurrentStep } = useFlowStore();
  const { speakText, isAvatarReady, videoRef, startAvatar, stopAvatar } = useHeyGenAvatar();

  const empathyMessage =
    analysisResult?.summary
      ? `We're sorry to hear about your experience. ${analysisResult.summary} Your feedback is important to us, and we want to make things right.`
      : "We're really sorry about your experience. Your feedback matters, and we want to make things right.";

  useEffect(() => {
    startAvatar();
    return () => {
      stopAvatar();
    };
  }, []);

  useEffect(() => {
    if (isAvatarReady) {
      speakText(empathyMessage);
    }
  }, [isAvatarReady]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      {/* Avatar */}
      <div className="relative bg-gray-900 rounded-xl overflow-hidden w-full max-w-sm aspect-video mb-6">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      <div className="w-full max-w-md text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">We Hear You</h3>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          {empathyMessage}
        </p>

        <button
          onClick={() => setCurrentStep("contact_collection")}
          className="w-full mt-6 py-3 px-6 rounded-xl text-white font-semibold shadow-lg transition-all"
          style={{ backgroundColor: business?.branding.primary_color }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
