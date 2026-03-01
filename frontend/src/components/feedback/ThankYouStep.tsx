import { useFlowStore } from "../../stores/flowStore";

export default function ThankYouStep() {
  const { business } = useFlowStore();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2
          className="text-2xl font-bold"
          style={{ color: business?.branding.primary_color }}
        >
          Thank You!
        </h2>

        <p className="mt-3 text-gray-600 leading-relaxed">
          {business?.branding.thank_you_message || "Thanks for your feedback!"}
        </p>

        <p className="mt-8 text-xs text-gray-400">
          Powered by Scan & Speak
        </p>
      </div>
    </div>
  );
}
