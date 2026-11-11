import { create } from "zustand";

// Hands the phone number and code request from sign-in to the code screen in
// memory, so they never appear in a URL, deep link or browser history.
export type OtpFlow = { phone: string; requestId: string; resendAfter: number; demoCode: string | null };

type OtpFlowState = {
  flow: OtpFlow | null;
  start: (flow: OtpFlow) => void;
  update: (changes: Partial<OtpFlow>) => void;
  clear: () => void;
};

export const useOtpFlow = create<OtpFlowState>()((set) => ({
  flow: null,
  start: (flow) => set({ flow }),
  update: (changes) => set((state) => (state.flow ? { flow: { ...state.flow, ...changes } } : state)),
  clear: () => set({ flow: null }),
}));
