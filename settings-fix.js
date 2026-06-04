/* RWD V5.2b Settings Button Hard Fix */
(function(){
  const KEY = "RWD_V41_STATE";

  function loadState(){
    try{
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    }catch(e){
      return {};
    }
  }

  function saveState(state){
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function money(n){
    return "$" + Number(n || 0).toFixed(2);
  }

  function toast(msg){
    let t = document.getElementById("toast");
    if(!t){
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"), 1300);
  }

  function ensureState(state){
    state.settings = state.settings || {};
    state.pricing = state.pricing || {};
    state.ui = state.ui || {};
    state.employees = state.employees || [
      {name:"James Jacobs", role:"Owner / Admin", laborRate:135},
      {name:"Stephani Jacobs", role:"Operations Manager", laborRate:135},
      {name:"David", role:"Technician", laborRate:135}
    ];
    state.alertSettings = state.alertSettings || {};
    state.soundSettings = state.soundSettings || {};
    state.aiSettings = state.aiSettings || {};
    state.ocrSettings = state.ocrSettings || {};
    state.security = state.security || {};
    state.supabase = state.supabase || {};
    state.settings.shop = state.settings.shop || "Rolling Wrench Diesel";
    state.settings.phone = state.settings.phone || "260-502-6222";
    state.settings.laborRate = state.settings.laborRate || state.pricing.mobileLabor || 135;
    state.settings.serviceCall = state.settings.serviceCall || state.pricing.serviceCall || 250;
    return state;
  }

  function pageHeader(){
    return `<div class="page-head">
      <button class="action-btn" id="settingsBackBtn">← Back</button>
      <h2>Settings</h2>
      <button class="action-btn clear" id="settingsClearBtn">Clear</button>
      <button class="action-btn primary" id="settingsSaveBtn">Save</button>
    </div>`;
  }

  function section(title, body){
    return `<section class="settings-section"><h3>${title}</h3>${body}</section>`;
  }

  function settingToggle(id, label, desc, checked){
    return `<div class="setting-row">
      <div><b>${label}</b><small>${desc || ""}</small></div>
      <button class="toggle ${checked ? "on" : ""}" data-hard-toggle="${id}" type="button"></button>
    </div>`;
  }

  function renderSettings(){
    let state = ensureState(loadState());
    const screen = document.getElementById("screen");
    if(!screen) return;

    screen.innerHTML = `${pageHeader()}
      ${section("Shop Information", `
        <div class="form-grid">
          <label>Shop Name<input id="hardShop" value="${state.settings.shop}"></label>
          <label>Phone<input id="hardPhone" value="${state.settings.phone}"></label>
          <div class="two-col">
            <label>Labor Rate<input id="hardLabor" type="number" value="${state.settings.laborRate}"></label>
            <label>Service Call<input id="hardCall" type="number" value="${state.settings.serviceCall}"></label>
          </div>
        </div>
      `)}

      ${section("Themes", `
        <div class="theme-grid">
          ${["orange","green","blue","red","gray","light"].map(t=>`
            <button class="theme-card ${state.ui.theme===t ? "active" : ""}" data-hard-theme="${t}">
              <b>${t === "orange" ? "Rolling Wrench Orange" : t}</b>
              <small>${t} theme</small>
            </button>`).join("")}
        </div>
      `)}

      ${section("Pricing Manager", `
        <div class="two-col">
          <label>Shop Labor<input id="hardShopLabor" type="number" value="${state.pricing.shopLabor || state.settings.laborRate || 135}"></label>
          <label>Mobile Labor<input id="hardMobileLabor" type="number" value="${state.pricing.mobileLabor || state.settings.laborRate || 135}"></label>
        </div>
        <div class="two-col">
          <label>Diagnostic Rate<input id="hardDiagnostic" type="number" value="${state.pricing.diagnostic || 150}"></label>
          <label>Roadside Rate<input id="hardRoadside" type="number" value="${state.pricing.roadside || 150}"></label>
        </div>
        <div class="two-col">
          <label>Tax %<input id="hardTax" type="number" value="${state.pricing.taxPct || 0}"></label>
          <label>Card Fee %<input id="hardCard" type="number" value="${state.pricing.cardPct || 0}"></label>
        </div>
      `)}

      ${section("Employees", `
        <div class="two-col">
          <label>Name<input id="hardEmpName" placeholder="Employee name"></label>
          <label>Role<input id="hardEmpRole" placeholder="Tech / Manager / Admin"></label>
        </div>
        <button class="action-btn primary" id="hardAddEmployee">Add Employee</button>
        <div class="output" style="margin-top:10px;">${(state.employees||[]).map(e=>`${e.name || "Employee"} — ${e.role || ""} — ${money(e.laborRate || state.settings.laborRate)}`).join("\n")}</div>
      `)}

      ${section("Alerts", `
        ${settingToggle("alerts.pm","PM Due Alerts","Maintenance reminders", state.alertSettings.pm)}
        ${settingToggle("alerts.schedule","Schedule Alerts","Upcoming jobs", state.alertSettings.schedule)}
        ${settingToggle("alerts.invoice","Invoice Due Alerts","Unpaid invoices", state.alertSettings.invoice)}
        ${settingToggle("alerts.quote","Quote Follow-Up Alerts","Follow up estimates", state.alertSettings.quote)}
      `)}

      ${section("Sounds", `
        ${settingToggle("sounds.button","Button Click","Tap sounds", state.soundSettings.button)}
        ${settingToggle("sounds.save","Save Confirmation","Save sound", state.soundSettings.save)}
        ${settingToggle("sounds.aiVoice","AI Voice","Voice playback", state.soundSettings.aiVoice)}
        ${settingToggle("sounds.notification","Notification Sound","Alert sound", state.soundSettings.notification)}
      `)}

      ${section("Display", `
        ${settingToggle("ui.compact","Compact Mode","Fit more on screen", state.ui.compact)}
        ${settingToggle("ui.largeText","Large Text","Bigger type", state.ui.largeText)}
        ${settingToggle("ui.highContrast","High Contrast","Brighter borders", state.ui.highContrast)}
        ${settingToggle("ui.showEarnings","Show Earnings Card","Dashboard card", state.ui.showEarnings)}
        ${settingToggle("ui.showSchedule","Show Schedule Card","Dashboard card", state.ui.showSchedule)}
        ${settingToggle("ui.showRecentJobs","Show Recent Jobs","Dashboard card", state.ui.showRecentJobs)}
        ${settingToggle("ui.showSystemStatus","Show System Status","Dashboard status", state.ui.showSystemStatus)}
      `)}

      ${section("AI Settings", `
        ${settingToggle("ai.voice","AI Voice On/Off","Talk back responses", state.aiSettings.voice)}
        ${settingToggle("ai.autoRead","Auto Read Answers","Read answers aloud", state.aiSettings.autoRead)}
        ${settingToggle("ai.saveConversations","Save Conversations","Keep AI chat history", state.aiSettings.saveConversations)}
        ${settingToggle("ai.rememberTruck","Remember Active Truck","Use truck context", state.aiSettings.rememberTruck)}
        ${settingToggle("ai.rememberCustomer","Remember Customer","Use customer context", state.aiSettings.rememberCustomer)}
        <label>Voice Type<input id="hardVoiceType" value="${state.aiSettings.voiceType || "Shop Pro"}"></label>
      `)}

      ${section("OCR Settings", `
        ${settingToggle("ocr.autoOcr","Auto OCR","Scan uploaded images", state.ocrSettings.autoOcr)}
        ${settingToggle("ocr.vin","VIN Recognition","Read VIN plates", state.ocrSettings.vin)}
        ${settingToggle("ocr.part","Part Label Recognition","Read part labels", state.ocrSettings.part)}
        ${settingToggle("ocr.invoice","Invoice Recognition","Read receipts/invoices", state.ocrSettings.invoice)}
        ${settingToggle("ocr.fault","Fault Screen Recognition","Read scanner screens", state.ocrSettings.fault)}
      `)}

      ${section("Cloud / Backup", `
        <label>Supabase URL<input id="hardSupabaseUrl" value="${state.supabase.url || ""}"></label>
        <div class="export-grid">
          <button class="action-btn" id="hardBackup">Backup JSON</button>
          <button class="action-btn" data-route="supabase">Open Supabase Sync</button>
        </div>
      `)}

      ${section("Security", `
        ${settingToggle("security.appLock","App Lock On/Off","PIN lock placeholder", state.security.appLock)}
        <label>PIN Code<input id="hardPin" type="password" value="${state.security.pin || ""}"></label>
        ${settingToggle("security.faceId","Face ID","Future native wrapper", state.security.faceId)}
        ${settingToggle("security.touchId","Touch ID","Future native wrapper", state.security.touchId)}
      `)}
    `;

    document.querySelectorAll("[data-hard-toggle]").forEach(btn=>{
      btn.onclick = () => {
        const [group, key] = btn.dataset.hardToggle.split(".");
        const st = ensureState(loadState());
        if(group==="alerts") st.alertSettings[key] = !st.alertSettings[key];
        if(group==="sounds") st.soundSettings[key] = !st.soundSettings[key];
        if(group==="ui") st.ui[key] = !st.ui[key];
        if(group==="ai") st.aiSettings[key] = !st.aiSettings[key];
        if(group==="ocr") st.ocrSettings[key] = !st.ocrSettings[key];
        if(group==="security") st.security[key] = !st.security[key];
        saveState(st);
        renderSettings();
      };
    });

    document.querySelectorAll("[data-hard-theme]").forEach(btn=>{
      btn.onclick = () => {
        const st = ensureState(loadState());
        st.ui.theme = btn.dataset.hardTheme;
        saveState(st);
        toast("Theme saved");
        renderSettings();
      };
    });

    document.getElementById("settingsBackBtn").onclick = () => {
      location.hash = "home";
      if(typeof window.render === "function") window.render("home");
      else location.reload();
    };

    document.getElementById("settingsClearBtn").onclick = () => {
      screen.querySelectorAll("input").forEach(i=>i.value="");
      toast("Settings fields cleared");
    };

    document.getElementById("settingsSaveBtn").onclick = saveSettings;
    document.getElementById("hardAddEmployee").onclick = () => {
      const st = ensureState(loadState());
      st.employees.push({name:document.getElementById("hardEmpName").value, role:document.getElementById("hardEmpRole").value, laborRate:st.settings.laborRate});
      saveState(st);
      toast("Employee added");
      renderSettings();
    };

    document.getElementById("hardBackup").onclick = () => {
      const st = ensureState(loadState());
      const blob = new Blob([JSON.stringify(st,null,2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rwd-backup-" + Date.now() + ".json";
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  function saveSettings(){
    const state = ensureState(loadState());
    state.settings.shop = document.getElementById("hardShop").value;
    state.settings.phone = document.getElementById("hardPhone").value;
    state.settings.laborRate = Number(document.getElementById("hardLabor").value || 135);
    state.settings.serviceCall = Number(document.getElementById("hardCall").value || 250);
    state.pricing.shopLabor = Number(document.getElementById("hardShopLabor").value || state.settings.laborRate);
    state.pricing.mobileLabor = Number(document.getElementById("hardMobileLabor").value || state.settings.laborRate);
    state.pricing.diagnostic = Number(document.getElementById("hardDiagnostic").value || 150);
    state.pricing.roadside = Number(document.getElementById("hardRoadside").value || 150);
    state.pricing.taxPct = Number(document.getElementById("hardTax").value || 0);
    state.pricing.cardPct = Number(document.getElementById("hardCard").value || 0);
    state.aiSettings.voiceType = document.getElementById("hardVoiceType").value;
    state.supabase.url = document.getElementById("hardSupabaseUrl").value;
    state.security.pin = document.getElementById("hardPin").value;
    saveState(state);
    toast("Settings saved");
  }

  window.renderSettingsHardFix = renderSettings;

  document.addEventListener("click", function(e){
    const btn = e.target.closest('[data-route="settings"], .gear, button[aria-label="Settings"]');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    location.hash = "settings";
    renderSettings();
  }, true);

  window.addEventListener("hashchange", function(){
    if(location.hash.replace("#","") === "settings"){
      renderSettings();
    }
  });

  if(location.hash.replace("#","") === "settings"){
    setTimeout(renderSettings, 50);
  }
})();