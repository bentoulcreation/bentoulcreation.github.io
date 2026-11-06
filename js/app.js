
// Attendre que le document soit prêt
document.addEventListener("DOMContentLoaded", () => {

    // 0. ESPACE PUB — monté sur toutes les pages, activé uniquement quand visible
    mountAdSlot();

    // Les pages qui possèdent déjà leur propre chrome (connexion, profil)
    // n'utilisent pas cette base.
    if (document.querySelector(".main-header, .top-header")) return;

    // 1. CRÉATION DU HEADER
    const header = document.createElement("header");
    header.className = "main-header";
    header.innerHTML = `
        <div class="header-left">
            <button class="menu-toggle" id="menuToggle" aria-label="Ouvrir le menu">
                ☰
            </button>
        </div>

        <nav class="nav-menu">
            <ul>
                <li><a href="/index.html">Accueil</a></li>
                <li><a href="/benamoura.html">Séries</a></li>
                <li><a href="/bentoul.html">BentoUL</a></li>
            </ul>
        </nav>

        <div class="header-auth" data-btm-auth-zone></div>
    `;

    // 2. CRÉATION DU CONTENEUR CENTRAL
    const appLayout = document.createElement("div");
    appLayout.className = "app-layout";

    // 3. CRÉATION DE LA SIDEBAR
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar";
    sidebar.id = "sidebar";

    sidebar.innerHTML = `
        <ul class="sidebar-links">
            <li><a href="/index.html">Accueil</a></li>
            <li><a href="/benamoura.html">Séries</a></li>
            <li><a href="/bentoul.html">Séries BentoUL</a></li>
            <li><a href="/profile.html">Mon profil</a></li>
            <li><a href="/users.html">Connexion</a></li>
        </ul>
    `;

    // 4. CRÉATION DE L'OVERLAY
    const overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    overlay.id = "sidebarOverlay";


    // Assemblage du layout
    appLayout.appendChild(sidebar);
    appLayout.appendChild(overlay);

    // Le contenu de la page (s'il existe) prend place dans le layout
    const pageContent = document.querySelector("main[data-app-content]");
    if (pageContent) appLayout.appendChild(pageContent);

    // 6. CRÉATION DU FOOTER
    const footer = document.createElement("footer");
    footer.className = "main-footer";
    footer.innerHTML = `
        <nav class="footer-links" aria-label="Navigation du pied de page">
            <a href="/index.html">Home</a>
            <a href="/bentoul.html">Tech</a>
            <a href="/benamoura.html">Vie</a>
            <a href="/profile.html" id="footer-profile" class="footer-profile">Profile</a>
        </nav>
    `;

    // 7. INJECTION DANS LE BODY
    const body = document.body;

    body.appendChild(header);
    body.appendChild(appLayout);
    body.appendChild(footer);

    // Le bouton Profile du footer : visible uniquement si connecté
    function syncFooterProfile() {
        const el = document.getElementById("footer-profile");
        if (!el) return;
        const session = window.BTM ? BTM.getSession() : null;
        el.classList.toggle("hidden-footer", !session);
    }
    syncFooterProfile();
    window.BTM_SYNC_FOOTER_PROFILE = syncFooterProfile;

    // 8. GESTION DE LA SIDEBAR
    const menuToggle = document.getElementById("menuToggle");

    function openSidebar() {
        sidebar.classList.add("active");
        overlay.classList.add("active");
        menuToggle.innerHTML = "✕";
        menuToggle.setAttribute("aria-label", "Fermer le menu");
    }

    function closeSidebar() {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
        menuToggle.innerHTML = "☰";
        menuToggle.setAttribute("aria-label", "Ouvrir le menu");
    }

    function toggleSidebar() {
        if (sidebar.classList.contains("active")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    // Bouton ouvrir/fermer
    menuToggle.addEventListener("click", toggleSidebar);

    // Fermer en cliquant sur le fond sombre
    overlay.addEventListener("click", closeSidebar);

    // Fermer avec la touche Échap
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });

    // Fermer après clic sur un lien
    sidebar.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });

    // 9. ZONE COMPTE : bouton Connexion ou nom + crédits
    if (window.BTM) {
        document.querySelectorAll("[data-btm-auth-zone]").forEach(BTM.mountAuthZone);

        if (BTM.getSession()) {
            BTM.refreshUser().then(function (user) {
                if (user) BTM.updateAuthZones(user);
                syncFooterProfile();
            });
        }
    }

    // 10. PUB : conteneur en bas de page, script injecté à la visibilité
    function mountAdSlot() {
        const cfg = (window.BTM_CONFIG && window.BTM_CONFIG.ADS) || {};

        const slot = document.createElement("div");
        slot.className = "ad-slot";
        slot.setAttribute("aria-label", "Espace publicitaire");
        document.body.appendChild(slot);

        let activated = false;

        function activate() {
            if (activated) return;
            activated = true;

            if (cfg.ADSENSE_CLIENT) {
                slot.classList.add("ad-adsense");
                slot.innerHTML =
                    '<ins class="adsbygoogle" style="display:block" data-ad-client="' + cfg.ADSENSE_CLIENT +
                    '" data-ad-slot="' + (cfg.ADSENSE_SLOT || "") +
                    '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
                const script = document.createElement("script");
                script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
                    encodeURIComponent(cfg.ADSENSE_CLIENT);
                script.async = true;
                script.crossOrigin = "anonymous";
                slot.appendChild(script);
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } else if (cfg.BUNLON_KEY && cfg.BUNLON_SRC) {
                slot.classList.add("ad-bunlon");
                window.atOptions = {
                    key: cfg.BUNLON_KEY,
                    format: "iframe",
                    height: cfg.BUNLON_HEIGHT || 50,
                    width: cfg.BUNLON_WIDTH || 320,
                    params: {}
                };
                const script = document.createElement("script");
                script.src = cfg.BUNLON_SRC;
                script.async = true;
                slot.appendChild(script);
            } else {
                slot.remove();
            }
        }

        if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver(function (entries) {
                if (entries.some(function (en) { return en.isIntersecting; })) {
                    io.disconnect();
                    activate();
                }
            }, { rootMargin: "150px 0px" });
            io.observe(slot);
        } else {
            activate();
        }
    }

});
