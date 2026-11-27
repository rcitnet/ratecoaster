import Constants from "expo-constants";

const configuredUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

/**
 * EXPO_PUBLIC_API_BASE_URL is useful for an emulator pointed at a staging API;
 * the checked-in value is the production HTTPS endpoint used by release builds.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? configuredUrl ?? "https://ratecoaster.net/api"
).replace(/\/+$/, "");

export const SESSION_KEY = "ratecoaster.session";
