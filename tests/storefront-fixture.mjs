// Test-only fixtures. Never imported by the app or used as a catalog fallback.
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const fixtureProductId = '000000000000000000000001';
export const fixtureOrderId = '507f1f77bcf86cd799439022';
const user = { id:'507f1f77bcf86cd799439011', _id:'507f1f77bcf86cd799439011', name:'Preview Customer', email:'preview@example.test', role:'customer', phone:'9876543210' };
const address = { id:'507f1f77bcf86cd799439033', label:'Home', fullName:user.name, email:user.email, phone:user.phone, addressLine:'12 Preview Street', landmark:'', city:'Kozhikode', state:'Kerala', pincode:'673001', isDefault:true };
export async function startStorefrontFixture(port = 4210) {
  const server = await createServer({root, server:{host:'127.0.0.1',port,strictPort:true},logLevel:'error'});
  await server.listen();
  const { default: seeds } = await server.ssrLoadModule('/src/data/products.js');
  const products = seeds.map(p => ({...p, id:String(p.id).padStart(24,'0'), _id:String(p.id).padStart(24,'0'), colorImages:(p.colors || []).map((color,index)=>({color,images:[p.images[index % p.images.length]]})), reviews:[], reviewCount:0, rating:0}));
  return {server, products, url:`http://127.0.0.1:${port}`};
}
function quoteFor(body, products) {
  const items = body.items.map(row => {
    const p = products.find(p => p.id === row.id);
    const price = Math.round(p.price * (1 - p.discount / 100));
    const paise = price * 100;
    return {product:p.id, name:p.name, price, quantity:row.quantity, selectedColor:row.selectedColor, selectedSize:row.selectedSize,
      priceAllocation:{quantity:row.quantity, lineSubtotalPaise:paise*row.quantity, kitDiscountPaise:0, couponDiscountPaise:0, linePaidPaise:paise*row.quantity, unitBasePaise:paise, extraPaiseUnits:0}};
  });
  const subtotal = items.reduce((sum,item) => sum + item.price * item.quantity, 0);
  const shipping = body.deliveryMethod === 'express' ? 149 : 79;
  const finalTotal = subtotal + shipping;
  const cod = body.paymentMethod === 'cod-partial';
  const now = cod ? Math.round(subtotal * 10) / 100 : finalTotal;
  const ready = /^[1-9]\d{5}$/.test(body.pincode || '');
  const validUntil = new Date(Date.now()+600000).toISOString();
  return {previewOnly:true, purchaseEnabled:ready, inventoryReserved:false, shippingIsEstimate:!ready, reviewKey:'a'.repeat(64), items, kitSnapshots:[], method:body.deliveryMethod,
    pricing:{currency:'INR', subtotal, kitDiscount:0, couponDiscount:0, totalAfterCoupon:subtotal, shipping, finalTotal},
    payment:{method:body.paymentMethod, amountToPayNow:now, amountDue:Math.round((finalTotal-now)*100)/100, advancePercentage:cod?10:0},
    deliveryReview:{ready, validUntil, pincode:body.pincode, items:[]},
    shippingReview:{ready, validUntil, shippingPaise:shipping*100, packageCount:1, shipments:[{key:'fixture-package', carrier:'Preview carrier', contents:items.map((item,itemIndex)=>({itemIndex,quantity:item.quantity})), shipping, amountDueOnDelivery:Math.round((finalTotal-now)*100)/100}]}};
}
export async function mockStorefront(context, products, {signedIn=false, catalogFailure=false, empty=false} = {}) {
  await context.addInitScript(({signedIn}) => {
    sessionStorage.setItem('gymdrobe-fitness-guide-seen-v1','1');
    if(signedIn) localStorage.setItem('gymdrobe-auth-token','fixture-token-not-a-real-credential');
  }, {signedIn});
  const p = products[0];
  const price = Math.round(p.price*(1-p.discount/100));
  const createdAt = new Date(Date.now()-86400000).toISOString();
  const order = {id:fixtureOrderId, _id:fixtureOrderId, orderNumber:'GD-PREVIEW-001', user:user.id, status:'shipped', createdAt,
    items:[{product:p.id, productId:p.id, name:p.name, image:p.images[0], price, quantity:1, selectedSize:'M', selectedColor:'Black', returnPolicy:{eligible:true,days:7}}],
    shippingAddress:address, address, deliveryMethod:'standard',
    pricing:{currency:'INR', subtotal:price, kitDiscount:0, couponDiscount:0, totalAfterCoupon:price, shipping:79, finalTotal:price+79},
    payment:{method:'razorpay', status:'paid', amountPaid:price+79, totalAmount:price+79, amountDue:0, verifiedAt:createdAt, transactionId:'fixture_payment_not_real'},
    tracking:{carrier:'Preview carrier', trackingNumber:'PREVIEW123', estimatedDelivery:new Date(Date.now()+172800000).toISOString().slice(0,10), events:[{status:'shipped',description:'Preview package dispatched',timestamp:createdAt}]},
    metadata:{demo:true,inventoryReserved:true}, refund:{status:'not-requested'}, cancellation:{status:'not-requested'}};
  let addresses = signedIn ? [{...address}] : [];
  const requests=[];
  await context.route('**/*', async route => {
    const req=route.request(), u=new URL(req.url());
    if(!u.pathname.startsWith('/api/')) {
      if(['127.0.0.1','localhost'].includes(u.hostname)) return route.continue();
      return route.abort(); // No live analytics, authentication, payment SDKs or external services.
    }
    requests.push({path:u.pathname, method:req.method()});
    let data={success:true}, status=200;
    const body=req.postDataJSON();
    if(u.pathname==='/api/products') {
      data={success:true,products:empty?[]:products,total:empty?0:products.length};
      if(catalogFailure){status=503;data={success:false,message:'Preview: catalog temporarily unavailable'};}
    } else if(/\/products\/[^/]+\/reviews$/.test(u.pathname)) data={success:true,reviews:[],rating:0,reviewCount:0};
    else if(/^\/api\/products\/[^/]+$/.test(u.pathname)) data={success:true,product:products.find(p=>p.id===u.pathname.split('/').at(-1))};
    else if(u.pathname==='/api/auth/me') data={success:true,user};
    else if(u.pathname.includes('analytics')) data={success:true,config:{enabled:false,allowedEvents:[]}};
    else if(u.pathname==='/api/kits') data={success:true,kits:[]};
    else if(u.pathname.startsWith('/api/addresses')) {
      if(req.method()==='POST') {const next={...body,id:'507f1f77bcf86cd799439034'};addresses.push(next);data={success:true,address:next};}
      else if(req.method()==='PUT') {addresses=addresses.map(a=>a.id===u.pathname.split('/').at(-1)?{...a,...body}:a);data={success:true,address:addresses.find(a=>a.id===u.pathname.split('/').at(-1))};}
      else if(req.method()==='DELETE') addresses=addresses.filter(a=>a.id!==u.pathname.split('/').at(-1));
      else data={success:true,addresses};
    } else if(u.pathname==='/api/orders') data={success:true,orders:signedIn?[order]:[]};
    else if(u.pathname===`/api/orders/${fixtureOrderId}`) data={success:true,order};
    else if(u.pathname==='/api/payments/checkout/quote') data={success:true,quote:quoteFor(body,products)};
    else if(u.pathname.includes('/payments/')) {status=403;data={success:false,message:'Preview fixture: payments are disabled.'};}
    else if(u.pathname.includes('coupons')) data={success:true,coupons:[]};
    else if(u.pathname.includes('virtual-try-on')) data={success:true,available:false};
    else if(u.pathname.includes('/auth/config')) data={success:true,googleClientId:''};
    else if(u.pathname.startsWith('/api/orders/')) {status=404;data={success:false,message:'Order not found'};}
    else data={success:true,settings:{enabled:false},config:{enabled:false},products:[],orders:[],addresses:[],notifications:[],tickets:[]};
    return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  return {requests,user,order,address};
}
