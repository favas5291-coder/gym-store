import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCollections } from '../src/utils/homeCollections.js';
import { filterProducts } from '../src/utils/catalog.js';
const product = (id, extra = {}) => ({ id, name: `Product ${id}`, category: 'Clothing', price: 799, stock: 10, ...extra });

test('Homepage only claims bestsellers or trending when catalog flags support it', () => {
  const unranked = Array.from({length:12}, (_,i) => product(String(i), {isFeatured:true}));
  const selection = homeCollections(unranked);
  assert.equal(selection.leadTitle, 'Selected for your routine');
  assert.equal(selection.moreTitle, 'More to explore');
  const marked = homeCollections([product('best', {isBestSeller:true}), product('trend', {isTrending:true})]);
  assert.equal(marked.leadTitle, 'Best sellers');
  assert.deepEqual(marked.lead.map(p=>p.id), ['best']);
  assert.equal(marked.moreTitle, 'Trending now');
  assert.deepEqual(marked.more.map(p=>p.id), ['trend']);
});

test('Homepage selections remain distinct, in stock, and exclude unavailable catalog records', () => {
  const valid = Array.from({length:12}, (_,i) => product(String(i), {isNew:i<8,isFeatured:true}));
  const result = homeCollections([...valid, valid[0], product('sold',{stock:0}), product('hidden',{isActive:false}), product('delivery',{delivery:{available:false}}), product('bad-price',{price:null})]);
  assert.equal(result.available.length,12);
  assert.equal(result.lead.length,4);
  assert.equal(result.fresh.length,4);
  assert.equal(result.more.length,4);
  const ids = [...result.lead,...result.fresh,...result.more].map(p=>p.id);
  assert.equal(new Set(ids).size,12);
});

test('New arrivals use the saved flag and newest catalog date, not an invented date', () => {
  const result = homeCollections([product('best',{isBestSeller:true}), product('old',{isNew:true,createdAt:'2026-01-01'}), product('new',{isNew:true,createdAt:'2026-09-01'}), product('unmarked',{createdAt:'2026-10-01'})]);
  assert.deepEqual(result.fresh.map(p=>p.id),['new','old']);
});

test('Empty or fully unavailable catalogs produce no promotional product claims', () => {
  for(const products of [[],[product('sold',{stock:0,isBestSeller:true,isTrending:true})]]) {
    const result=homeCollections(products);
    assert.deepEqual([...result.lead,...result.fresh,...result.more],[]);
    assert.equal(result.leadTitle,'Selected for your routine');
  }
});

test('Trending collection navigation uses the actual trending flag', () => {
  const products=[product('a',{isTrending:true}),product('b',{isFeatured:true}),product('c')];
  assert.deepEqual(filterProducts(products,new URLSearchParams('collection=trending')).map(p=>p.id),['a']);
});
