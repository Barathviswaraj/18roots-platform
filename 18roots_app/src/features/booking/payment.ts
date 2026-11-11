import { AppState, Linking } from "react-native";

import { ApiError } from "@/api/client";
import { bookingsApi } from "@/api/endpoints";
import type { Booking } from "@/api/schemas";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function untilAppIsActive() {
  if (AppState.currentState === "active") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        subscription.remove();
        resolve();
      }
    });
  });
}

// Collects payment for a booking and returns it once the backend confirms.
// - demo: the built-in backend confirms straight away; no money moves.
// - hosted checkout: the payment service gives a checkout URL (for example a
//   Razorpay payment link). The app opens it, then polls the booking, because
//   only the provider's signed webhook to the payment service is trusted.
export async function collectPayment(
  booking: Booking,
  confirmDemo: (bookingId: string, paymentId: string) => Promise<Booking>,
  onWaiting: () => void,
): Promise<Booking> {
  if (booking.status === "confirmed") return booking;

  if (booking.payment.provider === "demo") {
    await wait(900);
    return confirmDemo(booking.id, booking.payment.id);
  }

  if (!booking.payment.checkoutUrl) {
    throw new ApiError(0, "payment_unavailable", "No payment method is available");
  }
  onWaiting();
  await Linking.openURL(booking.payment.checkoutUrl);
  await untilAppIsActive();

  const deadline = Date.now() + 3 * 60_000;
  while (Date.now() < deadline) {
    const current = await bookingsApi.get(booking.id);
    if (current.status === "confirmed") return current;
    if (current.status === "failed") throw new ApiError(402, "payment_failed", "Payment failed");
    await wait(3000);
  }
  throw new ApiError(0, "payment_pending", "Payment is still being processed");
}
