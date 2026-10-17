import { useEffect, useReducer } from "react";

export default function useOrderUpdates() {
  const [revision, update] = useReducer(
    (current) => current + 1,
    0,
  );

  useEffect(() => {
    function sync(event) {
      if (
        event.key === "gymdrobe-orders" ||
        event.key === "gymdrobe-guest-order-access-v1" ||
        event.key === null
      ) {
        update();
      }
    }

    window.addEventListener(
      "storage",
      sync,
    );

    window.addEventListener(
      "gymdrobe-orders-updated",
      update,
    );

    window.addEventListener(
      "gymdrobe-guest-access-changed",
      update,
    );

    return () => {
      window.removeEventListener(
        "storage",
        sync,
      );

      window.removeEventListener(
        "gymdrobe-orders-updated",
        update,
      );

      window.removeEventListener(
        "gymdrobe-guest-access-changed",
        update,
      );
    };
  }, []);

  return revision;
}