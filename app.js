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
  const list = state.schedule.slice(0,3);
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
    ${(state.quotes||[]).length ? state.quotes.map((q,i)=>`<div class="quote-list-card"><b>${q.customer || "Customer"} — ${money(q.total || 0)}</b><small>${q.desc || "Quote"}<br>${quoteStatusPill(q.status || "Pending")}</small><div class="smart-action-row"><button data-create-approval="${i}">Send Link</button><button data-open-approval="${q.approvalId || ""}">Open Portal</button><button data-convert-invoice="${i}">Invoice</button></div><div class="share-link-box" id="quoteLink_${i}">${q.approvalId ? `${location.origin}${location.pathname}#quoteapproval-${q.approvalId}` : "No link yet"}</div></div>`).join("") : `<div class="output">No quotes saved yet. Create a Smart Quote first.</div>`}
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
    ${(state.invoices||[]).length ? state.invoices.map((inv,i)=>`<div class="quote-list-card"><b>${inv.customer || "Customer"} — ${money(inv.total || 0)}</b><small>${inv.work || "Invoice"}<br>${invoiceStatusPill(inv.status || "Unpaid")}</small><div class="smart-action-row"><button data-create-invoice-link="${i}">Send Link</button><button data-open-invoice="${inv.invoiceId || ""}">Open Portal</button><button data-mark-paid="${i}">Paid</button></div><div class="share-link-box" id="invoiceLink_${i}">${inv.invoiceId ? `${location.origin}${location.pathname}#invoiceportal-${inv.invoiceId}` : "No link yet"}</div></div>`).join("") : `<div class="output">No invoices saved yet.</div>`}
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

const routes = {
  home:renderHome, clock:renderClock, truck:renderTruck, ai:renderAi, parts:renderParts, fault:renderFault,
  repairhud:renderRepairHud, quotes:renderQuotes, invoices:renderInvoices, workorders:renderWorkOrders,
  schedule:renderSchedule, customers:renderCustomers, pindrop:renderPinDrop, camera:renderCamera, reports:renderReports,
  memory:renderMemory, suppliers:renderSuppliers, pmdue:renderPmDue, settings:renderSettingsSafe, alerts:renderAlerts, workflow:renderWorkflowHub, pmmanager:renderPMManager, inventory:renderInventory, supplierpricing:renderSupplierPricing, notifications:renderNotifications, signin:renderSignInPreview, supabase:renderSupabaseSync, v52:renderV52Dashboard, dashboard:renderBusinessDashboard, aioperator:renderAIOperator, photointel:renderPhotoIntelligence, schedulecommand:renderScheduleCommand, customerportal:renderCustomerPortalHub, sendquotes:renderQuoteSendCenter, sendinvoices:renderInvoiceSendCenter, stability:renderStabilityCenter, externallinks:renderExternalLinksCenter, storageprep:renderStoragePrep, portalhub:renderCustomerPortalHub, techmode:renderTechMode, about:renderAboutLegal, login:renderLogin, account:renderAuthSettings, aiengine:renderAiEngine, realocr:renderRealOCR, filestorage:renderFileStorage, gpsmanager:renderGPSManager, repair:renderRepair, business:renderBusiness
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
