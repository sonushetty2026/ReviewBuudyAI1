import { useState } from "react";
import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";

interface Props {
  sessionId: string;
}

export default function ContactCollectionStep({ sessionId }: Props) {
  const { business, setCurrentStep } = useFlowStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await flowApi.submitContact(sessionId, {
        name: name || undefined,
        phone: phone || undefined,
        email: email || undefined,
      });
    } catch {
      // Continue even if save fails
    }
    setCurrentStep("reward");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">How Can We Reach You?</h3>
          <p className="text-sm text-gray-500 mt-1">
            Optional — share your info so we can follow up and make things right.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              type="tel"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6 py-3 px-6 rounded-xl text-white font-semibold shadow-lg disabled:opacity-50 transition-all"
          style={{ backgroundColor: business?.branding.primary_color }}
        >
          {submitting ? "Saving..." : "Continue"}
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
