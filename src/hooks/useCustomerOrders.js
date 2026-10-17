import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import useOrderUpdates from "./useOrderUpdates.js";

import { guestAccess } from "../utils/guestCheckout.js";

import {
  getOrders as getLocalOrders,
} from "../utils/customerData.js";

import {
  getOrders as getRemoteOrders,
} from "../services/orderApi.js";

import {
  prepareOrderList,
} from "../utils/customerOrders.js";

function empty(scope) {
  return {
    scope,
    orders: [],
    loaded: false,
    loading: true,
    refreshing: false,
    error: "",
    refreshError: "",
    lastUpdated: null,
  };
}

export default function useCustomerOrders(
  userId = "",
  token = "",
) {
  const revision = useOrderUpdates();
  const guest = guestAccess();

  const remote = Boolean(userId || guest);

  const scope = JSON.stringify([
    userId,
    token,
    guest?.token || "",
  ]);

  const activeScope = useRef(scope);
  activeScope.current = scope;

  const refreshRef = useRef(null);

  const [state, setState] = useState(
    () => empty(""),
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(() => {
    const current = refreshRef.current;

    if (
      current?.scope === activeScope.current
    ) {
      return current.load(true, true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    let cancelled = false;
    let inFlight = null;
    let denied = false;

    const background =
      stateRef.current.scope === scope &&
      stateRef.current.loaded;

    if (!background) {
      setState(empty(scope));
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
        if (
          Boolean(userId) !== Boolean(token)
        ) {
          throw Object.assign(
            new Error(
              "Your session could not be verified. Please sign in again.",
            ),
            { status: 401 },
          );
        }

        const value = remote
          ? await getRemoteOrders(
              token,
              {
                signal: controller.signal,
              },
            )
          : getLocalOrders(null);

        const orders = prepareOrderList(
          value,
          userId,
        );

        if (
          cancelled ||
          activeScope.current !== scope
        ) {
          return;
        }

        denied = false;

        setState({
          scope,
          orders,
          loaded: true,
          loading: false,
          refreshing: false,
          error: "",
          refreshError: "",
          lastUpdated:
            new Date().toISOString(),
        });
      } catch (failure) {
        if (
          cancelled ||
          activeScope.current !== scope ||
          controller.signal.aborted
        ) {
          return;
        }

        denied = [
          401,
          403,
        ].includes(failure.status);

        const message =
          failure.message ||
          "Your orders could not be loaded. Please retry.";

        setState((current) =>
          backgroundLoad &&
          current.loaded &&
          !denied
            ? {
                ...current,
                refreshing: false,
                refreshError: message,
              }
            : {
                ...empty(scope),
                loading: false,
                error: message,
              },
        );
      }
    }

    function load(
      backgroundLoad = false,
      explicit = false,
    ) {
      if (
        cancelled ||
        activeScope.current !== scope ||
        (denied && !explicit)
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

    function whenVisible() {
      if (
        document.visibilityState === "visible"
      ) {
        load(true);
      }
    }

    let timer;

    if (remote) {
      timer = window.setInterval(
        whenVisible,
        30000,
      );

      window.addEventListener(
        "focus",
        whenVisible,
      );

      window.addEventListener(
        "online",
        whenVisible,
      );

      document.addEventListener(
        "visibilitychange",
        whenVisible,
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
        whenVisible,
      );

      window.removeEventListener(
        "online",
        whenVisible,
      );

      document.removeEventListener(
        "visibilitychange",
        whenVisible,
      );
    };
  }, [
    scope,
    userId,
    token,
    revision,
    remote,
  ]);

  return {
    ...(
      state.scope === scope
        ? state
        : empty(scope)
    ),

    refresh,
  };
}