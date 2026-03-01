import { useState } from "react";
import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";

interface Props {
  sessionId: string;
}

export default function GoogleReviewStep({ sessionId }: Props) {
  const { business, googleReviewUrl, reviewText, setCurrentStep } = useFlowStore();
  const [copied, setCopied] = useState(false);

  const handleCopyAndOpen = async () => {
    // Copy review text to clipboard
    try {
      await navigator.clipboard.writeText(reviewText);
      setCopied(true);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = reviewText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
    }

    // Track click
    await flowApi.recordGoogleClicked(sessionId).catch(() => {});

    // Open Google in new tab
    if (googleReviewUrl) {
      window.open(googleReviewUrl, "_blank");
    }

    // Move to return check after a moment
    setTimeout(() => {
      setCurrentStep("return_check");
    }, googleReviewUrl ? 2000 : 1000);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-gray-900">Post to Google</h3>
        <p className="text-sm text-gray-500 mt-2">
          Your review has been copied to your clipboard. Just paste it on Google!
        </p>

        <div className="mt-4 bg-gray-50 rounded-xl p-4 text-left">
          <p className="text-sm text-gray-700 leading-relaxed">{reviewText}</p>
        </div>

        <button
          onClick={handleCopyAndOpen}
          className="w-full mt-6 py-3 px-6 rounded-xl text-white font-semibold shadow-lg transition-all"
          style={{ backgroundColor: business?.branding.primary_color }}
        >
          {copied
            ? googleReviewUrl
              ? "Copied! Opening Google..."
              : "Copied to clipboard!"
            : "Copy & Open Google Reviews"}
        </button>

        {!googleReviewUrl && (
          <p className="mt-2 text-xs text-gray-400 text-center">
            Search for "{business?.name}" on Google to paste your review.
          </p>
        )}

        <button
          onClick={() => setCurrentStep("return_check")}
          className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
