const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const money = n => "$" + Number(n || 0).toFixed(2);

const defaultState = {
  settings:{shop:"Rolling Wrench Diesel", phone:"260-502-6222", laborRate:135, serviceCall:250, tax:0, cardFee:0},
  truck:{unit:"No Active Truck", vin:"NONE", customer:"", engine:"Cummins X15", transmission:"", mileage:"", cpl:""},
  jobs:{
    job1:{name:"Job 1", customer:"", seconds:0, running:false, saved:[], status:"READY"},
    job2:{name:"Job 2", customer:"", seconds:0, running:false, saved:[], status:"READY"},
    job3:{name:"Job 3", customer:"", seconds:0, running:false, saved:[], status:"READY"}
  },
  invoices:[], quotes:[], workorders:[], customers:[], schedule:[], parts:[], notes:[], pins:[], pm:[]
};
let state = JSON.parse(localStorage.getItem("RWD_V41_STATE") || JSON.stringify(defaultState));
function saveState(){ localStorage.setItem("RWD_V41_STATE", JSON.stringify(state)); }
function toast(msg){ const t=$("#toast"); if(!t)return; t.textContent=msg; t.classList.add("show"); clearTimeout(window.__t); window.__t=setTimeout(()=>t.classList.remove("show"),1300); }
function formatTime(sec){ sec=Math.max(0,Math.floor(sec||0)); const h=String(Math.floor(sec/3600)).padStart(2,"0"), m=String(Math.floor(sec%3600/60)).padStart(2,"0"), s=String(sec%60).padStart(2,"0"); return `${h}:${m}:${s}`; }
function totalSeconds(){ return totalContinuousSeconds(); }
function clockDollars(sec){ return (Number(sec||0)/3600) * Number(state.settings.laborRate||135); }
function totalInvoiceMoney(){ return state.invoices.reduce((a,i)=>a+Number(i.total||0),0); }
function homeEarnings(){ return totalInvoiceMoney() + clockDollars(totalSeconds()); }
function setRoute(route){ location.hash = route; render(route); }
function currentRoute(){ return (location.hash || "#home").replace("#","") || "home"; }

const modules = [
  ["truck","🔎","VIN Lookup","Decode / save truck"],
  ["parts","🔧","Parts Lookup","Parts + cross refs"],
  ["fault","⚕","Fault Doctor","SPN/FMI workflow"],
  ["repairhud","🛠","Repair HUD","Procedures + memory"],
  ["quotes","▣","Smart Quotes","Build estimate"],
  ["workorders","▤","Work Orders","Job workflow"],
  ["invoices","▥","Invoices","Paper bill"],
  ["camera","📷","Camera / OCR","Scan VIN / part"],
  ["pindrop","📍","Pin Drop","Broken truck location"],
  ["schedule","📅","Schedule","Calendar + jobs"],
  ["customers","👥","Customers","Fleet contacts"],
  ["reports","▥","Reports","Income + labor"],
  ["memory","🧠","Repair Memory","Saved fixes"],
  ["suppliers","🚚","Suppliers","FleetPride etc."],
  ["pmdue","🔔","PM Due","Service reminders"],
  ["settings","⚙","Settings","Shop defaults"]
];

function pageHead(title, saveId="", clearHandler=true){
  return `<div class="page-head">
    <button class="action-btn" data-route="home">← Back</button>
    <h2>${title}</h2>
    ${clearHandler ? `<button class="action-btn clear" data-clear-screen>Clear</button>` : ""}
    ${saveId ? `<button class="action-btn primary" id="${saveId}">Save</button>` : ""}
  </div>`;
}
function bindPageTools(){
  $$("[data-clear-screen]").forEach(b=>b.onclick=()=>{
    const root=$("#screen");
    root.querySelectorAll("input,textarea").forEach(el=>el.value="");
    root.querySelectorAll("select").forEach(el=>el.selectedIndex=0);
    toast("Screen cleared");
  });
}
function panelOutput(text){ return `<div class="output">${text || ""}</div>`; }


/* ===== V8.6 SAFE FEATURES ===== */
function v86Ensure(){
  if(typeof rwdV85NormalizeState === "function") rwdV85NormalizeState();
  state.v86 = state.v86 || {};
  state.v86.clock = Object.assign({seconds:0,running:false,startTs:null,sessions:[]}, state.v86.clock || {});
  state.v86.quoteLinks = state.v86.quoteLinks || [];
  state.repairMemory = Array.isArray(state.repairMemory) ? state.repairMemory : [];
  state.schedule = Array.isArray(state.schedule) ? state.schedule : [];
  state.customers = Array.isArray(state.customers) ? state.customers : [];
  state.quotes = Array.isArray(state.quotes) ? state.quotes : [];
  state.invoices = Array.isArray(state.invoices) ? state.invoices : [];
}
function v86Money(n){ return "$" + Number(n||0).toFixed(2); }
function v86ClockSeconds(){
  v86Ensure();
  const c=state.v86.clock;
  let s=Number(c.seconds||0);
  if(c.running && c.startTs) s += Math.floor((Date.now()-Number(c.startTs))/1000);
  return Math.max(0,s);
}
function v86Fmt(sec){
  sec=Math.floor(sec||0);
  const h=String(Math.floor(sec/3600)).padStart(2,"0");
  const m=String(Math.floor(sec%3600/60)).padStart(2,"0");
  const s=String(sec%60).padStart(2,"0");
  return `${h}:${m}:${s}`;
}
function v86SaveActiveMemory(){
  state.v86.activeTruck = Object.assign({}, state.truck||{});
  if(state.truck && state.truck.customer){
    const exists=(state.customers||[]).find(c=>(c.name||"")===state.truck.customer);
    if(!exists) state.customers.unshift({name:state.truck.customer,phone:"",email:"",notes:"Created from active truck",date:new Date().toLocaleString()});
  }
  saveState();
}
function v86SignatureBlock(prefix){
  return `<div class="v86-signature">
    <b>Customer / Driver Signature</b>
    <label>Printed Name<input id="${prefix}Signer" placeholder="Name"></label>
    <canvas id="${prefix}Pad"></canvas>
    <div class="v86-actions"><button id="${prefix}ClearSig">Clear</button><button class="primary" id="${prefix}SaveSig">Save Signature</button></div>
    <div id="${prefix}SigPreview"></div>
  </div>`;
}
function v86SetupSig(prefix){
  const c=document.getElementById(prefix+"Pad"); if(!c) return;
  const ctx=c.getContext("2d"); let down=false,last=null;
  function fit(){ const r=c.getBoundingClientRect(); c.width=Math.max(300,Math.floor(r.width*devicePixelRatio)); c.height=Math.floor(170*devicePixelRatio); ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); ctx.lineWidth=3; ctx.lineCap="round"; ctx.strokeStyle="#111923"; }
  setTimeout(fit,50);
  function p(e){const r=c.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top};}
  function start(e){e.preventDefault();down=true;last=p(e)}
  function move(e){if(!down)return;e.preventDefault();const pt=p(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(pt.x,pt.y);ctx.stroke();last=pt}
  function stop(){down=false}
  c.addEventListener("mousedown",start);c.addEventListener("mousemove",move);c.addEventListener("mouseup",stop);c.addEventListener("mouseleave",stop);
  c.addEventListener("touchstart",start,{passive:false});c.addEventListener("touchmove",move,{passive:false});c.addEventListener("touchend",stop);
  document.getElementById(prefix+"ClearSig").onclick=()=>{ctx.clearRect(0,0,c.width,c.height); state[prefix+"Signature"]=null; saveState(); document.getElementById(prefix+"SigPreview").innerHTML="";};
  document.getElementById(prefix+"SaveSig").onclick=()=>{state[prefix+"Signature"]={data:c.toDataURL("image/png"),name:document.getElementById(prefix+"Signer").value,date:new Date().toLocaleString()}; saveState(); document.getElementById(prefix+"SigPreview").innerHTML=`<small>Saved ${state[prefix+"Signature"].date}</small><img src="${state[prefix+"Signature"].data}">`; if(typeof toast==="function") toast("Signature saved");};
}
function v86QuoteFromFields(){
  const desc=document.getElementById("v86QuoteDesc")?.value || "Repair estimate";
  const hours=Number(document.getElementById("v86QuoteHours")?.value || 0);
  const rate=Number(document.getElementById("v86QuoteRate")?.value || state.settings?.laborRate || 135);
  const parts=Number(document.getElementById("v86QuoteParts")?.value || 0);
  const call=Number(document.getElementById("v86QuoteCall")?.value || state.settings?.serviceCall || 250);
  const supplies=Number(document.getElementById("v86QuoteSupplies")?.value || 0);
  const total=hours*rate+parts+call+supplies;
  return {id:Date.now(),customer:document.getElementById("v86QuoteCustomer")?.value || state.truck?.customer || "",truck:document.getElementById("v86QuoteTruck")?.value || state.truck?.unit || "",desc,hours,rate,parts,call,supplies,total,date:new Date().toLocaleString(),status:"Draft",signature:state.v86QuoteSignature||null};
}
function v86RenderQuotePaper(q){
  return `<section class="v86-paper"><h2>ROLLING WRENCH DIESEL</h2><p>260-502-6222 • Mobile Diesel Repair</p><hr><h2>QUOTE</h2><p>${q.date||""}</p><p><b>Customer:</b> ${q.customer||"Customer"}</p><p><b>Truck:</b> ${q.truck||"Truck"}</p><p><b>Job:</b> ${q.desc||""}</p><div class="v86-line head"><b>Description</b><b>Qty/Rate</b><b>Total</b></div><div class="v86-line"><span>Labor</span><span>${q.hours||0} hrs @ ${v86Money(q.rate||0)}</span><span>${v86Money((q.hours||0)*(q.rate||0))}</span></div><div class="v86-line"><span>Service Call</span><span>1</span><span>${v86Money(q.call||0)}</span></div><div class="v86-line"><span>Parts</span><span>1</span><span>${v86Money(q.parts||0)}</span></div><div class="v86-line"><span>Supplies / Fees</span><span>1</span><span>${v86Money(q.supplies||0)}</span></div><div class="total">Estimated Total ${v86Money(q.total||0)}</div><div class="disclaimer"><b>Estimate Disclaimer:</b> Price may vary due to additional labor, hidden damage, seized hardware, parts availability, taxes, fees, and extra approved work.</div>${q.signature?.data?`<div class="v86-signature"><b>Signed By:</b> ${q.signature.name||""}<br><small>${q.signature.date||""}</small><img src="${q.signature.data}"></div>`:""}</section>`;
}

/* ===== V8.7 AI PREVIEW WORKFLOW ===== */
function v87Ensure(){
  if(typeof v86Ensure === "function") v86Ensure();
  state.v87 = state.v87 || {};
  state.v87.pending = state.v87.pending || null;
  state.brainChats = Array.isArray(state.brainChats) ? state.brainChats : [];
}
function v87Money(n){ return "$" + Number(n||0).toFixed(2); }
function v87Intent(text){
  const q=String(text||"").toLowerCase();
  if(q.includes("invoice") || q.includes("bill")) return "invoice";
  if(q.includes("quote") || q.includes("estimate")) return "quote";
  if(q.includes("send to invoice") || q.includes("save to invoice")) return "toInvoice";
  if(q.includes("send to quote") || q.includes("save to quote")) return "toQuote";
  if(q.includes("signature")) return "signature";
  if(q.includes("payment")) return "payment";
  return "general";
}
function v87BuildPreview(text,type){
  const q=String(text||"");
  const low=q.toLowerCase();
  let hours=2.0;
  let title=type==="quote" ? "Quote Preview" : "Invoice Preview";
  let parts="Parts/materials to verify";
  if(low.includes("clutch")){hours=11.5; title=type==="quote"?"Clutch Quote Preview":"Clutch Invoice Preview"; parts="Clutch kit, pilot bearing, release bearing, flywheel inspection, shop supplies";}
  if(low.includes("water pump")){hours=4.0; title=type==="quote"?"Water Pump Quote Preview":"Water Pump Invoice Preview"; parts="Water pump, belt if needed, coolant, gaskets/seals, shop supplies";}
  if(low.includes("wheel seal")){hours=2.5; title=type==="quote"?"Wheel Seal Quote Preview":"Wheel Seal Invoice Preview"; parts="Wheel seal, hub oil, brake clean, shop supplies";}
  const rate=Number(state.settings?.laborRate||135);
  const service=Number(state.settings?.serviceCall||250);
  const partsTotal=0;
  const supplies=type==="invoice" ? 25 : 25;
  const total=hours*rate+service+partsTotal+supplies;
  return {
    id:Date.now(),
    type,
    title,
    customer:state.truck?.customer || "",
    truck:state.truck?.unit || "",
    vin:state.truck?.vin || "",
    engine:state.truck?.engine || "",
    work:q,
    hours,
    rate,
    service,
    parts,
    partsTotal,
    supplies,
    total,
    date:new Date().toLocaleString(),
    status:"Preview"
  };
}
function v87PreviewHtml(p){
  return `<div class="ai-preview-card">
    <h3>${p.title}</h3>
    <div class="ai-preview-paper">
      <h2>ROLLING WRENCH DIESEL</h2>
      <small>260-502-6222 • Mobile Diesel Repair</small>
      <hr>
      <p><b>Customer:</b> ${p.customer || "Add customer"}</p>
      <p><b>Truck:</b> ${p.truck || "Add truck"} ${p.vin || ""}</p>
      <p><b>Engine:</b> ${p.engine || "Verify engine"}</p>
      <p><b>Work:</b> ${p.work}</p>
      <div class="row"><span>Labor ${p.hours} hrs @ ${v87Money(p.rate)}/hr</span><b>${v87Money(p.hours*p.rate)}</b></div>
      <div class="row"><span>Service Call</span><b>${v87Money(p.service)}</b></div>
      <div class="row"><span>Parts / Materials<br><small>${p.parts}</small></span><b>${v87Money(p.partsTotal)}</b></div>
      <div class="row"><span>Supplies / Fees</span><b>${v87Money(p.supplies)}</b></div>
      <div class="total">${p.type==="quote" ? "Estimated Total" : "Total Due"} ${v87Money(p.total)}</div>
      <p><small><b>Note:</b> Review before sending. Price may vary due to added labor, hidden damage, parts availability, taxes/fees, or approved extra work.</small></p>
    </div>
    <div class="ai-preview-actions">
      <button class="primary" data-v87-action="toInvoice">Send to Invoices</button>
      <button class="primary" data-v87-action="toQuote">Send to Quotes</button>
      <button data-v87-action="signature">Send for Signature</button>
      <button data-v87-action="payment">Send for Payment</button>
      <button data-v87-action="edit">Edit</button>
      <button data-v87-action="discard">Discard</button>
    </div>
  </div>`;
}
function v87Push(role,text,kind,meta){
  state.brainChats = state.brainChats || [];
  state.brainChats.push({role,text,kind:kind||"",meta:meta||null,date:new Date().toLocaleString()});
  saveState();
}
function v87SavePending(target){
  v87Ensure();
  const p=state.v87.pending;
  if(!p) return false;
  if(target==="invoice"){
    state.invoices.unshift({customer:p.customer,truck:p.truck,work:p.work,parts:p.parts,total:p.total,date:p.date,fromAI:true,status:"Draft"});
    saveState();
    return true;
  }
  if(target==="quote"){
    state.quotes.unshift({customer:p.customer,truck:p.truck,desc:p.work,hours:p.hours,rate:p.rate,parts:p.parts,call:p.service,supplies:p.supplies,total:p.total,date:p.date,fromAI:true,status:"Draft"});
    saveState();
    return true;
  }
  return false;
}
function v87RunAI(text){
  v87Ensure();
  text=String(text||"").trim();
  if(!text) return;
  const q=text.toLowerCase();
  if(["clear","clear chat","new chat"].includes(q)){
    state.brainChats=[]; state.v87.pending=null; saveState(); renderV87AI(); return;
  }
  if(["send to invoices","send to invoice","save to invoices","save to invoice"].includes(q)){
    const ok=v87SavePending("invoice");
    v87Push("ai", ok ? "Done. I sent that preview to Invoices." : "No preview found. Build an invoice first.");
    renderV87AI(); return;
  }
  if(["send to quotes","send to quote","save to quotes","save to quote"].includes(q)){
    const ok=v87SavePending("quote");
    v87Push("ai", ok ? "Done. I sent that preview to Quotes." : "No preview found. Build a quote first.");
    renderV87AI(); return;
  }
  v87Push("user",text);
  const intent=v87Intent(text);
  if(intent==="invoice" || intent==="quote"){
    const p=v87BuildPreview(text,intent);
    state.v87.pending=p;
    v87Push("ai",`I built a ${intent} preview. Review it on screen first. If you like it, say “send to invoices” or “send to quotes”.`);
    v87Push("ai","preview","preview",p);
  }else{
    v87Push("ai","I can answer questions, build an invoice preview, build a quote preview, then send it to Invoices or Quotes when you approve it.");
  }
  saveState();
  renderV87AI();
}

/* ===== V8.8 REAL AI BACKEND CONNECTIONS ===== */
function v88Ensure(){
  if(typeof v87Ensure === "function") v87Ensure();
  state.backend = Object.assign({
    aiEndpoint:"",
    aiKey:"",
    webEndpoint:"",
    webKey:"",
    visionEndpoint:"",
    visionKey:"",
    ocrEndpoint:"",
    ocrKey:"",
    partsEndpoint:"",
    partsKey:"",
    supabaseUrl: state.backend?.supabaseUrl || "",
    supabaseAnon: state.backend?.supabaseAnon || ""
  }, state.backend || {});
  state.v88 = state.v88 || {lastBackendTest:"", lastTool:"local"};
}
function v88Has(url){ return !!String(url||"").trim(); }
async function v88Post(url,key,payload){
  const headers={"Content-Type":"application/json"};
  if(key) headers["Authorization"]="Bearer "+key;
  const res = await fetch(url,{method:"POST",headers,body:JSON.stringify(payload)});
  const text = await res.text();
  let data;
  try{ data=JSON.parse(text); }catch(e){ data={text}; }
  if(!res.ok) throw new Error(data.error || data.message || text || ("HTTP "+res.status));
  return data;
}
function v88Context(){
  return {
    truck:state.truck||{},
    settings:state.settings||{},
    pending:state.v87?.pending||null,
    recentQuotes:(state.quotes||[]).slice(-5),
    recentInvoices:(state.invoices||[]).slice(-5),
    repairMemory:(state.repairMemory||[]).slice(0,10)
  };
}
function v88NeedWeb(text){
  const q=String(text||"").toLowerCase();
  return q.includes("near me") || q.includes("price") || q.includes("current") || q.includes("today") || q.includes("this year") || q.includes("find me") || q.includes("supplier") || q.includes("where can i buy") || q.includes("who won");
}
function v88NeedParts(text){
  const q=String(text||"").toLowerCase();
  return q.includes("part") || q.includes("water pump") || q.includes("belt") || q.includes("clutch") || q.includes("sensor") || q.includes("filter") || q.includes("supplier");
}
async function v88AnswerAnything(text, files){
  v88Ensure();
  const ctx=v88Context();
  const q=String(text||"");
  const payload={prompt:q, question:q, context:ctx, files:files||[], instruction:"Answer anything like ChatGPT/Gemini/Google. If user asks for quote/invoice, return preview data plus normal answer. If question needs current information, use web/search endpoint if available."};

  if(v88NeedParts(q) && v88Has(state.backend.partsEndpoint)){
    state.v88.lastTool="parts";
    const data=await v88Post(state.backend.partsEndpoint,state.backend.partsKey,payload);
    return data.answer || data.text || data.message || JSON.stringify(data,null,2);
  }
  if(v88NeedWeb(q) && v88Has(state.backend.webEndpoint)){
    state.v88.lastTool="web";
    const data=await v88Post(state.backend.webEndpoint,state.backend.webKey,payload);
    return data.answer || data.text || data.message || JSON.stringify(data,null,2);
  }
  if(v88Has(state.backend.aiEndpoint)){
    state.v88.lastTool="ai";
    const data=await v88Post(state.backend.aiEndpoint,state.backend.aiKey,payload);
    return data.answer || data.text || data.message || JSON.stringify(data,null,2);
  }
  state.v88.lastTool="local";
  return "";
}
function v88LocalAnything(text){
  const q=String(text||"").toLowerCase();
  if(q.includes("low boost")){
    return `Low boost on a Cummins X15 is commonly caused by:
1. Charge air cooler leak or boot/clamp leak
2. Exhaust leak before turbo
3. VGT actuator/turbo vane issue
4. Bad boost/MAP sensor reading
5. Intake restriction
6. EGR valve stuck open
7. Fuel restriction/low fuel delivery
8. Derate or aftertreatment restriction

Checks:
- Check boost under load
- Pressure test CAC
- Inspect boots for oil tracks/splits
- Run VGT sweep
- Compare commanded vs actual turbo position
- Check codes and derate status`;
  }
  if(q.includes("invoice")) return "I can build the invoice preview here first. Tell me the work performed, labor time, parts, customer, and truck.";
  if(q.includes("quote")) return "I can build the quote preview here first. Tell me the job, truck, customer, labor/parts if known.";
  return "Backend AI is not connected yet. I can still build quotes/invoices and answer saved diesel fallback questions, but 'answer anything' needs the AI/Web endpoint saved in Backend Connections.";
}
async function v88RunAI(text){
  v88Ensure();
  text=String(text||"").trim();
  if(!text) return;
  const lower=text.toLowerCase();
  if(["clear","clear chat","new chat"].includes(lower)){
    state.brainChats=[]; state.v87.pending=null; saveState(); renderV88AI(); return;
  }
  if(["send to invoices","send to invoice","save to invoices","save to invoice"].includes(lower)){
    const ok=v87SavePending("invoice");
    v87Push("ai", ok ? "Done. I sent that preview to Invoices." : "No preview found. Build an invoice first.");
    renderV88AI(); return;
  }
  if(["send to quotes","send to quote","save to quotes","save to quote"].includes(lower)){
    const ok=v87SavePending("quote");
    v87Push("ai", ok ? "Done. I sent that preview to Quotes." : "No preview found. Build a quote first.");
    renderV88AI(); return;
  }
  v87Push("user",text);
  const intent=v87Intent(text);
  if(intent==="invoice" || intent==="quote"){
    const p=v87BuildPreview(text,intent);
    state.v87.pending=p;
    v87Push("ai",`I built a ${intent} preview. Review it on screen first. If you like it, say “send to invoices” or “send to quotes”.`);
    v87Push("ai","preview","preview",p);
    saveState(); renderV88AI(); return;
  }
  try{
    const live=await v88AnswerAnything(text);
    v87Push("ai", live || v88LocalAnything(text));
  }catch(e){
    v87Push("ai", v88LocalAnything(text)+"\n\nBackend error: "+e.message);
  }
  saveState();
  renderV88AI();
}
function renderV88AI(){
  v88Ensure();
  document.body.classList.add("rw-ai-mode");
  const ctx=`${state.truck?.customer||"No customer"} • ${state.truck?.unit||"No truck"} • ${state.truck?.engine||"Engine unknown"}`;
  const live = v88Has(state.backend.aiEndpoint) ? `<span class="ai-live-badge">AI Connected</span>` : `<span class="ai-offline-badge">Local / Setup Needed</span>`;
  $("#screen").innerHTML = `<section class="rw8-shell">
    <div class="rw8-head"><div class="rw8-brand"><div class="rw8-logo">RW</div><div><b>Rolling Wrench AI</b><small>${ctx}</small></div></div><div>${live}<button class="clear" id="v88Clear">Clear</button><button id="v88Close">Close</button></div></div>
    <div class="rw8-thread" id="v88Thread">
      <div class="rw8-chips">
        <button data-v88-chip="Build me an invoice for replacing water pump and belt">Invoice Preview</button>
        <button data-v88-chip="Build me a quote for clutch replacement on a 2014 Peterbilt ISX">Quote Preview</button>
        <button data-v88-chip="What causes low boost on a Cummins X15?">Diesel Question</button>
        <button data-v88-chip="Who won the Indy 500 this year?">General / Web</button>
        <button data-route="vision">Photo</button>
        <button data-route="backendconnections">Backend</button>
      </div>
      ${(state.brainChats||[]).map(m=>{
        if(m.kind==="preview") return v87PreviewHtml(m.meta);
        return `<div class="msg ${m.role==="user"?"user":"ai"}"><b>${m.role==="user"?"You":"RW AI"}</b>${String(m.text||"").replace(/\\n/g,"\n")}</div>`;
      }).join("") || `<div class="msg ai"><b>RW AI</b>Ask me anything. I’ll answer general questions through backend AI/Web when connected, and I’ll preview invoices/quotes before saving them.</div>`}
    </div>
    <div class="rw8-compose"><button class="plus" id="v88Plus">+</button><div class="inputbox"><input id="v88Input" placeholder="Ask Rolling Wrench AI anything..."><button class="mic" id="v88Mic">🎙</button></div><button class="sendbtn" id="v88Send">➤</button></div>
  </section>`;
  bindPageTools && bindPageTools();
  const th=$("#v88Thread"); if(th) th.scrollTop=th.scrollHeight;
  $("#v88Send").onclick=()=>v88RunAI($("#v88Input").value);
  $("#v88Input").onkeydown=e=>{if(e.key==="Enter")v88RunAI($("#v88Input").value);};
  $("#v88Clear").onclick=()=>{state.brainChats=[];state.v87.pending=null;saveState();renderV88AI();};
  $("#v88Close").onclick=()=>{document.body.classList.remove("rw-ai-mode");setRoute("home");};
  $("#v88Plus").onclick=()=>setRoute("vision");
  $("#v88Mic").onclick=()=>{ if(typeof startVoiceToField==="function") startVoiceToField("v88Input"); else $("#v88Input").focus(); };
  $$("[data-v88-chip]").forEach(b=>b.onclick=()=>v88RunAI(b.dataset.v88Chip));
  $$("[data-v87-action]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.v87Action;
    if(a==="toInvoice"){v87SavePending("invoice");saveState();setRoute("invoices");}
    if(a==="toQuote"){v87SavePending("quote");saveState();setRoute("quotes");}
    if(a==="signature"){v87SavePending(state.v87.pending?.type==="quote"?"quote":"invoice");saveState();setRoute(state.v87.pending?.type==="quote"?"quotes":"invoices");}
    if(a==="payment"){v87SavePending("invoice");saveState();setRoute("invoices");}
    if(a==="edit"){v87Push("ai","Tell me what to change, like: add 2 hours labor, remove service call, or change customer name.");saveState();renderV88AI();}
    if(a==="discard"){state.v87.pending=null;v87Push("ai","Preview discarded.");saveState();renderV88AI();}
  });
}
function renderBackendConnections(){
  v88Ensure();
  $("#screen").innerHTML = `${pageHead("Backend Connections","saveBackendConnections")}
  <section class="backend-box form-grid">
    <h3>Answer Anything AI</h3>
    <small>Connect your real AI backend here. This is what lets RW AI answer anything like ChatGPT/Gemini.</small>
    <label>AI Endpoint<input id="v88AiEndpoint" value="${state.backend.aiEndpoint||""}" placeholder="https://your-backend.com/ai"></label>
    <label>AI Key<input id="v88AiKey" value="${state.backend.aiKey||""}" placeholder="optional"></label>
  </section>
  <section class="backend-box form-grid">
    <h3>Google/Web Search</h3>
    <small>Used when the question needs current info, suppliers, prices, news, who won, near me, etc.</small>
    <label>Web Search Endpoint<input id="v88WebEndpoint" value="${state.backend.webEndpoint||""}" placeholder="https://your-backend.com/search"></label>
    <label>Web Search Key<input id="v88WebKey" value="${state.backend.webKey||""}"></label>
  </section>
  <section class="backend-box form-grid">
    <h3>Photo / Vision / OCR</h3>
    <small>Used for part photos, VIN plates, invoices, fault screens, documents.</small>
    <label>Vision Endpoint<input id="v88VisionEndpoint" value="${state.backend.visionEndpoint||""}" placeholder="https://your-backend.com/vision"></label>
    <label>Vision Key<input id="v88VisionKey" value="${state.backend.visionKey||""}"></label>
    <label>OCR Endpoint<input id="v88OcrEndpoint" value="${state.backend.ocrEndpoint||""}" placeholder="https://your-backend.com/ocr"></label>
    <label>OCR Key<input id="v88OcrKey" value="${state.backend.ocrKey||""}"></label>
  </section>
  <section class="backend-box form-grid">
    <h3>Parts Search</h3>
    <small>Used for diesel/gas parts, suppliers, cross references, local price checks.</small>
    <label>Parts Endpoint<input id="v88PartsEndpoint" value="${state.backend.partsEndpoint||""}" placeholder="https://your-backend.com/parts"></label>
    <label>Parts Key<input id="v88PartsKey" value="${state.backend.partsKey||""}"></label>
  </section>
  <section class="backend-box">
    <h3>Status</h3>
    <p><span class="backend-status-dot ${v88Has(state.backend.aiEndpoint)?"ok":"bad"}"></span>AI Backend</p>
    <p><span class="backend-status-dot ${v88Has(state.backend.webEndpoint)?"ok":"bad"}"></span>Web Search</p>
    <p><span class="backend-status-dot ${v88Has(state.backend.visionEndpoint)?"ok":"bad"}"></span>Vision</p>
    <p><span class="backend-status-dot ${v88Has(state.backend.partsEndpoint)?"ok":"bad"}"></span>Parts</p>
    <div class="backend-test-row"><label>Test Question<input id="v88TestQuestion" value="What causes low boost on a Cummins X15?"></label><button class="v86-btn primary" id="v88TestBackend">Test</button></div>
    <div class="backend-output" id="v88BackendOutput">${state.v88.lastBackendTest||"No test run yet."}</div>
  </section>`;
  bindPageTools && bindPageTools();
  $("#saveBackendConnections").onclick=()=>{
    state.backend.aiEndpoint=$("#v88AiEndpoint").value; state.backend.aiKey=$("#v88AiKey").value;
    state.backend.webEndpoint=$("#v88WebEndpoint").value; state.backend.webKey=$("#v88WebKey").value;
    state.backend.visionEndpoint=$("#v88VisionEndpoint").value; state.backend.visionKey=$("#v88VisionKey").value;
    state.backend.ocrEndpoint=$("#v88OcrEndpoint").value; state.backend.ocrKey=$("#v88OcrKey").value;
    state.backend.partsEndpoint=$("#v88PartsEndpoint").value; state.backend.partsKey=$("#v88PartsKey").value;
    saveState(); if(typeof toast==="function") toast("Backend saved"); renderBackendConnections();
  };
  $("#v88TestBackend").onclick=async()=>{
    $("#v88BackendOutput").textContent="Testing...";
    try{
      const ans=await v88AnswerAnything($("#v88TestQuestion").value);
      state.v88.lastBackendTest=ans||v88LocalAnything($("#v88TestQuestion").value);
      $("#v88BackendOutput").textContent=state.v88.lastBackendTest;
      saveState();
    }catch(e){
      state.v88.lastBackendTest="Backend test failed: "+e.message;
      $("#v88BackendOutput").textContent=state.v88.lastBackendTest;
      saveState();
    }
  };
}

function renderV87AI(){
  v87Ensure();
  document.body.classList.add("rw-ai-mode");
  const ctx=`${state.truck?.customer||"No customer"} • ${state.truck?.unit||"No truck"} • ${state.truck?.engine||"Engine unknown"}`;
  $("#screen").innerHTML = `<section class="rw8-shell">
    <div class="rw8-head"><div class="rw8-brand"><div class="rw8-logo">RW</div><div><b>Rolling Wrench AI</b><small>${ctx}</small></div></div><div><button class="clear" id="v87Clear">Clear</button><button id="v87Close">Close</button></div></div>
    <div class="rw8-thread" id="v87Thread">
      <div class="rw8-chips">
        <button data-v87-chip="Build me an invoice for replacing water pump and belt">Invoice Preview</button>
        <button data-v87-chip="Build me a quote for clutch replacement on a 2014 Peterbilt ISX">Quote Preview</button>
        <button data-v87-chip="What causes low boost on a Cummins X15?">Ask Anything</button>
        <button data-route="vision">Photo</button>
      </div>
      ${(state.brainChats||[]).map(m=>{
        if(m.kind==="preview") return v87PreviewHtml(m.meta);
        return `<div class="msg ${m.role==="user"?"user":"ai"}"><b>${m.role==="user"?"You":"RW AI"}</b>${String(m.text||"").replace(/\\n/g,"\n")}</div>`;
      }).join("") || `<div class="msg ai"><b>RW AI</b>Ask me to build an invoice or quote. I’ll show it here first, then you choose where to send it.</div>`}
    </div>
    <div class="rw8-compose"><button class="plus" id="v87Plus">+</button><div class="inputbox"><input id="v87Input" placeholder="Ask Rolling Wrench AI anything..."><button class="mic">🎙</button></div><button class="sendbtn" id="v87Send">➤</button></div>
  </section>`;
  bindPageTools && bindPageTools();
  const th=$("#v87Thread"); if(th) th.scrollTop=th.scrollHeight;
  $("#v87Send").onclick=()=>v87RunAI($("#v87Input").value);
  $("#v87Input").onkeydown=e=>{if(e.key==="Enter")v87RunAI($("#v87Input").value);};
  $("#v87Clear").onclick=()=>{state.brainChats=[];state.v87.pending=null;saveState();renderV87AI();};
  $("#v87Close").onclick=()=>{document.body.classList.remove("rw-ai-mode");setRoute("home");};
  $("#v87Plus").onclick=()=>setRoute("vision");
  $$("[data-v87-chip]").forEach(b=>b.onclick=()=>v87RunAI(b.dataset.v87Chip));
  $$("[data-v87-action]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.v87Action;
    if(a==="toInvoice"){v87SavePending("invoice");saveState();setRoute("invoices");}
    if(a==="toQuote"){v87SavePending("quote");saveState();setRoute("quotes");}
    if(a==="signature"){v87SavePending(state.v87.pending?.type==="quote"?"quote":"invoice");saveState();setRoute(state.v87.pending?.type==="quote"?"quotes":"invoices");}
    if(a==="payment"){v87SavePending("invoice");saveState();setRoute("invoices");}
    if(a==="edit"){v87Push("ai","Tell me what to change, like: add 2 hours labor, remove service call, or change customer name.");saveState();renderV87AI();}
    if(a==="discard"){state.v87.pending=null;v87Push("ai","Preview discarded.");saveState();renderV87AI();}
  });
}

function renderV86Quotes(){
  v86Ensure();
  $("#screen").innerHTML = `${pageHead("V8.6 Smart Quotes","v86SaveQuote")}
  <section class="v86-card form-grid">
    <label>Customer<input id="v86QuoteCustomer" value="${state.truck?.customer||""}"></label>
    <label>Truck<input id="v86QuoteTruck" value="${state.truck?.unit||""} ${state.truck?.vin||""}"></label>
    <label>Job Description<textarea id="v86QuoteDesc" placeholder="Clutch replacement, water pump, wheel seal..."></textarea></label>
    <div class="v86-grid"><label>Hours<input id="v86QuoteHours" type="number" step=".1" value="3"></label><label>Rate<input id="v86QuoteRate" type="number" value="${state.settings?.laborRate||135}"></label></div>
    <div class="v86-grid"><label>Service Call<input id="v86QuoteCall" type="number" value="${state.settings?.serviceCall||250}"></label><label>Parts<input id="v86QuoteParts" type="number" value="0"></label></div>
    <label>Supplies / Fees<input id="v86QuoteSupplies" type="number" value="25"></label>
    <div class="v86-actions"><button id="v86AiQuote">AI Fill</button><button class="primary" id="v86PreviewQuote">Preview</button></div>
    ${v86SignatureBlock("v86Quote")}
    <div id="v86QuotePreview"></div>
  </section>
  <section class="v86-card"><h3>Saved Quotes</h3>${state.quotes.length?state.quotes.slice().reverse().map(v86RenderQuotePaper).join(""):"<p>No saved quotes yet.</p>"}</section>`;
  bindPageTools && bindPageTools();
  v86SetupSig("v86Quote");
  document.getElementById("v86AiQuote").onclick=()=>{const t=document.getElementById("v86QuoteDesc").value.toLowerCase(); if(t.includes("clutch")){v86QuoteHours.value=11.5;v86QuoteSupplies.value=45;} if(t.includes("water pump")){v86QuoteHours.value=4;v86QuoteSupplies.value=35;} if(t.includes("wheel seal")){v86QuoteHours.value=2.5;v86QuoteSupplies.value=25;} if(typeof toast==="function") toast("AI filled quote");};
  document.getElementById("v86PreviewQuote").onclick=()=>{document.getElementById("v86QuotePreview").innerHTML=v86RenderQuotePaper(v86QuoteFromFields());};
  document.getElementById("v86SaveQuote").onclick=()=>{const q=v86QuoteFromFields(); state.quotes.push(q); state.v86.quoteLinks.push({id:q.id,status:"Draft",date:q.date,customer:q.customer}); v86SaveActiveMemory(); saveState(); if(typeof toast==="function") toast("Quote saved"); renderV86Quotes();};
}
function renderV86Memory(){
  v86Ensure();
  $("#screen").innerHTML = `${pageHead("Repair Memory","v86SaveMemory")}
  <section class="v86-card form-grid">
    <label>Search<input id="v86MemSearch" placeholder="Search fault, engine, part, customer..."></label>
    <label>Problem<textarea id="v86MemProblem"></textarea></label>
    <label>Cause<textarea id="v86MemCause"></textarea></label>
    <label>Correction<textarea id="v86MemCorrection"></textarea></label>
    <label>Keywords<input id="v86MemKeywords" placeholder="X15, SPN, low boost, water pump"></label>
  </section>
  <section class="v86-card"><h3>Saved Memories</h3><div id="v86MemoryList"></div></section>`;
  bindPageTools && bindPageTools();
  function draw(){const q=(v86MemSearch.value||"").toLowerCase();v86MemoryList.innerHTML=(state.repairMemory||[]).filter(m=>JSON.stringify(m).toLowerCase().includes(q)).map((m,i)=>`<div class="v86-memory-item"><b>${m.problem||m.title||"Repair Memory"}</b><small>Cause: ${m.cause||""}\nCorrection: ${m.correction||""}\nKeywords: ${m.keywords||""}</small><div class="v86-actions"><button onclick="state.repairMemory.splice(${i},1);saveState();renderV86Memory()">Delete</button></div></div>`).join("")||"<p>No repair memories.</p>";}
  v86MemSearch.oninput=draw; draw();
  v86SaveMemory.onclick=()=>{state.repairMemory.unshift({id:Date.now(),problem:v86MemProblem.value,cause:v86MemCause.value,correction:v86MemCorrection.value,keywords:v86MemKeywords.value,truck:state.truck,date:new Date().toLocaleString()});saveState(); if(typeof toast==="function") toast("Memory saved"); renderV86Memory();};
}
function renderV86Clock(){
  v86Ensure();
  const c=state.v86.clock;
  $("#screen").innerHTML = `${pageHead("Time Clock","v86SaveClock")}
  <section class="v86-card">
    <div class="v86-clock-time" id="v86ClockTime">${v86Fmt(v86ClockSeconds())}</div>
    <div class="v86-actions"><button class="primary" id="v86StartClock">Start</button><button id="v86PauseClock">Pause</button><button id="v86StopClock">Stop</button><button id="v86ClearClock">Clear</button></div>
    <p class="muted">Clock saves between app restarts.</p>
  </section>
  <section class="v86-card"><h3>Saved Sessions</h3>${(c.sessions||[]).map(s=>`<div class="v86-memory-item"><b>${v86Fmt(s.seconds)}</b><small>${s.date} • ${v86Money((s.seconds/3600)*(state.settings?.laborRate||135))}</small></div>`).join("")||"<p>No saved sessions.</p>"}</section>`;
  bindPageTools && bindPageTools();
  v86StartClock.onclick=()=>{v86Ensure();const c=state.v86.clock;if(!c.running){c.running=true;c.startTs=Date.now();saveState();}renderV86Clock();};
  v86PauseClock.onclick=()=>{const c=state.v86.clock;c.seconds=v86ClockSeconds();c.running=false;c.startTs=null;saveState();renderV86Clock();};
  v86StopClock.onclick=()=>{const c=state.v86.clock;const s=v86ClockSeconds();c.sessions.unshift({seconds:s,date:new Date().toLocaleString()});c.seconds=0;c.running=false;c.startTs=null;saveState();renderV86Clock();};
  v86ClearClock.onclick=()=>{state.v86.clock={seconds:0,running:false,startTs:null,sessions:[]};saveState();renderV86Clock();};
  v86SaveClock.onclick=()=>{const c=state.v86.clock;const s=v86ClockSeconds();c.sessions.unshift({seconds:s,date:new Date().toLocaleString()});c.seconds=s;c.running=false;c.startTs=null;saveState(); if(typeof toast==="function") toast("Clock saved"); renderV86Clock();};
  setTimeout(()=>{ if(location.hash.includes("clock") || document.getElementById("v86ClockTime")){ const el=document.getElementById("v86ClockTime"); if(el) el.textContent=v86Fmt(v86ClockSeconds()); }},500);
}
function renderV86Schedule(){
  v86Ensure();
  $("#screen").innerHTML = `${pageHead("Schedule Board","v86SaveSchedule")}
  <section class="v86-card form-grid">
    <div class="v86-grid"><label>Date<input id="v86SchedDate" type="date"></label><label>Time<input id="v86SchedTime" type="time"></label></div>
    <label>Customer<input id="v86SchedCustomer" value="${state.truck?.customer||""}"></label>
    <label>Job<input id="v86SchedJob" placeholder="PM, roadside, clutch, brakes..."></label>
    <label>Location<input id="v86SchedLocation"></label>
  </section>
  <section class="v86-card"><h3>Upcoming</h3>${(state.schedule||[]).map((s,i)=>`<div class="v86-schedule-item"><b>${s.date||"--"} ${s.time||""} — ${s.customer||""}</b><small>${s.job||""}\n${s.location||""}</small><div class="v86-actions"><button onclick="state.schedule.splice(${i},1);saveState();renderV86Schedule()">Delete</button></div></div>`).join("")||"<p>No jobs scheduled.</p>"}</section>`;
  bindPageTools && bindPageTools();
  v86SaveSchedule.onclick=()=>{state.schedule.unshift({date:v86SchedDate.value,time:v86SchedTime.value,customer:v86SchedCustomer.value,job:v86SchedJob.value,location:v86SchedLocation.value});saveState(); if(typeof toast==="function") toast("Schedule saved"); renderV86Schedule();};
}
function renderV86Reports(){
  v86Ensure();
  const inv=(state.invoices||[]).reduce((a,i)=>a+Number(i.total||0),0);
  const q=(state.quotes||[]).reduce((a,i)=>a+Number(i.total||0),0);
  const clock=v86ClockSeconds()/3600*(state.settings?.laborRate||135);
  const vals=[inv,q,clock,75,150,225,300]; const max=Math.max(...vals,1);
  $("#screen").innerHTML = `${pageHead("Earnings Graph","",false)}
  <section class="v86-card"><h3>Weekly Earnings</h3><h2 class="green">${v86Money(inv+clock)}</h2><div class="v86-graph">${vals.map(v=>`<div class="v86-bar" style="height:${Math.max(8,(v/max)*100)}%"></div>`).join("")}</div><p class="muted">Invoices + active clock estimate</p></section>`;
  bindPageTools && bindPageTools();
}

function renderHome(){
  const t=state.truck;
  $("#screen").innerHTML = `
    <section class="top-status-grid">
      <article class="hero-card" data-route="clock">
        <h3>Time Clock</h3>
        <div class="big-time" id="homeTime">${formatTime(totalSeconds())}</div>
        <small>${Object.values(state.jobs).some(j=>j.running) ? "RUNNING" : "READY"}</small>
        <div class="money" id="homeMoney">${money(clockDollars(totalSeconds()))}</div>
        <button class="hero-action" data-route="clock">Open 3 Job Clock</button>
      </article>
      <article class="hero-card" data-route="truck">
        <h3>Active Truck</h3>
        <div class="truck-info-line"><span>Unit</span><b>${t.unit || "No Active Truck"}</b></div>
        <div class="truck-info-line"><span>VIN</span><b>${t.vin || "NONE"}</b></div>
        <div class="truck-info-line"><span>Engine</span><b>${t.engine || "----"}</b></div>
        <div class="truck-info-line"><span>Customer</span><b>${t.customer || "----"}</b></div>
        <button class="hero-action" data-route="truck">Truck Profile</button>
      </article>
      <article class="hero-card" data-route="settings">
        <h3>System</h3>
        <div class="ready-big">Ready</div>
        <div class="system-sub">Local save active</div>
        <button class="hero-action" data-route="settings">Settings</button>
      </article>
    </section>

    <div class="rwd-ai-bar clean-ai-bar" data-route="ai">
      <div class="ai-orb">RW</div>
      <div class="ai-copy">
        <strong>Ask anything...</strong>
        <span>Rolling Wrench AI</span>
      </div>
      <div class="ai-tools">
        <button type="button" data-route="ai">＋</button>
        <button type="button" data-route="ai">🎙</button>
        <button type="button" data-route="ai">📷</button>
      </div>
    </div>

    <section class="module-grid">
      ${modules.map(m=>`<button class="module-card" data-route="${m[0]}"><span class="icon">${m[1]}</span><b>${m[2]}</b><small>${m[3]}</small></button>`).join("")}
    </section>

    <section class="panel-grid">
      <article class="panel">
        <div class="panel-title"><span>Today's Schedule</span><button data-route="schedule">View</button></div>
        ${scheduleRows()}
      </article>
      <article class="panel">
        <div class="panel-title"><span>Recent Jobs</span><button data-route="workorders">Open</button></div>
        ${recentRows()}
      </article>
      <article class="panel">
        <div class="panel-title"><span>Earnings Summary</span><button data-route="reports">Finance</button></div>
        <div class="earnings-money">${money(homeEarnings())}</div>
        <small>Invoices + live clock estimate</small>
        <div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </article>
    </section>

    <section class="v5-hub-grid">
      <button class="v5-hub-card" data-route="sendquotes"><b>Send Quotes</b><small>Customer approval • signature • status</small></button>
      <button class="v5-hub-card" data-route="sendinvoices"><b>Send Invoices</b><small>Portal • payments • Square link</small></button>
      <button class="v5-hub-card" data-route="stability"><b>Stability Center</b><small>Button test • health check</small></button>
      <button class="v5-hub-card" data-route="externallinks"><b>External Links</b><small>Supabase customer links</small></button>
      <button class="v5-hub-card" data-route="backend"><b>Backend Center</b><small>Tables • storage • AI • OCR</small></button>
      <button class="v5-hub-card" data-route="communications"><b>Customer Messages</b><small>Text quote • invoice • GPS • payment</small></button>
      <button class="v5-hub-card" data-route="templates"><b>Message Templates</b><small>Default text messages</small></button>
      <button class="v5-hub-card" data-route="fileuploads"><b>File Uploads</b><small>Photos • docs • signatures</small></button>
      <button class="v5-hub-card" data-route="filehistory"><b>File History</b><small>Files by module</small></button>
      <button class="v5-hub-card" data-route="vision"><b>OCR + Vision</b><small>VIN • parts • invoices • faults</small></button>
      <button class="v5-hub-card" data-route="brain"><b>Ask Rolling Wrench AI</b><small>ChatGPT-style command center</small></button>
      <button class="v5-hub-card" data-route="brainsettings"><b>Brain Settings</b><small>AI / OCR endpoints</small></button>
      <button class="v5-hub-card" data-route="memorylibrary"><b>Repair Memory Library</b><small>Search • edit • archive • AI</small></button>
      <button class="v5-hub-card" data-route="cleanup"><b>Data Cleanup</b><small>Delete test records</small></button>
      <button class="v5-hub-card" data-route="visionsettings"><b>Vision Settings</b><small>OCR / AI endpoints</small></button>
      <button class="v5-hub-card" data-route="account"><b>Account / Roles</b><small>Login • users • permissions</small></button>
      <button class="v5-hub-card" data-route="dashboard"><b>Business Dashboard</b><small>Revenue • quotes • invoices • jobs</small></button>
      <button class="v5-hub-card" data-route="aioperator"><b>AI Operator</b><small>Ask AI to build anything</small></button>
      <button class="v5-hub-card" data-route="v52"><b>V5.2 Engine</b><small>AI • OCR • files • GPS • cloud</small></button>
      <button class="v5-hub-card" data-route="workflow"><b>Workflow Hub</b><small>Customer → Truck → WO → Quote → Invoice</small></button>
      <button class="v5-hub-card" data-route="pmmanager"><b>PM Manager</b><small>Service due tracking</small></button>
      <button class="v5-hub-card" data-route="inventory"><b>Inventory</b><small>Parts and supplies</small></button>
      <button class="v5-hub-card" data-route="supplierpricing"><b>Supplier Pricing</b><small>Price/location notes</small></button>
    </section>

    <section class="system-strip">
      <div class="status-box"><b>GPS</b><span>Ready</span><i></i></div>
      <div class="status-box"><b>Camera</b><span>Ready</span><i></i></div>
      <div class="status-box"><b>Storage</b><span>Local</span><i></i></div>
      <div class="status-box"><b>Buttons</b><span>Pass</span><i></i></div>
    </section>`;
}
function scheduleRows(){
  const list = (state.schedule||[]).slice(0,3);
  if(!list.length) return `<div class="schedule-row"><time>--</time><div><b>No jobs scheduled</b><small>Tap Schedule to add one</small></div><span></span></div>`;
  return list.map(x=>`<div class="schedule-row"><time>${x.time || "--"}</time><div><b>${x.customer || "Customer"}</b><small>${x.job || "Job"} • ${x.location || "Location"}</small></div><span class="badge">${x.tech || ""}</span></div>`).join("");
}
function recentRows(){
  const recent = [...state.workorders.map(x=>({type:"WO",...x})), ...state.invoices.map(x=>({type:"INV",...x})), ...state.quotes.map(x=>({type:"QUOTE",...x}))].slice(-3).reverse();
  if(!recent.length) return `<div class="job-row"><b>--</b><div><b>No recent jobs</b><small>Create a work order or invoice</small></div><span></span></div>`;
  return recent.map(x=>`<div class="job-row"><b>${x.type}</b><div><b>${x.customer || "Customer"}</b><small>${x.desc || x.work || x.job || "Saved item"}</small></div><span class="badge">SAVED</span></div>`).join("");
}


function normalizeClockJobs(){
  if(!state.jobs) state.jobs = {};
  ["job1","job2","job3"].forEach((id,idx)=>{
    const old = state.jobs[id] || {};
    const already = Number(old.seconds || old.elapsedSeconds || old.baseSeconds || 0);
    old.baseSeconds = Number(old.baseSeconds ?? already);
    old.startTimestamp = old.startTimestamp || null;
    old.running = !!old.running;
    old.name = old.name || `Job ${idx+1}`;
    old.customer = old.customer || "";
    old.status = old.status || (old.running ? "RUNNING" : "READY");
    old.saved = old.saved || [];
    state.jobs[id]=old;
  });
}
function currentJobSeconds(job){
  if(!job) return 0;
  const base = Number(job.baseSeconds || 0);
  if(job.running && job.startTimestamp){
    return base + Math.max(0, Math.floor((Date.now() - Number(job.startTimestamp)) / 1000));
  }
  return base;
}
function totalContinuousSeconds(){
  normalizeClockJobs();
  return Object.values(state.jobs).reduce((a,j)=>a+currentJobSeconds(j),0);
}
function startContinuousJob(id){
  normalizeClockJobs();
  const j=state.jobs[id];
  updateJobInputs(id);
  if(!j.running){
    j.baseSeconds = currentJobSeconds(j);
    j.startTimestamp = Date.now();
    j.running = true;
    j.status = "RUNNING";
  }
  saveState();
}
function pauseContinuousJob(id){
  normalizeClockJobs();
  const j=state.jobs[id];
  updateJobInputs(id);
  j.baseSeconds = currentJobSeconds(j);
  j.startTimestamp = null;
  j.running = false;
  j.status = "PAUSED";
  saveState();
}
function stopContinuousJob(id){
  normalizeClockJobs();
  const j=state.jobs[id];
  updateJobInputs(id);
  j.baseSeconds = currentJobSeconds(j);
  j.startTimestamp = null;
  j.running = false;
  j.status = "STOPPED";
  saveState();
}
function clearContinuousJob(id){
  normalizeClockJobs();
  const j=state.jobs[id];
  j.baseSeconds = 0;
  j.seconds = 0;
  j.startTimestamp = null;
  j.running = false;
  j.status = "READY";
  saveState();
}
function saveContinuousClock(id, show=true){
  normalizeClockJobs();
  updateJobInputs(id);
  const j=state.jobs[id];
  const seconds=currentJobSeconds(j);
  j.baseSeconds=seconds;
  j.saved.push({name:j.name,customer:j.customer,seconds,labor:clockDollars(seconds),date:new Date().toLocaleString()});
  j.status=j.running ? "RUNNING/SAVED" : "SAVED";
  saveState();
  if(show) toast(`${j.name} saved`);
}
function clockStatusHtml(j){
  if(j.running) return `<span class="clock-running-badge">Running</span>`;
  if(j.status==="PAUSED") return `<span class="clock-paused-badge">Paused</span>`;
  return `<span class="clock-stopped-badge">${j.status || "Ready"}</span>`;
}

function renderClock(){
  normalizeClockJobs();
  $("#screen").innerHTML = `${pageHead("3 Job Time Clock","saveAllClock",false)}
    <section class="clock-fixed-note">Clock uses stored start time now. It keeps correct elapsed time while switching screens, refreshing, or coming back later.</section>
    <section class="summary-card">
      <div><span>Total Time</span><b id="clockTotalTime">${formatTime(totalContinuousSeconds())}</b></div>
      <div><span>Total Labor</span><b id="clockTotalMoney">${money(clockDollars(totalContinuousSeconds()))}</b></div>
      <div><span>Rate</span><b>${money(state.settings.laborRate)}/hr</b></div>
    </section>
    <section class="backend-banner"><b>Invoice Ready Clock</b><small>Each job runs independently and sends hours to Work Orders / Invoices / Reports.</small></section>
    <section class="clock-page-grid">
      ${Object.entries(state.jobs).map(([id,j])=>jobClockCard(id,j)).join("")}
    </section>`;
  bindPageTools();
  $("#saveAllClock").onclick=()=>{ Object.keys(state.jobs).forEach(id=>saveContinuousClock(id,false)); saveState(); toast("All clocks saved"); renderClock(); };
}

function jobClockCard(id,j){
  const seconds = currentJobSeconds(j);
  return `<article class="job-clock-card">
    <div class="job-head"><h3>${j.name || id.toUpperCase()}</h3>${clockStatusHtml(j)}</div>
    <div class="two-col">
      <label>Job Name<input id="${id}_name" value="${j.name || ""}"></label>
      <label>Customer<input id="${id}_customer" value="${j.customer || ""}"></label>
    </div>
    <div class="job-time" id="${id}_time">${formatTime(seconds)}</div>
    <div class="job-money" id="${id}_money">${money(clockDollars(seconds))}</div>
    <div class="job-controls">
      <button class="start" data-clock="start" data-job="${id}">${j.running ? "Running" : "Start"}</button>
      <button class="pause" data-clock="pause" data-job="${id}">Pause</button>
      <button class="stop" data-clock="stop" data-job="${id}">Stop</button>
      <button data-clock="save" data-job="${id}">Save</button>
      <button class="clear" data-clock="clear" data-job="${id}">Clear</button>
    </div>
    <div class="pro-actions" style="grid-template-columns:repeat(2,1fr);">
      <button data-clock="toWO" data-job="${id}">Send to Work Order</button>
      <button data-clock="toInvoice" data-job="${id}">Send to Invoice</button>
    </div>
  </article>`;
}

function updateJobInputs(id){
  const j=state.jobs[id];
  const name=document.getElementById(`${id}_name`);
  const customer=document.getElementById(`${id}_customer`);
  if(name) j.name=name.value;
  if(customer) j.customer=customer.value;
}
function saveClock(id, show=true){
  updateJobInputs(id);
  const j=state.jobs[id];
  j.saved.push({name:j.name,customer:j.customer,seconds:j.seconds,labor:clockDollars(currentJobSeconds(j)),date:new Date().toLocaleString()});
  j.status="SAVED";
  saveState();
  if(show) toast(`${j.name} saved`);
}

function renderTruck(){
  ensureV46();
  const t=state.truck;
  $("#screen").innerHTML = `${pageHead("Truck Profile","saveTruck")}
    <section class="form-panel form-grid">
      <div class="backend-banner"><b>Truck Profile</b><small>Active truck drives quotes, invoices, parts lookup, repair history, work orders, and schedule.</small></div>
      <div class="two-col">
        <label>Unit Number<input id="truckUnit" value="${t.unit || ""}"></label>
        <label>Customer<select id="truckCustomerSelect">${linkedCustomerOptions(t.customer)}</select></label>
      </div>
      <label>VIN<input id="truckVin" value="${t.vin || ""}" placeholder="Enter or scan VIN"></label>
      <div class="two-col">
        <label>Engine<input id="truckEngine" value="${t.engine || ""}"></label>
        <label>Transmission<input id="truckTrans" value="${t.transmission || ""}"></label>
      </div>
      <div class="two-col">
        <label>CPL<input id="truckCpl" value="${t.cpl || ""}"></label>
        <label>Mileage<input id="truckMileage" value="${t.mileage || ""}"></label>
      </div>
      <button class="action-btn" data-route="camera">Scan VIN / Truck Photo</button>
      <div class="section-title">Fleet Trucks</div>
      <div>${state.trucks.length ? state.trucks.map((tr,i)=>`<div class="truck-row"><div><b>${tr.unit || "Truck"}</b><small>${tr.vin || "NO VIN"} • ${tr.customer || ""} • ${tr.engine || ""}</small></div><button data-load-truck="${i}">Set Active</button></div>`).join("") : `<div class="output">No saved fleet trucks.</div>`}</div>
      <div class="section-title">Active Truck History</div>
      <div class="output">${(state.trucks.find(x=>x.vin===t.vin)?.history || []).map(h=>`${h.date} — ${h.type}: ${h.text}`).join("\\n") || "No truck history yet."}</div>
    </section>`;
  bindPageTools();
  $("#saveTruck").onclick=()=>{ 
    state.truck={unit:$("#truckUnit").value,customer:$("#truckCustomerSelect").value,vin:$("#truckVin").value,engine:$("#truckEngine").value,transmission:$("#truckTrans").value,cpl:$("#truckCpl").value,mileage:$("#truckMileage").value}; 
    saveActiveTruckToFleet();
    addTruckHistory("Truck Profile", "Profile updated");
    saveState(); toast("Truck saved"); renderTruck(); 
  };
  $$("[data-load-truck]").forEach(btn=>btn.onclick=()=>{
    state.truck = {...state.trucks[Number(btn.dataset.loadTruck)]};
    saveState();
    toast("Truck set active");
    renderTruck();
  });
}

function renderAi(){
  if(!state.aiConversations) state.aiConversations = [];
  if(!state.activeAiId) state.activeAiId = null;

  const active = state.aiConversations.find(c=>c.id===state.activeAiId) || null;
  const messages = active ? active.messages : [];

  $("#screen").innerHTML = `${pageHead("Rolling Wrench AI","saveAi")}
    <section class="v42-ai-page ai-chat-app">
      <div class="ai-chat-shell">
        <div class="ai-chat-header chat-style-header">
          <div class="ai-orb">RW</div>
          <div>
            <h3>Ask anything...</h3>
            <p>Saved conversations • voice • camera • files</p>
          </div>
          <button class="action-btn primary" id="newAiChat">New</button>
        </div>

        <div class="ai-history-row">
          <button class="action-btn" id="openAttachMenu">＋ Add</button>
          <button class="action-btn" id="voiceBtn">🎙 Voice</button>
          <button class="action-btn" id="quickCamera">📷 Camera</button>
        </div>

        <div class="ai-chat-layout">
          <div class="ai-convo-list">
            <b>Conversations</b>
            <div id="conversationList">
              ${state.aiConversations.length ? state.aiConversations.map(c=>`
                <button class="conversation-item ${c.id===state.activeAiId?'active':''}" data-open-convo="${c.id}">
                  <span>${c.title || 'Rolling Wrench Chat'}</span>
                  <small>${c.updated || ''}</small>
                </button>`).join("") : `<small>No saved chats yet.</small>`}
            </div>
          </div>

          <div class="ai-chat-window" id="aiChatWindow">
            ${messages.length ? messages.map(m=>`
              <div class="bubble ${m.role}">
                <b>${m.role === 'user' ? 'You' : 'Rolling Wrench AI'}</b>
                <p>${m.text}</p>
              </div>`).join("") : `
              <div class="bubble assistant">
                <b>Rolling Wrench AI</b>
                <p>Ask anything. Use + to add a photo, file, document, invoice, VIN plate, or part label. Conversations save here like ChatGPT.</p>
              </div>`}
          </div>
        </div>

        <div class="attach-menu" id="attachMenu" hidden>
          <button class="ai-attach" id="attachPhoto"><span>🖼</span><b>Add Photo</b></button>
          <button class="ai-attach" id="takePicture"><span>📷</span><b>Take Picture</b></button>
          <button class="ai-attach" id="scanDoc"><span>📄</span><b>Scan Document</b></button>
          <button class="ai-attach" id="scanInvoice"><span>🧾</span><b>Scan Invoice</b></button>
          <button class="ai-attach" id="scanPart"><span>📦</span><b>Part Box / Label</b></button>
          <button class="ai-attach" id="scanVin"><span>🚚</span><b>VIN Plate</b></button>
        </div>

        <input id="aiFileInput" type="file" accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xlsx" multiple hidden>
        <input id="aiCameraInput" type="file" accept="image/*" capture="environment" hidden>

        <div class="ai-composer chat-composer">
          <button id="plusAttach" title="Add file">＋</button>
          <textarea id="aiAsk" placeholder="Ask Rolling Wrench AI anything..."></textarea>
          <button id="voiceBtn2" title="Voice">🎙</button>
          <button id="sendAi" title="Send">➤</button>
        </div>

        <div class="ai-save-grid">
          <button data-save-ai="truck">Save to Truck</button>
          <button data-save-ai="parts">Save to Parts</button>
          <button data-save-ai="workorders">Save Work Order</button>
          <button data-save-ai="quotes">Save Quote</button>
          <button data-save-ai="invoices">Save Invoice</button>
          <button data-save-ai="memory">Save Memory</button>
        </div>
      </div>
    </section>`;
  bindPageTools();

  function getActiveChat(){
    let chat = state.aiConversations.find(c=>c.id===state.activeAiId);
    if(!chat){
      chat = {id:Date.now().toString(), title:"New Rolling Wrench Chat", updated:new Date().toLocaleString(), messages:[]};
      state.aiConversations.unshift(chat);
      state.activeAiId = chat.id;
    }
    return chat;
  }

  function aiReply(q){
    const text = q.toLowerCase();
    if(text.includes("invoice")) return "I can help build an invoice. I can save this to the Invoice module and use the active truck/customer when available.";
    if(text.includes("quote") || text.includes("estimate")) return "I can build a quote and save it under Smart Quotes.";
    if(text.includes("part") || text.includes("label") || text.includes("box")) return "I can help identify parts and save notes to Parts Lookup. Exact part numbers should be verified by VIN/OEM/supplier.";
    if(text.includes("vin")) return "I can read or decode VIN information and save it to the active Truck Profile.";
    if(text.includes("spn") || text.includes("fmi") || text.includes("fault") || text.includes("code")) return "I can route this to Fault Doctor and build a diagnostic workflow.";
    if(text.includes("schedule")) return "I can create a schedule item and link it to customer/truck/job.";
    return "Got it. I saved this conversation here. I can route it to Truck, Parts, Fault Doctor, Quotes, Invoices, Work Orders, Schedule, Pin Drop, or Repair Memory.";
  }

  async function sendMessage(){
    const box = $("#aiAsk");
    const q = box.value.trim();
    if(!q) return;
    const chat = getActiveChat();
    if(chat.messages.length === 0) chat.title = q.slice(0,34);
    chat.messages.push({role:"user", text:q, time:new Date().toLocaleString()});
    const routeInfo = v5RouteAiCommand(q);
    let answer = aiReply(q) + "\n\nAction: " + routeInfo.msg;
    try { answer = await v52AskAi(q); } catch(e) { answer += "\n\nAI engine note: " + e.message; }
    chat.messages.push({role:"assistant", text:answer, time:new Date().toLocaleString()});
    if(routeInfo.action==="workorder" || routeInfo.action==="quote" || routeInfo.action==="invoice"){ v5CreateWorkflow(routeInfo.action, q); }
    if(routeInfo.action==="pm"){ state.pmRecords.unshift({unit:state.truck.unit,type:q,priority:"Normal",date:"",miles:"",notes:"Created from AI"}); v5AddNotification("PM Created From AI", q); }
    chat.updated = new Date().toLocaleString();
    saveState();
    renderAi();
  }

  $("#newAiChat").onclick=()=>{
    const chat = {id:Date.now().toString(), title:"New Rolling Wrench Chat", updated:new Date().toLocaleString(), messages:[]};
    state.aiConversations.unshift(chat);
    state.activeAiId = chat.id;
    saveState();
    renderAi();
  };

  $$("[data-open-convo]").forEach(btn=>btn.onclick=()=>{
    state.activeAiId = btn.dataset.openConvo;
    saveState();
    renderAi();
  });

  $("#sendAi").onclick=sendMessage;
  $("#aiAsk").addEventListener("keydown", e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendMessage(); } });

  const fileInput = $("#aiFileInput");
  const camInput = $("#aiCameraInput");
  const attachMenu = $("#attachMenu");

  $("#openAttachMenu").onclick=()=>attachMenu.hidden = !attachMenu.hidden;
  $("#plusAttach").onclick=()=>attachMenu.hidden = !attachMenu.hidden;
  $("#quickCamera").onclick=()=>camInput.click();

  const attach = label => fileInput.click();
  $("#attachPhoto").onclick=()=>attach("photo");
  $("#scanDoc").onclick=()=>attach("document");
  $("#scanInvoice").onclick=()=>attach("invoice");
  $("#takePicture").onclick=()=>camInput.click();
  $("#scanPart").onclick=()=>camInput.click();
  $("#scanVin").onclick=()=>camInput.click();

  fileInput.onchange=()=>{
    const names=[...fileInput.files].map(f=>f.name).join(", ");
    const chat = getActiveChat();
    chat.messages.push({role:"user", text:`Attached file(s): ${names}`, time:new Date().toLocaleString()});
    chat.messages.push({role:"assistant", text:"File attached. Ask what you want done with it: read invoice, identify part, decode VIN, create quote, create work order, or save to repair memory.", time:new Date().toLocaleString()});
    chat.updated = new Date().toLocaleString();
    saveState(); renderAi();
  };
  camInput.onchange=()=>{
    const name=camInput.files[0]?.name || "camera photo";
    const chat = getActiveChat();
    chat.messages.push({role:"user", text:`Captured photo: ${name}`, time:new Date().toLocaleString()});
    chat.messages.push({role:"assistant", text:"Photo captured. Tell me if this is a VIN plate, part label, invoice, fault screen, damaged part, or document.", time:new Date().toLocaleString()});
    chat.updated = new Date().toLocaleString();
    saveState(); renderAi();
  };

  function voiceStart(){
    const supported = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    if(!supported){ toast("Use phone keyboard mic for voice"); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang="en-US"; rec.interimResults=false; rec.maxAlternatives=1;
    rec.onresult=e=>{ $("#aiAsk").value=e.results[0][0].transcript; };
    rec.onerror=()=>toast("Voice stopped");
    rec.start();
  }
  $("#voiceBtn").onclick=voiceStart;
  $("#voiceBtn2").onclick=voiceStart;

  $("#saveAi").onclick=()=>{
    const chat = getActiveChat();
    state.notes.push({type:"AI Conversation",note:chat.title,messages:chat.messages,date:new Date().toLocaleString()});
    saveState(); toast("Conversation saved");
  };

  $$("[data-save-ai]").forEach(btn=>btn.onclick=()=>{
    const chat = getActiveChat();
    const text = chat.messages.map(m=>`${m.role}: ${m.text}`).join("\\n");
    const type=btn.dataset.saveAi;
    if(type==="truck") state.notes.push({type:"Truck AI",note:text});
    if(type==="parts") state.parts.push({query:chat.title,notes:text});
    if(type==="workorders") state.workorders.push({customer:state.truck.customer,truck:state.truck.unit,desc:chat.title,status:"Open"});
    if(type==="quotes") state.quotes.push({customer:state.truck.customer,desc:chat.title,total:0});
    if(type==="invoices") state.invoices.push({customer:state.truck.customer,truck:state.truck.unit,work:chat.title,total:0});
    if(type==="memory") state.notes.push({type:"Repair Memory",note:text});
    saveState(); toast(`Saved to ${type}`);
  });
}

function renderParts(){
  $("#screen").innerHTML = `${pageHead("Parts Lookup","savePart")}
    <section class="form-panel form-grid">
      <div class="voice-fill-panel"><b>Speak Parts Search</b><div class="voice-fill-row"><input id="partsVoiceText" placeholder="Say part, engine, VIN, or description"><button class="voice-pill" id="speakParts">🎙 Speak</button><button class="voice-pill orange" id="voiceFillParts">Fill</button></div></div>
      <label>Search<input id="partSearch" placeholder="VIN, engine, part number, description"></label>
      <div class="two-col"><label>Verified Part #<input id="partNumber"></label><label>Supplier / Price<input id="partSupplier"></label></div>
      <label>Notes<textarea id="partNotes" placeholder="Cross reference, fitment, source, availability"></textarea></label>
      <button class="action-btn" id="partBuild">Build Search</button>
      <div class="output" id="partOut">Rule: exact OEM or UNKNOWN until verified by VIN/OEM/supplier.</div>
    </section>`;
  bindPageTools();
  if($("#speakParts")) $("#speakParts").onclick=()=>startVoiceToField("partsVoiceText", spoken=>$("#partSearch").value=spoken);
  if($("#voiceFillParts")) $("#voiceFillParts").onclick=()=>{ $("#partSearch").value=$("#partsVoiceText").value; toast("Parts search filled"); };
  $("#partBuild").onclick=()=>{$("#partOut").textContent=`PARTS LOOKUP\nQuery: ${$("#partSearch").value}\nActive Truck: ${state.truck.unit} / ${state.truck.vin}\nStatus: UNKNOWN until verified.`};
  $("#savePart").onclick=()=>{ state.parts.push({query:$("#partSearch").value,number:$("#partNumber").value,supplier:$("#partSupplier").value,notes:$("#partNotes").value,date:new Date().toLocaleString()}); saveState(); toast("Part saved"); };
}

function renderFault(){
  $("#screen").innerHTML = `${pageHead("Fault Doctor","saveFault")}
    <section class="form-panel form-grid">
      <div class="two-col"><label>SPN/FMI/P-Code<input id="faultCode" placeholder="SPN 3251 FMI 2"></label><label>Module<input id="faultModule" placeholder="ECM / ABS / TCM"></label></div>
      <label>Symptoms<textarea id="faultSymptoms" placeholder="Derate, no regen, low power, no start..."></textarea></label>
      <button class="action-btn primary" id="buildFault">Build Diagnostic Plan</button>
      <div class="output" id="faultOut">Enter fault and symptoms.</div>
    </section>`;
  bindPageTools();
  $("#buildFault").onclick=()=>{$("#faultOut").textContent=`DIAGNOSTIC PLAN\nCode: ${$("#faultCode").value}\n1. Verify active/inactive status.\n2. Check power, ground, connectors, wiring.\n3. Compare commanded vs actual live data.\n4. Inspect mechanical cause before replacing parts.\n5. Document final test and save to repair memory.`};
  $("#saveFault").onclick=()=>{ state.notes.push({type:"Fault",code:$("#faultCode").value,module:$("#faultModule").value,note:$("#faultSymptoms").value}); saveState(); toast("Fault saved"); };
}

function renderRepairHud(){
  $("#screen").innerHTML = `${pageHead("Repair HUD","saveRepair")}
    <section class="form-panel form-grid">
      <label>Repair / Procedure<textarea id="repairText" placeholder="Describe repair, procedure, torque/spec request, or inspection notes..."></textarea></label>
      <button class="action-btn" id="buildRepair">Build Repair Steps</button>
      <div class="output" id="repairOut">Repair procedure builder ready.</div>
    </section>`;
  bindPageTools();
  $("#buildRepair").onclick=()=>{$("#repairOut").textContent=`REPAIR HUD\n- Verify complaint\n- Safety / lockout\n- Inspect related system\n- Test before replacing parts\n- Complete repair\n- Final test / customer notes\n- Save to truck history`};
  $("#saveRepair").onclick=()=>{ state.notes.push({type:"Repair",note:$("#repairText").value,date:new Date().toLocaleString()}); saveState(); toast("Repair saved"); };
}


function getSpeechSupported(){
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}
function startVoiceToField(fieldId, onDone){
  const field = document.getElementById(fieldId);
  if(!field){ toast("Voice target missing"); return; }
  if(!getSpeechSupported()){
    toast("Use phone keyboard mic");
    field.focus();
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang="en-US"; rec.interimResults=false; rec.maxAlternatives=1;
  toast("Listening...");
  rec.onresult = e => {
    const spoken = e.results[0][0].transcript;
    field.value = spoken;
    if(onDone) onDone(spoken);
  };
  rec.onerror = () => toast("Voice stopped");
  rec.start();
}
function professionalizeWorkText(raw){
  raw = (raw || "").trim();
  if(!raw) return "";
  return raw
    .replace(/^customer says/i,"Customer concern:")
    .replace(/\bfix\b/gi,"repair")
    .replace(/\bchecked\b/gi,"inspected")
    .replace(/\bdone\b/gi,"completed");
}
function aiBuildFromSpokenJob(text){
  const q = (text || "").toLowerCase();
  const result = {
    desc: text,
    hours: 3.0,
    parts: "Parts to verify by VIN / supplier",
    supplies: 25,
    source: "Parts price/location to be verified before final approval"
  };
  if(q.includes("water pump")){ result.hours=3.5; result.parts="Water pump\nGasket/seal kit\nBelt if needed\nCoolant\nShop supplies"; result.supplies=35; }
  if(q.includes("clutch")){ result.hours=11.5; result.parts="Clutch kit\nPilot bearing\nFlywheel inspection/resurface or replacement if needed\nTransmission fluid if needed\nShop supplies"; result.supplies=45; }
  if(q.includes("wheel seal")){ result.hours=2.5; result.parts="Wheel seal\nHub cap gasket\nGear oil\nBrake clean/shop supplies"; result.supplies=25; }
  if(q.includes("brake")){ result.hours=3.0; result.parts="Brake parts as applicable\nHardware kit\nDrums/rotors if needed\nShop supplies"; result.supplies=25; }
  if(q.includes("diagnostic") || q.includes("diagnose")){ result.hours=1.5; result.parts="No parts quoted until diagnostic confirmation"; result.supplies=0; }
  if(q.includes("roadside")){ result.source += " • Roadside service"; }
  return result;
}

function signatureBlock(prefix, label="Customer / Driver Signature"){
  return `<div class="signature-card">
    <b>${label}</b>
    <div class="signature-meta">
      <label>Printed Name<input id="${prefix}SignerName" placeholder="Driver / customer name"></label>
      <label>Title / Company<input id="${prefix}SignerTitle" placeholder="Driver / manager / company"></label>
    </div>
    <div class="signature-pad-wrap"><canvas id="${prefix}SignaturePad" class="signature-pad"></canvas></div>
    <div class="signature-actions">
      <button type="button" id="${prefix}ClearSignature" class="clear-signature">Clear</button>
      <button type="button" id="${prefix}SaveSignature">Save Signature</button>
      <button type="button" id="${prefix}TimestampSignature">Add Time Stamp</button>
    </div>
    <span class="signature-status" id="${prefix}SignatureStatus">No signature saved yet.</span>
    <div class="signature-preview" id="${prefix}SignaturePreview" hidden></div>
  </div>`;
}
function setupSignaturePad(prefix){
  const canvas = document.getElementById(`${prefix}SignaturePad`);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let last = null;
  function fit(){
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(300, Math.floor(rect.width * window.devicePixelRatio));
    canvas.height = Math.floor(190 * window.devicePixelRatio);
    ctx.setTransform(window.devicePixelRatio,0,0,window.devicePixelRatio,0,0);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#10141a";
  }
  setTimeout(fit, 60);
  function point(e){
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return {x:p.clientX-r.left, y:p.clientY-r.top};
  }
  function start(e){ e.preventDefault(); drawing=true; last=point(e); }
  function move(e){
    if(!drawing) return;
    e.preventDefault();
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.x,last.y);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
    last = p;
  }
  function stop(){ drawing=false; }
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", stop);
  canvas.addEventListener("mouseleave", stop);
  canvas.addEventListener("touchstart", start, {passive:false});
  canvas.addEventListener("touchmove", move, {passive:false});
  canvas.addEventListener("touchend", stop);
  const clearBtn = document.getElementById(`${prefix}ClearSignature`);
  const saveBtn = document.getElementById(`${prefix}SaveSignature`);
  const tsBtn = document.getElementById(`${prefix}TimestampSignature`);
  if(clearBtn) clearBtn.onclick = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    state[`${prefix}Signature`] = null;
    saveState();
    document.getElementById(`${prefix}SignatureStatus`).textContent = "Signature cleared.";
    document.getElementById(`${prefix}SignaturePreview`).hidden = true;
  };
  if(saveBtn) saveBtn.onclick = () => saveSignature(prefix);
  if(tsBtn) tsBtn.onclick = () => {
    const name = document.getElementById(`${prefix}SignerName`)?.value || "Signed";
    const title = document.getElementById(`${prefix}SignerTitle`)?.value || "";
    ctx.font = "12px Arial";
    ctx.fillStyle = "#10141a";
    ctx.fillText(`${name} ${title} — ${new Date().toLocaleString()}`, 12, 178);
    saveSignature(prefix);
  };
}
function saveSignature(prefix){
  const canvas = document.getElementById(`${prefix}SignaturePad`);
  if(!canvas) return "";
  const data = canvas.toDataURL("image/png");
  state[`${prefix}Signature`] = {
    data,
    name:document.getElementById(`${prefix}SignerName`)?.value || "",
    title:document.getElementById(`${prefix}SignerTitle`)?.value || "",
    date:new Date().toLocaleString()
  };
  saveState();
  const preview = document.getElementById(`${prefix}SignaturePreview`);
  if(preview){
    preview.hidden = false;
    preview.innerHTML = `<b>Saved Signature</b><img src="${data}" alt="Signature"><small>${state[`${prefix}Signature`].name || "Signed"} • ${state[`${prefix}Signature`].date}</small>`;
  }
  const status = document.getElementById(`${prefix}SignatureStatus`);
  if(status) status.textContent = `Signature saved ${state[`${prefix}Signature`].date}`;
  toast("Signature saved");
  return data;
}
function docSignatureHtml(prefix){
  const sig = state[`${prefix}Signature`];
  if(!sig || !sig.data) return `<div class="signature-line-doc"><b>Customer / Driver Signature</b><div style="height:70px;border-bottom:1px solid #17202b;"></div><small>Not signed yet</small></div>`;
  return `<div class="signature-line-doc"><b>Customer / Driver Signature</b><img src="${sig.data}" alt="Signature"><small>${sig.name || "Signed"} ${sig.title ? "• "+sig.title : ""} • ${sig.date}</small></div>`;
}
function renderQuotes(){
  $("#screen").innerHTML = `${pageHead("Smart Quotes","saveQuote")}
    <section class="pro-doc-shell form-grid">
      <div class="voice-fill-panel"><b>Speak Quote</b><div class="voice-fill-row"><input id="quoteVoiceText" placeholder="Say the job: replace water pump on X15, clutch job, wheel seal roadside..."><button class="voice-pill" id="speakQuote">🎙 Speak</button><button class="voice-pill orange" id="voiceFillQuote">Fill Quote</button></div><span class="voice-status-text">Speak it once. AI fills labor, parts, and professional quote wording.</span></div>
      <div class="ai-fill-card"><b>AI Quote Builder</b><div class="ai-fill-row"><input id="quoteAiJob" placeholder="Say/type the job: X15 water pump, clutch, wheel seal..."><button class="action-btn primary" id="aiBuildQuote">AI Fill</button></div><small class="muted">AI fills labor time, rate, parts list, service call, and estimate. Review before saving.</small></div>
      <label>Customer<input id="quoteCustomer" value="${state.truck.customer || ""}"></label>
      <label>Truck / VIN<input id="quoteTruck" value="${state.truck.unit || ""} ${state.truck.vin || ""}"></label>
      <label>Job Description<textarea id="quoteDesc"></textarea></label>
      <div class="line-item-box form-grid"><b>Labor / Service</b><div class="two-col"><label>Labor Hours<input id="quoteHours" type="number" step=".1"></label><label>Rate<input id="quoteRate" type="number" value="${state.settings.laborRate}"></label></div><div class="two-col"><label>Service Call<input id="quoteCall" type="number" value="${state.settings.serviceCall}"></label><label>Travel / Mileage<input id="quoteTravel" type="number" step=".01"></label></div></div>
      <div class="line-item-box form-grid"><b>Parts / Supplies</b><label>Parts Needed<textarea id="quotePartsList" placeholder="Water pump, gasket, belt, coolant..."></textarea></label><div class="two-col"><label>Parts Total<input id="quoteParts" type="number" step=".01"></label><label>Supplies<input id="quoteSupplies" type="number" step=".01"></label></div><label>Parts Source / Location<input id="quotePartSource" placeholder="FleetPride / dealer / NAPA / TruckPro / location / price source"></label></div>
      <div class="two-col"><label>Tax / Fees<input id="quoteFees" type="number" step=".01"></label><label>Markup / Misc<input id="quoteMisc" type="number" step=".01"></label></div>
      ${signatureBlock("quote","Customer / Driver Quote Approval")}
      <button class="action-btn primary" id="previewQuote">Preview Professional Quote</button>
      <div id="quotePreviewWrap"></div>
    </section>`;
  bindPageTools();
  setupSignaturePad("quote");
  if($("#speakQuote")) $("#speakQuote").onclick=()=>startVoiceToField("quoteVoiceText", spoken=>{ $("#quoteAiJob").value=spoken; });
  if($("#voiceFillQuote")) $("#voiceFillQuote").onclick=()=>{ 
    const built = aiBuildFromSpokenJob($("#quoteVoiceText").value || $("#quoteAiJob").value);
    $("#quoteAiJob").value = built.desc;
    $("#quoteDesc").value = professionalizeWorkText(built.desc);
    $("#quoteHours").value = built.hours;
    $("#quotePartsList").value = built.parts;
    $("#quoteSupplies").value = built.supplies;
    $("#quotePartSource").value = built.source;
    toast("Voice quote filled");
    if(typeof buildQuotePreview === "function") buildQuotePreview();
  };
  const v=id=>document.getElementById(id)?.value || "";
  const n=id=>Number(v(id)||0);
  const calc=()=> n("quoteHours")*n("quoteRate")+n("quoteCall")+n("quoteTravel")+n("quoteParts")+n("quoteSupplies")+n("quoteFees")+n("quoteMisc");
  $("#aiBuildQuote").onclick=()=>{const job=v("quoteAiJob").toLowerCase();$("#quoteDesc").value=v("quoteAiJob");let hours=3.5,parts="Parts to verify by VIN / supplier",supplies=25;if(job.includes("water pump")){hours=3.5;parts="Water pump\\nGasket/seal kit\\nBelt if needed\\nCoolant\\nShop supplies";supplies=35}if(job.includes("clutch")){hours=11.5;parts="Clutch kit\\nPilot bearing\\nFlywheel resurface/replacement as needed\\nTransmission fluid if needed";supplies=45}if(job.includes("wheel seal")){hours=2.5;parts="Wheel seal\\nHub cap gasket\\nGear oil\\nBrake clean/shop supplies";supplies=25}if(job.includes("brake")){hours=3.0;parts="Brake parts as applicable\\nHardware kit\\nDrums/rotors if needed\\nShop supplies";supplies=25}$("#quoteHours").value=hours;$("#quotePartsList").value=parts;$("#quoteSupplies").value=supplies;$("#quotePartSource").value="Parts price/location to be verified before final approval";toast("AI quote filled");buildQuotePreview()};
  function buildQuotePreview(){const labor=n("quoteHours")*n("quoteRate");const subtotal=calc();const disclaimer="Estimate only. Final price may increase or decrease based on additional labor, seized/broken hardware, hidden damage, diagnostic findings, parts availability, freight, shop supplies, taxes/fees, travel, or extra time required to complete the repair. Customer approval required before additional work is performed. Parts pricing and availability may change until purchased.";$("#quotePreviewWrap").innerHTML=`<div class="pro-doc-preview"><div class="pro-doc-top"><div class="pro-doc-logo"><div class="doc-rw">RW</div><div><h3>${state.settings.shop || "Rolling Wrench Diesel"}</h3><p>${state.settings.phone || ""} • Mobile Diesel Repair</p></div></div><div class="doc-type"><b>Quote</b><small>${new Date().toLocaleDateString()}</small></div></div><div class="pro-info-grid"><div class="pro-info-box"><b>Customer</b><span>${v("quoteCustomer") || "Customer"}</span></div><div class="pro-info-box"><b>Truck / VIN</b><span>${v("quoteTruck") || "Truck / VIN"}</span></div><div class="pro-info-box"><b>Job</b><span>${v("quoteDesc") || "Repair estimate"}</span></div><div class="pro-info-box"><b>Parts Source</b><span>${v("quotePartSource") || "To be verified"}</span></div></div><table class="pro-table"><thead><tr><th>Description</th><th>Qty/Hours</th><th>Rate/Cost</th><th>Total</th></tr></thead><tbody><tr><td>Labor</td><td>${v("quoteHours")} hrs</td><td>${money(n("quoteRate"))}</td><td>${money(labor)}</td></tr><tr><td>Service Call</td><td>1</td><td>${money(n("quoteCall"))}</td><td>${money(n("quoteCall"))}</td></tr><tr><td>Travel / Mileage</td><td>1</td><td>${money(n("quoteTravel"))}</td><td>${money(n("quoteTravel"))}</td></tr><tr><td>Parts<br><small>${v("quotePartsList").replaceAll("\\n","<br>")}</small></td><td>1</td><td>${money(n("quoteParts"))}</td><td>${money(n("quoteParts"))}</td></tr><tr><td>Supplies / Fees / Misc</td><td>1</td><td>${money(n("quoteSupplies")+n("quoteFees")+n("quoteMisc"))}</td><td>${money(n("quoteSupplies")+n("quoteFees")+n("quoteMisc"))}</td></tr></tbody></table><div class="pro-total-box"><div class="pro-total-row"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="pro-total-row grand"><span>Estimated Total</span><b>${money(subtotal)}</b></div></div><div class="pro-note"><b>Estimate Disclaimer:</b> ${disclaimer}</div>${docSignatureHtml("quote")}</div><div class="pro-actions"><button id="convertQuoteInvoice">Convert to Invoice</button><button id="sendQuoteCustomer">Send to Customer</button><button id="saveQuoteAgain">Save Quote</button><button onclick="window.print()">Print / Save PDF</button></div>`;if($("#sendQuoteCustomer")) $("#sendQuoteCustomer").onclick=()=>{ $("#saveQuote").click(); const idx=state.quotes.length-1; makeQuoteApproval(idx); toast("Quote link ready"); setRoute("sendquotes"); };
    $("#saveQuoteAgain").onclick=()=>$("#saveQuote").click();$("#convertQuoteInvoice").onclick=()=>{state.invoices.push({customer:v("quoteCustomer"),truck:v("quoteTruck"),work:v("quoteDesc"),total:subtotal,date:new Date().toLocaleString(),fromQuote:true});saveState();toast("Converted to invoice")}}
  $("#previewQuote").onclick=buildQuotePreview;
  $("#saveQuote").onclick=()=>{state.quotes.push({customer:v("quoteCustomer"),truck:v("quoteTruck"),desc:v("quoteDesc"),hours:n("quoteHours"),rate:n("quoteRate"),parts:v("quotePartsList"),source:v("quotePartSource"),total:calc(),date:new Date().toLocaleString()});addTruckHistory("Quote", `${v("quoteDesc")} - ${money(calc())}`);saveState();toast("Quote saved")};
}

function renderInvoices(){
  $("#screen").innerHTML = `${pageHead("Professional Invoice","saveInvoice")}
    <section class="pro-doc-shell form-grid">
      <div class="voice-fill-panel"><b>Speak Invoice</b><div class="voice-fill-row"><input id="invoiceVoiceText" placeholder="Say the work performed and charges..."><button class="voice-pill" id="speakInvoice">🎙 Speak</button><button class="voice-pill orange" id="voiceFillInvoice">Fill Invoice</button></div><span class="voice-status-text">Speak repair notes. AI cleans it up into professional invoice wording.</span></div>
      <label>Bill To<input id="invCustomer" value="${state.truck.customer || ""}"></label>
      <label>Truck / VIN<input id="invTruck" value="${state.truck.unit || ""} ${state.truck.vin || ""}"></label>
      <label>Work Performed<textarea id="invWork" placeholder="Complaint, cause, correction, final check..."></textarea></label>
      <div class="line-item-box form-grid"><b>Labor / Service</b><div class="two-col"><label>Labor Hours<input id="invHours" type="number" step=".1"></label><label>Rate<input id="invRate" type="number" value="${state.settings.laborRate}"></label></div><div class="two-col"><label>Service Call<input id="invCall" type="number" value="${state.settings.serviceCall}"></label><label>Travel / Mileage<input id="invTravel" type="number" step=".01"></label></div></div>
      <div class="line-item-box form-grid"><b>Parts / Charges</b><label>Parts / Materials<textarea id="invPartsList" placeholder="List parts/materials used"></textarea></label><div class="two-col"><label>Parts Total<input id="invParts" type="number" step=".01"></label><label>Supplies<input id="invSupplies" type="number" step=".01"></label></div><div class="two-col"><label>Tax / Fees<input id="invFees" type="number" step=".01"></label><label>Discount<input id="invDiscount" type="number" step=".01"></label></div></div>
      <label>Customer Notes / Warranty / Recommendations<textarea id="invNotes" placeholder="Example: Recheck U-bolts after 50-100 miles. No road test performed. Customer supplied parts."></textarea></label>
      ${signatureBlock("invoice","Customer / Driver Invoice Approval")}
      <button class="action-btn primary" id="previewInv">Preview Professional Invoice</button>
      <div id="invoicePreviewWrap"></div>
    </section>`;
  bindPageTools();
  setupSignaturePad("invoice");
  if($("#speakInvoice")) $("#speakInvoice").onclick=()=>startVoiceToField("invoiceVoiceText", spoken=>{ $("#invWork").value=professionalizeWorkText(spoken); });
  if($("#voiceFillInvoice")) $("#voiceFillInvoice").onclick=()=>{ 
    const built = aiBuildFromSpokenJob($("#invoiceVoiceText").value || $("#invWork").value);
    $("#invWork").value = professionalizeWorkText(built.desc);
    if(!$("#invHours").value) $("#invHours").value = built.hours;
    if(!$("#invPartsList").value) $("#invPartsList").value = built.parts;
    if(!$("#invSupplies").value) $("#invSupplies").value = built.supplies;
    toast("Voice invoice filled");
    if(typeof buildInvoicePreview === "function") buildInvoicePreview();
  };
  const v=id=>document.getElementById(id)?.value || "";
  const n=id=>Number(v(id)||0);
  const calc=()=> n("invHours")*n("invRate")+n("invCall")+n("invTravel")+n("invParts")+n("invSupplies")+n("invFees")-n("invDiscount");
  function buildInvoicePreview(){const labor=n("invHours")*n("invRate");const total=calc();$("#invoicePreviewWrap").innerHTML=`<div class="pro-doc-preview"><div class="pro-doc-top"><div class="pro-doc-logo"><div class="doc-rw">RW</div><div><h3>${state.settings.shop || "Rolling Wrench Diesel"}</h3><p>${state.settings.phone || ""} • Mobile Diesel & Equipment Repair</p></div></div><div class="doc-type"><b>Invoice</b><small>${new Date().toLocaleDateString()}<br>Due Upon Receipt</small></div></div><div class="pro-info-grid"><div class="pro-info-box"><b>Bill To</b><span>${v("invCustomer") || "Customer"}</span></div><div class="pro-info-box"><b>Truck / VIN</b><span>${v("invTruck") || "Truck / VIN"}</span></div><div class="pro-info-box"><b>Work Performed</b><span>${v("invWork") || "Work performed"}</span></div><div class="pro-info-box"><b>Payment</b><span>Due upon receipt unless otherwise agreed. Card processing fees may apply.</span></div></div><table class="pro-table"><thead><tr><th>Description</th><th>Qty/Hours</th><th>Rate/Cost</th><th>Total</th></tr></thead><tbody><tr><td>Labor</td><td>${v("invHours")} hrs</td><td>${money(n("invRate"))}</td><td>${money(labor)}</td></tr><tr><td>Service Call</td><td>1</td><td>${money(n("invCall"))}</td><td>${money(n("invCall"))}</td></tr><tr><td>Travel / Mileage</td><td>1</td><td>${money(n("invTravel"))}</td><td>${money(n("invTravel"))}</td></tr><tr><td>Parts / Materials<br><small>${v("invPartsList").replaceAll("\\n","<br>")}</small></td><td>1</td><td>${money(n("invParts"))}</td><td>${money(n("invParts"))}</td></tr><tr><td>Supplies / Tax / Fees</td><td>1</td><td>${money(n("invSupplies")+n("invFees"))}</td><td>${money(n("invSupplies")+n("invFees"))}</td></tr>${n("invDiscount") ? `<tr><td>Discount</td><td>1</td><td>-${money(n("invDiscount"))}</td><td>-${money(n("invDiscount"))}</td></tr>` : ""}</tbody></table><div class="pro-total-box"><div class="pro-total-row"><span>Subtotal</span><b>${money(total)}</b></div><div class="pro-total-row grand"><span>Total Due</span><b>${money(total)}</b></div></div><div class="pro-note"><b>Notes / Terms:</b> ${v("invNotes") || "Customer authorizes listed work. Additional issues found after teardown or diagnostics may require additional approval. Parts availability and pricing may vary. Payment due upon receipt."}</div>${docSignatureHtml("invoice")}</div><div class="pro-actions"><button id="saveInvoiceAgain">Save Invoice</button><button id="sendInvoiceCustomer">Send to Customer</button><button onclick="window.print()">Print / Save PDF</button><button id="textInvoice">Text/Share Ready</button></div>`;if($("#sendInvoiceCustomer")) $("#sendInvoiceCustomer").onclick=()=>{ $("#saveInvoice").click(); const idx=state.invoices.length-1; makeInvoiceLink(idx); toast("Invoice link ready"); setRoute("sendinvoices"); };
    $("#saveInvoiceAgain").onclick=()=>$("#saveInvoice").click();$("#textInvoice").onclick=()=>toast("Use browser share/print or screenshot preview")}
  $("#previewInv").onclick=buildInvoicePreview;
  $("#saveInvoice").onclick=()=>{state.invoices.push({customer:v("invCustomer"),truck:v("invTruck"),work:v("invWork"),parts:v("invPartsList"),notes:v("invNotes"),total:calc(),date:new Date().toLocaleString()});addTruckHistory("Invoice", `${v("invWork")} - ${money(calc())}`);saveState();toast("Invoice saved")};
}

function renderWorkOrders(){
  $("#screen").innerHTML = `${pageHead("Work Orders","saveWO")}
    <section class="form-panel form-grid">
      <div class="voice-fill-panel"><b>Speak Work Order</b><div class="voice-fill-row"><input id="woVoiceText" placeholder="Say complaint/cause/correction"><button class="voice-pill" id="speakWO">🎙 Speak</button><button class="voice-pill orange" id="voiceFillWO">Fill</button></div></div>
      <div class="two-col"><label>Customer<input id="woCustomer" value="${state.truck.customer || ""}"></label><label>Truck<input id="woTruck" value="${state.truck.unit || ""}"></label></div>
      <label>Complaint<textarea id="woComplaint"></textarea></label>
      <label>Cause<textarea id="woCause"></textarea></label>
      <label>Correction<textarea id="woCorrection"></textarea></label>
      <label>Status<select id="woStatus"><option>Open</option><option>Diagnosing</option><option>Waiting Parts</option><option>In Progress</option><option>Complete</option><option>Invoiced</option></select></label>
      <div class="output">${state.workorders.map(w=>`${w.status}: ${w.customer} — ${w.desc}`).join("\n") || "No saved work orders."}</div>
    </section>`;
  bindPageTools();
  if($("#speakWO")) $("#speakWO").onclick=()=>startVoiceToField("woVoiceText", spoken=>$("#woComplaint").value=professionalizeWorkText(spoken));
  if($("#voiceFillWO")) $("#voiceFillWO").onclick=()=>{ $("#woComplaint").value=professionalizeWorkText($("#woVoiceText").value); toast("Work order filled"); };
  $("#saveWO").onclick=()=>{ state.workorders.push({customer:$("#woCustomer").value,truck:$("#woTruck").value,desc:$("#woComplaint").value,cause:$("#woCause").value,correction:$("#woCorrection").value,status:$("#woStatus").value,date:new Date().toLocaleString()}); saveState(); toast("Work order saved"); };
}

function renderSchedule(){
  $("#screen").innerHTML = `${pageHead("Schedule","saveSchedule")}
    <section class="form-panel form-grid">
      <div class="voice-fill-panel"><b>Speak Schedule</b><div class="voice-fill-row"><input id="schedVoiceText" placeholder="Say job/customer/location/time notes"><button class="voice-pill" id="speakSchedule">🎙 Speak</button><button class="voice-pill orange" id="voiceFillSchedule">Fill</button></div></div>
      <div class="two-col"><label>Date<input id="schedDate" type="date"></label><label>Time<input id="schedTime" type="time"></label></div>
      <label>Customer<input id="schedCustomer" value="${state.truck.customer || ""}"></label>
      <label>Job<input id="schedJob" placeholder="PM, roadside, clutch, brakes..."></label>
      <label>Location<input id="schedLocation"></label>
      <label>Tech<input id="schedTech" placeholder="James / David / Stephani"></label>
      <button class="action-btn" data-route="pindrop">Open Pin Drop</button>
      <div class="output">${state.schedule.map(x=>`${x.date || ""} ${x.time || ""} — ${x.customer || ""} — ${x.job || ""} — ${x.location || ""}`).join("\n") || "No saved schedule."}</div>
    </section>`;
  bindPageTools();
  if($("#speakSchedule")) $("#speakSchedule").onclick=()=>startVoiceToField("schedVoiceText", spoken=>$("#schedJob").value=spoken);
  if($("#voiceFillSchedule")) $("#voiceFillSchedule").onclick=()=>{ $("#schedJob").value=$("#schedVoiceText").value; toast("Schedule filled"); };
  $("#saveSchedule").onclick=()=>{ state.schedule.push({date:$("#schedDate").value,time:$("#schedTime").value,customer:$("#schedCustomer").value,job:$("#schedJob").value,location:$("#schedLocation").value,tech:$("#schedTech").value}); saveState(); toast("Schedule saved"); renderSchedule(); };
}

function renderCustomers(){
  ensureV46();
  $("#screen").innerHTML = `${pageHead("Customers","saveCustomer")}
    <section class="form-panel form-grid">
      <div class="backend-banner"><b>Customer Database</b><small>Customers link to trucks, quotes, invoices, work orders, schedule, and reports.</small></div>
      <label>Customer / Company<input id="custName"></label>
      <div class="two-col"><label>Phone<input id="custPhone"></label><label>Email<input id="custEmail"></label></div>
      <label>Address / Location<input id="custAddress"></label>
      <label>Notes<textarea id="custNotes"></textarea></label>
      <div class="section-title">Saved Customers</div>
      <div>${state.customers.length ? state.customers.map((c,i)=>`<div class="customer-row"><div><b>${c.name}</b><small>${c.phone || ""} ${c.email || ""}<br>${c.address || ""}</small></div><button data-load-customer="${i}">Open</button></div>`).join("") : `<div class="output">No saved customers.</div>`}</div>
    </section>`;
  bindPageTools();
  $("#saveCustomer").onclick=()=>{ 
    state.customers.push({name:$("#custName").value,phone:$("#custPhone").value,email:$("#custEmail").value,address:$("#custAddress").value,notes:$("#custNotes").value,created:new Date().toLocaleString()}); 
    saveState(); toast("Customer saved"); renderCustomers(); 
  };
  $$("[data-load-customer]").forEach(btn=>btn.onclick=()=>{
    const c=state.customers[Number(btn.dataset.loadCustomer)];
    if(!c) return;
    state.truck.customer = c.name;
    saveState();
    toast("Customer set active");
    renderCustomers();
  });
}

function renderPinDrop(){
  $("#screen").innerHTML = `${pageHead("Pin Drop","savePin")}
    <section class="form-panel form-grid">
      <label>Customer / Job<input id="pinCustomer"></label>
      <label>Location / Address<input id="pinLocation"></label>
      <label>GPS Coordinates<input id="pinGps"></label>
      <button class="action-btn" id="useGps">Use My GPS</button>
      <div class="output">${state.pins.map(p=>`${p.customer}: ${p.location} ${p.gps}`).join("\n") || "No saved pins."}</div>
    </section>`;
  bindPageTools();
  $("#useGps").onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{$("#pinGps").value=`${p.coords.latitude}, ${p.coords.longitude}`; toast("GPS added");},()=>toast("GPS denied/unavailable")):toast("GPS not supported");
  $("#savePin").onclick=()=>{ state.pins.push({customer:$("#pinCustomer").value,location:$("#pinLocation").value,gps:$("#pinGps").value}); saveState(); toast("Pin saved"); renderPinDrop(); };
}

function renderCamera(){
  ensureV46();
  $("#screen").innerHTML = `${pageHead("Camera / OCR","saveCamera")}
    <section class="form-panel form-grid">
      <div class="backend-banner"><b>OCR Scanner</b><small>Scan VIN plates, part labels, invoices, documents, fault screens, and repair photos. Local placeholder is ready; real OCR backend connects later.</small></div>
      <input id="ocrFile" type="file" accept="image/*,.pdf" capture="environment">
      <label>Scan Type<select id="ocrType"><option value="vin">VIN Plate</option><option value="part">Part Box / Label</option><option value="invoice">Invoice / Receipt</option><option value="doc">Document / Fault Screen</option></select></label>
      <button class="action-btn primary" id="runOcr">Run OCR Scan</button>
      <div class="scan-result" id="ocrResult">No scan yet.</div>
      <div class="pro-actions">
        <button id="ocrToTruck">Save to Truck</button>
        <button id="ocrToParts">Save to Parts</button>
        <button id="ocrToMemory">Save Memory</button>
      </div>
    </section>`;
  bindPageTools();
  let lastResult = "";
  $("#runOcr").onclick=()=>{
    const f=$("#ocrFile").files[0];
    lastResult = fakeOcrResult($("#ocrType").value, f?.name);
    $("#ocrResult").textContent = lastResult;
    state.ocrScans.unshift({type:$("#ocrType").value,result:lastResult,date:new Date().toLocaleString()});
    saveState();
    toast("OCR scan ready");
  };
  $("#ocrToTruck").onclick=()=>{ addTruckHistory("OCR", lastResult || $("#ocrResult").textContent); toast("OCR saved to truck"); };
  $("#ocrToParts").onclick=()=>{ state.parts.push({query:"OCR Scan", notes:lastResult || $("#ocrResult").textContent}); saveState(); toast("OCR saved to parts"); };
  $("#ocrToMemory").onclick=()=>{ state.notes.push({type:"OCR",note:lastResult || $("#ocrResult").textContent}); saveState(); toast("OCR saved to memory"); };
  $("#saveCamera").onclick=()=>{ state.notes.push({type:"Camera/OCR",note:lastResult || $("#ocrResult").textContent,date:new Date().toLocaleString()}); saveState(); toast("Camera/OCR saved"); };
}

function renderMemory(){
  $("#screen").innerHTML = `${pageHead("Repair Memory","saveMemory")}
    <section class="form-panel form-grid">
      <label>Repair Note<textarea id="memoryNote"></textarea></label>
      <div class="output">${state.notes.map(n=>`${n.type}: ${n.note || n.code || ""}`).join("\n\n") || "No repair memory saved."}</div>
    </section>`;
  bindPageTools();
  $("#saveMemory").onclick=()=>{ state.notes.push({type:"Memory",note:$("#memoryNote").value,date:new Date().toLocaleString()}); saveState(); toast("Memory saved"); renderMemory(); };
}

function renderSuppliers(){
  $("#screen").innerHTML = `${pageHead("Suppliers","saveSupplier")}
    <section class="form-panel form-grid">
      <div class="big-nav-grid">
        <button class="big-nav-card" onclick="window.open('https://www.google.com/maps/search/FleetPride+near+me','_blank')"><b>FleetPride</b><span>Open maps search</span></button>
        <button class="big-nav-card" onclick="window.open('https://www.google.com/maps/search/heavy+duty+truck+parts+near+me','_blank')"><b>HD Parts</b><span>Local parts</span></button>
      </div>
      <label>Supplier Notes<textarea id="supplierNotes"></textarea></label>
    </section>`;
  bindPageTools();
  $("#saveSupplier").onclick=()=>{ state.notes.push({type:"Supplier",note:$("#supplierNotes").value,date:new Date().toLocaleString()}); saveState(); toast("Supplier note saved"); };
}

function renderPmDue(){
  $("#screen").innerHTML = `${pageHead("PM Due","savePm")}
    <section class="form-panel form-grid">
      <label>Truck / Unit<input id="pmTruck" value="${state.truck.unit || ""}"></label>
      <label>PM Due Note<textarea id="pmNote" placeholder="Oil service, filters, DOT, annual, brakes..."></textarea></label>
      <div class="output">${state.pm.map(p=>`${p.truck}: ${p.note}`).join("\n") || "No PM reminders saved."}</div>
    </section>`;
  bindPageTools();
  $("#savePm").onclick=()=>{ state.pm.push({truck:$("#pmTruck").value,note:$("#pmNote").value,date:new Date().toLocaleString()}); saveState(); toast("PM saved"); renderPmDue(); };
}

function renderReports(){
  $("#screen").innerHTML = `${pageHead("Reports","",false)}
    <section class="form-panel form-grid">
      <div class="summary-card">
        <div><span>Invoices</span><b>${money(totalInvoiceMoney())}</b></div>
        <div><span>Clock</span><b>${money(clockDollars(totalSeconds()))}</b></div>
        <div><span>Total</span><b>${money(homeEarnings())}</b></div>
      </div>
      <div class="output">Quotes: ${state.quotes.length}
Invoices: ${state.invoices.length}
Work Orders: ${state.workorders.length}
Customers: ${state.customers.length}
Schedule Items: ${state.schedule.length}
Pins: ${state.pins.length}</div>
    </section>`;
  bindPageTools();
}

function renderSettings(tab="main"){
  ensureV46();
  ensureSettingsV48();
  const s=state.settings;
  const p=state.pricing;
  let content = "";

  if(tab==="main"){
    content = `<section class="settings-section form-grid">
      <h3>Shop Information</h3>
      <label>Shop Name<input id="setShop" value="${s.shop}"></label>
      <label>DBA / Display Name<input id="setDba" value="${s.dba || s.shop || ""}"></label>
      <div class="two-col"><label>Phone<input id="setPhone" value="${s.phone}"></label><label>Email<input id="setEmail" value="${s.email || ""}"></label></div>
      <label>Website<input id="setWebsite" value="${s.website || "www.rollingwrenchdiesel.com"}"></label>
      <label>Address<input id="setAddress" value="${s.address || ""}"></label>
      <div class="two-col"><label>DOT Number<input id="setDot" value="${s.dot || ""}"></label><label>Tax ID<input id="setTaxId" value="${s.taxId || ""}"></label></div>
    </section>`;
  }

  if(tab==="themes"){
    const themes=[["orange","Rolling Wrench Orange","Graphite + orange"],["green","Night Ops Green","Dark + green"],["blue","Steel Blue","Fleet blue"],["red","Snap-On Red","Red shop style"],["gray","Fleet Gray","Clean gray"],["light","Light Mode","Bright office"]];
    content = `<section class="settings-section"><h3>Theme Manager</h3><div class="theme-grid">${themes.map(t=>`<button class="theme-card ${state.ui.theme===t[0]?'active':''}" data-theme="${t[0]}"><b>${t[1]}</b><small>${t[2]}</small></button>`).join("")}</div></section>
    <section class="settings-section form-grid"><h3>Background Style</h3><label>Background<select id="setBackground"><option ${state.ui.background==="diamond"?"selected":""}>diamond</option><option ${state.ui.background==="carbon"?"selected":""}>carbon</option><option ${state.ui.background==="steel"?"selected":""}>steel</option><option ${state.ui.background==="plain"?"selected":""}>plain</option></select></label></section>`;
  }

  if(tab==="pricing"){
    content = `<section class="settings-section form-grid"><h3>Pricing Manager</h3>
      <div class="two-col"><label>Shop Labor<input id="shopLabor" type="number" value="${p.shopLabor}"></label><label>Mobile Labor<input id="mobileLabor" type="number" value="${p.mobileLabor}"></label></div>
      <div class="two-col"><label>Diagnostic Rate<input id="diagnosticRate" type="number" value="${p.diagnostic}"></label><label>Roadside Rate<input id="roadsideRate" type="number" value="${p.roadside}"></label></div>
      <div class="two-col"><label>Service Call<input id="serviceCall2" type="number" value="${p.serviceCall}"></label><label>Mileage Rate<input id="mileageRate" type="number" step=".01" value="${p.mileage}"></label></div>
      <div class="two-col"><label>Shop Supplies %<input id="suppliesPct" type="number" step=".1" value="${p.shopSuppliesPct}"></label><label>Environmental Fee<input id="envFee" type="number" step=".01" value="${p.envFee}"></label></div>
      <div class="two-col"><label>Card Processing %<input id="cardPct" type="number" step=".1" value="${p.cardPct}"></label><label>Tax %<input id="taxPct" type="number" step=".1" value="${p.taxPct}"></label></div>
      <div class="two-col"><label>After Hours Multiplier<input id="afterHoursMult" type="number" step=".1" value="${p.afterHoursMultiplier}"></label><label>Weekend Multiplier<input id="weekendMult" type="number" step=".1" value="${p.weekendMultiplier}"></label></div>
      <label>Holiday Multiplier<input id="holidayMult" type="number" step=".1" value="${p.holidayMultiplier}"></label>
    </section>`;
  }

  if(tab==="employees"){
    content = `<section class="settings-section form-grid"><h3>Employee Manager</h3>
      <div class="two-col"><label>Name<input id="empName" placeholder="Employee name"></label><label>Position<input id="empRole" placeholder="Tech / Manager / Admin"></label></div>
      <div class="two-col"><label>Phone<input id="empPhone"></label><label>Email<input id="empEmail"></label></div>
      <div class="two-col"><label>Pay Rate<input id="empPay"></label><label>Billable Labor Rate<input id="empLabor" value="${s.laborRate || 135}"></label></div>
      <button class="action-btn primary" id="addEmployee">Add Employee</button>
      <div>${state.employees.map((e,i)=>`<div class="employee-card"><div><b>${e.name}</b><small>${e.role} • Labor ${money(e.laborRate || 0)}<br>${e.phone || ""} ${e.email || ""}</small></div><button data-remove-emp="${i}">Remove</button></div>`).join("")}</div>
    </section>`;
  }

  if(tab==="alerts"){
    content = `<section class="settings-section"><h3>Alert Manager</h3>
      ${toggleBtn("alertSettings.pm","PM Due Alerts","Maintenance reminders")}
      ${toggleBtn("alertSettings.schedule","Schedule Alerts","Upcoming jobs")}
      ${toggleBtn("alertSettings.invoice","Invoice Due Alerts","Unpaid invoice reminders")}
      ${toggleBtn("alertSettings.quote","Quote Follow-Up Alerts","Estimate follow-up reminders")}
      ${toggleBtn("alertSettings.clock","Employee Clock Alerts","Running too long / clock reminders")}
      ${toggleBtn("alertSettings.truck","Truck Service Alerts","Service due and history alerts")}
    </section>`;
  }

  if(tab==="sounds"){
    content = `<section class="settings-section"><h3>Sound Manager</h3>
      ${toggleBtn("soundSettings.button","Button Click","Tap sounds")}
      ${toggleBtn("soundSettings.save","Save Confirmation","Sound when saved")}
      ${toggleBtn("soundSettings.aiVoice","AI Voice","Voice playback")}
      ${toggleBtn("soundSettings.notification","Notification Sound","Alert sound")}
      ${toggleBtn("soundSettings.clockIn","Clock In Sound","Start clock sound")}
      ${toggleBtn("soundSettings.clockOut","Clock Out Sound","Stop clock sound")}
      <div class="range-row"><label>Volume<input id="soundVolume" type="range" min="0" max="100" value="${state.soundSettings.volume}"></label><b>${state.soundSettings.volume}%</b></div>
    </section>`;
  }

  if(tab==="display"){
    content = `<section class="settings-section"><h3>Display Settings</h3>
      ${toggleBtn("ui.compact","Compact Mode","Fit more on mobile screen")}
      ${toggleBtn("ui.largeText","Large Text","Bigger labels and buttons")}
      ${toggleBtn("ui.highContrast","High Contrast","Brighter borders and text")}
      ${toggleBtn("ui.showEarnings","Show Earnings Card","Dashboard finance card")}
      ${toggleBtn("ui.showSchedule","Show Schedule Card","Dashboard schedule card")}
      ${toggleBtn("ui.showRecentJobs","Show Recent Jobs","Dashboard recent jobs")}
      ${toggleBtn("ui.showSystemStatus","Show System Status","GPS/camera/storage status")}
    </section>`;
  }

  if(tab==="ai"){
    content = `<section class="settings-section form-grid"><h3>Rolling Wrench AI Settings</h3>
      ${toggleBtn("aiSettings.voice","AI Voice On/Off","Talk back responses")}
      <label>Voice Speed<input id="aiVoiceSpeed" type="number" step=".1" value="${state.aiSettings.voiceSpeed}"></label>
      <label>Voice Type<select id="aiVoiceType"><option ${state.aiSettings.voiceType==="Shop Pro"?"selected":""}>Shop Pro</option><option ${state.aiSettings.voiceType==="Calm Tech"?"selected":""}>Calm Tech</option><option ${state.aiSettings.voiceType==="Fast Dispatcher"?"selected":""}>Fast Dispatcher</option></select></label>
      ${toggleBtn("aiSettings.autoRead","Auto Read Answers","Read AI answers out loud")}
      ${toggleBtn("aiSettings.saveConversations","Save Conversations","Keep chat history")}
      ${toggleBtn("aiSettings.rememberTruck","Remember Active Truck","Use current truck context")}
      ${toggleBtn("aiSettings.rememberCustomer","Remember Customer","Use customer context")}
    </section>`;
  }

  if(tab==="ocr"){
    content = `<section class="settings-section"><h3>OCR Settings</h3>
      ${toggleBtn("ocrSettings.autoOcr","Auto OCR","Automatically scan uploaded images")}
      ${toggleBtn("ocrSettings.vin","VIN Recognition","Read VIN plates")}
      ${toggleBtn("ocrSettings.part","Part Label Recognition","Read part boxes/labels")}
      ${toggleBtn("ocrSettings.invoice","Invoice Recognition","Read invoices/receipts")}
      ${toggleBtn("ocrSettings.fault","Fault Screen Recognition","Read screenshots/scanner screens")}
    </section>`;
  }

  if(tab==="cloud"){
    content = `<section class="settings-section form-grid"><h3>Data & Sync</h3>
      <label>Supabase URL<input id="supabaseUrl" value="${state.supabase?.url || ""}" placeholder="https://xxxxx.supabase.co"></label>
      <label>Anon Key<input id="supabaseKey" value="${state.supabase?.anonKey || ""}" placeholder="Paste anon public key later"></label>
      <div class="sync-status"><i></i><span>Supabase Status: ${state.supabase?.enabled ? "Configured" : "Local Only"} • Last Sync: ${state.supabase?.lastSync || "Never"}</span></div>
      <div class="export-grid">
        <button data-route="supabase">Open Supabase Sync</button>
        <button data-export="all">Backup Database</button>
        <button id="restoreData">Restore Database</button>
        <button data-export="customers">Export Customers</button>
        <button data-export="trucks">Export Trucks</button>
        <button data-export="quotes">Export Quotes</button>
        <button data-export="invoices">Export Invoices</button>
      </div>
      <input id="restoreFile" type="file" accept="application/json" hidden>
    </section>`;
  }

  if(tab==="security"){
    content = `<section class="settings-section form-grid"><h3>Security</h3>
      ${toggleBtn("security.appLock","App Lock On/Off","Require PIN before opening app")}
      <label>PIN Code<input id="securityPin" type="password" value="${state.security.pin || ""}" placeholder="Set PIN"></label>
      ${toggleBtn("security.faceId","Face ID","Placeholder until native wrapper/sign-in")}
      ${toggleBtn("security.touchId","Touch ID","Placeholder until native wrapper/sign-in")}
      <div class="output">Security options are local placeholders until sign-in/user roles are added.</div>
    </section>`;
  }

  $("#screen").innerHTML = `${pageHead("Settings","saveSettings")}${settingsTabButtons(tab)}${content}`;
  bindPageTools();
  bindSettingsToggles();
  $$("[data-settings-tab]").forEach(b=>b.onclick=()=>renderSettings(b.dataset.settingsTab));

  $("#saveSettings").onclick=()=>{ 
    if($("#setShop")) state.settings.shop=$("#setShop").value;
    if($("#setDba")) state.settings.dba=$("#setDba").value;
    if($("#setPhone")) state.settings.phone=$("#setPhone").value;
    if($("#setEmail")) state.settings.email=$("#setEmail").value;
    if($("#setWebsite")) state.settings.website=$("#setWebsite").value;
    if($("#setAddress")) state.settings.address=$("#setAddress").value;
    if($("#setDot")) state.settings.dot=$("#setDot").value;
    if($("#setTaxId")) state.settings.taxId=$("#setTaxId").value;

    if($("#shopLabor")){
      state.pricing={shopLabor:+$("#shopLabor").value||135,mobileLabor:+$("#mobileLabor").value||135,diagnostic:+$("#diagnosticRate").value||150,roadside:+$("#roadsideRate").value||150,serviceCall:+$("#serviceCall2").value||250,mileage:+$("#mileageRate").value||0,shopSuppliesPct:+$("#suppliesPct").value||0,envFee:+$("#envFee").value||0,cardPct:+$("#cardPct").value||0,taxPct:+$("#taxPct").value||0,afterHoursMultiplier:+$("#afterHoursMult").value||1.5,weekendMultiplier:+$("#weekendMult").value||1.5,holidayMultiplier:+$("#holidayMult").value||2};
      state.settings.laborRate=state.pricing.mobileLabor;
      state.settings.serviceCall=state.pricing.serviceCall;
    }

    if($("#setBackground")) state.ui.background=$("#setBackground").value;
    if($("#soundVolume")) state.soundSettings.volume=+$("#soundVolume").value;
    if($("#aiVoiceSpeed")) state.aiSettings.voiceSpeed=+$("#aiVoiceSpeed").value || 1;
    if($("#aiVoiceType")) state.aiSettings.voiceType=$("#aiVoiceType").value;
    if($("#securityPin")) state.security.pin=$("#securityPin").value;
    if($("#supabaseUrl")) state.supabase={url:$("#supabaseUrl").value,anonKey:$("#supabaseKey").value,enabled:!!($("#supabaseUrl").value&&$("#supabaseKey").value),lastSync:new Date().toLocaleString()};

    saveState(); applyUiSettings(); toast("Settings saved"); 
  };

  if($("#addEmployee")) $("#addEmployee").onclick=()=>{
    state.employees.push({name:$("#empName").value,role:$("#empRole").value,phone:$("#empPhone").value,email:$("#empEmail").value,payRate:$("#empPay").value,laborRate:+$("#empLabor").value||state.settings.laborRate,admin:false,clock:true,schedule:true,invoice:false});
    saveState(); toast("Employee added"); renderSettings("employees");
  };
  $$("[data-remove-emp]").forEach(b=>b.onclick=()=>{state.employees.splice(+b.dataset.removeEmp,1);saveState();renderSettings("employees");});
  $$("[data-export]").forEach(b=>b.onclick=()=>exportJson(b.dataset.export));
  if($("#restoreData")) $("#restoreData").onclick=()=>$("#restoreFile").click();
  if($("#restoreFile")) $("#restoreFile").onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{ try{ const data=JSON.parse(r.result); if(data.settings) state=data; saveState(); toast("Database restored"); renderSettings("cloud"); }catch(err){toast("Restore failed");} };
    r.readAsText(f);
  };
}

function renderRepair(){
  $("#screen").innerHTML = `${pageHead("Repair Command","",false)}
    <section class="big-nav-grid">
      <button class="big-nav-card" data-route="fault"><b>Fault Doctor</b><span>SPN/FMI, P-codes, diagnostic flow</span></button>
      <button class="big-nav-card" data-route="parts"><b>Parts Lookup</b><span>Part number, cross reference, supplier</span></button>
      <button class="big-nav-card" data-route="repairhud"><b>Repair HUD</b><span>Procedures, notes, repair steps</span></button>
      <button class="big-nav-card" data-route="memory"><b>Repair Memory</b><span>Saved fixes and notes</span></button>
      <button class="big-nav-card" data-route="camera"><b>Camera/OCR</b><span>Scan VIN, part label, fault screen</span></button>
      <button class="big-nav-card" data-route="pmdue"><b>PM Due</b><span>Maintenance reminders</span></button>
    </section>`;
  bindPageTools();
}
function renderBusiness(){
  $("#screen").innerHTML = `${pageHead("Business Center","",false)}
    <section class="big-nav-grid">
      <button class="big-nav-card" data-route="quotes"><b>Smart Quotes</b><span>Build customer estimates</span></button>
      <button class="big-nav-card" data-route="invoices"><b>Invoices</b><span>Professional invoice builder</span></button>
      <button class="big-nav-card" data-route="workorders"><b>Work Orders</b><span>Complaint, cause, correction</span></button>
      <button class="big-nav-card" data-route="customers"><b>Customers</b><span>Fleet/customer database</span></button>
      <button class="big-nav-card" data-route="clock"><b>Time Clock</b><span>3 live jobs</span></button>
      <button class="big-nav-card" data-route="reports"><b>Reports</b><span>Income and labor</span></button>
    </section>`;
  bindPageTools();
}


function renderAlerts(){
  const alerts = [
    ["PM Due", state.pm.length ? `${state.pm.length} PM reminders saved` : "No PM reminders saved yet"],
    ["Schedule", state.schedule.length ? `${state.schedule.length} jobs on schedule` : "No jobs scheduled"],
    ["Invoices", state.invoices.length ? `${state.invoices.length} invoices saved` : "No invoices saved"],
    ["Clock", Object.values(state.jobs).some(j=>j.running) ? "A job clock is running" : "No job clock running"]
  ];
  $("#screen").innerHTML = `${pageHead("Alerts","",false)}
    <section class="alert-list">
      ${alerts.map(a=>`<div class="alert-card"><b>${a[0]}</b><small>${a[1]}</small></div>`).join("")}
    </section>`;
  bindPageTools();
}


function ensureV46(){
  if(!state.trucks) state.trucks = [];
  if(!state.customerTrucks) state.customerTrucks = {};
  if(!state.supabase) state.supabase = {url:"", anonKey:"", enabled:false, lastSync:"Never"};
  if(!state.ocrScans) state.ocrScans = [];
  if(!state.aiBackend) state.aiBackend = {endpoint:"", enabled:false, model:"Rolling Wrench AI Local"};
  if(!state.alerts) state.alerts = [];
}
ensureV46();

function addAlert(title, body){
  ensureV46();
  state.alerts.unshift({title, body, date:new Date().toLocaleString(), read:false});
  saveState();
  const badge=document.getElementById("alertCount");
  if(badge) badge.textContent = state.alerts.filter(a=>!a.read).length;
}
function linkedCustomerOptions(selected=""){
  const customers = state.customers || [];
  return `<option value="">Select customer</option>` + customers.map(c=>`<option ${c.name===selected?'selected':''}>${c.name}</option>`).join("");
}
function saveActiveTruckToFleet(){
  ensureV46();
  const exists = state.trucks.find(t=>t.vin && t.vin===state.truck.vin);
  if(exists) Object.assign(exists, state.truck);
  else state.trucks.unshift({...state.truck, id:Date.now().toString(), history:[]});
  saveState();
}
function addTruckHistory(type, text){
  ensureV46();
  const vin = state.truck.vin || "NO VIN";
  let truck = state.trucks.find(t=>t.vin===vin);
  if(!truck){
    truck = {...state.truck, id:Date.now().toString(), history:[]};
    state.trucks.unshift(truck);
  }
  if(!truck.history) truck.history=[];
  truck.history.unshift({type, text, date:new Date().toLocaleString()});
  saveState();
}
function fakeOcrResult(kind, fileName){
  if(kind==="vin") return `VIN OCR RESULT\\nVIN: UNKNOWN - VERIFY MANUALLY\\nAction: Save to Truck Profile after confirmation.\\nFile: ${fileName || "camera image"}`;
  if(kind==="invoice") return `INVOICE OCR RESULT\\nCustomer: UNKNOWN\\nLabor/parts lines need review.\\nAction: Send to Invoice module.\\nFile: ${fileName || "document"}`;
  if(kind==="part") return `PART LABEL OCR RESULT\\nPart Number: UNKNOWN - VERIFY\\nBrand/Supplier: UNKNOWN\\nAction: Send to Parts Lookup.\\nFile: ${fileName || "part image"}`;
  return `DOCUMENT OCR RESULT\\nText extraction placeholder ready.\\nAction: Save to Repair Memory / Work Order.\\nFile: ${fileName || "file"}`;
}
function localAiAnswer(q){
  q=(q||"").toLowerCase();
  if(q.includes("quote")) return "Quote workflow: I can use labor rate, estimated time, service call, parts list, supplies, and disclaimer. Save to Smart Quotes when reviewed.";
  if(q.includes("invoice")) return "Invoice workflow: I can professionalize work performed, add line items, calculate totals, and save to Invoices.";
  if(q.includes("part") || q.includes("water pump") || q.includes("belt")) return "Parts workflow: identify likely part category, require VIN/OEM/supplier verification, then save to Parts Lookup.";
  if(q.includes("vin")) return "VIN workflow: scan/read VIN, confirm manually, then save to Truck Profile and active truck.";
  if(q.includes("spn") || q.includes("fmi") || q.includes("fault")) return "Fault workflow: open Fault Doctor, document active/inactive status, wiring checks, live data, mechanical checks, and final repair.";
  return localAiAnswer(q);
}


function ensureV5(){
  ensureV46();
  ensureSettingsV48();
  if(!state.pmRecords) state.pmRecords=[];
  if(!state.inventory) state.inventory=[];
  if(!state.notifications) state.notifications=[];
  if(!state.supplierSearches) state.supplierSearches=[];
  if(!state.workflowLinks) state.workflowLinks=[];
  if(!state.authPreview) state.authPreview={enabled:false,email:"",role:"Owner/Admin"};
}
function v5AddNotification(title,body){
  ensureV5();
  state.notifications.unshift({title,body,date:new Date().toLocaleString(),read:false});
  saveState();
}
function v5CurrentContext(){
  return {
    customer: state.truck.customer || "",
    truck: state.truck.unit || "",
    vin: state.truck.vin || "",
    engine: state.truck.engine || ""
  };
}
function v5CreateWorkflow(kind, desc){
  ensureV5();
  const ctx=v5CurrentContext();
  const id=Date.now().toString();
  const item={id,kind,desc,customer:ctx.customer,truck:ctx.truck,vin:ctx.vin,date:new Date().toLocaleString()};
  state.workflowLinks.unshift(item);
  if(kind==="workorder") state.workorders.push({customer:ctx.customer,truck:ctx.truck,desc,status:"Open",workflowId:id});
  if(kind==="quote") state.quotes.push({customer:ctx.customer,truck:ctx.truck,desc,total:0,workflowId:id});
  if(kind==="invoice") state.invoices.push({customer:ctx.customer,truck:ctx.truck,work:desc,total:0,workflowId:id});
  addTruckHistory("Workflow", `${kind}: ${desc}`);
  saveState();
  return item;
}
function v5RouteAiCommand(q){
  const text=(q||"").toLowerCase();
  if(text.includes("invoice")) return {route:"invoices", action:"invoice", msg:"Created invoice workflow"};
  if(text.includes("quote") || text.includes("estimate")) return {route:"quotes", action:"quote", msg:"Created quote workflow"};
  if(text.includes("work order") || text.includes("job")) return {route:"workorders", action:"workorder", msg:"Created work order workflow"};
  if(text.includes("pm") || text.includes("maintenance")) return {route:"pmmanager", action:"pm", msg:"Created PM reminder"};
  if(text.includes("inventory") || text.includes("stock")) return {route:"inventory", action:"inventory", msg:"Opened inventory"};
  if(text.includes("supplier") || text.includes("price") || text.includes("parts location")) return {route:"supplierpricing", action:"supplier", msg:"Opened supplier pricing"};
  if(text.includes("pin") || text.includes("gps") || text.includes("location")) return {route:"pindrop", action:"pin", msg:"Opened pin drop"};
  if(text.includes("scan") || text.includes("ocr") || text.includes("photo")) return {route:"camera", action:"ocr", msg:"Opened OCR scanner"};
  return {route:"repairhud", action:"note", msg:"Saved AI repair note"};
}


function renderWorkflowHub(){
  ensureV5();
  $("#screen").innerHTML = `${pageHead("Workflow Hub","",false)}
    <section class="backend-banner"><b>Business Workflow</b><small>Customer → Truck → Work Order → Quote → Invoice → Reports</small></section>
    <section class="workflow-timeline">
      <div class="workflow-step"><i>1</i><div><b>Customer</b><small>${state.truck.customer || "No active customer"}</small></div><button class="action-btn" data-route="customers">Open</button></div>
      <div class="workflow-step"><i>2</i><div><b>Truck</b><small>${state.truck.unit || "No truck"} • ${state.truck.vin || "NO VIN"}</small></div><button class="action-btn" data-route="truck">Open</button></div>
      <div class="workflow-step"><i>3</i><div><b>Work Order</b><small>${state.workorders.length} saved</small></div><button class="action-btn" data-route="workorders">Open</button></div>
      <div class="workflow-step"><i>4</i><div><b>Quote</b><small>${state.quotes.length} saved</small></div><button class="action-btn" data-route="quotes">Open</button></div>
      <div class="workflow-step"><i>5</i><div><b>Invoice</b><small>${state.invoices.length} saved</small></div><button class="action-btn" data-route="invoices">Open</button></div>
      <div class="workflow-step"><i>6</i><div><b>Reports</b><small>Revenue / labor / history</small></div><button class="action-btn" data-route="reports">Open</button></div>
    </section>
    <section class="smart-action-row">
      <button id="quickWO">New WO</button><button id="quickQuote">New Quote</button><button id="quickInvoice">New Invoice</button>
    </section>`;
  bindPageTools();
  $("#quickWO").onclick=()=>{v5CreateWorkflow("workorder","Quick workflow work order");toast("Work order created");};
  $("#quickQuote").onclick=()=>{v5CreateWorkflow("quote","Quick workflow quote");toast("Quote created");};
  $("#quickInvoice").onclick=()=>{v5CreateWorkflow("invoice","Quick workflow invoice");toast("Invoice created");};
}

function renderPMManager(){
  ensureV5();
  $("#screen").innerHTML = `${pageHead("PM Manager","savePmManager")}
    <section class="form-panel form-grid">
      <label>Truck / Unit<input id="pmUnit" value="${state.truck.unit || ""}"></label>
      <div class="two-col"><label>Service Type<input id="pmType" placeholder="Oil, DOT, filters, brakes, overhead"></label><label>Due Mileage<input id="pmMiles" type="number"></label></div>
      <div class="two-col"><label>Due Date<input id="pmDate" type="date"></label><label>Priority<select id="pmPriority"><option>Normal</option><option>High</option><option>Critical</option></select></label></div>
      <label>Notes<textarea id="pmNotes"></textarea></label>
      <div>${state.pmRecords.length ? state.pmRecords.map(p=>`<div class="pm-card"><b>${p.unit} — ${p.type}</b><small>Due: ${p.date || "No date"} / ${p.miles || "No miles"} • ${p.priority}<br>${p.notes || ""}</small></div>`).join("") : `<div class="output">No PM records yet.</div>`}</div>
    </section>`;
  bindPageTools();
  $("#savePmManager").onclick=()=>{state.pmRecords.unshift({unit:$("#pmUnit").value,type:$("#pmType").value,miles:$("#pmMiles").value,date:$("#pmDate").value,priority:$("#pmPriority").value,notes:$("#pmNotes").value});v5AddNotification("PM Due Added",`${$("#pmUnit").value} ${$("#pmType").value}`);saveState();toast("PM saved");renderPMManager();};
}

function renderInventory(){
  ensureV5();
  $("#screen").innerHTML = `${pageHead("Inventory","saveInventory")}
    <section class="form-panel form-grid">
      <div class="two-col"><label>Item / Part<input id="invItem"></label><label>Part Number<input id="invPart"></label></div>
      <div class="two-col"><label>Quantity<input id="invQty" type="number"></label><label>Cost Each<input id="invCost" type="number" step=".01"></label></div>
      <label>Location<input id="invLocation" placeholder="Truck, shop, shelf, bin"></label>
      <label>Notes<textarea id="invNotes2"></textarea></label>
      <div>${state.inventory.length ? state.inventory.map(i=>`<div class="inventory-card"><b>${i.item} • ${i.part}</b><small>Qty ${i.qty} • ${money(i.cost)} each • ${i.location}<br>${i.notes || ""}</small></div>`).join("") : `<div class="output">No inventory saved.</div>`}</div>
    </section>`;
  bindPageTools();
  $("#saveInventory").onclick=()=>{state.inventory.unshift({item:$("#invItem").value,part:$("#invPart").value,qty:+$("#invQty").value||0,cost:+$("#invCost").value||0,location:$("#invLocation").value,notes:$("#invNotes2").value});saveState();toast("Inventory saved");renderInventory();};
}

function renderSupplierPricing(){
  ensureV5();
  $("#screen").innerHTML = `${pageHead("Supplier Pricing","saveSupplierSearch")}
    <section class="form-panel form-grid">
      <div class="backend-banner"><b>Supplier Pricing Ready</b><small>Real pricing needs supplier APIs or manual entry. This screen stores search results and location notes.</small></div>
      <label>Part / Job<input id="supplierPart" placeholder="X15 water pump, wheel seal, clutch kit..."></label>
      <div class="two-col"><label>Supplier<input id="supplierName" placeholder="FleetPride / dealer / NAPA"></label><label>Location<input id="supplierLocation" placeholder="City / branch"></label></div>
      <div class="two-col"><label>Price<input id="supplierPrice" type="number" step=".01"></label><label>Availability<input id="supplierAvailability" placeholder="In stock / ordered"></label></div>
      <label>Notes<textarea id="supplierSearchNotes"></textarea></label>
      <button class="action-btn" onclick="window.open('https://www.google.com/maps/search/heavy+duty+truck+parts+near+me','_blank')">Open Local Parts Map</button>
      <div>${state.supplierSearches.length ? state.supplierSearches.map(s=>`<div class="supplier-card"><b>${s.part} — ${s.supplier}</b><small>${s.location} • ${money(s.price)} • ${s.availability}<br>${s.notes || ""}</small></div>`).join("") : `<div class="output">No supplier pricing saved.</div>`}</div>
    </section>`;
  bindPageTools();
  $("#saveSupplierSearch").onclick=()=>{state.supplierSearches.unshift({part:$("#supplierPart").value,supplier:$("#supplierName").value,location:$("#supplierLocation").value,price:+$("#supplierPrice").value||0,availability:$("#supplierAvailability").value,notes:$("#supplierSearchNotes").value});saveState();toast("Supplier pricing saved");renderSupplierPricing();};
}

function renderNotifications(){
  ensureV5();
  $("#screen").innerHTML = `${pageHead("Notifications","",false)}
    <section class="form-panel">
      ${(state.notifications||[]).length ? state.notifications.map(n=>`<div class="notification-card"><b>${n.title}</b><small>${n.date}<br>${n.body}</small></div>`).join("") : `<div class="output">No notifications yet.</div>`}
    </section>`;
  bindPageTools();
}

function renderSignInPreview(){
  ensureV5();
  $("#screen").innerHTML = `${pageHead("Sign In Preview","",false)}
    <section class="login-preview">
      <div class="brand-mark" style="margin:0 auto 10px;">RW</div>
      <h2>Rolling Wrench AI</h2>
      <p>Sign-in comes last after core app is approved.</p>
      <label>Email<input id="loginEmail" placeholder="owner@shop.com"></label>
      <label>Password<input type="password" placeholder="Password"></label>
      <button class="action-btn primary" style="width:100%;margin-top:12px;">Sign In Preview</button>
      <div class="output" style="margin-top:12px;">Future roles: Owner/Admin, Operations Manager, Technician, Customer Approval.</div>
    </section>`;
  bindPageTools();
}


const RWD_SUPABASE_URL = "https://uxpkqwcmvtqvubibbrek.supabase.co";
const RWD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4cGtxd2NtdnRxdnViaWJicmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzk4NjQsImV4cCI6MjA5MjgxNTg2NH0.afiaSFqkRFEXW5nPQVRXKZcpKkS6iF3T_hTQC2P15HQ";

function ensureSupabaseConfigured(){
  ensureV5();
  state.supabase = state.supabase || {};
  if(!state.supabase.url) state.supabase.url = RWD_SUPABASE_URL;
  if(!state.supabase.anonKey) state.supabase.anonKey = RWD_SUPABASE_ANON_KEY;
  state.supabase.enabled = !!(state.supabase.url && state.supabase.anonKey);
  saveState();
}
async function supabaseRest(table, method="GET", body=null){
  ensureSupabaseConfigured();
  const url = `${state.supabase.url}/rest/v1/${table}`;
  const headers = {
    "apikey": state.supabase.anonKey,
    "Authorization": `Bearer ${state.supabase.anonKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };
  const opts = {method, headers};
  if(body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch(e) { data = text; }
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  return data;
}
function rwdDbPayload(kind, data){
  return {
    app_kind: kind,
    payload: data,
    local_id: data.id || data.vin || data.date || Date.now().toString(),
    created_at: new Date().toISOString()
  };
}
async function syncCollectionToSupabase(kind, arr){
  const items = Array.isArray(arr) ? arr : [];
  let ok=0, fail=0, errors=[];
  for(const item of items){
    try {
      await supabaseRest("rwd_app_data", "POST", rwdDbPayload(kind,item));
      ok++;
    } catch(e) {
      fail++;
      errors.push(`${kind}: ${e.message}`);
    }
  }
  return {kind, ok, fail, errors};
}
async function syncAllToSupabase(){
  ensureSupabaseConfigured();
  const log=[];
  const packs = [
    ["customers", state.customers],
    ["trucks", state.trucks],
    ["workorders", state.workorders],
    ["quotes", state.quotes],
    ["invoices", state.invoices],
    ["schedule", state.schedule],
    ["parts", state.parts],
    ["pmRecords", state.pmRecords],
    ["inventory", state.inventory],
    ["aiConversations", state.aiConversations],
    ["pins", state.pins],
    ["ocrScans", state.ocrScans]
  ];
  for(const [kind, arr] of packs){
    const r = await syncCollectionToSupabase(kind, arr || []);
    log.push(`${kind}: synced ${r.ok}, failed ${r.fail}`);
    if(r.errors.length) log.push(...r.errors.slice(0,3));
  }
  state.supabase.lastSync = new Date().toLocaleString();
  saveState();
  return log.join("\n");
}
async function testSupabaseConnection(){
  ensureSupabaseConfigured();
  return await supabaseRest("rwd_app_data?select=id&limit=1","GET");
}


function renderSupabaseSync(){
  ensureSupabaseConfigured();
  $("#screen").innerHTML = `${pageHead("Supabase Sync","",false)}
    <section class="supabase-panel">
      <b>Supabase Connected</b>
      <small>Project: ${state.supabase.url}</small>
      <small>Status: ${state.supabase.enabled ? "Configured" : "Missing key"}</small>
      <small>Last Sync: ${state.supabase.lastSync || "Never"}</small>
      <div class="sync-grid">
        <button id="testSupabase">Test Connection</button>
        <button id="syncSupabase">Sync Local Data</button>
        <button data-route="settings">Open Settings</button>
        <button data-export="all">Backup JSON</button>
      </div>
      <div class="sync-log" id="syncLog">Ready.</div>
    </section>
    <section class="settings-section">
      <h3>Required Supabase Table</h3>
      <div class="output">Create table: rwd_app_data
Columns:
id uuid default gen_random_uuid() primary key
app_kind text
local_id text
payload jsonb
created_at timestamptz default now()</div>
    </section>`;
  bindPageTools();
  $("#testSupabase").onclick=async()=>{
    $("#syncLog").textContent="Testing...";
    try{ await testSupabaseConnection(); $("#syncLog").textContent="Connection good. Table exists."; toast("Supabase connected"); }
    catch(e){ $("#syncLog").textContent="Connection failed or table missing:\\n"+e.message; toast("Check Supabase table"); }
  };
  $("#syncSupabase").onclick=async()=>{
    $("#syncLog").textContent="Syncing local app data...";
    try{ const log=await syncAllToSupabase(); $("#syncLog").textContent=log; toast("Sync complete"); }
    catch(e){ $("#syncLog").textContent="Sync failed:\\n"+e.message; toast("Sync failed"); }
  };
  $$("[data-export]").forEach(b=>b.onclick=()=>exportJson(b.dataset.export));
}


function ensureV52(){
  ensureV5();
  if(!state.aiService) state.aiService = {apiKey:"", endpoint:"", mode:"local"};
  if(!state.fileUploads) state.fileUploads = [];
  if(!state.storage) state.storage = {bucket:"rwd-files", uploaded:[]};
  if(!state.gpsPins) state.gpsPins = [];
  if(!state.serviceEngine) state.serviceEngine = {ready:true};
}
async function v52AskAi(prompt, attachments=[]){
  ensureV52();
  // Live backend endpoint is ready here. Without endpoint/key, local smart workflow answers.
  if(state.aiService.endpoint && state.aiService.apiKey){
    try{
      const res = await fetch(state.aiService.endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+state.aiService.apiKey},
        body:JSON.stringify({prompt, attachments, context:{truck:state.truck, customer:state.truck.customer, settings:state.settings}})
      });
      if(res.ok){
        const data = await res.json();
        return data.answer || data.text || JSON.stringify(data);
      }
    }catch(e){
      return "AI backend failed, using local workflow. Error: "+e.message+"\\n\\n"+v52LocalAi(prompt);
    }
  }
  return v52LocalAi(prompt);
}
function v52LocalAi(prompt){
  const q=(prompt||"").toLowerCase();
  const ctx=`Active Truck: ${state.truck.unit || "NONE"} ${state.truck.vin || ""} ${state.truck.engine || ""}`;
  if(q.includes("quote")){
    return `AI Quote Draft\\n${ctx}\\n\\nI can build this quote using labor rate ${money(state.settings.laborRate || 135)}/hr and service call ${money(state.settings.serviceCall || 250)}.\\n\\nNext: save to Smart Quotes or preview professional quote.`;
  }
  if(q.includes("invoice")){
    return `AI Invoice Draft\\n${ctx}\\n\\nI can turn your spoken work performed into professional invoice language, add labor/parts/service call, signature, and payment terms.`;
  }
  if(q.includes("work order") || q.includes("job")){
    return `Work Order Draft\\n${ctx}\\n\\nComplaint / Cause / Correction workflow is ready. I can create a work order from this note.`;
  }
  if(q.includes("part") || q.includes("water pump") || q.includes("belt") || q.includes("clutch")){
    return `Parts Lookup Draft\\n${ctx}\\n\\nLikely parts list can be created, but exact part numbers must be verified by VIN/OEM/supplier. I can save this to Parts Lookup and Supplier Pricing.`;
  }
  if(q.includes("vin")){
    return `VIN Workflow\\nUpload or photograph the VIN plate, confirm the VIN, then save to Truck Profile.`;
  }
  if(q.includes("spn") || q.includes("fmi") || q.includes("fault")){
    return `Fault Doctor Workflow\\nVerify active/inactive status, module, power/ground, wiring, live data, mechanical cause, final repair verification.`;
  }
  return `Rolling Wrench AI\\n${ctx}\\n\\nI can route this to quotes, invoices, work orders, parts, schedule, pin drop, PM, truck history, or repair memory.`;
}
function v52ExtractFromScan(kind, fileName="uploaded file"){
  if(kind==="vin") return {type:"vin", text:`VIN scan pending verification from ${fileName}`, fields:{vin:"VERIFY MANUALLY", unit:state.truck.unit || ""}};
  if(kind==="invoice") return {type:"invoice", text:`Invoice/receipt scan from ${fileName}: vendor, line items, totals need review.`, fields:{vendor:"UNKNOWN", total:0}};
  if(kind==="part") return {type:"part", text:`Part label scan from ${fileName}: part number/brand need verification.`, fields:{partNumber:"UNKNOWN", brand:"UNKNOWN"}};
  if(kind==="fault") return {type:"fault", text:`Fault screen scan from ${fileName}: code text needs review.`, fields:{code:"UNKNOWN"}};
  return {type:"doc", text:`Document scan from ${fileName}: saved for review.`, fields:{}};
}
function v52SaveFileRecord(file, purpose){
  ensureV52();
  const rec={name:file?.name || "camera capture", size:file?.size || 0, type:file?.type || purpose, purpose, date:new Date().toLocaleString(), localOnly:true};
  state.fileUploads.unshift(rec);
  saveState();
  return rec;
}
function v52OpenMaps(lat,lng,label="Rolling Wrench Job"){
  const q = encodeURIComponent(`${lat},${lng} ${label}`);
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,"_blank");
}
function v52BuildServiceFromAi(text){
  const q=(text||"").toLowerCase();
  let route="repairhud";
  if(q.includes("quote")) route="quotes";
  if(q.includes("invoice")) route="invoices";
  if(q.includes("work order") || q.includes("job")) route="workorders";
  if(q.includes("part")) route="parts";
  if(q.includes("schedule")) route="schedule";
  if(q.includes("pm")) route="pmmanager";
  return route;
}


function renderAiEngine(){
  ensureV52();
  $("#screen").innerHTML = `${pageHead("AI Engine","saveAiEngine")}
    <section class="v52-panel"><b>Real AI Connection</b><small>Local workflow works now. Add endpoint/key when backend is ready.</small></section>
    <section class="form-panel form-grid">
      <label>AI Endpoint<input id="aiServiceEndpoint" value="${state.aiService.endpoint || ""}" placeholder="https://your-backend/ai"></label>
      <label>AI API Key<input id="aiServiceKey" value="${state.aiService.apiKey || ""}" placeholder="Backend key later"></label>
      <label>Test Prompt<textarea id="aiServicePrompt" placeholder="Build quote for X15 water pump"></textarea></label>
      <button class="action-btn primary" id="runAiService">Ask AI</button>
      <div class="ai-live-response" id="aiServiceOut">Ready.</div>
    </section>`;
  bindPageTools();
  $("#runAiService").onclick=async()=>{$("#aiServiceOut").textContent="Thinking...";$("#aiServiceOut").textContent=await v52AskAi($("#aiServicePrompt").value);};
  $("#saveAiEngine").onclick=()=>{state.aiService.endpoint=$("#aiServiceEndpoint").value;state.aiService.apiKey=$("#aiServiceKey").value;state.aiService.mode=state.aiService.endpoint?"backend":"local";saveState();toast("AI engine saved");};
}
function renderFileStorage(){
  ensureV52();
  $("#screen").innerHTML = `${pageHead("Files / Storage","saveFileStorage")}
    <section class="v52-panel"><b>Supabase Storage Ready</b><small>Files save locally now. Supabase bucket upload connects after storage policies are set.</small></section>
    <section class="form-panel form-grid">
      <label>Purpose<select id="filePurpose"><option>truck photo</option><option>invoice</option><option>quote</option><option>signature</option><option>part label</option><option>VIN plate</option><option>repair photo</option></select></label>
      <input id="storageFile" type="file" multiple accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xlsx">
      <button class="action-btn primary" id="saveLocalFiles">Save File Records</button>
      <div id="fileList">${(state.fileUploads||[]).map(f=>`<span class="file-chip">📎 ${f.name} • ${f.purpose}</span>`).join("") || `<div class="output">No files saved.</div>`}</div>
    </section>`;
  bindPageTools();
  $("#saveLocalFiles").onclick=()=>{[...$("#storageFile").files].forEach(f=>v52SaveFileRecord(f,$("#filePurpose").value));toast("File records saved");renderFileStorage();};
  $("#saveFileStorage").onclick=()=>{state.storage.bucket=state.storage.bucket || "rwd-files";saveState();toast("Storage settings saved");};
}
function renderRealOCR(){
  ensureV52();
  $("#screen").innerHTML = `${pageHead("Real OCR Workflow","saveOcrWorkflow")}
    <section class="v52-panel"><b>OCR Workflow</b><small>Reads VIN plates, invoices, part labels, documents, and fault screens. Local extractor active; real OCR endpoint connects later.</small></section>
    <section class="form-panel form-grid">
      <label>Scan Type<select id="realOcrType"><option value="vin">VIN Plate</option><option value="invoice">Invoice / Receipt</option><option value="part">Part Label / Box</option><option value="fault">Fault Screen</option><option value="doc">Document</option></select></label>
      <input id="realOcrFile" type="file" accept="image/*,.pdf" capture="environment">
      <button class="action-btn primary" id="runRealOcr">Run OCR</button>
      <div class="scan-result" id="realOcrOut">No OCR result yet.</div>
      <div class="smart-action-row">
        <button id="ocrSaveTruck">Truck</button><button id="ocrSaveParts">Parts</button><button id="ocrSaveInvoice">Invoice</button>
      </div>
    </section>`;
  bindPageTools();
  let last=null;
  $("#runRealOcr").onclick=()=>{const f=$("#realOcrFile").files[0]; last=v52ExtractFromScan($("#realOcrType").value,f?.name); $("#realOcrOut").textContent=last.text; state.ocrScans.unshift({...last,date:new Date().toLocaleString()}); if(f)v52SaveFileRecord(f,$("#realOcrType").value); saveState(); toast("OCR complete");};
  $("#ocrSaveTruck").onclick=()=>{addTruckHistory("OCR",last?last.text:$("#realOcrOut").textContent);toast("Saved to truck")};
  $("#ocrSaveParts").onclick=()=>{state.parts.push({query:"OCR",notes:last?last.text:$("#realOcrOut").textContent});saveState();toast("Saved to parts")};
  $("#ocrSaveInvoice").onclick=()=>{state.invoices.push({customer:state.truck.customer,truck:state.truck.unit,work:last?last.text:$("#realOcrOut").textContent,total:0});saveState();toast("Saved to invoice")};
  $("#saveOcrWorkflow").onclick=()=>{saveState();toast("OCR workflow saved")};
}
function renderGPSManager(){
  ensureV52();
  $("#screen").innerHTML = `${pageHead("GPS / Pin Drop","saveGpsPin")}
    <section class="gps-map-card form-grid">
      <b>Live GPS Pin</b>
      <label>Customer / Job<input id="gpsCustomer" value="${state.truck.customer || ""}"></label>
      <label>Location Notes<input id="gpsNotes" placeholder="Roadside, parking lot, dock, mile marker..."></label>
      <div class="gps-coords" id="gpsCoords">No GPS yet.</div>
      <div class="smart-action-row"><button id="getLiveGps">Get GPS</button><button id="openGpsMap">Open Maps</button><button id="createGpsWO">Create WO</button></div>
      <div>${(state.gpsPins||[]).map(p=>`<div class="notification-card"><b>${p.customer}</b><small>${p.lat}, ${p.lng}<br>${p.notes}</small></div>`).join("") || `<div class="output">No GPS pins saved.</div>`}</div>
    </section>`;
  bindPageTools();
  let coords=null;
  $("#getLiveGps").onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{coords={lat:p.coords.latitude,lng:p.coords.longitude};$("#gpsCoords").textContent=`${coords.lat}, ${coords.lng}`;toast("GPS captured");},()=>toast("GPS denied/unavailable")):toast("GPS not supported");
  $("#openGpsMap").onclick=()=>{if(coords)v52OpenMaps(coords.lat,coords.lng,$("#gpsCustomer").value);else toast("Get GPS first")};
  $("#createGpsWO").onclick=()=>{if(!coords){toast("Get GPS first");return;}state.workorders.push({customer:$("#gpsCustomer").value,truck:state.truck.unit,desc:`Roadside pin: ${coords.lat}, ${coords.lng} — ${$("#gpsNotes").value}`,status:"Open"});saveState();toast("Work order created")};
  $("#saveGpsPin").onclick=()=>{if(!coords){toast("Get GPS first");return;}state.gpsPins.unshift({customer:$("#gpsCustomer").value,notes:$("#gpsNotes").value,lat:coords.lat,lng:coords.lng,date:new Date().toLocaleString()});saveState();toast("GPS pin saved");renderGPSManager();};
}
function renderV52Dashboard(){
  ensureV52();
  $("#screen").innerHTML = `${pageHead("V5.2 Engine","",false)}
    <section class="v52-grid">
      <button class="v52-card" data-route="aiengine"><b>AI Engine</b><small>AI endpoint, local workflow, voice commands</small></button>
      <button class="v52-card" data-route="realocr"><b>OCR Engine</b><small>VIN, invoice, part label, fault screen</small></button>
      <button class="v52-card" data-route="filestorage"><b>Files / Storage</b><small>Photos, docs, signatures, invoices</small></button>
      <button class="v52-card" data-route="gpsmanager"><b>GPS / Pin Drop</b><small>Live location, maps, work orders</small></button>
      <button class="v52-card" data-route="supplierpricing"><b>Supplier Pricing</b><small>Manual now, API-ready later</small></button>
      <button class="v52-card" data-route="supabase"><b>Supabase Sync</b><small>Cloud data connection</small></button>
    </section>`;
  bindPageTools();
}


function ensureV6(){
  ensureV52();
  if(!state.version) state.version = "V6.0 Production Build";
  if(!state.portalLinks) state.portalLinks = [];
  if(!state.techAssignments) state.techAssignments = [];
  if(!state.photoIntelligence) state.photoIntelligence = [];
  if(!state.payments) state.payments = [];
}
function v6DashboardTotals(){
  const revenue = (state.invoices||[]).reduce((a,i)=>a+Number(i.total||0),0);
  const openQuotes = (state.quotes||[]).length;
  const openInvoices = (state.invoices||[]).filter(i=>!i.paid).length;
  const scheduled = (state.schedule||[]).length + (state.pmRecords||[]).length;
  return {revenue, openQuotes, openInvoices, scheduled};
}
function v6AutoWorkflowFromText(text){
  ensureV6();
  const routeInfo = v5RouteAiCommand(text);
  let made = null;
  if(routeInfo.action==="workorder") made = v5CreateWorkflow("workorder", text);
  if(routeInfo.action==="quote") made = v5CreateWorkflow("quote", text);
  if(routeInfo.action==="invoice") made = v5CreateWorkflow("invoice", text);
  if(routeInfo.action==="pm"){
    state.pmRecords.unshift({unit:state.truck.unit,type:text,priority:"Normal",date:"",miles:"",notes:"Created from V6 automation"});
    made = state.pmRecords[0];
  }
  if(!made){
    state.notes.push({type:"AI Operator",note:text,date:new Date().toLocaleString()});
  }
  saveState();
  return routeInfo;
}
function v6MakePortalLink(type, id){
  const link = `${location.origin}${location.pathname}#portal-${type}-${id || Date.now()}`;
  state.portalLinks.unshift({type,id,link,date:new Date().toLocaleString(),customer:state.truck.customer});
  saveState();
  return link;
}

function renderBusinessDashboard(){
  ensureV6();
  const t=v6DashboardTotals();
  $("#screen").innerHTML = `${pageHead("Business Dashboard","",false)}
    <section class="v6-dash-grid">
      <div class="v6-kpi"><span>Revenue</span><b>${money(t.revenue)}</b></div>
      <div class="v6-kpi"><span>Open Quotes</span><b>${t.openQuotes}</b></div>
      <div class="v6-kpi"><span>Open Invoices</span><b>${t.openInvoices}</b></div>
      <div class="v6-kpi"><span>Scheduled</span><b>${t.scheduled}</b></div>
    </section>
    <section class="settings-section">
      <h3>Weekly Earnings</h3>
      <div class="chart-block"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </section>
    <section class="v6-action-grid">
      <button class="v6-action" data-route="workflow"><b>Workflow Hub</b><small>Customer → truck → quote → invoice</small></button>
      <button class="v6-action" data-route="aioperator"><b>AI Operator</b><small>Speak/type and let AI build it</small></button>
      <button class="v6-action" data-route="customerportal"><b>Customer Portal</b><small>Quote approval/sign/invoice link preview</small></button>
      <button class="v6-action" data-route="techmode"><b>Technician Mode</b><small>Assigned jobs, clock, notes, photos</small></button>
    </section>`;
  bindPageTools();
}
function renderAIOperator(){
  ensureV6();
  $("#screen").innerHTML = `${pageHead("AI Operator","saveOperator")}
    <section class="form-panel form-grid">
      <div class="backend-banner"><b>Rolling Wrench AI Operator</b><small>Type or speak: build quote, invoice, work order, schedule, PM, parts, pin drop.</small></div>
      <label>Command<textarea id="operatorCommand" placeholder="Build quote for X15 water pump..."></textarea></label>
      <div class="smart-action-row"><button id="operatorVoice">🎙 Speak</button><button id="operatorRun">Run</button><button data-route="ai">Open AI Chat</button></div>
      <div class="ai-live-response" id="operatorOut">Waiting for command.</div>
    </section>`;
  bindPageTools();
  if($("#operatorVoice")) $("#operatorVoice").onclick=()=>startVoiceToField("operatorCommand");
  $("#operatorRun").onclick=()=>{
    const cmd=$("#operatorCommand").value;
    const result=v6AutoWorkflowFromText(cmd);
    $("#operatorOut").textContent=`Action: ${result.msg}\nRoute: ${result.route}\nCommand saved into workflow.`;
    toast("AI operator complete");
  };
  $("#saveOperator").onclick=()=>{state.notes.push({type:"AI Operator",note:$("#operatorCommand").value,date:new Date().toLocaleString()});saveState();toast("Operator command saved");};
}
function renderPhotoIntelligence(){
  ensureV6();
  $("#screen").innerHTML = `${pageHead("Photo Intelligence","savePhotoIntel")}
    <section class="form-panel form-grid">
      <div class="backend-banner"><b>Photo Intelligence</b><small>Classifies photos into VIN, part label, fault screen, invoice, damage, truck, repair memory.</small></div>
      <input id="photoIntelFile" type="file" accept="image/*,.pdf" capture="environment">
      <label>What is it?<select id="photoIntelType"><option>Auto Detect</option><option>VIN Plate</option><option>Part Box / Label</option><option>Fault Screen</option><option>Invoice / Receipt</option><option>Damage Photo</option><option>Truck Photo</option></select></label>
      <button class="action-btn primary" id="classifyPhoto">Classify / Save</button>
      <div class="scan-result" id="photoIntelOut">No photo selected.</div>
      <div>${state.photoIntelligence.map(p=>`<div class="portal-card"><b>${p.type}</b><small>${p.file} • ${p.date}<br>${p.result}</small></div>`).join("")}</div>
    </section>`;
  bindPageTools();
  $("#classifyPhoto").onclick=()=>{
    const f=$("#photoIntelFile").files[0];
    const type=$("#photoIntelType").value;
    const result=`${type} saved. Route: ${type.includes("VIN")?"Truck Profile":type.includes("Part")?"Parts Lookup":type.includes("Invoice")?"Invoices":type.includes("Fault")?"Fault Doctor":"Repair Memory"}`;
    state.photoIntelligence.unshift({file:f?.name||"camera image",type,result,date:new Date().toLocaleString()});
    if(f) v52SaveFileRecord(f,type);
    $("#photoIntelOut").textContent=result;
    saveState();toast("Photo classified");
  };
  $("#savePhotoIntel").onclick=()=>{saveState();toast("Photo intelligence saved")};
}
function renderScheduleCommand(){
  ensureV6();
  $("#screen").innerHTML = `${pageHead("Schedule Command","saveScheduleCommand")}
    <section class="form-panel form-grid">
      <div class="two-col"><label>Date<input id="cmdDate" type="date"></label><label>Time<input id="cmdTime" type="time"></label></div>
      <label>Customer<input id="cmdCustomer" value="${state.truck.customer||""}"></label>
      <label>Truck<input id="cmdTruck" value="${state.truck.unit||""}"></label>
      <label>Job<textarea id="cmdJob"></textarea></label>
      <label>Tech<select id="cmdTech">${(state.employees||[]).map(e=>`<option>${e.name}</option>`).join("")}</select></label>
      <div class="smart-action-row"><button data-route="gpsmanager">GPS</button><button id="cmdCreateWO">Create WO</button><button id="cmdClock">Clock From Job</button></div>
      <div>${(state.schedule||[]).map(s=>`<div class="schedule-command-card"><b>${s.date||""} ${s.time||""} — ${s.customer}</b><small>${s.job||""} • ${s.tech||""}</small></div>`).join("")}</div>
    </section>`;
  bindPageTools();
  $("#cmdCreateWO").onclick=()=>{state.workorders.push({customer:$("#cmdCustomer").value,truck:$("#cmdTruck").value,desc:$("#cmdJob").value,status:"Open"});saveState();toast("WO created")};
  $("#cmdClock").onclick=()=>{state.jobs.job1.name=$("#cmdJob").value||"Scheduled Job";state.jobs.job1.customer=$("#cmdCustomer").value;saveState();setRoute("clock")};
  $("#saveScheduleCommand").onclick=()=>{state.schedule.unshift({date:$("#cmdDate").value,time:$("#cmdTime").value,customer:$("#cmdCustomer").value,truck:$("#cmdTruck").value,job:$("#cmdJob").value,tech:$("#cmdTech").value});saveState();toast("Schedule saved");renderScheduleCommand();};
}
function renderCustomerPortal(){
  ensureV6();
  $("#screen").innerHTML = `${pageHead("Customer Portal","savePortal")}
    <section class="form-panel form-grid">
      <div class="backend-banner"><b>Customer Link Preview</b><small>Customer can approve quote, sign quote, view invoice, send location, upload photos. Public link backend comes later.</small></div>
      <label>Customer<input id="portalCustomer" value="${state.truck.customer||""}"></label>
      <label>Portal Type<select id="portalType"><option>Quote Approval</option><option>Invoice View</option><option>Send Location</option><option>Upload Photos</option><option>Job Status</option></select></label>
      <button class="action-btn primary" id="makePortalLink">Create Link Preview</button>
      <div class="approval-link" id="portalLinkOut">No link created.</div>
      <div>${state.portalLinks.map(l=>`<div class="portal-card"><b>${l.type}</b><small>${l.customer} • ${l.date}<br>${l.link}</small></div>`).join("")}</div>
    </section>`;
  bindPageTools();
  $("#makePortalLink").onclick=()=>{const link=v6MakePortalLink($("#portalType").value,Date.now());$("#portalLinkOut").textContent=link;toast("Portal link created")};
  $("#savePortal").onclick=()=>{saveState();toast("Portal saved")};
}
function renderTechMode(){
  ensureV6();
  $("#screen").innerHTML = `${pageHead("Technician Mode","saveTechMode")}
    <section class="form-panel form-grid">
      <label>Technician<select id="techName">${(state.employees||[]).map(e=>`<option>${e.name}</option>`).join("")}</select></label>
      <label>Assigned Job<select id="techJob">${(state.schedule||[]).map(s=>`<option>${s.job||s.customer||"Scheduled Job"}</option>`).join("")}<option>Unassigned Job</option></select></label>
      <label>Repair Notes<textarea id="techNotes" placeholder="Speak/type notes, upload photos, save to work order"></textarea></label>
      <div class="smart-action-row"><button data-route="clock">Clock</button><button data-route="camera">Photo/OCR</button><button id="techSaveWO">Save to WO</button></div>
      <div>${(state.techAssignments||[]).map(t=>`<div class="tech-card"><b>${t.tech} — ${t.job}</b><small>${t.date}<br>${t.notes}</small></div>`).join("")}</div>
    </section>`;
  bindPageTools();
  $("#techSaveWO").onclick=()=>{state.techAssignments.unshift({tech:$("#techName").value,job:$("#techJob").value,notes:$("#techNotes").value,date:new Date().toLocaleString()});state.workorders.push({customer:state.truck.customer,truck:state.truck.unit,desc:$("#techNotes").value,status:"Tech Update"});saveState();toast("Tech update saved");renderTechMode();};
  $("#saveTechMode").onclick=()=>{saveState();toast("Tech mode saved")};
}
function renderAboutLegal(){
  ensureV6();
  $("#screen").innerHTML = `${pageHead("About / Legal","",false)}
    <section class="form-panel">
      <div class="about-badge">RW</div>
      <h2 style="text-align:center;margin:0;">Rolling Wrench AI Command Center</h2>
      <p style="text-align:center;color:var(--muted);">Version: ${state.version || "V6.0"}<br>Developed for Rolling Wrench Diesel LLC</p>
      <div class="output">© 2026 Rolling Wrench Diesel LLC
All Rights Reserved.

Rolling Wrench AI, Rolling Wrench Diesel, the Rolling Wrench logo, software workflows, layouts, quote/invoice templates, business processes, and related app content are proprietary property of Rolling Wrench Diesel LLC.

Unauthorized copying, redistribution, modification, resale, or commercial use without written permission is prohibited.

Generated by Rolling Wrench Diesel LLC.</div>
    </section>`;
  bindPageTools();
}


function saveClock(id, show=true){
  return saveContinuousClock(id, show);
}


function ensureAuthV62(){
  if(typeof ensureV6 === "function") ensureV6();
  if(!state.auth) state.auth = {
    mode:"demo",
    isLoggedIn:true,
    user:{email:"demo@rollingwrench.local", role:"Owner/Admin", name:"James Jacobs"},
    shop:{id:"local-shop", name:(state.settings && state.settings.shop) || "Rolling Wrench Diesel LLC"},
    remember:true
  };
  if(!state.auth.shop) state.auth.shop = {id:"local-shop", name:(state.settings && state.settings.shop) || "Rolling Wrench Diesel LLC"};
  if(!state.auth.user) state.auth.user = {email:"demo@rollingwrench.local", role:"Owner/Admin", name:"James Jacobs"};
}
function authIsLoggedIn(){
  ensureAuthV62();
  return state.auth.mode==="demo" || !!state.auth.isLoggedIn;
}
function authCanAccess(route){
  ensureAuthV62();
  if(state.auth.mode==="demo") return true;
  const role = (state.auth.user && state.auth.user.role) || "Technician";
  if(role==="Owner/Admin") return true;
  if(role==="Operations Manager") return !["settings"].includes(route);
  if(role==="Technician") return ["home","clock","workorders","schedule","truck","repair","fault","repairhud","parts","camera","pindrop","techmode","ai","memory"].includes(route);
  if(role==="Customer") return ["customerportal","pindrop","invoices","quotes","home"].includes(route);
  return true;
}
async function supabaseAuthRequest(path, body){
  ensureSupabaseConfigured();
  const res = await fetch(`${state.supabase.url}/auth/v1/${path}`, {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":state.supabase.anonKey},
    body:JSON.stringify(body)
  });
  const text = await res.text();
  let data = {};
  try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = {raw:text}; }
  if(!res.ok) throw new Error(data.error_description || data.msg || text || res.statusText);
  return data;
}
async function signInSupabase(email,password){
  const data = await supabaseAuthRequest("token?grant_type=password",{email,password});
  state.auth.mode="supabase"; state.auth.isLoggedIn=true; state.auth.session=data;
  state.auth.user={email, role:(state.auth.user && state.auth.user.role) || "Owner/Admin", name:email.split("@")[0]};
  saveState(); return data;
}
async function createSupabaseAccount(email,password,role,shop){
  const data = await supabaseAuthRequest("signup",{email,password});
  state.auth.mode="supabase"; state.auth.isLoggedIn=true; state.auth.session=data;
  state.auth.user={email, role:role || "Owner/Admin", name:email.split("@")[0]};
  state.auth.shop={id:"pending-shop", name:shop || "Rolling Wrench Diesel LLC"};
  saveState(); return data;
}
async function sendPasswordReset(email){ return await supabaseAuthRequest("recover",{email}); }
function logoutAuth(){ ensureAuthV62(); state.auth.isLoggedIn=false; state.auth.session=null; if(state.auth.mode==="demo") state.auth.mode="locked"; saveState(); }
function authBadgeHtml(){ ensureAuthV62(); return `<span class="user-pill">👤 ${state.auth.user?.name || state.auth.user?.email || "User"} • ${state.auth.user?.role || "Role"} • ${state.auth.mode}</span>`; }


function renderLogin(tab="signin"){
  ensureAuthV62();
  $("#screen").innerHTML = `<section class="auth-screen"><div class="auth-card">
    <div class="auth-logo">RW</div><h2>Rolling Wrench AI</h2><p>Command Center Login</p>
    <div class="auth-tabs"><button class="${tab==="signin"?'active':''}" data-auth-tab="signin">Sign In</button><button class="${tab==="create"?'active':''}" data-auth-tab="create">Create</button><button class="${tab==="forgot"?'active':''}" data-auth-tab="forgot">Forgot</button></div>
    <div class="form-grid">
      <label>Email<input id="authEmail" type="email" value="${state.auth.user?.email || ""}" placeholder="you@shop.com"></label>
      ${tab!=="forgot" ? `<label>Password<input id="authPassword" type="password" placeholder="Password"></label>` : ""}
      ${tab==="create" ? `<label>Role<select id="authRole"><option>Owner/Admin</option><option>Operations Manager</option><option>Technician</option><option>Customer</option></select></label>` : ""}
      <label>Shop Name<input id="authShopName" value="${state.auth.shop?.name || state.settings?.shop || "Rolling Wrench Diesel LLC"}"></label>
    </div>
    <div class="auth-actions">
      ${tab==="signin" ? `<button class="primary" id="authSignIn">Sign In</button>` : ""}
      ${tab==="create" ? `<button class="primary" id="authCreate">Create Account</button>` : ""}
      ${tab==="forgot" ? `<button class="primary" id="authForgot">Send Reset</button>` : ""}
      <button id="authDemo">Continue Local Demo Mode</button>
    </div>
    <div class="auth-note">Supabase Auth is wired. Local Demo Mode lets you keep testing before RLS/user roles are fully locked down.</div>
  </div></section>`;
  $$("[data-auth-tab]").forEach(b=>b.onclick=()=>renderLogin(b.dataset.authTab));
  $("#authDemo").onclick=()=>{state.auth.mode="demo";state.auth.isLoggedIn=true;state.auth.user={email:"demo@rollingwrench.local",role:"Owner/Admin",name:"James Jacobs"};state.auth.shop={id:"local-shop",name:$("#authShopName").value||"Rolling Wrench Diesel LLC"};saveState();toast("Demo mode");setRoute("home");};
  if($("#authSignIn")) $("#authSignIn").onclick=async()=>{try{$("#authSignIn").textContent="Signing in...";await signInSupabase($("#authEmail").value,$("#authPassword").value);state.auth.shop.name=$("#authShopName").value;saveState();toast("Signed in");setRoute("home");}catch(e){$(".auth-note").textContent=e.message;$("#authSignIn").textContent="Sign In";toast("Sign in failed");}};
  if($("#authCreate")) $("#authCreate").onclick=async()=>{try{$("#authCreate").textContent="Creating...";await createSupabaseAccount($("#authEmail").value,$("#authPassword").value,$("#authRole").value,$("#authShopName").value);toast("Account created");setRoute("home");}catch(e){$(".auth-note").textContent=e.message;$("#authCreate").textContent="Create Account";toast("Create failed");}};
  if($("#authForgot")) $("#authForgot").onclick=async()=>{try{$("#authForgot").textContent="Sending...";await sendPasswordReset($("#authEmail").value);$(".auth-note").textContent="Password reset email sent if account exists.";toast("Reset sent");}catch(e){$(".auth-note").textContent=e.message;toast("Reset failed");}$("#authForgot").textContent="Send Reset";};
}
function renderAuthSettings(){
  ensureAuthV62();
  $("#screen").innerHTML = `${pageHead("Account / Roles","saveAuthSettings")}
    <section class="form-panel form-grid">
      <div class="backend-banner"><b>Authentication Foundation</b><small>Supabase Auth + local demo mode + role placeholders.</small></div>
      <div>${authBadgeHtml()}</div>
      <label>User Name<input id="authUserName" value="${state.auth.user?.name || ""}"></label>
      <label>Email<input id="authUserEmail" value="${state.auth.user?.email || ""}"></label>
      <label>Role<select id="authUserRole"><option ${state.auth.user?.role==="Owner/Admin"?"selected":""}>Owner/Admin</option><option ${state.auth.user?.role==="Operations Manager"?"selected":""}>Operations Manager</option><option ${state.auth.user?.role==="Technician"?"selected":""}>Technician</option><option ${state.auth.user?.role==="Customer"?"selected":""}>Customer</option></select></label>
      <label>Shop Name<input id="authShop" value="${state.auth.shop?.name || state.settings?.shop || ""}"></label>
      <div class="role-grid"><div class="role-card"><b>Owner/Admin</b><small>Full access</small></div><div class="role-card"><b>Operations Manager</b><small>Customers, schedule, invoices, quotes</small></div><div class="role-card"><b>Technician</b><small>Clock, jobs, work orders, photos</small></div><div class="role-card"><b>Customer</b><small>Approve/sign/view/send location</small></div></div>
      <div class="smart-action-row"><button id="authLogout">Logout</button><button data-route="login">Login Screen</button><button data-route="supabase">Supabase</button></div>
    </section>`;
  bindPageTools();
  $("#saveAuthSettings").onclick=()=>{state.auth.user.name=$("#authUserName").value;state.auth.user.email=$("#authUserEmail").value;state.auth.user.role=$("#authUserRole").value;state.auth.shop.name=$("#authShop").value;saveState();toast("Account saved");};
  $("#authLogout").onclick=()=>{logoutAuth();toast("Logged out");setRoute("login");};
}


/* V6.2a compatibility hotfix */
if(typeof ensureSettingsV48 !== "function"){
  function ensureSettingsV48(){
    state.ui = state.ui || {
      theme:"orange",
      background:"diamond",
      compact:false,
      largeText:false,
      highContrast:false,
      showEarnings:true,
      showSchedule:true,
      showRecentJobs:true,
      showSystemStatus:true
    };
    state.pricing = state.pricing || {
      shopLabor:135,
      mobileLabor:135,
      diagnostic:150,
      roadside:150,
      serviceCall:250,
      mileage:0,
      shopSuppliesPct:0,
      envFee:0,
      cardPct:0,
      taxPct:0,
      afterHoursMultiplier:1.5,
      weekendMultiplier:1.5,
      holidayMultiplier:2
    };
    state.employees = state.employees || [
      {name:"James Jacobs", role:"Owner / Admin", laborRate:135},
      {name:"Stephani Jacobs", role:"Operations Manager", laborRate:135},
      {name:"David", role:"Technician", laborRate:135}
    ];
    state.alertSettings = state.alertSettings || {pm:true,schedule:true,invoice:true,quote:true,clock:true,truck:true};
    state.soundSettings = state.soundSettings || {button:true,save:true,aiVoice:true,notification:true,clockIn:true,clockOut:true,volume:80};
    state.aiSettings = state.aiSettings || {voice:true,voiceSpeed:1,voiceType:"Shop Pro",autoRead:false,saveConversations:true,rememberTruck:true,rememberCustomer:true};
    state.ocrSettings = state.ocrSettings || {autoOcr:false,vin:true,part:true,invoice:true,fault:true};
    state.security = state.security || {appLock:false,pin:"",faceId:false,touchId:false};
  }
}
if(typeof applyUiSettings !== "function"){
  function applyUiSettings(){
    if(typeof ensureSettingsV48 === "function") ensureSettingsV48();
    document.body.classList.remove("theme-green","theme-blue","theme-red","theme-gray","theme-light","compact-mode","large-text","high-contrast");
    const t = state.ui && state.ui.theme;
    if(t==="green") document.body.classList.add("theme-green");
    if(t==="blue") document.body.classList.add("theme-blue");
    if(t==="red") document.body.classList.add("theme-red");
    if(t==="gray") document.body.classList.add("theme-gray");
    if(t==="light") document.body.classList.add("theme-light");
    if(state.ui && state.ui.compact) document.body.classList.add("compact-mode");
    if(state.ui && state.ui.largeText) document.body.classList.add("large-text");
    if(state.ui && state.ui.highContrast) document.body.classList.add("high-contrast");
  }
}


function ensureV63(){
  if(typeof ensureV6 === "function") ensureV6();
  if(!state.quoteApprovals) state.quoteApprovals = [];
}
function quoteLegalText(){
  return "Pricing is based on visible conditions at the time of estimate. Additional repairs, labor, parts, seized or broken hardware, hidden damage, diagnostic findings, parts availability, travel, freight, shop supplies, taxes, card fees, or extra time may change the final invoice amount. Final price may increase or decrease based on actual repair requirements. Customer authorization is required before additional charges are incurred.";
}
function makeQuoteApproval(quoteIndex){
  ensureV63();
  const q = state.quotes[quoteIndex];
  if(!q) return null;
  const id = q.approvalId || ("RWQ-" + Date.now());
  q.approvalId = id;
  q.status = q.status || "Pending";
  const link = `${location.origin}${location.pathname}#quoteapproval-${id}`;
  let rec = state.quoteApprovals.find(a=>a.id===id);
  if(!rec){
    rec = {id,quoteIndex,link,status:q.status,created:new Date().toLocaleString(),customer:q.customer || "",total:q.total || 0};
    state.quoteApprovals.unshift(rec);
  }else{
    Object.assign(rec,{quoteIndex,link,status:q.status,customer:q.customer || "",total:q.total || 0});
  }
  saveState();
  return {id,link,quote:q};
}
function findQuoteByApprovalId(id){
  ensureV63();
  let index = state.quotes.findIndex(q=>q.approvalId===id);
  if(index < 0){
    const rec = state.quoteApprovals.find(a=>a.id===id);
    if(rec) index = rec.quoteIndex;
  }
  return {quote:index>=0 ? state.quotes[index] : null,index};
}
function quoteStatusPill(status){
  const s=(status || "Pending").toLowerCase();
  return `<span class="quote-status-pill ${s}">${status || "Pending"}</span>`;
}
function approveQuote(id,name,sig){
  const f=findQuoteByApprovalId(id);
  if(!f.quote) return false;
  f.quote.status="Approved";
  f.quote.approvedAt=new Date().toLocaleString();
  f.quote.approvedBy=name || "Customer / Driver";
  f.quote.approvalSignature=sig || null;
  const rec=state.quoteApprovals.find(a=>a.id===id);
  if(rec) Object.assign(rec,{status:"Approved",approvedAt:f.quote.approvedAt,approvedBy:f.quote.approvedBy});
  state.workorders.push({customer:f.quote.customer,truck:f.quote.truck,desc:f.quote.desc || "Approved quote",status:"Approved Quote",quoteId:id,date:new Date().toLocaleString()});
  saveState();
  return true;
}
function declineQuote(id,name,reason){
  const f=findQuoteByApprovalId(id);
  if(!f.quote) return false;
  f.quote.status="Declined";
  f.quote.declinedAt=new Date().toLocaleString();
  f.quote.declinedBy=name || "Customer / Driver";
  f.quote.declineReason=reason || "";
  const rec=state.quoteApprovals.find(a=>a.id===id);
  if(rec) Object.assign(rec,{status:"Declined",declinedAt:f.quote.declinedAt,declinedBy:f.quote.declinedBy});
  saveState();
  return true;
}
function renderQuoteApprovalPortal(id){
  ensureV63();
  const f=findQuoteByApprovalId(id), q=f.quote;
  if(!q){$("#screen").innerHTML=`${pageHead("Quote Approval","",false)}<section class="error-panel"><b>Quote Not Found</b><p>This approval link does not match a saved quote on this device yet.</p></section>`;bindPageTools();return;}
  $("#screen").innerHTML=`${pageHead("Quote Approval","",false)}
  <section class="customer-approval-card">
    <div class="approval-header"><div class="approval-logo">RW</div><div><h2>Quote Approval</h2><p>Rolling Wrench Diesel LLC</p></div></div>
    <div>${quoteStatusPill(q.status || "Pending")}</div>
    <div class="approval-summary">
      <div class="approval-box"><b>Customer</b><span>${q.customer || state.truck.customer || "Customer"}</span></div>
      <div class="approval-box"><b>Truck / VIN</b><span>${q.truck || state.truck.unit || "Truck"}</span></div>
      <div class="approval-box"><b>Repair</b><span>${q.desc || "Repair estimate"}</span></div>
      <div class="approval-box"><b>Estimated Total</b><span>${money(q.total || 0)}</span></div>
    </div>
    <div class="approval-legal"><b>Authorization Terms:</b><br>${quoteLegalText()}</div>
    ${typeof signatureBlock==="function" ? signatureBlock("customerQuote","Customer / Driver Approval Signature") : ""}
    <label>Printed Name<input id="approvalName" placeholder="Customer / driver name"></label>
    <label>Decline Reason / Notes<textarea id="declineReason" placeholder="Only needed if declining"></textarea></label>
    <div class="approval-actions"><button class="approve" id="approveQuoteBtn">Approve & Sign</button><button class="decline" id="declineQuoteBtn">Decline</button></div>
  </section>`;
  bindPageTools();
  if(typeof setupSignaturePad==="function") setupSignaturePad("customerQuote");
  $("#approveQuoteBtn").onclick=()=>{const sig=typeof saveSignature==="function"?saveSignature("customerQuote"):null;if(approveQuote(id,$("#approvalName").value,sig)){toast("Quote approved");renderQuoteApprovalPortal(id);}};
  $("#declineQuoteBtn").onclick=()=>{if(declineQuote(id,$("#approvalName").value,$("#declineReason").value)){toast("Quote declined");renderQuoteApprovalPortal(id);}};
}
function renderQuoteSendCenter(){
  ensureV63();
  $("#screen").innerHTML=`${pageHead("Send Quotes","",false)}
  <section class="form-panel">
    <div class="backend-banner"><b>Customer Quote Approval</b><small>Create approval links customers can open on phone, tablet, or computer. They can approve, decline, and sign.</small></div>
    ${(state.quotes||[]).length ? state.quotes.map((q,i)=>`<div class="quote-list-card"><b>${q.customer || "Customer"} — ${money(q.total || 0)}</b><small>${q.desc || "Quote"}<br>${quoteStatusPill(q.status || "Pending")}</small><div class="smart-action-row"><button data-create-approval="${i}">Send Link</button><button data-route="communications">Text</button><button data-open-approval="${q.approvalId || ""}">Open Portal</button><button data-convert-invoice="${i}">Invoice</button></div><div class="share-link-box" id="quoteLink_${i}">${q.approvalId ? `${location.origin}${location.pathname}#quoteapproval-${q.approvalId}` : "No link yet"}</div></div>`).join("") : `<div class="output">No quotes saved yet. Create a Smart Quote first.</div>`}
  </section>`;
  bindPageTools();
  $$("[data-create-approval]").forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.createApproval);const a=makeQuoteApproval(i);$("#quoteLink_"+i).textContent=a.link;toast("Approval link ready");renderQuoteSendCenter();});
  $$("[data-open-approval]").forEach(btn=>btn.onclick=()=>{const id=btn.dataset.openApproval;if(!id){toast("Create link first");return;}setRoute("quoteapproval-"+id);});
  $$("[data-convert-invoice]").forEach(btn=>btn.onclick=()=>{const q=state.quotes[Number(btn.dataset.convertInvoice)];if(!q)return;state.invoices.push({customer:q.customer,truck:q.truck,work:q.desc,total:q.total,date:new Date().toLocaleString(),fromQuote:true,quoteId:q.approvalId||""});saveState();toast("Converted to invoice");});
}


function ensureV64(){
  if(typeof ensureV63 === "function") ensureV63();
  if(!state.invoiceLinks) state.invoiceLinks = [];
  if(!state.payments) state.payments = [];
}
function invoiceStatusPill(status){
  const s=(status || "Unpaid").toLowerCase();
  return `<span class="invoice-status-pill ${s}">${status || "Unpaid"}</span>`;
}
function makeInvoiceLink(invoiceIndex){
  ensureV64();
  const inv = state.invoices[invoiceIndex];
  if(!inv) return null;
  const id = inv.invoiceId || ("RWI-" + Date.now());
  inv.invoiceId = id;
  inv.status = inv.status || "Unpaid";
  const link = `${location.origin}${location.pathname}#invoiceportal-${id}`;
  let rec = state.invoiceLinks.find(x=>x.id===id);
  if(!rec){
    rec={id,invoiceIndex,link,status:inv.status,customer:inv.customer||"",total:inv.total||0,created:new Date().toLocaleString()};
    state.invoiceLinks.unshift(rec);
  }else{
    Object.assign(rec,{invoiceIndex,link,status:inv.status,customer:inv.customer||"",total:inv.total||0});
  }
  saveState();
  return {id,link,invoice:inv};
}
function findInvoiceById(id){
  ensureV64();
  let index = state.invoices.findIndex(i=>i.invoiceId===id);
  if(index < 0){
    const rec = state.invoiceLinks.find(x=>x.id===id);
    if(rec) index = rec.invoiceIndex;
  }
  return {invoice:index>=0 ? state.invoices[index] : null,index};
}
function setInvoicePayment(id,status,amount,method,notes){
  const f=findInvoiceById(id);
  if(!f.invoice) return false;
  f.invoice.status=status;
  f.invoice.paidAmount=Number(amount||0);
  f.invoice.paymentMethod=method||"";
  f.invoice.paymentNotes=notes||"";
  f.invoice.paymentUpdated=new Date().toLocaleString();
  const rec=state.invoiceLinks.find(x=>x.id===id);
  if(rec) Object.assign(rec,{status,total:f.invoice.total||0,paidAmount:f.invoice.paidAmount,paymentUpdated:f.invoice.paymentUpdated});
  state.payments.unshift({invoiceId:id,status,amount:Number(amount||0),method,notes,date:new Date().toLocaleString(),customer:f.invoice.customer});
  saveState();
  return true;
}
function customerPortalLegal(){
  return "Customer portal actions are recorded with date/time. Approval, signatures, payment status, photos, and GPS pins should be reviewed before final billing.";
}
function renderInvoicePortal(id){
  ensureV64();
  const f=findInvoiceById(id), inv=f.invoice;
  if(!inv){
    $("#screen").innerHTML=`${pageHead("Invoice Portal","",false)}<section class="error-panel"><b>Invoice Not Found</b><p>This invoice link does not match a saved invoice on this device yet.</p></section>`;
    bindPageTools();
    return;
  }
  $("#screen").innerHTML=`${pageHead("Invoice Portal","",false)}
  <section class="invoice-portal-card">
    <div class="approval-header"><div class="approval-logo">RW</div><div><h2>Invoice</h2><p>Rolling Wrench Diesel LLC</p></div></div>
    <div>${invoiceStatusPill(inv.status || "Unpaid")}</div>
    <div class="approval-summary">
      <div class="approval-box"><b>Customer</b><span>${inv.customer || "Customer"}</span></div>
      <div class="approval-box"><b>Truck / VIN</b><span>${inv.truck || state.truck.unit || "Truck"}</span></div>
      <div class="approval-box"><b>Work Performed</b><span>${inv.work || "Invoice work"}</span></div>
      <div class="approval-box"><b>Total Due</b><span>${money(inv.total || 0)}</span></div>
    </div>
    <div class="approval-legal"><b>Invoice Terms:</b><br>Payment is due upon receipt unless otherwise agreed. Card processing fees may apply. Additional work not listed requires approval.</div>
    ${typeof signatureBlock==="function" ? signatureBlock("customerInvoice","Customer / Driver Invoice Signature") : ""}
    <div class="payment-box">
      <b>Payment Tracking</b>
      <div class="two-col">
        <label>Amount Paid<input id="payAmount" type="number" step=".01" value="${inv.paidAmount || inv.total || 0}"></label>
        <label>Payment Method<select id="payMethod"><option>Square</option><option>Card</option><option>Cash</option><option>Check</option><option>ACH</option><option>Fleet Account</option><option>Other</option></select></label>
      </div>
      <label>Payment Notes<textarea id="payNotes">${inv.paymentNotes || ""}</textarea></label>
      <label>Square Payment Link<input id="squarePayLink" placeholder="Paste Square payment link here" value="${inv.squareLink || ""}"></label>
      <div class="payment-actions">
        <button class="paid" id="markPaid">Mark Paid</button>
        <button class="partial" id="markPartial">Partial</button>
        <button class="unpaid" id="markUnpaid">Unpaid</button>
      </div>
      <button class="action-btn primary" style="width:100%;margin-top:8px;" id="openSquareLink">Open Square Link</button>
    </div>
  </section>`;
  bindPageTools();
  if(typeof setupSignaturePad==="function") setupSignaturePad("customerInvoice");
  const savePay=(status)=>{ 
    const sig = typeof saveSignature==="function" ? saveSignature("customerInvoice") : null;
    inv.invoiceSignature=sig;
    inv.squareLink=$("#squarePayLink").value;
    if(setInvoicePayment(id,status,$("#payAmount").value,$("#payMethod").value,$("#payNotes").value)){toast("Invoice updated");renderInvoicePortal(id);}
  };
  $("#markPaid").onclick=()=>savePay("Paid");
  $("#markPartial").onclick=()=>savePay("Partial");
  $("#markUnpaid").onclick=()=>savePay("Unpaid");
  $("#openSquareLink").onclick=()=>{const u=$("#squarePayLink").value;if(u) window.open(u,"_blank"); else toast("Paste Square link first");};
}
function renderInvoiceSendCenter(){
  ensureV64();
  $("#screen").innerHTML=`${pageHead("Send Invoices","",false)}
  <section class="form-panel">
    <div class="backend-banner"><b>Customer Invoice Portal</b><small>Send invoice links for viewing, signing, payment tracking, and Square payment link.</small></div>
    ${(state.invoices||[]).length ? state.invoices.map((inv,i)=>`<div class="quote-list-card"><b>${inv.customer || "Customer"} — ${money(inv.total || 0)}</b><small>${inv.work || "Invoice"}<br>${invoiceStatusPill(inv.status || "Unpaid")}</small><div class="smart-action-row"><button data-create-invoice-link="${i}">Send Link</button><button data-route="communications">Text</button><button data-open-invoice="${inv.invoiceId || ""}">Open Portal</button><button data-mark-paid="${i}">Paid</button></div><div class="share-link-box" id="invoiceLink_${i}">${inv.invoiceId ? `${location.origin}${location.pathname}#invoiceportal-${inv.invoiceId}` : "No link yet"}</div></div>`).join("") : `<div class="output">No invoices saved yet.</div>`}
  </section>`;
  bindPageTools();
  $$("[data-create-invoice-link]").forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.createInvoiceLink);const link=makeInvoiceLink(i);$("#invoiceLink_"+i).textContent=link.link;toast("Invoice link ready");renderInvoiceSendCenter();});
  $$("[data-open-invoice]").forEach(btn=>btn.onclick=()=>{const id=btn.dataset.openInvoice;if(!id){toast("Create link first");return;}setRoute("invoiceportal-"+id);});
  $$("[data-mark-paid]").forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.markPaid);const link=makeInvoiceLink(i);setInvoicePayment(link.id,"Paid",state.invoices[i].total||0,"Manual","Marked paid from Send Invoices");toast("Marked paid");renderInvoiceSendCenter();});
}
function renderCustomerPortalHub(){
  ensureV64();
  $("#screen").innerHTML=`${pageHead("Customer Portal","",false)}
  <section class="form-panel">
    <div class="backend-banner"><b>Customer Portal Hub</b><small>Quote approval, invoice view/payment, send location, upload photos.</small></div>
    <div class="portal-hub-grid">
      <button class="portal-hub-btn" data-route="sendquotes"><b>Approve Quote</b><small>View, approve, decline, sign</small></button>
      <button class="portal-hub-btn" data-route="sendinvoices"><b>View Invoice</b><small>Sign, payment status, Square link</small></button>
      <button class="portal-hub-btn" data-route="gpsmanager"><b>Send Location</b><small>GPS pin / roadside</small></button>
      <button class="portal-hub-btn" data-route="filestorage"><b>Upload Photos</b><small>Truck, damage, parts, documents</small></button>
    </div>
    <div class="approval-legal">${customerPortalLegal()}</div>
  </section>`;
  bindPageTools();
}


function ensureV65(){
  if(typeof ensureV64 === "function") ensureV64();
  if(!state.externalLinks) state.externalLinks = [];
  if(!state.storageQueue) state.storageQueue = [];
  if(!state.healthChecks) state.healthChecks = [];
}
function v65SafeRouteList(){return ["home","settings","clock","quotes","invoices","sendquotes","sendinvoices","portalhub","customerportal","workflow","dashboard","ai","aioperator","truck","customers","workorders","schedule","parts","camera","realocr","filestorage","gpsmanager","supabase","account","about"];}
function v65RunHealthCheck(){
  ensureV65();
  const checks=[
    {name:"State",status:state?"good":"bad",detail:"Local state loaded"},
    {name:"Settings",status:state.settings?"good":"warn",detail:JSON.stringify(state.settings||{},null,2)},
    {name:"Clock Jobs",status:state.jobs?"good":"warn",detail:Object.keys(state.jobs||{}).join(", ")||"No jobs"},
    {name:"Quotes",status:(state.quotes||[]).length?"good":"warn",detail:`${(state.quotes||[]).length} quotes saved`},
    {name:"Invoices",status:(state.invoices||[]).length?"good":"warn",detail:`${(state.invoices||[]).length} invoices saved`},
    {name:"Supabase",status:(state.supabase&&state.supabase.url)?"good":"warn",detail:(state.supabase&&state.supabase.url)||"Not configured"},
    {name:"Routes",status:"good",detail:v65SafeRouteList().join(", ")}
  ];
  state.healthChecks=checks; saveState(); return checks;
}
function v65ExternalLink(kind,id,label){
  ensureV65();
  const link=`${location.origin}${location.pathname}#${kind}-${id}`;
  const rec={kind,id,label:label||kind,link,status:"Ready",created:new Date().toLocaleString(),synced:false};
  state.externalLinks.unshift(rec); saveState(); return rec;
}
async function v65SyncExternalLink(rec){
  ensureSupabaseConfigured();
  await supabaseRest("rwd_app_data","POST",{app_kind:"external_link",local_id:rec.id,payload:rec,created_at:new Date().toISOString()});
  rec.synced=true; rec.syncedAt=new Date().toLocaleString(); saveState(); return true;
}
function v65QueueStorage(fileName,purpose,dataUrl){
  ensureV65();
  const rec={id:"FILE-"+Date.now(),fileName:fileName||"local-file",purpose:purpose||"file",dataUrl:dataUrl||null,status:"Queued",created:new Date().toLocaleString()};
  state.storageQueue.unshift(rec); saveState(); return rec;
}
async function v65StoragePlaceholderUpload(rec){rec.status="Prepared";rec.note="Ready for Supabase Storage bucket upload when bucket/policies are configured.";rec.preparedAt=new Date().toLocaleString();saveState();return rec;}
function v65SaveSignatureToStorage(prefix,purpose){
  const sig=state[`${prefix}Signature`]; if(!sig||!sig.data){toast("No signature saved");return null;}
  const rec=v65QueueStorage(`${prefix}-signature.png`,purpose||"signature",sig.data); toast("Signature queued"); return rec;
}
function renderStabilityCenter(){
  ensureV65(); const checks=v65RunHealthCheck();
  $("#screen").innerHTML=`${pageHead("Stability Center","",false)}
  <section class="backend-banner"><b>V6.5 Stability Check</b><small>Checks routes, state, settings, clock, quotes, invoices, Supabase.</small></section>
  <section class="health-grid">${checks.map(c=>`<div class="health-card ${c.status}"><b>${c.name}</b><small>${c.detail}</small></div>`).join("")}</section>
  <section class="settings-section"><h3>Button Test</h3><div class="smart-action-row"><button id="testRoutes">Run Route Test</button><button data-route="storageprep">Storage Prep</button><button data-route="externallinks">External Links</button></div><div class="test-log" id="routeTestLog">Ready.</div></section>`;
  bindPageTools();
  $("#testRoutes").onclick=()=>{$("#routeTestLog").textContent=v65SafeRouteList().map(r=>`${r}: ${routes[r] || (r==="settings" ? "settings-fix" : "MISSING")}`).join("\n");};
}
function renderExternalLinksCenter(){
  ensureV65();
  $("#screen").innerHTML=`${pageHead("External Links","",false)}
  <section class="backend-banner"><b>Customer Link Records</b><small>Quote/invoice/customer portal links stored as records and ready to sync.</small></section>
  <section class="smart-action-row"><button id="makeQuoteLinks">Build Quote Links</button><button id="makeInvoiceLinks">Build Invoice Links</button><button id="syncAllLinks">Sync Links</button></section>
  <section>${(state.externalLinks||[]).map((l,i)=>`<div class="external-link-card"><b>${l.label} • ${l.status} ${l.synced?"• Synced":""}</b><small>${l.created}</small><code>${l.link}</code><button class="action-btn" data-sync-link="${i}">Sync This</button></div>`).join("") || `<div class="output">No external links built yet.</div>`}</section>`;
  bindPageTools();
  $("#makeQuoteLinks").onclick=()=>{(state.quotes||[]).forEach((q,i)=>{if(typeof makeQuoteApproval==="function"){const a=makeQuoteApproval(i);v65ExternalLink("quoteapproval",a.id,`Quote ${q.customer||i}`);}});toast("Quote links built");renderExternalLinksCenter();};
  $("#makeInvoiceLinks").onclick=()=>{(state.invoices||[]).forEach((inv,i)=>{if(typeof makeInvoiceLink==="function"){const a=makeInvoiceLink(i);v65ExternalLink("invoiceportal",a.id,`Invoice ${inv.customer||i}`);}});toast("Invoice links built");renderExternalLinksCenter();};
  $("#syncAllLinks").onclick=async()=>{for(const rec of state.externalLinks){try{await v65SyncExternalLink(rec);}catch(e){rec.error=e.message;}}toast("Link sync attempted");renderExternalLinksCenter();};
  $$("[data-sync-link]").forEach(btn=>btn.onclick=async()=>{const rec=state.externalLinks[Number(btn.dataset.syncLink)];try{await v65SyncExternalLink(rec);toast("Link synced");}catch(e){toast("Sync failed");}renderExternalLinksCenter();});
}
function renderStoragePrep(){
  ensureV65();
  $("#screen").innerHTML=`${pageHead("Storage Prep","saveStoragePrep")}
  <section class="backend-banner"><b>Supabase Storage Prep</b><small>Queue signatures/photos/files for storage. Actual upload needs bucket rwd-files and policies.</small></section>
  <section class="form-panel form-grid"><label>Purpose<select id="storagePurpose"><option>quote signature</option><option>invoice signature</option><option>truck photo</option><option>part label</option><option>VIN plate</option><option>invoice photo</option><option>repair photo</option></select></label><input id="storagePrepFile" type="file" accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xlsx" multiple><div class="smart-action-row"><button id="queueStorageFiles">Queue Files</button><button id="queueQuoteSignature">Quote Signature</button><button id="queueInvoiceSignature">Invoice Signature</button></div><div>${(state.storageQueue||[]).map((f,i)=>`<div class="storage-card"><b>${f.fileName}</b><small>${f.purpose} • ${f.status} • ${f.created}<br>${f.note||""}</small><button class="action-btn" data-prepare-file="${i}">Prepare Upload</button></div>`).join("") || `<div class="output">No files queued.</div>`}</div></section>`;
  bindPageTools();
  $("#queueStorageFiles").onclick=()=>{[...$("#storagePrepFile").files].forEach(f=>v65QueueStorage(f.name,$("#storagePurpose").value,null));toast("Files queued");renderStoragePrep();};
  $("#queueQuoteSignature").onclick=()=>{v65SaveSignatureToStorage("quote","quote signature");renderStoragePrep();};
  $("#queueInvoiceSignature").onclick=()=>{v65SaveSignatureToStorage("invoice","invoice signature");renderStoragePrep();};
  $$("[data-prepare-file]").forEach(btn=>btn.onclick=async()=>{await v65StoragePlaceholderUpload(state.storageQueue[Number(btn.dataset.prepareFile)]);toast("Prepared");renderStoragePrep();});
  $("#saveStoragePrep").onclick=()=>{saveState();toast("Storage queue saved");};
}


function ensureV66(){
  if(typeof ensureV65 === "function") ensureV65();
  if(!state.backend) state.backend = {
    bucket:"rwd-files",
    shopId:"",
    aiEndpoint:"",
    aiKey:"",
    ocrEndpoint:"",
    ocrKey:"",
    squareLink:"",
    smsProvider:"manual"
  };
}
async function v66Select(table, query="select=*&limit=1"){
  ensureSupabaseConfigured();
  return await supabaseRest(`${table}?${query}`,"GET");
}
async function v66Insert(table, payload){
  ensureSupabaseConfigured();
  return await supabaseRest(table,"POST",payload);
}
async function v66UpsertAppData(kind, item){
  const payload = {
    shop_id: state.backend.shopId || null,
    user_id: null,
    app_kind: kind,
    local_id: item.id || item.local_id || item.vin || item.invoiceId || item.approvalId || Date.now().toString(),
    payload: item,
    updated_at: new Date().toISOString()
  };
  return await v66Insert("rwd_app_data", payload);
}
async function v66SyncCoreData(){
  const packs=[
    ["customers",state.customers||[]],
    ["trucks",state.trucks||[]],
    ["workorders",state.workorders||[]],
    ["quotes",state.quotes||[]],
    ["invoices",state.invoices||[]],
    ["schedule",state.schedule||[]],
    ["pmRecords",state.pmRecords||[]],
    ["inventory",state.inventory||[]],
    ["externalLinks",state.externalLinks||[]],
    ["storageQueue",state.storageQueue||[]]
  ];
  const log=[];
  for(const [kind,items] of packs){
    let ok=0,fail=0;
    for(const item of items){
      try{await v66UpsertAppData(kind,item);ok++;}catch(e){fail++;log.push(`${kind} fail: ${e.message}`);}
    }
    log.push(`${kind}: ${ok} synced, ${fail} failed`);
  }
  state.supabase.lastSync=new Date().toLocaleString();
  saveState();
  return log.join("\n");
}
async function v66CreateCustomerLink(rec){
  const payload={
    shop_id: state.backend.shopId || null,
    link_type: rec.kind || rec.link_type || "portal",
    local_id: rec.id || rec.local_id || Date.now().toString(),
    customer: rec.customer || rec.label || "",
    status: rec.status || "Ready",
    payload: rec
  };
  return await v66Insert("customer_links", payload);
}
async function v66SyncCustomerLinks(){
  ensureV66();
  const log=[];
  for(const rec of (state.externalLinks||[])){
    try{await v66CreateCustomerLink(rec);rec.synced=true;rec.syncedAt=new Date().toLocaleString();log.push(`${rec.label||rec.id}: synced`);}
    catch(e){rec.error=e.message;log.push(`${rec.label||rec.id}: ${e.message}`);}
  }
  saveState();
  return log.join("\n");
}
async function v66PrepareStorageRecords(){
  ensureV66();
  const log=[];
  for(const rec of (state.storageQueue||[])){
    const row={
      shop_id: state.backend.shopId || null,
      local_id: rec.id,
      file_name: rec.fileName,
      file_path: `${state.backend.bucket}/${rec.id}-${rec.fileName}`,
      public_url: "",
      purpose: rec.purpose,
      payload: rec
    };
    try{await v66Insert("file_records",row);rec.status="Record Saved";rec.recordSavedAt=new Date().toLocaleString();log.push(`${rec.fileName}: record saved`);}
    catch(e){rec.error=e.message;log.push(`${rec.fileName}: ${e.message}`);}
  }
  saveState();
  return log.join("\n");
}
async function v66AskRealAi(prompt){
  ensureV66();
  if(!state.backend.aiEndpoint) return await v52AskAi(prompt);
  const res = await fetch(state.backend.aiEndpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+(state.backend.aiKey||"")},
    body:JSON.stringify({prompt, context:{truck:state.truck, settings:state.settings, shop:state.auth?.shop}})
  });
  const data = await res.json();
  return data.answer || data.text || JSON.stringify(data);
}
async function v66RunRealOcr(payload){
  ensureV66();
  if(!state.backend.ocrEndpoint) return {text:"OCR endpoint not configured. Local OCR workflow ready.",payload};
  const res = await fetch(state.backend.ocrEndpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+(state.backend.ocrKey||"")},
    body:JSON.stringify(payload)
  });
  return await res.json();
}


function renderBackendCenter(){
  ensureV66();
  const cards=[
    ["Supabase URL", state.supabase?.url ? "good":"bad", state.supabase?.url || "Missing"],
    ["Anon Key", state.supabase?.anonKey ? "good":"bad", state.supabase?.anonKey ? "Configured" : "Missing"],
    ["Shop ID", state.backend.shopId ? "good":"warn", state.backend.shopId || "Optional until shops table is used"],
    ["Storage Bucket", state.backend.bucket ? "good":"warn", state.backend.bucket || "rwd-files"],
    ["AI Endpoint", state.backend.aiEndpoint ? "good":"warn", state.backend.aiEndpoint || "Local AI fallback"],
    ["OCR Endpoint", state.backend.ocrEndpoint ? "good":"warn", state.backend.ocrEndpoint || "Local OCR fallback"]
  ];
  $("#screen").innerHTML=`${pageHead("Backend Center","saveBackend")}
  <section class="backend-status-grid">${cards.map(c=>`<div class="backend-status-card ${c[1]}"><b>${c[0]}</b><small>${c[2]}</small></div>`).join("")}</section>
  <section class="form-panel form-grid">
    <label>Shop ID<input id="backendShopId" value="${state.backend.shopId||""}" placeholder="Supabase shops.id later"></label>
    <label>Storage Bucket<input id="backendBucket" value="${state.backend.bucket||"rwd-files"}"></label>
    <label>AI Endpoint<input id="backendAiEndpoint" value="${state.backend.aiEndpoint||""}" placeholder="https://your-ai-backend"></label>
    <label>AI Key<input id="backendAiKey" value="${state.backend.aiKey||""}"></label>
    <label>OCR Endpoint<input id="backendOcrEndpoint" value="${state.backend.ocrEndpoint||""}" placeholder="https://your-ocr-backend"></label>
    <label>OCR Key<input id="backendOcrKey" value="${state.backend.ocrKey||""}"></label>
    <label>Square Payment Link<input id="backendSquare" value="${state.backend.squareLink||""}" placeholder="Paste default Square payment link"></label>
    <div class="backend-action-grid">
      <button id="testTables">Test Tables</button>
      <button id="syncCoreData">Sync Core Data</button>
      <button id="syncCustomerLinks">Sync Customer Links</button>
      <button id="prepareStorageRows">Prepare Storage Rows</button>
      <button data-route="backendsetup">SQL Setup</button>
      <button data-route="stability">Stability Center</button>
    </div>
    <div class="upload-progress" id="backendLog">Ready.</div>
  </section>`;
  bindPageTools();
  $("#saveBackend").onclick=()=>{state.backend.shopId=$("#backendShopId").value;state.backend.bucket=$("#backendBucket").value||"rwd-files";state.backend.aiEndpoint=$("#backendAiEndpoint").value;state.backend.aiKey=$("#backendAiKey").value;state.backend.ocrEndpoint=$("#backendOcrEndpoint").value;state.backend.ocrKey=$("#backendOcrKey").value;state.backend.squareLink=$("#backendSquare").value;saveState();toast("Backend saved");};
  $("#testTables").onclick=async()=>{const log=[];for(const t of ["shops","profiles","rwd_app_data","customer_links","file_records"]){try{await v66Select(t);log.push(`${t}: OK`);}catch(e){log.push(`${t}: ${e.message}`);}}$("#backendLog").textContent=log.join("\n");};
  $("#syncCoreData").onclick=async()=>{$("#backendLog").textContent="Syncing...";try{$("#backendLog").textContent=await v66SyncCoreData();toast("Core sync done");}catch(e){$("#backendLog").textContent=e.message;toast("Sync failed");}};
  $("#syncCustomerLinks").onclick=async()=>{$("#backendLog").textContent="Syncing links...";try{$("#backendLog").textContent=await v66SyncCustomerLinks();toast("Links synced");}catch(e){$("#backendLog").textContent=e.message;toast("Link sync failed");}};
  $("#prepareStorageRows").onclick=async()=>{$("#backendLog").textContent="Preparing storage rows...";try{$("#backendLog").textContent=await v66PrepareStorageRecords();toast("Storage rows ready");}catch(e){$("#backendLog").textContent=e.message;toast("Storage prep failed");}};
}
function renderBackendSetup(){
  $("#screen").innerHTML=`${pageHead("Supabase SQL Setup","",false)}
  <section class="backend-banner"><b>Run This SQL</b><small>Open Supabase SQL Editor and run the setup. Then create Storage bucket: rwd-files.</small></section>
  <section class="sql-box">${`create extension if not exists "pgcrypto";

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Rolling Wrench Diesel LLC',
  phone text,
  email text,
  website text,
  address text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  shop_id uuid references public.shops(id) on delete cascade,
  name text,
  email text,
  role text default 'Owner/Admin',
  created_at timestamptz default now()
);

create table if not exists public.rwd_app_data (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  user_id uuid,
  app_kind text,
  local_id text,
  payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  link_type text,
  local_id text,
  customer text,
  status text default 'Ready',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  expires_at timestamptz
);

create table if not exists public.file_records (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  local_id text,
  file_name text,
  file_path text,
  public_url text,
  purpose text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.shops disable row level security;
alter table public.profiles disable row level security;
alter table public.rwd_app_data disable row level security;
alter table public.customer_links disable row level security;
alter table public.file_records disable row level security;`}</section>`;
  bindPageTools();
}


function ensureV67(){
  if(typeof ensureV66 === "function") ensureV66();
  if(!state.communications) state.communications = [];
  if(!state.messageTemplates) state.messageTemplates = {
    quote:"Rolling Wrench Diesel: Your quote is ready. Please review and sign here:",
    invoice:"Rolling Wrench Diesel: Your invoice is ready. View/sign/pay here:",
    payment:"Rolling Wrench Diesel: Payment link:",
    gps:"Rolling Wrench Diesel: Please send your current location for roadside service:",
    reminder:"Rolling Wrench Diesel reminder: You have an upcoming service appointment."
  };
}
function commStatusPill(status){
  const s=(status||"sent").toLowerCase();
  return `<span class="comm-status ${s}">${status||"Sent"}</span>`;
}
function commAdd(type, customer, phone, message, link, status="Sent"){
  ensureV67();
  const rec={id:"COMM-"+Date.now(),type,customer,phone,message,link,status,date:new Date().toLocaleString()};
  state.communications.unshift(rec);
  saveState();
  return rec;
}
function commPhoneLink(phone,message){
  const p=(phone||"").replace(/[^\d+]/g,"");
  return `sms:${p}?&body=${encodeURIComponent(message||"")}`;
}
function commBuildMessage(type, customer, link){
  ensureV67();
  const base = state.messageTemplates[type] || "Rolling Wrench Diesel:";
  return `${base} ${link || ""}`.trim();
}
function commLatestQuoteLink(){
  if((state.externalLinks||[]).find(l=>l.kind==="quoteapproval")) return (state.externalLinks||[]).find(l=>l.kind==="quoteapproval").link;
  if((state.quoteApprovals||[])[0]) return state.quoteApprovals[0].link;
  return "";
}
function commLatestInvoiceLink(){
  if((state.externalLinks||[]).find(l=>l.kind==="invoiceportal")) return (state.externalLinks||[]).find(l=>l.kind==="invoiceportal").link;
  if((state.invoiceLinks||[])[0]) return state.invoiceLinks[0].link;
  return "";
}
function commMark(id,status){
  const rec=(state.communications||[]).find(c=>c.id===id);
  if(rec){rec.status=status;rec.updated=new Date().toLocaleString();saveState();}
}
function renderCommunicationCenter(){
  ensureV67();
  const customer=state.truck.customer || "";
  $("#screen").innerHTML=`${pageHead("Customer Messages","saveCommSettings")}
  <section class="backend-banner"><b>Customer Communication Center</b><small>Text quotes, invoices, payment links, GPS requests, appointment reminders, and track the timeline.</small></section>
  <section class="form-panel form-grid">
    <label>Customer<input id="commCustomer" value="${customer}" placeholder="Customer / company"></label>
    <label>Phone<input id="commPhone" placeholder="Customer phone"></label>
    <label>Type<select id="commType"><option value="quote">Quote</option><option value="invoice">Invoice</option><option value="payment">Payment Link</option><option value="gps">GPS Request</option><option value="reminder">Appointment Reminder</option><option value="custom">Custom</option></select></label>
    <label>Link<input id="commLink" placeholder="Quote/invoice/payment/GPS link"></label>
    <label>Message<textarea id="commMessage"></textarea></label>
    <div class="comm-grid">
      <button class="comm-action" id="buildMsg"><b>Build Message</b><small>Auto-fill text</small></button>
      <button class="comm-action" id="openText"><b>Open Text</b><small>Use phone SMS app</small></button>
      <button class="comm-action" id="markOpened"><b>Mark Opened</b><small>Customer viewed</small></button>
      <button class="comm-action" id="markDone"><b>Mark Complete</b><small>Approved / Paid</small></button>
    </div>
    <div class="message-preview" id="commPreview">No message yet.</div>
    <a class="sms-link" id="smsPreview" href="#">SMS link will appear here.</a>
  </section>
  <section class="settings-section">
    <h3>Communication Timeline</h3>
    <div class="timeline">
      ${(state.communications||[]).length ? state.communications.map(c=>`<div class="timeline-item"><b>${c.type} — ${c.customer || "Customer"}</b><small>${c.date}<br>${c.message}<br>${c.link||""}</small>${commStatusPill(c.status)}<div class="smart-action-row"><button data-comm-status="${c.id}|Opened">Opened</button><button data-comm-status="${c.id}|Approved">Approved</button><button data-comm-status="${c.id}|Paid">Paid</button></div></div>`).join("") : `<div class="output">No communication history yet.</div>`}
    </div>
  </section>`;
  bindPageTools();

  function currentLinkForType(type){
    if(type==="quote") return commLatestQuoteLink();
    if(type==="invoice") return commLatestInvoiceLink();
    if(type==="payment") return state.backend?.squareLink || "";
    if(type==="gps") return `${location.origin}${location.pathname}#gpsmanager`;
    return $("#commLink").value;
  }
  $("#commType").onchange=()=>{$("#commLink").value=currentLinkForType($("#commType").value);};
  $("#buildMsg").onclick=()=>{
    const type=$("#commType").value;
    if(!$("#commLink").value) $("#commLink").value=currentLinkForType(type);
    const msg=commBuildMessage(type,$("#commCustomer").value,$("#commLink").value);
    $("#commMessage").value=msg;
    $("#commPreview").textContent=msg;
    $("#smsPreview").href=commPhoneLink($("#commPhone").value,msg);
    $("#smsPreview").textContent=$("#smsPreview").href;
  };
  $("#openText").onclick=()=>{
    const msg=$("#commMessage").value || commBuildMessage($("#commType").value,$("#commCustomer").value,$("#commLink").value);
    const rec=commAdd($("#commType").value,$("#commCustomer").value,$("#commPhone").value,msg,$("#commLink").value,"Sent");
    window.location.href=commPhoneLink($("#commPhone").value,msg);
  };
  $("#markOpened").onclick=()=>{if(state.communications[0]){state.communications[0].status="Opened";saveState();toast("Marked opened");renderCommunicationCenter();}};
  $("#markDone").onclick=()=>{if(state.communications[0]){const t=state.communications[0].type;state.communications[0].status=t==="invoice"||t==="payment"?"Paid":"Approved";saveState();toast("Marked complete");renderCommunicationCenter();}};
  $$("[data-comm-status]").forEach(btn=>btn.onclick=()=>{const [id,status]=btn.dataset.commStatus.split("|");commMark(id,status);renderCommunicationCenter();});
  $("#saveCommSettings").onclick=()=>{state.messageTemplates[$("#commType").value]=$("#commMessage").value || state.messageTemplates[$("#commType").value];saveState();toast("Template saved");};
}
function renderCommunicationTemplates(){
  ensureV67();
  $("#screen").innerHTML=`${pageHead("Message Templates","saveTemplates")}
  <section class="form-panel form-grid">
    <label>Quote Template<textarea id="tplQuote">${state.messageTemplates.quote}</textarea></label>
    <label>Invoice Template<textarea id="tplInvoice">${state.messageTemplates.invoice}</textarea></label>
    <label>Payment Template<textarea id="tplPayment">${state.messageTemplates.payment}</textarea></label>
    <label>GPS Request Template<textarea id="tplGps">${state.messageTemplates.gps}</textarea></label>
    <label>Reminder Template<textarea id="tplReminder">${state.messageTemplates.reminder}</textarea></label>
  </section>`;
  bindPageTools();
  $("#saveTemplates").onclick=()=>{state.messageTemplates={quote:$("#tplQuote").value,invoice:$("#tplInvoice").value,payment:$("#tplPayment").value,gps:$("#tplGps").value,reminder:$("#tplReminder").value};saveState();toast("Templates saved");};
}


function ensureV68(){
  if(typeof ensureV67 === "function") ensureV67();
  if(!state.fileRecords) state.fileRecords = [];
  if(!state.fileLinks) state.fileLinks = {};
}
function filePurposeIcon(purpose){
  const p=(purpose||"").toLowerCase();
  if(p.includes("vin")) return "VIN";
  if(p.includes("part")) return "📦";
  if(p.includes("invoice")) return "🧾";
  if(p.includes("quote")) return "Q";
  if(p.includes("truck")) return "🚚";
  if(p.includes("repair")) return "🔧";
  if(p.includes("signature")) return "✍";
  return "📎";
}
function v68MakeFileRecord(file, target, purpose, notes, dataUrl){
  ensureV68();
  const rec={
    id:"FILE-"+Date.now()+"-"+Math.floor(Math.random()*9999),
    fileName:file?.name || "camera-capture",
    size:file?.size || 0,
    mime:file?.type || "",
    target:target || "repair memory",
    purpose:purpose || "file",
    notes:notes || "",
    dataUrl:dataUrl || "",
    status:"Local Saved",
    created:new Date().toLocaleString(),
    customer:state.truck.customer || "",
    truck:state.truck.unit || "",
    vin:state.truck.vin || ""
  };
  state.fileRecords.unshift(rec);
  if(!state.fileLinks[rec.target]) state.fileLinks[rec.target]=[];
  state.fileLinks[rec.target].unshift(rec.id);
  state.storageQueue = state.storageQueue || [];
  state.storageQueue.unshift({id:rec.id,fileName:rec.fileName,purpose:rec.purpose,status:"Queued",created:rec.created,target:rec.target,record:rec});
  saveState();
  return rec;
}
function v68AttachFileToModule(rec){
  const text=`File attached: ${rec.fileName} • ${rec.purpose} • ${rec.notes}`;
  if(rec.target==="truck"){ addTruckHistory("File", text); }
  if(rec.target==="parts"){ state.parts.push({query:rec.fileName,notes:text}); }
  if(rec.target==="invoice"){ state.invoices.push({customer:rec.customer,truck:rec.truck,work:text,total:0,fileId:rec.id,date:new Date().toLocaleString()}); }
  if(rec.target==="quote"){ state.quotes.push({customer:rec.customer,truck:rec.truck,desc:text,total:0,fileId:rec.id,date:new Date().toLocaleString()}); }
  if(rec.target==="workorder"){ state.workorders.push({customer:rec.customer,truck:rec.truck,desc:text,status:"File Attached",fileId:rec.id,date:new Date().toLocaleString()}); }
  if(rec.target==="memory"){ state.notes.push({type:"File",note:text,fileId:rec.id,date:new Date().toLocaleString()}); }
  saveState();
}
async function v68SyncFileRecords(){
  ensureV68();
  const log=[];
  for(const rec of state.fileRecords){
    try{
      if(typeof v66Insert === "function"){
        await v66Insert("file_records",{
          shop_id:state.backend?.shopId || null,
          local_id:rec.id,
          file_name:rec.fileName,
          file_path:`${state.backend?.bucket || "rwd-files"}/${rec.id}-${rec.fileName}`,
          public_url:"",
          purpose:rec.purpose,
          payload:rec
        });
        rec.status="Record Synced";
        rec.syncedAt=new Date().toLocaleString();
        log.push(`${rec.fileName}: synced`);
      }else{
        log.push(`${rec.fileName}: backend insert not available`);
      }
    }catch(e){
      rec.error=e.message;
      log.push(`${rec.fileName}: ${e.message}`);
    }
  }
  saveState();
  return log.join("\n");
}
function v68ReadFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function renderFileUploadCenter(){
  ensureV68();
  $("#screen").innerHTML=`${pageHead("File Uploads","saveFileUpload")}
  <section class="file-upload-hero"><b>Real File Upload Workflow</b><small>Attach photos, VIN plates, part labels, invoices, receipts, signatures, and repair photos to the correct customer/truck/job.</small></section>
  <section class="form-panel form-grid">
    <label>Attach To<select id="fileTarget"><option value="truck">Truck History</option><option value="workorder">Work Order</option><option value="quote">Quote</option><option value="invoice">Invoice</option><option value="parts">Parts Lookup</option><option value="memory">Repair Memory</option></select></label>
    <label>Purpose<select id="filePurpose"><option>truck photo</option><option>VIN plate</option><option>part label</option><option>invoice / receipt</option><option>before repair photo</option><option>after repair photo</option><option>damage photo</option><option>signature</option><option>document</option></select></label>
    <input id="fileUploadInput" type="file" accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xlsx" multiple>
    <label>Notes<textarea id="fileNotes" placeholder="What is this file/photo?"></textarea></label>
    <div class="smart-action-row">
      <button id="saveUploadFiles">Save Files</button>
      <button id="cameraUpload">Camera</button>
      <button id="syncFileRecords">Sync Records</button>
    </div>
    <input id="cameraUploadInput" type="file" accept="image/*" capture="environment" hidden>
    <div class="file-preview-box" id="filePreview">No file selected.</div>
    <div class="upload-status" id="fileUploadStatus">Ready.</div>
  </section>
  <section class="settings-section">
    <h3>Saved Files</h3>
    ${(state.fileRecords||[]).length ? state.fileRecords.map(r=>`<div class="file-record"><div class="file-icon">${filePurposeIcon(r.purpose)}</div><div><b>${r.fileName}</b><small>${r.target} • ${r.purpose} • ${r.status}<br>${r.notes||""}</small></div><button class="action-btn" data-open-file="${r.id}">Open</button></div>`).join("") : `<div class="output">No files saved yet.</div>`}
  </section>`;
  bindPageTools();
  const previewFile=async(file)=>{
    if(!file){$("#filePreview").textContent="No file selected.";return;}
    let text=`Selected: ${file.name}\nType: ${file.type || "unknown"}\nSize: ${file.size} bytes`;
    if(file.type && file.type.startsWith("image/")){
      const url=await v68ReadFileAsDataUrl(file);
      text += `\nImage preview below.`;
      $("#filePreview").innerHTML=text+`<img src="${url}" alt="preview">`;
    }else{
      $("#filePreview").textContent=text;
    }
  };
  $("#fileUploadInput").onchange=()=>previewFile($("#fileUploadInput").files[0]);
  $("#cameraUpload").onclick=()=>$("#cameraUploadInput").click();
  $("#cameraUploadInput").onchange=async()=>{const f=$("#cameraUploadInput").files[0];await previewFile(f);};
  async function saveFilesFrom(input){
    const files=[...input.files];
    if(!files.length){toast("Choose files first");return;}
    const log=[];
    for(const f of files){
      let dataUrl="";
      if(f.type && f.type.startsWith("image/")) dataUrl=await v68ReadFileAsDataUrl(f);
      const rec=v68MakeFileRecord(f,$("#fileTarget").value,$("#filePurpose").value,$("#fileNotes").value,dataUrl);
      v68AttachFileToModule(rec);
      log.push(`${rec.fileName}: saved to ${rec.target}`);
    }
    $("#fileUploadStatus").textContent=log.join("\n");
    toast("Files saved");
    renderFileUploadCenter();
  }
  $("#saveUploadFiles").onclick=()=>saveFilesFrom($("#fileUploadInput").files.length?$("#fileUploadInput"):$("#cameraUploadInput"));
  $("#syncFileRecords").onclick=async()=>{$("#fileUploadStatus").textContent="Syncing file records...";$("#fileUploadStatus").textContent=await v68SyncFileRecords();toast("File records sync attempted");};
  $$("[data-open-file]").forEach(btn=>btn.onclick=()=>{
    const r=state.fileRecords.find(x=>x.id===btn.dataset.openFile);
    if(!r) return;
    $("#fileUploadStatus").textContent=JSON.stringify(r,null,2);
    if(r.dataUrl) $("#filePreview").innerHTML=`${r.fileName}<img src="${r.dataUrl}" alt="file">`;
  });
  $("#saveFileUpload").onclick=()=>{saveState();toast("File uploads saved");};
}
function renderFileHistory(){
  ensureV68();
  const groups={};
  (state.fileRecords||[]).forEach(r=>{const k=r.target||"other";groups[k]=groups[k]||[];groups[k].push(r);});
  $("#screen").innerHTML=`${pageHead("File History","",false)}
  <section class="settings-section"><h3>Files By Module</h3>
  ${Object.keys(groups).length ? Object.entries(groups).map(([k,items])=>`<div class="storage-card"><b>${k}</b><small>${items.length} files</small>${items.map(r=>`<div class="file-record"><div class="file-icon">${filePurposeIcon(r.purpose)}</div><div><b>${r.fileName}</b><small>${r.purpose} • ${r.created}</small></div></div>`).join("")}</div>`).join("") : `<div class="output">No file history yet.</div>`}
  </section>`;
  bindPageTools();
}


function ensureV69(){
  if(typeof ensureV68 === "function") ensureV68();
  if(!state.visionScans) state.visionScans = [];
  if(!state.visionSettings) state.visionSettings = {autoSave:true, requireReview:true, exactPartsOnly:true};
}
function visionIcon(type){
  const t=(type||"").toLowerCase();
  if(t.includes("vin")) return "VIN";
  if(t.includes("part")) return "📦";
  if(t.includes("invoice")) return "🧾";
  if(t.includes("fault")) return "⚠";
  if(t.includes("damage")) return "💥";
  return "👁";
}
function localVisionExtract(type,fileName,notes){
  const t=(type||"").toLowerCase();
  const base={type,fileName:fileName||"camera image",notes:notes||"",confidence:"Local workflow",created:new Date().toLocaleString(),fields:{}};
  if(t.includes("vin")){
    base.summary="VIN plate scan ready for manual verification. Real OCR endpoint can extract VIN/year/make/model/engine when connected.";
    base.fields={vin:"VERIFY MANUALLY", unit:state.truck.unit||"", customer:state.truck.customer||"", engine:state.truck.engine||""};
  }else if(t.includes("part")){
    base.summary="Part label scan ready. Exact part number must be verified by VIN/OEM/supplier before quoting.";
    base.fields={partNumber:"UNKNOWN", brand:"UNKNOWN", description:"Part label / box", exactPart:"VERIFY"};
  }else if(t.includes("invoice")){
    base.summary="Invoice/receipt scan ready. Vendor, line items, totals require review before saving.";
    base.fields={vendor:"UNKNOWN", invoiceNumber:"UNKNOWN", total:"0.00", date:"UNKNOWN"};
  }else if(t.includes("fault")){
    base.summary="Fault screen scan ready. SPN/FMI/code text requires review before diagnosis.";
    base.fields={code:"UNKNOWN", module:"UNKNOWN", status:"UNKNOWN", action:"Open Fault Doctor"};
  }else if(t.includes("damage")){
    base.summary="Damage photo recorded for work order, quote, or invoice documentation.";
    base.fields={area:"UNKNOWN", severity:"Review", repairNeeded:"Inspect"};
  }else{
    base.summary="Document/photo classified and ready to save to repair memory.";
    base.fields={classification:type, action:"Review"};
  }
  return base;
}
async function v69RunVision(type,file,notes){
  ensureV69();
  if(state.backend && state.backend.ocrEndpoint){
    try{
      const payload={type,fileName:file?.name||"",notes,context:{truck:state.truck,customer:state.truck.customer}};
      const data=await v66RunRealOcr(payload);
      const rec={type,fileName:file?.name||"camera image",notes,summary:data.text||data.summary||JSON.stringify(data),fields:data.fields||{},confidence:data.confidence||"backend",created:new Date().toLocaleString()};
      state.visionScans.unshift(rec);
      saveState();
      return rec;
    }catch(e){
      const rec=localVisionExtract(type,file?.name,notes);
      rec.summary+="\n\nBackend OCR failed: "+e.message;
      state.visionScans.unshift(rec); saveState(); return rec;
    }
  }
  const rec=localVisionExtract(type,file?.name,notes);
  state.visionScans.unshift(rec);
  saveState();
  return rec;
}
function v69SaveScanToModule(scan,target){
  const text=`Vision Scan: ${scan.type}\nFile: ${scan.fileName}\n${scan.summary}\nFields: ${JSON.stringify(scan.fields,null,2)}`;
  if(target==="truck"){
    if(scan.fields?.vin && scan.fields.vin!=="VERIFY MANUALLY") state.truck.vin=scan.fields.vin;
    addTruckHistory("Vision/OCR",text);
  }
  if(target==="parts") state.parts.push({query:scan.fields?.partNumber || scan.fileName, notes:text});
  if(target==="invoice") state.invoices.push({customer:state.truck.customer,truck:state.truck.unit,work:text,total:Number(scan.fields?.total||0),date:new Date().toLocaleString()});
  if(target==="quote") state.quotes.push({customer:state.truck.customer,truck:state.truck.unit,desc:text,total:0,date:new Date().toLocaleString()});
  if(target==="workorder") state.workorders.push({customer:state.truck.customer,truck:state.truck.unit,desc:text,status:"Vision Scan",date:new Date().toLocaleString()});
  if(target==="fault") state.notes.push({type:"Fault Screen OCR",note:text,date:new Date().toLocaleString()});
  if(target==="memory") state.notes.push({type:"Vision Scan",note:text,date:new Date().toLocaleString()});
  saveState();
}
function renderVisionCenter(){
  ensureV69();
  $("#screen").innerHTML=`${pageHead("OCR + Vision","saveVisionSettings")}
  <section class="vision-card"><b>Real OCR + Vision Workflow</b><small>Scan VIN plates, part labels, invoices, fault screens, damage photos, and documents. Backend OCR endpoint hooks are ready.</small></section>
  <section class="form-panel form-grid">
    <label>Scan Type<select id="visionType"><option>VIN Plate</option><option>Part Label / Box</option><option>Invoice / Receipt</option><option>Fault Screen / Scanner</option><option>Damage Photo</option><option>Repair Photo</option><option>Document</option></select></label>
    <label>Save To<select id="visionTarget"><option value="truck">Truck History</option><option value="parts">Parts Lookup</option><option value="workorder">Work Order</option><option value="quote">Quote</option><option value="invoice">Invoice</option><option value="fault">Fault Doctor</option><option value="memory">Repair Memory</option></select></label>
    <input id="visionFile" type="file" accept="image/*,.pdf" capture="environment">
    <label>Notes<textarea id="visionNotes" placeholder="What are we looking at?"></textarea></label>
    <div class="vision-grid">
      <button class="vision-action" id="runVision"><b>Run OCR/Vision</b><small>Extract fields</small></button>
      <button class="vision-action" id="saveVisionToModule"><b>Save To Module</b><small>Use extracted data</small></button>
      <button class="vision-action" data-route="backend"><b>Backend Settings</b><small>OCR endpoint</small></button>
      <button class="vision-action" data-route="fileuploads"><b>File Uploads</b><small>Attach original file</small></button>
    </div>
    <div class="vision-result" id="visionResult">No scan yet.</div>
    <div class="extracted-fields" id="visionFields"></div>
  </section>
  <section class="settings-section">
    <h3>Vision History</h3>
    ${(state.visionScans||[]).length ? state.visionScans.map((s,i)=>`<div class="vision-history-card"><div class="vision-icon">${visionIcon(s.type)}</div><div><b>${s.type}</b><small>${s.created}<br>${s.summary}</small></div><button class="action-btn" data-load-vision="${i}">Open</button></div>`).join("") : `<div class="output">No OCR/Vision scans yet.</div>`}
  </section>`;
  bindPageTools();
  let activeScan=null;
  function showScan(scan){
    activeScan=scan;
    $("#visionResult").textContent=`${scan.summary}\n\nConfidence: ${scan.confidence}\nFile: ${scan.fileName}`;
    $("#visionFields").innerHTML=Object.entries(scan.fields||{}).map(([k,v])=>`<div class="extracted-field"><b>${k}</b><span>${v}</span></div>`).join("") || `<div class="output">No fields extracted.</div>`;
  }
  $("#runVision").onclick=async()=>{
    const file=$("#visionFile").files[0];
    $("#visionResult").textContent="Scanning...";
    const scan=await v69RunVision($("#visionType").value,file,$("#visionNotes").value);
    if(file && typeof v68MakeFileRecord==="function"){
      let dataUrl="";
      if(file.type && file.type.startsWith("image/")) dataUrl=await v68ReadFileAsDataUrl(file);
      v68MakeFileRecord(file,$("#visionTarget").value,$("#visionType").value,$("#visionNotes").value,dataUrl);
    }
    showScan(scan);
    toast("Vision scan complete");
  };
  $("#saveVisionToModule").onclick=()=>{if(!activeScan){toast("Run scan first");return;}v69SaveScanToModule(activeScan,$("#visionTarget").value);toast("Saved to module");};
  $$("[data-load-vision]").forEach(btn=>btn.onclick=()=>showScan(state.visionScans[Number(btn.dataset.loadVision)]));
  $("#saveVisionSettings").onclick=()=>{saveState();toast("Vision settings saved");};
}
function renderVisionSettings(){
  ensureV69();
  $("#screen").innerHTML=`${pageHead("Vision Settings","saveVisionSettings2")}
  <section class="form-panel form-grid">
    <label>OCR Endpoint<input id="visionOcrEndpoint" value="${state.backend?.ocrEndpoint||""}" placeholder="https://your-ocr-backend"></label>
    <label>OCR Key<input id="visionOcrKey" value="${state.backend?.ocrKey||""}"></label>
    <label>AI Vision Endpoint<input id="visionAiEndpoint" value="${state.backend?.aiEndpoint||""}" placeholder="https://your-ai-vision-backend"></label>
    <div class="output">Local workflow works without endpoint. Real extraction needs OCR/vision backend connected.</div>
  </section>`;
  bindPageTools();
  $("#saveVisionSettings2").onclick=()=>{state.backend=state.backend||{};state.backend.ocrEndpoint=$("#visionOcrEndpoint").value;state.backend.ocrKey=$("#visionOcrKey").value;state.backend.aiEndpoint=$("#visionAiEndpoint").value;saveState();toast("Vision settings saved");};
}


function ensureV691(){
  if(typeof ensureV69 === "function") ensureV69();
  if(!state.repairMemory) state.repairMemory = [];
  if(!state.cleanupLog) state.cleanupLog = [];
  // migrate notes into repairMemory view without deleting old notes
  (state.notes||[]).forEach((n,idx)=>{
    if(!state.repairMemory.find(m=>m.source==="notes" && m.sourceIndex===idx)){
      state.repairMemory.push({
        id:"MEM-NOTE-"+idx,
        source:"notes",
        sourceIndex:idx,
        title:n.type || "Repair Memory",
        complaint:n.note || "",
        cause:"",
        correction:"",
        customer:state.truck?.customer || "",
        truck:state.truck?.unit || "",
        vin:state.truck?.vin || "",
        engine:state.truck?.engine || "",
        parts:"",
        labor:"",
        keywords:(n.type||"") + " " + (n.note||""),
        date:n.date || new Date().toLocaleString(),
        status:"Saved",
        test:false,
        archived:false
      });
    }
  });
}
function cleanupAddLog(msg){
  state.cleanupLog = state.cleanupLog || [];
  state.cleanupLog.unshift(`${new Date().toLocaleString()} — ${msg}`);
  saveState();
}
function isTestText(v){
  const s=(v||"").toLowerCase().trim();
  return ["test","demo","sample","jay","bb","asdf","aaa","bbb","123"].some(x=>s===x || s.includes("test"));
}
function memorySummary(m){
  return [m.complaint,m.cause,m.correction,m.parts,m.keywords].filter(Boolean).join(" ");
}
function memoryMatches(m,q){
  if(!q) return true;
  const s=JSON.stringify(m).toLowerCase();
  return s.includes(q.toLowerCase());
}
function memoryTags(m){
  const tags=[];
  if(m.engine) tags.push(m.engine);
  if(m.vin) tags.push(m.vin);
  if(m.customer) tags.push(m.customer);
  if(m.status) tags.push(m.status);
  if(m.test) tags.push("TEST");
  if(m.archived) tags.push("ARCHIVED");
  const kw=(m.keywords||"").split(/[,\s]+/).filter(Boolean).slice(0,5);
  tags.push(...kw);
  return tags;
}
function createRepairMemoryFromWorkOrder(i){
  const w=state.workorders[i];
  if(!w) return null;
  const m={
    id:"MEM-"+Date.now(),
    title:w.customer ? `WO ${w.customer}` : "Work Order Memory",
    complaint:w.desc || "",
    cause:"",
    correction:"",
    customer:w.customer || "",
    truck:w.truck || "",
    vin:state.truck?.vin || "",
    engine:state.truck?.engine || "",
    parts:"",
    labor:w.clockSeconds ? (w.clockSeconds/3600).toFixed(2) : "",
    keywords:`workorder ${w.status||""} ${w.desc||""}`,
    date:new Date().toLocaleString(),
    status:"Saved",
    test:false,
    archived:false,
    source:"workorders",
    sourceIndex:i
  };
  state.repairMemory.unshift(m);
  cleanupAddLog("Converted work order to repair memory");
  return m;
}
function deleteTestRecords(){
  ensureV691();
  let count=0;
  const filterReal = (item)=>{
    const text=JSON.stringify(item||{});
    const test=isTestText(item?.customer)||isTestText(item?.desc)||isTestText(item?.work)||isTestText(item?.note)||isTestText(text);
    if(test){count++; return false;}
    return true;
  };
  state.workorders=(state.workorders||[]).filter(filterReal);
  state.quotes=(state.quotes||[]).filter(filterReal);
  state.invoices=(state.invoices||[]).filter(filterReal);
  state.notes=(state.notes||[]).filter(filterReal);
  state.repairMemory=(state.repairMemory||[]).filter(m=>!(m.test || isTestText(m.customer) || isTestText(m.complaint) || isTestText(m.correction)));
  cleanupAddLog(`Deleted ${count} test/demo records`);
  saveState();
  return count;
}
function renderRepairMemoryLibrary(){
  ensureV691();
  const q=(state.memorySearch||"");
  const filtered=(state.repairMemory||[]).filter(m=>memoryMatches(m,q) && (!m.archived || state.showArchivedMemory));
  $("#screen").innerHTML=`${pageHead("Repair Memory Library","saveMemorySearch")}
  <section class="memory-search form-grid">
    <label>Search Repair Memory<input id="memorySearchInput" value="${q}" placeholder="SPN/FMI, engine, VIN, customer, part number, symptom..."></label>
    <div class="cleanup-toolbar">
      <button id="newMemory">New Memory</button>
      <button id="toggleArchived">${state.showArchivedMemory?"Hide Archived":"Show Archived"}</button>
      <button data-route="cleanup">Data Cleanup</button>
      <button data-route="aioperator">Ask AI</button>
    </div>
  </section>
  <section>
    ${filtered.length ? filtered.map((m,i)=>{
      const realIndex=state.repairMemory.indexOf(m);
      return `<div class="memory-card ${m.test?'test':''} ${m.archived?'archived':''}">
        <b>${m.title || "Repair Memory"}</b>
        <small>${m.date || ""}\nCustomer: ${m.customer || "---"}\nTruck/VIN: ${m.truck || "---"} ${m.vin || ""}\nComplaint: ${m.complaint || "---"}\nCause: ${m.cause || "---"}\nCorrection: ${m.correction || "---"}\nParts: ${m.parts || "---"}\nLabor: ${m.labor || "---"}</small>
        <div class="memory-tags">${memoryTags(m).map(t=>`<span class="memory-tag">${t}</span>`).join("")}</div>
        <div class="row-actions">
          <button data-edit-memory="${realIndex}">Edit</button>
          <button data-memory-test="${realIndex}">${m.test?"Unmark Test":"Mark Test"}</button>
          <button data-memory-archive="${realIndex}">${m.archived?"Unarchive":"Archive"}</button>
          <button data-memory-wo="${realIndex}">To WO</button>
          <button data-memory-invoice="${realIndex}">To Invoice</button>
          <button class="danger" data-delete-memory="${realIndex}">Delete</button>
        </div>
      </div>`}).join("") : `<div class="output">No repair memories found.</div>`}
  </section>`;
  bindPageTools();
  $("#saveMemorySearch").onclick=()=>{state.memorySearch=$("#memorySearchInput").value;saveState();renderRepairMemoryLibrary();};
  $("#memorySearchInput").oninput=()=>{state.memorySearch=$("#memorySearchInput").value;saveState();};
  $("#newMemory").onclick=()=>renderMemoryEditor(-1);
  $("#toggleArchived").onclick=()=>{state.showArchivedMemory=!state.showArchivedMemory;saveState();renderRepairMemoryLibrary();};
  $$("[data-edit-memory]").forEach(b=>b.onclick=()=>renderMemoryEditor(Number(b.dataset.editMemory)));
  $$("[data-memory-test]").forEach(b=>b.onclick=()=>{const m=state.repairMemory[Number(b.dataset.memoryTest)];m.test=!m.test;cleanupAddLog(`${m.test?"Marked":"Unmarked"} test: ${m.title}`);renderRepairMemoryLibrary();});
  $$("[data-memory-archive]").forEach(b=>b.onclick=()=>{const m=state.repairMemory[Number(b.dataset.memoryArchive)];m.archived=!m.archived;cleanupAddLog(`${m.archived?"Archived":"Unarchived"}: ${m.title}`);renderRepairMemoryLibrary();});
  $$("[data-delete-memory]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.deleteMemory);const title=state.repairMemory[i]?.title;state.repairMemory.splice(i,1);cleanupAddLog("Deleted memory: "+title);saveState();renderRepairMemoryLibrary();});
  $$("[data-memory-wo]").forEach(b=>b.onclick=()=>{const m=state.repairMemory[Number(b.dataset.memoryWo)];state.workorders.push({customer:m.customer,truck:m.truck,desc:memorySummary(m),status:"Open",date:new Date().toLocaleString()});saveState();toast("Work order created");});
  $$("[data-memory-invoice]").forEach(b=>b.onclick=()=>{const m=state.repairMemory[Number(b.dataset.memoryInvoice)];state.invoices.push({customer:m.customer,truck:m.truck,work:memorySummary(m),total:0,date:new Date().toLocaleString()});saveState();toast("Invoice created");});
}
function renderMemoryEditor(index){
  ensureV691();
  const m=index>=0 ? state.repairMemory[index] : {id:"MEM-"+Date.now(),title:"",complaint:"",cause:"",correction:"",customer:state.truck?.customer||"",truck:state.truck?.unit||"",vin:state.truck?.vin||"",engine:state.truck?.engine||"",parts:"",labor:"",keywords:"",status:"Saved",test:false,archived:false,date:new Date().toLocaleString()};
  $("#screen").innerHTML=`${pageHead(index>=0?"Edit Memory":"New Memory","saveMemory")}
  <section class="form-panel form-grid">
    <label>Title<input id="memTitle" value="${m.title||""}"></label>
    <div class="two-col"><label>Customer<input id="memCustomer" value="${m.customer||""}"></label><label>Truck<input id="memTruck" value="${m.truck||""}"></label></div>
    <div class="two-col"><label>VIN<input id="memVin" value="${m.vin||""}"></label><label>Engine<input id="memEngine" value="${m.engine||""}"></label></div>
    <label>Complaint<textarea id="memComplaint">${m.complaint||""}</textarea></label>
    <label>Cause<textarea id="memCause">${m.cause||""}</textarea></label>
    <label>Correction<textarea id="memCorrection">${m.correction||""}</textarea></label>
    <div class="two-col"><label>Parts Used<input id="memParts" value="${m.parts||""}"></label><label>Labor Hours<input id="memLabor" value="${m.labor||""}"></label></div>
    <label>Keywords<input id="memKeywords" value="${m.keywords||""}" placeholder="SPN/FMI, part number, symptom, engine"></label>
    <div class="cleanup-toolbar"><button id="aiSummarizeMemory">AI Summary</button><button id="markMemoryTest">${m.test?"Unmark Test":"Mark Test"}</button></div>
  </section>`;
  bindPageTools();
  $("#aiSummarizeMemory").onclick=()=>{const c=$("#memComplaint").value, cause=$("#memCause").value, corr=$("#memCorrection").value;$("#memTitle").value=$("#memTitle").value || (c?c.slice(0,42):"Repair Memory");$("#memKeywords").value=[c,cause,corr,$("#memEngine").value,$("#memParts").value].join(" ").split(/\s+/).filter(w=>w.length>3).slice(0,12).join(", ");toast("Summary fields generated");};
  $("#markMemoryTest").onclick=()=>{m.test=!m.test;toast(m.test?"Marked test":"Unmarked test");};
  $("#saveMemory").onclick=()=>{
    Object.assign(m,{title:$("#memTitle").value||"Repair Memory",customer:$("#memCustomer").value,truck:$("#memTruck").value,vin:$("#memVin").value,engine:$("#memEngine").value,complaint:$("#memComplaint").value,cause:$("#memCause").value,correction:$("#memCorrection").value,parts:$("#memParts").value,labor:$("#memLabor").value,keywords:$("#memKeywords").value,status:"Saved",date:m.date||new Date().toLocaleString()});
    if(index>=0) state.repairMemory[index]=m; else state.repairMemory.unshift(m);
    cleanupAddLog("Saved repair memory: "+m.title);
    saveState(); toast("Repair memory saved"); renderRepairMemoryLibrary();
  };
}
function renderCleanupCenter(){
  ensureV691();
  $("#screen").innerHTML=`${pageHead("Data Cleanup","",false)}
  <section class="backend-banner"><b>Production Cleanup</b><small>Edit, archive, delete, mark test records, and remove demo/test data.</small></section>
  <section class="settings-section">
    <h3>Cleanup Tools</h3>
    <div class="cleanup-toolbar">
      <button class="danger" id="deleteTestRecords">Delete Test Records</button>
      <button data-route="memorylibrary">Repair Memory Library</button>
      <button id="archiveTestWO">Mark Test Work Orders</button>
      <button id="clearCleanupLog">Clear Log</button>
    </div>
    <div class="clean-log">${(state.cleanupLog||[]).join("\n") || "No cleanup actions yet."}</div>
  </section>`;
  bindPageTools();
  $("#deleteTestRecords").onclick=()=>{const c=deleteTestRecords();toast(`Deleted ${c} test records`);renderCleanupCenter();};
  $("#archiveTestWO").onclick=()=>{let c=0;(state.workorders||[]).forEach(w=>{if(isTestText(w.customer)||isTestText(w.desc)){w.test=true;c++;}});cleanupAddLog(`Marked ${c} work orders as test`);saveState();toast("Marked test WOs");renderCleanupCenter();};
  $("#clearCleanupLog").onclick=()=>{state.cleanupLog=[];saveState();renderCleanupCenter();};
}


function ensureV70(){
  if(typeof ensureV691 === "function") ensureV691();
  if(!state.brainChats) state.brainChats = [];
  if(!state.brainActions) state.brainActions = [];
  if(!state.brainSettings) state.brainSettings = {autoRoute:true,autoSave:true,readBack:false,useBackend:true};
}
function brainLog(action,detail){
  state.brainActions.unshift({action,detail,date:new Date().toLocaleString()});
  saveState();
}
function brainContext(){
  return {
    customer:state.truck?.customer || "",
    truck:state.truck?.unit || "",
    vin:state.truck?.vin || "",
    engine:state.truck?.engine || "",
    laborRate:state.settings?.laborRate || 135,
    serviceCall:state.settings?.serviceCall || 250
  };
}
function brainIntent(text){
  const q=(text||"").toLowerCase();
  if(q.includes("quote") || q.includes("estimate")) return "quote";
  if(q.includes("invoice") || q.includes("bill")) return "invoice";
  if(q.includes("work order") || q.includes("wo ") || q.includes("job")) return "workorder";
  if(q.includes("repair memory") || q.includes("save this fix") || q.includes("seen this before")) return "memory";
  if(q.includes("spn") || q.includes("fmi") || q.includes("fault") || q.includes("code")) return "diagnostic";
  if(q.includes("part") || q.includes("supplier") || q.includes("price") || q.includes("water pump") || q.includes("clutch") || q.includes("belt")) return "parts";
  if(q.includes("vin") || q.includes("scan") || q.includes("photo") || q.includes("ocr") || q.includes("picture")) return "vision";
  if(q.includes("customer")) return "customer";
  if(q.includes("truck")) return "truck";
  if(q.includes("schedule") || q.includes("appointment")) return "schedule";
  if(q.includes("text") || q.includes("send")) return "communication";
  return "general";
}
function brainBuildProfessionalText(intent,text){
  const ctx=brainContext();
  if(intent==="quote"){
    return `Quote draft created from AI command.

Customer: ${ctx.customer || "Add customer"}
Truck/VIN: ${ctx.truck || "Add truck"} ${ctx.vin || ""}
Engine: ${ctx.engine || "Unknown"}
Request: ${text}

Labor Rate: ${money(ctx.laborRate)}/hr
Service Call: ${money(ctx.serviceCall)}

Disclaimer:
${quoteLegalText ? quoteLegalText() : "Price may vary based on actual repair requirements."}`;
  }
  if(intent==="invoice"){
    return `Professional invoice work performed:

${text}

Complaint/Cause/Correction:
Customer concern was documented. Work was performed as described. Final checks completed as applicable.

Payment due upon receipt unless otherwise agreed.`;
  }
  if(intent==="diagnostic"){
    return `Diagnostic workflow for: ${text}

1. Confirm active/inactive status.
2. Record module, SPN/FMI, occurrence count.
3. Check power, ground, datalink, connectors, and harness rub points.
4. Compare live data to expected values.
5. Test related sensors/actuators before replacing parts.
6. Verify repair with road test or regen/test procedure.

Save to Fault Doctor or Repair Memory when complete.`;
  }
  if(intent==="parts"){
    return `Parts workflow for: ${text}

Exact part number must be verified by VIN/OEM/supplier before quoting.
Save to Parts Lookup and Supplier Pricing.
Add location, price, availability, and alternate numbers.`;
  }
  if(intent==="memory"){
    return `Repair Memory draft:

Problem:
${text}

Cause:
Add verified cause.

Correction:
Add final repair.

Keywords:
${text.split(/\s+/).filter(w=>w.length>3).slice(0,10).join(", ")}`;
  }
  return `Rolling Wrench AI received:

${text}

I can route this to quotes, invoices, work orders, parts, diagnostics, repair memory, schedule, customer messages, OCR/vision, or truck history.`;
}
async function brainBackendAnswer(text){
  if(state.brainSettings.useBackend && state.backend?.aiEndpoint){
    try{
      return await v66AskRealAi(text);
    }catch(e){
      return brainBuildProfessionalText(brainIntent(text),text) + `\n\nBackend AI failed: ${e.message}`;
    }
  }
  return brainBuildProfessionalText(brainIntent(text),text);
}
function brainRouteAction(intent,text,answer){
  const ctx=brainContext();
  let route="ai";
  if(intent==="quote"){
    state.quotes.unshift({customer:ctx.customer,truck:ctx.truck,desc:answer,total:0,status:"Draft",date:new Date().toLocaleString(),ai:true});
    route="quotes"; brainLog("Quote Created",text);
  }else if(intent==="invoice"){
    state.invoices.unshift({customer:ctx.customer,truck:ctx.truck,work:answer,total:0,status:"Draft",date:new Date().toLocaleString(),ai:true});
    route="invoices"; brainLog("Invoice Created",text);
  }else if(intent==="workorder"){
    state.workorders.unshift({customer:ctx.customer,truck:ctx.truck,desc:text,status:"Open",date:new Date().toLocaleString(),ai:true});
    route="workorders"; brainLog("Work Order Created",text);
  }else if(intent==="memory"){
    ensureV691();
    state.repairMemory.unshift({id:"MEM-AI-"+Date.now(),title:text.slice(0,50)||"AI Memory",complaint:text,cause:"",correction:"",customer:ctx.customer,truck:ctx.truck,vin:ctx.vin,engine:ctx.engine,keywords:text,status:"Saved",date:new Date().toLocaleString(),ai:true});
    route="memorylibrary"; brainLog("Repair Memory Saved",text);
  }else if(intent==="diagnostic"){
    state.notes.unshift({type:"AI Diagnostic",note:answer,date:new Date().toLocaleString()});
    route="fault"; brainLog("Diagnostic Saved",text);
  }else if(intent==="parts"){
    state.parts.unshift({query:text,notes:answer,date:new Date().toLocaleString(),ai:true});
    route="parts"; brainLog("Parts Note Saved",text);
  }else if(intent==="vision"){
    route="vision"; brainLog("Vision Routed",text);
  }else if(intent==="schedule"){
    state.schedule.unshift({date:"",time:"",customer:ctx.customer,truck:ctx.truck,job:text,tech:"",ai:true});
    route="schedule"; brainLog("Schedule Draft Created",text);
  }else if(intent==="communication"){
    route="communications"; brainLog("Communication Routed",text);
  }else if(intent==="truck"){
    addTruckHistory("AI Note",answer);
    route="truck"; brainLog("Truck History Updated",text);
  }else if(intent==="customer"){
    route="customers"; brainLog("Customer Routed",text);
  }else{
    state.notes.unshift({type:"AI Brain",note:answer,date:new Date().toLocaleString()});
    brainLog("AI Note Saved",text);
  }
  saveState();
  return route;
}
function renderBrain(){
  ensureV70();
  const ctx=brainContext();
  $("#screen").innerHTML=`${pageHead("RW AI Brain","saveBrainSettings")}
  <section class="brain-hero"><b>Rolling Wrench AI Brain</b><small>One command box controls quotes, invoices, work orders, diagnostics, parts, OCR/vision, repair memory, customers, trucks, schedule, and messages.</small></section>
  <section class="brain-context">
    <div><b>Customer</b><span>${ctx.customer || "None"}</span></div>
    <div><b>Truck / VIN</b><span>${ctx.truck || "None"} ${ctx.vin || ""}</span></div>
    <div><b>Engine</b><span>${ctx.engine || "Unknown"}</span></div>
    <div><b>Rates</b><span>${money(ctx.laborRate)}/hr • ${money(ctx.serviceCall)} call</span></div>
  </section>
  <section class="brain-command-grid">
    <button class="brain-command" data-brain-prompt="Build quote for X15 water pump"><b>Build Quote</b><small>AI creates estimate</small></button>
    <button class="brain-command" data-brain-prompt="Build invoice for replaced water pump and belt"><b>Build Invoice</b><small>Professional wording</small></button>
    <button class="brain-command" data-brain-prompt="Diagnose SPN 3364 FMI 2"><b>Fault Doctor</b><small>SPN/FMI workflow</small></button>
    <button class="brain-command" data-route="vision"><b>Scan Photo</b><small>VIN / parts / invoice / fault</small></button>
  </section>
  <section class="brain-chat" id="brainChat">
    ${(state.brainChats||[]).map(m=>`<div class="brain-msg ${m.role}"><b>${m.role==="user"?"You":"RW AI"}</b>${m.text}</div>`).join("") || `<div class="brain-msg ai"><b>RW AI</b>Ask me to build a quote, invoice, work order, diagnose a fault, search repair memory, read a VIN/part label, or message a customer.</div>`}
  </section>
  <section class="brain-input-row">
    <button id="brainMic">🎙</button>
    <input id="brainInput" placeholder="Ask Rolling Wrench AI anything..." />
    <button id="brainAttach">+</button>
    <button class="send" id="brainSend">Send</button>
  </section>
  <section class="settings-section">
    <h3>Action Log</h3>
    <div class="brain-action-log">${(state.brainActions||[]).map(a=>`${a.date} — ${a.action}: ${a.detail}`).join("\n") || "No AI actions yet."}</div>
  </section>`;
  bindPageTools();
  async function runBrain(text){
    if(!text) return;
    state.brainChats.push({role:"user",text,date:new Date().toLocaleString()});
    $("#brainChat").innerHTML += `<div class="brain-msg user"><b>You</b>${text}</div>`;
    const intent=brainIntent(text);
    const answer=await brainBackendAnswer(text);
    state.brainChats.push({role:"ai",text:answer,date:new Date().toLocaleString(),intent});
    const route=state.brainSettings.autoRoute ? brainRouteAction(intent,text,answer) : "brain";
    saveState();
    renderBrain();
    toast(`AI routed: ${intent}`);
  }
  $("#brainSend").onclick=()=>runBrain($("#brainInput").value);
  $("#brainInput").onkeydown=e=>{if(e.key==="Enter") runBrain($("#brainInput").value);};
  $("#brainMic").onclick=()=>{if(typeof startVoiceToField==="function") startVoiceToField("brainInput"); else toast("Voice not available");};
  $("#brainAttach").onclick=()=>setRoute("vision");
  $$("[data-brain-prompt]").forEach(b=>b.onclick=()=>runBrain(b.dataset.brainPrompt));
  $("#saveBrainSettings").onclick=()=>{saveState();toast("AI Brain saved");};
}
function renderBrainSettings(){
  ensureV70();
  $("#screen").innerHTML=`${pageHead("AI Brain Settings","saveBrainSettings2")}
  <section class="form-panel form-grid">
    <label>AI Endpoint<input id="brainAiEndpoint" value="${state.backend?.aiEndpoint||""}" placeholder="https://your-ai-backend"></label>
    <label>AI Key<input id="brainAiKey" value="${state.backend?.aiKey||""}"></label>
    <label>OCR/Vision Endpoint<input id="brainOcrEndpoint" value="${state.backend?.ocrEndpoint||""}"></label>
    <label>OCR Key<input id="brainOcrKey" value="${state.backend?.ocrKey||""}"></label>
    <label>Auto Route<select id="brainAutoRoute"><option ${state.brainSettings.autoRoute?"selected":""}>On</option><option ${!state.brainSettings.autoRoute?"selected":""}>Off</option></select></label>
    <label>Use Backend<select id="brainUseBackend"><option ${state.brainSettings.useBackend?"selected":""}>On</option><option ${!state.brainSettings.useBackend?"selected":""}>Off</option></select></label>
    <div class="output">When backend is empty, RW AI Brain uses local smart workflow. When backend endpoint is added, commands go to real AI service.</div>
  </section>`;
  bindPageTools();
  $("#saveBrainSettings2").onclick=()=>{state.backend=state.backend||{};state.backend.aiEndpoint=$("#brainAiEndpoint").value;state.backend.aiKey=$("#brainAiKey").value;state.backend.ocrEndpoint=$("#brainOcrEndpoint").value;state.backend.ocrKey=$("#brainOcrKey").value;state.brainSettings.autoRoute=$("#brainAutoRoute").value==="On";state.brainSettings.useBackend=$("#brainUseBackend").value==="On";saveState();toast("Brain settings saved");};
}


function brainLine(text){
  return (text || "").replace(/\\n/g,"\n");
}
function v71StrongQuote(text){
  const ctx=brainContext();
  const q=text.toLowerCase();
  let labor="8-12";
  if(q.includes("clutch")) labor="10-12";
  if(q.includes("water pump")) labor="3-5";
  if(q.includes("wheel seal")) labor="2-3";
  if(q.includes("aftertreatment") || q.includes("dpf")) labor="2-6 diagnostic / repair varies";
  const rate=Number(ctx.laborRate||135);
  const hrs=parseFloat(String(labor).split("-")[0]) || 0;
  const laborLow=hrs*rate;
  return `SMART QUOTE DRAFT

Customer:
${ctx.customer || "Add customer"}

Truck:
${ctx.truck || "Add truck"} ${ctx.vin || ""}

Engine:
${ctx.engine || "From request / verify"}

Job Requested:
${text}

Suggested Labor:
${labor} hours

Labor Rate:
${money(rate)}/hr

Estimated Labor:
${money(laborLow)}+ depending on actual hours

Service Call:
${money(ctx.serviceCall || 250)}

Parts:
Verify exact parts by VIN / supplier before quoting.
Add clutch kit, bearings, hardware, fluids, seals, or related parts as needed.

Notes:
This quote was generated by Rolling Wrench AI and needs final review before sending.

Price Disclaimer:
${typeof quoteLegalText==="function" ? quoteLegalText() : "Price may vary based on actual repair requirements, parts, seized fasteners, hidden damage, and additional approved repairs."}

Action:
Quote has been drafted and can be reviewed in Smart Quotes.`;
}
function v71StrongInvoice(text){
  const ctx=brainContext();
  return `PROFESSIONAL INVOICE DRAFT

Customer:
${ctx.customer || "Add customer"}

Truck:
${ctx.truck || "Add truck"} ${ctx.vin || ""}

Work Performed:
${text}

Professional Description:
Customer concern was documented. Repair was performed as described. Related components were inspected where accessible. Final check completed to verify repair operation as applicable.

Labor Rate:
${money(ctx.laborRate || 135)}/hr

Service Call:
${money(ctx.serviceCall || 250)}

Payment Terms:
Payment due upon receipt unless otherwise agreed. Additional fees may apply for card processing, supplies, taxes, or approved additional work.

Action:
Invoice draft has been created for review.`;
}
function v71StrongDiagnostic(text){
  return `DIESEL DIAGNOSTIC WORKFLOW

Concern / Code:
${text}

Step 1 — Confirm
Verify active/inactive status, module reporting, occurrence count, and freeze frame data.

Step 2 — Visual
Inspect harness routing, connectors, rubbed wires, loose pins, corrosion, sensor damage, air leaks, exhaust leaks, coolant/oil contamination, and recent repairs.

Step 3 — Electrical
Check powers, grounds, reference voltage, signal return, resistance, shorts to power/ground, and datalink integrity.

Step 4 — Live Data
Compare commanded vs actual values. Look for sensors stuck high/low, slow response, or values that do not match operating conditions.

Step 5 — Mechanical
Confirm mechanical cause before replacing parts. Check restrictions, leaks, plugged tubes, actuator movement, pressure/temperature differences, and system operation.

Step 6 — Verify
Clear codes, run functional test/regen/road test as required, and document final readings.

Action:
Saved as diagnostic workflow and can be moved to Repair Memory.`;
}
function v71Answer(text){
  const intent=brainIntent(text);
  if(intent==="quote") return v71StrongQuote(text);
  if(intent==="invoice") return v71StrongInvoice(text);
  if(intent==="diagnostic") return v71StrongDiagnostic(text);
  if(intent==="parts") return brainBuildProfessionalText(intent,text);
  if(intent==="memory") return brainBuildProfessionalText(intent,text);
  return brainBuildProfessionalText(intent,text);
}
async function v71BrainAnswer(text){
  if(state.brainSettings?.useBackend && state.backend?.aiEndpoint){
    try{return brainLine(await v66AskRealAi(text));}
    catch(e){return v71Answer(text)+`\n\nBackend note: ${e.message}`;}
  }
  return v71Answer(text);
}
function renderBrainFull(){
  ensureV70();
  const ctx=brainContext();
  const hasTruck=!!(ctx.truck || ctx.vin || ctx.customer);
  $("#screen").innerHTML=`${pageHead("Ask Rolling Wrench AI","saveBrainSettings")}
  <section class="ai-fullscreen">
    <div class="ai-top-context">
      <b>Rolling Wrench AI</b>
      <small>Customer: ${ctx.customer || "None"} • Truck: ${ctx.truck || "None"} • VIN: ${ctx.vin || "None"} • Engine: ${ctx.engine || "Unknown"}</small>
    </div>
    ${!hasTruck ? `<div class="ai-warning">No active truck/customer loaded. AI can still draft, but quote/invoice accuracy improves after loading Truck Profile.</div>` : ""}
    <div class="ai-command-chips">
      <button data-ai-chip="Build a clutch quote for a 2014 Peterbilt with an ISX">Clutch Quote</button>
      <button data-ai-chip="Build invoice for replacing water pump and belt">Water Pump Invoice</button>
      <button data-ai-chip="Diagnose SPN 3364 FMI 2">SPN/FMI</button>
      <button data-ai-chip="Save repair memory for X15 overheating during regen">Save Memory</button>
      <button data-route="vision">Scan Photo</button>
    </div>
    <div class="ai-chat-full" id="aiChatFull">
      ${(state.brainChats||[]).map(m=>`<div class="ai-bubble ${m.role==="user"?"user":"bot"}"><b>${m.role==="user"?"You":"Rolling Wrench AI"}</b>${brainLine(m.text)}</div>`).join("") || `<div class="ai-bubble bot"><b>Rolling Wrench AI</b>Ask me to build a quote, create an invoice, diagnose a fault code, read a VIN/photo, find parts, save repair memory, or message a customer.</div>`}
    </div>
    <div class="ai-compose">
      <button id="aiPlus" class="attach">+</button>
      <input id="aiFullInput" placeholder="Ask Rolling Wrench AI anything..." />
      <button id="aiMic">🎙</button>
      <button id="aiFullSend" class="send">➤</button>
    </div>
    <div class="ai-output-actions">
      <button data-route="quotes">Open Quotes</button>
      <button data-route="invoices">Open Invoices</button>
      <button data-route="memorylibrary">Repair Memory</button>
    </div>
  </section>`;
  bindPageTools();
  const box=$("#aiChatFull");
  if(box) box.scrollTop=box.scrollHeight;
  async function run(text){
    text=(text||"").trim();
    if(!text) return;
    state.brainChats.push({role:"user",text,date:new Date().toLocaleString()});
    const answer=await v71BrainAnswer(text);
    const intent=brainIntent(text);
    state.brainChats.push({role:"ai",text:answer,date:new Date().toLocaleString(),intent});
    brainRouteAction(intent,text,answer);
    saveState();
    renderBrainFull();
  }
  $("#aiFullSend").onclick=()=>run($("#aiFullInput").value);
  $("#aiFullInput").onkeydown=e=>{if(e.key==="Enter")run($("#aiFullInput").value);};
  $("#aiMic").onclick=()=>{if(typeof startVoiceToField==="function") startVoiceToField("aiFullInput"); else toast("Voice not available");};
  $("#aiPlus").onclick=()=>setRoute("vision");
  $$("[data-ai-chip]").forEach(b=>b.onclick=()=>run(b.dataset.aiChip));
  $("#saveBrainSettings").onclick=()=>{saveState();toast("AI Brain saved");};
}


function v71aSanitize(text){
  return (text || "").replace(/\\n/g,"\n");
}
function v71aQuoteForRequest(text){
  const ctx = brainContext ? brainContext() : {};
  const q = (text || "").toLowerCase();
  const isClutch = q.includes("clutch");
  const isPeterbilt = q.includes("peterbilt");
  const isISX = q.includes("isx");
  const rate = Number(ctx.laborRate || 135);
  const serviceCall = Number(ctx.serviceCall || 250);
  let hours = 11.5;
  let partsText = "Parts price/location to be verified before final approval";
  let partsList = "Clutch kit\nPilot bearing\nRelease bearing / throwout bearing\nFlywheel inspection / resurface or replacement if needed\nTransmission fluid if needed\nShop supplies";
  if(!isClutch){
    hours = q.includes("water pump") ? 4.0 : 3.0;
    partsList = "Parts to be verified by VIN and supplier before final approval";
  }
  const labor = hours * rate;
  const supplies = isClutch ? 45 : 25;
  const total = labor + serviceCall + supplies;
  const truckLine = isPeterbilt ? "2014 Peterbilt" : (ctx.truck || "Truck to verify");
  const engineLine = isISX ? "Cummins ISX" : (ctx.engine || "Engine to verify");

  return {
    customer: ctx.customer || "",
    truck: `${truckLine} ${ctx.vin || ""}`.trim(),
    desc: text,
    hours,
    rate,
    serviceCall,
    parts: partsList,
    partsSource: partsText,
    subtotal: total,
    total,
    status:"Draft",
    ai:true,
    date:new Date().toLocaleString(),
    professionalText:
`SMART QUOTE — CLUTCH REPAIR

Customer:
${ctx.customer || "Add customer"}

Truck:
${truckLine}

Engine:
${engineLine}

Job:
${text}

Labor:
${hours} hours @ ${money(rate)}/hr = ${money(labor)}

Service Call:
${money(serviceCall)}

Parts:
${partsList}

Parts Source:
${partsText}

Estimated Total:
${money(total)}

Estimate Disclaimer:
Estimate only. Final price may increase or decrease based on additional labor, seized/broken hardware, hidden damage, diagnostic findings, parts availability, freight, shop supplies, taxes/fees, travel, or extra time required to complete the repair. Customer approval required before additional work is performed. Parts pricing and availability may change until purchased.`
  };
}
async function v71aBrainAnswer(text){
  const intent = brainIntent(text);
  if(intent === "quote"){
    return v71aQuoteForRequest(text).professionalText;
  }
  if(intent === "invoice"){
    return v71StrongInvoice ? v71StrongInvoice(text) : brainBuildProfessionalText(intent,text);
  }
  if(intent === "diagnostic"){
    return v71StrongDiagnostic ? v71StrongDiagnostic(text) : brainBuildProfessionalText(intent,text);
  }
  if(state.brainSettings?.useBackend && state.backend?.aiEndpoint){
    try{return v71aSanitize(await v66AskRealAi(text));}
    catch(e){return v71aSanitize(brainBuildProfessionalText(intent,text)) + "\n\nBackend note: " + e.message;}
  }
  return v71aSanitize(brainBuildProfessionalText(intent,text));
}
function v71aRouteAction(intent,text,answer){
  const ctx = brainContext ? brainContext() : {};
  let route = "brain";
  if(intent === "quote"){
    const q = v71aQuoteForRequest(text);
    state.quotes.unshift(q);
    brainLog("Exact Quote Created", text);
    route = "quotes";
  }else if(intent === "invoice"){
    state.invoices.unshift({customer:ctx.customer,truck:ctx.truck,work:answer,total:0,status:"Draft",date:new Date().toLocaleString(),ai:true});
    brainLog("Invoice Created", text);
    route = "invoices";
  }else if(intent === "workorder"){
    state.workorders.unshift({customer:ctx.customer,truck:ctx.truck,desc:text,status:"Open",date:new Date().toLocaleString(),ai:true});
    brainLog("Work Order Created", text);
    route = "workorders";
  }else if(intent === "memory"){
    ensureV691();
    state.repairMemory.unshift({id:"MEM-AI-"+Date.now(),title:text.slice(0,50)||"AI Memory",complaint:text,cause:"",correction:"",customer:ctx.customer,truck:ctx.truck,vin:ctx.vin,engine:ctx.engine,keywords:text,status:"Saved",date:new Date().toLocaleString(),ai:true});
    brainLog("Repair Memory Saved", text);
    route = "memorylibrary";
  }else if(intent === "parts"){
    state.parts.unshift({query:text,notes:answer,date:new Date().toLocaleString(),ai:true});
    brainLog("Parts Saved", text);
    route = "parts";
  }else if(intent === "diagnostic"){
    state.notes.unshift({type:"AI Diagnostic",note:answer,date:new Date().toLocaleString()});
    brainLog("Diagnostic Saved", text);
    route = "fault";
  }else if(intent === "vision"){
    brainLog("Vision Routed", text);
    route = "vision";
  }else{
    state.notes.unshift({type:"AI Brain",note:answer,date:new Date().toLocaleString()});
    brainLog("AI Note Saved", text);
  }
  saveState();
  return route;
}
function renderBrainChatGPT(){
  ensureV70();
  document.body.classList.add("ai-full-open");
  const ctx = brainContext ? brainContext() : {};
  const hasTruck = !!(ctx.truck || ctx.vin || ctx.customer);
  $("#screen").innerHTML = `<section class="ai-chatgpt-shell">
    <div class="ai-chatgpt-header">
      <div class="ai-chatgpt-title">
        <div class="ai-chatgpt-logo">RW</div>
        <div><b>Ask Rolling Wrench AI</b><small>Chat • voice • photos • quotes • invoices • diagnostics</small></div>
      </div>
      <button class="ai-close-btn" id="aiClose">Close</button>
    </div>
    ${!hasTruck ? `<div class="ai-context-warning">No active truck/customer loaded. I can still build drafts, but VIN-based parts and exact pricing need a truck profile.</div>` : ""}
    <div class="ai-chatgpt-tools">
      <button data-ai-chip="Build a clutch quote for a 2014 Peterbilt with an ISX">Clutch quote</button>
      <button data-ai-chip="Build invoice for replacing water pump and belt">Invoice</button>
      <button data-ai-chip="Diagnose SPN 3364 FMI 2">Fault code</button>
      <button data-ai-chip="Save repair memory for X15 overheating during regen">Repair memory</button>
      <button data-route="vision">Scan photo</button>
    </div>
    <div class="ai-chatgpt-thread" id="aiThread">
      ${(state.brainChats||[]).map(m=>`<div class="ai-chatgpt-bubble ${m.role==="user"?"user":"bot"}"><b>${m.role==="user"?"You":"Rolling Wrench AI"}</b>${v71aSanitize(m.text)}</div>`).join("") || `<div class="ai-chatgpt-bubble bot"><b>Rolling Wrench AI</b>Ask anything. I can build quotes, invoices, work orders, repair memory, parts notes, diagnostic workflows, and open OCR/Vision for photos.</div>`}
    </div>
    <div class="ai-chatgpt-compose">
      <button class="attach" id="aiAttach">+</button>
      <input id="aiChatInput" placeholder="Ask Rolling Wrench AI anything..." />
      <button id="aiVoice">🎙</button>
      <button class="send" id="aiSend">➤</button>
    </div>
  </section>`;
  bindPageTools();
  const thread=$("#aiThread");
  if(thread) thread.scrollTop=thread.scrollHeight;
  async function run(text){
    text=(text||"").trim();
    if(!text) return;
    state.brainChats.push({role:"user",text,date:new Date().toLocaleString()});
    const intent=brainIntent(text);
    const answer=await v71aBrainAnswer(text);
    state.brainChats.push({role:"ai",text:answer,date:new Date().toLocaleString(),intent});
    v71aRouteAction(intent,text,answer);
    saveState();
    renderBrainChatGPT();
    toast(intent==="quote" ? "Exact quote created" : "AI saved");
  }
  $("#aiSend").onclick=()=>run($("#aiChatInput").value);
  $("#aiChatInput").onkeydown=e=>{if(e.key==="Enter")run($("#aiChatInput").value);};
  $("#aiVoice").onclick=()=>{if(typeof startVoiceToField==="function") startVoiceToField("aiChatInput"); else toast("Voice not available");};
  $("#aiAttach").onclick=()=>setRoute("vision");
  $("#aiClose").onclick=()=>{document.body.classList.remove("ai-full-open");document.body.classList.remove("rw-ai-mode");setRoute("home");};
  $$("[data-ai-chip]").forEach(b=>b.onclick=()=>run(b.dataset.aiChip));
}
function v71aPatchAiEntrypoints(){
  document.querySelectorAll('[data-route="ai"], [data-route="brain"]').forEach(el=>el.setAttribute("data-route","brain"));
}


function v72ShortReply(intent,text,quote){
  if(intent==="quote" && quote){
    return `I found a clutch replacement quote.\n\nLabor: ${quote.hours} hrs\nService Call: ${money(quote.serviceCall)}\nEstimated Total: ${money(quote.total)}\n\nI saved a quote draft.`;
  }
  if(intent==="invoice") return "I built an invoice draft and saved it to Invoices.";
  if(intent==="memory") return "I saved that to Repair Memory.";
  if(intent==="diagnostic") return "I built a diagnostic workflow and saved it to Fault Doctor notes.";
  if(intent==="parts") return "I saved a parts lookup note. Exact parts still need VIN/OEM verification.";
  return "I handled that command and saved it where it belongs.";
}
function v72LastQuote(){
  return (state.quotes||[]).find(q=>q.ai || q.status==="Draft") || (state.quotes||[])[0] || null;
}
function v72RenderQuoteCard(q){
  if(!q) return "";
  return `<div class="ai-v72-card">
    <h3>Clutch Quote Detected</h3>
    <div class="ai-v72-kpis">
      <div class="ai-v72-kpi"><small>Labor</small><b>${q.hours || "11.5"} hrs</b></div>
      <div class="ai-v72-kpi"><small>Service</small><b>${money(q.serviceCall || 250)}</b></div>
      <div class="ai-v72-kpi"><small>Total</small><b>${money(q.total || 0)}</b></div>
    </div>
    <div class="ai-v72-msg bot" style="max-width:100%;margin:0;">
      <b>Parts</b>${String(q.parts || "Clutch kit\nPilot bearing\nRelease bearing\nFlywheel inspection").replace(/\\n/g,"\n")}
    </div>
    <div class="ai-v72-actions">
      <button class="primary" data-v72-action="openQuote">Open Quote</button>
      <button data-v72-action="findParts">Find Parts</button>
      <button data-v72-action="sendQuote">Send Customer</button>
      <button data-v72-action="invoiceQuote">Build Invoice</button>
    </div>
  </div>`;
}
function v72PushMessage(role,text,kind,meta){
  state.brainChats = state.brainChats || [];
  state.brainChats.push({role,text,kind:kind||"",meta:meta||null,date:new Date().toLocaleString()});
  saveState();
}
function v72HandleFollowup(text){
  const q=(text||"").toLowerCase().trim();
  if(v72aIsClear(text)){
    state.brainChats=[];
    saveState();
    renderBrainV72();
    return true;
  }
  if(v72aIsSendToQuotes(text)){
    return v72aOpenLastQuote();
  }
  if(["send to invoice","open invoice","open invoices"].includes(q)){
    const quote=v72aLastQuote();
    if(quote){
      state.invoices.unshift({customer:quote.customer,truck:quote.truck,work:quote.desc,total:quote.total,status:"Draft",fromQuote:true,date:new Date().toLocaleString()});
      saveState();
    }
    setRoute("invoices");
    return true;
  }
  if(["find parts","parts"].includes(q)){
    setRoute("parts");
    return true;
  }
  return false;
}

function renderBrainV72(){
  ensureV70();
  document.body.classList.add("ai-lock");
  const ctx = brainContext ? brainContext() : {};
  $("#screen").innerHTML = `<section class="ai-v72-shell">
    <div class="ai-v72-head">
      <div class="ai-v72-title">
        <div class="ai-v72-logo">RW</div>
        <div><b>Ask Rolling Wrench AI</b><small>${ctx.customer || "No customer"} • ${ctx.truck || "No truck"} • ${ctx.engine || "Engine unknown"}</small></div>
      </div>
      <div class="ai-v72-head-actions"><button class="ai-v72-clear" id="v72Clear">Clear</button><button class="ai-v72-close" id="v72Close">Close</button></div>
    </div>
    <div class="ai-v72-scroll" id="v72Scroll">
      <div class="ai-v72-chiprow">
        <button data-v72-chip="Build a clutch quote for a 2014 Peterbilt with an ISX">Clutch Quote</button>
        <button data-v72-chip="Build invoice for replacing water pump and belt">Invoice</button>
        <button data-v72-chip="Diagnose SPN 3364 FMI 2">Fault Code</button>
        <button data-v72-chip="Save repair memory for X15 overheating during regen">Repair Memory</button>
        <button data-route="vision">Scan Photo</button>
      </div>
      ${(state.brainChats||[]).map(m=>{
        if(m.kind==="quote_card") return v72RenderQuoteCard(m.meta);
        return `<div class="ai-v72-msg ${m.role==="user"?"user":"bot"}"><b>${m.role==="user"?"You":"Rolling Wrench AI"}</b>${String(m.text||"").replace(/\\n/g,"\n")}</div>`;
      }).join("") || `<div class="ai-v72-msg bot"><b>Rolling Wrench AI</b>Ask anything. I’ll keep this chat clean and create quotes/invoices/work orders in their own screens.</div>`}
    </div>
    <div class="ai-v72-compose-wrap">
      <div class="ai-v72-compose">
        <button class="ai-v72-plus" id="v72Plus">+</button>
        <div class="ai-v72-inputbox">
          <input id="v72Input" placeholder="Ask Rolling Wrench AI anything..." />
          <button class="ai-v72-mic" id="v72Mic">🎙</button>
        </div>
        <button class="ai-v72-voice" id="v72Voice">▮▮</button>
        <button class="ai-v72-send" id="v72Send">➤</button>
      </div>
    </div>
  </section>`;
  bindPageTools();
  const sc=$("#v72Scroll");
  if(sc) sc.scrollTop=sc.scrollHeight;

  async function run(text){
    text=(text||"").trim();
    if(!text) return;
    if(v72HandleFollowup(text)) return;
    v72PushMessage("user",text);
    const intent=brainIntent(text);
    if(v72aIsSendToQuotes(text)){ v72aOpenLastQuote(); return; }
    if(intent==="quote"){
      const quote=v71aQuoteForRequest ? v71aQuoteForRequest(text) : {hours:11.5,serviceCall:250,total:1847.50,parts:"Clutch kit\nPilot bearing\nRelease bearing",desc:text,status:"Draft",ai:true,date:new Date().toLocaleString()};
      state.quotes.unshift(quote);
      v72PushMessage("ai",v72ShortReply(intent,text,quote));
      v72PushMessage("ai","quote-card","quote_card",quote);
      if(typeof brainLog==="function") brainLog("Quote Card Created", text);
      saveState();
      renderBrainV72();
      return;
    }
    const answer=typeof v71aBrainAnswer==="function" ? await v71aBrainAnswer(text) : (typeof brainBuildProfessionalText==="function" ? brainBuildProfessionalText(intent,text) : "Saved.");
    if(typeof v71aRouteAction==="function") v71aRouteAction(intent,text,answer);
    v72PushMessage("ai",v72ShortReply(intent,text,null));
    renderBrainV72();
  }

  $("#v72Send").onclick=()=>run($("#v72Input").value);
  $("#v72Input").onkeydown=e=>{if(e.key==="Enter")run($("#v72Input").value);};
  $("#v72Mic").onclick=()=>{if(typeof startVoiceToField==="function") startVoiceToField("v72Input"); else toast("Voice not available");};
  $("#v72Voice").onclick=()=>{if(typeof startVoiceToField==="function") startVoiceToField("v72Input"); else toast("Voice mode coming next");};
  $("#v72Plus").onclick=()=>setRoute("vision");
  $("#v72Clear").onclick=()=>{state.brainChats=[];saveState();toast("Chat cleared");renderBrainV72();};
  $("#v72Close").onclick=()=>{document.body.classList.remove("ai-lock");document.body.classList.remove("rw-ai-mode");setRoute("home");};
  $$("[data-v72-chip]").forEach(b=>b.onclick=()=>run(b.dataset.v72Chip));
  $$("[data-v72-action]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.v72Action;
    if(a==="openQuote") setRoute("quotes");
    if(a==="findParts") setRoute("parts");
    if(a==="sendQuote") setRoute("sendquotes");
    if(a==="invoiceQuote"){
      const quote=v72LastQuote();
      if(quote){ state.invoices.unshift({customer:quote.customer,truck:quote.truck,work:quote.desc,total:quote.total,status:"Draft",fromQuote:true,date:new Date().toLocaleString()}); saveState(); }
      setRoute("invoices");
    }
  });
}


function rw8Ensure(){ if(typeof ensureV70==="function") ensureV70(); state.rw8=state.rw8||{memory:{},lastCard:null}; state.brainChats=state.brainChats||[]; }
function rw8Clean(s){return String(s||"").replace(/\\n/g,"\n").trim();}
function rw8Context(){rw8Ensure();return{customer:state.rw8.memory.customer||state.truck?.customer||"",truck:state.rw8.memory.truck||state.truck?.unit||"",vin:state.rw8.memory.vin||state.truck?.vin||"",engine:state.rw8.memory.engine||state.truck?.engine||"",year:state.rw8.memory.year||"",make:state.rw8.memory.make||"",rate:Number(state.settings?.laborRate||state.settings?.rate||135),serviceCall:Number(state.settings?.serviceCall||250)}}
function rw8ExtractMemory(text){const t=String(text||""),low=t.toLowerCase(),year=(t.match(/\b(19|20)\d{2}\b/)||[])[0];const makes=["peterbilt","kenworth","freightliner","international","volvo","mack","western star","ford","chevy","gmc","ram"];const make=makes.find(m=>low.includes(m));let engine="";if(low.includes("isx"))engine="Cummins ISX";if(low.includes("x15"))engine="Cummins X15";if(low.includes("dd15"))engine="Detroit DD15";if(low.includes("dd13"))engine="Detroit DD13";if(low.includes("mx13")||low.includes("mx-13"))engine="PACCAR MX-13";if(year||make||engine){state.rw8.memory.year=year||state.rw8.memory.year||"";state.rw8.memory.make=make?make.replace(/\b\w/g,c=>c.toUpperCase()):state.rw8.memory.make||"";state.rw8.memory.engine=engine||state.rw8.memory.engine||"";state.rw8.memory.truck=[state.rw8.memory.year,state.rw8.memory.make].filter(Boolean).join(" ")||state.rw8.memory.truck||"";}saveState();}
function rw8Intent(text){const q=String(text||"").toLowerCase().trim();if(["clear","clear chat","new chat","reset"].includes(q))return"clear";if(["send to quotes","open quote","open quotes","save quote","go to quotes"].includes(q))return"open_quote";if(["find parts","parts"].includes(q))return"parts_action";if(["build invoice","open invoice","open invoices"].includes(q))return"invoice_action";if(q.includes("quote")||q.includes("estimate"))return"quote";if(q.includes("invoice")||q.includes("bill"))return"invoice";if(q.includes("spn")||q.includes("fmi")||q.includes("fault")||q.includes("code")||q.includes("diagnos"))return"diagnostic";if(q.includes("memory")||q.includes("save this fix")||q.includes("seen this before"))return"memory";if(q.includes("part")||q.includes("supplier")||q.includes("price"))return"parts";if(q.includes("photo")||q.includes("picture")||q.includes("scan")||q.includes("vin plate"))return"vision";return"general";}
function rw8Quote(text){const ctx=rw8Context(),low=String(text).toLowerCase();let hours=3,title="Repair Quote",parts="Parts to be verified by VIN and supplier before final approval";if(low.includes("clutch")){hours=11.5;title="Clutch Replacement";parts="Clutch kit\nPilot bearing\nRelease bearing / throwout bearing\nFlywheel inspection / resurface or replacement if needed\nTransmission fluid if needed\nShop supplies";}else if(low.includes("water pump")){hours=4;title="Water Pump Replacement";parts="Water pump\nBelt if needed\nCoolant\nGaskets / seals\nShop supplies";}else if(low.includes("wheel seal")){hours=2.5;title="Wheel Seal Repair";parts="Wheel seal\nHub oil\nBrake clean\nPossible bearings if damaged";}const labor=hours*ctx.rate,service=ctx.serviceCall,supplies=low.includes("clutch")?45:25,total=labor+service+supplies;return{customer:ctx.customer,truck:ctx.truck||[ctx.year,ctx.make].filter(Boolean).join(" "),engine:ctx.engine,desc:text,title,hours,rate:ctx.rate,serviceCall:service,supplies,parts,partsSource:"Parts price/location to be verified before final approval",subtotal:total,total,status:"Draft",ai:true,date:new Date().toLocaleString(),professionalText:`${title}\n\nTruck: ${ctx.truck||"Verify truck"}\nEngine: ${ctx.engine||"Verify engine"}\nLabor: ${hours} hrs @ ${money(ctx.rate)}/hr\nService Call: ${money(service)}\nEstimated Total: ${money(total)}\n\nParts:\n${parts}`};}
function rw8Push(role,text,kind,meta){state.brainChats.push({role,text:rw8Clean(text),kind:kind||"",meta:meta||null,date:new Date().toLocaleString()});saveState();}
function rw8RenderCard(card){if(!card)return"";if(card.type==="quote"){const q=card.quote;return `<div class="rw8-card"><h3>${q.title||"Quote Detected"}</h3><div class="rw8-kpis"><div class="rw8-kpi"><small>Labor</small><b>${q.hours} hrs</b></div><div class="rw8-kpi"><small>Service</small><b>${money(q.serviceCall)}</b></div><div class="rw8-kpi"><small>Total</small><b>${money(q.total)}</b></div></div><div class="rw8-msg ai" style="max-width:100%;margin:0;"><b>Parts</b>${q.parts}</div><div class="rw8-actions"><button class="primary" data-rw8-action="openQuote">Open Quote</button><button data-rw8-action="findParts">Find Parts</button><button data-rw8-action="sendQuote">Send Customer</button><button data-rw8-action="invoiceQuote">Build Invoice</button></div></div>`;}if(card.type==="diagnostic"){return `<div class="rw8-card"><h3>Diagnostic Interview</h3><div class="rw8-msg ai" style="max-width:100%;margin:0;"><b>Next Questions</b>${card.text}</div><div class="rw8-actions"><button class="primary" data-rw8-action="saveMemory">Save Memory</button><button data-rw8-action="openFault">Open Fault Doctor</button></div></div>`;}return"";}
function rw8Diagnostic(text){return`I can help diagnose that.\n\nAnswer these:\n1. Is the code active or inactive?\n2. What engine and truck?\n3. Any recent repair?\n4. What are the live data readings?\n5. Does it happen loaded, idle, regen, or driving?\n\nThen I’ll narrow it down step by step.`;}
async function rw8Run(text){rw8Ensure();text=String(text||"").trim();if(!text)return;const intent=rw8Intent(text);if(intent==="clear"){state.brainChats=[];saveState();renderRW8Brain();return;}if(intent==="open_quote"){setRoute("quotes");return;}if(intent==="parts_action"){setRoute("parts");return;}if(intent==="invoice_action"){setRoute("invoices");return;}rw8ExtractMemory(text);rw8Push("user",text);if(intent==="quote"){const q=rw8Quote(text);state.quotes.unshift(q);state.rw8.lastCard={type:"quote",quote:q};saveState();rw8Push("ai",`I found a ${q.title.toLowerCase()}.\n\nLabor: ${q.hours} hrs\nEstimated Total: ${money(q.total)}\n\nI saved a quote draft.`);rw8Push("ai","quote card","card",state.rw8.lastCard);}else if(intent==="diagnostic"){const d=rw8Diagnostic(text);state.notes.unshift({type:"AI Diagnostic",note:d,date:new Date().toLocaleString()});state.rw8.lastCard={type:"diagnostic",text:d};saveState();rw8Push("ai",d,"card",state.rw8.lastCard);}else if(intent==="invoice"){const ctx=rw8Context();state.invoices.unshift({customer:ctx.customer,truck:ctx.truck,work:text,total:0,status:"Draft",ai:true,date:new Date().toLocaleString()});saveState();rw8Push("ai","I built an invoice draft and saved it to Invoices.");}else if(intent==="memory"){const ctx=rw8Context();if(typeof ensureV691==="function")ensureV691();state.repairMemory.unshift({id:"MEM-RW8-"+Date.now(),title:text.slice(0,55),complaint:text,cause:"",correction:"",customer:ctx.customer,truck:ctx.truck,engine:ctx.engine,keywords:text,status:"Saved",date:new Date().toLocaleString(),ai:true});saveState();rw8Push("ai","Saved to Repair Memory.");}else if(intent==="vision"){rw8Push("ai","Open OCR/Vision and attach the photo. Once the real vision backend is connected, I’ll read the image like ChatGPT/Gemini.");}else{rw8Push("ai","Tell me what you need. I can answer repair questions, build invoice/quote previews, or use the backend AI when connected.");}renderRW8Brain();}

function rw8KeyboardSafeScroll(){
  setTimeout(()=>{
    const sc=$("#rw8Thread");
    if(sc) sc.scrollTop=sc.scrollHeight;
    const el=$("#rw8Input");
    if(el) el.scrollIntoView({block:"nearest", inline:"nearest"});
  },250);
}

function renderRW8Brain(){rw8Ensure();document.body.classList.add("rw-ai-mode");const ctx=rw8Context();$("#screen").innerHTML=`<section class="rw8-shell"><div class="rw8-head"><div class="rw8-brand"><div class="rw8-logo">RW</div><div><b>Rolling Wrench AI</b><small>${ctx.customer||"No customer"} • ${ctx.truck||"No truck"} • ${ctx.engine||"Engine unknown"}</small></div></div><div class="rw8-head-actions"><button class="rw8-clear" id="rw8Clear">Clear</button><button id="rw8Close">Close</button></div></div><div class="rw8-thread" id="rw8Thread"><div class="rw8-chips"><button data-rw8-chip="Build a clutch quote for a 2014 Peterbilt with an ISX">Clutch quote</button><button data-rw8-chip="Diagnose SPN 3364 FMI 2">Fault code</button><button data-rw8-chip="Build invoice for replaced water pump and belt">Invoice</button><button data-rw8-chip="Save repair memory for X15 overheating during regen">Memory</button><button data-route="vision">Photo</button></div>${(state.brainChats||[]).map(m=>m.kind==="card"?rw8RenderCard(m.meta):`<div class="rw8-msg ${m.role==="user"?"user":"ai"}"><b>${m.role==="user"?"You":"RW AI"}</b>${rw8Clean(m.text)}</div>`).join("")||`<div class="rw8-msg ai"><b>RW AI</b>Ask me anything. I’ll keep the chat clean and use cards/buttons when something needs saved or opened.</div>`}</div><div class="rw8-compose-wrap"><div class="rw8-compose"><button class="rw8-plus" id="rw8Plus">+</button><div class="rw8-inputbox"><input id="rw8Input" placeholder="Ask Rolling Wrench AI anything..." /><button class="rw8-mic" id="rw8Mic">🎙</button></div><button class="rw8-send" id="rw8Send">➤</button></div></div></section>`;bindPageTools();const sc=$("#rw8Thread");if(sc)sc.scrollTop=sc.scrollHeight;$("#rw8Send").onclick=()=>rw8Run($("#rw8Input").value);
  $("#rw8Input").onfocus=()=>rw8KeyboardSafeScroll();
  $("#rw8Input").oninput=()=>rw8KeyboardSafeScroll();$("#rw8Input").onkeydown=e=>{if(e.key==="Enter")rw8Run($("#rw8Input").value);};$("#rw8Clear").onclick=()=>{state.brainChats=[];saveState();renderRW8Brain();};$("#rw8Close").onclick=()=>{document.body.classList.remove("rw-ai-mode");setRoute("home");};$("#rw8Plus").onclick=()=>setRoute("vision");$("#rw8Mic").onclick=()=>{if(typeof startVoiceToField==="function")startVoiceToField("rw8Input");else toast("Voice not available");};$$("[data-rw8-chip]").forEach(b=>b.onclick=()=>rw8Run(b.dataset.rw8Chip));$$("[data-rw8-action]").forEach(b=>b.onclick=()=>{const a=b.dataset.rw8Action,q=state.rw8.lastCard?.quote||(state.quotes||[])[0];if(a==="openQuote")setRoute("quotes");if(a==="findParts")setRoute("parts");if(a==="sendQuote")setRoute("sendquotes");if(a==="invoiceQuote"){if(q){state.invoices.unshift({customer:q.customer,truck:q.truck,work:q.desc,total:q.total,status:"Draft",fromQuote:true,date:new Date().toLocaleString()});saveState();}setRoute("invoices");}if(a==="saveMemory")setRoute("memorylibrary");if(a==="openFault")setRoute("fault");});}

const routes = { ai:renderRW8Brain, brain:renderRW8Brain,  
  home:renderHome, clock:renderClock, truck:renderTruck,  parts:renderParts, fault:renderFault,
  repairhud:renderRepairHud, quotes:renderQuotes, invoices:renderInvoices, workorders:renderWorkOrders,
  schedule:renderSchedule, customers:renderCustomers, pindrop:renderPinDrop, camera:renderCamera, reports:renderReports,
  memory:renderRepairMemoryLibrary, suppliers:renderSuppliers, pmdue:renderPmDue, settings:renderSettingsSafe, alerts:renderAlerts, workflow:renderWorkflowHub, pmmanager:renderPMManager, inventory:renderInventory, supplierpricing:renderSupplierPricing, notifications:renderNotifications, signin:renderSignInPreview, supabase:renderSupabaseSync, v52:renderV52Dashboard, dashboard:renderBusinessDashboard, aioperator:renderAIOperator, photointel:renderPhotoIntelligence, schedulecommand:renderScheduleCommand, customerportal:renderCustomerPortalHub, sendquotes:renderQuoteSendCenter, sendinvoices:renderInvoiceSendCenter, stability:renderStabilityCenter, externallinks:renderExternalLinksCenter, storageprep:renderStoragePrep, backend:renderBackendCenter, backendsetup:renderBackendSetup, communications:renderCommunicationCenter, templates:renderCommunicationTemplates, fileuploads:renderFileUploadCenter, filehistory:renderFileHistory, vision:renderVisionCenter, memorylibrary:renderRepairMemoryLibrary, cleanup:renderCleanupCenter,   brainsettings:renderBrainSettings, visionsettings:renderVisionSettings, portalhub:renderCustomerPortalHub, techmode:renderTechMode, about:renderAboutLegal, login:renderLogin, account:renderAuthSettings, aiengine:renderAiEngine, realocr:renderRealOCR, filestorage:renderFileStorage, gpsmanager:renderGPSManager, repair:renderRepair, business:renderBusiness
};
function render(route=currentRoute()){
  try{
    ensureAuthV62();
    if(!route) route="home";
    if(route!=="login" && !authIsLoggedIn()){ renderLogin("signin"); return; }
    if(route!=="login" && !authCanAccess(route)){
      $("#screen").innerHTML = `<section class="locked-screen"><b>Access Restricted</b><p>Your role does not have access to ${route}.</p><button class="action-btn primary" data-route="home">Go Home</button></section>`;
      return;
    }
    if(route && route.startsWith("quoteapproval-")){ renderQuoteApprovalPortal(route.replace("quoteapproval-","")); return; }
    if(route && route.startsWith("invoiceportal-")){ renderInvoicePortal(route.replace("invoiceportal-","")); return; }
    if(route !== "brain" && route !== "ai"){ document.body.classList.remove("ai-full-open");document.body.classList.remove("rw-ai-mode"); document.body.classList.remove("ai-lock");document.body.classList.remove("rw-ai-mode"); }
    const fn=routes[route] || renderHome;
    fn();
    $$(".bottom-nav button").forEach(b=>b.classList.toggle("active", b.dataset.route===route || (route==="home" && b.dataset.route==="home")));
  }catch(err){
    console.error(err);
    if(route==="settings" && typeof renderSettingsSafe==="function") renderSettingsSafe();
    else if(typeof renderSafeError==="function") renderSafeError(route, err);
    else $("#screen").innerHTML = `<section class="error-panel"><b>Error</b><small>${err.message}</small></section>`;
  }
}

document.addEventListener("click", e=>{
  const r=e.target.closest("[data-route]");
  if(r){ e.preventDefault(); setRoute(r.dataset.route); return; }
  const c=e.target.closest("[data-clock]");
  if(c){
    const id=c.dataset.job, action=c.dataset.clock, j=state.jobs[id];
    updateJobInputs(id);
    if(action==="start"){ startContinuousJob(id); }
    if(action==="pause"){ pauseContinuousJob(id); }
    if(action==="stop"){ stopContinuousJob(id); }
    if(action==="clear"){ clearContinuousJob(id); }
    if(action==="save"){ saveContinuousClock(id); }
    if(action==="toWO"){ 
      state.workorders.push({customer:j.customer || state.truck.customer, truck:state.truck.unit, desc:`${j.name} - clock labor ${formatTime(currentJobSeconds(j))}`, status:"Open", clockSeconds:currentJobSeconds(j), date:new Date().toLocaleString()});
      addTruckHistory("Clock to Work Order", `${j.name} ${formatTime(currentJobSeconds(j))}`);
      toast("Clock sent to work order");
    }
    if(action==="toInvoice"){
      state.invoices.push({customer:j.customer || state.truck.customer, truck:state.truck.unit, work:`${j.name} - labor time ${formatTime(currentJobSeconds(j))}`, total:clockDollars(currentJobSeconds(j)), clockSeconds:currentJobSeconds(j), date:new Date().toLocaleString()});
      addTruckHistory("Clock to Invoice", `${j.name} ${formatTime(currentJobSeconds(j))} ${money(clockDollars(currentJobSeconds(j)))}`);
      toast("Clock sent to invoice");
    }
    saveState(); renderClock(); return;
  }
});
window.addEventListener("hashchange",()=>render());
setInterval(()=>{
  let changed=false;
  changed = Object.values(state.jobs).some(j=>j.running);
  if(changed){
    saveState();
    if(currentRoute()==="home" || currentRoute()==="clock") ensureV46();
ensureSettingsV48();
ensureV5();
ensureSupabaseConfigured();
applyUiSettings();
if(document.getElementById('alertCount')) document.getElementById('alertCount').textContent = (state.alerts||[]).filter(a=>!a.read).length;
render(currentRoute());
  }
},1000);

ensureV46();
ensureSettingsV48();
ensureV5();
ensureSupabaseConfigured();
applyUiSettings();
if(document.getElementById('alertCount')) document.getElementById('alertCount').textContent = (state.alerts||[]).filter(a=>!a.read).length;

function renderSafeError(route, err){
  const screenEl = document.getElementById("screen");
  if(!screenEl) return;
  screenEl.innerHTML = `<section class="error-panel">
    <b>Screen Load Error</b>
    <p>${route} did not load correctly.</p>
    <small>${err && err.message ? err.message : err}</small>
    <div class="smart-action-row">
      <button class="action-btn primary" data-route="home">Go Home</button>
      <button class="action-btn" data-route="settings">Open Settings</button>
    </div>
  </section>`;
}
function renderSettingsSafe(){
  if(typeof ensureV46 === "function") ensureV46();
  if(typeof ensureV5 === "function") ensureV5();
  if(typeof ensureSettingsV48 === "function") ensureSettingsV48();
  state.settings = state.settings || {};
  state.ui = state.ui || {};
  state.pricing = state.pricing || {};
  state.employees = state.employees || [];
  state.alertSettings = state.alertSettings || {};
  state.soundSettings = state.soundSettings || {};
  state.aiSettings = state.aiSettings || {};
  state.ocrSettings = state.ocrSettings || {};
  state.security = state.security || {};
  state.supabase = state.supabase || {};
  document.getElementById("screen").innerHTML = `${pageHead("Settings","safeSaveSettings")}
    <section class="settings-section form-grid">
      <h3>Shop Settings</h3>
      <label>Shop Name<input id="safeShop" value="${state.settings.shop || "Rolling Wrench Diesel"}"></label>
      <label>Phone<input id="safePhone" value="${state.settings.phone || "260-502-6222"}"></label>
      <div class="two-col">
        <label>Labor Rate<input id="safeLabor" type="number" value="${state.settings.laborRate || state.pricing.mobileLabor || 135}"></label>
        <label>Service Call<input id="safeCall" type="number" value="${state.settings.serviceCall || state.pricing.serviceCall || 250}"></label>
      </div>
    </section>
    <section class="settings-section">
      <h3>Settings Control Center</h3>
      <div class="safe-settings-grid">
        <button class="safe-settings-card" data-safe-setting="themes"><b>Themes</b><small>Orange, green, blue, red, gray, light</small></button>
        <button class="safe-settings-card" data-safe-setting="pricing"><b>Pricing</b><small>Labor, service call, tax, fees</small></button>
        <button class="safe-settings-card" data-safe-setting="employees"><b>Employees</b><small>Techs, managers, rates</small></button>
        <button class="safe-settings-card" data-safe-setting="alerts"><b>Alerts</b><small>PM, schedule, invoice, quote</small></button>
        <button class="safe-settings-card" data-safe-setting="sounds"><b>Sounds</b><small>Voice, button, notification</small></button>
        <button class="safe-settings-card" data-safe-setting="display"><b>Display</b><small>Compact, large text, contrast</small></button>
        <button class="safe-settings-card" data-safe-setting="ai"><b>AI Settings</b><small>Voice, memory, conversations</small></button>
        <button class="safe-settings-card" data-safe-setting="cloud"><b>Cloud / Backup</b><small>Supabase, export, restore</small></button>
      </div>
    </section>
    <section class="settings-section" id="safeSettingsDetail">
      <h3>Details</h3>
      <div class="output">Tap a settings card above.</div>
    </section>`;
  bindPageTools();
  document.getElementById("safeSaveSettings").onclick=()=>{
    state.settings.shop=document.getElementById("safeShop").value;
    state.settings.phone=document.getElementById("safePhone").value;
    state.settings.laborRate=+document.getElementById("safeLabor").value || 135;
    state.settings.serviceCall=+document.getElementById("safeCall").value || 250;
    state.pricing = state.pricing || {};
    state.pricing.mobileLabor=state.settings.laborRate;
    state.pricing.serviceCall=state.settings.serviceCall;
    saveState();
    toast("Settings saved");
  };
  document.querySelectorAll("[data-safe-setting]").forEach(btn=>btn.onclick=()=>{
    const type=btn.dataset.safeSetting;
    const d=document.getElementById("safeSettingsDetail");
    if(type==="themes") d.innerHTML=`<h3>Themes</h3><div class="output">Theme controls are active in the full settings build. Current theme data is saved locally.</div>`;
    if(type==="pricing") d.innerHTML=`<h3>Pricing</h3><div class="output">Labor Rate: ${money(state.settings.laborRate || 135)}\nService Call: ${money(state.settings.serviceCall || 250)}</div>`;
    if(type==="employees") d.innerHTML=`<h3>Employees</h3><div class="output">${(state.employees||[]).map(e=>`${e.name || "Employee"} — ${e.role || ""}`).join("\\n") || "No employees saved."}</div>`;
    if(type==="alerts") d.innerHTML=`<h3>Alerts</h3><div class="output">PM alerts, schedule alerts, invoice alerts, quote follow-ups, clock alerts, truck service alerts.</div>`;
    if(type==="sounds") d.innerHTML=`<h3>Sounds</h3><div class="output">Button clicks, save confirmation, AI voice, notifications, clock in/out, volume.</div>`;
    if(type==="display") d.innerHTML=`<h3>Display</h3><div class="output">Compact mode, large text, high contrast, show/hide dashboard cards.</div>`;
    if(type==="ai") d.innerHTML=`<h3>AI Settings</h3><div class="output">AI voice, voice speed, voice type, auto read answers, save conversations, remember truck/customer.</div>`;
    if(type==="cloud") d.innerHTML=`<h3>Cloud / Backup</h3><div class="output">Supabase: ${(state.supabase && state.supabase.url) || "Not configured"}</div><button class="action-btn primary" data-route="supabase">Open Supabase Sync</button>`;
  });
}

render(currentRoute());
if("serviceWorker" in navigator){navigator.serviceWorker.register("./service-worker.js").catch(()=>{});}


/* ===== V8.5 STABLE SAFE STARTUP ===== */
function rwdV85NormalizeState(){
  try{
    window.state = window.state || {};
    state.settings = Object.assign({shop:"Rolling Wrench Diesel", phone:"260-502-6222", laborRate:135, serviceCall:250, tax:0, cardFee:0}, state.settings || {});
    state.truck = Object.assign({unit:"No Active Truck", vin:"NONE", customer:"", engine:"Cummins X15", transmission:"", mileage:"", cpl:""}, state.truck || {});
    state.jobs = state.jobs || {};
    ["job1","job2","job3"].forEach((id,i)=>{
      state.jobs[id] = Object.assign({name:`Job ${i+1}`, customer:"", seconds:0, baseSeconds:0, startTimestamp:null, running:false, saved:[], status:"READY"}, state.jobs[id] || {});
    });
    ["invoices","quotes","workorders","customers","schedule","parts","notes","pins","pm","trucks","notifications","files","repairMemory","aiConversations","pmRecords","brainChats"].forEach(k=>{
      if(!Array.isArray(state[k])) state[k] = [];
    });
  }catch(e){
    console.warn("V8.5 state normalize skipped", e);
  }
}
document.addEventListener("DOMContentLoaded", function(){
  try{ rwdV85NormalizeState(); }catch(e){}
});
window.addEventListener("load", function(){
  try{ rwdV85NormalizeState(); }catch(e){}
});


/* V8.6 route additions */
(function(){
  const oldSetRoute = window.setRoute || setRoute;
  window.setRoute = function(route){
    const r=String(route||"home").toLowerCase();
    if(r==="quotes"){ location.hash="quotes"; renderV86Quotes(); return; }
    if(r==="memory"||r==="memorylibrary"){ location.hash="memory"; renderV86Memory(); return; }
    if(r==="clock"){ location.hash="clock"; renderV86Clock(); return; }
    if(r==="schedule"){ location.hash="schedule"; renderV86Schedule(); return; }
    if(r==="reports"||r==="dashboard"||r==="business"){ location.hash="reports"; renderV86Reports(); return; }
    oldSetRoute(route);
  };
})();


/* V8.7 AI route */
(function(){
  const oldSetRouteV87 = window.setRoute || setRoute;
  window.setRoute = function(route){
    const r=String(route||"home").toLowerCase();
    if(r==="ai" || r==="brain"){ location.hash="brain"; renderV87AI(); return; }
    oldSetRouteV87(route);
  };
})();


/* V8.8 backend/AI route */
(function(){
  const oldSetRouteV88 = window.setRoute || setRoute;
  window.setRoute = function(route){
    const r=String(route||"home").toLowerCase();
    if(r==="ai" || r==="brain"){ location.hash="brain"; renderV88AI(); return; }
    if(r==="backendconnections" || r==="backend" || r==="brainsettings"){ location.hash="backendconnections"; renderBackendConnections(); return; }
    oldSetRouteV88(route);
  };
})();


/* ===== V8.9 AI ATTACHMENTS ===== */
function v89Ensure(){
  if(typeof v88Ensure==="function") v88Ensure();
  state.v89=state.v89||{attachments:[]};
  state.v89.attachments=Array.isArray(state.v89.attachments)?state.v89.attachments:[];
}
function v89FileToDataUrl(file){
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
}
async function v89AddFiles(files){
  v89Ensure();
  for(const f of [...(files||[])].slice(0,6)){
    const data=await v89FileToDataUrl(f);
    state.v89.attachments.push({id:Date.now()+"-"+Math.random().toString(16).slice(2),name:f.name||"attachment",type:f.type||"file",size:f.size||0,data,date:new Date().toLocaleString()});
  }
  saveState(); renderV89AI();
}
function v89AttachmentsHtml(){
  v89Ensure();
  if(!state.v89.attachments.length) return "";
  return `<div class="ai-attach-row">${state.v89.attachments.map(a=>`<div class="ai-attach-chip">📎 ${a.name}</div>`).join("")}<button class="ai-attach-chip" id="v89ClearAttach">Clear</button></div>`;
}
function v89AttachmentPreviewHtml(att){
  if(!att) return "";
  if(String(att.type||"").startsWith("image/")) return `<div class="ai-attach-preview"><img src="${att.data}"><small>${att.name}</small></div>`;
  return `<div class="ai-attach-preview"><small>📎 ${att.name}</small></div>`;
}
async function v89RunAI(text){
  v89Ensure();
  text=String(text||"").trim();
  const files=state.v89.attachments||[];
  if(!text && !files.length) return;
  if(["clear","clear chat","new chat"].includes(text.toLowerCase())){
    state.brainChats=[]; if(state.v87)state.v87.pending=null; state.v89.attachments=[]; saveState(); renderV89AI(); return;
  }
  if(files.length){
    if(typeof v87Push==="function") v87Push("user",(text||"Attached file(s)")+"\\n"+files.map(f=>"Attached: "+f.name).join("\\n"));
    const first=files[0];
    if(first && first.type && first.type.startsWith("image/")) state.brainChats.push({role:"user",text:"",kind:"attachment",meta:first,date:new Date().toLocaleString()});
    if(typeof v88Has==="function" && v88Has(state.backend?.visionEndpoint)){
      try{
        const ans=await v88Post(state.backend.visionEndpoint,state.backend.visionKey,{prompt:text||"Analyze this attachment",files,context:v88Context()});
        v87Push("ai",ans.answer||ans.text||ans.message||JSON.stringify(ans,null,2));
      }catch(e){v87Push("ai","Picture attached, but Vision backend failed: "+e.message);}
    }else{
      v87Push("ai","Picture/file attached. To analyze it like ChatGPT/Gemini, connect the Vision backend in Backend Connections. I can still keep it in the chat for now.");
    }
    state.v89.attachments=[]; saveState(); renderV89AI(); return;
  }
  if(typeof v88RunAI==="function") return v88RunAI(text);
  if(typeof v87RunAI==="function") return v87RunAI(text);
}
function renderV89AI(){
  v89Ensure();
  document.body.classList.add("rw-ai-mode");
  const ctx=`${state.truck?.customer||"No customer"} • ${state.truck?.unit||"No truck"} • ${state.truck?.engine||"Engine unknown"}`;
  const live=(typeof v88Has==="function"&&v88Has(state.backend?.aiEndpoint))?`<span class="ai-live-badge">AI Connected</span>`:`<span class="ai-offline-badge">Setup Needed</span>`;
  $("#screen").innerHTML=`<section class="rw8-shell">
    <input id="v89FileInput" type="file" accept="image/*,.pdf,.txt,.csv,.json" multiple style="display:none">
    <div class="rw8-head"><div class="rw8-brand"><div class="rw8-logo">RW</div><div><b>Rolling Wrench AI</b><small>${ctx}</small></div></div><div>${live}<button class="clear" id="v89Clear">Clear</button><button id="v89Close">Close</button></div></div>
    <div class="rw8-thread" id="v89Thread">
      <div class="rw8-chips"><button data-v89-chip="Build me an invoice for replacing water pump and belt">Invoice</button><button data-v89-chip="Build me a quote for clutch replacement on a 2014 Peterbilt ISX">Quote</button><button data-v89-chip="How do I change a water pump on X15?">Ask</button><button id="v89PhotoChip">Add Photo</button><button data-route="backendconnections">Backend</button></div>
      ${v89AttachmentsHtml()}
      ${(state.brainChats||[]).map(m=>{
        if(m.kind==="preview"&&typeof v87PreviewHtml==="function") return v87PreviewHtml(m.meta);
        if(m.kind==="attachment") return v89AttachmentPreviewHtml(m.meta);
        return `<div class="msg ${m.role==="user"?"user":"ai"}"><b>${m.role==="user"?"You":"RW AI"}</b>${String(m.text||"").replace(/\\n/g,"\\n")}</div>`;
      }).join("")||`<div class="msg ai"><b>RW AI</b>Tap + to add photos/files like ChatGPT. I’ll analyze images when Vision backend is connected.</div>`}
    </div>
    <div class="rw8-compose"><button class="plus" id="v89Plus">+</button><div class="inputbox"><input id="v89Input" placeholder="Ask Rolling Wrench AI anything..."><button class="mic" id="v89Mic">🎙</button></div><button class="sendbtn" id="v89Send">➤</button></div>
  </section>`;
  if(typeof bindPageTools==="function") bindPageTools();
  const th=$("#v89Thread"); if(th) th.scrollTop=th.scrollHeight;
  $("#v89Send").onclick=()=>v89RunAI($("#v89Input").value);
  $("#v89Input").onkeydown=e=>{if(e.key==="Enter")v89RunAI($("#v89Input").value);};
  $("#v89Clear").onclick=()=>{state.brainChats=[]; if(state.v87)state.v87.pending=null; state.v89.attachments=[]; saveState(); renderV89AI();};
  $("#v89Close").onclick=()=>{document.body.classList.remove("rw-ai-mode");setRoute("home");};
  $("#v89Plus").onclick=()=>$("#v89FileInput").click();
  $("#v89PhotoChip").onclick=()=>$("#v89FileInput").click();
  $("#v89FileInput").onchange=e=>v89AddFiles(e.target.files);
  $("#v89Mic").onclick=()=>{if(typeof startVoiceToField==="function")startVoiceToField("v89Input");else $("#v89Input").focus();};
  const ca=$("#v89ClearAttach"); if(ca) ca.onclick=()=>{state.v89.attachments=[];saveState();renderV89AI();};
  $$("[data-v89-chip]").forEach(b=>b.onclick=()=>v89RunAI(b.dataset.v89Chip));
}


/* V8.9 AI attachment route */
(function(){
  const oldSetRouteV89 = window.setRoute || setRoute;
  window.setRoute = function(route){
    const r=String(route||"home").toLowerCase();
    if(r==="ai" || r==="brain"){ location.hash="brain"; renderV89AI(); return; }
    oldSetRouteV89(route);
  };
})();


/* ===== V9.0 REAL AI BRAIN ===== */
function v90Ensure(){
  if(typeof v89Ensure==="function") v89Ensure();
  state.backend = Object.assign({
    provider:"openai",
    aiEndpoint:"",
    aiKey:"",
    model:"gpt-4o-mini",
    visionEndpoint:"",
    visionKey:""
  }, state.backend||{});
}
function v90X15WaterPump(){
  return `Here’s the field procedure for changing a water pump on a Cummins X15 / ISX-style setup.

Safety:
1. Let engine cool completely.
2. Drain coolant below pump level.
3. Disconnect batteries if working near fan/belts.
4. Save coolant only if clean and approved to reuse.

Steps:
1. Take a picture of belt routing.
2. Remove serpentine belt.
3. Remove shroud/access panels as needed.
4. Remove hoses/coolant pipe/brackets blocking the pump.
5. Remove pump pulley if required.
6. Remove water pump bolts.
7. Pull pump straight out and catch coolant.
8. Clean sealing surface without gouging it.
9. Compare old pump to new pump: impeller, pulley offset, ports, bolt pattern.
10. Install new O-ring/gasket. Lightly lube O-ring with coolant if applicable.
11. Install pump and torque evenly to OEM spec.
12. Reinstall pulley, hoses, brackets, and belt.
13. Refill coolant.
14. Pressure test cooling system.
15. Start engine, check leaks, check belt tracking.
16. Bring to temp, road test, cool down, recheck coolant level.

Inspect while there:
- Belt, tensioner, idlers
- Fan hub/fan clutch play
- Coolant hoses
- Thermostat housing leaks
- Surge tank/cap

Questions:
Is this a 2019 International ProStar with X15?
Are you replacing it for a leak, noise, overheating, or coolant loss?`;
}
function v90LocalAnswer(text){
  const q=String(text||"").toLowerCase();
  if((q.includes("water pump") || q.includes("waterpump")) && (q.includes("x15") || q.includes("x 15") || q.includes("isx"))) return v90X15WaterPump();
  if(q.includes("low boost") || q.includes("underboost")){
    return `Low boost on a Cummins X15 is commonly caused by:
1. CAC leak / boot split / loose clamp
2. Exhaust leak before turbo
3. VGT actuator or stuck turbo vanes
4. Bad MAP/boost sensor
5. Intake restriction
6. EGR valve stuck open
7. Fuel restriction
8. Aftertreatment derate/restriction

Checks:
- Check boost under load.
- Pressure test CAC.
- Run VGT sweep.
- Compare commanded vs actual turbo position.
- Check MAP KOEO vs baro.`;
  }
  if(q.includes("spn") || q.includes("fmi")) return `Send me the exact SPN/FMI, engine, active/inactive status, and symptoms. I’ll break down causes and test steps.`;
  if(q.includes("invoice") || q.includes("quote")) return "";
  return `AI backend is not connected yet. I can still answer common diesel procedures and build invoice/quote previews. Add your AI endpoint/key in Backend Connections for full ChatGPT/Gemini-style answers.`;
}
async function v90CallAI(text, files){
  v90Ensure();
  if(!state.backend.aiEndpoint) return "";
  const payload={
    provider:state.backend.provider,
    model:state.backend.model,
    prompt:text,
    messages:[
      {role:"system",content:"You are Rolling Wrench AI. Answer anything like ChatGPT/Gemini/Google. You are also a diesel/gas mechanic assistant and service advisor. Give clear steps, warnings, parts/tools, and follow-up questions."},
      {role:"user",content:text}
    ],
    context:typeof v88Context==="function"?v88Context():{},
    files:files||[]
  };
  const data=await v88Post(state.backend.aiEndpoint,state.backend.aiKey,payload);
  return data.answer||data.text||data.message||data.content||JSON.stringify(data,null,2);
}
async function v90RunAI(text){
  v90Ensure();
  text=String(text||"").trim();
  const files=state.v89?.attachments||[];
  if(!text && !files.length) return;
  const low=text.toLowerCase();
  if(["clear","clear chat","new chat"].includes(low)){
    state.brainChats=[]; if(state.v87)state.v87.pending=null; if(state.v89)state.v89.attachments=[]; saveState(); renderV90AI(); return;
  }
  if(["send to invoices","send to invoice","save to invoice","save to invoices"].includes(low)){
    const ok=typeof v87SavePending==="function" && v87SavePending("invoice");
    v87Push("ai",ok?"Done. I sent that preview to Invoices.":"No preview found. Build an invoice first.");
    renderV90AI(); return;
  }
  if(["send to quotes","send to quote","save to quote","save to quotes"].includes(low)){
    const ok=typeof v87SavePending==="function" && v87SavePending("quote");
    v87Push("ai",ok?"Done. I sent that preview to Quotes.":"No preview found. Build a quote first.");
    renderV90AI(); return;
  }
  v87Push("user",text||"Attached file(s)");
  if(files.length && files[0]?.type?.startsWith("image/")){
    state.brainChats.push({role:"user",text:"",kind:"attachment",meta:files[0],date:new Date().toLocaleString()});
  }
  const intent=typeof v87Intent==="function"?v87Intent(text):"general";
  if(intent==="invoice" || intent==="quote"){
    const p=v87BuildPreview(text,intent);
    state.v87.pending=p;
    v87Push("ai",`I built a ${intent} preview. Review it first. If it looks good, say “send to invoices” or “send to quotes”.`);
    v87Push("ai","preview","preview",p);
    if(state.v89)state.v89.attachments=[];
    saveState(); renderV90AI(); return;
  }
  try{
    let ans="";
    if(files.length && state.backend.visionEndpoint){
      const data=await v88Post(state.backend.visionEndpoint,state.backend.visionKey,{prompt:text||"Analyze this image/file",files,context:typeof v88Context==="function"?v88Context():{}});
      ans=data.answer||data.text||data.message||JSON.stringify(data,null,2);
    }else{
      ans=await v90CallAI(text,files);
    }
    v87Push("ai",ans||v90LocalAnswer(text));
  }catch(e){
    v87Push("ai",v90LocalAnswer(text)+"\n\nBackend error: "+e.message);
  }
  if(state.v89)state.v89.attachments=[];
  saveState(); renderV90AI();
}
function renderV90AI(){
  v90Ensure();
  document.body.classList.add("rw-ai-mode");
  const ctx=`${state.truck?.customer||"No customer"} • ${state.truck?.unit||"No truck"} • ${state.truck?.engine||"Engine unknown"}`;
  const live=state.backend.aiEndpoint?`<span class="ai-live-badge">AI Connected</span>`:`<span class="ai-offline-badge">Local</span>`;
  $("#screen").innerHTML=`<section class="rw8-shell">
    <input id="v90FileInput" type="file" accept="image/*,.pdf,.txt,.csv,.json" multiple style="display:none">
    <div class="rw8-head"><div class="rw8-brand"><div class="rw8-logo">RW</div><div><b>Rolling Wrench AI</b><small>${ctx}</small></div></div><div>${live}<button class="clear" id="v90Clear">Clear</button><button id="v90Close">Close</button></div></div>
    <div class="rw8-thread" id="v90Thread">
      <div class="rw8-chips">
        <button data-v90-chip="How do I change a water pump on an X15?">X15 water pump</button>
        <button data-v90-chip="Build me an invoice for replacing water pump and belt">Invoice</button>
        <button data-v90-chip="Build me a quote for clutch replacement on a 2014 Peterbilt ISX">Quote</button>
        <button id="v90PhotoChip">Add Photo</button>
        <button data-route="backendconnections">Backend</button>
      </div>
      ${typeof v89AttachmentsHtml==="function"?v89AttachmentsHtml():""}
      ${(state.brainChats||[]).map(m=>{
        if(m.kind==="preview"&&typeof v87PreviewHtml==="function") return v87PreviewHtml(m.meta);
        if(m.kind==="attachment"&&typeof v89AttachmentPreviewHtml==="function") return v89AttachmentPreviewHtml(m.meta);
        return `<div class="msg ${m.role==="user"?"user":"ai"}"><b>${m.role==="user"?"You":"RW AI"}</b>${String(m.text||"").replace(/\\n/g,"\n")}</div>`;
      }).join("")||`<div class="msg ai"><b>RW AI</b>Ask me anything. Without backend I can still answer common diesel procedures and build quote/invoice previews.</div>`}
    </div>
    <div class="rw8-compose"><button class="plus" id="v90Plus">+</button><div class="inputbox"><input id="v90Input" placeholder="Ask Rolling Wrench AI anything..."><button class="mic" id="v90Mic">🎙</button></div><button class="sendbtn" id="v90Send">➤</button></div>
  </section>`;
  if(typeof bindPageTools==="function") bindPageTools();
  const th=$("#v90Thread"); if(th) th.scrollTop=th.scrollHeight;
  $("#v90Send").onclick=()=>v90RunAI($("#v90Input").value);
  $("#v90Input").onkeydown=e=>{if(e.key==="Enter")v90RunAI($("#v90Input").value);};
  $("#v90Clear").onclick=()=>{state.brainChats=[];if(state.v87)state.v87.pending=null;if(state.v89)state.v89.attachments=[];saveState();renderV90AI();};
  $("#v90Close").onclick=()=>{document.body.classList.remove("rw-ai-mode");setRoute("home");};
  $("#v90Plus").onclick=()=>$("#v90FileInput").click();
  $("#v90PhotoChip").onclick=()=>$("#v90FileInput").click();
  $("#v90FileInput").onchange=e=>v89AddFiles(e.target.files);
  $("#v90Mic").onclick=()=>{if(typeof startVoiceToField==="function")startVoiceToField("v90Input");else $("#v90Input").focus();};
  $$("[data-v90-chip]").forEach(b=>b.onclick=()=>v90RunAI(b.dataset.v90Chip));
}
function renderV90BackendConnections(){
  v90Ensure();
  $("#screen").innerHTML = `${pageHead("Real AI Backend","saveV90Backend")}
  <section class="backend-box">
    <h3>AI Provider</h3>
    <div class="v90-provider-grid">
      ${["openai","gemini","claude","openrouter"].map(p=>`<button class="v90-provider ${state.backend.provider===p?"active":""}" data-v90-provider="${p}">${p.toUpperCase()}</button>`).join("")}
    </div>
  </section>
  <section class="backend-box form-grid">
    <h3>AI Endpoint</h3>
    <small>Your backend should accept POST JSON and return answer/text/message.</small>
    <label>Endpoint<input id="v90AiEndpoint" value="${state.backend.aiEndpoint||""}" placeholder="https://your-backend.com/ai"></label>
    <label>API Key<input id="v90AiKey" value="${state.backend.aiKey||""}" placeholder="Backend key"></label>
    <label>Model<input id="v90Model" value="${state.backend.model||"gpt-4o-mini"}"></label>
  </section>
  <section class="backend-box form-grid">
    <h3>Vision / Photo Endpoint</h3>
    <label>Vision Endpoint<input id="v90VisionEndpoint" value="${state.backend.visionEndpoint||""}"></label>
    <label>Vision Key<input id="v90VisionKey" value="${state.backend.visionKey||""}"></label>
  </section>
  <section class="backend-box">
    <h3>Test</h3>
    <div class="backend-test-row"><label>Question<input id="v90TestQuestion" value="How do I change a water pump on an X15?"></label><button class="v86-btn primary" id="v90TestBtn">Test</button></div>
    <div class="backend-output" id="v90Out">${state.v88?.lastBackendTest||"No test yet."}</div>
  </section>
  <section class="${state.backend.aiEndpoint?"v90-ok":"v90-warning"}">${state.backend.aiEndpoint?"AI endpoint saved.":"No backend connected yet. Local diesel fallback is active."}</section>`;
  if(typeof bindPageTools==="function") bindPageTools();
  $$("[data-v90-provider]").forEach(b=>b.onclick=()=>{state.backend.provider=b.dataset.v90Provider;saveState();renderV90BackendConnections();});
  $("#saveV90Backend").onclick=()=>{state.backend.aiEndpoint=v90AiEndpoint.value;state.backend.aiKey=v90AiKey.value;state.backend.model=v90Model.value;state.backend.visionEndpoint=v90VisionEndpoint.value;state.backend.visionKey=v90VisionKey.value;saveState();if(typeof toast==="function")toast("AI backend saved");renderV90BackendConnections();};
  $("#v90TestBtn").onclick=async()=>{v90Out.textContent="Testing...";try{const a=await v90CallAI(v90TestQuestion.value,[]);v90Out.textContent=a||v90LocalAnswer(v90TestQuestion.value);state.v88=state.v88||{};state.v88.lastBackendTest=v90Out.textContent;saveState();}catch(e){v90Out.textContent=v90LocalAnswer(v90TestQuestion.value)+"\n\nBackend error: "+e.message;}};
}


/* V9.0 AI route */
(function(){
  const oldSetRouteV90 = window.setRoute || setRoute;
  window.setRoute = function(route){
    const r=String(route||"home").toLowerCase();
    if(r==="ai" || r==="brain"){ location.hash="brain"; renderV90AI(); return; }
    if(r==="backendconnections" || r==="backend" || r==="brainsettings"){ location.hash="backendconnections"; renderV90BackendConnections(); return; }
    oldSetRouteV90(route);
  };
})();


/* ===== V9.0a FORCE REAL AI ROUTE ===== */
function v90aLocalAnswer(text){
  const q=String(text||"").toLowerCase();
  if((q.includes("water pump")||q.includes("waterpump")) && (q.includes("x15")||q.includes("x 15")||q.includes("isx"))){
    return `Here’s how to change a water pump on a Cummins X15 / ISX style engine:

Safety:
1. Let the engine cool completely.
2. Drain coolant below the pump level.
3. Disconnect batteries if working around fan/belts.
4. Catch coolant cleanly.

Steps:
1. Take a picture of belt routing.
2. Remove serpentine belt.
3. Remove fan shroud/access panels as needed.
4. Remove hoses, coolant pipe, brackets, or pulley blocking the pump.
5. Remove water pump bolts.
6. Pull pump straight out and catch coolant.
7. Clean sealing surface without gouging it.
8. Compare old pump to new pump: impeller, pulley offset, ports, bolt pattern.
9. Install new O-ring/gasket. Lightly lube O-ring with coolant if used.
10. Install pump and torque bolts evenly to OEM spec.
11. Reinstall pulley, hoses, brackets, and belt.
12. Refill coolant.
13. Pressure test cooling system.
14. Start engine, check leaks, verify belt tracking.
15. Bring to temp, road test, cool down, and recheck coolant level.

Inspect while there:
- Belt
- Tensioner/idlers
- Fan hub/fan clutch
- Coolant hoses
- Thermostat housing
- Surge tank cap

Question: are you replacing it because it is leaking, noisy, overheating, or losing coolant?`;
  }
  if(q.includes("low boost")||q.includes("underboost")){
    return `Low boost on a Cummins X15 is commonly caused by:
1. CAC leak / boot split / loose clamp
2. Exhaust leak before turbo
3. VGT actuator or stuck turbo vanes
4. Bad MAP/boost sensor
5. Intake restriction
6. EGR valve stuck open
7. Fuel restriction
8. Aftertreatment derate/restriction

Fast checks:
- Check boost under load.
- Pressure test CAC.
- Run VGT sweep.
- Compare commanded vs actual turbo position.
- Check MAP KOEO against baro.`;
  }
  return `I can answer that once the real AI backend is connected. I can still build invoice/quote previews and answer common diesel questions locally.`;
}
async function v90aRun(text){
  text=String(text||"").trim();
  if(!text) return;
  state.brainChats = state.brainChats || [];
  if(["clear","clear chat","new chat"].includes(text.toLowerCase())){
    state.brainChats=[];
    saveState();
    renderV90A_AI();
    return;
  }
  state.brainChats.push({role:"user", text, date:new Date().toLocaleString()});
  const low=text.toLowerCase();
  if((low.includes("invoice")||low.includes("quote")) && typeof v87BuildPreview==="function"){
    const type=low.includes("quote")?"quote":"invoice";
    state.v87=state.v87||{};
    const p=v87BuildPreview(text,type);
    state.v87.pending=p;
    state.brainChats.push({role:"ai", text:`I built a ${type} preview. Review it first. If it looks good, say “send to invoices” or “send to quotes”.`, date:new Date().toLocaleString()});
    state.brainChats.push({role:"ai", text:"preview", kind:"preview", meta:p, date:new Date().toLocaleString()});
  } else {
    let ans="";
    try{
      if(state.backend && state.backend.aiEndpoint && typeof v88Post==="function"){
        const data=await v88Post(state.backend.aiEndpoint,state.backend.aiKey||"",{
          prompt:text,
          messages:[
            {role:"system",content:"You are Rolling Wrench AI. Answer anything like ChatGPT/Gemini. Give complete helpful answers."},
            {role:"user",content:text}
          ],
          context: typeof v88Context==="function"?v88Context():{}
        });
        ans=data.answer||data.text||data.message||data.content||"";
      }
    }catch(e){
      ans="";
    }
    state.brainChats.push({role:"ai", text:ans||v90aLocalAnswer(text), date:new Date().toLocaleString()});
  }
  saveState();
  renderV90A_AI();
}
function renderV90A_AI(){
  document.body.classList.add("rw-ai-mode");
  state.brainChats = state.brainChats || [];
  const ctx=`${state.truck?.customer||"No customer"} • ${state.truck?.unit||"No truck"} • ${state.truck?.engine||"Engine unknown"}`;
  const live=state.backend?.aiEndpoint?`<span class="ai-live-badge">AI Connected</span>`:`<span class="ai-offline-badge">Local</span>`;
  $("#screen").innerHTML=`<section class="rw8-shell">
    <div class="rw8-head"><div class="rw8-brand"><div class="rw8-logo">RW</div><div><b>Rolling Wrench AI</b><small>${ctx}</small></div></div><div>${live}<button class="clear" id="v90aClear">Clear</button><button id="v90aClose">Close</button></div></div>
    <div class="rw8-thread" id="v90aThread">
      <div class="rw8-chips">
        <button data-v90a-chip="How do I change a water pump on an X15?">X15 water pump</button>
        <button data-v90a-chip="What causes low boost on a Cummins X15?">Low boost</button>
        <button data-v90a-chip="Build me an invoice for replacing water pump and belt">Invoice</button>
        <button data-v90a-chip="Build me a quote for clutch replacement on a 2014 Peterbilt ISX">Quote</button>
        <button data-route="backendconnections">Backend</button>
      </div>
      ${state.brainChats.map(m=>{
        if(m.kind==="preview" && typeof v87PreviewHtml==="function") return v87PreviewHtml(m.meta);
        return `<div class="msg ${m.role==="user"?"user":"ai"}"><b>${m.role==="user"?"You":"RW AI"}</b>${String(m.text||"").replace(/\\n/g,"\n")}</div>`;
      }).join("") || `<div class="msg ai"><b>RW AI</b>Ask me anything. I’ll answer here first, then send quotes/invoices only when you approve.</div>`}
    </div>
    <div class="rw8-compose"><button class="plus" id="v90aPlus">+</button><div class="inputbox"><input id="v90aInput" placeholder="Ask Rolling Wrench AI anything..."><button class="mic" id="v90aMic">🎙</button></div><button class="sendbtn" id="v90aSend">➤</button></div>
  </section>`;
  if(typeof bindPageTools==="function") bindPageTools();
  const th=$("#v90aThread"); if(th) th.scrollTop=th.scrollHeight;
  $("#v90aSend").onclick=()=>v90aRun($("#v90aInput").value);
  $("#v90aInput").onkeydown=e=>{if(e.key==="Enter")v90aRun($("#v90aInput").value);};
  $("#v90aClear").onclick=()=>{state.brainChats=[];saveState();renderV90A_AI();};
  $("#v90aClose").onclick=()=>{document.body.classList.remove("rw-ai-mode");setRoute("home");};
  $("#v90aPlus").onclick=()=>{ if(typeof renderV89AI==="function"){ renderV89AI(); setTimeout(()=>document.querySelector("#v89FileInput")?.click(),50); } };
  $$("[data-v90a-chip]").forEach(b=>b.onclick=()=>v90aRun(b.dataset.v90aChip));
}
/* Override every known AI renderer to the fixed one */
window.renderV90AI = renderV90A_AI;
window.renderV89AI = renderV90A_AI;
window.renderV88AI = renderV90A_AI;
window.renderV87AI = renderV90A_AI;
window.renderRW8Brain = renderV90A_AI;
window.renderBrainV72 = renderV90A_AI;


/* V9.0a hard AI route override */
setTimeout(function(){
  const prevSetRoute = window.setRoute || setRoute;
  window.setRoute = function(route){
    const r=String(route||"home").toLowerCase();
    if(r==="ai" || r==="brain" || r==="rwai"){ location.hash="brain"; renderV90A_AI(); return; }
    prevSetRoute(route);
  };
  document.addEventListener("click",function(e){
    const el=e.target.closest("[data-route]");
    if(!el) return;
    const r=String(el.getAttribute("data-route")||"").toLowerCase();
    if(r==="ai" || r==="brain" || r==="rwai"){
      e.preventDefault();
      e.stopPropagation();
      location.hash="brain";
      renderV90A_AI();
    }
  },true);
},0);


/* ===== V9.1 AI READABLE ANSWER FORMATTER ===== */
function v91Escape(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function v91X15WaterPumpRich(){return `<div class="ai-rich-answer">
<h2>Cummins X15 Water Pump Replacement</h2>
<div class="ai-callout"><b>Quick note:</b> Exact access changes by chassis. On a 2019 International ProStar X15, fan shroud, belt routing, coolant pipe, and bracket access may vary.</div>
<h3>Tools / Supplies</h3><ul><li>Drain pan for coolant</li><li>Socket set and ratchets</li><li>Torque wrench</li><li>Belt tool or long-handle ratchet</li><li>New water pump gasket/O-ring</li><li>Correct coolant</li></ul>
<h3>Safety</h3><ul><li>Let the engine cool completely.</li><li>Drain coolant below pump level.</li><li>Disconnect batteries if working near fan, belts, or wiring.</li><li>Keep hands clear of fan and belt path.</li></ul>
<h3>Removal</h3><ol><li>Take a picture of the belt routing.</li><li>Remove the serpentine belt.</li><li>Remove fan shroud/access panels as needed.</li><li>Remove hoses, coolant pipe, brackets, or pulley blocking the pump.</li><li>Remove the water pump mounting bolts.</li><li>Pull the pump straight out and catch remaining coolant.</li><li>Clean the sealing surface without gouging the housing.</li></ol>
<h3>Installation</h3><ol><li>Compare old pump to new pump: impeller, pulley offset, ports, and bolt pattern.</li><li>Install the new gasket/O-ring. Lightly lube O-ring with clean coolant if used.</li><li>Install pump and tighten bolts evenly.</li><li>Torque bolts to OEM specification.</li><li>Reinstall pulley, coolant pipe, hoses, brackets, and belt.</li><li>Refill coolant.</li></ol>
<h3>Final Checks</h3><ul><li>Pressure test cooling system.</li><li>Start engine and check for leaks.</li><li>Verify belt tracking.</li><li>Bring engine to operating temperature.</li><li>Road test if possible.</li><li>Let it cool down and recheck coolant level.</li></ul>
<h3>Inspect While You’re There</h3><div class="ai-mini-grid"><div class="ai-mini-card"><b>Belt</b><span>Cracks, glazing, oil contamination</span></div><div class="ai-mini-card"><b>Tensioner / Idlers</b><span>Noise, wobble, weak spring</span></div><div class="ai-mini-card"><b>Fan Hub / Clutch</b><span>Play, leaks, engagement issue</span></div><div class="ai-mini-card"><b>Hoses / Housing</b><span>Leaks, swelling, thermostat housing seepage</span></div></div>
<h3>Typical Labor</h3><ul><li><b>Shop:</b> roughly 3–5 hours depending on access.</li><li><b>Mobile/roadside:</b> roughly 4–6 hours depending on cooling system drain/fill and access.</li></ul>
<h3>Question</h3><p>Are you replacing it because it is leaking, noisy, overheating, or losing coolant?</p></div>`;}
function v91LowBoostRich(){return `<div class="ai-rich-answer"><h2>Cummins X15 Low Boost Checklist</h2><h3>Most Common Causes</h3><ul><li>Charge air cooler leak, split boot, or loose clamp</li><li>Exhaust leak before the turbo</li><li>VGT actuator issue or stuck turbo vanes</li><li>Bad MAP/boost sensor reading</li><li>Intake restriction or plugged air filter</li><li>EGR valve stuck open</li><li>Fuel restriction or low fuel delivery</li><li>Aftertreatment derate or restriction</li></ul><h3>Fast Tests</h3><ol><li>Check actual boost under load.</li><li>Pressure test the charge air system.</li><li>Inspect CAC boots for oil tracks, splits, or loose clamps.</li><li>Run VGT sweep/calibration.</li><li>Compare commanded turbo position to actual turbo position.</li><li>Check MAP sensor KOEO against barometric pressure.</li><li>Check active codes and derate status.</li></ol><h3>Questions</h3><ul><li>What boost PSI are you seeing under load?</li><li>Any SPN/FMI codes?</li><li>Black smoke, no smoke, or derate?</li><li>Does the VGT sweep pass?</li></ul></div>`;}
function v91FormatPlainText(text){let s=v91Escape(String(text||"").replace(/\\n/g,"\n"));let lines=s.split(/\n+/).map(x=>x.trim()).filter(Boolean);let html='<div class="ai-rich-answer">';for(const line of lines){if(line.endsWith(":")&&line.length<60)html+=`<h3>${line.replace(":","")}</h3>`;else if(/^\d+\./.test(line))html+=`<ol><li>${line.replace(/^\d+\.\s*/,"")}</li></ol>`;else if(line.startsWith("- ")||line.startsWith("• "))html+=`<ul><li>${line.replace(/^[-•]\s*/,"")}</li></ul>`;else html+=`<p>${line}</p>`;}return html+"</div>";}
function v91AnswerHtml(text){const q=String(text||"").toLowerCase();if((q.includes("water pump")||q.includes("waterpump"))&&(q.includes("x15")||q.includes("x 15")||q.includes("isx")))return v91X15WaterPumpRich();if(q.includes("low boost")||q.includes("underboost"))return v91LowBoostRich();return "";}
function v91RenderMessage(m){if(m.kind==="preview"&&typeof v87PreviewHtml==="function")return v87PreviewHtml(m.meta);if(m.kind==="attachment"&&typeof v89AttachmentPreviewHtml==="function")return v89AttachmentPreviewHtml(m.meta);const isAI=m.role!=="user";const rich=isAI?(m.html||v91FormatPlainText(m.text||"")):v91Escape(m.text||"").replace(/\n/g,"<br>");return `<div class="msg ${m.role==="user"?"user":"ai"}"><b>${m.role==="user"?"You":"RW AI"}</b>${rich}</div>`;}
async function v91RunAI(text){text=String(text||"").trim();if(!text)return;state.brainChats=state.brainChats||[];if(["clear","clear chat","new chat"].includes(text.toLowerCase())){state.brainChats=[];saveState();renderV91AI();return;}state.brainChats.push({role:"user",text,date:new Date().toLocaleString()});const low=text.toLowerCase();if((low.includes("invoice")||low.includes("quote"))&&typeof v87BuildPreview==="function"){const type=low.includes("quote")?"quote":"invoice";state.v87=state.v87||{};const p=v87BuildPreview(text,type);state.v87.pending=p;state.brainChats.push({role:"ai",text:`I built a ${type} preview. Review it first. If it looks good, say “send to invoices” or “send to quotes”.`,html:v91FormatPlainText(`I built a ${type} preview.\n\nReview it first.\n\nIf it looks good, say “send to invoices” or “send to quotes”.`),date:new Date().toLocaleString()});state.brainChats.push({role:"ai",text:"preview",kind:"preview",meta:p,date:new Date().toLocaleString()});}else{let html=v91AnswerHtml(text);let ans="";if(!html&&state.backend?.aiEndpoint&&typeof v90CallAI==="function"){try{ans=await v90CallAI(text,[]);}catch(e){ans="Backend error: "+e.message;}}if(!html&&ans)html=v91FormatPlainText(ans);if(!html)html=v91FormatPlainText(typeof v90aLocalAnswer==="function"?v90aLocalAnswer(text):(typeof v90LocalAnswer==="function"?v90LocalAnswer(text):"I can help with that."));state.brainChats.push({role:"ai",text:ans||text,html,date:new Date().toLocaleString()});}saveState();renderV91AI();}
function renderV91AI(){document.body.classList.add("rw-ai-mode");state.brainChats=state.brainChats||[];const ctx=`${state.truck?.customer||"No customer"} • ${state.truck?.unit||"No truck"} • ${state.truck?.engine||"Engine unknown"}`;const live=state.backend?.aiEndpoint?`<span class="ai-live-badge">AI Connected</span>`:`<span class="ai-offline-badge">Local</span>`;$("#screen").innerHTML=`<section class="rw8-shell"><div class="rw8-head"><div class="rw8-brand"><div class="rw8-logo">RW</div><div><b>Rolling Wrench AI</b><small>${ctx}</small></div></div><div>${live}<button class="clear" id="v91Clear">Clear</button><button id="v91Close">Close</button></div></div><div class="rw8-thread" id="v91Thread"><div class="rw8-chips"><button data-v91-chip="How do I change a water pump on an X15?">X15 water pump</button><button data-v91-chip="What causes low boost on a Cummins X15?">Low boost</button><button data-v91-chip="Build me an invoice for replacing water pump and belt">Invoice</button><button data-v91-chip="Build me a quote for clutch replacement on a 2014 Peterbilt ISX">Quote</button><button data-route="backendconnections">Backend</button></div>${state.brainChats.map(v91RenderMessage).join("")||`<div class="msg ai"><b>RW AI</b><div class="ai-rich-answer"><h2>Ask me anything</h2><p>I’ll format repair answers with headings, bullets, and steps so they’re easier to read on your phone.</p></div></div>`}</div><div class="rw8-compose"><button class="plus" id="v91Plus">+</button><div class="inputbox"><input id="v91Input" placeholder="Ask Rolling Wrench AI anything..."><button class="mic" id="v91Mic">🎙</button></div><button class="sendbtn" id="v91Send">➤</button></div></section>`;if(typeof bindPageTools==="function")bindPageTools();const th=$("#v91Thread");if(th)th.scrollTop=th.scrollHeight;$("#v91Send").onclick=()=>v91RunAI($("#v91Input").value);$("#v91Input").onkeydown=e=>{if(e.key==="Enter")v91RunAI($("#v91Input").value);};$("#v91Clear").onclick=()=>{state.brainChats=[];saveState();renderV91AI();};$("#v91Close").onclick=()=>{document.body.classList.remove("rw-ai-mode");setRoute("home");};$("#v91Plus").onclick=()=>{if(typeof renderV89AI==="function"){renderV89AI();setTimeout(()=>document.querySelector("#v89FileInput")?.click(),50);}};$$("[data-v91-chip]").forEach(b=>b.onclick=()=>v91RunAI(b.dataset.v91Chip));}
window.renderV91AI=renderV91AI;window.renderV90A_AI=renderV91AI;window.renderV90AI=renderV91AI;window.renderV89AI=renderV91AI;window.renderV88AI=renderV91AI;window.renderV87AI=renderV91AI;window.renderRW8Brain=renderV91AI;


/* V9.1 readable AI route */
setTimeout(function(){const oldSetRouteV91=window.setRoute||setRoute;window.setRoute=function(route){const r=String(route||"home").toLowerCase();if(r==="ai"||r==="brain"||r==="rwai"){location.hash="brain";renderV91AI();return;}oldSetRouteV91(route);};},0);


/* ===== V9.2 LIVE BACKEND CONNECTION ===== */
const RW_LIVE_BACKEND_URL = "https://rolling-wrench-ai-backend.onrender.com";

function rw92EnsureBackend(){
  state.backend = state.backend || {};
  state.backend.aiEndpoint = RW_LIVE_BACKEND_URL + "/api/ai";
  state.backend.visionEndpoint = RW_LIVE_BACKEND_URL + "/api/vision";
  state.backend.webEndpoint = RW_LIVE_BACKEND_URL + "/api/search";
  state.backend.partsEndpoint = RW_LIVE_BACKEND_URL + "/api/parts";
  if(typeof saveState === "function") saveState();
}

async function rw92Post(url, payload){
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch(e) { data = { answer: txt }; }
  if(!res.ok) throw new Error(data.error || data.message || txt || ("HTTP " + res.status));
  return data;
}

async function rw92AskBackend(prompt, files){
  rw92EnsureBackend();
  const q = String(prompt || "");
  const context = {
    truck: state.truck || {},
    settings: state.settings || {},
    pending: state.v87 ? state.v87.pending : null,
    recentQuotes: (state.quotes || []).slice(-5),
    recentInvoices: (state.invoices || []).slice(-5),
    repairMemory: (state.repairMemory || []).slice(0,10)
  };
  const lower = q.toLowerCase();
  let url = state.backend.aiEndpoint;

  if(files && files.length && state.backend.visionEndpoint) url = state.backend.visionEndpoint;
  else if((lower.includes("part") || lower.includes("water pump") || lower.includes("belt") || lower.includes("clutch") || lower.includes("supplier")) && state.backend.partsEndpoint) url = state.backend.partsEndpoint;
  else if((lower.includes("weather") || lower.includes("today") || lower.includes("current") || lower.includes("near me") || lower.includes("price") || lower.includes("who won")) && state.backend.webEndpoint) url = state.backend.webEndpoint;

  const data = await rw92Post(url, {
    prompt: q,
    question: q,
    context: context,
    files: files || []
  });

  return data.answer || data.text || data.message || data.content || JSON.stringify(data, null, 2);
}

async function rw92RunAI(text){
  rw92EnsureBackend();
  text = String(text || "").trim();
  const files = (state.v89 && state.v89.attachments) ? state.v89.attachments : [];
  if(!text && !files.length) return;

  state.brainChats = state.brainChats || [];

  if(["clear","clear chat","new chat"].includes(text.toLowerCase())){
    state.brainChats = [];
    if(state.v87) state.v87.pending = null;
    if(state.v89) state.v89.attachments = [];
    saveState();
    renderV92AI();
    return;
  }

  if(["send to invoices","send to invoice","save to invoice","save to invoices"].includes(text.toLowerCase())){
    const ok = typeof v87SavePending === "function" && v87SavePending("invoice");
    state.brainChats.push({role:"ai", text: ok ? "Done. I sent that preview to Invoices." : "No preview found. Build an invoice first.", date:new Date().toLocaleString()});
    saveState();
    renderV92AI();
    return;
  }

  if(["send to quotes","send to quote","save to quote","save to quotes"].includes(text.toLowerCase())){
    const ok = typeof v87SavePending === "function" && v87SavePending("quote");
    state.brainChats.push({role:"ai", text: ok ? "Done. I sent that preview to Quotes." : "No preview found. Build a quote first.", date:new Date().toLocaleString()});
    saveState();
    renderV92AI();
    return;
  }

  state.brainChats.push({ role:"user", text: text || "Attached file(s)", date:new Date().toLocaleString() });

  if(files.length && files[0] && files[0].type && files[0].type.startsWith("image/")){
    state.brainChats.push({role:"user", text:"", kind:"attachment", meta:files[0], date:new Date().toLocaleString()});
  }

  const intent = typeof v87Intent === "function" ? v87Intent(text) : "general";
  if((intent === "invoice" || intent === "quote") && typeof v87BuildPreview === "function"){
    const p = v87BuildPreview(text, intent);
    state.v87 = state.v87 || {};
    state.v87.pending = p;
    const msg = "I built a " + intent + " preview. Review it first. If it looks good, say “send to invoices” or “send to quotes”.";
    state.brainChats.push({role:"ai", text:msg, html: typeof v91FormatPlainText==="function" ? v91FormatPlainText(msg) : msg, date:new Date().toLocaleString()});
    state.brainChats.push({role:"ai", text:"preview", kind:"preview", meta:p, date:new Date().toLocaleString()});
    if(state.v89) state.v89.attachments = [];
    saveState();
    renderV92AI();
    return;
  }

  try {
    const ans = await rw92AskBackend(text, files);
    state.brainChats.push({
      role:"ai",
      text: ans,
      html: typeof v91FormatPlainText === "function" ? v91FormatPlainText(ans) : ans,
      date:new Date().toLocaleString()
    });
  } catch(e) {
    const fallback = "Backend error: " + e.message + "\n\nThe backend is live, but this request failed. Check Render logs and API keys.";
    state.brainChats.push({
      role:"ai",
      text:fallback,
      html: typeof v91FormatPlainText === "function" ? v91FormatPlainText(fallback) : fallback,
      date:new Date().toLocaleString()
    });
  }

  if(state.v89) state.v89.attachments = [];
  saveState();
  renderV92AI();
}

function rw92RenderMessage(m){
  if(m.kind === "preview" && typeof v87PreviewHtml === "function") return v87PreviewHtml(m.meta);
  if(m.kind === "attachment" && typeof v89AttachmentPreviewHtml === "function") return v89AttachmentPreviewHtml(m.meta);
  if(typeof v91RenderMessage === "function") return v91RenderMessage(m);
  return '<div class="msg '+(m.role==="user"?"user":"ai")+'"><b>'+(m.role==="user"?"You":"RW AI")+'</b>'+String(m.text||"").replace(/\n/g,"<br>")+'</div>';
}

function renderV92AI(){
  rw92EnsureBackend();
  document.body.classList.add("rw-ai-mode");
  state.brainChats = state.brainChats || [];
  const ctx = (state.truck && state.truck.customer ? state.truck.customer : "No customer") + " • " + (state.truck && state.truck.unit ? state.truck.unit : "No truck") + " • " + (state.truck && state.truck.engine ? state.truck.engine : "Engine unknown");

  $("#screen").innerHTML = '<section class="rw8-shell">' +
    '<input id="v92FileInput" type="file" accept="image/*,.pdf,.txt,.csv,.json" multiple style="display:none">' +
    '<div class="rw8-head"><div class="rw8-brand"><div class="rw8-logo">RW</div><div><b>Rolling Wrench AI</b><small>'+ctx+'</small></div></div><div><span class="ai-live-badge">AI Online</span><button class="clear" id="v92Clear">Clear</button><button id="v92Close">Close</button></div></div>' +
    '<div class="rw8-thread" id="v92Thread">' +
    '<div class="rw8-chips">' +
    '<button data-v92-chip="How do I change a water pump on an X15?">X15 water pump</button>' +
    '<button data-v92-chip="What is the weather today in Albion Indiana?">Weather</button>' +
    '<button data-v92-chip="Build me an invoice for replacing water pump and belt">Invoice</button>' +
    '<button data-v92-chip="Build me a quote for clutch replacement on a 2014 Peterbilt ISX">Quote</button>' +
    '<button id="v92PhotoChip">Add Photo</button>' +
    '</div>' +
    (typeof v89AttachmentsHtml === "function" ? v89AttachmentsHtml() : "") +
    (state.brainChats.map(rw92RenderMessage).join("") || '<div class="msg ai"><b>RW AI</b><div class="ai-rich-answer"><h2>AI Online</h2><p>Connected to the live Rolling Wrench AI backend.</p><ul><li>Ask diesel questions</li><li>Ask general questions</li><li>Build quotes/invoices</li><li>Add photos/files</li></ul></div></div>') +
    '</div>' +
    '<div class="rw8-compose"><button class="plus" id="v92Plus">+</button><div class="inputbox"><input id="v92Input" placeholder="Ask Rolling Wrench AI anything..."><button class="mic" id="v92Mic">🎙</button></div><button class="sendbtn" id="v92Send">➤</button></div>' +
    '</section>';

  if(typeof bindPageTools === "function") bindPageTools();
  const th = $("#v92Thread"); if(th) th.scrollTop = th.scrollHeight;

  $("#v92Send").onclick = function(){ rw92RunAI($("#v92Input").value); };
  $("#v92Input").onkeydown = function(e){ if(e.key === "Enter") rw92RunAI($("#v92Input").value); };
  $("#v92Clear").onclick = function(){ state.brainChats = []; saveState(); renderV92AI(); };
  $("#v92Close").onclick = function(){ document.body.classList.remove("rw-ai-mode"); setRoute("home"); };
  $("#v92Plus").onclick = function(){ $("#v92FileInput").click(); };
  $("#v92PhotoChip").onclick = function(){ $("#v92FileInput").click(); };
  $("#v92FileInput").onchange = function(e){ if(typeof v89AddFiles === "function") v89AddFiles(e.target.files); };
  $("#v92Mic").onclick = function(){ if(typeof startVoiceToField === "function") startVoiceToField("v92Input"); else $("#v92Input").focus(); };
  $$("[data-v92-chip]").forEach(function(b){ b.onclick = function(){ rw92RunAI(b.dataset.v92Chip); }; });
}

window.renderV92AI = renderV92AI;
window.renderV91AI = renderV92AI;
window.renderV90A_AI = renderV92AI;
window.renderV90AI = renderV92AI;
window.renderV89AI = renderV92AI;
window.renderV88AI = renderV92AI;
window.renderV87AI = renderV92AI;
window.renderRW8Brain = renderV92AI;

setTimeout(function(){
  rw92EnsureBackend();
  const oldSetRouteV92 = window.setRoute || setRoute;
  window.setRoute = function(route){
    const r = String(route || "home").toLowerCase();
    if(r === "ai" || r === "brain" || r === "rwai"){ location.hash = "brain"; renderV92AI(); return; }
    oldSetRouteV92(route);
  };
},0);


/* ===== V9.2a PARTS ROUTER FIX ===== */
function rw92aLooksLikeParts(q){
  const s = String(q || "").toLowerCase();
  return (
    /\b\d{5,}\b/.test(s) ||
    s.includes("cross reference") ||
    s.includes("cross-reference") ||
    s.includes("xref") ||
    s.includes("part number") ||
    s.includes("part #") ||
    s.includes("p/n") ||
    s.includes(" pn") ||
    s.includes("oem") ||
    s.includes("fleetguard") ||
    s.includes("baldwin") ||
    s.includes("donaldson") ||
    s.includes("napa") ||
    s.includes("cummins part") ||
    s.includes("water pump") ||
    s.includes("belt") ||
    s.includes("clutch") ||
    s.includes("supplier")
  );
}
function rw92aLooksLikeWeather(q){
  const s = String(q || "").toLowerCase();
  return (
    s.includes("weather") ||
    s.includes("temperature") ||
    s.includes("forecast") ||
    s.includes("rain") ||
    s.includes("snow") ||
    s.includes("wind")
  );
}
async function rw92aAskBackend(prompt, files){
  rw92EnsureBackend();
  const q = String(prompt || "");
  const context = {
    truck: state.truck || {},
    settings: state.settings || {},
    pending: state.v87 ? state.v87.pending : null,
    recentQuotes: (state.quotes || []).slice(-5),
    recentInvoices: (state.invoices || []).slice(-5),
    repairMemory: (state.repairMemory || []).slice(0,10)
  };

  let url = state.backend.aiEndpoint;
  let routeName = "ai";

  if(files && files.length && state.backend.visionEndpoint){
    url = state.backend.visionEndpoint;
    routeName = "vision";
  } else if(rw92aLooksLikeParts(q) && state.backend.partsEndpoint){
    url = state.backend.partsEndpoint;
    routeName = "parts";
  } else if(rw92aLooksLikeWeather(q) && state.backend.webEndpoint){
    url = state.backend.webEndpoint;
    routeName = "search";
  }

  const data = await rw92Post(url, {
    prompt: q,
    question: q,
    route: routeName,
    context: context,
    files: files || []
  });

  return data.answer || data.text || data.message || data.content || JSON.stringify(data, null, 2);
}

/* Force all current and future calls to use fixed router. */
window.rw92AskBackend = rw92aAskBackend;
try { rw92AskBackend = rw92aAskBackend; } catch(e) {}


/* ===== V9.3 VIN DECODER + ACTIVE TRUCK MEMORY ===== */
function rw93ExtractVin(text){
  const m = String(text || "").toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/);
  return m ? m[0] : "";
}
function rw93LooksLikeVin(text){
  return !!rw93ExtractVin(text) || String(text || "").toLowerCase().includes("decode vin");
}
async function rw93AskVin(text){
  const vin = rw93ExtractVin(text);
  const data = await rw92Post(RW_LIVE_BACKEND_URL + "/api/vin", {
    vin: vin,
    prompt: text,
    context: { truck: state.truck || {}, settings: state.settings || {} }
  });
  if(data.truck){
    state.truck = Object.assign({}, state.truck || {}, data.truck);
    state.truck.unit = state.truck.unit || ((data.truck.year || "") + " " + (data.truck.make || "")).trim();
    state.trucks = state.trucks || [];
    const exists = state.trucks.find(t => String(t.vin || "").toUpperCase() === String(data.truck.vin || "").toUpperCase());
    if(!exists) state.trucks.unshift(state.truck);
    if(typeof saveState === "function") saveState();
  }
  return data.answer || JSON.stringify(data, null, 2);
}
const rw93PreviousAskBackend = typeof rw92AskBackend === "function" ? rw92AskBackend : null;
async function rw93AskBackend(prompt, files){
  if(rw93LooksLikeVin(prompt) && !(files && files.length)) return await rw93AskVin(prompt);
  if(rw93PreviousAskBackend) return await rw93PreviousAskBackend(prompt, files);
  return await rw92Post(RW_LIVE_BACKEND_URL + "/api/ai", { prompt });
}
window.rw92AskBackend = rw93AskBackend;
try { rw92AskBackend = rw93AskBackend; } catch(e) {}

const rw93PreviousRender = typeof renderV92AI === "function" ? renderV92AI : null;
function renderV93AI(){
  if(rw93PreviousRender) rw93PreviousRender();
  setTimeout(function(){
    const chips = document.querySelector(".rw8-chips");
    if(chips && !document.getElementById("rw93VinChip")){
      const b = document.createElement("button");
      b.id = "rw93VinChip";
      b.textContent = "VIN";
      b.onclick = function(){
        const input = document.getElementById("v92Input");
        if(input){ input.value = "Decode VIN "; input.focus(); }
      };
      chips.appendChild(b);
    }
  }, 50);
}
window.renderV93AI = renderV93AI;
window.renderV92AI = renderV93AI;
window.renderV91AI = renderV93AI;
window.renderRW8Brain = renderV93AI;


/* ===== V9.4 QUOTE SAVE / SEND TO QUOTES FIX ===== */
function rw94PendingQuote(){
  return (state.v87 && state.v87.pending) || state.pendingQuote || state.currentQuote || null;
}
function rw94SavePendingAs(type){
  const p = rw94PendingQuote();
  state.brainChats = state.brainChats || [];
  if(!p){
    state.brainChats.push({role:"ai", text:"No quote/invoice preview found. Build a quote first, then send it.", date:new Date().toLocaleString()});
    if(typeof saveState === "function") saveState();
    if(typeof renderV92AI === "function") renderV92AI();
    return false;
  }

  const item = Object.assign({}, p);
  item.id = item.id || Date.now();
  item.date = item.date || new Date().toLocaleDateString();
  item.createdAt = item.createdAt || new Date().toISOString();
  item.customer = item.customer || (state.truck && state.truck.customer) || "Add customer";
  item.truck = item.truck || (state.truck && (state.truck.unit || state.truck.vin)) || "No Active Truck";
  item.engine = item.engine || (state.truck && state.truck.engine) || "Cummins X15";
  item.status = type === "invoice" ? "Invoice Draft" : "Quote Draft";

  if(type === "invoice"){
    state.invoices = state.invoices || [];
    state.invoices.unshift(item);
    state.brainChats.push({role:"ai", text:"Done. I sent it to Invoices.", date:new Date().toLocaleString()});
  } else {
    state.quotes = state.quotes || [];
    state.quotes.unshift(item);
    state.brainChats.push({role:"ai", text:"Done. I sent it to Quotes.", date:new Date().toLocaleString()});
  }

  state.v87 = state.v87 || {};
  state.v87.pending = null;
  state.pendingQuote = null;
  state.currentQuote = null;

  if(typeof saveState === "function") saveState();
  if(typeof renderV92AI === "function") renderV92AI();
  return true;
}

window.v87SavePending = function(type){
  return rw94SavePendingAs(type === "invoice" ? "invoice" : "quote");
};
try { v87SavePending = window.v87SavePending; } catch(e) {}

document.addEventListener("click", function(e){
  const btn = e.target.closest("button");
  if(!btn) return;
  const t = String(btn.textContent || "").toLowerCase().trim();
  if(t.includes("send to quote")){
    e.preventDefault();
    e.stopPropagation();
    rw94SavePendingAs("quote");
  }
  if(t.includes("send to invoice")){
    e.preventDefault();
    e.stopPropagation();
    rw94SavePendingAs("invoice");
  }
}, true);

const rw94OldRunAI = typeof rw92RunAI === "function" ? rw92RunAI : null;
async function rw94RunAI(text){
  const s = String(text || "").toLowerCase().trim();
  if(["send to quotes","send to quote","save to quotes","save to quote","send quote to quotes"].includes(s)){
    return rw94SavePendingAs("quote");
  }
  if(["send to invoices","send to invoice","save to invoices","save to invoice","build invoice from this quote"].includes(s)){
    return rw94SavePendingAs("invoice");
  }
  if(rw94OldRunAI) return await rw94OldRunAI(text);
}
window.rw92RunAI = rw94RunAI;
try { rw92RunAI = rw94RunAI; } catch(e) {}


/* ===== V9.4a FORCE QUOTE PAGE SAVE + NAVIGATE ===== */
function rw94aGetPendingPreview(){
  return (state.v87 && state.v87.pending) || state.pendingQuote || state.currentQuote || state.lastPreview || null;
}
function rw94aFallbackQuote(){
  const chats = state.brainChats || [];
  const lastUser = [].slice.call(chats).reverse().find(function(m){ return m.role === "user" && String(m.text||"").toLowerCase().includes("quote"); });
  const text = lastUser ? lastUser.text : "Quote";
  if(typeof v87BuildPreview === "function"){
    const p = v87BuildPreview(text, "quote");
    state.v87 = state.v87 || {};
    state.v87.pending = p;
    return p;
  }
  return {
    id: Date.now(),
    type: "quote",
    title: "Quote",
    work: text,
    customer: (state.truck && state.truck.customer) || "Add customer",
    truck: (state.truck && (state.truck.unit || state.truck.vin)) || "No Active Truck",
    engine: (state.truck && state.truck.engine) || "Cummins X15",
    laborHours: 4,
    laborRate: 135,
    serviceCall: 250,
    parts: 0,
    supplies: 25,
    total: 815
  };
}
function rw94aOpenBusiness(){
  setTimeout(function(){
    try {
      if(typeof setRoute === "function") setRoute("business");
      else location.hash = "business";
    } catch(e) {
      location.hash = "business";
    }
  }, 150);
}
function rw94aSaveQuoteAndOpen(){
  state.quotes = state.quotes || [];
  let p = rw94aGetPendingPreview();
  if(!p) p = rw94aFallbackQuote();

  const q = Object.assign({}, p);
  q.id = q.id || Date.now();
  q.type = "quote";
  q.status = "Quote Draft";
  q.date = q.date || new Date().toLocaleDateString();
  q.createdAt = q.createdAt || new Date().toISOString();
  q.customer = q.customer || (state.truck && state.truck.customer) || "Add customer";
  q.truck = q.truck || (state.truck && (state.truck.unit || state.truck.vin)) || "No Active Truck";
  q.engine = q.engine || (state.truck && state.truck.engine) || "Cummins X15";

  state.quotes.unshift(q);
  state.v87 = state.v87 || {};
  state.v87.pending = null;
  state.pendingQuote = null;
  state.currentQuote = null;
  state.lastSavedQuoteId = q.id;

  state.brainChats = state.brainChats || [];
  state.brainChats.push({role:"ai", text:"Done. I saved it to Quotes and opened the quote page.", date:new Date().toLocaleString()});
  if(typeof saveState === "function") saveState();
  rw94aOpenBusiness();
  if(typeof renderV92AI === "function") renderV92AI();
  return true;
}
function rw94aSaveInvoiceAndOpen(){
  state.invoices = state.invoices || [];
  let p = rw94aGetPendingPreview();
  if(!p) p = rw94aFallbackQuote();

  const inv = Object.assign({}, p);
  inv.id = inv.id || Date.now();
  inv.type = "invoice";
  inv.status = "Invoice Draft";
  inv.date = inv.date || new Date().toLocaleDateString();
  inv.createdAt = inv.createdAt || new Date().toISOString();

  state.invoices.unshift(inv);
  state.v87 = state.v87 || {};
  state.v87.pending = null;
  state.pendingQuote = null;
  state.currentQuote = null;
  state.lastSavedInvoiceId = inv.id;

  state.brainChats = state.brainChats || [];
  state.brainChats.push({role:"ai", text:"Done. I saved it to Invoices and opened the business page.", date:new Date().toLocaleString()});
  if(typeof saveState === "function") saveState();
  rw94aOpenBusiness();
  if(typeof renderV92AI === "function") renderV92AI();
  return true;
}

window.v87SavePending = function(type){
  return type === "invoice" ? rw94aSaveInvoiceAndOpen() : rw94aSaveQuoteAndOpen();
};
try { v87SavePending = window.v87SavePending; } catch(e) {}

document.addEventListener("click", function(e){
  const btn = e.target.closest("button, .button, [role='button']");
  if(!btn) return;
  const t = String(btn.textContent || btn.value || "").toLowerCase();
  if(t.includes("send to quote") || t.includes("save to quote")){
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    rw94aSaveQuoteAndOpen();
    return false;
  }
  if(t.includes("send to invoice") || t.includes("save to invoice")){
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    rw94aSaveInvoiceAndOpen();
    return false;
  }
}, true);

const rw94aOldRunAI = typeof rw92RunAI === "function" ? rw92RunAI : null;
async function rw94aRunAI(text){
  const s = String(text || "").toLowerCase().trim();
  if(s.includes("send to quote") || s.includes("save to quote")) return rw94aSaveQuoteAndOpen();
  if(s.includes("send to invoice") || s.includes("save to invoice") || s.includes("build invoice from this quote")) return rw94aSaveInvoiceAndOpen();
  if(rw94aOldRunAI) return await rw94aOldRunAI(text);
}
window.rw92RunAI = rw94aRunAI;
try { rw92RunAI = rw94aRunAI; } catch(e) {}


/* ===== V9.4b PORTABLE CUSTOMER QUOTE LINKS ===== */
function rw94bB64Encode(obj){
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  } catch(e) {
    return "";
  }
}
function rw94bB64Decode(str){
  try {
    return JSON.parse(decodeURIComponent(escape(atob(String(str || "")))));
  } catch(e) {
    return null;
  }
}
function rw94bGetHashParts(){
  const raw = location.hash || "";
  const noHash = raw.replace(/^#/,"");
  const split = noHash.split("?");
  return { route: split[0] || "", query: split[1] || "" };
}
function rw94bGetHashParam(name){
  const q = rw94bGetHashParts().query;
  const params = new URLSearchParams(q);
  return params.get(name);
}
function rw94bCompactQuote(q){
  return {
    id: q.id || Date.now(),
    approvalId: q.approvalId || "",
    status: q.status || "Pending",
    date: q.date || new Date().toLocaleDateString(),
    customer: q.customer || "Customer",
    truck: q.truck || "Truck",
    engine: q.engine || "",
    desc: q.desc || q.work || q.title || "Quote",
    title: q.title || "Quote",
    hours: q.hours || q.laborHours || 0,
    rate: q.rate || q.laborRate || 0,
    serviceCall: q.serviceCall || q.call || 0,
    call: q.call || q.serviceCall || 0,
    travel: q.travel || 0,
    parts: q.parts || 0,
    supplies: q.supplies || 0,
    fees: q.fees || 0,
    misc: q.misc || 0,
    total: q.total || 0,
    partsSource: q.partsSource || "",
    partsList: q.partsList || q.parts || "",
    disclaimer: q.disclaimer || ""
  };
}

/* Override makeQuoteApproval so customer links contain quote payload. */
window.makeQuoteApproval = function(quoteIndex){
  ensureV63 && ensureV63();
  const q = state.quotes && state.quotes[quoteIndex];
  if(!q) return null;

  const id = q.approvalId || ("RWQ-" + Date.now());
  q.approvalId = id;
  q.status = q.status || "Pending";

  const compact = rw94bCompactQuote(q);
  compact.approvalId = id;

  const data = rw94bB64Encode(compact);
  const link = `${location.origin}${location.pathname}#quoteapproval-${id}?q=${encodeURIComponent(data)}`;

  state.quoteApprovals = state.quoteApprovals || [];
  let rec = state.quoteApprovals.find(a => a.id === id);
  if(!rec){
    rec = {id, quoteIndex, link, status:q.status, created:new Date().toLocaleString(), customer:q.customer || "", total:q.total || 0};
    state.quoteApprovals.unshift(rec);
  } else {
    Object.assign(rec, {quoteIndex, link, status:q.status, customer:q.customer || "", total:q.total || 0});
  }

  if(typeof saveState === "function") saveState();
  return {id, link, quote:q};
};
try { makeQuoteApproval = window.makeQuoteApproval; } catch(e) {}

function rw94bImportQuoteFromLink(id){
  const payload = rw94bGetHashParam("q");
  if(!payload) return null;
  const q = rw94bB64Decode(payload);
  if(!q) return null;

  state.quotes = state.quotes || [];
  state.quoteApprovals = state.quoteApprovals || [];

  q.approvalId = q.approvalId || id;
  q.status = q.status || "Pending";

  let index = state.quotes.findIndex(x => x.approvalId === id);
  if(index < 0){
    state.quotes.unshift(q);
    index = 0;
  } else {
    state.quotes[index] = Object.assign({}, state.quotes[index], q);
  }

  let rec = state.quoteApprovals.find(a => a.id === id);
  const cleanLink = `${location.origin}${location.pathname}#quoteapproval-${id}?q=${encodeURIComponent(payload)}`;
  if(!rec){
    state.quoteApprovals.unshift({id, quoteIndex:index, link:cleanLink, status:q.status, customer:q.customer || "", total:q.total || 0, imported:true, created:new Date().toLocaleString()});
  }

  if(typeof saveState === "function") saveState();
  return {quote:q, index};
}

/* Override quote finder so customer phone can load quote from link payload. */
window.findQuoteByApprovalId = function(id){
  ensureV63 && ensureV63();
  state.quotes = state.quotes || [];
  state.quoteApprovals = state.quoteApprovals || [];

  let index = state.quotes.findIndex(q => q.approvalId === id);
  if(index < 0){
    const rec = state.quoteApprovals.find(a => a.id === id);
    if(rec) index = rec.quoteIndex;
  }
  if(index >= 0 && state.quotes[index]) return {quote:state.quotes[index], index};

  const imported = rw94bImportQuoteFromLink(id);
  if(imported) return imported;

  return {quote:null, index:-1};
};
try { findQuoteByApprovalId = window.findQuoteByApprovalId; } catch(e) {}

/* Override approval portal with portable quote support. */
window.renderQuoteApprovalPortal = function(id){
  ensureV63 && ensureV63();
  const f = findQuoteByApprovalId(id);
  const q = f.quote;

  if(!q){
    $("#screen").innerHTML = `${pageHead("Quote Approval","",false)}
    <section class="error-panel">
      <b>Quote Not Found</b>
      <p>This approval link is missing the quote data. Ask Rolling Wrench Diesel to resend the newest link.</p>
    </section>`;
    if(typeof bindPageTools === "function") bindPageTools();
    return;
  }

  const legal = typeof quoteLegalText === "function" ? quoteLegalText() : "Customer approval authorizes the listed estimate. Price may vary due to added labor, hidden damage, parts availability, taxes/fees, or approved extra work.";
  const statusPill = typeof quoteStatusPill === "function" ? quoteStatusPill(q.status || "Pending") : `<b>${q.status || "Pending"}</b>`;

  $("#screen").innerHTML = `${pageHead("Quote Approval","",false)}
  <section class="customer-approval-card">
    <div class="approval-header"><div class="approval-logo">RW</div><div><h2>Quote Approval</h2><p>Rolling Wrench Diesel LLC</p></div></div>
    <div>${statusPill}</div>
    <div class="approval-summary">
      <div class="approval-box"><b>Customer</b><span>${q.customer || "Customer"}</span></div>
      <div class="approval-box"><b>Truck / VIN</b><span>${q.truck || "Truck"}</span></div>
      <div class="approval-box"><b>Repair</b><span>${q.desc || q.work || "Repair estimate"}</span></div>
      <div class="approval-box"><b>Estimated Total</b><span>${typeof money === "function" ? money(q.total || 0) : "$" + (q.total || 0)}</span></div>
    </div>
    <div class="approval-legal"><b>Authorization Terms:</b><br>${legal}</div>
    ${typeof signatureBlock === "function" ? signatureBlock("customerQuote","Customer / Driver Approval Signature") : ""}
    <label>Printed Name<input id="approvalName" placeholder="Customer / driver name"></label>
    <label>Decline Reason / Notes<textarea id="declineReason" placeholder="Only needed if declining"></textarea></label>
    <div class="approval-actions"><button class="approve" id="approveQuoteBtn">Approve & Sign</button><button class="decline" id="declineQuoteBtn">Decline</button></div>
  </section>`;
  if(typeof bindPageTools === "function") bindPageTools();
  if(typeof setupSignaturePad === "function") setupSignaturePad("customerQuote");

  $("#approveQuoteBtn").onclick = () => {
    const sig = typeof saveSignature === "function" ? saveSignature("customerQuote") : null;
    if(typeof approveQuote === "function" && approveQuote(id, $("#approvalName").value, sig)){
      if(typeof toast === "function") toast("Quote approved");
      renderQuoteApprovalPortal(id);
    }
  };
  $("#declineQuoteBtn").onclick = () => {
    if(typeof declineQuote === "function" && declineQuote(id, $("#approvalName").value, $("#declineReason").value)){
      if(typeof toast === "function") toast("Quote declined");
      renderQuoteApprovalPortal(id);
    }
  };
};
try { renderQuoteApprovalPortal = window.renderQuoteApprovalPortal; } catch(e) {}

/* Refresh quote link boxes to show portable links. */
const rw94bOldRenderQuoteSendCenter = typeof renderQuoteSendCenter === "function" ? renderQuoteSendCenter : null;
function renderQuoteSendCenterPortable(){
  if(rw94bOldRenderQuoteSendCenter) rw94bOldRenderQuoteSendCenter();
  setTimeout(() => {
    (state.quotes || []).forEach((q, i) => {
      if(q.approvalId){
        const compact = rw94bCompactQuote(q);
        compact.approvalId = q.approvalId;
        const data = rw94bB64Encode(compact);
        const link = `${location.origin}${location.pathname}#quoteapproval-${q.approvalId}?q=${encodeURIComponent(data)}`;
        const box = document.getElementById("quoteLink_" + i);
        if(box) box.textContent = link;
      }
    });
  }, 50);
}
window.renderQuoteSendCenter = renderQuoteSendCenterPortable;
try { renderQuoteSendCenter = renderQuoteSendCenterPortable; } catch(e) {}


/* ===== V9.4c LIVE PARTS LOOKUP PAGE FIX ===== */
async function rw94cRunPartsLookup(){
 try{
   const q=(document.querySelector('textarea')?.value||document.querySelector('input')?.value||'').trim();
   const box=document.getElementById('rw94cPartsResult')||(()=>{const d=document.createElement('div');d.id='rw94cPartsResult';document.body.appendChild(d);return d;})();
   box.innerHTML='Searching Parts Master...';
   const url=(window.RW_LIVE_BACKEND_URL||'https://rolling-wrench-ai-backend.onrender.com')+'/api/parts';
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:q,route:'parts'})});
   const data=await res.json();
   box.innerHTML='<h3>PARTS MASTER RESULT</h3><pre>'+((data.answer||data.message||JSON.stringify(data,null,2)))+'</pre>';
 }catch(e){console.error(e);}
}


/* ===== V9.5 SUPABASE EDGE FUNCTION CONNECTOR ===== */
const RW_SUPABASE_URL = "https://uxpkqwcmvtqvubibbrek.supabase.co";
const RW_SUPABASE_FUNCTIONS = RW_SUPABASE_URL + "/functions/v1";

function rw95AnonKey(){
  try {
    return (state && state.settings && (state.settings.supabaseAnonKey || state.settings.SUPABASE_ANON_KEY)) ||
      localStorage.getItem("RW_SUPABASE_ANON_KEY") || "";
  } catch(e) {
    return localStorage.getItem("RW_SUPABASE_ANON_KEY") || "";
  }
}
function rw95Headers(){
  const key = rw95AnonKey();
  const h = {"Content-Type":"application/json"};
  if(key){ h["apikey"] = key; h["Authorization"] = "Bearer " + key; }
  return h;
}
async function rw95CallFunction(name, payload){
  const res = await fetch(`${RW_SUPABASE_FUNCTIONS}/${name}`, {
    method:"POST",
    headers: rw95Headers(),
    body: JSON.stringify(payload || {})
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch(e) { data = {text:txt}; }
  if(!res.ok) throw new Error(data.error || data.message || txt || `${name} failed`);
  return data;
}
function rw95Answer(data){
  return data.answer || data.response || data.text || data.message || data.content || data.result || JSON.stringify(data,null,2);
}
function rw95LooksParts(q){
  const s=String(q||"").toLowerCase();
  return /\b\d{5,}\b/.test(s) || s.includes("cross reference") || s.includes("part number") || s.includes("oem") || s.includes("water pump") || s.includes("supplier") || s.includes("fleetguard") || s.includes("baldwin") || s.includes("donaldson") || s.includes("wix") || s.includes("napa");
}
function rw95LooksQuote(q){const s=String(q||"").toLowerCase();return s.includes("build quote")||s.includes("quote for")||s.includes("estimate");}
function rw95LooksInvoice(q){const s=String(q||"").toLowerCase();return s.includes("build invoice")||s.includes("invoice for");}
function rw95LooksTruck(q){const s=String(q||"").toLowerCase();return s.includes("truck search")||s.includes("find truck")||s.includes("decode vin")||/[A-HJ-NPR-Z0-9]{17}/i.test(s);}

async function rw95AskSupabase(prompt, files){
  const q=String(prompt||"");
  const context={truck:state.truck||{},customer:state.customer||{},settings:state.settings||{},quotes:(state.quotes||[]).slice(0,5),invoices:(state.invoices||[]).slice(0,5)};
  let fn="diesel-doc-ai";
  let payload={prompt:q,question:q,query:q,context};
  if(files&&files.length){fn="rolling-wrench-vision-ai";payload.files=files;}
  else if(rw95LooksQuote(q)) fn="build-quote";
  else if(rw95LooksInvoice(q)) fn="build-invoice";
  else if(rw95LooksParts(q)) fn="oracle-parts-search";
  else if(rw95LooksTruck(q)) fn="truck-search";
  try{
    const data=await rw95CallFunction(fn,payload);
    if(fn==="build-quote" && data.quote){state.v87=state.v87||{};state.v87.pending=data.quote;state.currentQuote=data.quote;if(typeof saveState==="function")saveState();}
    if(fn==="build-invoice" && data.invoice){state.currentInvoice=data.invoice;if(typeof saveState==="function")saveState();}
    if(fn==="truck-search" && data.truck){state.truck=Object.assign({},state.truck||{},data.truck);if(typeof saveState==="function")saveState();}
    return rw95Answer(data);
  }catch(err){
    if(typeof rw92AskBackend==="function" && rw92AskBackend!==rw95AskSupabase){
      try{return (await rw92AskBackend(prompt,files))+`\n\n---\nSupabase route tried: ${fn}\nSupabase error: ${err.message}`;}catch(e){}
    }
    throw err;
  }
}
window.rw95AskSupabase=rw95AskSupabase;
try{window.rw92AskBackend=rw95AskSupabase;rw92AskBackend=rw95AskSupabase;}catch(e){}

window.rw95PartsSearch=async function(query){return await rw95CallFunction("oracle-parts-search",{prompt:query,query,context:{truck:state.truck||{},settings:state.settings||{}}});};
window.rw95VerifyPartWeb=async function(query){return await rw95CallFunction("verify-part-web",{prompt:query,query,context:{truck:state.truck||{},settings:state.settings||{}}});};
window.rw95BuildQuote=async payload=>await rw95CallFunction("build-quote",payload);
window.rw95BuildInvoice=async payload=>await rw95CallFunction("build-invoice",payload);
window.rw95ConvertQuoteToInvoice=async payload=>await rw95CallFunction("convert-quote-to-invoice",payload);
window.rw95SaveCustomer=async customer=>await rw95CallFunction("save-customer",{customer});
window.rw95SaveTruck=async truck=>await rw95CallFunction("save-truck",{truck});
window.rw95GetDashboard=async()=>await rw95CallFunction("get-dashboard",{context:{truck:state.truck||{}}});

async function rw95LivePartsLookupFromPage(){
  const inputs=Array.from(document.querySelectorAll("input, textarea"));
  const q=inputs.map(x=>x.value).filter(Boolean).join("\n").trim();
  let box=document.getElementById("rw95PartsResult");
  if(!box){
    box=document.createElement("div");
    box.id="rw95PartsResult";
    box.style.cssText="margin:16px 24px 120px;padding:16px;border:1px solid #ff7a18;border-radius:18px;background:#0d141c;color:white;white-space:pre-wrap;font-size:18px;line-height:1.45";
    (document.querySelector("#screen")||document.body).appendChild(box);
  }
  if(!q){box.textContent="Add a part number, VIN, engine, or description first.";return;}
  box.textContent="Searching Supabase Oracle Parts...";
  try{
    const data=await rw95PartsSearch(q);
    box.innerHTML=`<b style="color:#ff7a18">PARTS MASTER RESULT</b><br><br>${String(rw95Answer(data)).replace(/\n/g,"<br>")}`;
  }catch(e){box.textContent="Parts search error: "+e.message;}
}
document.addEventListener("click",function(e){
  const btn=e.target.closest("button, .button, [role='button']");
  if(!btn)return;
  const text=String(btn.textContent||"").toLowerCase();
  const screenText=String(document.body.textContent||"").toLowerCase();
  if(screenText.includes("parts lookup")&&(text.includes("build search")||text.includes("fill"))){
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    rw95LivePartsLookupFromPage();
    return false;
  }
},true);

window.rw95SetSupabaseAnonKey=function(key){
  localStorage.setItem("RW_SUPABASE_ANON_KEY",key||"");
  state.settings=state.settings||{};
  state.settings.supabaseAnonKey=key||"";
  if(typeof saveState==="function")saveState();
  return true;
};
window.RW_BUILD_VERSION="V9.5 Supabase Connector";
