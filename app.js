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
function totalSeconds(){ return Object.values(state.jobs).reduce((a,j)=>a+Number(j.seconds||0),0); }
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

    <div class="rwd-ai-bar" data-route="ai">
      <div class="ai-orb">RW</div>
      <div class="ai-copy">
        <strong>Ask Rolling Wrench AI</strong>
        <span>+ photos/files • voice • camera • VIN • parts • invoices • documents</span>
      </div>
      <div class="ai-tools">
        <button type="button" data-route="ai">＋</button>
        <button type="button" data-route="ai">🎙</button>
        <button type="button" data-route="camera">📷</button>
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

    <section class="system-strip">
      <div class="status-box"><b>GPS</b><span>Ready</span><i></i></div>
      <div class="status-box"><b>Camera</b><span>Ready</span><i></i></div>
      <div class="status-box"><b>Storage</b><span>Local</span><i></i></div>
      <div class="status-box"><b>Buttons</b><span>Pass</span><i></i></div>
    </section>`;
}
function scheduleRows(){
  const list = state.schedule.slice(0,3);
  if(!list.length) return `<div class="schedule-row"><time>--</time><div><b>No jobs scheduled</b><small>Tap Schedule to add one</small></div><span></span></div>`;
  return list.map(x=>`<div class="schedule-row"><time>${x.time || "--"}</time><div><b>${x.customer || "Customer"}</b><small>${x.job || "Job"} • ${x.location || "Location"}</small></div><span class="badge">${x.tech || ""}</span></div>`).join("");
}
function recentRows(){
  const recent = [...state.workorders.map(x=>({type:"WO",...x})), ...state.invoices.map(x=>({type:"INV",...x})), ...state.quotes.map(x=>({type:"QUOTE",...x}))].slice(-3).reverse();
  if(!recent.length) return `<div class="job-row"><b>--</b><div><b>No recent jobs</b><small>Create a work order or invoice</small></div><span></span></div>`;
  return recent.map(x=>`<div class="job-row"><b>${x.type}</b><div><b>${x.customer || "Customer"}</b><small>${x.desc || x.work || x.job || "Saved item"}</small></div><span class="badge">SAVED</span></div>`).join("");
}

function renderClock(){
  $("#screen").innerHTML = `${pageHead("3 Job Time Clock","saveAllClock",false)}
    <section class="summary-card">
      <div><span>Total Time</span><b id="clockTotalTime">${formatTime(totalSeconds())}</b></div>
      <div><span>Total Labor</span><b id="clockTotalMoney">${money(clockDollars(totalSeconds()))}</b></div>
      <div><span>Rate</span><b>${money(state.settings.laborRate)}/hr</b></div>
    </section>
    <section class="clock-page-grid">
      ${Object.entries(state.jobs).map(([id,j])=>jobClockCard(id,j)).join("")}
    </section>`;
  bindPageTools();
  $("#saveAllClock").onclick=()=>{ Object.entries(state.jobs).forEach(([id,j])=>saveClock(id,false)); saveState(); toast("All clocks saved"); renderClock(); };
}
function jobClockCard(id,j){
  return `<article class="job-clock-card">
    <div class="job-head"><h3>${j.name || id.toUpperCase()}</h3><span class="badge">${j.running ? "RUNNING" : (j.status || "READY")}</span></div>
    <div class="two-col">
      <label>Job Name<input id="${id}_name" value="${j.name || ""}"></label>
      <label>Customer<input id="${id}_customer" value="${j.customer || ""}"></label>
    </div>
    <div class="job-time" id="${id}_time">${formatTime(j.seconds)}</div>
    <div class="job-money" id="${id}_money">${money(clockDollars(j.seconds))}</div>
    <div class="job-controls">
      <button class="start" data-clock="start" data-job="${id}">Start</button>
      <button class="pause" data-clock="pause" data-job="${id}">Pause</button>
      <button class="stop" data-clock="stop" data-job="${id}">Stop</button>
      <button data-clock="save" data-job="${id}">Save</button>
      <button class="clear" data-clock="clear" data-job="${id}">Clear</button>
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
  j.saved.push({name:j.name,customer:j.customer,seconds:j.seconds,labor:clockDollars(j.seconds),date:new Date().toLocaleString()});
  j.status="SAVED";
  saveState();
  if(show) toast(`${j.name} saved`);
}

function renderTruck(){
  const t=state.truck;
  $("#screen").innerHTML = `${pageHead("Truck Profile","saveTruck")}
    <section class="form-panel form-grid">
      <div class="two-col">
        <label>Unit Number<input id="truckUnit" value="${t.unit || ""}"></label>
        <label>Customer<input id="truckCustomer" value="${t.customer || ""}"></label>
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
      ${panelOutput("Active truck data follows parts, quotes, invoices, schedule, and work orders.")}
    </section>`;
  bindPageTools();
  $("#saveTruck").onclick=()=>{ state.truck={unit:$("#truckUnit").value,customer:$("#truckCustomer").value,vin:$("#truckVin").value,engine:$("#truckEngine").value,transmission:$("#truckTrans").value,cpl:$("#truckCpl").value,mileage:$("#truckMileage").value}; saveState(); toast("Truck saved"); renderTruck(); };
}

function renderAi(){
  $("#screen").innerHTML = `${pageHead("Rolling Wrench AI","saveAi")}
    <section class="v42-ai-page">
      <div class="ai-chat-shell">
        <div class="ai-chat-header">
          <div class="ai-orb">RW</div>
          <div>
            <h3>Ask Rolling Wrench AI</h3>
            <p>Voice • camera • photos • files • documents • shop workflow</p>
          </div>
          <div class="voice-status"><i class="voice-dot"></i><span id="voiceState">Ready</span></div>
        </div>

        <div class="ai-attach-grid">
          <button class="ai-attach" id="attachPhoto"><span>🖼</span><b>Add Photo</b></button>
          <button class="ai-attach" id="takePicture"><span>📷</span><b>Take Picture</b></button>
          <button class="ai-attach" id="scanDoc"><span>📄</span><b>Scan Document</b></button>
          <button class="ai-attach" id="scanInvoice"><span>🧾</span><b>Scan Invoice</b></button>
          <button class="ai-attach" id="scanPart"><span>📦</span><b>Part Box / Label</b></button>
          <button class="ai-attach" id="scanVin"><span>🚚</span><b>VIN Plate</b></button>
        </div>

        <input id="aiFileInput" type="file" accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xlsx" multiple hidden>
        <input id="aiCameraInput" type="file" accept="image/*" capture="environment" hidden>

        <div class="ai-composer">
          <button id="plusAttach" title="Add file">＋</button>
          <textarea id="aiAsk" placeholder="Ask anything... Example: identify this part, build invoice, decode VIN, SPN 3251 FMI 2, create work order..."></textarea>
          <button id="voiceBtn" title="Voice">🎙</button>
          <button id="sendAi" class="hide-small" title="Send">➤</button>
        </div>

        <div class="ai-response" id="aiOut">Attach a photo, scan a document, use voice, or type a question. Rolling Wrench AI will route it to Truck, Parts, Fault Doctor, Quotes, Invoices, Work Orders, Schedule, Pin Drop, or Repair Memory.</div>

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

  const fileInput = $("#aiFileInput");
  const camInput = $("#aiCameraInput");
  const attach = label => {
    fileInput.click();
    $("#aiOut").textContent = `${label} selected.\n\nAfter upload/scan, Rolling Wrench AI will read it and route it to the correct module.`;
  };

  $("#plusAttach").onclick=()=>attach("Add file/photo/document");
  $("#attachPhoto").onclick=()=>attach("Photo");
  $("#scanDoc").onclick=()=>attach("Document");
  $("#scanInvoice").onclick=()=>attach("Invoice");
  $("#takePicture").onclick=()=>camInput.click();
  $("#scanPart").onclick=()=>camInput.click();
  $("#scanVin").onclick=()=>camInput.click();

  fileInput.onchange=()=>{
    const names=[...fileInput.files].map(f=>f.name).join(", ");
    $("#aiOut").textContent=`Attached: ${names}\n\nAsk what you want me to do with it: identify part, read invoice, decode VIN, build quote, save to job, or create work order.`;
  };
  camInput.onchange=()=>{
    const name=camInput.files[0]?.name || "camera photo";
    $("#aiOut").textContent=`Captured: ${name}\n\nTell Rolling Wrench AI what this is: VIN plate, part box, fault screen, invoice, damaged part, or document.`;
  };

  $("#voiceBtn").onclick=()=>{
    const supported = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    if(!supported){
      $("#voiceState").textContent="Voice Text";
      $("#aiOut").textContent="Voice recognition is not available in this browser yet. Tap the text box and use your phone keyboard microphone for now.";
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang="en-US"; rec.interimResults=false; rec.maxAlternatives=1;
    $("#voiceState").textContent="Listening";
    rec.onresult=e=>{ $("#aiAsk").value=e.results[0][0].transcript; $("#voiceState").textContent="Ready"; runAiCommand(); };
    rec.onerror=()=>{ $("#voiceState").textContent="Ready"; toast("Voice stopped"); };
    rec.onend=()=>$("#voiceState").textContent="Ready";
    rec.start();
  };

  function runAiCommand(){
    const q=$("#aiAsk").value.toLowerCase();
    let dest="repairhud", answer="I can help with that. ";
    if(q.includes("invoice")){ dest="invoices"; answer+="This should go to Professional Invoices."; }
    else if(q.includes("quote") || q.includes("estimate")){ dest="quotes"; answer+="This should go to Smart Quotes."; }
    else if(q.includes("work order") || q.includes("job")){ dest="workorders"; answer+="This should create or update a Work Order."; }
    else if(q.includes("part") || q.includes("water pump") || q.includes("belt") || q.includes("box") || q.includes("label")){ dest="parts"; answer+="This should go to Parts Lookup."; }
    else if(q.includes("vin") || q.includes("truck")){ dest="truck"; answer+="This should update the Active Truck / VIN profile."; }
    else if(q.includes("schedule") || q.includes("appointment")){ dest="schedule"; answer+="This should go to Schedule."; }
    else if(q.includes("pin") || q.includes("gps") || q.includes("location")){ dest="pindrop"; answer+="This should save a Pin Drop location."; }
    else if(q.includes("fault") || q.includes("spn") || q.includes("fmi") || q.includes("code")){ dest="fault"; answer+="This should open Fault Doctor."; }
    $("#aiOut").textContent = `${answer}\n\nRecommended destination: ${dest.toUpperCase()}\n\nNext step: save it below or open that module.`;
  }
  $("#sendAi").onclick=runAiCommand;
  $("#saveAi").onclick=()=>{ state.notes.push({type:"AI",note:$("#aiAsk").value,response:$("#aiOut").textContent,date:new Date().toLocaleString()}); saveState(); toast("AI note saved"); };

  $$("[data-save-ai]").forEach(btn=>btn.onclick=()=>{
    const type=btn.dataset.saveAi;
    const note={source:"Rolling Wrench AI",note:$("#aiAsk").value,response:$("#aiOut").textContent,date:new Date().toLocaleString()};
    if(type==="truck"){ state.notes.push({type:"Truck AI",...note}); }
    if(type==="parts"){ state.parts.push({query:$("#aiAsk").value,notes:$("#aiOut").textContent}); }
    if(type==="workorders"){ state.workorders.push({customer:state.truck.customer,truck:state.truck.unit,desc:$("#aiAsk").value,status:"Open"}); }
    if(type==="quotes"){ state.quotes.push({customer:state.truck.customer,desc:$("#aiAsk").value,total:0}); }
    if(type==="invoices"){ state.invoices.push({customer:state.truck.customer,truck:state.truck.unit,work:$("#aiAsk").value,total:0}); }
    if(type==="memory"){ state.notes.push({type:"Repair Memory",...note}); }
    saveState(); toast(`Saved to ${type}`);
  });
}

function renderParts(){
  $("#screen").innerHTML = `${pageHead("Parts Lookup","savePart")}
    <section class="form-panel form-grid">
      <label>Search<input id="partSearch" placeholder="VIN, engine, part number, description"></label>
      <div class="two-col"><label>Verified Part #<input id="partNumber"></label><label>Supplier / Price<input id="partSupplier"></label></div>
      <label>Notes<textarea id="partNotes" placeholder="Cross reference, fitment, source, availability"></textarea></label>
      <button class="action-btn" id="partBuild">Build Search</button>
      <div class="output" id="partOut">Rule: exact OEM or UNKNOWN until verified by VIN/OEM/supplier.</div>
    </section>`;
  bindPageTools();
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

function renderQuotes(){
  $("#screen").innerHTML = `${pageHead("Smart Quotes","saveQuote")}
    <section class="form-panel form-grid">
      <label>Customer<input id="quoteCustomer" value="${state.truck.customer || ""}"></label>
      <label>Job Description<textarea id="quoteDesc"></textarea></label>
      <div class="two-col"><label>Labor Hours<input id="quoteHours" type="number" step=".1"></label><label>Rate<input id="quoteRate" type="number" value="${state.settings.laborRate}"></label></div>
      <div class="two-col"><label>Parts<input id="quoteParts" type="number" step=".01"></label><label>Service Call<input id="quoteCall" type="number" value="${state.settings.serviceCall}"></label></div>
      <button class="action-btn" id="previewQuote">Preview</button>
      <div class="output" id="quoteOut">Quote preview.</div>
    </section>`;
  bindPageTools();
  const calc=()=> (+$("#quoteHours").value||0)*(+$("#quoteRate").value||0)+(+$("#quoteParts").value||0)+(+$("#quoteCall").value||0);
  $("#previewQuote").onclick=()=>{$("#quoteOut").textContent=`ROLLING WRENCH DIESEL QUOTE\nCustomer: ${$("#quoteCustomer").value}\nJob: ${$("#quoteDesc").value}\nEstimate: ${money(calc())}\nPrices subject to change until approved.`};
  $("#saveQuote").onclick=()=>{ state.quotes.push({customer:$("#quoteCustomer").value,desc:$("#quoteDesc").value,total:calc(),date:new Date().toLocaleString()}); saveState(); toast("Quote saved"); };
}

function renderInvoices(){
  $("#screen").innerHTML = `${pageHead("Professional Invoice","saveInvoice")}
    <section class="form-panel form-grid">
      <label>Bill To<input id="invCustomer" value="${state.truck.customer || ""}"></label>
      <label>Truck / VIN<input id="invTruck" value="${state.truck.unit || ""} ${state.truck.vin || ""}"></label>
      <label>Work Performed<textarea id="invWork" placeholder="Complaint, cause, correction, final check..."></textarea></label>
      <div class="two-col"><label>Labor Hours<input id="invHours" type="number" step=".1"></label><label>Rate<input id="invRate" type="number" value="${state.settings.laborRate}"></label></div>
      <div class="two-col"><label>Parts<input id="invParts" type="number" step=".01"></label><label>Service Call<input id="invCall" type="number" value="${state.settings.serviceCall}"></label></div>
      <div class="two-col"><label>Supplies<input id="invSupplies" type="number" step=".01"></label><label>Tax / Fees<input id="invFees" type="number" step=".01"></label></div>
      <button class="action-btn" id="previewInv">Preview Invoice</button>
      <div class="output" id="invOut">Invoice preview.</div>
    </section>`;
  bindPageTools();
  const calc=()=> (+$("#invHours").value||0)*(+$("#invRate").value||0)+(+$("#invParts").value||0)+(+$("#invCall").value||0)+(+$("#invSupplies").value||0)+(+$("#invFees").value||0);
  $("#previewInv").onclick=()=>{$("#invOut").textContent=`ROLLING WRENCH DIESEL\nPROFESSIONAL INVOICE\nBill To: ${$("#invCustomer").value}\nTruck: ${$("#invTruck").value}\nWork Performed:\n${$("#invWork").value}\n\nTOTAL DUE: ${money(calc())}`};
  $("#saveInvoice").onclick=()=>{ state.invoices.push({customer:$("#invCustomer").value,truck:$("#invTruck").value,work:$("#invWork").value,total:calc(),date:new Date().toLocaleString()}); saveState(); toast("Invoice saved"); };
}

function renderWorkOrders(){
  $("#screen").innerHTML = `${pageHead("Work Orders","saveWO")}
    <section class="form-panel form-grid">
      <div class="two-col"><label>Customer<input id="woCustomer" value="${state.truck.customer || ""}"></label><label>Truck<input id="woTruck" value="${state.truck.unit || ""}"></label></div>
      <label>Complaint<textarea id="woComplaint"></textarea></label>
      <label>Cause<textarea id="woCause"></textarea></label>
      <label>Correction<textarea id="woCorrection"></textarea></label>
      <label>Status<select id="woStatus"><option>Open</option><option>Diagnosing</option><option>Waiting Parts</option><option>In Progress</option><option>Complete</option><option>Invoiced</option></select></label>
      <div class="output">${state.workorders.map(w=>`${w.status}: ${w.customer} — ${w.desc}`).join("\n") || "No saved work orders."}</div>
    </section>`;
  bindPageTools();
  $("#saveWO").onclick=()=>{ state.workorders.push({customer:$("#woCustomer").value,truck:$("#woTruck").value,desc:$("#woComplaint").value,cause:$("#woCause").value,correction:$("#woCorrection").value,status:$("#woStatus").value,date:new Date().toLocaleString()}); saveState(); toast("Work order saved"); };
}

function renderSchedule(){
  $("#screen").innerHTML = `${pageHead("Schedule","saveSchedule")}
    <section class="form-panel form-grid">
      <div class="two-col"><label>Date<input id="schedDate" type="date"></label><label>Time<input id="schedTime" type="time"></label></div>
      <label>Customer<input id="schedCustomer" value="${state.truck.customer || ""}"></label>
      <label>Job<input id="schedJob" placeholder="PM, roadside, clutch, brakes..."></label>
      <label>Location<input id="schedLocation"></label>
      <label>Tech<input id="schedTech" placeholder="James / David / Stephani"></label>
      <button class="action-btn" data-route="pindrop">Open Pin Drop</button>
      <div class="output">${state.schedule.map(x=>`${x.date || ""} ${x.time || ""} — ${x.customer || ""} — ${x.job || ""} — ${x.location || ""}`).join("\n") || "No saved schedule."}</div>
    </section>`;
  bindPageTools();
  $("#saveSchedule").onclick=()=>{ state.schedule.push({date:$("#schedDate").value,time:$("#schedTime").value,customer:$("#schedCustomer").value,job:$("#schedJob").value,location:$("#schedLocation").value,tech:$("#schedTech").value}); saveState(); toast("Schedule saved"); renderSchedule(); };
}

function renderCustomers(){
  $("#screen").innerHTML = `${pageHead("Customers","saveCustomer")}
    <section class="form-panel form-grid">
      <label>Customer / Company<input id="custName"></label>
      <div class="two-col"><label>Phone<input id="custPhone"></label><label>Email<input id="custEmail"></label></div>
      <label>Notes<textarea id="custNotes"></textarea></label>
      <div class="output">${state.customers.map(c=>`${c.name} • ${c.phone} • ${c.email}`).join("\n") || "No saved customers."}</div>
    </section>`;
  bindPageTools();
  $("#saveCustomer").onclick=()=>{ state.customers.push({name:$("#custName").value,phone:$("#custPhone").value,email:$("#custEmail").value,notes:$("#custNotes").value}); saveState(); toast("Customer saved"); renderCustomers(); };
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
  $("#screen").innerHTML = `${pageHead("Camera / OCR","saveCamera")}
    <section class="form-panel form-grid">
      <p class="muted">Camera/OCR workflow shell for VIN, part label, fault screen, document, or truck photo.</p>
      <label>Scan Notes<textarea id="cameraNotes"></textarea></label>
      <button class="action-btn primary">Open Camera</button>
      ${panelOutput("Browser camera permission required on HTTPS.")}
    </section>`;
  bindPageTools();
  $("#saveCamera").onclick=()=>{ state.notes.push({type:"Camera",note:$("#cameraNotes").value,date:new Date().toLocaleString()}); saveState(); toast("Camera note saved"); };
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

function renderSettings(){
  const s=state.settings;
  $("#screen").innerHTML = `${pageHead("Settings","saveSettings")}
    <section class="form-panel form-grid">
      <label>Shop Name<input id="setShop" value="${s.shop}"></label>
      <label>Phone<input id="setPhone" value="${s.phone}"></label>
      <div class="two-col"><label>Labor Rate<input id="setRate" type="number" value="${s.laborRate}"></label><label>Service Call<input id="setCall" type="number" value="${s.serviceCall}"></label></div>
      <div class="two-col"><label>Tax %<input id="setTax" type="number" value="${s.tax}"></label><label>Card Fee %<input id="setCard" type="number" value="${s.cardFee}"></label></div>
      <button class="action-btn clear" id="resetApp">Reset All Local Data</button>
    </section>`;
  bindPageTools();
  $("#saveSettings").onclick=()=>{ state.settings={shop:$("#setShop").value,phone:$("#setPhone").value,laborRate:+$("#setRate").value||135,serviceCall:+$("#setCall").value||250,tax:+$("#setTax").value||0,cardFee:+$("#setCard").value||0}; saveState(); toast("Settings saved"); };
  $("#resetApp").onclick=()=>{ if(confirm("Clear all local app data?")){ state=JSON.parse(JSON.stringify(defaultState)); saveState(); renderSettings(); toast("App reset"); }};
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

const routes = {
  home:renderHome, clock:renderClock, truck:renderTruck, ai:renderAi, parts:renderParts, fault:renderFault,
  repairhud:renderRepairHud, quotes:renderQuotes, invoices:renderInvoices, workorders:renderWorkOrders,
  schedule:renderSchedule, customers:renderCustomers, pindrop:renderPinDrop, camera:renderCamera, reports:renderReports,
  memory:renderMemory, suppliers:renderSuppliers, pmdue:renderPmDue, settings:renderSettings, alerts:renderAlerts, repair:renderRepair, business:renderBusiness
};
function render(route=currentRoute()){
  const fn=routes[route] || renderHome;
  fn();
  $$(".bottom-nav button").forEach(b=>b.classList.toggle("active", b.dataset.route===route || (route==="home" && b.dataset.route==="home")));
}
document.addEventListener("click", e=>{
  const r=e.target.closest("[data-route]");
  if(r){ e.preventDefault(); setRoute(r.dataset.route); return; }
  const c=e.target.closest("[data-clock]");
  if(c){
    const id=c.dataset.job, action=c.dataset.clock, j=state.jobs[id];
    updateJobInputs(id);
    if(action==="start"){ j.running=true; j.status="RUNNING"; }
    if(action==="pause"){ j.running=false; j.status="PAUSED"; }
    if(action==="stop"){ j.running=false; j.status="STOPPED"; }
    if(action==="clear"){ j.running=false; j.seconds=0; j.status="READY"; }
    if(action==="save"){ saveClock(id); }
    saveState(); renderClock(); return;
  }
});
window.addEventListener("hashchange",()=>render());
setInterval(()=>{
  let changed=false;
  Object.values(state.jobs).forEach(j=>{ if(j.running){ j.seconds++; changed=true; }});
  if(changed){
    saveState();
    if(currentRoute()==="home" || currentRoute()==="clock") render(currentRoute());
  }
},1000);

render(currentRoute());
if("serviceWorker" in navigator){navigator.serviceWorker.register("./service-worker.js").catch(()=>{});}
