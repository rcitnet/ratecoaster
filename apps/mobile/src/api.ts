import { RateCoasterClient } from "@ratecoaster/shared";
import { API_BASE_URL } from "@/config";
import { readSession } from "@/session";

export const api = new RateCoasterClient({
  baseUrl: API_BASE_URL,
  getToken: readSession,
});

export function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
