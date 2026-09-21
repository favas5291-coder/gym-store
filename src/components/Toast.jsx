function Toast({
  message,
  type = "success",
  onClose,
}) {
  if (!message) {
    return null;
  }

  const toastStyles = {
    success: {
      icon: "✓",
      background: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
      iconBackground: "bg-green-600",
    },

    error: {
      icon: "✕",
      background: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      iconBackground: "bg-red-600",
    },

    warning: {
      icon: "!",
      background: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-800",
      iconBackground: "bg-yellow-500",
    },

    info: {
      icon: "i",
      background: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
      iconBackground: "bg-blue-600",
    },
  };

  const currentStyle =
    toastStyles[type] || toastStyles.success;

  return (
    <div
      className="
        pointer-events-none
        fixed
        right-3
        top-20
        z-[200]
        w-[calc(100%-24px)]
        sm:right-5
        sm:top-24
        sm:w-[360px]
      "
    >
      <div
        className={`
          pointer-events-auto
          flex
          w-full
          items-center
          gap-3
          rounded-2xl
          border
          px-4
          py-3
          shadow-xl
          ${currentStyle.background}
          ${currentStyle.border}
          ${currentStyle.text}
        `}
        role="alert"
      >
        <div
          className={`
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-full
            text-sm
            font-black
            text-white
            ${currentStyle.iconBackground}
          `}
        >
          {currentStyle.icon}
        </div>

        <p
          className="
            min-w-0
            flex-1
            text-sm
            font-semibold
            leading-5
          "
        >
          {message}
        </p>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-full
            text-sm
            transition
            hover:bg-black/5
          "
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default Toast;