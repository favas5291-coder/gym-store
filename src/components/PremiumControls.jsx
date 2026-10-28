import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const icons = { right: ArrowRight, diagonal: ArrowUpRight };

function IconMark({ direction = "right" }) {
  const Icon = icons[direction] || ArrowRight;
  return <Icon className="premium-control-arrow" size={18} strokeWidth={1.7} aria-hidden="true" focusable="false" />;
}

function Interactive({ to, href, children, className, ...props }) {
  if (to != null) return <Link to={to} className={className} {...props}>{children}</Link>;
  if (href != null) return <a href={href} className={className} {...props}>{children}</a>;
  return <button type="button" className={className} {...props}>{children}</button>;
}

/**
 * Shared customer-facing controls. Preserve React Router navigation, native
 * button semantics, supplied event handlers, and accessible names.
 */
export function PremiumButton({
  to, href, children, variant = "primary", className = "", icon = "right",
  withIcon = true, ...props
}) {
  return <Interactive to={to} href={href} className={`premium-button premium-button--${variant} ${className}`.trim()} {...props}>
    <span className="premium-button-label">{children}</span>
    {withIcon && <IconMark direction={icon} />}
  </Interactive>;
}

export function TextLink({
  to, href, children, className = "", icon = "right", ...props
}) {
  return <Interactive to={to} href={href} className={`premium-text-link ${className}`.trim()} {...props}>
    <span className="premium-text-link-label">{children}</span>
    <IconMark direction={icon} />
  </Interactive>;
}

export function IconButton({ icon: Icon, className = "", label, children, ...props }) {
  return <button type="button" className={`premium-icon-button ${className}`.trim()} aria-label={label} {...props}>
    {Icon ? <Icon size={19} strokeWidth={1.7} aria-hidden="true" focusable="false" /> : children}
  </button>;
}
