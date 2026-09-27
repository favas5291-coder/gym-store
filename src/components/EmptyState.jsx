import { Link } from "react-router-dom";
export default function EmptyState({
  title,
  children,
  to = "/shop",
  label = "Explore the collection",
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">
        GD
      </span>
      <h1>{title}</h1>
      <p>{children}</p>
      <Link className="button" to={to}>
        {label}
      </Link>
    </div>
  );
}