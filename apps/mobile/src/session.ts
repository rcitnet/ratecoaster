import * as SecureStore from "expo-secure-store";
import { SESSION_KEY } from "@/config";

export function readSession() {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export function saveSession(token: string) {
  return SecureStore.setItemAsync(SESSION_KEY, token);
}

export function clearSession() {
  return SecureStore.deleteItemAsync(SESSION_KEY);
}
