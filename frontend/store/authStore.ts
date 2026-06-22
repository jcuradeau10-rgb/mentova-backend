import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../utils/api';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  role: 'user' | 'admin' | 'super_admin';
  is_banned: boolean;
  is_vip?: boolean;
  vip_until?: string | null;
  is_professional?: boolean;
  is_influencer?: boolean;
  is_apple_review?: boolean;
  pro_badge?: string | null;
  progress: {
    modules_completed: string[];
    current_level: string;
    total_score: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string, captcha_token?: string, totp_code?: string) => Promise<any>;
  register: (email: string, password: string, name: string, captcha_token?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  isSuperAdmin: false,

  login: async (email: string, password: string, captcha_token?: string, totp_code?: string) => {
    const response = await authAPI.login({ email, password, captcha_token, totp_code });
    // Handle 2FA requirement
    if (response.data.requires_2fa) {
      return response.data;
    }
    const { access_token, user } = response.data;
    await AsyncStorage.setItem('token', access_token);
    const role = user.role || 'user';
    set({ 
      user, 
      token: access_token, 
      isAuthenticated: true,
      isAdmin: role === 'admin' || role === 'super_admin',
      isSuperAdmin: role === 'super_admin'
    });
    return response.data;
  },

  register: async (email: string, password: string, name: string, captcha_token?: string) => {
    const response = await authAPI.register({ email, password, name, captcha_token });
    const { access_token, user } = response.data;
    await AsyncStorage.setItem('token', access_token);
    const role = user.role || 'user';
    set({ 
      user, 
      token: access_token, 
      isAuthenticated: true,
      isAdmin: role === 'admin' || role === 'super_admin',
      isSuperAdmin: role === 'super_admin'
    });
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, isAdmin: false, isSuperAdmin: false });
  },

  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          const response = await authAPI.getMe();
          const user = response.data;
          const role = user.role || 'user';
          set({ 
            user, 
            token, 
            isAuthenticated: true, 
            isLoading: false,
            isAdmin: role === 'admin' || role === 'super_admin',
            isSuperAdmin: role === 'super_admin'
          });
        } catch (apiError: any) {
          // Only clear token on 401 (expired/invalid) - NOT on network errors
          if (apiError?.response?.status === 401) {
            await AsyncStorage.removeItem('token');
            set({ user: null, token: null, isAuthenticated: false, isLoading: false, isAdmin: false, isSuperAdmin: false });
          } else {
            // Network error - keep the token, try again later
            set({ isLoading: false });
          }
        }
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },

  updateUser: (user: User) => {
    const role = user.role || 'user';
    set({ 
      user,
      isAdmin: role === 'admin' || role === 'super_admin',
      isSuperAdmin: role === 'super_admin'
    });
  },
}));
