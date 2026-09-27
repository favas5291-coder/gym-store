import { useEffect, useState } from "react";

export default function useOrderUpdates() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const update = () => setVersion((value) => value + 1);
    const sync = (event) => {
      if (event.key === "gymdrobe-orders" || event.key === null) update();
    };

    window.addEventListener("gymdrobe-orders-updated", update);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("gymdrobe-orders-updated", update);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return version;
}
