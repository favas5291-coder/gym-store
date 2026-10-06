import {
  useEffect,
  useId,
  useRef,
} from "react";

// Support a fit guide opening over a quick-add modal.
const openDialogs = [];

let previousBodyOverflow = "";

export default function Modal({
  title,
  onClose,
  children,
  className = "",
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closeCallback = useRef(onClose);

  const titleId = useId();

  closeCallback.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    if (openDialogs.length === 0) {
      previousBodyOverflow =
        document.body.style.overflow;
    }

    openDialogs.push(dialog);

    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus({
      preventScroll: true,
    });

    return () => {
      const wasTopDialog =
        openDialogs.at(-1) === dialog;

      const index =
        openDialogs.indexOf(dialog);

      if (index !== -1) {
        openDialogs.splice(index, 1);
      }

      if (dialog.open) {
        dialog.close();
      }

      if (openDialogs.length === 0) {
        document.body.style.overflow =
          previousBodyOverflow;
      }

      const activeDialog =
        openDialogs.at(-1);

      if (
        wasTopDialog &&
        previousFocus?.isConnected &&
        typeof previousFocus.focus === "function" &&
        (
          !activeDialog ||
          activeDialog.contains(previousFocus)
        )
      ) {
        previousFocus.focus({
          preventScroll: true,
        });
      }
    };
  }, []);

  function requestClose() {
    closeCallback.current?.();
  }

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        const dialog = dialogRef.current;

        if (
          !dialog ||
          event.target !== dialog
        ) {
          return;
        }

        const rect =
          dialog.getBoundingClientRect();

        const clickedOutside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;

        if (clickedOutside) {
          requestClose();
        }
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>
          {title}
        </h2>

        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close dialog"
          style={{
            minWidth: "44px",
            minHeight: "44px",
          }}
          onClick={requestClose}
        >
          <span aria-hidden="true">
            ×
          </span>
        </button>
      </div>

      {children}
    </dialog>
  );
}