import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";
import { useFingerprint } from "../../hooks/useFingerprint";

export default function WelcomePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { business, setBusiness, setSession, setInputMode, reset } = useFlowStore();
  const { getFingerprint } = useFingerprint();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reset();
    if (!slug) return;
    flowApi
      .getBusiness(slug)
      .then(({ data }) => {
        setBusiness(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Business not found");
        setLoading(false);
      });
  }, [slug]);

  const startSession = async (mode: "voice" | "text") => {
    if (!slug || starting) return;
    setStarting(true);
    setError(null);

    try {
      const fp = await getFingerprint();
      setInputMode(mode);
      const { data } = await flowApi.startSession(slug, fp.visitorId, fp.requestId, mode);
      setSession(data);
      navigate(`/c/${slug}/session/${data.id}`);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError("You've reached the session limit. Please try again later.");
      } else {
        setError("Failed to start session. Please try again.");
      }
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Oops!</h2>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!business) return null;

  const { branding } = business;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: branding.secondary_color + "10" }}
    >
      <div className="w-full max-w-md text-center">
        {branding.logo_url && (
          <img
            src={branding.logo_url}
            alt={business.name}
            className="w-20 h-20 mx-auto mb-4 rounded-full object-cover"
          />
        )}

        <h1
          className="text-3xl font-bold"
          style={{ color: branding.primary_color }}
        >
          {business.name}
        </h1>

        <p className="mt-4 text-lg text-gray-700">{branding.welcome_message}</p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => startSession("voice")}
            disabled={starting}
            className="w-full py-4 px-6 rounded-xl text-white font-semibold text-lg shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            style={{ backgroundColor: branding.primary_color }}
          >
            {starting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start (Mic On)
              </span>
            )}
          </button>

          <button
            onClick={() => startSession("text")}
            disabled={starting}
            className="w-full py-3 px-6 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Type instead
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-400">
          Powered by Scan & Speak
        </p>
      </div>
    </div>
  );
}
