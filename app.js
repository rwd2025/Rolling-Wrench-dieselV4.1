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
  ensureV46();
  $("#screen").innerHTML = `${pageHead("3 Job Time Clock","saveAllClock",false)}
    <section class="summary-card">
      <div><span>Total Time</span><b id="clockTotalTime">${formatTime(totalSeconds())}</b></div>
      <div><span>Total Labor</span><b id="clockTotalMoney">${money(clockDollars(totalSeconds()))}</b></div>
      <div><span>Rate</span><b>${money(state.settings.laborRate)}/hr</b></div>
    </section>
    <section class="backend-banner"><b>Invoice Ready Clock</b><small>Each job can be saved, cleared, and pushed into Work Orders / Invoices / Reports.</small></section>
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
  j.saved.push({name:j.name,customer:j.customer,seconds:j.seconds,labor:clockDollars(j.seconds),date:new Date().toLocaleString()});
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

  function sendMessage(){
    const box = $("#aiAsk");
    const q = box.value.trim();
    if(!q) return;
    const chat = getActiveChat();
    if(chat.messages.length === 0) chat.title = q.slice(0,34);
    chat.messages.push({role:"user", text:q, time:new Date().toLocaleString()});
    const routeInfo = v5RouteAiCommand(q);
    const answer = aiReply(q) + "\n\nAction: " + routeInfo.msg;
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
  function buildQuotePreview(){const labor=n("quoteHours")*n("quoteRate");const subtotal=calc();const disclaimer="Estimate only. Final price may increase or decrease based on additional labor, seized/broken hardware, hidden damage, diagnostic findings, parts availability, freight, shop supplies, taxes/fees, travel, or extra time required to complete the repair. Customer approval required before additional work is performed. Parts pricing and availability may change until purchased.";$("#quotePreviewWrap").innerHTML=`<div class="pro-doc-preview"><div class="pro-doc-top"><div class="pro-doc-logo"><div class="doc-rw">RW</div><div><h3>${state.settings.shop || "Rolling Wrench Diesel"}</h3><p>${state.settings.phone || ""} • Mobile Diesel Repair</p></div></div><div class="doc-type"><b>Quote</b><small>${new Date().toLocaleDateString()}</small></div></div><div class="pro-info-grid"><div class="pro-info-box"><b>Customer</b><span>${v("quoteCustomer") || "Customer"}</span></div><div class="pro-info-box"><b>Truck / VIN</b><span>${v("quoteTruck") || "Truck / VIN"}</span></div><div class="pro-info-box"><b>Job</b><span>${v("quoteDesc") || "Repair estimate"}</span></div><div class="pro-info-box"><b>Parts Source</b><span>${v("quotePartSource") || "To be verified"}</span></div></div><table class="pro-table"><thead><tr><th>Description</th><th>Qty/Hours</th><th>Rate/Cost</th><th>Total</th></tr></thead><tbody><tr><td>Labor</td><td>${v("quoteHours")} hrs</td><td>${money(n("quoteRate"))}</td><td>${money(labor)}</td></tr><tr><td>Service Call</td><td>1</td><td>${money(n("quoteCall"))}</td><td>${money(n("quoteCall"))}</td></tr><tr><td>Travel / Mileage</td><td>1</td><td>${money(n("quoteTravel"))}</td><td>${money(n("quoteTravel"))}</td></tr><tr><td>Parts<br><small>${v("quotePartsList").replaceAll("\\n","<br>")}</small></td><td>1</td><td>${money(n("quoteParts"))}</td><td>${money(n("quoteParts"))}</td></tr><tr><td>Supplies / Fees / Misc</td><td>1</td><td>${money(n("quoteSupplies")+n("quoteFees")+n("quoteMisc"))}</td><td>${money(n("quoteSupplies")+n("quoteFees")+n("quoteMisc"))}</td></tr></tbody></table><div class="pro-total-box"><div class="pro-total-row"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="pro-total-row grand"><span>Estimated Total</span><b>${money(subtotal)}</b></div></div><div class="pro-note"><b>Estimate Disclaimer:</b> ${disclaimer}</div>${docSignatureHtml("quote")}</div><div class="pro-actions"><button id="convertQuoteInvoice">Convert to Invoice</button><button id="saveQuoteAgain">Save Quote</button><button onclick="window.print()">Print / Save PDF</button></div>`;$("#saveQuoteAgain").onclick=()=>$("#saveQuote").click();$("#convertQuoteInvoice").onclick=()=>{state.invoices.push({customer:v("quoteCustomer"),truck:v("quoteTruck"),work:v("quoteDesc"),total:subtotal,date:new Date().toLocaleString(),fromQuote:true});saveState();toast("Converted to invoice")}}
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
  function buildInvoicePreview(){const labor=n("invHours")*n("invRate");const total=calc();$("#invoicePreviewWrap").innerHTML=`<div class="pro-doc-preview"><div class="pro-doc-top"><div class="pro-doc-logo"><div class="doc-rw">RW</div><div><h3>${state.settings.shop || "Rolling Wrench Diesel"}</h3><p>${state.settings.phone || ""} • Mobile Diesel & Equipment Repair</p></div></div><div class="doc-type"><b>Invoice</b><small>${new Date().toLocaleDateString()}<br>Due Upon Receipt</small></div></div><div class="pro-info-grid"><div class="pro-info-box"><b>Bill To</b><span>${v("invCustomer") || "Customer"}</span></div><div class="pro-info-box"><b>Truck / VIN</b><span>${v("invTruck") || "Truck / VIN"}</span></div><div class="pro-info-box"><b>Work Performed</b><span>${v("invWork") || "Work performed"}</span></div><div class="pro-info-box"><b>Payment</b><span>Due upon receipt unless otherwise agreed. Card processing fees may apply.</span></div></div><table class="pro-table"><thead><tr><th>Description</th><th>Qty/Hours</th><th>Rate/Cost</th><th>Total</th></tr></thead><tbody><tr><td>Labor</td><td>${v("invHours")} hrs</td><td>${money(n("invRate"))}</td><td>${money(labor)}</td></tr><tr><td>Service Call</td><td>1</td><td>${money(n("invCall"))}</td><td>${money(n("invCall"))}</td></tr><tr><td>Travel / Mileage</td><td>1</td><td>${money(n("invTravel"))}</td><td>${money(n("invTravel"))}</td></tr><tr><td>Parts / Materials<br><small>${v("invPartsList").replaceAll("\\n","<br>")}</small></td><td>1</td><td>${money(n("invParts"))}</td><td>${money(n("invParts"))}</td></tr><tr><td>Supplies / Tax / Fees</td><td>1</td><td>${money(n("invSupplies")+n("invFees"))}</td><td>${money(n("invSupplies")+n("invFees"))}</td></tr>${n("invDiscount") ? `<tr><td>Discount</td><td>1</td><td>-${money(n("invDiscount"))}</td><td>-${money(n("invDiscount"))}</td></tr>` : ""}</tbody></table><div class="pro-total-box"><div class="pro-total-row"><span>Subtotal</span><b>${money(total)}</b></div><div class="pro-total-row grand"><span>Total Due</span><b>${money(total)}</b></div></div><div class="pro-note"><b>Notes / Terms:</b> ${v("invNotes") || "Customer authorizes listed work. Additional issues found after teardown or diagnostics may require additional approval. Parts availability and pricing may vary. Payment due upon receipt."}</div>${docSignatureHtml("invoice")}</div><div class="pro-actions"><button id="saveInvoiceAgain">Save Invoice</button><button onclick="window.print()">Print / Save PDF</button><button id="textInvoice">Text/Share Ready</button></div>`;$("#saveInvoiceAgain").onclick=()=>$("#saveInvoice").click();$("#textInvoice").onclick=()=>toast("Use browser share/print or screenshot preview")}
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

const routes = {
  home:renderHome, clock:renderClock, truck:renderTruck, ai:renderAi, parts:renderParts, fault:renderFault,
  repairhud:renderRepairHud, quotes:renderQuotes, invoices:renderInvoices, workorders:renderWorkOrders,
  schedule:renderSchedule, customers:renderCustomers, pindrop:renderPinDrop, camera:renderCamera, reports:renderReports,
  memory:renderMemory, suppliers:renderSuppliers, pmdue:renderPmDue, settings:renderSettings, alerts:renderAlerts, workflow:renderWorkflowHub, pmmanager:renderPMManager, inventory:renderInventory, supplierpricing:renderSupplierPricing, notifications:renderNotifications, signin:renderSignInPreview, repair:renderRepair, business:renderBusiness
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
    if(action==="toWO"){ 
      state.workorders.push({customer:j.customer || state.truck.customer, truck:state.truck.unit, desc:`${j.name} - clock labor ${formatTime(j.seconds)}`, status:"Open", clockSeconds:j.seconds, date:new Date().toLocaleString()});
      addTruckHistory("Clock to Work Order", `${j.name} ${formatTime(j.seconds)}`);
      toast("Clock sent to work order");
    }
    if(action==="toInvoice"){
      state.invoices.push({customer:j.customer || state.truck.customer, truck:state.truck.unit, work:`${j.name} - labor time ${formatTime(j.seconds)}`, total:clockDollars(j.seconds), clockSeconds:j.seconds, date:new Date().toLocaleString()});
      addTruckHistory("Clock to Invoice", `${j.name} ${formatTime(j.seconds)} ${money(clockDollars(j.seconds))}`);
      toast("Clock sent to invoice");
    }
    saveState(); renderClock(); return;
  }
});
window.addEventListener("hashchange",()=>render());
setInterval(()=>{
  let changed=false;
  Object.values(state.jobs).forEach(j=>{ if(j.running){ j.seconds++; changed=true; }});
  if(changed){
    saveState();
    if(currentRoute()==="home" || currentRoute()==="clock") ensureV46();
ensureSettingsV48();
ensureV5();
applyUiSettings();
if(document.getElementById('alertCount')) document.getElementById('alertCount').textContent = (state.alerts||[]).filter(a=>!a.read).length;
render(currentRoute());
  }
},1000);

ensureV46();
ensureSettingsV48();
ensureV5();
applyUiSettings();
if(document.getElementById('alertCount')) document.getElementById('alertCount').textContent = (state.alerts||[]).filter(a=>!a.read).length;
render(currentRoute());
if("serviceWorker" in navigator){navigator.serviceWorker.register("./service-worker.js").catch(()=>{});}
