import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  getOrders,
} from "../services/orderApi.js";

import {
  getAddresses,
} from "../services/addressApi.js";

import AccountLayout from "../components/AccountLayout.jsx";


// ======================================================
// HELPERS
// ======================================================

function orderId(
  order
) {
  return (
    order?.orderNumber ||
    order?.id ||
    order?._id ||
    ""
  );
}


function statusLabel(
  value
) {
  return String(
    value || "confirmed"
  )
    .replace(
      /-/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        letter
      ) =>
        letter.toUpperCase()
    );
}


function formatDate(
  value
) {
  if (!value) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    }
  );
}


// ======================================================
// STAT CARD
// ======================================================

function AccountStat({
  to,
  value,
  label,
  sublabel,
}) {
  return (
    <Link
      to={
        to
      }
      style={{
        textDecoration:
          "none",
      }}
    >
      <strong>
        {
          value
        }
      </strong>

      <span>
        {
          label
        }
      </span>

      {sublabel && (
        <small
          className="muted"
          style={{
            display:
              "block",

            marginTop:
              "4px",
          }}
        >
          {
            sublabel
          }
        </small>
      )}
    </Link>
  );
}


// ======================================================
// ACCOUNT PAGE
// ======================================================

export default function AccountPage() {
  const {
    user,
    token,
    updateProfile,
    logout,
  } =
    useAuth();


  const {
    notify,
  } =
    useStore();


  const navigate =
    useNavigate();


  // ====================================================
  // PROFILE FORM
  // ====================================================

  const [
    profile,
    setProfile,
  ] =
    useState({
      name:
        user?.name ||
        "",

      phone:
        user?.phone ||
        "",
    });


  const [
    profileError,
    setProfileError,
  ] =
    useState("");


  const [
    savingProfile,
    setSavingProfile,
  ] =
    useState(
      false
    );


  useEffect(
    () => {
      setProfile({
        name:
          user?.name ||
          "",

        phone:
          user?.phone ||
          "",
      });
    },

    [
      user?.id,
      user?.name,
      user?.phone,
    ]
  );


  // ====================================================
  // ACCOUNT DATA
  // ====================================================

  const [
    orders,
    setOrders,
  ] =
    useState(
      []
    );


  const [
    addresses,
    setAddresses,
  ] =
    useState(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    loadError,
    setLoadError,
  ] =
    useState("");


  const [
    signingOut,
    setSigningOut,
  ] =
    useState(
      false
    );


  const [
    signOutError,
    setSignOutError,
  ] =
    useState("");


  // ====================================================
  // LOAD ORDERS + ADDRESSES
  // ====================================================

  useEffect(
    () => {
      let cancelled =
        false;


      async function loadAccount() {
        if (
          !user ||
          !token
        ) {
          if (
            !cancelled
          ) {
            setOrders(
              []
            );

            setAddresses(
              []
            );

            setLoading(
              false
            );
          }

          return;
        }


        setLoading(
          true
        );

        setLoadError(
          ""
        );


        try {
          const [
            orderResult,
            addressResult,
          ] =
            await Promise.allSettled([
              getOrders(
                token
              ),

              getAddresses(
                token
              ),
            ]);


          if (
            cancelled
          ) {
            return;
          }


          if (
            orderResult.status ===
            "fulfilled"
          ) {
            setOrders(
              Array.isArray(
                orderResult.value
              )
                ? orderResult.value
                : []
            );

          } else {
            setOrders(
              []
            );
          }


          if (
            addressResult.status ===
            "fulfilled"
          ) {
            setAddresses(
              Array.isArray(
                addressResult.value
              )
                ? addressResult.value
                : []
            );

          } else {
            setAddresses(
              []
            );
          }


          const problems =
            [];


          if (
            orderResult.status ===
            "rejected"
          ) {
            problems.push(
              orderResult.reason
                ?.message ||
                "Orders could not be loaded."
            );
          }


          if (
            addressResult.status ===
            "rejected"
          ) {
            problems.push(
              addressResult.reason
                ?.message ||
                "Saved addresses could not be loaded."
            );
          }


          if (
            problems.length
          ) {
            setLoadError(
              problems.join(
                " "
              )
            );
          }

        } catch (
          error
        ) {
          if (
            cancelled
          ) {
            return;
          }


          console.error(
            "Account load error:",
            error
          );


          setOrders(
            []
          );

          setAddresses(
            []
          );


          setLoadError(
            error.message ||
              "Your account information could not be loaded."
          );

        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      }


      loadAccount();


      return () => {
        cancelled =
          true;
      };
    },

    [
      user?.id,
      token,
    ]
  );


  // ====================================================
  // ACCOUNT STATS
  // ====================================================

  const stats =
    useMemo(
      () => {
        const activeOrders =
          orders.filter(
            (
              order
            ) =>
              ![
                "delivered",
                "cancelled",
              ].includes(
                String(
                  order?.status ||
                    ""
                )
              )
          ).length;


        const deliveredOrders =
          orders.filter(
            (
              order
            ) =>
              order?.status ===
              "delivered"
          ).length;


        const defaultAddress =
          addresses.find(
            (
              address
            ) =>
              address.isDefault
          ) ||
          addresses[0] ||
          null;


        return {
          activeOrders,
          deliveredOrders,
          defaultAddress,
        };
      },

      [
        orders,
        addresses,
      ]
    );


  const recentOrders =
    useMemo(
      () =>
        [...orders]
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                b.createdAt ||
                  0
              ).getTime() -
              new Date(
                a.createdAt ||
                  0
              ).getTime()
          )
          .slice(
            0,
            3
          ),

      [
        orders,
      ]
    );


  // ====================================================
  // SAVE PROFILE
  // ====================================================

  async function handleProfileSave(
    event
  ) {
    event.preventDefault();


    if (
      savingProfile
    ) {
      return;
    }


    setProfileError(
      ""
    );


    const name =
      String(
        profile.name ||
          ""
      ).trim();


    const phone =
      String(
        profile.phone ||
          ""
      ).replace(
        /\D/g,
        ""
      );


    if (
      name.length <
      2
    ) {
      setProfileError(
        "Enter a valid full name."
      );

      return;
    }


    if (
      name.length >
      60
    ) {
      setProfileError(
        "Name cannot exceed 60 characters."
      );

      return;
    }


    if (
      phone &&
      !/^[6-9]\d{9}$/.test(
        phone
      )
    ) {
      setProfileError(
        "Enter a valid 10-digit mobile number."
      );

      return;
    }


    setSavingProfile(
      true
    );


    try {
      const result =
        await updateProfile({
          name,
          phone,
        });


      const updatedUser =
        result?.user;


      if (
        updatedUser
      ) {
        setProfile({
          name:
            updatedUser.name ||
            "",

          phone:
            updatedUser.phone ||
            "",
        });
      }


      notify(
        result?.message ||
          "Profile updated successfully."
      );


    } catch (
      error
    ) {
      console.error(
        "Profile update error:",
        error
      );


      setProfileError(
        error.message ||
          "Unable to update your profile."
      );

    } finally {
      setSavingProfile(
        false
      );
    }
  }


  // ====================================================
  // LOGOUT
  // ====================================================

  async function handleLogout() {
    if (
      signingOut
    ) {
      return;
    }


    setSigningOut(
      true
    );

    setSignOutError(
      ""
    );


    try {
      await logout();


      notify(
        "Signed out successfully."
      );


      navigate(
        "/login",
        {
          replace:
            true,
        }
      );

    } catch (
      error
    ) {
      console.error(
        "Logout error:",
        error
      );


      setSignOutError(
        error.message ||
          "Unable to sign out. Please try again."
      );

    } finally {
      setSigningOut(
        false
      );
    }
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <AccountLayout
      title="Account overview"
    >
      {/* ===============================================
          ACCOUNT SUMMARY
      =============================================== */}

      <div
        className="account-stats"
      >
        <AccountStat
          to="/orders"
          value={
            loading
              ? "—"
              : orders.length
          }
          label="Orders"
          sublabel={
            loading
              ? "Loading…"
              : `${stats.activeOrders} active`
          }
        />


        <AccountStat
          to="/addresses"
          value={
            loading
              ? "—"
              : addresses.length
          }
          label="Addresses"
          sublabel={
            stats.defaultAddress
              ? "Default address saved"
              : "Add delivery address"
          }
        />


        <AccountStat
          to="/account/security"
          value="Account"
          label="Security"
          sublabel="Password & data"
        />
      </div>


      {loadError && (
        <div
          className="notice"
          style={{
            marginTop:
              "18px",
          }}
        >
          <strong>
            Some account information could not be loaded.
          </strong>

          <p
            className="muted"
          >
            {
              loadError
            }
          </p>
        </div>
      )}


      {/* ===============================================
          EDIT PROFILE
      =============================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "24px",
        }}
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            gap:
              "16px",

            alignItems:
              "flex-start",

            flexWrap:
              "wrap",
          }}
        >
          <div>
            <p
              className="eyebrow"
            >
              PROFILE
            </p>

            <h3>
              Personal details
            </h3>

            <p
              className="muted"
            >
              Keep your GymDrobe account information up to date.
            </p>
          </div>


          <Link
            className="button secondary"
            to="/account/security"
          >
            Account security
          </Link>
        </div>


        <form
          className="profile-form"
          onSubmit={
            handleProfileSave
          }
          style={{
            marginTop:
              "20px",
          }}
        >
          <div
            className="field"
          >
            <label
              htmlFor="profile-name"
            >
              Full name
            </label>

            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength="2"
              maxLength="60"
              value={
                profile.name
              }
              onChange={
                (
                  event
                ) =>
                  setProfile(
                    (
                      current
                    ) => ({
                      ...current,

                      name:
                        event.target
                          .value,
                    })
                  )
              }
            />
          </div>


          <div
            className="field"
          >
            <label
              htmlFor="profile-email"
            >
              Email
            </label>

            <input
              id="profile-email"
              type="email"
              value={
                user?.email ||
                ""
              }
              readOnly
            />

            <small
              className="muted"
            >
              Email changes are not available from this page.
            </small>
          </div>


          <div
            className="field"
          >
            <label
              htmlFor="profile-phone"
            >
              Mobile number
            </label>

            <input
              id="profile-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              maxLength="10"
              value={
                profile.phone
              }
              onChange={
                (
                  event
                ) =>
                  setProfile(
                    (
                      current
                    ) => ({
                      ...current,

                      phone:
                        event.target
                          .value
                          .replace(
                            /\D/g,
                            ""
                          )
                          .slice(
                            0,
                            10
                          ),
                    })
                  )
              }
            />

            <small
              className="muted"
            >
              Optional. Used for delivery and account contact.
            </small>
          </div>


          <div
            className="field"
          >
            <label
              htmlFor="profile-role"
            >
              Account type
            </label>

            <input
              id="profile-role"
              value={
                user?.role ===
                "admin"
                  ? "Administrator"
                  : "Customer"
              }
              readOnly
            />
          </div>


          {profileError && (
            <p
              className="field-error"
              role="alert"
            >
              {
                profileError
              }
            </p>
          )}


          <button
            type="submit"
            className="button"
            disabled={
              savingProfile
            }
          >
            {savingProfile
              ? "Saving changes…"
              : "Save changes"}
          </button>
        </form>
      </section>


      {/* ===============================================
          RECENT ORDERS
      =============================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "20px",
        }}
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              "14px",

            flexWrap:
              "wrap",
          }}
        >
          <div>
            <p
              className="eyebrow"
            >
              ORDERS
            </p>

            <h3>
              Recent orders
            </h3>

            {!loading && (
              <p
                className="muted"
              >
                {stats.deliveredOrders} delivered ·{" "}
                {stats.activeOrders} active
              </p>
            )}
          </div>


          <Link
            className="button secondary"
            to="/orders"
          >
            View all orders
          </Link>
        </div>


        {loading ? (
          <p
            className="muted"
            style={{
              marginTop:
                "18px",
            }}
          >
            Loading your orders…
          </p>

        ) : recentOrders.length ===
          0 ? (
          <div
            style={{
              marginTop:
                "18px",
            }}
          >
            <p
              className="muted"
            >
              You haven't placed an order yet.
            </p>

            <Link
              className="button"
              to="/shop"
            >
              Start shopping
            </Link>
          </div>

        ) : (
          <div
            style={{
              display:
                "grid",

              gap:
                "12px",

              marginTop:
                "18px",
            }}
          >
            {recentOrders.map(
              (
                order
              ) => {
                const id =
                  orderId(
                    order
                  );


                return (
                  <Link
                    key={
                      id
                    }
                    to={`/orders/${encodeURIComponent(
                      id
                    )}`}
                    className="panel"
                    style={{
                      textDecoration:
                        "none",

                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      alignItems:
                        "center",

                      gap:
                        "16px",

                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <strong>
                        {
                          order.orderNumber ||
                          id
                        }
                      </strong>

                      <p
                        className="muted"
                        style={{
                          margin:
                            "4px 0 0",
                        }}
                      >
                        {formatDate(
                          order.createdAt
                        ) ||
                          "Order"}
                      </p>
                    </div>


                    <div
                      style={{
                        textAlign:
                          "right",
                      }}
                    >
                      <strong>
                        {statusLabel(
                          order.status
                        )}
                      </strong>

                      <p
                        className="muted"
                        style={{
                          margin:
                            "4px 0 0",
                        }}
                      >
                        View details →
                      </p>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        )}
      </section>


      {/* ===============================================
          ADDRESSES
      =============================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "20px",
        }}
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            gap:
              "16px",

            flexWrap:
              "wrap",

            alignItems:
              "center",
          }}
        >
          <div>
            <p
              className="eyebrow"
            >
              DELIVERY
            </p>

            <h3>
              Saved addresses
            </h3>


            {loading ? (
              <p
                className="muted"
              >
                Loading addresses…
              </p>

            ) : stats.defaultAddress ? (
              <p
                className="muted"
              >
                {stats.defaultAddress
                  .label ||
                  "Default"}{" "}
                ·{" "}
                {stats.defaultAddress
                  .city ||
                  stats.defaultAddress
                    .addressLine ||
                  "Saved address"}
              </p>

            ) : (
              <p
                className="muted"
              >
                Save an address for faster checkout.
              </p>
            )}
          </div>


          <Link
            className="button secondary"
            to="/addresses"
          >
            Manage addresses
          </Link>
        </div>
      </section>


      {/* ===============================================
          SHOPPING TOOLS
      =============================================== */}

      <section
        className="panel"
        style={{
          marginTop:
            "20px",
        }}
      >
        <p
          className="eyebrow"
        >
          YOUR GYMDROBE
        </p>

        <h3>
          Shopping tools
        </h3>


        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",

            gap:
              "12px",

            marginTop:
              "18px",
          }}
        >
          <Link
            to="/wishlist"
            className="button secondary"
          >
            Wishlist
          </Link>


          <Link
            to="/saved"
            className="button secondary"
          >
            Saved for later
          </Link>


          <Link
            to="/notifications"
            className="button secondary"
          >
            Price & stock alerts
          </Link>


          <Link
            to="/help"
            className="button secondary"
          >
            Help & support
          </Link>
        </div>
      </section>


      {/* ===============================================
          ADMIN
      =============================================== */}

      {user?.role ===
        "admin" && (
        <section
          className="panel"
          style={{
            marginTop:
              "20px",
          }}
        >
          <p
            className="eyebrow"
          >
            ADMINISTRATION
          </p>

          <h3>
            GymDrobe admin
          </h3>


          <div
            style={{
              display:
                "flex",

              gap:
                "10px",

              flexWrap:
                "wrap",

              marginTop:
                "16px",
            }}
          >
            <Link
              className="button secondary"
              to="/admin/orders"
            >
              Manage orders
            </Link>


            <Link
              className="button secondary"
              to="/admin/products"
            >
              Products & inventory
            </Link>


            <Link
              className="button secondary"
              to="/admin/returns"
            >
              Returns & exchanges
            </Link>
          </div>
        </section>
      )}


      {/* ===============================================
          SIGN OUT
      =============================================== */}

      <section
        style={{
          marginTop:
            "24px",
        }}
      >
        {signOutError && (
          <p
            className="field-error"
            role="alert"
          >
            {
              signOutError
            }
          </p>
        )}


        <button
          className="button secondary signout"
          type="button"
          disabled={
            signingOut
          }
          onClick={
            handleLogout
          }
        >
          {signingOut
            ? "Signing out…"
            : "Sign out"}
        </button>
      </section>
    </AccountLayout>
  );
}