// The 28 Indian states and 8 union territories; normalized for address fields.
// The small seed list makes common cities instant. Remote postal-office search
// adds smaller towns without bundling a full postal directory at startup.
export const INDIAN_STATES = Object.freeze([
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir",
  "Ladakh","Lakshadweep","Puducherry"
]);
export const CITY_SEEDS = Object.freeze([
  ["Kozhikode","Kerala",["Calicut"]],["Kochi","Kerala",["Cochin"]],["Thiruvananthapuram","Kerala",["Trivandrum"]],
  ["Kollam","Kerala"],["Thrissur","Kerala"],["Kannur","Kerala"],["Palakkad","Kerala"],
  ["Malappuram","Kerala"],["Kottayam","Kerala"],["Alappuzha","Kerala"],
  ["Bengaluru","Karnataka",["Bangalore"]],["Mysuru","Karnataka",["Mysore"]],
  ["Mangaluru","Karnataka",["Mangalore"]],["Hubballi","Karnataka",["Hubli"]],
  ["Mumbai","Maharashtra",["Bombay"]],["Pune","Maharashtra"],["Nagpur","Maharashtra"],["Nashik","Maharashtra"],
  ["Chennai","Tamil Nadu",["Madras"]],["Coimbatore","Tamil Nadu"],["Madurai","Tamil Nadu"],["Tiruchirappalli","Tamil Nadu",["Trichy"]],
  ["Delhi","Delhi",["New Delhi"]],["Hyderabad","Telangana"],["Warangal","Telangana"],
  ["Visakhapatnam","Andhra Pradesh",["Vizag"]],["Vijayawada","Andhra Pradesh"],
  ["Kolkata","West Bengal",["Calcutta"]],["Howrah","West Bengal"],["Siliguri","West Bengal"],
  ["Ahmedabad","Gujarat"],["Surat","Gujarat"],["Vadodara","Gujarat"],
  ["Jaipur","Rajasthan"],["Jodhpur","Rajasthan"],["Udaipur","Rajasthan"],
  ["Lucknow","Uttar Pradesh"],["Noida","Uttar Pradesh"],["Varanasi","Uttar Pradesh"],
  ["Kanpur","Uttar Pradesh"],["Ghaziabad","Uttar Pradesh"],
  ["Gurugram","Haryana",["Gurgaon"]],["Faridabad","Haryana"],
  ["Chandigarh","Chandigarh"],["Amritsar","Punjab"],["Ludhiana","Punjab"],
  ["Bhopal","Madhya Pradesh"],["Indore","Madhya Pradesh"],["Gwalior","Madhya Pradesh"],
  ["Patna","Bihar"],["Gaya","Bihar"],["Ranchi","Jharkhand"],
  ["Bhubaneswar","Odisha"],["Cuttack","Odisha"],
  ["Guwahati","Assam"],["Shillong","Meghalaya"],["Imphal","Manipur"],
  ["Agartala","Tripura"],["Aizawl","Mizoram"],["Kohima","Nagaland"],
  ["Gangtok","Sikkim"],["Dehradun","Uttarakhand"],["Haridwar","Uttarakhand"],
  ["Shimla","Himachal Pradesh"],["Panaji","Goa"],["Raipur","Chhattisgarh"],
  ["Itanagar","Arunachal Pradesh"],["Srinagar","Jammu and Kashmir"],
  ["Jammu","Jammu and Kashmir"],["Leh","Ladakh"],["Port Blair","Andaman and Nicobar Islands"],
  ["Puducherry","Puducherry",["Pondicherry"]],["Kavaratti","Lakshadweep"]
]);
function normalize(s) { return String(s||"").normalize("NFKD").toLowerCase().trim(); }
export function matchStates(query) {
  const key=normalize(query);
  return INDIAN_STATES.filter(s=>normalize(s).includes(key)).sort((a,b)=>{
    const x=normalize(a).startsWith(key)?0:1,y=normalize(b).startsWith(key)?0:1;
    return x-y||a.localeCompare(b);
  });
}
export function validIndianState(value) {
  return INDIAN_STATES.some(s=>normalize(s)===normalize(value));
}
export function matchCities(query,state="",additional=[]) {
  const key=normalize(query);if(key.length<2)return [];
  const stateKey=normalize(state);
  const list=[...CITY_SEEDS.map(([city,region,aliases=[]])=>({city,state:region,aliases})),...additional];
  const dedup=new Set();
  return list.filter(item=>{
    if(stateKey && normalize(item.state)!==stateKey) return false;
    return [item.city,...(item.aliases||[])].some(word=>normalize(word).includes(key));
  }).sort((a,b)=>{
    const aStart=[a.city,...(a.aliases||[])].some(w=>normalize(w).startsWith(key))?0:1;
    const bStart=[b.city,...(b.aliases||[])].some(w=>normalize(w).startsWith(key))?0:1;
    return aStart-bStart || a.city.localeCompare(b.city);
  }).filter(item=>{
    const k=`${normalize(item.city)}|${normalize(item.state)}`;
    if(dedup.has(k))return false;dedup.add(k);return true;
  }).slice(0,12);
}
