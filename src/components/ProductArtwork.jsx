// Original vector placeholders. These are labelled illustrations, never product photographs.
export default function ProductArtwork({ category = "", name = "" }) {
  const text = `${category} ${name}`.toLowerCase();
  let shape;
  if (/shoe|trainer/.test(text)) shape = <>
    <path d="M68 270q19-21 15-76l49 8 31 56 66 24 69 8q47 4 42 43H69q-17-23-1-63Z" fill="#f8f8f6"/>
    <path d="m86 211 35 2 29 59 73 28 85 8q22 0 25 22H74l-9-19 15-33Z" fill="#e3dfd9"/>
    <path d="M63 329h279v24H75q-14-2-12-24Z" fill="#fff"/>
    <path d="m156 263 22-12m-4 22 22-13m-4 22 22-13m4 20 17-11" stroke="#fff" strokeWidth="7"/>
    <path d="M99 278q30 33 50 28l69-19" fill="none" stroke="#474a52" strokeWidth="10"/>
  </>;
  else if (/sock/.test(text)) shape = <>
    <path d="M100 115h68v169l-64 57q-45 25-59-9-5-15 18-35l37-39Z" fill="#fafafa"/>
    <path d="M210 95h68v169l-64 57q-45 25-59-9-5-15 18-35l37-39Z" fill="#454957"/>
    <path d="M106 138h55m-55 16h55m56-35h55m-55 16h55" stroke="#9297a3" strokeWidth="6"/>
    <path d="M100 265l-39 38m148-61-39 38" stroke="#c4c7ce" strokeWidth="12"/>
  </>;
  else if (/towel/.test(text)) shape = <>
    <rect x="78" y="156" width="245" height="171" rx="14" fill="#b9bfae"/>
    <path d="M90 194h210m-210 105h210" stroke="#e5e8dc" strokeWidth="8"/>
    <rect x="96" y="137" width="219" height="147" rx="10" fill="#dde0d5"/>
    <path d="M108 164h194m-194 98h194" stroke="#b0b8a1" strokeWidth="4"/>
    <path d="M280 138v145" stroke="#a3ac99" strokeWidth="2"/>
  </>;
  else if (/bottle|shaker|hydration/.test(text)) shape = <>
    <path d="M149 132h102l20 50-8 143q-1 27-30 29h-67q-28-2-29-29l-8-143Z" fill={/shaker/.test(text) ? "#555e58" : "#a9c1c2"}/>
    <path d="M160 150h80l11 44-6 118q-2 19-21 22h-47" fill="none" stroke="#ffffff55" strokeWidth="6"/>
    <rect x="137" y="106" width="126" height="38" rx="12" fill="#252c30"/>
    <path d="M180 106V86h41q20 0 22 20" fill="none" stroke="#252c30" strokeWidth="14"/>
    <path d="M183 221h35m-35 20h25m-25 20h35" stroke="#f2f5ee" strokeWidth="4"/>
  </>;
  else if (/shirt|cloth|tee|workout/.test(text)) shape = <>
    <path d="m142 108-72 42 29 73 38-18-9 145h144l-9-145 38 18 29-73-72-42-22 12h-72Z" fill="#353a45"/>
    <path d="M164 113q36 45 72 0" fill="none" stroke="#747b88" strokeWidth="8"/>
    <path d="m141 150 8 53-5 122m113-175-8 53 5 122" fill="none" stroke="#555d6b" strokeWidth="3"/>
    <path d="M164 181h72m-61 9h49" stroke="#a9aebb" strokeWidth="3"/>
    <path d="M139 339h122" stroke="#1f232b" strokeWidth="6"/>
  </>;
  else shape = <><path d="M113 163h174l15 181H98Z" fill="#cfbcc6"/><path d="M151 163v-28a49 49 0 0 1 98 0v28" fill="none" stroke="#67505e" strokeWidth="12"/></>;
  return <svg className="product-artwork" viewBox="0 0 400 460" fill="none" aria-hidden="true">
    <ellipse cx="200" cy="373" rx="124" ry="10" fill="#282c3f12"/>
    <g stroke="#282c3f14" strokeWidth="1">{shape}</g>
  </svg>;
}