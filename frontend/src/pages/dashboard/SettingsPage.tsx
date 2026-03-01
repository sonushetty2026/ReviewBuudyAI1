import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  dashboardApi,
  type Business,
  type Branding,
  type RewardTemplate,
} from "../../api/dashboard";

const EMPTY_REWARD = {
  name: "",
  reward_type: "discount",
  reward_value: "",
  expiry_days: 30,
};

export default function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [saving, setSaving] = useState(false);

  // Rewards state
  const [rewards, setRewards] = useState<RewardTemplate[]>([]);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardForm, setRewardForm] = useState(EMPTY_REWARD);

  useEffect(() => {
    Promise.all([
      dashboardApi.getBusiness(),
      dashboardApi.getBranding(),
      dashboardApi.getRewardTemplates(),
    ]).then(([bizRes, brandRes, rewardRes]) => {
      setBusiness(bizRes.data);
      setBranding(brandRes.data);
      setRewards(rewardRes.data);
    });
  }, []);

  const saveBusiness = async () => {
    if (!business) return;
    setSaving(true);
    try {
      const { data } = await dashboardApi.updateBusiness({
        name: business.name,
        google_place_id: business.google_place_id,
        industry: business.industry,
        phone: business.phone,
        address: business.address,
      });
      setBusiness(data);
      toast.success("Business settings saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveBranding = async () => {
    if (!branding) return;
    setSaving(true);
    try {
      const { data } = await dashboardApi.updateBranding({
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        avatar_style: branding.avatar_style,
        welcome_message: branding.welcome_message,
        thank_you_message: branding.thank_you_message,
      });
      setBranding(data);
      toast.success("Branding saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveReward = async () => {
    try {
      if (editingRewardId) {
        const { data } = await dashboardApi.updateRewardTemplate(
          editingRewardId,
          rewardForm
        );
        setRewards((prev) =>
          prev.map((r) => (r.id === editingRewardId ? data : r))
        );
        toast.success("Reward updated");
      } else {
        const { data } = await dashboardApi.createRewardTemplate(rewardForm);
        setRewards((prev) => [data, ...prev]);
        toast.success("Reward created");
      }
      setShowRewardForm(false);
      setEditingRewardId(null);
      setRewardForm(EMPTY_REWARD);
    } catch {
      toast.error("Failed to save reward");
    }
  };

  const deleteReward = async (id: string) => {
    try {
      await dashboardApi.deleteRewardTemplate(id);
      setRewards((prev) => prev.filter((r) => r.id !== id));
      toast.success("Reward deactivated");
    } catch {
      toast.error("Failed to deactivate reward");
    }
  };

  const startEdit = (reward: RewardTemplate) => {
    setEditingRewardId(reward.id);
    setRewardForm({
      name: reward.name,
      reward_type: reward.reward_type,
      reward_value: reward.reward_value,
      expiry_days: reward.expiry_days,
    });
    setShowRewardForm(true);
  };

  if (!business || !branding) {
    return <div className="animate-pulse text-gray-400">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      {/* Business Info */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Business Info
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              value={business.name}
              onChange={(e) =>
                setBusiness({ ...business, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <input
              value={business.industry || ""}
              onChange={(e) =>
                setBusiness({ ...business, industry: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="e.g., Restaurant, Salon, Retail"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Place ID
            </label>
            <input
              value={business.google_place_id || ""}
              onChange={(e) =>
                setBusiness({ ...business, google_place_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="ChIJ..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              value={business.phone || ""}
              onChange={(e) =>
                setBusiness({ ...business, phone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={saveBusiness}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Business Info"}
          </button>
        </div>
      </div>

      {/* Branding */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primary_color}
                  onChange={(e) =>
                    setBranding({ ...branding, primary_color: e.target.value })
                  }
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <span className="text-sm text-gray-500">
                  {branding.primary_color}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secondary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.secondary_color}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      secondary_color: e.target.value,
                    })
                  }
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <span className="text-sm text-gray-500">
                  {branding.secondary_color}
                </span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Avatar Style
            </label>
            <select
              value={branding.avatar_style}
              onChange={(e) =>
                setBranding({ ...branding, avatar_style: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="friendly">Chill & Funny</option>
              <option value="professional">Professional & Warm</option>
              <option value="energetic">High-Energy & Hype</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Welcome Message
            </label>
            <textarea
              value={branding.welcome_message}
              onChange={(e) =>
                setBranding({ ...branding, welcome_message: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Thank You Message
            </label>
            <textarea
              value={branding.thank_you_message}
              onChange={(e) =>
                setBranding({ ...branding, thank_you_message: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={saveBranding}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Branding"}
          </button>
        </div>
      </div>

      {/* Rewards */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Reward Templates
          </h3>
          {!showRewardForm && (
            <button
              onClick={() => {
                setEditingRewardId(null);
                setRewardForm(EMPTY_REWARD);
                setShowRewardForm(true);
              }}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Add Reward
            </button>
          )}
        </div>

        {showRewardForm && (
          <div className="mb-4 p-4 border border-gray-200 rounded-lg space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                value={rewardForm.name}
                onChange={(e) =>
                  setRewardForm({ ...rewardForm, name: e.target.value })
                }
                placeholder="e.g., 10% Off Next Visit"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={rewardForm.reward_type}
                  onChange={(e) =>
                    setRewardForm({
                      ...rewardForm,
                      reward_type: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="discount">Discount</option>
                  <option value="freebie">Freebie</option>
                  <option value="points">Points</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry (days)
                </label>
                <input
                  type="number"
                  value={rewardForm.expiry_days}
                  onChange={(e) =>
                    setRewardForm({
                      ...rewardForm,
                      expiry_days: parseInt(e.target.value) || 30,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value / Description
              </label>
              <input
                value={rewardForm.reward_value}
                onChange={(e) =>
                  setRewardForm({ ...rewardForm, reward_value: e.target.value })
                }
                placeholder="e.g., 10% off your next visit"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveReward}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                {editingRewardId ? "Update" : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowRewardForm(false);
                  setEditingRewardId(null);
                  setRewardForm(EMPTY_REWARD);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {rewards.length === 0 && !showRewardForm ? (
          <p className="text-sm text-gray-500">
            No reward templates yet. Add one to enable rewards for customers.
          </p>
        ) : (
          <div className="space-y-2">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-900">
                    {reward.name}
                  </span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {reward.reward_type}
                  </span>
                  {!reward.is_active && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      inactive
                    </span>
                  )}
                  <p className="text-sm text-gray-500 mt-0.5">
                    {reward.reward_value} &middot; {reward.expiry_days} day
                    expiry
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(reward)}
                    className="text-sm text-primary-600 hover:text-primary-800"
                  >
                    Edit
                  </button>
                  {reward.is_active && (
                    <button
                      onClick={() => deleteReward(reward.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
