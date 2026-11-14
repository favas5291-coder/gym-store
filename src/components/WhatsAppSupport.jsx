const DEFAULT_MESSAGE =
  "Hi GymDrobe, I need help with my order.";

const phoneNumber = String(
  import.meta.env.VITE_WHATSAPP_NUMBER || "",
).replace(/\D/g, "");

const whatsappUrl = /^[1-9]\d{7,14}$/.test(phoneNumber)
  ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`
  : null;

export function WhatsAppLink({
  children = "Chat on WhatsApp",
  className,
}) {
  if (!whatsappUrl) return null;

  return (
    <a
      className={className}
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export default function WhatsAppSupport() {
  if (!whatsappUrl) {
    return (
      <section className="panel" aria-labelledby="email-support-title">
        <h2 id="email-support-title">Email support</h2>
        <p>Contact GymDrobe about an order or product.</p>
        <a className="button secondary" href="mailto:support@gymdrobe.com">
          Email support@gymdrobe.com
        </a>
      </section>
    );
  }

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
