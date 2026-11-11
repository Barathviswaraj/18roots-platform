import { keepPreviousData, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/store/auth";
import { toApiError } from "./client";
import {
  bookingsApi,
  careApi,
  consultationsApi,
  doctorsApi,
  homeApi,
  notificationsApi,
  ordersApi,
  profileApi,
} from "./endpoints";
import type { AppNotification, CarePlan, HomeResponse } from "./schemas";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      // Retry network trouble with backoff; a 4xx answer will not change on retry.
      retry: (failureCount, error) => {
        const apiError = toApiError(error);
        if (apiError.status >= 400 && apiError.status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: { retry: 0 },
  },
});

export const queryKeys = {
  home: ["home"] as const,
  care: ["care-plan"] as const,
  profile: ["profile"] as const,
  doctors: (filters: { query?: string; language?: string }) => ["doctors", filters] as const,
  doctor: (doctorId: string) => ["doctor", doctorId] as const,
  slots: (doctorId: string, date: string) => ["slots", doctorId, date] as const,
  consultations: (scope: "upcoming" | "past") => ["consultations", scope] as const,
  consultation: (consultationId: string) => ["consultation", consultationId] as const,
  orders: (status: "all" | "active" | "delivered") => ["orders", status] as const,
  order: (orderId: string) => ["order", orderId] as const,
  notifications: ["notifications"] as const,
};

// --- Queries ----------------------------------------------------------------

export const useHome = () => useQuery({ queryKey: queryKeys.home, queryFn: homeApi.get });
export const useCarePlan = () => useQuery({ queryKey: queryKeys.care, queryFn: careApi.get });
export const useProfile = () => useQuery({ queryKey: queryKeys.profile, queryFn: profileApi.get });

export const useDoctors = (filters: { query?: string; language?: string }) =>
  useQuery({
    queryKey: queryKeys.doctors(filters),
    queryFn: () => doctorsApi.list(filters),
    placeholderData: keepPreviousData,
  });

export const useDoctor = (doctorId: string) =>
  useQuery({ queryKey: queryKeys.doctor(doctorId), queryFn: () => doctorsApi.get(doctorId), enabled: !!doctorId });

export const useSlots = (doctorId: string, date: string) =>
  useQuery({
    queryKey: queryKeys.slots(doctorId, date),
    queryFn: () => doctorsApi.slots(doctorId, date),
    enabled: !!doctorId && !!date,
    staleTime: 10_000,
  });

export const useConsultations = (scope: "upcoming" | "past") =>
  useQuery({ queryKey: queryKeys.consultations(scope), queryFn: () => consultationsApi.list(scope) });

export const useConsultation = (consultationId: string) =>
  useQuery({
    queryKey: queryKeys.consultation(consultationId),
    queryFn: () => consultationsApi.get(consultationId),
    enabled: !!consultationId,
  });

export const useOrders = (status: "all" | "active" | "delivered") =>
  useQuery({
    queryKey: queryKeys.orders(status),
    queryFn: () => ordersApi.list(status),
    placeholderData: keepPreviousData,
  });

export const useOrder = (orderId: string) =>
  useQuery({ queryKey: queryKeys.order(orderId), queryFn: () => ordersApi.get(orderId), enabled: !!orderId });

export const useNotifications = () => useQuery({ queryKey: queryKeys.notifications, queryFn: notificationsApi.list });

// --- Mutations --------------------------------------------------------------

// Marking a dose updates the screen at once and rolls back if the server refuses.
export function useSetDoseTaken() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ doseId, taken }: { doseId: string; taken: boolean }) => careApi.setDoseTaken(doseId, taken),
    onMutate: async ({ doseId, taken }) => {
      await Promise.all([
        client.cancelQueries({ queryKey: queryKeys.care }),
        client.cancelQueries({ queryKey: queryKeys.home }),
      ]);
      const previousCare = client.getQueryData<CarePlan | null>(queryKeys.care);
      const previousHome = client.getQueryData<HomeResponse>(queryKeys.home);
      const takenAt = taken ? new Date().toISOString() : null;
      client.setQueryData<CarePlan | null>(queryKeys.care, (current) =>
        current
          ? { ...current, doses: current.doses.map((dose) => (dose.id === doseId ? { ...dose, takenAt } : dose)) }
          : current,
      );
      if (previousHome) {
        client.setQueryData<HomeResponse>(queryKeys.home, {
          ...previousHome,
          sections: previousHome.sections.map((section) =>
            section.type === "medicine_reminder" && section.data.dose?.id === doseId
              ? { ...section, data: { ...section.data, dose: { ...section.data.dose, takenAt } } }
              : section,
          ),
        });
      }
      return { previousCare, previousHome };
    },
    onError: (_error, _input, context) => {
      if (context?.previousCare !== undefined) client.setQueryData(queryKeys.care, context.previousCare);
      if (context?.previousHome) client.setQueryData(queryKeys.home, context.previousHome);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.care });
      client.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

export function useSetGoalDone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, done }: { goalId: string; done: boolean }) => careApi.setGoalDone(goalId, done),
    onMutate: async ({ goalId, done }) => {
      await client.cancelQueries({ queryKey: queryKeys.care });
      const previous = client.getQueryData<CarePlan | null>(queryKeys.care);
      client.setQueryData<CarePlan | null>(queryKeys.care, (current) =>
        current
          ? { ...current, goals: current.goals.map((goal) => (goal.id === goalId ? { ...goal, done } : goal)) }
          : current,
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) client.setQueryData(queryKeys.care, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.care }),
  });
}

export function useCancelConsultation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: consultationsApi.cancel,
    onSuccess: (consultation) => {
      client.setQueryData(queryKeys.consultation(consultation.id), consultation);
      client.invalidateQueries({ queryKey: ["consultations"] });
      client.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: Parameters<typeof bookingsApi.create>[0];
      idempotencyKey: string;
    }) => bookingsApi.create(input, idempotencyKey),
  });
}

export function useConfirmPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, paymentId }: { bookingId: string; paymentId: string }) =>
      bookingsApi.confirmPayment(bookingId, paymentId),
    onSuccess: (booking) => {
      client.setQueryData(queryKeys.consultation(booking.consultation.id), booking.consultation);
      client.invalidateQueries({ queryKey: ["consultations"] });
      client.invalidateQueries({ queryKey: ["slots"] });
      client.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: profileApi.update,
    onSuccess: async (user) => {
      client.setQueryData(queryKeys.profile, user);
      await useAuth.getState().setUser(user);
      client.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string | "all") =>
      notificationId === "all" ? notificationsApi.markAllRead() : notificationsApi.markRead(notificationId),
    onMutate: async (notificationId) => {
      await client.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = client.getQueryData<AppNotification[]>(queryKeys.notifications);
      if (previous) {
        client.setQueryData<AppNotification[]>(
          queryKeys.notifications,
          previous.map((item) =>
            notificationId === "all" || item.id === notificationId ? { ...item, read: true } : item,
          ),
        );
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(queryKeys.notifications, context.previous);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.notifications });
      client.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}
