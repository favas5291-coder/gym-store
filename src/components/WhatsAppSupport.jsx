const DEFAULT_MESSAGE =
  "Hi GymDrobe, I need help with my order.";

const phoneNumber = String(
  import.meta.env.VITE_WHATSAPP_NUMBER || "",
).replace(/\D/g, "");

const whatsappUrl = new URL(
  `https://wa.me/${phoneNumber}`,
);

whatsappUrl.searchParams.set("text", DEFAULT_MESSAGE);

export function WhatsAppLink({
  children = "Chat on WhatsApp",
  className,
}) {
  return (
    <a
      className={className}
      href={whatsappUrl.toString()}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export default function WhatsAppSupport() {
  return (
    <section className="panel" aria-labelledby="whatsapp-support-title">
      <h2 id="whatsapp-support-title">WhatsApp support</h2>

      <p>
        Contact GymDrobe about an order or product. Do not share
        passwords, OTPs, card numbers, CVVs or UPI PINs.
      </p>

      <WhatsAppLink className="button secondary" />

      <p className="muted">
        You can also email{" "}
        <a href="mailto:support@gymdrobe.com">
          support@gymdrobe.com
        </a>
        .
      </p>
    </section>
  );
}