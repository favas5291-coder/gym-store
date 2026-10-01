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
  addressErrors,
  EMPTY_ADDRESS,
} from "../utils/customerData.js";

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
// ADDRESS PAGE
// ======================================================

export default function AddressesPage() {
  const {
    user,
    token,
  } = useAuth();

  const {
    notify,
  } = useStore();


  const [
    addresses,
    setAddresses,
  ] = useState([]);


  const [
    editing,
    setEditing,
  ] = useState(null);


  const [
    errors,
    setErrors,
  ] = useState({});


  const [
    error,
    setError,
  ] = useState("");


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    busy,
    setBusy,
  ] = useState(false);


  // ======================================================
  // LOAD ADDRESSES
  // ======================================================

  const loadAddresses =
    useCallback(
      async (
        silent = false
      ) => {
        if (!token) {
          setAddresses([]);

          setLoading(false);

          return [];
        }


        if (!silent) {
          setLoading(true);
        }


        try {
          const result =
            await getAddresses(
              token
            );


          setAddresses(
            result
          );

          setError("");


          return result;

        } catch (error) {
          console.error(
            "Load addresses error:",
            error
          );


          setError(
            error.message ||
              "Could not load your addresses."
          );


          return [];

        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },

      [token]
    );


  // ======================================================
  // INITIAL LOAD
  // ======================================================

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);


  // ======================================================
  // OPEN NEW ADDRESS FORM
  // ======================================================

  function addNewAddress() {
    setEditing({
      ...EMPTY_ADDRESS,

      fullName:
        user?.name || "",

      email:
        user?.email || "",

      phone:
        user?.phone || "",

      isDefault:
        addresses.length ===
        0,
    });


    setErrors({});

    setError("");
  }


  // ======================================================
  // SAVE / UPDATE ADDRESS
  // ======================================================

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


    setBusy(true);

    setError("");


    try {
      const payload = {
        fullName:
          editing.fullName,

        email:
          editing.email,

        phone:
          editing.phone,

        addressLine:
          editing.addressLine,

        landmark:
          editing.landmark,

        city:
          editing.city,

        state:
          editing.state,

        pincode:
          editing.pincode,

        label:
          editing.label ||
          "Home",

        isDefault:
          Boolean(
            editing.isDefault
          ),
      };


      if (
        editing.id
      ) {
        await updateAddress(
          token,
          editing.id,
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

      setErrors({});


      notify(
        editing.id
          ? "Address updated."
          : "Address saved."
      );

    } catch (error) {
      console.error(
        "Save address error:",
        error
      );


      if (
        error.errors &&
        Object.keys(
          error.errors
        ).length
      ) {
        setErrors(
          error.errors
        );
      }


      setError(
        error.message ||
          "Could not save address."
      );

    } finally {
      setBusy(false);
    }
  }


  // ======================================================
  // DELETE ADDRESS
  // ======================================================

  async function remove(
    id
  ) {
    if (
      busy ||
      !id
    ) {
      return;
    }


    setBusy(true);

    setError("");


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

    } catch (error) {
      console.error(
        "Delete address error:",
        error
      );


      setError(
        error.message ||
          "Could not remove address."
      );

    } finally {
      setBusy(false);
    }
  }


  // ======================================================
  // MAKE DEFAULT
  // ======================================================

  async function makeDefault(
    id
  ) {
    if (
      busy ||
      !id
    ) {
      return;
    }


    setBusy(true);

    setError("");


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

    } catch (error) {
      console.error(
        "Default address error:",
        error
      );


      setError(
        error.message ||
          "Could not update the default address."
      );

    } finally {
      setBusy(false);
    }
  }


  // ======================================================
  // LOADING
  // ======================================================

  if (loading) {
    return (
      <AccountLayout
        title="Saved addresses"
      >
        <p className="muted">
          Loading your
          addresses…
        </p>
      </AccountLayout>
    );
  }


  // ======================================================
  // PAGE
  // ======================================================

  return (
    <AccountLayout
      title="Saved addresses"
    >

      {/* ADD ADDRESS */}

      <button
        type="button"

        className="button secondary"

        disabled={
          busy
        }

        onClick={
          addNewAddress
        }
      >
        + Add new address
      </button>


      {/* ERROR */}

      {error &&
        !editing && (

          <p
            className="field-error"
            role="alert"
          >
            {error}
          </p>

        )}


      {/* ADDRESS LIST */}

      <div className="address-list">

        {addresses.map(
          (address) => (

            <article
              className="address-card"

              key={
                address.id
              }
            >

              <strong>
                {
                  address.fullName
                }
              </strong>


              {address.isDefault && (

                <span className="status-pill">
                  Default
                </span>

              )}


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


              <div className="action-links">

                {/* EDIT */}

                <button
                  type="button"

                  disabled={
                    busy
                  }

                  onClick={() => {
                    setEditing({
                      ...address,
                    });

                    setErrors({});

                    setError("");
                  }}
                >
                  Edit
                </button>


                {/* REMOVE */}

                <button
                  type="button"

                  disabled={
                    busy
                  }

                  onClick={() =>
                    remove(
                      address.id
                    )
                  }
                >
                  Remove
                </button>


                {/* DEFAULT */}

                {!address.isDefault && (

                  <button
                    type="button"

                    disabled={
                      busy
                    }

                    onClick={() =>
                      makeDefault(
                        address.id
                      )
                    }
                  >
                    Make default
                  </button>

                )}

              </div>

            </article>

          )
        )}

      </div>


      {/* EMPTY */}

      {!addresses.length &&
        !error && (

          <p className="muted">
            Add an address
            for faster
            checkout.
          </p>

        )}


      {/* ADDRESS MODAL */}

      {editing && (

        <Modal
          title={
            editing.id
              ? "Edit address"
              : "Add address"
          }

          onClose={() => {
            if (!busy) {
              setEditing(
                null
              );

              setErrors({});

              setError("");
            }
          }}
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


            <label className="check">

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

                onChange={(
                  event
                ) =>
                  setEditing({
                    ...editing,

                    isDefault:
                      event.target
                        .checked,
                  })
                }
              />

              Make this my
              default address

            </label>


            {error && (

              <p
                className="field-error"
                role="alert"
              >
                {error}
              </p>

            )}


            <button
              className="button full"

              type="submit"

              disabled={
                busy
              }
            >
              {
                busy
                  ? "Saving…"
                  : "Save address"
              }
            </button>

          </form>

        </Modal>

      )}

    </AccountLayout>
  );
}