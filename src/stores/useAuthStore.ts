import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  preferences: {
    theme: 'light' | 'black';
    backgroundImage: string;
    greeting: string;
    layoutStyle: 'comfortable' | 'compact' | 'spacious';
    fontSize: 'small' | 'medium' | 'large';
    autoSaveInterval: number;
    defaultNotebook: string;
    emailNotifications: boolean;
    browserNotifications: boolean;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  updatePreferences: (preferences: Partial<User['preferences']>) => Promise<void>;
  clearToken: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { token, user } = response.data;

          console.log('Login successful, token received:', token ? 'YES' : 'NO');
          console.log('Token length:', token ? token.length : 0);

          localStorage.setItem('token', token);
          console.log('Token stored in localStorage:', localStorage.getItem('token') ? 'YES' : 'NO');

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Login failed');
        }
      },

      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/register', { name, email, password });
          const { token, user } = response.data;

          localStorage.setItem('token', token);
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Registration failed');
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isAuthenticated: false
        });
      },

      clearToken: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isAuthenticated: false
        });
      },

      verifyToken: async () => {
        const token = localStorage.getItem('token');
        console.log('verifyToken called, token in localStorage:', token ? 'YES' : 'NO');
        if (!token) return;

        set({ isLoading: true });
        try {
          const response = await api.get('/auth/verify');
          console.log('Token verification successful');
          set({
            user: response.data.user,
            token,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          console.log('Token verification failed:', error);
          localStorage.removeItem('token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      updatePreferences: async (preferences: Partial<User['preferences']>) => {
        try {
          const response = await api.put('/users/preferences', preferences);
          const currentUser = get().user;
          if (currentUser) {
            set({
              user: {
                ...currentUser,
                preferences: { ...currentUser.preferences, ...response.data }
              }
            });
          }
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to update preferences');
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);