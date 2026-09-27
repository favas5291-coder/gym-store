import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getOrders, orderStatus, orderTotal } from "../utils/customerData.js";
import { money } from "../utils/productPricing.js";
import { ProductImage } from "../components/StorefrontShared.jsx";
import AccountLayout from "../components/AccountLayout.jsx";
export default function OrdersPage() {
  const { user } = useAuth(),
    orders = getOrders(user),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [days, setDays] = useState("");
  const matches = orders.filter(
    (order) =>
      (!status || order.status === status) &&
      (!days ||
        Date.now() - Date.parse(order.createdAt) <= Number(days) * 86400000) &&
      [order.id, ...order.items.map((i) => i.name)]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <AccountLayout title="Orders & returns">
      <p className="muted">
        {user
          ? "Orders saved for your preview account on this device."
          : "Guest orders saved on this device. Sign in before checkout to save future orders to an account."}
      </p>
      <div className="field order-search">
        <label htmlFor="order-search">Search your orders</label>
        <input
          id="order-search"
          type="search"
          placeholder="Product name or order ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="browse-controls">
        <label>
          Status{" "}
          <select
            aria-label="Filter orders by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All orders</option>
            {[
              "confirmed",
              "processing",
              "shipped",
              "out-for-delivery",
              "delivered",
              "cancelled",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Placed in{" "}
          <select
            aria-label="Filter orders by date"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="">Any time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </label>
      </div>
      {matches.map((order) => (
        <article className="order-card" key={order.id}>
          <div className="order-card-head">
            <div>
              <strong>
                {new Date(order.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </strong>
              <small>{order.id}</small>
            </div>
            <span
              className={`status-pill ${order.status === "cancelled" ? "cancelled" : ""}`}
            >
              {orderStatus(order)}
            </span>
          </div>
          <div className="order-preview">
            {order.items.slice(0, 3).map((item, index) => (
              <ProductImage key={index} product={item} />
            ))}
          </div>
          <p>{order.items.map((i) => i.name).join(", ")}</p>
          <div className="order-card-bottom">
            <strong>{money(orderTotal(order))}</strong>
            <Link
              className="text-link"
              to={`/orders/${encodeURIComponent(order.id)}`}
            >
              View details →
            </Link>
          </div>
        </article>
      ))}
      {!matches.length && (
        <div className="empty-state">
          <h3>
            {orders.length
              ? "No matching orders"
              : "Your first order is waiting"}
          </h3>
          <p>
            {orders.length
              ? "Try another order ID or product name."
              : "Explore the collection and find your next training favourite."}
          </p>
          <Link className="button" to="/shop">
            Explore the collection
          </Link>
        </div>
      )}
    </AccountLayout>
  );
}