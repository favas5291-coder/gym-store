import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

let guideRequest;

function loadGuide() {
  if (!guideRequest) {
    guideRequest = import("./FitnessGuide.jsx").catch(
      (error) => {
        guideRequest = null;
        throw error;
      },
    );
  }

  return guideRequest;
}

export default function DeferredFitnessGuide() {
  const { pathname } = useLocation();

  const [Guide, setGuide] = useState(null);

  const eligible =
    /^(?:\/|\/shop|\/offers|\/product\/[^/]+|\/kits(?:\/[^/]+)?)\/?$/.test(
      pathname,
    );

  useEffect(() => {
    if (!eligible || Guide) {
      return;
    }

    let cancelled = false;
    let firstFrame;
    let secondFrame;
    let idle;
    let timer;

    function start() {
      if (document.visibilityState === "hidden") {
        return;
      }

      document.removeEventListener(
        "visibilitychange",
        start,
      );

      // Allow the storefront to paint first.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          const load = () => {
            if (cancelled) {
              return;
            }

            loadGuide()
              .then((module) => {
                if (!cancelled) {
                  setGuide(() => module.default);
                }
              })
              .catch(() => {
                // Shopping remains available if this
                // optional download fails. A later
                // storefront visit can retry it.
              });
          };

          if (
            typeof window.requestIdleCallback ===
            "function"
          ) {
            idle = window.requestIdleCallback(load, {
              timeout: 1500,
            });
          } else {
            timer = window.setTimeout(load, 750);
          }
        });
      });
    }

    document.addEventListener(
      "visibilitychange",
      start,
    );

    start();

    return () => {
      cancelled = true;

      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      clearTimeout(timer);

      if (idle !== undefined) {
        window.cancelIdleCallback?.(idle);
      }

      document.removeEventListener(
        "visibilitychange",
        start,
      );
    };
  }, [eligible, pathname, Guide]);

  // Keep the existing browsing timer and dismissal
  // behaviour across page navigation.
  return Guide ? <Guide /> : null;
}