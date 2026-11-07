import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types'
import { useBranchScopeStore } from './branchScopeStore'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (token, user) => {
        // Branch scope lives in localStorage (shared across tabs/sessions) while auth is per-tab;
        // start every login on the user's own branch so a previous session's branch is never reused.
        useBranchScopeStore.getState().setSelectedBranchId(String(user?.branchId || ''))
        set({ token, user, isAuthenticated: true })
      },
      logout: () => {
        useBranchScopeStore.getState().resetBranchScope()
        set({ token: null, user: null, isAuthenticated: false })
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
