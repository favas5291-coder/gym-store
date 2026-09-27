import test from 'node:test';
import assert from 'node:assert/strict';
import { importGuestShopping, shoppingKey } from '../src/utils/shopperStorage.js';
import { commitCheckout, checkoutSignature } from '../src/utils/checkout.js';
import { allOrders, ownerKey } from '../src/utils/customerData.js';
import { applyReservations } from '../src/utils/inventory.js';
import { normalizeCartItem } from '../src/utils/cartUtils.js';
import { calculateOrderPricing } from '../src/utils/orderCalculations.js';
import { matchesSearch, filterProducts } from '../src/utils/catalog.js';
const tee = {id:1,name:'Training T-Shirt',category:'Workout Clothes',price:799,discount:10,stock:1};
function storage() { const map = new Map(); globalThis.localStorage = {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}; return map; }
function order(token, qty=1) { const items=[normalizeCartItem(tee,qty)]; return {id:'order-'+token,ownerKey:ownerKey(null),items,pricing:calculateOrderPricing({cart:items}),deliveryMethod:'standard',metadata:{checkoutToken:token,inventoryReserved:true},status:'confirmed'}; }
test('guest bag import merges variants once and isolates signed-in accounts',()=>{
 const map=storage(),user={id:'alice'},item=normalizeCartItem(tee,1);
 map.set('gymdrobe-cart',JSON.stringify([item]));map.set(shoppingKey('gymdrobe-cart',user),JSON.stringify([{...item,quantity:2}]));
 importGuestShopping(user);assert.equal(JSON.parse(map.get(shoppingKey('gymdrobe-cart',user)))[0].quantity,3);
 importGuestShopping(user);assert.equal(JSON.parse(map.get(shoppingKey('gymdrobe-cart',user)))[0].quantity,3);
 assert.equal(map.has('gymdrobe-cart'),false);assert.equal(map.has(shoppingKey('gymdrobe-cart',{id:'bob'})),false);
 delete globalThis.localStorage;
});
test('failed account import preserves guest data',()=>{
 const map=storage();map.set('gymdrobe-cart',JSON.stringify([normalizeCartItem(tee,1)]));
 localStorage.setItem=()=>{throw new Error('quota')};importGuestShopping({id:'alice'});assert.ok(map.has('gymdrobe-cart'));
 delete globalThis.localStorage;
});
test('checkout idempotency saves repeated attempts only once',async()=>{
 storage();const first=order('one');const latest=()=>applyReservations([tee],allOrders());
 assert.equal((await commitCheckout(first,latest)).order.id,first.id);
 assert.equal((await commitCheckout({...first,id:'duplicate'},latest)).existing,true);assert.equal(allOrders().length,1);
 delete globalThis.localStorage;
});
test('a second checkout cannot consume the last reserved unit',async()=>{
 storage();const latest=()=>applyReservations([tee],allOrders());
 const results=await Promise.all([commitCheckout(order('a'),latest),commitCheckout(order('b'),latest)]);
 assert.equal(results.filter(result=>result.order).length,1);assert.equal(results.filter(result=>result.error).length,1);assert.equal(allOrders().length,1);
 delete globalThis.localStorage;
});
test('checkout rejects changed prices and preserves storage on failed save',async()=>{
 storage();const attempt=order('price');const result=await commitCheckout(attempt,()=>[{...tee,price:899}]);
 assert.ok(result.error);assert.equal(result.cart[0].price,809);assert.equal(allOrders().length,0);
 localStorage.setItem=()=>{throw new Error('quota')};await assert.rejects(commitCheckout(attempt,()=>[tee]),/could not be saved/);
 delete globalThis.localStorage;
});
test('review signature detects price, quantity, coupon and delivery changes',()=>{
 const items=[normalizeCartItem({...tee,stock:5},2)];const base=checkoutSignature(items,null,'standard');
 assert.notEqual(base,checkoutSignature(items,'MIDLAJ','standard'));
 assert.notEqual(base,checkoutSignature(items,null,'express'));
 assert.notEqual(base,checkoutSignature([{...items[0],quantity:1}],null,'standard'));
});
test('search aliases and multi-category filters return real matching products',()=>{
 assert.equal(matchesSearch(tee,'tee'),true);assert.equal(matchesSearch(tee,'t shirt'),true);
 const shoes={...tee,id:2,name:'Gym Shoes',category:'Gym Shoes'};
 assert.equal(matchesSearch(shoes,'trainers'),true);
 assert.equal(filterProducts([tee,shoes],new URLSearchParams({category:'Workout Clothes,Gym Shoes'})).length,2);
 assert.equal(filterProducts([tee,shoes],new URLSearchParams({category:'Gym Shoes',search:'t shirt'})).length,0);
});