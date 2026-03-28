import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

interface NetworkContextValue {
  isOnline: boolean;
  isChecking: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({ isOnline: true, isChecking: true });

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
      setIsChecking(false);
    });

    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
      setIsChecking(false);
    });

    return () => unsubscribe();
  }, []);

  return React.createElement(
    NetworkContext.Provider,
    { value: { isOnline, isChecking } },
    children
  );
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}

let onlineListeners: Array<() => void> = [];

export function onConnectivityRestored(cb: () => void) {
  onlineListeners.push(cb);
  return () => {
    onlineListeners = onlineListeners.filter((l) => l !== cb);
  };
}

let wasOffline = false;
NetInfo.addEventListener((state) => {
  const online = state.isConnected === true && state.isInternetReachable !== false;
  if (online && wasOffline) {
    onlineListeners.forEach((cb) => {
      try { cb(); } catch {}
    });
  }
  wasOffline = !online;
});
