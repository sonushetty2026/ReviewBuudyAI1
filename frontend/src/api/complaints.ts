import client from "./client";
import type { Complaint } from "../types/flow";

export const complaintsApi = {
  list: (params?: { status?: string; priority?: string; page?: number }) =>
    client.get<Complaint[]>("/dashboard/complaints", { params }),

  get: (id: string) =>
    client.get<Complaint>(`/dashboard/complaints/${id}`),

  update: (id: string, data: { status?: string; priority?: string; resolution_notes?: string }) =>
    client.put<Complaint>(`/dashboard/complaints/${id}`, data),
};
