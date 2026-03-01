import { useFlowStore } from "../../stores/flowStore";

interface Props {
  sessionId: string;
}

export default function EmpathyStep({ sessionId: _sessionId }: Props) {
  const { business, analysisResult, setCurrentStep } = useFlowStore();

  const empathyMessage =
    analysisResult?.summary
      ? `We're sorry to hear about your experience. ${analysisResult.summary} Your feedback is important to us, and we want to make things right.`
      : "We're really sorry about your experience. Your feedback matters, and we want to make things right.";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md text-center">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">We Hear You</h3>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
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
