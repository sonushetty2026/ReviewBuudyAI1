import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFlowStore } from "../../stores/flowStore";
import ConversationStep from "../../components/feedback/ConversationStep";
import CameraConversationStep from "../../components/feedback/CameraConversationStep";
import ReviewConfirmStep from "../../components/feedback/ReviewConfirmStep";
import ConsentStep from "../../components/feedback/ConsentStep";
import GoogleReviewStep from "../../components/feedback/GoogleReviewStep";
import ReturnCheckStep from "../../components/feedback/ReturnCheckStep";
import EmpathyStep from "../../components/feedback/EmpathyStep";
import ContactCollectionStep from "../../components/feedback/ContactCollectionStep";
import RewardStep from "../../components/feedback/RewardStep";
import ThankYouStep from "../../components/feedback/ThankYouStep";

export default function SessionPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const navigate = useNavigate();
  const { session, business, currentStep, presentationMode, setPresentationMode } = useFlowStore();
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !business) {
      navigate(`/c/${slug}`);
    }
  }, [session, business, slug, navigate]);

  if (!session || !business || !sessionId) return null;

  const handleFallbackToFast = () => {
    setPresentationMode("fast");
    setFallbackMessage("No problem — switching to Fast mode.");
    setTimeout(() => setFallbackMessage(null), 3000);
  };

  // Camera mode only applies to the conversation step
  const isCamera = presentationMode === "camera" && currentStep === "conversation";

  // Fix #15: Keep the conversation component mounted behind the ReviewOverlay
  // so the avatar stays visible instead of unmounting and killing the stream.
  const showConversationBehind = currentStep === "review_confirm";

  const conversationComponent = isCamera ? (
    <CameraConversationStep sessionId={sessionId} onFallbackToFast={handleFallbackToFast} />
  ) : (
    <ConversationStep sessionId={sessionId} />
  );

  const stepComponents: Record<string, React.ReactNode> = {
    conversation: conversationComponent,
    consent: <ConsentStep sessionId={sessionId} />,
    google_review: <GoogleReviewStep sessionId={sessionId} />,
    return_check: <ReturnCheckStep sessionId={sessionId} />,
    empathy: <EmpathyStep sessionId={sessionId} />,
    contact_collection: <ContactCollectionStep sessionId={sessionId} />,
    reward: <RewardStep sessionId={sessionId} />,
    thank_you: <ThankYouStep />,
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={isCamera ? undefined : { backgroundColor: business.branding.secondary_color + "10" }}
    >
      {/* Header — hide in camera mode for immersive feel */}
      {!isCamera && !showConversationBehind && (
        <div
          className="py-2 sm:py-3 px-4 text-center text-white text-xs sm:text-sm font-medium"
          style={{ backgroundColor: business.branding.primary_color }}
        >
          {business.name}
        </div>
      )}

      {/* Fallback message toast */}
      {fallbackMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-full shadow-lg">
          {fallbackMessage}
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex flex-col relative">
        {/* When on review_confirm, keep conversation visible behind a semi-transparent overlay */}
        {showConversationBehind && (
          <>
            <div className="absolute inset-0 z-0">{conversationComponent}</div>
            <div className="absolute inset-0 bg-black/40 z-10" />
            <div className="relative z-20 flex-1 flex flex-col overflow-auto">
              <ReviewConfirmStep sessionId={sessionId} />
            </div>
          </>
        )}

        {/* Normal step rendering (when NOT on review_confirm overlay) */}
        {!showConversationBehind && (
          stepComponents[currentStep] || <div>Unknown step</div>
        )}
      </div>
    </div>
  );
}
