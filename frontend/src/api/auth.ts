import client from "./client";

export interface RegisterData {
  business_name: string;
  full_name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  business_id: string;
}

export const authApi = {
  register: (data: RegisterData) =>
    client.post<TokenResponse>("/auth/register", data),

  login: (data: LoginData) =>
    client.post<TokenResponse>("/auth/login", data),

  getMe: () => client.get<User>("/auth/me"),
};
