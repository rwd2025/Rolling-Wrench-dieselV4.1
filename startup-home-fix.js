/* RWD V6.2b Startup Home Fix */
(function(){
  function forceHomeRender(){
    try{
      const screen = document.getElementById("screen");
      if(!screen) return;

      const badHash = !location.hash || location.hash === "#" || location.hash === "#undefined" || location.hash === "#null" || location.hash === "#blank";
      if(badHash) location.hash = "home";

      const current = location.hash.replace("#","") || "home";
      const blank = !screen.innerHTML || screen.innerHTML.trim().length < 50;

      if(blank && typeof window.render === "function"){
        window.render(current === "login" ? "login" : "home");
      }

      setTimeout(function(){
        const stillBlank = !screen.innerHTML || screen.innerHTML.trim().length < 50;
        if(stillBlank && typeof window.renderHome === "function"){
          location.hash = "home";
          window.renderHome();
        }
      }, 250);

      setTimeout(function(){
        const stillBlank = !screen.innerHTML || screen.innerHTML.trim().length < 50;
        if(stillBlank){
          screen.innerHTML = `<section class="error-panel">
            <b>Startup Recovery</b>
            <p>Home did not render automatically.</p>
            <button class="action-btn primary" id="startupGoHome">Go Home</button>
          </section>`;
          const btn = document.getElementById("startupGoHome");
          if(btn) btn.onclick = function(){
            location.hash = "home";
            if(typeof window.render === "function") window.render("home");
            else location.reload();
          };
        }
      }, 800);
    }catch(e){
      console.error("Startup home fix error", e);
    }
  }

  document.addEventListener("DOMContentLoaded", forceHomeRender);
  window.addEventListener("load", forceHomeRender);

  setTimeout(forceHomeRender, 50);
  setTimeout(forceHomeRender, 300);
  setTimeout(forceHomeRender, 1000);

  document.addEventListener("click", function(e){
    const menu = e.target.closest(".menu-btn, .hamburger, [aria-label='Menu'], [data-route='home']");
    if(!menu) return;
    setTimeout(forceHomeRender, 80);
  }, true);
})();