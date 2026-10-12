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

function emptyState(scope) {
  return {
    scope,
    order: null,
    loading: true,
    refreshing: false,
    error: "",
    refreshError: "",
    lastUpdated: null,
  };
}

export default function useCustomerOrder(
  orderId,
  { autoRefresh = false } = {},
) {
  const {
    user,
    token,
    loading: authLoading,
    authError,
  } = useAuth();

  const revision = useOrderUpdates();

  const userId = String(
    user?._id || user?.id || "",
  );

  const sessionError = authError
    ? String(authError)
    : user?.isActive === false
      ? "This account is disabled. Contact GymDrobe support."
      : token && !userId
        ? "Your account session could not be verified. Please sign in again."
        : userId && !token
          ? "Your sign-in session has expired. Please sign in again."
          : "";

  const scope = JSON.stringify([
    orderId,
    userId,
    token,
    sessionError,
  ]);

  const activeScope = useRef(scope);
  activeScope.current = scope;

  const refreshRef = useRef(null);

  const [state, setState] = useState(
    () => emptyState(""),
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(() => {
    const current = refreshRef.current;

    if (current?.scope === activeScope.current) {
      return current.load(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    let cancelled = false;
    let inFlight = null;

    const previous = stateRef.current;

    const background =
      previous.scope === scope &&
      Boolean(previous.order);

    if (!background) {
      setState(emptyState(scope));
    }

    if (authLoading || sessionError) {
      refreshRef.current = null;

      return () => controller.abort();
    }

    async function performLoad(backgroundLoad) {
      if (backgroundLoad) {
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

        const order = userId
          ? await getOrderById(token, orderId, {
              signal: controller.signal,
            })
          : getLocalOrder(orderId, null);

        if (
          cancelled ||
          activeScope.current !== scope
        ) {
          return;
        }

        if (order && userId) {
          const owner =
            order.user &&
            typeof order.user === "object"
              ? order.user.id ?? order.user._id
              : order.user;

          if (String(owner || "") !== userId) {
            throw Object.assign(
              new Error(
                "This order is not available to your account.",
              ),
              { status: 403 },
            );
          }
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
        if (
          cancelled ||
          activeScope.current !== scope ||
          controller.signal.aborted
        ) {
          return;
        }

        const message =
          error.message ||
          "Unable to load your order.";

        const denied = [
          401,
          403,
          404,
        ].includes(error.status);

        setState((current) =>
          backgroundLoad &&
          current.order &&
          !denied
            ? {
                ...current,
                refreshing: false,
                refreshError: message,
              }
            : {
                ...emptyState(scope),
                loading: false,
                error: message,
              },
        );
      }
    }

    function load(backgroundLoad = false) {
      if (
        cancelled ||
        activeScope.current !== scope
      ) {
        return Promise.resolve();
      }

      if (inFlight) {
        return inFlight;
      }

      inFlight = performLoad(
        backgroundLoad,
      ).finally(() => {
        inFlight = null;
      });

      return inFlight;
    }

    refreshRef.current = {
      scope,
      load,
    };

    load(background);

    function refreshWhenVisible() {
      if (
        document.visibilityState === "visible"
      ) {
        load(true);
      }
    }

    let timer;

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
      controller.abort();
      refreshRef.current = null;

      if (timer != null) {
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
    sessionError,
    revision,
    autoRefresh,
  ]);

  const current =
    state.scope === scope &&
    !authLoading &&
    !sessionError;

  return {
    order: current ? state.order : null,

    loading:
      authLoading ||
      (!sessionError &&
        (!current || state.loading)),

    refreshing: Boolean(
      current && state.refreshing,
    ),

    error: authLoading
      ? ""
      : sessionError ||
        (current ? state.error : ""),

    refreshError: current
      ? state.refreshError
      : "",

    lastUpdated: current
      ? state.lastUpdated
      : null,

    isAccountOrder: Boolean(userId),
    refresh,
  };
}