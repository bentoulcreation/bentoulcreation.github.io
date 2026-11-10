/* ===== Configuration ===== */
const SERIES_API_URLS = {
    bentoul: "https://script.google.com/macros/s/AKfycbz_ivMYAG9hALLaJmAhF4fVzPXg_xGp6hydJsfOMYsibOqB-Kcqmkjn3HeNIMg4Ixg/exec",
    benamoura: "https://script.google.com/macros/s/AKfycbz1IhFdZnrIMni5-pzQv6T45IeYnC4gZs0Yf0eq3W8o3gCK3d7ozPWL9HUL-ZH2s97sJg/exec"
};
const USERS_API_URL = window.USERS_API_URL || "https://script.google.com/macros/s/AKfycbztkXjtM6_9bdfg7XWTZOSRpy3omwpjb5Zer1OxGXYLcFd1SxX-zHEjkkQ5X3a14i4/exec";
const ACCOUNT_STORAGE_KEY = "bentoul.account.user";
const CACHE_PREFIX = "bentoulcreation.cache.";
const CACHE_TTL = 10 * 60 * 1000;

const TABS = ["home", "services", "contact", "bentoul", "benamoura", "account"];
/* ===== SEO dynamique par tab ===== */
const SEO = {
    home: {
        title: "BENTOUL CREATION",
        description: "Bienvenue sur BENTOUL CREATION, découvrez tous nos services et apprenez l'informatique sur Android et PC grâce à nos astuces.",
        image: "image/home.jpg"
    },
    services: {
        title: "CRÉATION FORMULAIRE",
        description: "Demandez un formulaire personnalisé pour votre business ou votre école : séminaire, commande, rendez-vous, etc.",
        image: "image/services.jpg"
    },
    bentoul: {
        title: "BENTOUL — Astuces informatique sur PC et Android pour vous aider à bien utiliser vos appareils",
        description: "Astuces informatique sur PC et Android : séries et épisodes pratiques pour bien utiliser vos appareils.",
        image: "image/bentoul.jpg"
    },
    benamoura: {
        title: "BENAMOURA — Retrouvez nos histoires et nos SMS en série et des conseils pour vous aider à grandir en paix et en toute conscience",
        description: "Histoires d'amour et SMS en série, plus des conseils pour grandir en paix et en toute conscience.",
        image: "image/benamoura.jpg"
    },
    contact: {
        title: "Contact — BENTOUL CREATION",
        description: "Contactez BENTOUL CREATION sur WhatsApp pour une formation à domicile ou un service numérique.",
        image: "image/home.jpg"
    },
    account: {
        title: "Mon compte — BENTOUL CREATION",
        description: "Gérez votre compte BENTOUL CREATION : crédits, code de parrainage et connexion.",
        image: "image/home.jpg"
    }
};

/* ===== Liens d'abonnement du header (colle tes URL ici) ===== */
const SUBSCRIBE_LINKS = {
    home: "https://www.youtube.com/@bentoulcreation",
    bentoul: "https://whatsapp.com/channel/0029VadhmlpEAKWIRzYyWt0a",
    benamoura: "https://whatsapp.com/channel/0029Vb6gBha8F2pDLuILTH1o"
};
const SUBSCRIBE_META = {
    home: { icon: "fa-brands fa-youtube", label: "S'abonner", theme: "youtube" },
    bentoul: { icon: "fa-brands fa-whatsapp", label: "S'abonner", theme: "whatsapp" },
    benamoura: { icon: "fa-brands fa-whatsapp", label: "S'abonner", theme: "whatsapp" }
};
const SERIES_SPACES = ["bentoul", "benamoura"];

/* ===== État ===== */
const seriesCache = { bentoul: [], benamoura: [] };
const episodeCache = {
    bentoul: { seriesId: null, items: [] },
    benamoura: { seriesId: null, items: [] }
};
const selectedSeries = { bentoul: null, benamoura: null };
const selectedEpisode = { bentoul: null, benamoura: null };
const pendingSeries = { bentoul: null, benamoura: null };
const pendingEpisodes = { bentoul: null, benamoura: null };
let routeToken = 0;

/* ===== Utilitaires ===== */
function escapeHTML(value) {
    return String(value || "").replace(/[&<>'"]/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    })[character]);
}

function safeHTML(value) {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    const allowed = new Set(["P", "BR", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "A", "H2", "H3", "H4"]);

    template.content.querySelectorAll("script, style, iframe, object, embed").forEach(node => node.remove());
    template.content.querySelectorAll("*").forEach(node => {
        if (!allowed.has(node.tagName)) {
            node.replaceWith(...node.childNodes);
            return;
        }
        [...node.attributes].forEach(attribute => {
            if (node.tagName !== "A" || attribute.name !== "href" || !/^https?:\/\//i.test(attribute.value)) {
                node.removeAttribute(attribute.name);
            }
        });
        if (node.tagName === "A") node.setAttribute("target", "_blank");
    });
    return template.innerHTML;
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "sans-titre";
}

function safeDecode(value) {
    try { return decodeURIComponent(value); } catch (error) { return value; }
}

function slugFor(items, item) {
    const base = slugify(item.titre);
    let rank = 0;
    for (const other of items) {
        if (other === item) return rank === 0 ? base : `${base}-${rank + 1}`;
        if (slugify(other.titre) === base) rank++;
    }
    return base;
}

function findBySlug(items, slug) {
    if (!slug) return null;
    const decoded = safeDecode(slug);
    return items.find(item => slugFor(items, item) === decoded)
        || items.find(item => String(item.id) === decoded)
        || null;
}

function isPublished(item) {
    const statut = String(item.statut || "Publié").trim().toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "");
    return statut === "publie" || statut === "publiee" || statut === "published";
}

async function fetchJSON(url, attempts = 2, timeout = 15000) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { cache: "no-store", signal: controller.signal });
            if (!response.ok) throw new Error("HTTP " + response.status);
            return await response.json();
        } catch (error) {
            lastError = error;
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError;
}

async function postJSON(url, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
    } finally {
        clearTimeout(timer);
    }
}

function readCache(key) {
    try {
        const raw = sessionStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || Date.now() - entry.time > CACHE_TTL) return null;
        return entry.data;
    } catch (error) {
        return null;
    }
}

function writeCache(key, data) {
    try {
        sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ time: Date.now(), data }));
    } catch (error) { /* quota dépassé : le cache session est optionnel */ }
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        let copied = false;
        try { copied = document.execCommand("copy"); } catch (ignored) {}
        area.remove();
        return copied;
    }
}

/* ===== Menu latéral ===== */
const menuToggle = document.querySelector("#menuToggle");
const sidebar = document.querySelector("#sidebar");
const sidebarBackdrop = document.querySelector("#sidebarBackdrop");

function closeSidebar() {
    if (!sidebar || !sidebarBackdrop || !menuToggle) return;
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
}

if (menuToggle && sidebar && sidebarBackdrop) {
    menuToggle.addEventListener("click", function() {
        const isOpen = sidebar.classList.toggle("open");
        sidebarBackdrop.classList.toggle("open", isOpen);
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
    sidebarBackdrop.addEventListener("click", closeSidebar);
}

/* ===== Modale service ===== */
const serviceModalBackdrop = document.querySelector("#serviceModalBackdrop");
const serviceModalClose = document.querySelector("#serviceModalClose");
const serviceModalTitle = document.querySelector("#serviceModalTitle");
const serviceModalPrice = document.querySelector("#serviceModalPrice");
const serviceModalFeatures = document.querySelector("#serviceModalFeatures");
const serviceRequest = document.querySelector("#serviceRequest");
const serviceModalSubmit = document.querySelector("#serviceModalSubmit");
let selectedService = "";
let selectedPrice = "";

function closeServiceModal() {
    if (!serviceModalBackdrop) return;
    serviceModalBackdrop.classList.remove("open");
}

document.querySelectorAll(".pricing-action").forEach(button => {
    button.addEventListener("click", function() {
        selectedService = button.dataset.service;
        selectedPrice = button.dataset.price;
        serviceModalTitle.textContent = `Offre ${selectedService}`;
        serviceModalPrice.textContent = selectedPrice;
        serviceModalFeatures.innerHTML = button.dataset.features
            .split("|")
            .map(feature => `<li>${escapeHTML(feature)}</li>`)
            .join("");
        serviceRequest.value = "";
        serviceModalBackdrop.classList.add("open");
        serviceRequest.focus();
    });
});

if (serviceModalClose) serviceModalClose.addEventListener("click", closeServiceModal);
if (serviceModalBackdrop) {
    serviceModalBackdrop.addEventListener("click", function(e) {
        if (e.target === serviceModalBackdrop) closeServiceModal();
    });
}
if (serviceModalSubmit) {
    serviceModalSubmit.addEventListener("click", function() {
        const request = serviceRequest.value.trim() || "Je souhaite recevoir plus d'informations.";
        const message = [
            "Bonjour BENTOUL CREATION,",
            `Je suis intéressé(e) par l'offre ${selectedService} à ${selectedPrice}.`,
            `Ma demande : ${request}`
        ].join("\n");
        window.open(`https://wa.me/50942772970?text=${encodeURIComponent(message)}`, "_blank");
        closeServiceModal();
    });
}

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        closeServiceModal();
        closeSidebar();
    }
});

/* ===== Données séries / épisodes ===== */
function ensureSeries(space, force = false) {
    if (pendingSeries[space]) return pendingSeries[space];
    if (!force) {
        if (seriesCache[space].length) return Promise.resolve(seriesCache[space]);
        const cached = readCache("series." + space);
        if (cached && cached.length) {
            seriesCache[space] = cached;
            return Promise.resolve(cached);
        }
    }
    const promise = fetchJSON(`${SERIES_API_URLS[space]}?action=getSeries`)
        .then(result => {
            if (!result || result.status !== "success" || !Array.isArray(result.data)) {
                throw new Error((result && result.message) || "Réponse invalide du serveur.");
            }
            const series = result.data.filter(isPublished);
            seriesCache[space] = series;
            if (series.length) writeCache("series." + space, series);
            return series;
        })
        .finally(() => { pendingSeries[space] = null; });
    pendingSeries[space] = promise;
    return promise;
}

function ensureEpisodes(space, series, force = false) {
    if (pendingEpisodes[space] && pendingEpisodes[space].id === series.id) {
        return pendingEpisodes[space].promise;
    }
    const key = "episodes." + space + "." + series.id;
    if (!force) {
        const cached = readCache(key);
        if (cached) return Promise.resolve(cached);
    }
    const promise = fetchJSON(`${SERIES_API_URLS[space]}?action=getEpisodes&seriesId=${encodeURIComponent(series.id)}`)
        .then(result => {
            if (!result || result.status !== "success" || !Array.isArray(result.data)) {
                throw new Error((result && result.message) || "Réponse invalide du serveur.");
            }
            let episodes = result.data.filter(isPublished);
            if (episodes.length && episodes.every(item => Number(item.numero) > 0)) {
                episodes = episodes.slice().sort((a, b) => Number(a.numero) - Number(b.numero));
            }
            writeCache(key, episodes);
            return episodes;
        })
        .finally(() => {
            if (pendingEpisodes[space] && pendingEpisodes[space].promise === promise) {
                pendingEpisodes[space] = null;
            }
        });
    pendingEpisodes[space] = { id: series.id, promise };
    return promise;
}

/* ===== Rendu ===== */
function showPanel(space, panel) {
    document.querySelector(`#${space}SeriesView`).hidden = panel !== "series";
    document.querySelector(`#${space}EpisodesView`).hidden = panel !== "episodes";
    document.querySelector(`#${space}EpisodeView`).hidden = panel !== "episode";
}

function skeletonCards(count) {
    return Array.from({ length: count }, () =>
        `<div class="skeleton-card" aria-hidden="true"><div class="skeleton-image"></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`
    ).join("");
}

function errorHTML(message) {
    return `<div class="series-empty list-error"><p>${escapeHTML(message)}</p><button type="button" class="retry-btn" data-retry-route>Réessayer</button></div>`;
}

function notFoundHTML(message, backHref) {
    return `<div class="series-empty list-error"><p>${escapeHTML(message)}</p><a class="retry-btn" href="${backHref}">← Retour</a></div>`;
}

function renderSeries(space) {
    const list = document.querySelector(`#${space}SeriesList`);
    if (!list) return;
    if (!seriesCache[space].length) {
        list.innerHTML = '<div class="series-empty">Aucune série publiée pour le moment.</div>';
        return;
    }
    list.innerHTML = seriesCache[space].map(item => {
        const image = item.image
            ? `<img src="${escapeHTML(item.image)}" alt="" loading="lazy">`
            : `<span class="series-placeholder">${space === "benamoura" ? "♥" : "⌨"}</span>`;
        const href = `#/${space}/${slugFor(seriesCache[space], item)}`;
        return `<a class="series-card" href="${href}" aria-label="Ouvrir les épisodes de ${escapeHTML(item.titre || "cette série")}">
            <div class="series-card-image">
                ${image}
                <div class="series-card-overlay">
                    <h3>${escapeHTML(item.titre || "Série sans titre")}</h3>
                    <div class="series-card-description">${safeHTML(item.contenu || "Découvrez cette série et ses épisodes.")}</div>
                </div>
            </div>
            <div class="series-card-content">
                <div class="series-meta"><span><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> ${Number(item.shares) || 0}</span><span><i class="fa-solid fa-eye" aria-hidden="true"></i> ${Number(item.views) || 0}</span></div>
            </div>
        </a>`;
    }).join("");
}

function episodeHref(space, episode) {
    const series = selectedSeries[space];
    const seriesSlug = series ? slugFor(seriesCache[space], series) : "";
    return `#/${space}/${seriesSlug}/${slugFor(episodeCache[space].items, episode)}`;
}

function episodeActionsHTML(space, episode, cardStyle) {
    const attr = cardStyle ? "data-card-reaction" : "data-reaction";
    const cls = cardStyle ? "episode-action" : "reader-action";
    const idAttr = cardStyle ? ` data-episode-id="${escapeHTML(episode.id)}"` : "";
    return `<button class="${cls}" type="button" aria-label="J'aime" ${attr}="like" data-space="${space}"${idAttr}><i class="fa-solid fa-thumbs-up" aria-hidden="true"></i> ${Number(episode.likes) || 0}</button>
        <button class="${cls}" type="button" aria-label="Je n'aime pas" ${attr}="dislike" data-space="${space}"${idAttr}><i class="fa-solid fa-thumbs-down" aria-hidden="true"></i> ${Number(episode.dislikes) || 0}</button>
        <button class="${cls}" type="button" aria-label="Partager le lien" ${attr}="share" data-space="${space}"${idAttr}><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> ${Number(episode.shares) || 0}</button>`;
}

function renderEpisodes(space) {
    const list = document.querySelector(`#${space}EpisodesList`);
    const title = document.querySelector(`#${space}EpisodesTitle`);
    const series = selectedSeries[space];
    if (!list || !series) return;
    title.textContent = series.titre || "Épisodes";
    const episodes = episodeCache[space].items;
    list.innerHTML = episodes.length
        ? episodes.map((item, index) => {
            const image = item.image
                ? `<img src="${escapeHTML(item.image)}" alt="" loading="lazy">`
                : `<span class="episode-placeholder"><i class="fa-solid fa-book-open" aria-hidden="true"></i></span>`;
            const href = episodeHref(space, item);
            return `<article class="episode-card">
                <a class="episode-card-link" href="${href}" aria-label="Lire ${escapeHTML(item.titre || "cet épisode")}">
                    <div class="episode-card-image">
                        ${image}
                        <div class="episode-card-overlay">
                            <h3>${Number(item.numero) || index + 1}. ${escapeHTML(item.titre || "Épisode sans titre")}</h3>
                            <div class="episode-content">${safeHTML(item.contenu || "")}</div>
                        </div>
                    </div>
                </a>
                <div class="episode-card-content">
                    <div class="episode-meta"><span><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> ${Number(item.shares) || 0}</span><span><i class="fa-solid fa-eye" aria-hidden="true"></i> ${Number(item.views) || 0}</span></div>
                    <div class="episode-actions">${episodeActionsHTML(space, item, true)}</div>
                    <a class="episode-open" href="${href}">Lire l'épisode</a>
                </div>
            </article>`;
        }).join("")
        : '<div class="series-empty">Aucun épisode publié pour cette série.</div>';
}

function readerActionsHTML(space) {
    const episode = selectedEpisode[space];
    return `${episodeActionsHTML(space, episode, false)}
        <span class="reader-action"><i class="fa-solid fa-eye" aria-hidden="true"></i> ${Number(episode.views) || 0}</span>`;
}

function renderEpisodeReader(space) {
    const episode = selectedEpisode[space];
    const reader = document.querySelector(`#${space}EpisodeReader`);
    if (!episode || !reader) return;
    const image = episode.image
        ? `<img class="episode-reader-image" src="${escapeHTML(episode.image)}" alt="">`
        : "";
    reader.innerHTML = `${image}
        <h2>${escapeHTML(episode.titre || "Épisode")}</h2>
        <div class="episode-content">${safeHTML(episode.contenu || "Aucun contenu disponible.")}</div>
        <div class="reader-actions">${readerActionsHTML(space)}</div>
        <div class="comments-box">
            <h3>Commentaires</h3>
            <div id="${space}CommentsList">Chargement des commentaires...</div>
            <div class="comment-form">
                <textarea id="${space}CommentInput" placeholder="Écrire un commentaire..." maxlength="500"></textarea>
                <button type="button" data-send-comment="${space}">Envoyer</button>
            </div>
        </div>`;
    loadComments(space);
}

function refreshReaderActions(space) {
    const container = document.querySelector(`#${space}EpisodeReader .reader-actions`);
    if (container && selectedEpisode[space]) container.innerHTML = readerActionsHTML(space);
}

function refreshCardActions(space, episodeId) {
    const episode = episodeCache[space].items.find(item => String(item.id) === String(episodeId));
    if (!episode) return;
    document.querySelectorAll(`[data-card-reaction][data-space="${space}"][data-episode-id="${CSS.escape(String(episodeId))}"]`).forEach(button => {
        const action = button.dataset.cardReaction;
        const field = action === "like" ? "likes" : action === "dislike" ? "dislikes" : "shares";
        const icon = action === "like" ? "fa-thumbs-up" : action === "dislike" ? "fa-thumbs-down" : "fa-share-nodes";
        button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${Number(episode[field]) || 0}`;
    });
}

async function loadComments(space) {
    const episode = selectedEpisode[space];
    const box = document.querySelector(`#${space}CommentsList`);
    if (!episode || !box) return;
    const episodeId = episode.id;
    try {
        const result = await fetchJSON(`${SERIES_API_URLS[space]}?action=getComments&episodeId=${encodeURIComponent(episode.id)}`, 1, 12000);
        if (!selectedEpisode[space] || selectedEpisode[space].id !== episodeId) return;
        const comments = result && result.status === "success" ? result.data || [] : [];
        box.innerHTML = comments.length
            ? comments.map(comment => `<div class="comment-item"><strong>${escapeHTML(comment.pseudo || comment.username || "Visiteur")}</strong><br>${safeHTML(comment.message || "")}</div>`).join("")
            : '<p>Aucun commentaire pour le moment.</p>';
    } catch (error) {
        if (!selectedEpisode[space] || selectedEpisode[space].id !== episodeId) return;
        box.innerHTML = "<p>Les commentaires sont momentanément indisponibles.</p>";
    }
}

/* ===== SEO + bouton d'abonnement ===== */
function setMeta(attr, key, content) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute("content", content);
}

function applySEO(tab, override = {}) {
    const base = SEO[tab] || SEO.home;
    const title = override.title || base.title;
    const description = override.description || base.description;
    const image = new URL(override.image || base.image, location.href).href;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:image", image);
    setMeta("property", "og:url", location.href);
    setMeta("property", "og:type", "website");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
    }
    canonical.href = location.href;
}

function updateSubscribe(tab) {
    const header = document.querySelector(".site-header");
    if (!header) return;
    let btn = document.querySelector("#subscribeBtn");
    const meta = SUBSCRIBE_META[tab];
    if (!meta) {
        if (btn) btn.remove();
        return;
    }
    if (!btn) {
        btn = document.createElement("a");
        btn.id = "subscribeBtn";
        btn.className = "subscribe-btn";
        btn.target = "_blank";
        btn.rel = "noopener noreferrer";
        header.insertBefore(btn, header.querySelector(".site-credits"));
    }
    const url = (SUBSCRIBE_LINKS[tab] || "").trim();
    btn.classList.toggle("youtube", meta.theme === "youtube");
    btn.classList.toggle("whatsapp", meta.theme === "whatsapp");
    btn.innerHTML = `<i class="${meta.icon}" aria-hidden="true"></i><span>${escapeHTML(meta.label)}</span>`;
    if (url) {
        btn.href = url;
        btn.removeAttribute("aria-disabled");
        btn.title = meta.theme === "youtube" ? "S'abonner à la chaîne YouTube" : "S'abonner à la chaîne WhatsApp";
    } else {
        btn.removeAttribute("href");
        btn.setAttribute("aria-disabled", "true");
        btn.title = "Lien d'abonnement à configurer dans SUBSCRIBE_LINKS (tab.js)";
    }
    btn.setAttribute("aria-label", `${meta.label} — ${tab}`);
}

/* ===== Routing : #/tab, #/tab/titre-serie, #/tab/titre-serie/titre-episode ===== */
function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean).map(safeDecode);
    const tab = TABS.includes(parts[0]) ? parts[0] : "home";
    return { tab, seriesSlug: parts[1] || "", episodeSlug: parts[2] || "" };
}

function activateTab(tab) {
    document.querySelectorAll("[data-tab]").forEach(element => {
        element.classList.toggle("active", element.dataset.tab === tab);
    });
    document.querySelectorAll(".tab-content").forEach(panel => {
        panel.classList.toggle("active", panel.dataset.content === tab);
    });
    if (tab === "account") renderAccount();
}

function setBackLinks(space) {
    const backSeries = document.querySelector(`[data-back-series="${space}"]`);
    if (backSeries) backSeries.setAttribute("href", `#/${space}`);
    const backEpisodes = document.querySelector(`[data-back-episodes="${space}"]`);
    const series = selectedSeries[space];
    if (backEpisodes) {
        backEpisodes.setAttribute("href", series ? `#/${space}/${slugFor(seriesCache[space], series)}` : `#/${space}`);
    }
}

async function renderSpaceRoute(space, seriesSlug, episodeSlug, token) {
    if (!seriesSlug) {
        showPanel(space, "series");
        applySEO(space);
        if (seriesCache[space].length) renderSeries(space);
        else document.querySelector(`#${space}SeriesList`).innerHTML = skeletonCards(3);
        try {
            await ensureSeries(space);
            if (token !== routeToken) return;
            renderSeries(space);
        } catch (error) {
            if (token !== routeToken) return;
            document.querySelector(`#${space}SeriesList`).innerHTML =
                errorHTML("Impossible de charger les séries. Vérifiez votre connexion puis réessayez.");
        }
        return;
    }

    showPanel(space, episodeSlug ? "episode" : "episodes");
    if (episodeSlug) {
        document.querySelector(`#${space}EpisodeReader`).innerHTML =
            '<div class="reader-loading"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div><p>Chargement de l\'épisode...</p></div>';
    } else {
        document.querySelector(`#${space}EpisodesTitle`).textContent = "Chargement...";
        document.querySelector(`#${space}EpisodesList`).innerHTML = skeletonCards(3);
    }

    let series = null;
    try {
        await ensureSeries(space);
        if (token !== routeToken) return;
        series = findBySlug(seriesCache[space], seriesSlug);
    } catch (error) {
        if (token !== routeToken) return;
        const box = episodeSlug ? document.querySelector(`#${space}EpisodeReader`) : document.querySelector(`#${space}EpisodesList`);
        box.innerHTML = errorHTML("Impossible de charger les séries. Vérifiez votre connexion puis réessayez.");
        return;
    }
    if (!series) {
        const box = episodeSlug ? document.querySelector(`#${space}EpisodeReader`) : document.querySelector(`#${space}EpisodesList`);
        box.innerHTML = notFoundHTML("Série introuvable ou non publiée.", `#/${space}`);
        return;
    }

    selectedSeries[space] = series;
    selectedEpisode[space] = null;
    setBackLinks(space);

    let episodes;
    try {
        episodes = await ensureEpisodes(space, series);
        if (token !== routeToken) return;
    } catch (error) {
        if (token !== routeToken) return;
        const box = episodeSlug ? document.querySelector(`#${space}EpisodeReader`) : document.querySelector(`#${space}EpisodesList`);
        document.querySelector(`#${space}EpisodesTitle`).textContent = series.titre || "Épisodes";
        box.innerHTML = errorHTML("Impossible de charger les épisodes. Vérifiez votre connexion puis réessayez.");
        return;
    }
    episodeCache[space] = { seriesId: series.id, items: episodes };

    if (!episodeSlug) {
        renderEpisodes(space);
        applySEO(space, {
            title: `${series.titre || "Série"} — BENTOUL CREATION`,
            image: series.image || "",
            description: `Découvrez la série « ${series.titre || "Série"} » et tous ses épisodes sur BENTOUL CREATION.`
        });
        return;
    }

    const episode = findBySlug(episodes, episodeSlug);
    if (!episode) {
        document.querySelector(`#${space}EpisodeReader`).innerHTML =
            notFoundHTML("Épisode introuvable ou non publié.", `#/${space}/${slugFor(seriesCache[space], series)}`);
        return;
    }
    selectedEpisode[space] = episode;
    renderEpisodeReader(space);
    applySEO(space, {
        title: `${episode.titre || "Épisode"} — ${series.titre || "Série"} | BENTOUL CREATION`,
        image: episode.image || series.image || "",
        description: `Lire « ${episode.titre || "Épisode"} » de la série « ${series.titre || "Série"} » sur BENTOUL CREATION.`
    });
}

async function applyRoute() {
    const token = ++routeToken;
    const { tab, seriesSlug, episodeSlug } = parseRoute();
    activateTab(tab);
    updateSubscribe(tab);
    applySEO(tab);
    closeSidebar();
    window.scrollTo(0, 0);
    if (SERIES_SPACES.includes(tab)) {
        await renderSpaceRoute(tab, seriesSlug, episodeSlug, token);
    }
}

window.addEventListener("hashchange", applyRoute);

/* ===== Réactions / partage / commentaires ===== */
function updateReactionCount(episode, action) {
    const field = action === "like" ? "likes" : action === "dislike" ? "dislikes" : "shares";
    episode[field] = (Number(episode[field]) || 0) + 1;
}

function postReaction(space, episode, action) {
    postJSON(SERIES_API_URLS[space], {
        type: "interaction",
        targetType: "episode",
        targetId: episode.id,
        action,
        likeDelta: action === "like" ? 1 : 0,
        dislikeDelta: action === "dislike" ? 1 : 0,
        shareDelta: action === "share" ? 1 : 0
    }).catch(() => { /* l'affichage local reste disponible */ });
}

function flashShareFeedback(button, copied) {
    if (!button || !button.isConnected) return;
    button.innerHTML = `<i class="fa-solid ${copied ? "fa-check" : "fa-link"}" aria-hidden="true"></i> ${copied ? "Lien copé !" : "Lien dans la barre d'adresse"}`;
    setTimeout(() => {
        if (!button.isConnected) return;
        const space = button.dataset.space;
        if (button.dataset.cardReaction) {
            refreshCardActions(space, button.dataset.episodeId);
        } else {
            refreshReaderActions(space);
        }
    }, 1800);
}

async function handleReaderReaction(space, action, button) {
    const episode = selectedEpisode[space];
    if (!episode) return;
    if (action === "share") {
        const copied = await copyText(location.href);
        if (copied) {
            updateReactionCount(episode, "shares");
            postReaction(space, episode, "share");
        }
        refreshReaderActions(space);
        flashShareFeedback(document.querySelector(`#${space}EpisodeReader [data-reaction="share"]`), copied);
        return;
    }
    updateReactionCount(episode, action);
    refreshReaderActions(space);
    postReaction(space, episode, action);
}

async function handleCardReaction(space, episodeId, action, button) {
    const episode = episodeCache[space].items.find(item => String(item.id) === String(episodeId));
    if (!episode) return;
    if (action === "share") {
        const copied = await copyText(`${location.origin}${location.pathname}${episodeHref(space, episode)}`);
        if (copied) {
            updateReactionCount(episode, "shares");
            postReaction(space, episode, "share");
        }
        refreshCardActions(space, episodeId);
        flashShareFeedback(button, copied);
        return;
    }
    updateReactionCount(episode, action);
    refreshCardActions(space, episodeId);
    postReaction(space, episode, action);
}

async function sendComment(space) {
    const episode = selectedEpisode[space];
    const input = document.querySelector(`#${space}CommentInput`);
    if (!episode || !input || !input.value.trim()) return;
    const message = input.value.trim();
    const user = getStoredUser();
    const pseudo = user ? (user.username || user.nom || "Visiteur") : "Visiteur";
    try {
        await postJSON(SERIES_API_URLS[space], { type: "comment", episodeId: episode.id, pseudo, username: pseudo, message });
        input.value = "";
        loadComments(space);
    } catch (error) {
        alert("Impossible d'envoyer le commentaire pour le moment.");
    }
}

/* ===== Compte utilisateur ===== */
function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY) || "null");
    } catch (error) {
        return null;
    }
}

function saveStoredUser(user) {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(user));
}

function syncHeaderCredits() {
    const badge = document.querySelector(".site-credits");
    if (!badge) return;
    const user = getStoredUser();
    const credits = Number(user && user.credits) || 0;
    badge.textContent = `${credits} crédit${credits > 1 ? "s" : ""}`;
}

function renderAccount(mode = "login", message = "") {
    const box = document.querySelector("#accountBox");
    if (!box) return;
    const user = getStoredUser();
    syncHeaderCredits();

    if (user) {
        box.innerHTML = `<div class="account-profile">
            <h3>Bonjour ${escapeHTML(user.nom || user.username)} !</h3>
            <div class="account-detail"><span>Nom</span><strong>${escapeHTML(user.nom)}</strong></div>
            <div class="account-detail"><span>Username</span><strong>@${escapeHTML(user.username)}</strong></div>
            <div class="account-detail"><span>Email</span><strong>${escapeHTML(user.email)}</strong></div>
            <div class="account-detail"><span>Numéro</span><strong>${escapeHTML(user.numero)}</strong></div>
            <div class="account-detail"><span>Crédits</span><strong>${Number(user.credits) || 0}</strong></div>
            <div class="account-detail"><span>Code référence</span><strong>${escapeHTML(user.codeReference || "-")}</strong></div>
            <button class="account-logout" type="button" id="accountLogout">Se déconnecter</button>
        </div>`;
        return;
    }

    const registerActive = mode === "register";
    box.innerHTML = `<div class="account-switch">
            <button type="button" class="${registerActive ? "" : "active"}" data-account-mode="login">Connexion</button>
            <button type="button" class="${registerActive ? "active" : ""}" data-account-mode="register">Inscription</button>
        </div>
        <form class="account-form" id="accountForm">
            ${registerActive ? `<label>Nom complet<input name="nom" required maxlength="100"></label>` : ""}
            <label>Username<input name="username" required minlength="3" maxlength="30" autocomplete="username"></label>
            ${registerActive ? `<label>Email<input name="email" type="email" required autocomplete="email"></label>
            <label>Numéro de téléphone<input name="numero" required maxlength="30"></label>` : ""}
            <label>PIN à 6 chiffres<input name="pin" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="current-password"></label>
            ${registerActive ? `<label>Code de parrainage (facultatif)<input name="parrain" maxlength="20"></label>` : ""}
            <div class="account-message" id="accountMessage">${escapeHTML(message)}</div>
            <button type="submit">${registerActive ? "Créer mon compte" : "Se connecter"}</button>
        </form>`;
}

async function submitAccountForm(form) {
    const messageBox = document.querySelector("#accountMessage");
    if (!USERS_API_URL) {
        messageBox.textContent = "URL users.gs non configurée. Ajoutez son URL /exec dans tab.js.";
        return;
    }

    const data = new URLSearchParams(new FormData(form));
    data.set("action", form.querySelector("[name=nom]") ? "register" : "login");
    messageBox.textContent = "Chargement...";

    try {
        const response = await fetch(USERS_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: data.toString()
        });
        const result = await response.json();
        if (!result.success) {
            messageBox.textContent = result.message || "Opération impossible.";
            return;
        }
        saveStoredUser(result.user);
        renderAccount();
    } catch (error) {
        try {
            // Secours GET pour les déploiements Apps Script qui bloquent la
            // lecture de la réponse POST depuis une page statique.
            const response = await fetch(`${USERS_API_URL}?${data.toString()}`, { cache: "no-store" });
            const result = await response.json();
            if (!result.success) {
                messageBox.textContent = result.message || "Opération impossible.";
                return;
            }
            saveStoredUser(result.user);
            renderAccount();
        } catch (fallbackError) {
            messageBox.textContent = "Impossible de contacter le serveur users.gs. Vérifiez que le déploiement est accessible à tous.";
        }
    }
}

/* ===== Délégation des clics ===== */
document.addEventListener("click", function(e) {
    if (e.target.closest('#subscribeBtn[aria-disabled="true"]')) {
        e.preventDefault();
        return;
    }
    const tabControl = e.target.closest("[data-tab]");
    if (tabControl) {
        e.preventDefault();
        const target = `#/${tabControl.dataset.tab}`;
        if (location.hash === target || (target === "#/home" && !location.hash)) applyRoute();
        else location.hash = target;
        return;
    }

    const backSeries = e.target.closest("[data-back-series]");
    if (backSeries) {
        e.preventDefault();
        location.hash = `#/${backSeries.dataset.backSeries}`;
        return;
    }

    const backEpisodes = e.target.closest("[data-back-episodes]");
    if (backEpisodes) {
        e.preventDefault();
        const space = backEpisodes.dataset.backEpisodes;
        const series = selectedSeries[space];
        location.hash = series ? `#/${space}/${slugFor(seriesCache[space], series)}` : `#/${space}`;
        return;
    }

    const cardReaction = e.target.closest("[data-card-reaction]");
    if (cardReaction) {
        handleCardReaction(cardReaction.dataset.space, cardReaction.dataset.episodeId, cardReaction.dataset.cardReaction, cardReaction);
        return;
    }

    const reaction = e.target.closest("[data-reaction]");
    if (reaction) {
        handleReaderReaction(reaction.dataset.space, reaction.dataset.reaction, reaction);
        return;
    }

    const commentButton = e.target.closest("[data-send-comment]");
    if (commentButton) {
        sendComment(commentButton.dataset.sendComment);
        return;
    }

    if (e.target.closest("[data-retry-route]")) {
        applyRoute();
        return;
    }

    const accountMode = e.target.closest("[data-account-mode]");
    if (accountMode) {
        renderAccount(accountMode.dataset.accountMode);
        return;
    }

    if (e.target.closest("#accountLogout")) {
        localStorage.removeItem(ACCOUNT_STORAGE_KEY);
        renderAccount("login", "Vous êtes déconnecté.");
    }
});

document.addEventListener("submit", function(e) {
    if (e.target.id === "accountForm") {
        e.preventDefault();
        submitAccountForm(e.target);
    }
});

/* ===== Positionnement des bannières pub ===== */
function layoutAds() {
    const header = document.querySelector(".site-header");
    const nav = document.querySelector(".tabs-nav");
    const root = document.documentElement;
    root.style.setProperty("--header-h", (header ? header.offsetHeight : 62) + "px");
    root.style.setProperty("--nav-h", (nav ? nav.offsetHeight : 58) + "px");
}

window.addEventListener("resize", layoutAds);
window.addEventListener("load", layoutAds);

/* ===== Démarrage ===== */
renderAccount();
layoutAds();
applyRoute();