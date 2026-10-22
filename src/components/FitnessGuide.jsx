import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link, useLocation } from "react-router-dom";

import { useCatalog } from "../context/CatalogContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import Modal from "./Modal.jsx";
import { ProductImage } from "./StorefrontShared.jsx";

import { getVariantStock } from "../utils/cartUtils.js";
import { selectedProductImage } from "../utils/productImages.js";
import { optionLabels } from "../utils/productInformation.js";
import { money } from "../utils/productPricing.js";

import {
  productReference,
  purchaseOptions,
  purchaseState,
} from "../utils/productPurchase.js";

import {
  FITNESS_GOALS,
  assistantRoute,
  availableGuideCategories,
  createGuideSession,
  parseShoppingBudget,
  recommendFitnessProducts,
} from "../utils/fitnessRecommendations.js";

import "./FitnessGuide.css";

const HEADING =
  "What do you need for your fitness journey?";

const QUESTIONS = [
  "What are you looking for?",
  "What is your budget?",
  "What is your main fitness goal?",
];

function anotherDialog() {
  return [
    ...document.querySelectorAll(
      'dialog[open], [role="dialog"]:not([aria-hidden="true"]), [role="alertdialog"]:not([aria-hidden="true"])',
    ),
  ].some(
    (element) => element.getClientRects().length > 0,
  );
}

function editingForm() {
  return Boolean(
    document.activeElement?.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"], .product-options, form',
    ),
  );
}

function RecommendationItem({
  row,
  answers,
  onLeave,
}) {
  const { addToCart, notify } = useStore();

  const {
    refreshProducts,
    catalogReady,
    refreshing,
  } = useCatalog();

  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  const lock = useRef(false);
  const mounted = useRef(false);
  const sizeRef = useRef(null);
  const colorRef = useRef(null);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const product = row.product;
  const sizes = purchaseOptions(product.sizes);
  const colors = purchaseOptions(product.colors);
  const labels = optionLabels(product);

  const path = `/product/${encodeURIComponent(
    productReference(product),
  )}`;

  async function add(event) {
    event.preventDefault();

    if (lock.current) return;

    const selection = purchaseState(
      product,
      size || null,
      color || null,
      1,
      catalogReady && !refreshing,
    );

    if (!selection.canBuy) {
      setError(selection.message);

      if (sizes.length && !size) {
        sizeRef.current?.focus();
      } else if (colors.length && !color) {
        colorRef.current?.focus();
      }

      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");
    setAdded(false);

    try {
      const products = await refreshProducts();

      if (!mounted.current) {
        notify(
          "Suggestions changed. Review the latest products before adding.",
          "info",
        );
        return;
      }

      const current = products.find(
        (item) =>
          String(productReference(item)) ===
          String(productReference(product)),
      );

      const reviewed = recommendFitnessProducts(
        products,
        answers,
      );

      const stillRecommended = reviewed.rows.some(
        (item) =>
          String(productReference(item.product)) ===
          String(productReference(product)),
      );

      if (!current || !stillRecommended) {
        throw new Error(
          "Prices, stock or suggestions changed. Review the updated selection before adding.",
        );
      }

      const check = purchaseState(
        current,
        size || null,
        color || null,
        1,
        true,
      );

      if (!check.canBuy) {
        throw new Error(check.message);
      }

      const saved = addToCart(
        current,
        1,
        size || null,
        color || null,
      );

      if (!saved) {
        throw new Error(
          "This item could not be added. Check its options and your bag, then retry.",
        );
      }

      setAdded(true);
    } catch (failure) {
      const message =
        failure.message ||
        "Unable to add this item. Please retry.";

      if (mounted.current) {
        setError(message);
      }

      notify(message, "error");
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  function changeColor(value) {
    setColor(value);
    setAdded(false);

    if (
      sizes.length &&
      getVariantStock(
        product,
        size || null,
        value || null,
      ) < 1
    ) {
      setSize("");

      setError(
        `Choose an available ${labels.size.toLowerCase()} for this ${labels.color.toLowerCase()}.`,
      );
    } else {
      setError("");
    }
  }

  return (
    <article className="gd-guide-product">
      <Link
        to={path}
        onClick={onLeave}
        className="gd-guide-image"
        aria-label={`View ${product.name}`}
      >
        <ProductImage
          product={{
            ...product,
            image: selectedProductImage(
              product,
              color || null,
            ),
            selectedColor: color || null,
          }}
        />
      </Link>

      <div className="gd-guide-product-copy">
        {product.brand && (
          <p className="gd-guide-brand">
            {product.brand}
          </p>
        )}

        <h4>
          <Link to={path} onClick={onLeave}>
            {product.name}
          </Link>
        </h4>

        <strong className="gd-guide-price">
          {money(row.pricePaise / 100)}
        </strong>

        <p>{row.reason}</p>

        <form
          onSubmit={add}
          noValidate
          aria-label={`Choose options for ${product.name}`}
          aria-busy={busy}
        >
          {colors.length > 0 && (
            <label>
              {labels.color} (required)

              <select
                ref={colorRef}
                value={color}
                disabled={busy}
                onChange={(event) =>
                  changeColor(event.target.value)
                }
                aria-invalid={Boolean(error && !color)}
              >
                <option value="">
                  Choose {labels.color.toLowerCase()}
                </option>

                {colors.map((value) => (
                  <option
                    key={value}
                    value={value}
                    disabled={
                      !(sizes.length ? sizes : [null]).some(
                        (option) =>
                          getVariantStock(
                            product,
                            option,
                            value,
                          ) > 0,
                      )
                    }
                  >
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}

          {sizes.length > 0 && (
            <label>
              {labels.size} (required)

              <select
                ref={sizeRef}
                value={size}
                disabled={busy}
                onChange={(event) => {
                  setSize(event.target.value);
                  setError("");
                  setAdded(false);
                }}
                aria-invalid={Boolean(error && !size)}
              >
                <option value="">
                  Choose {labels.size.toLowerCase()}
                </option>

                {sizes.map((value) => (
                  <option
                    key={value}
                    value={value}
                    disabled={
                      !(
                        colors.length
                          ? color
                            ? [color]
                            : colors
                          : [null]
                      ).some(
                        (option) =>
                          getVariantStock(
                            product,
                            value,
                            option,
                          ) > 0,
                      )
                    }
                  >
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!colors.length && !sizes.length && (
            <p>Standard option · Quantity 1</p>
          )}

          {error && (
            <p className="gd-guide-error" role="alert">
              {error}
            </p>
          )}

          {added && (
            <p className="gd-guide-added" role="status">
              Added to your bag. Your other items are
              still there.
            </p>
          )}

          <div className="gd-guide-actions">
            <Link
              className="button secondary"
              to={path}
              onClick={onLeave}
            >
              View Product
            </Link>

            <button
              className="button"
              type="submit"
              disabled={
                busy || refreshing || !catalogReady
              }
            >
              {busy ? "Checking…" : "Add to Cart"}
            </button>
          </div>
        </form>
      </div>
    </article>
  );
}

export default function FitnessGuide() {
  const { pathname } = useLocation();

  const {
    products,
    loading,
    loaded,
    refreshing,
    error: catalogError,
    refreshProducts,
  } = useCatalog();

  const [view, setView] = useState("closed");
  const [step, setStep] = useState(0);

  const [launcherReady, setLauncherReady] =
    useState(false);

  const [answers, setAnswers] = useState({
    categories: [],
    kit: false,
    budget: "",
    goal: "",
  });

  const [error, setError] = useState("");
  const [launcherMessage, setLauncherMessage] =
    useState("");

  const heading = useRef(null);
  const scroll = useRef(null);
  const viewRef = useRef(view);
  const session = useRef(null);
  const browsingTime = useRef(0);

  viewRef.current = view;

  if (!session.current) {
    session.current = createGuideSession(
      () => window.sessionStorage,
    );
  }

  const allowed = assistantRoute(pathname);

  const productRoute =
    /^\/product\/[^/]+\/?$/.test(pathname);

  const categories = useMemo(
    () => availableGuideCategories(products),
    [products],
  );

  const result = useMemo(
    () => recommendFitnessProducts(products, answers),
    [products, answers],
  );

  const budget = parseShoppingBudget(answers.budget);

  useEffect(() => {
    setView("closed");
    setLauncherMessage("");
  }, [pathname]);

  useEffect(() => {
    if (!allowed || launcherReady) return;

    let last = performance.now();
    let lastInteraction = -Infinity;

    const interact = () => {
      lastInteraction = performance.now();
    };

    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - last;

      last = now;

      if (
        viewRef.current !== "closed" ||
        document.visibilityState !== "visible" ||
        editingForm() ||
        anotherDialog() ||
        now - lastInteraction < 1500
      ) {
        return;
      }

      browsingTime.current += Math.min(
        1000,
        Math.max(0, elapsed),
      );

      if (browsingTime.current >= 10000) {
        setLauncherReady(true);

        if (session.current.claim()) {
          setView("intro");
        }
      }
    }, 250);

    document.addEventListener("input", interact, true);
    document.addEventListener(
      "pointerdown",
      interact,
      true,
    );

    return () => {
      window.clearInterval(timer);

      document.removeEventListener(
        "input",
        interact,
        true,
      );

      document.removeEventListener(
        "pointerdown",
        interact,
        true,
      );
    };
  }, [allowed, pathname, launcherReady]);

  useEffect(() => {
    if (
      view === "questions" ||
      view === "results"
    ) {
      scroll.current?.scrollTo({ top: 0 });

      heading.current?.focus({
        preventScroll: true,
      });
    }

    if (view === "results") {
      void refreshProducts();
    }
  }, [view, step, refreshProducts]);

  function close() {
    session.current.dismiss();
    setView("closed");
    setError("");
  }

  function open() {
    if (anotherDialog()) {
      setLauncherMessage(
        "Close the other dialog first, then try again.",
      );
      return;
    }

    session.current.dismiss();
    setLauncherMessage("");
    setStep(0);
    setError("");
    setView("questions");
  }

  function next(event) {
    event.preventDefault();

    if (step === 1 && budget.error) {
      setError(budget.error);
      return;
    }

    setError("");

    if (step < 2) {
      setStep(step + 1);
    } else {
      setView("results");
    }
  }

  function skip() {
    setAnswers((current) => ({
      ...current,
      ...(step === 0
        ? { categories: [], kit: false }
        : step === 1
          ? { budget: "" }
          : { goal: "" }),
    }));

    setError("");

    if (step < 2) {
      setStep(step + 1);
    } else {
      setView("results");
    }
  }

  function toggleCategory(name) {
    setAnswers((current) => ({
      ...current,
      categories: current.categories.includes(name)
        ? current.categories.filter(
            (value) => value !== name,
          )
        : [...current.categories, name],
    }));
  }

  function edit() {
    setStep(0);
    setError("");
    setView("questions");
  }

  if (!allowed) return null;

  return (
    <>
      {launcherReady && (
        <div
          className={`gd-guide-reopen${
            productRoute ? " on-product" : ""
          }`}
        >
          <button
            type="button"
            onClick={open}
            aria-haspopup="dialog"
            aria-label="Help me choose products"
            title="Help me choose products"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z" />
              <path d="M20 3v4m-2-2h4" />
            </svg>
          </button>

          {launcherMessage && (
            <p role="status">{launcherMessage}</p>
          )}
        </div>
      )}

      {view !== "closed" && (
        <Modal
          title={
            view === "intro"
              ? HEADING
              : "Find My Gym Essentials"
          }
          onClose={close}
          className={`gd-fitness-guide${
            view === "intro"
              ? " gd-guide-welcome"
              : ""
          }`}
        >
          <div className="gd-guide-body" ref={scroll}>
            {view === "intro" && (
              <div className="gd-guide-intro">
                <span
                  className="gd-guide-star"
                  aria-hidden="true"
                >
                  ✦
                </span>

                <p>
                  Tell us what you’re looking for, your
                  budget and your goal. We’ll help you
                  find suitable products.
                </p>

                <p className="gd-guide-muted">
                  Three optional questions. No account
                  or contact details needed.
                </p>

                <div className="gd-guide-actions">
                  <button
                    className="button"
                    type="button"
                    onClick={edit}
                  >
                    Help Me Choose Products
                  </button>

                  <button
                    className="button secondary"
                    type="button"
                    onClick={close}
                  >
                    Skip for Now
                  </button>
                </div>
              </div>
            )}

            {view === "questions" && (
              <form onSubmit={next} noValidate>
                <ol
                  className="gd-guide-progress"
                  aria-label="Your shopping preferences"
                >
                  {[
                    "Shopping needs",
                    "Budget",
                    "Fitness goal",
                  ].map((label, index) => (
                    <li
                      key={label}
                      aria-current={
                        step === index
                          ? "step"
                          : undefined
                      }
                      className={
                        index <= step
                          ? "is-active"
                          : ""
                      }
                    >
                      <span>{index + 1}</span>
                      {label}
                    </li>
                  ))}
                </ol>

                <p className="gd-guide-muted">
                  Question {step + 1} of 3 · You can
                  skip any question.
                </p>

                <h3 ref={heading} tabIndex={-1}>
                  {QUESTIONS[step]}
                </h3>

                {step === 0 && (
                  <>
                    <p>
                      Choose any available categories
                      that interest you.
                    </p>

                    {(loading || !loaded) &&
                      !catalogError && (
                        <p role="status">
                          Loading available categories…
                        </p>
                      )}

                    {catalogError && (
                      <div role="alert">
                        <p>{catalogError}</p>

                        <button
                          className="button secondary"
                          type="button"
                          onClick={refreshProducts}
                        >
                          Retry categories
                        </button>
                      </div>
                    )}

                    <div className="gd-guide-choices">
                      {categories.map((category) => (
                        <label key={category.name}>
                          <input
                            type="checkbox"
                            checked={answers.categories.includes(
                              category.name,
                            )}
                            onChange={() =>
                              toggleCategory(category.name)
                            }
                          />

                          <span>
                            {category.name}
                            <small>
                              {category.count} available{" "}
                              {category.count === 1
                                ? "product"
                                : "products"}
                            </small>
                          </span>
                        </label>
                      ))}

                      {categories.length > 1 && (
                        <label>
                          <input
                            type="checkbox"
                            checked={answers.kit}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                kit: event.target.checked,
                              }))
                            }
                          />

                          <span>
                            A complete gym kit
                            <small>
                              Start with a selection of
                              available essentials
                            </small>
                          </span>
                        </label>
                      )}
                    </div>

                    <button
                      className="gd-guide-text"
                      type="button"
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          categories: [],
                          kit: false,
                        }))
                      }
                    >
                      Not sure—help me choose
                    </button>

                    <p className="gd-guide-muted">
                      Supplements are shown only when
                      you select their category.
                    </p>
                  </>
                )}

                {step === 1 && (
                  <>
                    <p>
                      Maximum total shopping budget
                    </p>

                    <div className="gd-guide-presets">
                      {[
                        500,
                        1000,
                        2500,
                        5000,
                        10000,
                      ].map((value) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={
                            answers.budget === String(value)
                          }
                          onClick={() => {
                            setAnswers((current) => ({
                              ...current,
                              budget: String(value),
                            }));
                            setError("");
                          }}
                        >
                          {money(value)}
                        </button>
                      ))}

                      <button
                        type="button"
                        aria-pressed={!answers.budget}
                        onClick={() => {
                          setAnswers((current) => ({
                            ...current,
                            budget: "",
                          }));
                          setError("");
                        }}
                      >
                        No fixed budget
                      </button>
                    </div>

                    <label className="gd-guide-budget">
                      Custom maximum amount (INR)

                      <input
                        type="text"
                        inputMode="decimal"
                        maxLength={12}
                        value={answers.budget}
                        placeholder="For example, 1500"
                        aria-invalid={Boolean(error)}
                        aria-describedby="gd-guide-budget-help"
                        onChange={(event) => {
                          setAnswers((current) => ({
                            ...current,
                            budget: event.target.value,
                          }));
                          setError("");
                        }}
                      />
                    </label>

                    <p
                      id="gd-guide-budget-help"
                      className="gd-guide-muted"
                    >
                      We include the store’s standard
                      delivery estimate when matching
                      this budget. Final delivery charges
                      and availability are confirmed at
                      checkout. Items already in your bag
                      are separate.
                    </p>
                  </>
                )}

                {step === 2 && (
                  <div className="gd-guide-choices">
                    {FITNESS_GOALS.map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="radio"
                          name="fitness-goal"
                          value={key}
                          checked={answers.goal === key}
                          onChange={() =>
                            setAnswers((current) => ({
                              ...current,
                              goal: key,
                            }))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {error && (
                  <p
                    className="gd-guide-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <div className="gd-guide-question-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setError("");

                      if (step > 0) {
                        setStep(step - 1);
                      } else {
                        setView("intro");
                      }
                    }}
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    className="gd-guide-text"
                    onClick={skip}
                  >
                    Skip this question
                  </button>

                  <button
                    type="submit"
                    className="button"
                  >
                    {step === 2
                      ? "Show My Suggestions"
                      : "Next"}
                  </button>
                </div>
              </form>
            )}

            {view === "results" && (
              <>
                <h3 ref={heading} tabIndex={-1}>
                  Your GymDrobe suggestions
                </h3>

                <div className="gd-guide-summary">
                  <dl>
                    <div>
                      <dt>Looking for</dt>
                      <dd>
                        {[
                          ...answers.categories,
                          ...(answers.kit
                            ? ["A gym kit"]
                            : []),
                        ].join(", ") ||
                          "Open to suggestions"}
                      </dd>
                    </div>

                    <div>
                      <dt>Maximum budget</dt>
                      <dd>
                        {budget.paise == null
                          ? "No fixed budget"
                          : money(budget.paise / 100)}
                      </dd>
                    </div>

                    <div>
                      <dt>Fitness goal</dt>
                      <dd>
                        {FITNESS_GOALS.find(
                          ([key]) => key === answers.goal,
                        )?.[1] || "Not specified"}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    className="gd-guide-text"
                    onClick={edit}
                  >
                    Edit My Answers
                  </button>
                </div>

                {(loading ||
                  !loaded ||
                  (refreshing && !products.length)) &&
                !catalogError ? (
                  <p role="status">
                    Checking current products, prices
                    and availability…
                  </p>
                ) : catalogError ? (
                  <div role="alert">
                    <p>
                      We couldn’t refresh the products.
                      Your answers are still here.
                    </p>

                    <button
                      className="button secondary"
                      type="button"
                      onClick={refreshProducts}
                    >
                      Try Again
                    </button>
                  </div>
                ) : !result.rows.length ? (
                  <div className="gd-guide-empty">
                    <h4>
                      No suitable selection right now
                    </h4>

                    <p>
                      We couldn’t find available products
                      within these choices and the
                      estimated total budget. You can
                      change your answers or browse
                      the store.
                    </p>

                    <div className="gd-guide-actions">
                      <button
                        type="button"
                        className="button"
                        onClick={edit}
                      >
                        Edit My Answers
                      </button>

                      <Link
                        className="button secondary"
                        to="/shop"
                        onClick={close}
                      >
                        Browse Products
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    {refreshing && (
                      <p role="status">
                        Refreshing prices and availability…
                      </p>
                    )}

                    <div className="gd-guide-notice">
                      <strong>
                        {result.combined
                          ? "Build your own essentials."
                          : "Find your next gym essential."}
                      </strong>{" "}
                      {result.combined
                        ? "Explore these suggestions and add only what you need. Each product is sold separately."
                        : "These are individual options. Choose the products that suit you."}
                    </div>

                    <div className="gd-guide-results">
                      {result.rows.map((row) => (
                        <RecommendationItem
                          key={String(
                            productReference(row.product),
                          )}
                          row={row}
                          answers={answers}
                          onLeave={close}
                        />
                      ))}
                    </div>

                    <p className="gd-guide-muted">
                      Delivery is estimated separately.
                      Your final price, delivery eligibility
                      and stock are checked again at
                      checkout. No products are added
                      automatically.
                    </p>

                    <div className="gd-guide-actions">
                      <Link
                        className="button"
                        to="/cart"
                        onClick={close}
                      >
                        View My Bag
                      </Link>

                      {answers.kit && (
                        <Link
                          className="button secondary"
                          to="/kits"
                          onClick={close}
                        >
                          Explore Customisable Fitness Kits
                        </Link>
                      )}
                    </div>

                    {answers.kit && (
                      <p className="gd-guide-muted">
                        Fitness Kit templates have their
                        own contents, prices and delivery
                        arrangements. Review the total
                        in the kit builder before buying.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}