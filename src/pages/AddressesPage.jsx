import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from "../services/addressApi.js";

import AccountLayout from "../components/AccountLayout.jsx";
import AddressForm from "../components/AddressForm.jsx";
import Modal from "../components/Modal.jsx";


// ======================================================
// EMPTY ADDRESS
// ======================================================

const EMPTY_ADDRESS = {
  fullName: "",
  email: "",
  phone: "",
  addressLine: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  label: "Home",
  isDefault: false,
};


// ======================================================
// GET ADDRESS ID
//
// Supports either:
// id
// or MongoDB _id
// ======================================================

function getAddressId(
  address
) {
  return (
    address?.id ||
    address?._id ||
    ""
  );
}


// ======================================================
// ADDRESS VALIDATION
// ======================================================

function addressErrors(
  address
) {
  const errors = {};


  const text =
    (
      key
    ) =>
      String(
        address?.[key] ||
          ""
      ).trim();


  if (
    text(
      "fullName"
    ).length <
    2
  ) {
    errors.fullName =
      "Enter your full name.";
  }


  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      text(
        "email"
      )
    )
  ) {
    errors.email =
      "Enter a valid email.";
  }


  if (
    !/^[6-9]\d{9}$/.test(
      text(
        "phone"
      )
    )
  ) {
    errors.phone =
      "Enter a valid 10-digit Indian mobile number.";
  }


  if (
    text(
      "addressLine"
    ).length <
    5
  ) {
    errors.addressLine =
      "Enter your house number and street.";
  }


  if (
    !text(
      "city"
    )
  ) {
    errors.city =
      "Enter your city.";
  }


  if (
    !text(
      "state"
    )
  ) {
    errors.state =
      "Enter your state.";
  }


  if (
    !/^[1-9]\d{5}$/.test(
      text(
        "pincode"
      )
    )
  ) {
    errors.pincode =
      "Enter a valid 6-digit pincode.";
  }


  return errors;
}


// ======================================================
// CLEAN PAYLOAD
//
// Only fields required by the address API are sent.
// ======================================================

function addressPayload(
  address
) {
  return {
    fullName:
      String(
        address?.fullName ||
          ""
      ).trim(),

    email:
      String(
        address?.email ||
          ""
      )
        .trim()
        .toLowerCase(),

    phone:
      String(
        address?.phone ||
          ""
      ).replace(
        /\D/g,
        ""
      ),

    addressLine:
      String(
        address?.addressLine ||
          ""
      ).trim(),

    landmark:
      String(
        address?.landmark ||
          ""
      ).trim(),

    city:
      String(
        address?.city ||
          ""
      ).trim(),

    state:
      String(
        address?.state ||
          ""
      ).trim(),

    pincode:
      String(
        address?.pincode ||
          ""
      ).replace(
        /\D/g,
        ""
      ),

    label:
      String(
        address?.label ||
          "Home"
      ).trim() ||
      "Home",

    isDefault:
      Boolean(
        address?.isDefault
      ),
  };
}


// ======================================================
// ADDRESS PAGE
// ======================================================

export default function AddressesPage() {
  const {
    user,
    token,
  } =
    useAuth();


  const {
    notify,
  } =
    useStore();


  const [
    addresses,
    setAddresses,
  ] =
    useState([]);


  const [
    editing,
    setEditing,
  ] =
    useState(null);


  const [
    errors,
    setErrors,
  ] =
    useState({});


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    busy,
    setBusy,
  ] =
    useState(false);


  // ====================================================
  // LOAD ADDRESSES
  // ====================================================

  const loadAddresses =
    useCallback(
      async (
        silent = false
      ) => {
        if (
          !token
        ) {
          setAddresses(
            []
          );

          setLoading(
            false
          );

          return [];
        }


        if (
          !silent
        ) {
          setLoading(
            true
          );
        }


        try {
          const result =
            await getAddresses(
              token
            );


          const list =
            Array.isArray(
              result
            )
              ? result
              : [];


          setAddresses(
            list
          );

          setError(
            ""
          );


          return list;

        } catch (
          loadError
        ) {
          console.error(
            "Load addresses error:",
            loadError
          );


          setError(
            loadError.message ||
              "Could not load your addresses."
          );


          return [];

        } finally {
          if (
            !silent
          ) {
            setLoading(
              false
            );
          }
        }
      },

      [
        token,
      ]
    );


  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(
    () => {
      loadAddresses();
    },

    [
      loadAddresses,
    ]
  );


  // ====================================================
  // ADD NEW ADDRESS
  // ====================================================

  function addNewAddress() {
    setEditing({
      ...EMPTY_ADDRESS,

      fullName:
        user?.name ||
        "",

      email:
        user?.email ||
        "",

      phone:
        user?.phone ||
        "",

      isDefault:
        addresses.length ===
        0,
    });


    setErrors(
      {}
    );

    setError(
      ""
    );
  }


  // ====================================================
  // EDIT ADDRESS
  // ====================================================

  function editAddress(
    address
  ) {
    setEditing({
      ...EMPTY_ADDRESS,
      ...address,

      id:
        getAddressId(
          address
        ),
    });


    setErrors(
      {}
    );

    setError(
      ""
    );
  }


  // ====================================================
  // CLOSE FORM
  // ====================================================

  function closeEditor() {
    if (
      busy
    ) {
      return;
    }


    setEditing(
      null
    );

    setErrors(
      {}
    );

    setError(
      ""
    );
  }


  // ====================================================
  // SAVE / UPDATE ADDRESS
  // ====================================================

  async function save(
    event
  ) {
    event.preventDefault();


    if (
      !editing ||
      busy
    ) {
      return;
    }


    if (
      !token
    ) {
      setError(
        "Your sign-in session has expired. Please sign in again."
      );

      return;
    }


    const invalid =
      addressErrors(
        editing
      );


    setErrors(
      invalid
    );


    if (
      Object.keys(
        invalid
      ).length
    ) {
      return;
    }


    setBusy(
      true
    );

    setError(
      ""
    );


    try {
      const payload =
        addressPayload(
          editing
        );


      const id =
        getAddressId(
          editing
        );


      if (
        id
      ) {
        await updateAddress(
          token,
          id,
          payload
        );

      } else {
        await createAddress(
          token,
          payload
        );
      }


      await loadAddresses(
        true
      );


      setEditing(
        null
      );

      setErrors(
        {}
      );


      notify(
        id
          ? "Address updated."
          : "Address saved."
      );

    } catch (
      saveError
    ) {
      console.error(
        "Save address error:",
        saveError
      );


      const backendErrors =
        saveError?.errors ||
        saveError?.data?.errors;


      if (
        backendErrors &&
        typeof backendErrors ===
          "object"
      ) {
        setErrors(
          backendErrors
        );
      }


      setError(
        saveError.message ||
          "Could not save address."
      );

    } finally {
      setBusy(
        false
      );
    }
  }


  // ====================================================
  // DELETE ADDRESS
  // ====================================================

  async function remove(
    address
  ) {
    const id =
      getAddressId(
        address
      );


    if (
      busy ||
      !id
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        "Remove this saved address?"
      );


    if (
      !confirmed
    ) {
      return;
    }


    if (
      !token
    ) {
      setError(
        "Your sign-in session has expired. Please sign in again."
      );

      return;
    }


    setBusy(
      true
    );

    setError(
      ""
    );


    try {
      await deleteAddress(
        token,
        id
      );


      await loadAddresses(
        true
      );


      notify(
        "Address removed.",
        "info"
      );

    } catch (
      deleteError
    ) {
      console.error(
        "Delete address error:",
        deleteError
      );


      setError(
        deleteError.message ||
          "Could not remove address."
      );

    } finally {
      setBusy(
        false
      );
    }
  }


  // ====================================================
  // MAKE DEFAULT
  // ====================================================

  async function makeDefault(
    address
  ) {
    const id =
      getAddressId(
        address
      );


    if (
      busy ||
      !id ||
      address?.isDefault
    ) {
      return;
    }


    if (
      !token
    ) {
      setError(
        "Your sign-in session has expired. Please sign in again."
      );

      return;
    }


    setBusy(
      true
    );

    setError(
      ""
    );


    try {
      await updateAddress(
        token,
        id,
        {
          isDefault:
            true,
        }
      );


      await loadAddresses(
        true
      );


      notify(
        "Default address updated."
      );

    } catch (
      defaultError
    ) {
      console.error(
        "Default address error:",
        defaultError
      );


      setError(
        defaultError.message ||
          "Could not update the default address."
      );

    } finally {
      setBusy(
        false
      );
    }
  }


  // ====================================================
  // LOADING
  // ====================================================

  if (
    loading
  ) {
    return (
      <AccountLayout
        title="Saved addresses"
      >
        <p
          className="muted"
        >
          Loading your addresses…
        </p>
      </AccountLayout>
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <AccountLayout
      title="Saved addresses"
    >
      {/* ===============================================
          PAGE HEADER
      =============================================== */}

      <div
        style={{
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

          marginBottom:
            "20px",
        }}
      >
        <div>
          <p
            className="eyebrow"
          >
            DELIVERY
          </p>

          <h3>
            Your delivery addresses
          </h3>

          <p
            className="muted"
          >
            Save your delivery details for faster checkout.
          </p>
        </div>


        <button
          type="button"
          className="button"
          disabled={
            busy
          }
          onClick={
            addNewAddress
          }
        >
          + Add new address
        </button>
      </div>


      {/* ===============================================
          PAGE ERROR
      =============================================== */}

      {error &&
        !editing && (
          <p
            className="field-error"
            role="alert"
          >
            {
              error
            }
          </p>
        )}


      {/* ===============================================
          ADDRESS LIST
      =============================================== */}

      <div
        className="address-list"
      >
        {addresses.map(
          (
            address
          ) => {
            const id =
              getAddressId(
                address
              );


            return (
              <article
                className="address-card"
                key={
                  id
                }
              >
                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "flex-start",

                    gap:
                      "12px",

                    flexWrap:
                      "wrap",
                  }}
                >
                  <div>
                    <strong>
                      {
                        address.fullName
                      }
                    </strong>


                    {address.label && (
                      <p
                        className="muted"
                        style={{
                          margin:
                            "4px 0 0",
                        }}
                      >
                        {
                          address.label
                        }
                      </p>
                    )}
                  </div>


                  {address.isDefault && (
                    <span
                      className="status-pill"
                    >
                      Default
                    </span>
                  )}
                </div>


                <p>
                  {
                    address.addressLine
                  }


                  {address.landmark && (
                    <>
                      <br />

                      {
                        address.landmark
                      }
                    </>
                  )}


                  <br />

                  {
                    address.city
                  }
                  ,{" "}
                  {
                    address.state
                  }
                  {" – "}
                  {
                    address.pincode
                  }
                </p>


                <p>
                  {
                    address.phone
                  }
                </p>


                {address.email && (
                  <p
                    className="muted"
                  >
                    {
                      address.email
                    }
                  </p>
                )}


                <div
                  className="action-links"
                >
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      editAddress(
                        address
                      )
                    }
                  >
                    Edit
                  </button>


                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      remove(
                        address
                      )
                    }
                  >
                    Remove
                  </button>


                  {!address.isDefault && (
                    <button
                      type="button"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        makeDefault(
                          address
                        )
                      }
                    >
                      Make default
                    </button>
                  )}
                </div>
              </article>
            );
          }
        )}
      </div>


      {/* ===============================================
          EMPTY STATE
      =============================================== */}

      {!addresses.length &&
        !error && (
          <section
            className="panel"
            style={{
              marginTop:
                "20px",

              textAlign:
                "center",
            }}
          >
            <h3>
              No saved addresses yet
            </h3>

            <p
              className="muted"
            >
              Add your delivery address now so checkout is quicker later.
            </p>

            <button
              type="button"
              className="button"
              onClick={
                addNewAddress
              }
            >
              Add your first address
            </button>
          </section>
        )}


      {/* ===============================================
          ADDRESS MODAL
      =============================================== */}

      {editing && (
        <Modal
          title={
            getAddressId(
              editing
            )
              ? "Edit address"
              : "Add address"
          }
          onClose={
            closeEditor
          }
        >
          <form
            onSubmit={
              save
            }
            noValidate
          >
            <AddressForm
              value={
                editing
              }
              onChange={
                setEditing
              }
              errors={
                errors
              }
            />


            <label
              className="check"
            >
              <input
                type="checkbox"
                checked={
                  Boolean(
                    editing.isDefault
                  )
                }
                disabled={
                  busy
                }
                onChange={
                  (
                    event
                  ) =>
                    setEditing(
                      (
                        current
                      ) => ({
                        ...current,

                        isDefault:
                          event.target
                            .checked,
                      })
                    )
                }
              />

              Make this my default address
            </label>


            {error && (
              <p
                className="field-error"
                role="alert"
              >
                {
                  error
                }
              </p>
            )}


            <button
              className="button full"
              type="submit"
              disabled={
                busy
              }
            >
              {busy
                ? "Saving…"
                : getAddressId(
                      editing
                    )
                  ? "Update address"
                  : "Save address"}
            </button>
          </form>
        </Modal>
      )}
    </AccountLayout>
  );
}