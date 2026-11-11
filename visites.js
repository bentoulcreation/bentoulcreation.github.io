/* ===== BENTOUL CREATION — Visites (analytics) =====
   - Enregistre chaque page vue : pays, page, plateforme d'origine,
     type d'appareil, navigateur, système, lang, écran, session.
   - Affiche le dashboard dans l'onglet #/stats (code d'accès requis).
   Le backend est visites.gs (Web App Apps Script, URL /exec). */

(function () {
    "use strict";

    const STORAGE = {
        api: "bentoul.visites.api",
        pin: "bentoul.visites.pin",
        geo: "bentoul.visites.geo",
        session: "bentoul.visites.session"
    };

    /* URL /exec de visites.gs. Peut aussi être configurée depuis le dashboard. */
    const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbw6X4wsCtBDaYY0tXjzFHicYpsGVPTyOAhttw__nQyykmWM5qohYURefhtU5MCG5jht/exec";

    const ALL_TABS = ["home", "services", "contact", "bentoul", "benamoura", "account", "stats"];
    const TRACKED_TABS = ["home", "services", "contact", "bentoul", "benamoura", "account"];
    const TAB_LABELS = {
        home: "Accueil",
        services: "Services",
        contact: "Contact",
        account: "Compte",
        bentoul: "Bentoul",
        benamoura: "Benamoura",
        stats: "Statistiques"
    };
    const RANGES = [["today", "Aujourd'hui"], ["7", "7 jours"], ["30", "30 jours"], ["all", "Tout"]];

    const dashState = { range: "7", status: "idle", data: null, error: "" };
    let lastTracked = { key: "", at: 0 };

    /* ===== Utilitaires ===== */

    function escapeHTML(value) {
        return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
        });
    }

    function safeDecode(value) {
        try { return decodeURIComponent(value); } catch (error) { return value; }
    }

    function getApiUrl() {
        try {
            return (localStorage.getItem(STORAGE.api) || DEFAULT_API_URL || "").trim();
        } catch (error) {
            return DEFAULT_API_URL;
        }
    }

    function getPin() {
        try { return (localStorage.getItem(STORAGE.pin) || "").trim(); } catch (error) { return ""; }
    }

    function sessionId() {
        try {
            let id = sessionStorage.getItem(STORAGE.session);
            if (!id) {
                id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                sessionStorage.setItem(STORAGE.session, id);
            }
            return id;
        } catch (error) {
            return "s" + Math.random().toString(36).slice(2, 10);
        }
    }

    /* ===== Détection du contexte de visite ===== */

    function currentRoute() {
        const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(safeDecode);
        const tab = ALL_TABS.indexOf(parts[0]) !== -1 ? parts[0] : "home";
        return { tab: tab, series: parts[1] || "", episode: parts[2] || "" };
    }

    function prettySlug(slug) {
        const value = safeDecode(slug || "");
        if (!value) return "";
        if (/^[a-z]{2,4}_[0-9a-f-]{16,}$/i.test(value)) return "Fiche";
        const text = value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function pageLabel(route) {
        if (route.tab === "bentoul" || route.tab === "benamoura") {
            const space = TAB_LABELS[route.tab];
            if (route.series) {
                const series = prettySlug(route.series);
                return route.episode
                    ? space + " — " + series + " — " + prettySlug(route.episode)
                    : space + " — " + series;
            }
        }
        return TAB_LABELS[route.tab] || route.tab;
    }

    function classifySource() {
        let utm = "";
        try {
            utm = (new URLSearchParams(location.search).get("utm_source") || "").toLowerCase();
        } catch (error) { /* ignore */ }
        if (utm) {
            if (utm.indexOf("whatsapp") !== -1 || utm === "wa") return "WhatsApp";
            if (utm.indexOf("facebook") !== -1 || utm === "fb") return "Facebook";
            if (utm.indexOf("instagram") !== -1) return "Instagram";
            if (utm.indexOf("youtube") !== -1) return "YouTube";
            if (utm.indexOf("google") !== -1) return "Google";
            if (utm.indexOf("tiktok") !== -1) return "TikTok";
            if (utm.indexOf("telegram") !== -1) return "Telegram";
            if (utm === "twitter" || utm === "x") return "X (Twitter)";
            return utm;
        }
        const referrer = (document.referrer || "").toLowerCase();
        if (!referrer) return "Direct";
        if (referrer.indexOf("facebook.com") !== -1 || referrer.indexOf("fb.watch") !== -1) return "Facebook";
        if (referrer.indexOf("whatsapp.com") !== -1) return "WhatsApp";
        if (referrer.indexOf("instagram.com") !== -1) return "Instagram";
        if (referrer.indexOf("youtube.com") !== -1 || referrer.indexOf("youtu.be") !== -1) return "YouTube";
        if (referrer.indexOf("google.") !== -1) return "Google";
        if (referrer.indexOf("bing.com") !== -1) return "Bing";
        if (referrer.indexOf("tiktok.com") !== -1) return "TikTok";
        if (referrer.indexOf("telegram") !== -1) return "Telegram";
        if (referrer.indexOf("x.com") !== -1 || referrer.indexOf("twitter.com") !== -1) return "X (Twitter)";
        if (referrer.indexOf("linkedin.com") !== -1) return "LinkedIn";
        return "Autre";
    }

    function classifyDevice() {
        const ua = navigator.userAgent || "";
        if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "Tablette";
        if (/Mobi|iPhone|iPod|Windows Phone|Android.*Mobile/i.test(ua)) return "Mobile";
        return "Ordinateur";
    }

    function classifyBrowser() {
        const ua = navigator.userAgent || "";
        if (/Edg\//i.test(ua)) return "Edge";
        if (/OPR\/|Opera/i.test(ua)) return "Opera";
        if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
        if (/Firefox\/|FxiOS/i.test(ua)) return "Firefox";
        if (/Chrome\/|CriOS/i.test(ua)) return "Chrome";
        if (/Safari\//i.test(ua)) return "Safari";
        if (/MSIE|Trident/i.test(ua)) return "Internet Explorer";
        return "Autre";
    }

    function classifyOS() {
        const ua = navigator.userAgent || "";
        if (/Android/i.test(ua)) return "Android";
        if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
        if (/Windows/i.test(ua)) return "Windows";
        if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
        if (/Linux/i.test(ua)) return "Linux";
        return "Autre";
    }

    const COUNTRY_FALLBACK = {
        HT: "Haïti", FR: "France", US: "États-Unis", CA: "Canada", DO: "République dominicaine",
        BE: "Belgique", CH: "Suisse", CI: "Côte d'Ivoire", SN: "Sénégal", CM: "Cameroun",
        CD: "RD Congo", MG: "Madagascar", GP: "Guadeloupe", MQ: "Martinique", GF: "Guyane"
    };

    function geoFallback() {
        const language = navigator.language || "";
        const region = (language.split("-")[1] || "").toUpperCase();
        return {
            country: COUNTRY_FALLBACK[region] || region || "Inconnu",
            countryCode: region,
            city: ""
        };
    }

    function geoFetch(url, parse) {
        return new Promise(function (resolve) {
            const controller = new AbortController();
            const timer = setTimeout(function () { controller.abort(); }, 4000);
            fetch(url, { signal: controller.signal })
                .then(function (response) { return response.ok ? response.json() : null; })
                .then(function (data) {
                    clearTimeout(timer);
                    resolve(data ? parse(data) : null);
                })
                .catch(function () {
                    clearTimeout(timer);
                    resolve(null);
                });
        });
    }

    function getGeo() {
        try {
            const cached = sessionStorage.getItem(STORAGE.geo);
            if (cached) return Promise.resolve(JSON.parse(cached));
        } catch (error) { /* ignore */ }

        return geoFetch("https://ipwho.is/?fields=success,country,country_code,city", function (data) {
            if (!data || data.success === false || !data.country) return null;
            return { country: data.country, countryCode: data.country_code || "", city: data.city || "" };
        }).then(function (result) {
            return result || geoFetch("https://ipapi.co/json/", function (data) {
                if (!data || !data.country_name) return null;
                return { country: data.country_name, countryCode: data.country_code || "", city: data.city || "" };
            });
        }).then(function (result) {
            const geo = result || geoFallback();
            try { sessionStorage.setItem(STORAGE.geo, JSON.stringify(geo)); } catch (error) { /* ignore */ }
            return geo;
        });
    }

    /* ===== Enregistrement d'une visite ===== */

    function sendVisit(payload) {
        const api = getApiUrl();
        if (!api) return;
        const body = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=utf-8" });
        if (navigator.sendBeacon && navigator.sendBeacon(api, body)) return;
        fetch(api, { method: "POST", mode: "no-cors", body: body, keepalive: true }).catch(function () { /* silencieux */ });
    }

    function trackVisit() {
        if (!getApiUrl()) return;
        const route = currentRoute();
        if (TRACKED_TABS.indexOf(route.tab) === -1) return;

        const key = route.tab + "/" + route.series + "/" + route.episode;
        if (lastTracked.key === key && Date.now() - lastTracked.at < 5000) return;
        lastTracked = { key: key, at: Date.now() };

        getGeo().then(function (geo) {
            sendVisit({
                type: "visit",
                page: pageLabel(route),
                path: location.hash || "#/home",
                country: geo.country,
                countryCode: geo.countryCode,
                city: geo.city,
                source: classifySource(),
                device: classifyDevice(),
                browser: classifyBrowser(),
                os: classifyOS(),
                lang: navigator.language || "",
                referrer: document.referrer || "",
                screen: (window.screen ? window.screen.width : 0) + "x" + (window.screen ? window.screen.height : 0),
                sessionId: sessionId()
            });
        });
    }

    /* ===== Dashboard ===== */

    function barsHTML(list) {
        if (!list || !list.length) return '<p class="dash-empty">Aucune donnée pour cette période.</p>';
        const max = Math.max.apply(null, list.map(function (item) { return item.count; })) || 1;
        return list.map(function (item) {
            const width = Math.max(4, Math.round(item.count / max * 100));
            return '<div class="dash-row">' +
                '<span class="dash-label" title="' + escapeHTML(item.name) + '">' + escapeHTML(item.name) + '</span>' +
                '<span class="dash-bar"><i style="width:' + width + '%"></i></span>' +
                '<span class="dash-count">' + item.count + '</span>' +
                '</div>';
        }).join("");
    }

    function daysHTML(list) {
        if (!list || !list.length) return '<p class="dash-empty">Aucune donnée pour cette période.</p>';
        const max = Math.max.apply(null, list.map(function (item) { return item.count; })) || 1;
        return '<div class="dash-days">' + list.map(function (item) {
            const height = Math.max(6, Math.round(item.count / max * 100));
            const label = item.name && item.name.length === 10 ? item.name.slice(5) : item.name;
            return '<div class="dash-day">' +
                '<span class="dash-day-value">' + item.count + '</span>' +
                '<span class="dash-day-bar"><i style="height:' + height + '%"></i></span>' +
                '<span class="dash-day-label">' + escapeHTML(label) + '</span>' +
                '</div>';
        }).join("") + '</div>';
    }

    function recentHTML(list) {
        if (!list || !list.length) return '<p class="dash-empty">Aucune visite pour cette période.</p>';
        const rows = list.map(function (item) {
            return '<tr>' +
                '<td>' + escapeHTML((item.date || "") + " " + (item.heure || "")) + '</td>' +
                '<td title="' + escapeHTML(item.page) + '">' + escapeHTML(item.page) + '</td>' +
                '<td>' + escapeHTML(item.pays) + (item.ville ? " · " + escapeHTML(item.ville) : "") + '</td>' +
                '<td>' + escapeHTML(item.source) + '</td>' +
                '<td>' + escapeHTML(item.appareil) + '</td>' +
                '<td>' + escapeHTML(item.navigateur) + '</td>' +
                '</tr>';
        }).join("");
        return '<div class="dash-table-wrap"><table class="dash-table">' +
            '<thead><tr><th>Date</th><th>Page</th><th>Pays</th><th>Plateforme</th><th>Appareil</th><th>Navigateur</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';
    }

    function configHTML() {
        return '<div class="dash-config">' +
            '<h3>Connecter le tableau de bord</h3>' +
            '<ol>' +
            '<li>Créez une Google Sheet, puis <strong>Extensions → Apps Script</strong> et collez le contenu de <code>visites.gs</code>.</li>' +
            '<li>Déployez : <strong>Web App</strong>, exécuter en tant que « Moi », accès « Tout le monde ».</li>' +
            '<li>Copiez l\'URL <code>/exec</code> et collez-la ci-dessous.</li>' +
            '</ol>' +
            '<label for="dashApiInput">URL de l\'API visites (/exec)</label>' +
            '<input class="dash-input" id="dashApiInput" type="url" placeholder="https://script.google.com/macros/s/.../exec">' +
            '<button class="dash-btn" type="button" data-dash-save-api>Enregistrer l\'URL</button>' +
            '<p class="dash-note">Le suivi démarre dès que l\'URL est enregistrée.</p>' +
            '</div>';
    }

    function pinHTML(pinError) {
        return '<div class="dash-config">' +
            '<h3>Code d\'accès</h3>' +
            (pinError ? '<p class="dash-error">Code d\'accès invalide. Réessayez.</p>' : '') +
            '<label for="dashPinInput">Code défini dans <code>visites.gs</code> (STATS_PIN)</label>' +
            '<input class="dash-input" id="dashPinInput" type="password" inputmode="numeric" autocomplete="off" placeholder="Code d\'accès">' +
            '<button class="dash-btn" type="button" data-dash-save-pin>Entrer</button>' +
            '<div class="dash-links"><button class="dash-link" type="button" data-dash-change-api>Changer l\'URL du serveur</button></div>' +
            '</div>';
    }

    function loadingHTML() {
        return '<div class="dash-loading">' +
            '<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div>' +
            '<p class="dash-note">Chargement des statistiques...</p>' +
            '</div>';
    }

    function errorHTML(message) {
        return '<div class="dash-error">' + escapeHTML(message) + '</div>' +
            '<button class="dash-btn" type="button" data-dash-refresh>Réessayer</button>';
    }

    function rangesHTML() {
        return RANGES.map(function (range) {
            return '<button class="dash-range' + (dashState.range === range[0] ? " active" : "") + '" type="button" data-dash-range="' + range[0] + '">' +
                range[1] + '</button>';
        }).join("");
    }

    function resultsHTML(data) {
        return '<div class="dash-head">' +
            '<div class="dash-ranges">' + rangesHTML() + '</div>' +
            '<button class="dash-range" type="button" data-dash-refresh>Actualiser</button>' +
            '</div>' +
            '<div class="dash-kpis">' +
            '<div class="dash-kpi"><span>Visites</span><strong>' + data.total + '</strong></div>' +
            '<div class="dash-kpi"><span>Visiteurs uniques</span><strong>' + data.uniqueSessions + '</strong></div>' +
            '<div class="dash-kpi"><span>Pays</span><strong>' + data.countryCount + '</strong></div>' +
            '<div class="dash-kpi"><span>Pages différentes</span><strong>' + data.pageCount + '</strong></div>' +
            '</div>' +
            '<div class="dash-grid">' +
            '<section class="dash-card"><h3>Visites par pays</h3>' + barsHTML(data.byCountry) + '</section>' +
            '<section class="dash-card"><h3>Pages visitées</h3>' + barsHTML(data.byPage) + '</section>' +
            '<section class="dash-card"><h3>Plateformes d\'origine</h3>' + barsHTML(data.bySource) + '</section>' +
            '<section class="dash-card"><h3>Type d\'appareil</h3>' + barsHTML(data.byDevice) + '</section>' +
            '<section class="dash-card"><h3>Navigateur</h3>' + barsHTML(data.byBrowser) + '</section>' +
            '<section class="dash-card"><h3>Système d\'exploitation</h3>' + barsHTML(data.byOS) + '</section>' +
            '</div>' +
            '<section class="dash-card dash-gap"><h3>Visites par jour</h3>' + daysHTML(data.byDay) + '</section>' +
            '<section class="dash-card"><h3>Dernières visites</h3>' + recentHTML(data.recent) + '</section>' +
            '<div class="dash-links">' +
            '<button class="dash-link" type="button" data-dash-change-pin>Changer le code d\'accès</button>' +
            '<button class="dash-link" type="button" data-dash-change-api>Changer l\'URL du serveur</button>' +
            '</div>';
    }

    function renderDashboard() {
        const box = document.getElementById("visitsDashboard");
        if (!box) return;

        if (!getApiUrl()) {
            box.innerHTML = configHTML();
        } else if (!getPin()) {
            box.innerHTML = pinHTML(dashState.error === "pin");
        } else if (dashState.status === "loading") {
            box.innerHTML = loadingHTML();
        } else if (dashState.status === "error") {
            box.innerHTML = errorHTML(dashState.error || "Erreur inconnue.");
        } else if (dashState.status === "ready" && dashState.data) {
            box.innerHTML = resultsHTML(dashState.data);
        } else {
            box.innerHTML = '<div class="dash-head"><div class="dash-ranges">' + rangesHTML() + '</div></div>' + loadingHTML();
        }
    }

    function fetchStats() {
        if (dashState.status === "loading") return;
        const api = getApiUrl();
        const pin = getPin();
        if (!api || !pin) return;

        dashState.status = "loading";
        dashState.error = "";
        renderDashboard();

        const url = api +
            (api.indexOf("?") === -1 ? "?" : "&") +
            "action=stats&pin=" + encodeURIComponent(pin) +
            "&range=" + encodeURIComponent(dashState.range) +
            "&t=" + Date.now();

        const controller = new AbortController();
        const timer = setTimeout(function () { controller.abort(); }, 20000);

        fetch(url, { signal: controller.signal })
            .then(function (response) {
                clearTimeout(timer);
                return response.json();
            })
            .then(function (result) {
                if (result && result.status === "success" && result.data) {
                    dashState.data = result.data;
                    dashState.status = "ready";
                } else if (result && result.code === "pin") {
                    dashState.error = "pin";
                    dashState.status = "error";
                    try { localStorage.removeItem(STORAGE.pin); } catch (error) { /* ignore */ }
                } else {
                    dashState.error = (result && result.message) || "Réponse inattendue du serveur.";
                    dashState.status = "error";
                }
                renderDashboard();
            })
            .catch(function () {
                clearTimeout(timer);
                dashState.error = "Impossible de charger les statistiques. Vérifiez l'URL /exec et votre connexion.";
                dashState.status = "error";
                renderDashboard();
            });
    }

    function bindDashboard() {
        const box = document.getElementById("visitsDashboard");
        if (!box || box.dataset.bound === "1") return;
        box.dataset.bound = "1";

        box.addEventListener("click", function (event) {
            const target = event.target;
            const rangeButton = target.closest("[data-dash-range]");
            if (rangeButton) {
                dashState.range = rangeButton.dataset.dashRange;
                dashState.status = "idle";
                fetchStats();
                return;
            }
            if (target.closest("[data-dash-refresh]")) {
                dashState.status = "idle";
                fetchStats();
                return;
            }
            if (target.closest("[data-dash-save-api]")) {
                const input = document.getElementById("dashApiInput");
                const value = input ? input.value.trim() : "";
                if (!/^https?:\/\//i.test(value)) {
                    if (input) input.focus();
                    return;
                }
                try {
                    localStorage.setItem(STORAGE.api, value);
                    localStorage.removeItem(STORAGE.pin);
                } catch (error) { /* ignore */ }
                dashState.status = "idle";
                renderDashboard();
                return;
            }
            if (target.closest("[data-dash-save-pin]")) {
                const input = document.getElementById("dashPinInput");
                const value = input ? input.value.trim() : "";
                if (!value) { if (input) input.focus(); return; }
                try { localStorage.setItem(STORAGE.pin, value); } catch (error) { /* ignore */ }
                dashState.status = "idle";
                dashState.error = "";
                fetchStats();
                return;
            }
            if (target.closest("[data-dash-change-pin]")) {
                try { localStorage.removeItem(STORAGE.pin); } catch (error) { /* ignore */ }
                dashState.status = "idle";
                dashState.error = "";
                renderDashboard();
                return;
            }
            if (target.closest("[data-dash-change-api]")) {
                try {
                    localStorage.removeItem(STORAGE.api);
                    localStorage.removeItem(STORAGE.pin);
                } catch (error) { /* ignore */ }
                dashState.data = null;
                dashState.status = "idle";
                dashState.error = "";
                renderDashboard();
                return;
            }
        });

        box.addEventListener("keydown", function (event) {
            if (event.key !== "Enter") return;
            if (event.target.id === "dashApiInput") {
                event.preventDefault();
                const button = box.querySelector("[data-dash-save-api]");
                if (button) button.click();
            }
            if (event.target.id === "dashPinInput") {
                event.preventDefault();
                const button = box.querySelector("[data-dash-save-pin]");
                if (button) button.click();
            }
        });
    }

    function openDashboardIfActive() {
        if (currentRoute().tab !== "stats") return;
        bindDashboard();
        if (getApiUrl() && getPin() && dashState.status === "idle") {
            fetchStats();
        } else {
            renderDashboard();
        }
    }

    /* ===== Démarrage ===== */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            bindDashboard();
            openDashboardIfActive();
        });
    } else {
        bindDashboard();
        openDashboardIfActive();
    }

    window.addEventListener("load", trackVisit);
    window.addEventListener("hashchange", function () {
        trackVisit();
        openDashboardIfActive();
    });
})();
