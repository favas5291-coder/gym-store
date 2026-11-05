// Isolated test-only app: real Mongo transactions/routes, synthetic gateway boundary.
import path from "node:path";
import crypto from "node:crypto";
import {createRequire} from "node:module";
import {once} from "node:events";
import {createServer} from "vite";
export async function startMarketplaceFixture(){
 const uri=process.env.GYMDROBE_TEST_MONGO_URI||"";if(!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/gymdrobe_fixture_[a-z\d_]+\?/.test(uri)||!uri.includes("replicaSet="))throw new Error("Disposable loopback replica set required.");
 const root=process.cwd(),backendRoot=path.resolve(process.env.GYMDROBE_MARKETPLACE_BACKEND_DIR||"../gymdrobe-marketplace-backend"),require=createRequire(path.join(backendRoot,"package.json")),mongoose=require("mongoose"),express=require("express");
 process.env.JWT_SECRET=crypto.randomBytes(32).toString("hex");process.env.MARKETPLACE_ENABLED="true";process.env.MARKETPLACE_DATA_KEY=crypto.randomBytes(32).toString("hex");
 const gateway=require(path.join(backendRoot,"tests/helpers/marketplaceGateway.cjs"))(),S=require(path.join(backendRoot,"utils/marketplace/service.js")),F=require(path.join(backendRoot,"utils/marketplace/settlement.js")),User=require(path.join(backendRoot,"models/User.js")),Supplier=require(path.join(backendRoot,"models/Supplier.js")),Product=require(path.join(backendRoot,"models/Product.js")),Order=require(path.join(backendRoot,"models/Order.js")),jwt=require("jsonwebtoken"),fixtures=require(path.join(backendRoot,"tests/fixtures/marketplace-data.cjs"));
 await mongoose.connect(uri,{dbName:"gymdrobe_fixture_browser_"+crypto.randomBytes(8).toString("hex"),serverSelectionTimeoutMS:10000});await Promise.all([User,Supplier,Product,Order,...Object.values(S.M)].map(m=>m.createIndexes()));await S.M.Quota.create({_id:"global",bytes:0});
 const admin=await User.create({name:"Fixture Administrator",email:"admin@example.test",password:"Fixture-Admin-Only-123",role:"admin"}),customer=await User.create({name:"Fixture Customer",email:"customer@example.test",password:"Fixture-Customer-Only-123",role:"customer"});
 const token=user=>jwt.sign({userId:String(user._id),authVersion:user.authVersion||0},process.env.JWT_SECRET,{expiresIn:"1h"});
 const app=express();app.use(require("cors")({origin:/^http:\/\/127\.0\.0\.1:\d+$/}));app.use(express.json({limit:"1mb"}));app.use("/api/marketplace",require(path.join(backendRoot,"routes/marketplaceRoutes.js")).createMarketplaceRouter());app.use("/api/auth",require(path.join(backendRoot,"routes/authRoutes.js")));app.use("/api/products",require(path.join(backendRoot,"routes/productRoutes.js")));app.use("/api/payments",require(path.join(backendRoot,"routes/paymentRoutes.js")));app.use("/api/orders",require(path.join(backendRoot,"routes/orderRoutes.js")));app.get("/api/shipping-settings",(req,res)=>res.json({success:true,settings:require(path.join(backendRoot,"utils/shippingSettings.js")).defaultShippingSettings()}));app.use((req,res)=>res.status(404).json({success:false,code:"FIXTURE_OPTIONAL_SERVICE_UNAVAILABLE",message:"Optional service absent in isolated test."}));
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");const apiURL=`http://127.0.0.1:${server.address().port}/api`;
 // Use the browser origin for test API requests while proxying to the real Express handlers.
 // This keeps WebKit navigation and teardown from racing cross-origin requests.
 const frontendURL = "http://127.0.0.1:4197";
 process.env.VITE_API_URL = `${frontendURL}/api`;
 process.env.VITE_MARKETPLACE_ENABLED = "true";
 process.env.VITE_API_FALLBACK = "false";
 const frontend = await createServer({
  root,
  server: {host: "127.0.0.1", port: 4197, strictPort: true, proxy: {"/api": {target: new URL(apiURL).origin}}},
  logLevel: "error",
 });
 await frontend.listen();
 async function paidOrder(productId,{legacyProductId}={}){const body={checkoutToken:crypto.randomUUID(),paymentMethod:"razorpay",deliveryMethod:"standard",shippingAddress:fixtures.shippingAddress,items:[{id:String(productId),quantity:1,selectedSize:"M",selectedColor:"Black"},...(legacyProductId?[{id:String(legacyProductId),quantity:1,selectedSize:"M",selectedColor:"Black"}]:[])]};const post=async(route,b)=>{const response=await fetch(apiURL+"/payments"+route,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token(customer)},body:JSON.stringify(b)});const data=await response.json();if(!response.ok)throw new Error(JSON.stringify({route,status:response.status,data}));return data;};const quote=await post("/checkout/quote",body);body.expectedTotal=quote.quote.pricing.finalTotal;const start=await post("/razorpay/order",body),proof={...gateway.capture(start.razorpayOrderId),checkoutToken:body.checkoutToken};await post("/razorpay/verify",proof);return Order.findOne({checkoutToken:body.checkoutToken});}
 return {url:frontendURL,apiURL,S,F,User,Product,Order,admin,customer,token,fixtures,gateway,paidOrder,async expireHold(order){await Order.collection.updateOne({_id:order._id},{$set:{"delivery.deliveredAt":new Date(Date.now()-8*86400000)}});await S.M.Fulfilment.updateMany({order:order._id},{$set:{deliveredAt:new Date(Date.now()-8*86400000)}});},async close(){await frontend.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await mongoose.connection.db.dropDatabase();await mongoose.disconnect();}};
}
