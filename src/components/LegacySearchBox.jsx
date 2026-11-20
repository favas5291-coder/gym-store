// The native app and internal dashboard keep their existing search interface.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import { Search, Clock3, ArrowRight, ShoppingBag, X } from "lucide-react";
import { createSearchIndex, searchCatalogue } from "../utils/smartSearch.js";
import { getTotalStock } from "../utils/cartUtils.js";
import { getDiscountedPrice } from "../utils/productPricing.js";
import PhotoSearchButton from "./PhotoSearchButton.jsx";

function Thumbnail({ src }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={35}
        height={44}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  return <ShoppingBag size={22} aria-hidden="true" />;
}

export default function LegacySearchBox({
  value,
  onChange,
  onSubmit,
  onPick,
  onNavigate,
  recent,
  onClearHistory,
  onClear,
  onOpen,
  routeKey,
  onRemember,
  onDismiss,
  placeholder = "Search for products, brands and more",
}) {
  const { products } = useCatalog();

  const container = useRef(null);
  const input = useRef(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [availableHeight, setAvailableHeight] = useState(300);

  const listId = useId();
  const [settledValue, setSettledValue] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setSettledValue(value.trim()), 240);
    return () => clearTimeout(timeout);
  }, [value]);
  const clean = value.trim();
  const settled = settledValue === clean ? settledValue : "";
  // Product search is optional on first paint. Build its index only after
  // a real query settles, then reuse it while the shopper keeps typing.
  const hasQuery = Boolean(settled);
  const index = useMemo(
    () => hasQuery ? createSearchIndex(products) : null,
    [products, hasQuery],
  );
  const searchData = useMemo(
    () => settled && index ? searchCatalogue(index, settled, { limit: 6 }) : null,
    [index, settled],
  );
  const matches = searchData?.products || [];

  const options = clean
    ? [
        ...matches.map((product) => ({
          type: "product",
          product,
          label: product.name,
          href: "/product/" + encodeURIComponent(String(product.id)),
        })),
        ...(searchData?.categories || []).slice(0, 3).map((category) => ({
          type: "category",
          label: "Category: " + category,
          query: category,
          href: "/shop?" + new URLSearchParams({ category }),
        })),
        ...(searchData?.brands || []).slice(0, 2).map((brand) => ({
          type: "brand",
          label: "Brand: " + brand,
          query: brand,
          href: "/shop?" + new URLSearchParams({ brand }),
        })),
        ...(searchData?.correctedQuery ? [{
          type: "query",
          label: "Search for “" + searchData.correctedQuery + "”",
          query: searchData.correctedQuery,
          href: "/shop?" + new URLSearchParams({ search: searchData.correctedQuery }),
        }] : []),
        {
          type: "query",
          label: "Search all results for “" + clean + "”",
          query: clean,
          href: "/shop?" + new URLSearchParams({ search: clean }),
        },
      ]
    : recent.map((query) => ({
        type: "query", label: query, query,
        href: "/shop?" + new URLSearchParams({ search: query }),
      }));

  function close() {
    setOpen(false);
    setActive(-1);
  }

  useEffect(() => {
    setOpen(false);
    setActive(-1);
  }, [routeKey]);

  useEffect(() => {
    function outside(event) {
      if (
        !container.current?.contains(event.target)
      ) {
        setOpen(false);
        setActive(-1);
      }
    }

    document.addEventListener(
      "pointerdown",
      outside,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        outside,
      );
    };
  }, []);

  // visualViewport is the keyboard-aware visible area in iOS Safari.
  // Keep the panel inside that area rather than using a full-screen vh guess.
  useEffect(() => {
    if (!open) return undefined;
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = container.current?.getBoundingClientRect();
        if (!rect) return;
        const visibleBottom = viewport
          ? viewport.offsetTop + viewport.height
          : window.innerHeight;
        const next = Math.max(0, Math.min(310, Math.floor(visibleBottom - rect.bottom - 12)));
        setAvailableHeight(old => old === next ? old : next);
      });
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [open]);

  function choose(option) {
    if (!option) return;

    if (option.type === "product") {
      onPick(option.product);
    } else if (["brand", "category"].includes(option.type)) {
      onNavigate(option.href);
    } else {
      onSubmit(option.query);
    }

    close();
  }

  function handleKey(event) {
    if (event.nativeEvent.isComposing) return;

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp"
    ) {
      event.preventDefault();
      onOpen();
      setOpen(true);

      if (!options.length) return;

      const direction =
        event.key === "ArrowDown" ? 1 : -1;

      const next =
        !open || active < 0
          ? direction === 1
            ? 0
            : options.length - 1
          : (
              active +
              direction +
              options.length
            ) % options.length;

      setActive(next);

      requestAnimationFrame(() => {
        const list = container.current?.querySelector(".gn-results ul");
        const option = document.getElementById(`${listId}-${next}`);
        if (!list || !option) return;
        // Scroll only the menu; never jump the page underneath the iOS keyboard.
        const item = option.getBoundingClientRect();
        const viewport = list.getBoundingClientRect();
        if (item.top < viewport.top) list.scrollTop += item.top - viewport.top;
        else if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom;
      });

      return;
    }

    if (
      event.key === "Enter" &&
      open &&
      active >= 0
    ) {
      event.preventDefault();
      choose(options[active]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      onDismiss?.();
      return;
    }

    if (event.key === "Tab") {
      close();
    }
  }

  return (
    <div
      className={`gn-search${open ? " gn-search-open" : ""}`}
      ref={container}
    >
      <form
        className="gn-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
          close();
          input.current?.blur();
        }}
      >
        <button
          className="gn-icon-button"
          type="submit"
          aria-label="Submit search"
        >
          <Search size={19} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Search products"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={120}
          value={value}
          placeholder={placeholder}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={
            open ? listId : undefined
          }
          aria-activedescendant={
            open &&
            active >= 0 &&
            active < options.length
              ? `${listId}-${active}`
              : undefined
          }
          onChange={(event) => {
            onChange(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => {
            onOpen();
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={handleKey}
        />

        <PhotoSearchButton restoreCamera />
        {value && (
          <button
            className="gn-icon-button"
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onClear();
              setActive(-1);
              input.current?.focus();
              setOpen(true);
            }}
          >
            <X size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      </form>

      {open && (
        <div className="gn-results" style={{ "--gn-search-available": `${availableHeight}px` }}>
          <div className="gn-result-title">
            <span>
              {clean
                ? "Product suggestions"
                : recent.length ? "Recent searches" : "Search the shop"}
            </span>

            <div className="gn-results-actions">
              {!clean && recent.length > 0 && (
                <button
                  className="gn-clear-history"
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={onClearHistory}
                >
                  Clear history
                </button>
              )}
              <button
                className="gn-dismiss-search"
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  close();
                  input.current?.blur();
                }}
              >
                Done
              </button>
            </div>
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label={
              clean
                ? "Search suggestions"
                : "Recent searches"
            }
          >
            {options.map((option, index) => (
              <li
                key={
                  option.type === "product"
                    ? `product-${option.product.id}`
                    : `query-${option.query}`
                }
                role="presentation"
              >
                <Link
                  to={option.href}
                  id={`${listId}-${index}`}
                  className="gn-option"
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === active}
                  onMouseDown={event => event.preventDefault()}
                  onPointerMove={(event) => {
                    if (
                      event.pointerType === "mouse"
                    ) {
                      setActive(index);
                    }
                  }}
                  onClick={() => {
                    // Keep the Link's native navigation; prevent blur-before-click.
                    if (option.type === "query") onRemember?.(option.query);
                    close();
                    input.current?.blur();
                  }}
                >
                  {option.type === "product" ? (
                    <Thumbnail
                      key={option.product.image}
                      src={option.product.image}
                    />
                  ) : (
                    clean
                      ? <Search size={17} strokeWidth={1.7} aria-hidden="true" />
                      : <Clock3 size={17} strokeWidth={1.7} aria-hidden="true" />
                  )}

                  <span className="gn-option-copy">
                    <strong>{option.label}</strong>

                    {option.type === "product" && (
                      <small>
                        {option.product.category}
                        {option.product.brand ? " · " + option.product.brand : ""}
                        {" · ₹" + getDiscountedPrice(option.product).toLocaleString("en-IN")}
                        {getTotalStock(option.product) <= 0 ? " · Out of stock" : ""}
                      </small>
                    )}
                  </span>

                  <ArrowRight size={16} strokeWidth={1.7} className="gn-option-arrow" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          {!options.length && (
            <p className="gn-search-hint">
              Try a product, brand or category,
              such as shoes, bottle or training.
            </p>
          )}

          {clean && settled && !matches.length && (
            <p className="gn-search-hint">
              No matching products yet. Search the shop or try another term.
            </p>
          )}
        </div>
      )}

      <span
        className="gn-sr"
        role="status"
      >
        {open && clean
          ? `${matches.length} product suggestions`
          : ""}
      </span>
    </div>
  );
}
