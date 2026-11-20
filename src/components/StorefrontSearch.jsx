import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, Clock3, Mic, Search, Tag, X } from "lucide-react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { getTotalStock } from "../utils/cartUtils.js";
import { getDiscountedPrice } from "../utils/productPricing.js";
import { createSearchIndex, searchCatalogue } from "../utils/smartSearch.js";
import PhotoSearchButton from "./PhotoSearchButton.jsx";
import "./StorefrontSearch.css";

const ProductPhoto = lazy(() => import("./StorefrontShared.jsx").then(module => ({ default: module.ProductImage })));
const searchPath = query => "/shop?" + new URLSearchParams({ search: query });

function categorySuggestions(products) {
  const counts = new Map();
  for (const product of products) {
    const category = product.category?.trim();
    if (category && product.isActive !== false && getTotalStock(product) > 0) {
      counts.set(category, (counts.get(category) || 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5)
    .map(([label]) => ({ type: "category", label, href: "/shop?" + new URLSearchParams({ category: label }) }));
}

function suggestions(query, result) {
  if (!result) return [];
  const products = result.products.map(product => ({
    type: "product", label: product.name, product, href: "/product/" + encodeURIComponent(product.id),
  }));
  const sections = [
    ...result.categories.slice(0, 2).map(label => ({ type: "category", label })),
    ...result.brands.slice(0, 1).map(label => ({ type: "brand", label })),
  ].map(item => ({ ...item, href: "/shop?" + new URLSearchParams({ [item.type]: item.label, search: query }) }));
  const phrases = [...new Set([result.correctedQuery, ...(result.suggestedQueries || [])])]
    .filter(phrase => phrase && phrase.toLowerCase() !== query.toLowerCase()).slice(0, 2)
    .map(label => ({ type: "phrase", label, href: searchPath(label), query: label }));
  return [...products, ...sections, ...phrases];
}

function VoiceSearch({ onText }) {
  const speech = useRef(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => () => {
    if (speech.current) {
      speech.current.onresult = speech.current.onerror = speech.current.onend = null;
      speech.current.abort();
    }
  }, []);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!window.isSecureContext || !Recognition) return null;
  function listen() {
    if (listening) { speech.current?.stop(); return; }
    try {
      const recognition = new Recognition();
      recognition.lang = document.documentElement.lang || "en-IN";
      speech.current = recognition;
      recognition.onresult = event => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) onText(transcript.slice(0, 120));
      };
      recognition.onerror = () => setMessage("Voice search is unavailable. Type your search.");
      recognition.onend = () => setListening(false);
      setMessage("");
      recognition.start();
      setListening(true);
    } catch {
      setMessage("Voice search is unavailable. Type your search.");
      setListening(false);
    }
  }
  return <><button type="button" onClick={listen} className="gs-alt-action" aria-pressed={listening}
    aria-label={listening ? "Stop listening" : "Search by voice"}>
    <Mic size={18} aria-hidden="true" />
  </button>{message && <span className="gs-voice-message" role="status">{message}</span>}</>;
}

export default function StorefrontSearch({
  value, onChange, onSubmit, onRemember, recent, onClearHistory, onRemoveRecent,
  onOpen, onDismiss, routeKey, placeholder,
}) {
  const { products, loading, error, refreshing, refreshProducts } = useCatalog();
  const navigate = useNavigate();
  const root = useRef(null);
  const input = useRef(null);
  const trigger = useRef(null);
  const list = useRef(null);
  const entryScroll = useRef(null);
  const listId = useId();
  const previousRoute = useRef(routeKey);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [space, setSpace] = useState(null);
  const query = value.trim();
  const index = useMemo(() => open ? createSearchIndex(products) : null, [open, products]);
  const result = useMemo(() => query && index ? searchCatalogue(index, query, { limit: 4 }) : null, [index, query]);
  const categories = useMemo(() => open && !query && !recent.length ? categorySuggestions(products) : [],
    [open, query, products, recent.length]);
  const waiting = !products.length && (loading || refreshing);
  const unavailable = !products.length && error && !waiting;
  const entries = query ? suggestions(query, result) : recent.length
    ? recent.map(label => ({ type: "recent", label, query: label, href: searchPath(label) })) : categories;
  if (query && !waiting && !unavailable) {
    if (!entries.length) {
      const broader = result?.broaderQuery;
      entries.push({ type: "broaden", label: broader ? 'Search for “' + broader + '” without this filter' : "Browse all products",
        href: broader ? searchPath(broader) : "/shop", query: broader || undefined });
    }
    entries.push({ type: "all", label: 'See all results for “' + query + '”', query, href: searchPath(query) });
  }

  useLayoutEffect(() => {
    function resume(event) {
      const { query: draft = "", focused, selectionStart, selectionEnd } = event.detail || {};
      onChange(draft);
      if (focused) {
        input.current.focus({ preventScroll: true });
        if (Number.isInteger(selectionStart)) {
          requestAnimationFrame(() => input.current?.setSelectionRange(selectionStart, selectionEnd ?? selectionStart));
        }
      }
    }
    window.addEventListener("gymdrobe:resume-search", resume);
    return () => window.removeEventListener("gymdrobe:resume-search", resume);
  }, [onChange]);

  useLayoutEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const measure = () => {
      const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
      setSpace(Math.max(0, Math.floor(bottom - root.current.getBoundingClientRect().bottom)));
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    document.documentElement.classList.add("gs-searching");
    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      document.documentElement.classList.remove("gs-searching");
    };
  }, [open]);

  useEffect(() => {
    if (previousRoute.current !== routeKey) {
      previousRoute.current = routeKey;
      setOpen(false);
      setActive(-1);
      entryScroll.current = null;
    }
  }, [routeKey]);
  useEffect(() => {
    if (!open) return;
    const outside = event => {
      if (root.current?.contains(event.target)) return;
      setOpen(false);
      setActive(-1);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function activate() {
    if (!open) {
      entryScroll.current = [window.scrollX, window.scrollY];
      onOpen();
      setActive(-1);
      setOpen(true);
    }
  }

  function dismiss() {
    setOpen(false);
    setActive(-1);
    input.current.blur();
    trigger.current.focus({ preventScroll: true });
    onDismiss();
    if (entryScroll.current) {
      const [left, top] = entryScroll.current;
      if (window.scrollX !== left || window.scrollY !== top) window.scrollTo({ left, top, behavior: "instant" });
    }
  }

  function saveDraft() {
    // React Router owns the rest of the history entry, including the scroll key.
    window.history.replaceState({ ...window.history.state, gymdrobeSearchDraft: value }, "");
  }

  function finish() {
    saveDraft();
    input.current.blur();
    setOpen(false);
    setActive(-1);
  }

  function navigateTo(option) {
    finish();
    if (option.query) onRemember(option.query);
    navigate(option.href);
  }

  function setQuery(next) {
    onChange(next);
    setActive(-1);
    if (list.current) list.current.scrollTop = 0;
  }

  function handleKey(event) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && active >= 0 && open && entries[active]) {
      event.preventDefault();
      navigateTo(entries[active]);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      activate();
      if (!entries.length) return;
      const next = event.key === "ArrowDown" ? (active + 1) % entries.length :
        (active < 0 ? entries.length - 1 : (active + entries.length - 1) % entries.length);
      setActive(next);
      const row = document.getElementById(listId + "-" + next);
      if (row && list.current) {
        const rect = row.getBoundingClientRect();
        const bounds = list.current.getBoundingClientRect();
        if (rect.top < bounds.top) list.current.scrollTop += rect.top - bounds.top;
        else if (rect.bottom > bounds.bottom) list.current.scrollTop += rect.bottom - bounds.bottom;
      }
    }
  }

  const caption = query ? "Search suggestions" : recent.length ? "Recent searches" : "Shop by category";
  const noMatches = query && !waiting && !unavailable && result && !result.products.length;
  return <div ref={root} className={"gn-search gs-search" + (open ? " gn-search-open" : "")}
    onBlur={event => {
      if (event.relatedTarget && !root.current.contains(event.relatedTarget)) setOpen(false);
    }}
    onKeyDown={event => {
      if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); }
    }}>
    <div className="gs-input-row">
      <form className="gn-form" action="/shop" role="search" onSubmit={event => {
        event.preventDefault();
        if (!query) { input.current.focus(); return; }
        finish();
        onSubmit(query);
      }}>
        <button type="button" ref={trigger} className="gn-icon-button gs-focus" aria-label="Focus search"
          onClick={() => { input.current.focus({ preventScroll: true }); activate(); }}>
          <Search size={20} strokeWidth={1.7} aria-hidden="true" />
        </button>
        <input ref={input} data-storefront-search="" name="search" type="search" role="combobox"
          aria-label="Search products" aria-autocomplete="list" aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && entries[active] ? listId + "-" + active : undefined}
          placeholder={placeholder} autoComplete="off" autoCapitalize="none" spellCheck={false}
          enterKeyHint="search" maxLength={120} value={value}
          onClick={activate} onFocus={activate} onChange={event => { activate(); setQuery(event.target.value); }} onKeyDown={handleKey} />
        {value && <button type="button" className="gn-icon-button" aria-label="Clear search"
          onMouseDown={event => event.preventDefault()}
          onClick={() => { setQuery(""); input.current.focus({ preventScroll: true }); activate(); }}>
          <X size={17} aria-hidden="true" />
        </button>}
      </form>
      {open && <button type="button" className="gs-cancel" onMouseDown={event => event.preventDefault()} onClick={dismiss}>Cancel</button>}
    </div>
    {open && <div className="gn-results gs-results" style={space == null ? undefined : { "--gs-space": space + "px" }}>
      <div className="gs-panel-head">
        <h2>{caption}</h2>
        {!query && recent.length > 0 && <button type="button" className="gs-clear-all"
          onMouseDown={event => event.preventDefault()} onClick={onClearHistory}>Clear all</button>}
        {!query && <div className="gs-alternatives">
          <PhotoSearchButton restoreCamera />
          <VoiceSearch onText={next => { setQuery(next); input.current.focus({ preventScroll: true }); }} />
        </div>}
      </div>
      <div className="gs-scroll" ref={list}>
        {waiting && <p className="gs-message" role="status">Loading products…</p>}
        {unavailable && <div className="gs-message" role="status">Couldn’t load products.
          <button type="button" onClick={() => refreshProducts()}>Retry</button>
        </div>}
        {noMatches && <p className="gs-message">No products match “{query}”.</p>}
        {!waiting && !unavailable && !query && !entries.length && <p className="gs-message">No products available yet.</p>}
        <ul id={listId} role="listbox" aria-label={caption}>
          {entries.map((option, i) => <li role="presentation" key={option.type + option.href}>
            <Link role="option" aria-selected={i === active} id={listId + "-" + i} tabIndex={-1}
              className={"gn-option gs-" + option.type} to={option.href}
              onMouseDown={event => event.preventDefault()}
              onPointerMove={event => { if (event.pointerType === "mouse") setActive(i); }}
              onClick={event => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                finish();
                if (option.query) onRemember(option.query);
              }}>
              {option.product ? <span className="gs-thumbnail">
                <Suspense fallback={null}><ProductPhoto product={option.product} homeGear decorative eager sizes="48px" /></Suspense>
              </span> : option.type === "recent" ? <Clock3 size={17} /> :
                option.type === "category" || option.type === "brand" ? <Tag size={17} /> : <Search size={17} />}
              <span className="gs-copy">
                <strong>{option.label}</strong>
                {option.product && <small>₹{getDiscountedPrice(option.product).toLocaleString("en-IN")}
                  {getTotalStock(option.product) <= 0 ? " · Out of stock" : ""}</small>}
              </span>
              {option.type === "brand" || (query && option.type === "category") ?
                <span className="gs-option-kind">{option.type === "brand" ? "Brand" : "Category"}</span> : null}
              {option.type !== "recent" && (option.type === "all" ? <ArrowRight size={18} /> : <ChevronRight size={16} />)}
            </Link>
            {option.type === "recent" && <button type="button" className="gs-remove"
              aria-label={"Remove " + option.label} onMouseDown={event => event.preventDefault()}
              onClick={() => { onRemoveRecent(option.label); setActive(-1); input.current.focus({ preventScroll: true }); }}>
              <X size={16} aria-hidden="true" />
            </button>}
          </li>)}
        </ul>
      </div>
    </div>}
    <span className="gn-sr" role="status" aria-live="polite">{open && query && !waiting && !unavailable
      ? (result?.products.length || 0) + " product suggestions" : ""}</span>
  </div>;
}
