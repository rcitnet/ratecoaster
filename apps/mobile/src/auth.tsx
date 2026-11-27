import { createContext, useContext } from "react";

export const AuthRefreshContext = createContext({ revision: 0, refresh: () => {} });
export const useAuthRefresh = () => useContext(AuthRefreshContext);
