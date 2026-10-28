import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { matchCities, matchStates, validIndianState } from "../data/indiaLocations.js";
import { lookupIndianPincode, searchIndianPostOffices } from "../services/indiaPostalLookup.js";
import "./AddressAutocomplete.css";

const fields = [
  ["fullName","Full name","name","text"],
  ["email","Email","email","email"],
  ["phone","Mobile number","tel-national","tel"],
  ["addressLine","House number, building and street","street-address","text"],
  ["landmark","Landmark (optional)","address-line2","text"],
  ["city","City","address-level2","text"],
  ["state","State","address-level1","text"],
  ["pincode","Pincode","postal-code","text"]
];
const maximumLengths={
  fullName:100,email:150,phone:16,addressLine:200,landmark:150,city:100,state:100,pincode:6
};
function fieldValue(name,input){
  if(name!=="phone"&&name!=="pincode")return input;
  const digits=input.replace(/\D/g,"");
  if(name==="phone"&&digits.length===12&&digits.startsWith("91"))return digits.slice(2);
  return digits;
}
function postalCities(rows){
  const seen=new Set();
  return rows.map(row=>({city:row.locality,state:row.state,aliases:[row.district]})).filter(row=>{
    const k=`${row.city.toLowerCase()}|${row.state.toLowerCase()}`;
    if(seen.has(k))return false;seen.add(k);return true;
  });
}

export default function AddressForm({value={},onChange,errors={}}){
  const prefix=useId();
  const [focused,setFocused]=useState("");
  const [active,setActive]=useState(-1);
  const [remoteCities,setRemoteCities]=useState([]);
  const [postalMatches,setPostalMatches]=useState([]);
  const [postalStatus,setPostalStatus]=useState("");
  const [visibleSpace,setVisibleSpace]=useState(240);
  const fieldRefs=useRef({});
  const latest=useRef(null);
  latest.current={value,onChange};
  const city=String(value?.city||"");
  const state=String(value?.state||"");
  const pin=String(value?.pincode||"");
  const cityOptions=matchCities(city,state,remoteCities).map(row=>({
    label:row.city,subtitle:row.state,value:row.city,state:row.state
  }));
  const stateOptions=matchStates(state).map(item=>({label:item,value:item}));
  const options=focused==="city"?cityOptions:focused==="state"?stateOptions:[];
  const invalidState=Boolean(state.trim())&&!validIndianState(state);

  // No large city database or remote request on initial checkout load.
  useEffect(()=>{
    if(focused!=="city" || city.trim().length<3){
      setRemoteCities([]);return undefined;
    }
    const controller=new AbortController();
    const task=setTimeout(()=>{
      searchIndianPostOffices(city,{signal:controller.signal})
        .then(rows=>{if(!controller.signal.aborted)setRemoteCities(postalCities(rows));})
        .catch(()=>{if(!controller.signal.aborted)setRemoteCities([]);});
    },280);
    return ()=>{clearTimeout(task);controller.abort();};
  },[city,focused]);

  useEffect(()=>{
    if(!/^[1-9]\d{5}$/.test(pin)){
      setPostalMatches([]);setPostalStatus(pin.length===6?"Enter a valid Indian PIN code.":"");
      return undefined;
    }
    const controller=new AbortController();
    setPostalMatches([]);setPostalStatus("Checking postal locations…");
    const task=setTimeout(()=>{
      lookupIndianPincode(pin,{signal:controller.signal}).then(rows=>{
        if(controller.signal.aborted || latest.current.value.pincode!==pin)return;
        setPostalMatches(rows);
        setPostalStatus(rows.length?"":"PIN code not found. Check the number or enter your city and state manually.");
        if(rows.length && rows.every(row=>row.state===rows[0].state)){
          const current=latest.current;
          // Fill only genuinely blank fields. Never override a customer choice,
          // saved address, Google Autofill value or subsequent manual edits.
          const update={};
          if(!String(current.value.state||"").trim() && validIndianState(rows[0].state))update.state=rows[0].state;
          const districts=[...new Set(rows.map(row=>row.district).filter(Boolean))];
          if(!String(current.value.city||"").trim() && districts.length===1)update.city=districts[0];
          if(Object.keys(update).length)current.onChange({...current.value,...update});
        }
      }).catch(error=>{
        if(error?.name==="AbortError"||controller.signal.aborted)return;
        setPostalMatches([]);
        setPostalStatus("Postal lookup is unavailable. You can enter the address manually.");
      });
    },330);
    return ()=>{clearTimeout(task);controller.abort();};
  },[pin]);

  useEffect(()=>{
    if(!focused)return undefined;
    const vv=window.visualViewport;
    let frame=0;
    const measure=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const node=fieldRefs.current[focused];
        if(!node)return;
        const bottom=node.getBoundingClientRect().bottom;
        const visibleBottom=vv?vv.offsetTop+vv.height:window.innerHeight;
        setVisibleSpace(Math.max(0,Math.min(240,visibleBottom-bottom-8)));
      });
    };
    measure();
    vv?.addEventListener("resize",measure);
    vv?.addEventListener("scroll",measure);
    window.addEventListener("scroll",measure,{passive:true});
    window.addEventListener("resize",measure);
    return ()=>{
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize",measure);
      vv?.removeEventListener("scroll",measure);
      window.removeEventListener("scroll",measure);
      window.removeEventListener("resize",measure);
    };
  },[focused,city,state,pin]);

  function selectOption(item,name){
    const current=latest.current;
    const next={...current.value,[name]:item.value};
    if(name==="city" && item.state && validIndianState(item.state) &&
       (!String(next.state||"").trim() || !validIndianState(next.state)))next.state=item.state;
    current.onChange(next);
    setFocused("");
    setActive(-1);
  }
  function handleKey(event,name){
    if(event.nativeEvent.isComposing)return;
    const count=name==="pincode"?postalMatches.length:options.length;
    if(["ArrowDown","ArrowUp"].includes(event.key) && count && (name==="pincode"||focused===name)){
      event.preventDefault();
      setActive(a=>event.key==="ArrowDown"?(a+1)%count:(a+count)%count);
    }else if(event.key==="Enter" && active>=0 && active<count && focused===name){
      event.preventDefault();
      if(name==="pincode"){
        const row=postalMatches[active];
        const current=latest.current;
        current.onChange({...current.value,city:row.locality,state:validIndianState(row.state)?row.state:current.value.state});
        setFocused("");setActive(-1);
      }else selectOption(options[active],name);
    }else if(event.key==="Escape"){
      setFocused("");setActive(-1);
    }
  }

  return <div className="address-form">
    {fields.map(([name,label,autoComplete,type])=>{
      const id=`${prefix}-${name}`;
      const error=errors[name];
      const isLocation=name==="city"||name==="state"||name==="pincode";
      const expanded=focused===name && isLocation;
      const showOptions=expanded&&(name==="pincode"?postalMatches.length>1:options.length>0);
      const inputMode=name==="pincode"?"numeric":name==="phone"?"tel":name==="email"?"email":undefined;
      const message=name==="pincode"?postalStatus:name==="state"&&invalidState?"Choose a state or union territory from the list.":name==="city"&&focused==="city"&&city.length>2&&!cityOptions.length?"No matching suggestions. You can enter the city manually.":"";
      return <div className={`field field-${name}${name==="addressLine"?" field-wide":""}${isLocation?" gd-address-location":""}`}
        key={name} ref={node=>{fieldRefs.current[name]=node;}}
        onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(current=>current===name?"":current);}}>
        <label htmlFor={id}>{label}</label>
        <div className="gd-address-input-wrap">
          <input id={id} name={name} type={type}
            role={name==="city"||name==="state"?"combobox":undefined}
            aria-autocomplete={name==="city"||name==="state"?"list":undefined}
            aria-expanded={name==="city"||name==="state"?expanded:undefined}
            aria-controls={showOptions?`${id}-suggestions`:undefined}
            aria-activedescendant={expanded && active>=0 && showOptions?`${id}-option-${active}`:undefined}
            value={String(value?.[name]??"")} autoComplete={autoComplete}
            autoCapitalize={name==="email"?"none":undefined}
            autoCorrect={name==="email"?"off":undefined}
            required={name!=="landmark"}
            maxLength={maximumLengths[name]}
            inputMode={inputMode}
            aria-invalid={Boolean(error)||(name==="state"&&invalidState)}
            aria-describedby={[error?`${id}-error`:"",message?`${id}-hint`:""].filter(Boolean).join(" ")||undefined}
            onFocus={()=>{if(isLocation)setFocused(name);setActive(-1);}}
            onChange={event=>{
              onChange({...value,[name]:fieldValue(name,event.target.value)});
              setActive(-1);
              if(isLocation)setFocused(name);
            }}
            onKeyDown={isLocation?event=>handleKey(event,name):undefined}
            onInvalid={name==="state"?event=>{
              if(invalidState)event.target.setCustomValidity("Choose a valid Indian state or union territory.");
            }:undefined}
            onInput={name==="state"?event=>event.currentTarget.setCustomValidity(""):undefined}
            onBlur={name==="state"?event=>{
              event.target.setCustomValidity(
                event.target.value.trim()&&!validIndianState(event.target.value)
                  ?"Choose a valid Indian state or union territory.":""
              );
            }:undefined}
          />
          {name==="state"&&<ChevronDown size={16} strokeWidth={1.6} aria-hidden="true"/>}
          {name==="pincode"&&<MapPin size={16} strokeWidth={1.6} aria-hidden="true"/>}
        </div>
        {showOptions && visibleSpace>44 && <ul id={`${id}-suggestions`} className="gd-address-suggestions"
          role="listbox" style={{maxHeight:`${visibleSpace}px`}}>
          {(name==="pincode"?postalMatches:options).slice(0,name==="pincode"?30:12).map((item,index)=>{
            const text=name==="pincode"?item.locality:item.label;
            const sub=name==="pincode"?[item.district,item.state].filter(Boolean).join(" · "):item.subtitle;
            return <li role="presentation" key={`${text}-${index}`}>
              <button type="button" role="option" id={`${id}-option-${index}`}
                aria-selected={index===active}
                onPointerDown={event=>{
                  // Select before iOS blurs/unmounts the listbox; keep native
                  // click for assistive technology and keyboard activation.
                  if(event.pointerType==="mouse"||event.pointerType==="touch"){
                    event.preventDefault();
                    if(name==="pincode"){
                      const current=latest.current;
                      current.onChange({...current.value,city:item.locality,state:validIndianState(item.state)?item.state:current.value.state});
                      setFocused("");setActive(-1);
                    }else selectOption(item,name);
                  }
                }}
                onClick={()=>{
                  if(name==="pincode"){
                    const current=latest.current;
                    current.onChange({...current.value,city:item.locality,state:validIndianState(item.state)?item.state:current.value.state});
                    setFocused("");setActive(-1);
                  }else selectOption(item,name);
                }}>
                <span>{text}</span>{sub&&<small>{sub}</small>}
              </button>
            </li>;
          })}
          </ul>}
        {message&&<p className="gd-address-hint" id={`${id}-hint`} role="status">{message}</p>}
        {name==="pincode"&&postalMatches.length>1&&focused!=="pincode"&&
          <button type="button" className="gd-address-locality-reopen" onClick={()=>setFocused("pincode")}>
            {postalMatches.length} postal localities found · Choose locality
          </button>}
        {error&&<p className="field-error" id={`${id}-error`}>{error}</p>}
      </div>;
    })}
  </div>;
}
