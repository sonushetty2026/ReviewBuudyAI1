import { useState } from "react";
import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";

interface Props {
  sessionId: string;
}

export default function ConsentStep({ sessionId }: Props) {
  const { business, setGoogleReviewUrl, setCurrentStep } = useFlowStore();
  const [consentGoogle, setConsentGoogle] = useState(true);
  const [consentWebsite, setConsentWebsite] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data } = await flowApi.submitConsent(sessionId, consentWebsite, consentGoogle);
      if (data.google_review_url) {
        setGoogleReviewUrl(data.google_review_url);
        setCurrentStep("google_review");
      } else {
        setCurrentStep("reward");
      }
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Share Your Review</h3>
          <p className="text-sm text-gray-500 mt-1">
            Where would you like your review to appear?
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-primary-300 transition-colors">
            <input
              type="checkbox"
              checked={consentWebsite}
              onChange={(e) => setConsentWebsite(e.target.checked)}
              className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p className="font-medium text-gray-900">On our website</p>
              <p className="text-xs text-gray-500">Display on {business?.name}'s testimonials</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-primary-300 transition-colors">
            <input
              type="checkbox"
              checked={consentGoogle}
              onChange={(e) => setConsentGoogle(e.target.checked)}
              className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p className="font-medium text-gray-900">On Google</p>
              <p className="text-xs text-gray-500">Post to Google Reviews (opens in new tab)</p>
            </div>
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 px-6 rounded-xl text-white font-semibold shadow-lg disabled:opacity-50 transition-all"
          style={{ backgroundColor: business?.branding.primary_color }}
        >
          {submitting ? "Submitting..." : "Continue"}
        </button>

        <button
          onClick={() => setCurrentStep("reward")}
          className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
