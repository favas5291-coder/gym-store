import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { transformWithOxc } from "vite";

import * as images from "../src/utils/productImages.js";
import * as cart from "../src/utils/cartUtils.js";
import * as purchase from "../src/utils/productPurchase.js";
import * as pricing from "../src/utils/productPricing.js";
import * as information from "../src/utils/productInformation.js";

import {
  draftFor,
  payloadFor,
  validateDraft,
  conflictFor,
} from "../src/utils/adminProductDraft.js";

const id = "507f1f77bcf86cd799439011";

function fixture() {
  return {
    id,
    name: "Fixture shirt",
    category: "Clothing",
    brand: "Fixture brand",
    price: 500,
    stock: 12,
    discount: 0,
    image: "/default.jpg",
    images: ["/default.jpg", "/default-back.jpg"],
    sizes: ["M", "L"],
    colors: ["Black", "Blue", "White"],

    variants: {
      Black: { M: 3, L: 3 },
      Blue: { M: 0, L: 3 },
      White: { M: 3, L: 0 },
    },

    colorImages: [
      {
        color: "Black",
        images: [
          "/black.jpg",
          "/shared-size-chart.jpg",
        ],
      },
      {
        color: "Blue",
        images: [
          "/blue.jpg",
          "/shared-size-chart.jpg",
        ],
      },
    ],
  };
}

const h = (type, props, ...children) => ({
  type,
  props: props || {},
  children: children.flat(Infinity),
});

const nodes = (tree) =>
  tree && typeof tree === "object"
    ? [tree, ...tree.children.flatMap(nodes)]
    : [];

const text = (tree) =>
  tree && typeof tree === "object"
    ? tree.children.map(text).join(" ")
    : String(tree ?? "");

async function compiled(
  file,
  names,
  globals = {},
) {
  const raw = await fs.readFile(
    new URL(`../src/${file}`, import.meta.url),
    "utf8",
  );

  // Normalize Windows CRLF, older CR and UTF-8 BOM
  // before removing imports for the isolated test.
  const source = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(
      /^import[\s\S]*?;(?:\n|$)/gm,
      "",
    )
    .replace(
      /export default function/g,
      "function",
    );

  const output = await transformWithOxc(
    source,
    file,
    {
      jsx: {
        runtime: "classic",
        pragma: "h",
        pragmaFrag: "Fragment",
      },
    },
  );

  const module = { exports: {} };

  vm.runInNewContext(
    output.code +
      `\nmodule.exports = { ${names} };`,
    {
      ...globals,
      module,
    },
  );

  return module.exports;
}

function hooks() {
  const states = [];
  const refs = [];
  const effects = [];

  let si = 0;
  let ri = 0;
  let ei = 0;

  return {
    reset() {
      si = 0;
      ri = 0;
      ei = 0;
    },

    run() {
      for (const row of effects) {
        if (row.pending) {
          row.old?.();
          row.pending = false;
          row.cleanup = row.fn();
        }
      }
    },

    useState(value) {
      const index = si++;

      if (!(index in states)) {
        states[index] =
          typeof value === "function"
            ? value()
            : value;
      }

      return [
        states[index],
        (next) => {
          states[index] =
            typeof next === "function"
              ? next(states[index])
              : next;
        },
      ];
    },

    useRef(value) {
      return (
        refs[ri++] ||= {
          current: value,
        }
      );
    },

    useEffect(fn, deps) {
      const index = ei++;
      const before = effects[index];

      if (
        !before ||
        deps.some(
          (value, position) =>
            !Object.is(
              value,
              before.deps[position],
            ),
        )
      ) {
        effects[index] = {
          fn,
          deps,
          old: before?.cleanup,
          pending: true,
        };
      }
    },
  };
}

const common = {
  ...images,
  ...cart,
  ...purchase,
  ...pricing,
  ...information,

  h,
  Fragment: "fragment",
  Link: "Link",
  ProductImage: "ProductImage",
  Modal: "Modal",
  Heart: "Heart",
  VirtualTryOnButton: "VirtualTryOnButton",
  FitGuide: "FitGuide",
  ProductOptions: "ProductOptions",
  DeliveryPincode: "DeliveryPincode",
  ProductReviews: "ProductReviews",
  ProductVideo: "ProductVideo",
  ProductVideoField: "ProductVideoField",
  RecentlyViewed: "RecentlyViewed",
  ProductRow: "ProductRow",

  URLSearchParams,

  useSearchParams: () => [
    new URLSearchParams(),
    () => {},
  ],

  useCallback: (fn) => fn,
  useId: () => "fixture-id",
  useNavigate: () => () => {},

  categoryPath: () => "/shop",
  resolveProductImage: (value) => value,
  readStorage: (key, fallback) => fallback,
  writeStorage: () => true,
  trackProductView() {},
  rankRelated: () => [],

  useProductReviews: () => ({
    rating: 0,
    count: 0,
  }),

  window: {
    addEventListener() {},
    removeEventListener() {},
  },

  STANDARD_SHIPPING: 99,
  EXPRESS_SHIPPING: 199,
  FREE_SHIPPING_LIMIT: 500,
};

async function optionsHarness(
  product,
  onColorChange = () => {},
) {
  const state = hooks();
  const bought = [];

  const store = {
    watches: [],
    wishlist: [],
    cart: [],
    latestCart: () => [],
    shoppingKey: (key) => key,

    addToCart: async (...args) => {
      bought.push(args);
      return true;
    },

    buyNow: async () => true,
    toggleWishlist() {},
  };

  const module = await compiled(
    "components/ProductOptions.jsx",
    "ProductOptionsContent",
    {
      ...common,
      ...state,

      useStore: () => store,

      useShoppingTools: () => ({
        watches: [],
      }),

      useCatalog: () => ({
        products: [product],
        catalogReady: true,
        getLatestProducts: () => [product],
      }),
    },
  );

  return {
    bought,

    render() {
      state.reset();

      const tree =
        module.ProductOptionsContent({
          product,
          onColorChange,
        });

      state.run();
      return tree;
    },
  };
}

const button = (tree, label) =>
  nodes(tree).find(
    (row) =>
      row.type === "button" &&
      row.props["aria-label"] === label,
  );

test(
  "frontend validates hosted photo paths and preserves default fallbacks",
  () => {
    for (const value of [
      "/shirt.jpg",
      "https://cdn.example.test/blue.jpg",
      "../assets/blue.jpg",
    ]) {
      assert.equal(
        images.isProductImageSource(value),
        true,
      );
    }

    for (const value of [
      "file:///a.jpg",
      "javascript:alert(1)",
      "//evil.test/a.jpg",
      "http://localhost/a.jpg",
    ]) {
      assert.equal(
        images.isProductImageSource(value),
        false,
      );
    }

    assert.deepEqual(
      images.productImageSources(
        fixture(),
        "White",
      ),
      ["/default.jpg", "/default-back.jpg"],
    );

    assert.equal(
      images.productImageSources({
        image: "blob:preview-only",
      })[0],
      "blob:preview-only",
    );
  },
);

test(
  "admin drafts load, replace and clear colour photos without changing inventory",
  () => {
    const original = draftFor(fixture());

    assert.match(
      original.colorImagesText.Blue,
      /blue.jpg/,
    );

    const changed = {
      ...original,
      colorImagesText: {
        ...original.colorImagesText,
        Blue: "/blue-new.jpg\n/blue-side.jpg",
      },
    };

    const patch = payloadFor(
      changed,
      original,
    );

    assert.equal(
      patch.colorImages[1].images[0],
      "/blue-new.jpg",
    );

    assert.equal(
      Object.hasOwn(patch, "variants"),
      false,
    );

    assert.equal(
      Object.hasOwn(
        payloadFor(original, original),
        "colorImages",
      ),
      false,
    );

    assert.equal(
      payloadFor(
        {
          ...original,
          colorImagesText: {},
        },
        original,
      ).colorImages.length,
      0,
    );

    const removed = payloadFor(
      {
        ...original,
        colorsText: "Black, White",
      },
      original,
    );

    assert.equal(
      removed.colorImages.some(
        (row) => row.color === "Blue",
      ),
      false,
    );

    assert.throws(() =>
      payloadFor(
        {
          ...changed,
          colorImagesText: {
            Blue: "javascript:alert(1)",
          },
        },
        original,
      ),
    );

    assert.match(
      validateDraft({
        ...changed,
        colorImagesText: {
          Blue: "file:///a.jpg",
        },
      }),
      /Blue/,
    );
  },
);

test(
  "concurrent admin photo edits are detected rather than silently overwriting galleries",
  () => {
    const product = fixture();
    const original = draftFor(product);

    const changed = {
      ...original,
      colorImagesText: {
        ...original.colorImagesText,
        Blue: "/edit.jpg",
      },
    };

    product.colorImages[1].images = [
      "/someone-else.jpg",
    ];

    assert.match(
      conflictFor(
        changed,
        original,
        product,
      ),
      /colorImages.*changed/,
    );
  },
);

test(
  "sizes share colour photos and cart storage refresh preserves the selected thumbnail",
  () => {
    const first = cart.normalizeCartItem(
      fixture(),
      1,
      "M",
      "Black",
    );

    const second = cart.normalizeCartItem(
      fixture(),
      1,
      "L",
      "Black",
    );

    assert.equal(first.image, "/black.jpg");
    assert.deepEqual(first.images, second.images);

    const blue = cart.normalizeCartItem(
      fixture(),
      1,
      "L",
      "Blue",
    );

    const stored = JSON.parse(
      JSON.stringify(blue),
    );

    const refreshed = cart.revalidateCart(
      [stored],
      [fixture()],
    ).cart[0];

    assert.equal(
      refreshed.image,
      "/blue.jpg",
    );

    assert.equal(
      refreshed.selectedColor,
      "Blue",
    );

    assert.equal(
      images.selectedProductImage(
        {
          image: "/historic.jpg",
          selectedColor: "Blue",
        },
        "Blue",
      ),
      "/historic.jpg",
    );
  },
);

test(
  "actual colour controls reset an unavailable size and refuse purchase until another size is chosen",
  async () => {
    const selected = [];

    const app = await optionsHarness(
      fixture(),
      (color) => selected.push(color),
    );

    let tree = app.render();

    assert.equal(
      button(
        tree,
        "Colour Black",
      ).props["aria-pressed"],
      true,
    );

    button(tree, "Size M").props.onClick();
    tree = app.render();

    button(tree, "Colour Blue").props.onClick();
    tree = app.render();

    assert.equal(selected.at(-1), "Blue");

    assert.match(
      text(tree),
      /Choose an available size for Blue/,
    );

    const add = () =>
      nodes(tree).find(
        (row) =>
          row.type === "button" &&
          row.props.className === "button",
      );

    await add().props.onClick();

    assert.equal(app.bought.length, 0);
    tree = app.render();

    assert.equal(
      button(
        tree,
        "Size M, unavailable for this selection",
      ).props.disabled,
      true,
    );

    button(tree, "Size L").props.onClick();
    tree = app.render();

    assert.equal(
      add().props.disabled,
      false,
    );

    await add().props.onClick();

    assert.equal(app.bought.length, 1);
    assert.equal(app.bought[0][2], "L");
    assert.equal(app.bought[0][3], "Blue");
  },
);

test(
  "an available size is retained and out-of-stock colours remain previewable without enabling purchase",
  async () => {
    const product = fixture();

    product.colors.push("Red");
    product.variants.Red = { M: 0, L: 0 };

    const app = await optionsHarness(product);
    let tree = app.render();

    button(tree, "Size M").props.onClick();
    tree = app.render();

    button(tree, "Colour White").props.onClick();
    tree = app.render();

    assert.equal(
      button(
        tree,
        "Size M",
      ).props["aria-pressed"],
      true,
    );

    const red = button(
      tree,
      "Colour Red, out of stock",
    );

    assert.equal(red.props.disabled, false);

    red.props.onClick();
    tree = app.render();

    assert.equal(
      button(
        tree,
        "Colour Red, out of stock",
      ).props["aria-pressed"],
      true,
    );

    assert.equal(
      nodes(tree).find(
        (row) =>
          row.type === "button" &&
          row.props.className === "button",
      ).props.disabled,
      true,
    );
  },
);

test(
  "product gallery changes immediately, resets a shared selected thumbnail and falls back to default photos",
  async () => {
    const state = hooks();
    const product = fixture();

    const module = await compiled(
      "pages/ProductPage.jsx",
      "ProductDetail",
      {
        ...common,
        ...state,

        useShoppingTools: () => ({
          compared: [],
        }),

        useStore: () => ({
          shoppingKey: (key) => key,
          notify() {},
        }),
      },
    );

    const render = () => {
      state.reset();

      const tree = module.ProductDetail({
        product,
        products: [product],
      });

      state.run();
      return tree;
    };

    const main = (tree) =>
      nodes(tree).find(
        (row) =>
          row.type === "button" &&
          row.props.className === "main-photo",
      ).children[0].props.product.image;

    const choose = (tree, color) =>
      nodes(tree).find(
        (row) =>
          row.type === "ProductOptions",
      ).props.onColorChange(color);

    let tree = render();

    assert.equal(main(tree), "/black.jpg");

    button(
      tree,
      "View Black photo 2",
    ).props.onClick();

    tree = render();

    assert.equal(
      main(tree),
      "/shared-size-chart.jpg",
    );

    choose(tree, "Blue");
    tree = render();

    assert.equal(main(tree), "/blue.jpg");
    assert.ok(button(tree, "View Blue photo 2"));

    choose(tree, "White");
    tree = render();

    assert.equal(main(tree), "/default.jpg");
    assert.ok(button(tree, "View White photo 2"));

    assert.equal(
      button(tree, "View Blue photo 2"),
      undefined,
    );

    assert.match(
      text(tree),
      /Showing default product photos/,
    );

    choose(tree, "Black");
    tree = render();

    assert.equal(main(tree), "/black.jpg");
  },
);

test(
  "admin editor labels each colour, previews its first photo and supports clearing",
  async () => {
    let draft = draftFor(fixture());

    const module = await compiled(
      "components/ProductColorImagesEditor.jsx",
      "ProductColorImagesEditor",
      { ...common },
    );

    const render = () =>
      module.ProductColorImagesEditor({
        draft,
        setDraft: (fn) => {
          draft = fn(draft);
        },
      });

    let tree = render();

    assert.match(
      text(tree),
      /Every size of the same colour shares/,
    );

    assert.equal(
      nodes(tree).filter(
        (row) => row.type === "textarea",
      ).length,
      3,
    );

    nodes(tree)
      .filter(
        (row) => row.type === "textarea",
      )[1]
      .props.onChange({
        target: { value: "" },
      });

    tree = render();

    assert.equal(
      draft.colorImagesText.Blue,
      "",
    );

    assert.match(
      text(tree),
      /Uses default product photos/,
    );
  },
);

test(
  "mobile gallery and admin controls provide scrolling thumbnails and touch-sized controls",
  async () => {
    const css = await fs.readFile(
      new URL(
        "../src/components/ProductColorImages.css",
        import.meta.url,
      ),
      "utf8",
    );

    assert.match(
      css,
      /thumbnails[^}]*overflow-x: auto/s,
    );

    assert.match(css, /min-height: 44px/);
    assert.match(css, /max-width: 600px/);

    const app = await optionsHarness(fixture());
    const tree = app.render();

    assert.equal(
      button(
        tree,
        "Colour Blue",
      ).props.style.minHeight,
      44,
    );
  },
);

test(
  "a refreshed colour URL restores the gallery and does not silently select an unavailable size",
  async () => {
    const state = hooks();
    const product = fixture();

    const module = await compiled(
      "pages/ProductPage.jsx",
      "ProductDetail",
      {
        ...common,
        ...state,

        useSearchParams: () => [
          new URLSearchParams("colour=Blue"),
          () => {},
        ],

        useShoppingTools: () => ({
          compared: [],
        }),

        useStore: () => ({
          shoppingKey: (key) => key,
          notify() {},
        }),
      },
    );

    state.reset();

    const tree = module.ProductDetail({
      product,
      products: [product],
    });

    const main = nodes(tree).find(
      (node) =>
        node.type === "button" &&
        node.props.className === "main-photo",
    );

    assert.equal(
      main.children[0].props.product.image,
      "/blue.jpg",
    );

    const options = nodes(tree).find(
      (node) =>
        node.type === "ProductOptions",
    );

    assert.equal(
      options.props.product.selectedColor,
      "Blue",
    );

    const app = await optionsHarness(
      options.props.product,
    );

    const controls = app.render();

    assert.equal(
      button(
        controls,
        "Colour Blue",
      ).props["aria-pressed"],
      true,
    );

    assert.match(
      text(controls),
      /Choose an available size/,
    );
  },
);

test(
  "quick view starts with a saved colour and follows its colour selector without changing other cards",
  async () => {
    const state = hooks();

    const product = {
      ...fixture(),
      selectedColor: "Blue",
    };

    const module = await compiled(
      "components/ProductCard.jsx",
      "ProductCard",
      {
        ...common,
        ...state,

        inStock: () => true,

        productPath: (id) =>
          `/product/${id}`,

        priceDetails: () => ({
          valid: true,
          price: 500,
          selling: 500,
          discount: 0,
        }),

        useShoppingTools: () => ({
          compared: [],
        }),

        useStore: () => ({
          wishlist: [],
          toggleWishlist() {},
        }),
      },
    );

    const render = () => {
      state.reset();

      const tree = module.ProductCard({
        product,
      });

      state.run();
      return tree;
    };

    let tree = render();

    const open = button(
      tree,
      "Quick add Fixture shirt",
    );

    assert.ok(open);
    open.props.onClick();

    tree = render();

    const modal = nodes(tree).find(
      (row) => row.type === "Modal",
    );

    assert.equal(
      nodes(modal).find(
        (row) => row.type === "ProductImage",
      ).props.product.selectedColor,
      "Blue",
    );

    nodes(modal)
      .find(
        (row) => row.type === "ProductOptions",
      )
      .props.onColorChange("White");

    tree = render();

    const updated = nodes(tree).find(
      (row) => row.type === "Modal",
    );

    assert.equal(
      nodes(updated).find(
        (row) => row.type === "ProductImage",
      ).props.product.selectedColor,
      "White",
    );

    updated.props.onClose();
    tree = render();

    button(
      tree,
      "Quick add Fixture shirt",
    ).props.onClick();

    tree = render();

    const reopened = nodes(tree).find(
      (row) => row.type === "Modal",
    );

    assert.equal(
      nodes(reopened).find(
        (row) => row.type === "ProductImage",
      ).props.product.selectedColor,
      "Blue",
    );
  },
);