import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,

      login: (token) => set({ token }),

      logout: () => {
        set({ token: null });
        window.location.hash = '#/dashboard';
      },
    }),
    {
      name: 'sd_token',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (!state?.token) return;
        try {
          const payload = JSON.parse(atob(state.token.split('.')[1]));
          if (payload.exp && payload.exp < Date.now() / 1000) {
            state.logout();
          }
        } catch {
          state.logout();
        }
      },
    }
  )
);
