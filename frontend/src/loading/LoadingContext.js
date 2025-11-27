import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../auth/api";

const LoadingContext = createContext({
  isLoading: false,
  pendingCount: 0,
  startLoading: () => {},
  stopLoading: () => {},
});

export function LoadingProvider({ children }) {
  const [pendingCount, setPendingCount] = useState(0);

  const startLoading = useCallback(() => {
    setPendingCount((c) => c + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setPendingCount((c) => (c > 0 ? c - 1 : 0));
  }, []);

  useEffect(() => {
    // Attach axios interceptors once to keep global loader in sync
    const reqId = api.interceptors.request.use((config) => {
      if (!config._skipGlobalLoader) startLoading();
      return config;
    });

    const resId = api.interceptors.response.use(
      (response) => {
        if (!response.config?._skipGlobalLoader) stopLoading();
        return response;
      },
      (error) => {
        if (!error.config?._skipGlobalLoader) stopLoading();
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(reqId);
      api.interceptors.response.eject(resId);
    };
  }, [startLoading, stopLoading]);

  const value = useMemo(
    () => ({
      isLoading: pendingCount > 0,
      pendingCount,
      startLoading,
      stopLoading,
    }),
    [pendingCount, startLoading, stopLoading]
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useGlobalLoading() {
  return useContext(LoadingContext);
}
