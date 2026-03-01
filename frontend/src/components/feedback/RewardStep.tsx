import { useEffect, useState } from "react";
import { toast } from "sonner";
import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";

interface Props {
  sessionId: string;
}

export default function RewardStep({ sessionId }: Props) {
  const { business, reward, setReward, setCurrentStep } = useFlowStore();
  const [loading, setLoading] = useState(true);
  const [noReward, setNoReward] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  useEffect(() => {
    flowApi
      .claimReward(sessionId)
      .then(({ data }) => {
        setReward(data);
        setLoading(false);
      })
      .catch(() => {
        setNoReward(true);
        setLoading(false);
      });
  }, [sessionId]);

  const handleSendSms = async () => {
    if (!smsPhone.trim()) return;
    setSendingSms(true);
    try {
      const { data } = await flowApi.claimReward(sessionId, true, smsPhone);
      if (data.sms_sent) {
        setSmsSent(true);
      }
    } catch {
      toast.error("Couldn't send SMS. Please write down your code.");
    } finally {
      setSendingSms(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (noReward) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">Thank you!</h3>
          <p className="mt-2 text-sm text-gray-500">Your feedback means a lot to us.</p>
          <button
            onClick={() => setCurrentStep("thank_you")}
            className="mt-6 py-3 px-8 rounded-xl text-white font-semibold shadow-lg"
            style={{ backgroundColor: business?.branding.primary_color }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-gray-900">Your Reward!</h3>
        {reward && (
          <>
            <p className="mt-2 text-sm text-gray-600">{reward.description}</p>

            <div className="mt-4 bg-white border-2 border-dashed border-primary-300 rounded-xl p-6">
              <p className="text-3xl font-mono font-bold tracking-wider" style={{ color: business?.branding.primary_color }}>
                {reward.code}
              </p>
              {reward.expires_at && (
                <p className="mt-2 text-xs text-gray-400">
                  Expires {new Date(reward.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>

            {!smsSent ? (
              <div className="mt-6">
                <p className="text-sm text-gray-500 mb-2">Want it texted to you?</p>
                <div className="flex gap-2">
                  <input
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="Phone number"
                    type="tel"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  />
                  <button
                    onClick={handleSendSms}
                    disabled={sendingSms || !smsPhone.trim()}
                    className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                    style={{ backgroundColor: business?.branding.primary_color }}
                  >
                    {sendingSms ? "..." : "Send"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-green-600 font-medium">
                Sent! Check your phone.
              </p>
            )}
          </>
        )}

        <button
          onClick={() => setCurrentStep("thank_you")}
          className="w-full mt-6 py-3 px-6 rounded-xl text-white font-semibold shadow-lg"
          style={{ backgroundColor: business?.branding.primary_color }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
