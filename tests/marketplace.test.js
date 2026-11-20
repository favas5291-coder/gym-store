import test from "node:test";
import assert from "node:assert/strict";
import {parsePaise,marketplaceRequest} from "../src/services/marketplaceApi.js";
import {getOriginalPrice,getDiscountedPrice} from "../src/utils/productPricing.js";
import {normalizeCartItem, revalidateCart, validateCartItem} from "../src/utils/cartUtils.js";
import {reviewCart} from "../src/utils/cartReview.js";
import {previewBagVariant} from "../src/utils/bagVariantEditing.js";
import {purchaseKey, purchaseState} from "../src/utils/productPurchase.js";
import {inspectKitSelections} from "../src/utils/kitBuilder.js";
test("marketplace INR input preserves paise and rejects exponent, signed and excessive precision",()=>{assert.equal(parsePaise("500"),50000);assert.equal(parsePaise("550.09"),55009);assert.equal(parsePaise("0"),0);for(const v of ["1e3","-5","1.001","NaN","","₹500"])assert.throws(()=>parsePaise(v));});
test("customer cards and cart use the selected variant price, not a supplier amount or another variant",()=>{const p={id:"fixture",name:"Variant shirt",price:550,discount:0,sizes:["M","L"],colors:["Black"],variants:{Black:{M:2,L:3}},stock:5,variantPrices:[{size:"M",color:"Black",customerUnitAmount:55009,mrpUnitAmount:60000},{size:"L",color:"Black",customerUnitAmount:65000,mrpUnitAmount:70000}]};assert.equal(getDiscountedPrice(p),550.09);assert.equal(getDiscountedPrice(p,"L","Black"),650);assert.equal(getOriginalPrice(p,"L","Black"),700);const row=normalizeCartItem(p,1,"L","Black");assert.equal(row.price,650);assert.equal(row.originalPrice,700);});
test("marketplace writes authenticate, disable caching and never retry an unknown outcome",async()=>{const old=globalThis.fetch;let seen,calls=0;try{globalThis.fetch=async(url,init)=>{calls++;seen=init;return {ok:true,status:200,json:async()=>({success:true,listing:{id:"fixture"}})};};const r=await marketplaceRequest("/listings",{token:"fixture-token",method:"POST",body:{draft:{name:"Fixture"}}});assert.equal(r.listing.id,"fixture");assert.equal(seen.cache,"no-store");assert.equal(seen.headers.Authorization,"Bearer fixture-token");assert.deepEqual(JSON.parse(seen.body),{draft:{name:"Fixture"}});globalThis.fetch=async()=>{calls++;throw new Error("dropped response");};await assert.rejects(marketplaceRequest("/admin/payouts/fixture/record",{token:"fixture-token",method:"POST",body:{}}),e=>e.outcomeUnknown===true);assert.equal(calls,2);}finally{globalThis.fetch=old;}});
test("stale-write conflict is preserved without calling the change saved",async()=>{const old=globalThis.fetch;try{globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({success:false,message:"Stock changed; reload",code:"MARKETPLACE_STOCK_CHANGED"})});await assert.rejects(marketplaceRequest("/listings/fixture/stock",{method:"PUT",body:{}}),{status:409,code:"MARKETPLACE_STOCK_CHANGED"});}finally{globalThis.fetch=old;}});

test("a successful HTTP status without the expected write record remains an unknown outcome",async()=>{const old=globalThis.fetch;let calls=0;try{globalThis.fetch=async()=>{calls++;return {ok:true,status:200,json:async()=>({success:true})};};await assert.rejects(marketplaceRequest("/admin/suppliers/fixture/payouts",{method:"POST",body:{}}),{code:"MARKETPLACE_REPLY_INCOMPLETE",outcomeUnknown:true});assert.equal(calls,1);}finally{globalThis.fetch=old;}});

test("legacy item resolutions require a confirmed record and preserve uncertain write outcomes",async()=>{const old=globalThis.fetch;let seen;try{globalThis.fetch=async(url,init)=>{seen={url,init};return {ok:true,status:200,json:async()=>({success:true,resolution:{id:"fixture-legacy",scope:"legacy"}})};};const route="/admin/orders/fixture-order/items/1/resolutions",body={requestKey:"fixture-request",kind:"cancellation",quantity:1,restockQuantity:0,reason:"Fixture customer cancellation."};assert.equal((await marketplaceRequest(route,{token:"fixture-admin",method:"POST",body})).resolution.scope,"legacy");assert.ok(seen.url.endsWith(route));assert.equal(seen.init.headers.Authorization,"Bearer fixture-admin");assert.deepEqual(JSON.parse(seen.init.body),body);globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({success:true})});await assert.rejects(marketplaceRequest(route,{method:"POST",body}),{code:"MARKETPLACE_REPLY_INCOMPLETE",outcomeUnknown:true});}finally{globalThis.fetch=old;}});

test("the bag, saved purchase, and kit estimate keep each variant's price through refresh", () => {
  const shirt = {
    id: "shirt", name: "Training shirt", price: 550, discount: 0,
    sizes: ["M", "L"], colors: ["Black"], variants: { Black: { M: 2, L: 3 } },
    deliveryAvailable: true,
    variantPrices: [
      { size: "M", color: "Black", customerUnitAmount: 55009, mrpUnitAmount: 60000 },
      { size: "L", color: "Black", customerUnitAmount: 65000, mrpUnitAmount: 70000 },
    ],
  };
  const medium = normalizeCartItem(shirt, 1, "M", "Black");
  const large = normalizeCartItem(shirt, 2, "L", "Black");
  const restored = revalidateCart(JSON.parse(JSON.stringify([medium, large])), [shirt]);
  const review = reviewCart(restored.cart, [shirt], true);
  assert.equal(review.canCheckout, true);
  assert.deepEqual(review.rows.map(row => row.lineTotal), [550.09, 1300]);
  assert.equal(review.originalTotal, 2000);

  const edit = previewBagVariant([large], large, shirt, "M", "Black");
  assert.equal(edit.canSave, true);
  assert.equal(edit.cart[0].price, 550.09);
  assert.equal(reviewCart(edit.cart, [shirt], true).rows[0].lineTotal, 1100.18);

  const kit = { slots: [{ key: "top", allowedProducts: ["shirt"], maximumQuantity: 2 }] };
  const choice = { slotKey: "top", productId: "shirt", included: true, selectedSize: "L", selectedColor: "Black", quantity: 2 };
  const estimate = inspectKitSelections(kit, [shirt], [choice]);
  assert.deepEqual(estimate.errors, []);
  assert.equal(estimate.subtotal, 1300);

  const updated = { ...shirt, variantPrices: [shirt.variantPrices[0], { ...shirt.variantPrices[1], customerUnitAmount: 66000 }] };
  assert.equal(reviewCart([large], [updated], true).canCheckout, false);
  assert.equal(reviewCart([medium], [updated], true).canCheckout, true);
  assert.notEqual(purchaseKey(shirt, "L", "Black", 1), purchaseKey(updated, "L", "Black", 1));
});

test("missing option prices block the selection and incomplete choices show a matching starting price", () => {
  const shirt = {
    id: "shirt", price: 500, discount: 0, sizes: ["M", "L"], colors: ["Black", "Blue"],
    variants: { Black: { M: 1, L: 1 }, Blue: { M: 1, L: 1 } },
    variantPrices: [
      { size: "M", color: "Black", customerUnitAmount: 50009 },
      { size: "L", color: "Black", customerUnitAmount: 65000 },
      { size: "L", color: "Blue", customerUnitAmount: 70099 },
    ],
  };
  assert.equal(getDiscountedPrice(shirt, null, "Blue"), 700.99);
  assert.equal(purchaseState(shirt, "M", "Blue", 1).canBuy, false);
  assert.equal(validateCartItem(shirt, 1, "M", "Blue").valid, false);
  assert.equal(Number.isNaN(getDiscountedPrice(shirt, "M", "Blue")), true);
  assert.equal(purchaseState({ ...shirt, variantPrices: [{ size: "L", color: "Blue", customerUnitAmount: 70099, mrpUnitAmount: 100 }] }, "L", "Blue", 1).canBuy, false);
});
