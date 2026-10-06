import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "../context/AuthContext.jsx";
import useOrderUpdates from "./useOrderUpdates.js";

import {
  getOrder as getLocalOrder,
} from "../utils/customerData.js";

import {
  getOrderById,
} from "../services/orderApi.js";

export default function useCustomerOrder(
  orderId,
  { autoRefresh = false } = {},
) {
  const {
    user,
    token,
    loading: authLoading,
  } = useAuth();

  const revision = useOrderUpdates();

  const userId = String(
    user?._id || user?.id || "",
  );

  const scope = JSON.stringify([
    orderId,
    userId,
    token,
  ]);

  const refreshRef = useRef(null);

  const [state, setState] = useState({
    scope: "",
    order: null,
    loading: true,
    refreshing: false,
    error: "",
    refreshError: "",
    lastUpdated: null,
  });

  const refresh = useCallback(() => {
    refreshRef.current?.();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    setState({
      scope,
      order: null,
      loading: true,
      refreshing: false,
      error: "",
      refreshError: "",
      lastUpdated: null,
    });

    if (authLoading) {
      refreshRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    async function load(background = false) {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;

      if (background) {
        setState((current) => ({
          ...current,
          refreshing: true,
          refreshError: "",
        }));
      }

      try {
        if (!orderId) {
          throw new Error(
            "An order number is required.",
          );
        }

        if (token && !userId) {
          throw new Error(
            "Your account session could not be verified. Please sign in again.",
          );
        }

        if (userId && !token) {
          throw new Error(
            "Your sign-in session has expired. Please sign in again.",
          );
        }

        const order = userId
          ? await getOrderById(token, orderId)
          : getLocalOrder(orderId, null);

        if (cancelled) {
          return;
        }

        setState({
          scope,
          order: order || null,
          loading: false,
          refreshing: false,
          error: "",
          refreshError: "",
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error.message ||
          "Unable to load your order.";

        const accessDenied =
          error.status === 401 ||
          error.status === 403 ||
          error.status === 404;

        if (background && !accessDenied) {
          setState((current) => ({
            ...current,
            refreshing: false,
            refreshError: message,
          }));
        } else {
          setState({
            scope,
            order: null,
            loading: false,
            refreshing: false,
            error: message,
            refreshError: "",
            lastUpdated: null,
          });
        }
      } finally {
        inFlight = false;
      }
    }

    refreshRef.current = () => load(true);
    load();

    let timer;

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        load(true);
      }
    }

    if (autoRefresh && userId && token) {
      timer = window.setInterval(
        refreshWhenVisible,
        30000,
      );

      window.addEventListener(
        "focus",
        refreshWhenVisible,
      );

      document.addEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
    }

    return () => {
      cancelled = true;
      refreshRef.current = null;

      if (timer) {
        window.clearInterval(timer);
      }

      window.removeEventListener(
        "focus",
        refreshWhenVisible,
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
    };
  }, [
    scope,
    orderId,
    userId,
    token,
    authLoading,
    revision,
    autoRefresh,
  ]);

  const current =
    state.scope === scope && !authLoading;

  return {
    order: current ? state.order : null,
    loading: !current || state.loading,
    refreshing: current && state.refreshing,
    error: current ? state.error : "",
    refreshError: current ? state.refreshError : "",
    lastUpdated: current ? state.lastUpdated : null,
    isAccountOrder: Boolean(userId),
    refresh,
  };
}