import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";

interface Props {
  sessionId: string;
}

export default function ReturnCheckStep({ sessionId }: Props) {
  const { business, setCurrentStep } = useFlowStore();

  const handleResponse = async (posted: boolean | null) => {
    if (posted !== null) {
      await flowApi.recordGoogleStatus(sessionId, posted).catch(() => {});
    }
    setCurrentStep("reward");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md text-center">
        <h3 className="text-lg font-semibold text-gray-900">Did you post your review?</h3>
        <p className="text-sm text-gray-500 mt-2">
          No pressure — just helps us know how we're doing.
        </p>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => handleResponse(true)}
            className="w-full py-3 px-6 rounded-xl text-white font-semibold shadow-lg transition-all"
            style={{ backgroundColor: business?.branding.primary_color }}
          >
            Yes, I posted it!
          </button>
          <button
            onClick={() => handleResponse(false)}
            className="w-full py-3 px-6 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Not yet
          </button>
          <button
            onClick={() => handleResponse(null)}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
