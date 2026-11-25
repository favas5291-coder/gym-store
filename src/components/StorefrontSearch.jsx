import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, Clock3, Mic, Search, Tag, X } from "lucide-react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { productDepartment, normalizeCatalogText } from "../utils/catalog.js";
import { indexForCatalogue, matchingOffer, searchCatalogue } from "../utils/smartSearch.js";
import PhotoSearchButton from "./PhotoSearchButton.jsx";
import { ProductImage } from "./StorefrontShared.jsx";
import "./StorefrontSearch.css";

const searchPath = query => "/shop?" + new URLSearchParams({ search: query });

function categoryLabel(value) {
  // Keep catalogue keys intact in links; legacy categories were often entered in capitals.
  return value.replace(/\b[A-Z]{2,}\b/g, word =>
    /^(BCAA|EAA|HIIT|UV|XL|XXL)$/.test(word) ? word : word[0] + word.slice(1).toLowerCase());
}

const hintLabels = new Map([["bag", "Gym bags"], ["compression t-shirt", "Compression T-shirts"]]);

function categorySuggestions(products) {
  const groups = new Map();
  for (const product of products) {
    const key = product?.category?.trim();
    if (!key || product.isActive === false) continue;
    const offer = matchingOffer(product);
    if (!offer?.available || !(offer.price > 0)) continue;
    const id = normalizeCatalogText(key);
    const entry = groups.get(id) || { key, department: productDepartment(product), count: 0 };
    entry.count++;
    groups.set(id, entry);
  }
  const ranked = [...groups.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const firstByDepartment = ["workout", "accessories", "shoes", "hydration", "supplements"]
    .map(department => ranked.find(entry => entry.department === department)).filter(Boolean);
  return [...new Set([...firstByDepartment, ...ranked])].slice(0, 5).map(({ key }) => ({
    type: "category",
    label: hintLabels.get(key.toLowerCase()) || categoryLabel(key),
    href: "/shop?" + new URLSearchParams({ category: key }),
  }));
}

function IdleHint({ categories, rotate }) {
  const [position, setPosition] = useState(0);
  useEffect(() => {
    if (!rotate || position >= categories.length - 1) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    let timer;
    function schedule() {
      clearTimeout(timer);
      if (!motion.matches && !document.hidden && !root.hasAttribute("data-home-boot")) {
        timer = setTimeout(() => setPosition(position + 1), 4000);
      }
    }
    const handoff = new MutationObserver(schedule);
    if (root.hasAttribute("data-home-boot")) handoff.observe(root, { attributes: true, attributeFilter: ["data-home-boot"] });
    motion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      clearTimeout(timer);
      handoff.disconnect();
      motion.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [categories, position, rotate]);

  const index = Math.min(position, categories.length - 1);
  return <span className="gs-idle-hint" aria-hidden="true">
    Search for <span className="gs-terms" key={categories[index].href}>
      {index > 0 && <span className="gs-outgoing">{categories[index - 1].label}</span>}
      <strong className={index > 0 ? "gs-incoming" : undefined}>{categories[index].label}</strong>
    </span>
  </span>;
}

function suggestions(query, result) {
  if (!result) return [];
  const products = result.matches.map(({ product, price, available }) => ({
    type: "product", label: product.name, product, price, available, href: "/product/" + encodeURIComponent(product.id),
  }));
  const sections = [
    ...result.categories.slice(0, 2).map(label => ({ type: "category", label })),
    ...result.brands.slice(0, 1).map(label => ({ type: "brand", label })),
  ].map(item => ({
    ...item, label: item.type === "category" ? categoryLabel(item.label) : item.label,
    href: "/shop?" + new URLSearchParams({ [item.type]: item.label, search: query }),
  }));
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
  const { products, homeProducts, ensureProducts, loading, error, refreshing, refreshProducts } = useCatalog();
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
  const hintProducts = products.length ? products : homeProducts;
  const index = useMemo(() => open ? indexForCatalogue(hintProducts) : null, [open, hintProducts]);
  const result = useMemo(() => query && index ? searchCatalogue(index, query, { limit: 4 }) : null, [index, query]);
  const categories = useMemo(() => categorySuggestions(hintProducts), [hintProducts]);
  const [interacted, setInteracted] = useState(false);
  const showHint = !open && !value && categories.length > 0;
  const waiting = !products.length && (loading || refreshing);
  const unavailable = !products.length && error && !waiting;
  const entries = query ? suggestions(query, result) : recent.length
    ? [...recent.map(label => ({ type: "recent", label, query: label, href: searchPath(label) })),
      ...categories.slice(0, Math.max(0, Math.min(2, Math.floor(((space || 0) - 48) / 52) - recent.length)))] : categories;
  if (query && !waiting && !unavailable) {
    if (!entries.length) {
      const broader = result?.broaderQuery;
      const relatedCategory = result?.related[0];
      if (broader) {
        entries.push({ type: "broaden", label: 'Search for “' + broader + '” without this filter',
          href: searchPath(broader), query: broader });
      } else if (relatedCategory) {
        entries.push({ type: "broaden", label: "Browse all " + categoryLabel(relatedCategory),
          href: "/shop?" + new URLSearchParams({ category: relatedCategory }) });
      } else {
        entries.push({ type: "broaden", label: "Browse all products", href: "/shop" });
      }
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
      ensureProducts();
      entryScroll.current = [window.scrollX, window.scrollY];
      setInteracted(true);
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
    try {
      window.history.replaceState({ ...window.history.state, gymdrobeSearchDraft: value }, "");
    } catch {
      // Some browser modes restrict history writes; navigating to the product still works.
    }
  }

  useEffect(() => {
    if (!open) return;
    const hidden = () => { if (document.hidden) saveDraft(); };
    const timer = setTimeout(saveDraft, 160);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", saveDraft);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", saveDraft);
    };
  }, [open, value]);

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
      if (open && event.key === "Escape" && !event.target.closest("dialog")) {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    }}>
    <div className="gs-input-row">
      <form className="gn-form" action="/shop" role="search"
        onClick={event => {
          if (event.target === event.currentTarget) input.current.focus({ preventScroll: true });
        }} onSubmit={event => {
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
          placeholder={showHint ? "" : placeholder} autoComplete="off" autoCapitalize="none" spellCheck={false}
          enterKeyHint="search" maxLength={120} value={value}
          onClick={activate} onFocus={activate} onChange={event => { activate(); setQuery(event.target.value); }} onKeyDown={handleKey} />
        {showHint && <IdleHint categories={categories} rotate={!interacted} />}
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
        {waiting && !(query ? result?.matches.length : categories.length || recent.length) && <p className="gs-message" role="status">Loading products…</p>}
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
                <ProductImage product={option.product} homeGear decorative eager sizes="48px" />
              </span> : option.type === "recent" ? <Clock3 size={17} /> :
                option.type === "category" || option.type === "brand" ? <Tag size={17} /> : <Search size={17} />}
              <span className="gs-copy">
                <strong>{option.label}</strong>
                {option.product && <small>{option.price == null ? "Price unavailable" : "₹" + option.price.toLocaleString("en-IN")}
                  {option.product.gender && <span className="gs-variant"> · {option.product.gender}</span>}
                  {!option.available ? " · Out of stock" : ""}</small>}
              </span>
              {option.type === "brand" || ((query || recent.length > 0) && option.type === "category") ?
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
