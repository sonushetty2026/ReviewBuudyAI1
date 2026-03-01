import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFlowStore } from "../../stores/flowStore";
import ConversationStep from "../../components/feedback/ConversationStep";
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
  const { session, business, currentStep } = useFlowStore();

  useEffect(() => {
    if (!session || !business) {
      navigate(`/c/${slug}`);
    }
  }, [session, business, slug, navigate]);

  if (!session || !business || !sessionId) return null;

  const stepComponents: Record<string, React.ReactNode> = {
    conversation: <ConversationStep sessionId={sessionId} />,
    review_confirm: <ReviewConfirmStep sessionId={sessionId} />,
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
      style={{ backgroundColor: business.branding.secondary_color + "10" }}
    >
      {/* Header */}
      <div
        className="py-3 px-4 text-center text-white text-sm font-medium"
        style={{ backgroundColor: business.branding.primary_color }}
      >
        {business.name}
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col">
        {stepComponents[currentStep] || <div>Unknown step</div>}
      </div>
    </div>
  );
}
