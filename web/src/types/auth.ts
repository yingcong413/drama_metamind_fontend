export interface User {
  id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: User;
}
