import { useEffect, useState } from "react";
import {
  dashboardApi,
  type Business,
  type Branding,
  type Stats,
} from "../../api/dashboard";

export default function DashboardHome() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.getBusiness().then(({ data }) => setBusiness(data));
    dashboardApi.getBranding().then(({ data }) => setBranding(data));
    dashboardApi.getStats().then(({ data }) => setStats(data));
    dashboardApi.getQrCode().then(setQrUrl).catch(() => {});
  }, []);

  const brandingConfigured =
    branding?.welcome_message &&
    branding.welcome_message !== "How was your experience?";
  const googleConfigured = !!business?.google_place_id;
  const customerUrl = business
    ? `${window.location.origin}/c/${business.slug}`
    : "";

  const statCards = [
    {
      label: "Total Scans",
      value: stats?.total_sessions ?? 0,
      color: "bg-blue-500",
    },
    {
      label: "Completed Feedbacks",
      value: stats?.completed_feedbacks ?? 0,
      color: "bg-green-500",
    },
    {
      label: "Google Reviews",
      value: stats?.google_reviews ?? 0,
      color: "bg-yellow-500",
    },
    {
      label: "Complaints",
      value: stats?.complaints ?? 0,
      color: "bg-red-500",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">
        {business ? `Welcome, ${business.name}` : "Dashboard"}
      </h2>
      <p className="mt-2 text-gray-600">Your review concierge overview</p>

      {/* Stats cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${stat.color}`} />
              <span className="text-sm font-medium text-gray-500">
                {stat.label}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your QR Code
          </h3>
          {qrUrl ? (
            <div className="flex flex-col items-center gap-4">
              <img
                src={qrUrl}
                alt="Customer flow QR code"
                className="w-48 h-48"
              />
              <p className="text-sm text-gray-500 break-all text-center">
                {customerUrl}
              </p>
              <a
                href={qrUrl}
                download={`${business?.slug || "qr"}-code.png`}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm"
              >
                Download QR Code
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400">
              Loading QR code...
            </div>
          )}
        </div>

        {/* Getting started section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Getting Started
          </h3>
          <div className="mt-4 space-y-3">
            <ChecklistItem
              step={1}
              done={!!brandingConfigured}
              text="Set up your business branding in Settings"
            />
            <ChecklistItem
              step={2}
              done={googleConfigured}
              text="Add your Google Place ID for review routing"
            />
            <ChecklistItem
              step={3}
              done={!!qrUrl}
              text="QR code is ready — print and place at checkout"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({
  step,
  done,
  text,
}: {
  step: number;
  done: boolean;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          done
            ? "bg-green-100 text-green-600"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {done ? "\u2713" : step}
      </div>
      <span className={done ? "text-gray-700" : "text-gray-500"}>{text}</span>
    </div>
  );
}
