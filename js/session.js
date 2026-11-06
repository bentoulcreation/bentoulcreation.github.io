/*******************************************************
 * BENTOUL CREATION — SESSION PARTAGEE
 * Dépend de config.js (window.BTM_CONFIG).
 * Fournit : api(), store/get/clear de session,
 * le header connecté (nom + crédits) et les gardes.
 *******************************************************/

(function () {

  const SESSION_KEY = "bentoulcreation.session.v1";

  /* ---------- session ---------- */

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.token && s.user ? s : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(token, user) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token: token, user: user, savedAt: Date.now() })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /* ---------- API ---------- */

  async function api(data) {

    const url = window.BTM_CONFIG && window.BTM_CONFIG.API_URL;

    if (!url) {
      throw new Error("URL de l'API non configurée (config.js).");
    }

    const response = await fetch(url, {
      method: "POST",
      body: new URLSearchParams(data),
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("Erreur de communication avec le serveur.");
    }

    return await response.json();
  }

  /* Actualise le profil côté serveur.
     - token valide → données fraîches + cache mis à jour
     - session invalide → déconnexion + page de connexion
     - API déployée plus ancienne (action inconnue) → cache réutilisé */
  async function refreshUser() {

    const session = getSession();

    if (!session) {
      gotoLogin();
      return null;
    }

    try {
      const result = await api({ action: "profile", token: session.token });

      if (result.success && result.user) {
        saveSession(session.token, result.user);
        return result.user;
      }

      if (result.code === "SESSION_INVALID") {
        clearSession();
        gotoLogin();
        return null;
      }

      return session.user;
    } catch (e) {
      return session.user;
    }
  }

  async function logout() {
    const session = getSession();

    if (session) {
      try {
        await api({ action: "logout", token: session.token });
      } catch (e) { /* le cache local est purgé de toute façon */ }
    }

    clearSession();
    gotoLogin();
  }

  function gotoLogin() {
    window.location.replace(window.BTM_CONFIG.LOGIN_PAGE);
  }

  function gotoProfile() {
    window.location.href = window.BTM_CONFIG.PROFILE_PAGE;
  }

  /* ---------- header connecté ---------- */

  const CHROME_CSS = `
.user-zone { display:flex; align-items:center; gap:14px; }
.user-chip {
  display:flex; align-items:center; gap:10px;
  padding:6px 12px 6px 6px; border-radius:999px;
  background:#eef2f6; border:1px solid #e0e7ee; color:#142B45;
  text-decoration:none; transition:background .2s;
}
.user-chip:hover { background:#e2eaf2; }
.user-chip .u-avatar {
  width:34px; height:34px; border-radius:50%;
  background:#16b89a; color:#06325f;
  display:grid; place-items:center;
  font-weight:800; font-size:15px;
}
.user-chip .u-name { font-size:13px; font-weight:700; line-height:1.2; max-width:140px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#142B45; }
.user-chip .u-credits {
  font-size:11px; color:#55647a; line-height:1.2;
}
.login-btn {
  border:0; border-radius:999px; padding:10px 20px;
  background:#16b89a; color:#fff; font-weight:700;
  font-size:14px; cursor:pointer; transition:.2s;
}
.login-btn:hover { background:#109d82; }
.header-logout {
  border:0; background:transparent; color:#142B45;
  opacity:.75; font-size:12px; cursor:pointer; padding:6px;
}
.header-logout:hover { opacity:1; text-decoration:underline; }
@media (max-width:480px){
  .user-chip .u-at { display:none; }
  .header-logout { display:none; }
}
`;

  function initials(name) {
    return String(name || "?").trim().charAt(0).toUpperCase() || "?";
  }

  /* Monté dans tout header portant [data-btm-auth-zone] ou via mountAuthZone(el). */
  function renderZone(zone, user) {

    if (user) {
      zone.innerHTML = `
        <div class="user-zone">
          <a class="user-chip" href="${window.BTM_CONFIG.PROFILE_PAGE}">
            <span class="u-avatar">${escapeHtml(initials(user.nom))}</span>
            <span>
              <span class="u-name">${escapeHtml(user.nom)}</span><br>
              <span class="u-credits"><span class="u-at">@${escapeHtml(user.username)} &middot; </span>${Number(user.credits) || 0} crédits</span>
            </span>
          </a>
          <button type="button" class="header-logout" data-btm-logout>Déconnexion</button>
        </div>`;

      const btn = zone.querySelector("[data-btm-logout]");
      if (btn) btn.addEventListener("click", logout);
    } else {
      zone.innerHTML = `
        <div class="user-zone">
          <button type="button" class="login-btn" data-btm-login>Connexion</button>
        </div>`;

      zone.querySelector("[data-btm-login]")
        .addEventListener("click", gotoLogin);
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mountAuthZone(element) {
    if (!element) return;
    renderZone(element, getSession() ? getSession().user : null);
  }

  /* Rafraîchit les zones après un refreshUser(). */
  function updateAuthZones(user) {
    document.querySelectorAll("[data-btm-auth-zone]").forEach(function (zone) {
      renderZone(zone, user);
    });
  }

  function autoMount() {
    if (!document.querySelector("style[data-btm-chrome]")) {
      const style = document.createElement("style");
      style.setAttribute("data-btm-chrome", "");
      style.textContent = CHROME_CSS;
      document.head.appendChild(style);
    }

    document.querySelectorAll("[data-btm-auth-zone]").forEach(function (zone) {
      mountAuthZone(zone);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }

  window.BTM = {
    api,
    getSession,
    saveSession,
    clearSession,
    refreshUser,
    logout,
    gotoLogin,
    gotoProfile,
    mountAuthZone,
    updateAuthZones,
    escapeHtml
  };

})();
