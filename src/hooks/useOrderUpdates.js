import { useEffect, useReducer } from "react";
export default function useOrderUpdates() {
  const [revision, update] = useReducer(n => n + 1, 0);
  useEffect(() => {
    const sync = event => { if (event.key === "gymdrobe-orders" || event.key === null) update(); };
    window.addEventListener("storage", sync);
    window.addEventListener("gymdrobe-orders-updated", update);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("gymdrobe-orders-updated", update); };
  }, []);
  return revision;
}