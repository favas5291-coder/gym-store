import { Link } from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import SupportInbox from "../components/SupportInbox.jsx";

export default function AdminSupportPage() {
  const { user, token } = useAuth();

  if (
    !user ||
    !token ||
    user.role !== "admin"
  ) {
    return (
      <div className="page">
        <h1>Admin access required</h1>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <div className="page-heading">
        <h1>Customer support</h1>

        <Link
          className="text-link"
          to="/admin/orders"
        >
          Manage orders →
        </Link>
      </div>

      <p>
        Read customer requests, send replies
        and mark conversations resolved.
        Replies appear in the customer’s Help
        page; email notifications are not
        configured.
      </p>

      <SupportInbox
        admin
        key={`${user.id || user._id}:${token}`}
      />
    </div>
  );
}