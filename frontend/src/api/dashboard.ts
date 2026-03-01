import client from "./client";

export interface Business {
  id: string;
  name: string;
  slug: string;
  google_place_id: string | null;
  industry: string | null;
  phone: string | null;
  email: string;
  address: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface Branding {
  id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  avatar_style: string;
  welcome_message: string;
  thank_you_message: string;
}

export interface RewardTemplate {
  id: string;
  name: string;
  reward_type: string;
  reward_value: string;
  is_active: boolean;
  expiry_days: number;
}

export interface Stats {
  total_sessions: number;
  completed_feedbacks: number;
  google_reviews: number;
  complaints: number;
}

export const dashboardApi = {
  getBusiness: () => client.get<Business>("/businesses/me"),

  updateBusiness: (data: Partial<Business>) =>
    client.put<Business>("/businesses/me", data),

  getBranding: () => client.get<Branding>("/businesses/me/branding"),

  updateBranding: (data: Partial<Branding>) =>
    client.put<Branding>("/businesses/me/branding", data),

  // Reward templates
  getRewardTemplates: () =>
    client.get<RewardTemplate[]>("/businesses/me/rewards"),

  createRewardTemplate: (data: Omit<RewardTemplate, "id" | "is_active">) =>
    client.post<RewardTemplate>("/businesses/me/rewards", data),

  updateRewardTemplate: (id: string, data: Partial<RewardTemplate>) =>
    client.put<RewardTemplate>(`/businesses/me/rewards/${id}`, data),

  deleteRewardTemplate: (id: string) =>
    client.delete(`/businesses/me/rewards/${id}`),

  // Stats
  getStats: () => client.get<Stats>("/businesses/me/stats"),

  // QR Code
  getQrCode: async () => {
    const response = await client.get("/businesses/me/qr-code", {
      responseType: "blob",
    });
    return URL.createObjectURL(response.data as Blob);
  },
};
