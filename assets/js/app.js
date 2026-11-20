/* ============================================================
   BCréation — logique de l'application
   Routeur par pile, contenu Google Sheets / mode démo,
   comptes, crédits, profil et tableau de bord admin.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- Helpers ---------------- */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  const shell = $("#shell");
  const main = $("#main");
  const drawer = $("#drawer");
  const overlay = $("#overlay");
  const modalRoot = $("#modalRoot");
  const toastEl = $("#toast");

  const BCApi = window.BCApi;

  const icon = (name) => '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';

  const esc = (str) => String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const plural = (n, word) => n + " " + word + (Number(n) > 1 ? "s" : "");

  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

  function todayFR() {
    const d = new Date();
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function initials(name) {
    const s = String(name || "?").trim();
    return (s.charAt(0) || "?").toUpperCase();
  }

  function localImage(key) {
    try { return localStorage.getItem("bcreation:image:" + key) || ""; } catch (err) { return ""; }
  }

  function mediaImage(src, className, alt) {
    const value = imageSrc(src);
    return value ? '<img class="' + (className || "card-image") + '" src="' + esc(value) + '" alt="' + esc(alt || "") + '" loading="lazy" referrerpolicy="no-referrer">' : "";
  }

  function imageSrc(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let match = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (!match) match = raw.match(/[?&]id=([^&]+)/i);
    return match ? "https://drive.google.com/thumbnail?id=" + encodeURIComponent(match[1]) + "&sz=w1200" : raw;
  }

  function itemImage(item) {
    return item ? (item.image || item.imageUrl || "") : "";
  }

  function articleShareText(kind, item) {
    const title = item.title || "BCréation";
    const rawDescription = String(item.excerpt || item.tagline || item.synopsis || "").replace(/\r/g, "").trim();
    const descriptionLines = rawDescription
      .split(/\n|(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6);
    const description = (descriptionLines.join(" ") || "Découvre cet épisode sur BCréation.").slice(0, 360);
    const baseUrl = location.protocol === "file:" ? location.href.split("#")[0] : location.origin + location.pathname;
    const url = baseUrl + "#" + (kind === "tip" ? "tip/" + item.id : kind === "story" ? "story/" + item.id : "episode/" + item.storyId + "/" + item.n);
    return title + "\n\n" + description + (rawDescription.length > description.length ? "..." : "") + "\n\nLire la suite : " + url;
  }

  /* ---------------- État de l'application ---------------- */

  const App = {
    ready: false,
    user: null,
    categories: [],
    tips: [],
    stories: [],
    courses: [],
    settings: { appName: "BCréation", welcomeCredits: 10 },
    profile: null,
    admin: null,
    tipList: null,
    storyList: null,
    courseList: null,
    userList: null,
    adminSettings: null
  };

  let CAT_MAP = {};

  const catOf = (id) => CAT_MAP[id] || { id: id, name: id || "Divers", icon: "grid", color: "#6c5ce7" };
  const tipById = (id) => App.tips.find((t) => t.id === id) || null;
  const storyById = (id) => App.stories.find((s) => s.id === id) || null;
  const courseById = (id) => App.courses.find((c) => c.id === id) || null;
  const lessonOf = (course, n) => (course && course.lessons ? course.lessons.find((l) => Number(l.n) === Number(n)) : null);
  const episodeOf = (story, n) => (story && story.episodes ? story.episodes.find((e) => Number(e.n) === Number(n)) : null);

  function episodeIndex(story, n) {
    if (!story) return -1;
    return story.episodes.findIndex((e) => Number(e.n) === Number(n));
  }

  function adjacentEpisode(story, n, dir) {
    const i = episodeIndex(story, n);
    if (i < 0) return null;
    return story.episodes[i + dir] || null;
  }

  function isEpisodeReadable(params) {
    const s = storyById(params.storyId);
    const ep = episodeOf(s, params.n);
    return !!ep && !!ep.published && (!(ep.cost > 0) || !!ep.unlocked);
  }

  /* ---------------- Stockage local ---------------- */

  const KEYS = {
    favs: "bcreation:favs",
    theme: "bcreation:theme",
    last: "bcreation:last",
    read: "bcreation:read"
  };

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* mode privé */ }
  }

  function readImageFile(file) {
    return new Promise((resolve) => {
      if (!file) return resolve("");
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  let favs = loadJSON(KEYS.favs, { tips: [], stories: [] });
  if (!favs || !Array.isArray(favs.tips) || !Array.isArray(favs.stories)) {
    favs = { tips: [], stories: [] };
  }

  let readSet = new Set(loadJSON(KEYS.read, []));
  let lastRead = loadJSON(KEYS.last, null);

  function isFav(type, id) {
    return (type === "tip" ? favs.tips : favs.stories).indexOf(id) >= 0;
  }

  function toggleFav(type, id) {
    const arr = type === "tip" ? favs.tips : favs.stories;
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
    saveJSON(KEYS.favs, favs);
    updateFavButtons();
    toast(i >= 0 ? "Retiré des favoris" : "Ajouté aux favoris");
  }

  function updateFavButtons() {
    $$("[data-fav]").forEach((btn) => {
      const parts = btn.dataset.fav.split(":");
      const saved = isFav(parts[0], parts[1]);
      btn.classList.toggle("is-saved", saved);
      btn.setAttribute("aria-pressed", saved ? "true" : "false");
      const label = btn.querySelector(".fav-label");
      if (label) label.textContent = saved ? "Enregistré" : "Enregistrer";
    });
  }

  function markRead(storyId, n) {
    readSet.add(storyId + ":" + n);
    saveJSON(KEYS.read, Array.from(readSet));
  }

  function isRead(storyId, n) {
    return readSet.has(storyId + ":" + n);
  }

  /* ---------------- Toast & modale ---------------- */

  let toastTimer = null;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function openModal(html) {
    modalRoot.innerHTML =
      '<div class="modal-backdrop"></div>' +
      '<div class="modal-card" role="dialog" aria-modal="true">' + html + "</div>";
    modalRoot.classList.add("open");
    modalRoot.setAttribute("aria-hidden", "false");
    return modalRoot.querySelector(".modal-card");
  }

  function closeModal() {
    modalRoot.classList.remove("open");
    modalRoot.setAttribute("aria-hidden", "true");
    modalRoot.innerHTML = "";
  }

  function askConfirm(opts) {
    return new Promise((resolve) => {
      openModal(
        "<h3>" + esc(opts.title) + "</h3>" +
        '<p class="modal-text">' + (opts.html || esc(opts.text || "")) + "</p>" +
        '<div class="modal-actions">' +
          '<button class="btn-ghost" type="button" id="modalCancel">Annuler</button>' +
          '<button class="btn-primary' + (opts.danger ? " danger" : "") + '" type="button" id="modalOk">' + esc(opts.label || "Confirmer") + "</button>" +
        "</div>"
      );
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        closeModal();
        resolve(value);
      };
      $("#modalCancel").addEventListener("click", () => finish(false));
      $("#modalOk").addEventListener("click", () => finish(true));
      const backdrop = modalRoot.querySelector(".modal-backdrop");
      if (backdrop) backdrop.addEventListener("click", () => finish(false));
    });
  }

  /* ---------------- Rendu des blocs de contenu ---------------- */

  function inlineHTML(value) {
    return esc(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])_([^_]+)_/g, "$1<em>$2</em>");
  }

  function blocksHTML(blocks) {
    if (!Array.isArray(blocks) || !blocks.length) {
      return '<p class="muted-note">Le contenu de cet épisode est en cours de rédaction.</p>';
    }
    return blocks.map((b) => {
      switch (b.t) {
        case "h": return "<h2>" + esc(b.x) + "</h2>";
        case "sub": return "<h3>" + esc(b.x) + "</h3>";
        case "p": return "<p>" + inlineHTML(b.x) + "</p>";
        case "ul": return "<ul>" + (b.items || []).map((i) => "<li>" + inlineHTML(i) + "</li>").join("") + "</ul>";
        case "code": return "<pre><code>" + esc(b.x) + "</code></pre>";
        case "tip": return '<div class="callout">' + icon("sparkles") + "<div>" + inlineHTML(b.x) + "</div></div>";
        case "quote": return "<blockquote>" + inlineHTML(b.x) + "</blockquote>";
        default: return "";
      }
    }).join("");
  }

  function blocksToText(blocks) {
    return (blocks || []).map((b) => {
      if (b.t === "h") return "## " + b.x;
      if (b.t === "sub") return "### " + b.x;
      if (b.t === "ul") return (b.items || []).map((i) => "- " + i).join("\n");
      if (b.t === "code") return "```\n" + b.x + "\n```";
      if (b.t === "quote" || b.t === "tip") return "> " + b.x;
      return b.x;
    }).join("\n\n");
  }

  function blocksToEditorHTML(blocks) {
    return (blocks || []).map((b) => {
      if (b.t === "h") return "<h2>" + esc(b.x) + "</h2>";
      if (b.t === "sub") return "<h3>" + esc(b.x) + "</h3>";
      if (b.t === "ul") return "<ul>" + (b.items || []).map((i) => "<li>" + inlineHTML(i) + "</li>").join("") + "</ul>";
      if (b.t === "quote") return "<blockquote>" + inlineHTML(b.x) + "</blockquote>";
      if (b.t === "code") return "<pre><code>" + esc(b.x) + "</code></pre>";
      return "<p>" + inlineHTML(b.x || "") + "</p>";
    }).join("");
  }

  function editorHTMLToText(editor) {
    const html = editor.innerHTML
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<strong\b[^>]*>/gi, "**").replace(/<\/strong>/gi, "**")
      .replace(/<b\b[^>]*>/gi, "**").replace(/<\/b>/gi, "**")
      .replace(/<em\b[^>]*>/gi, "_").replace(/<\/em>/gi, "_")
      .replace(/<i\b[^>]*>/gi, "_").replace(/<\/i>/gi, "_")
      .replace(/<h2\b[^>]*>/gi, "\n## ").replace(/<\/h2>/gi, "\n")
      .replace(/<h3\b[^>]*>/gi, "\n### ").replace(/<\/h3>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "")
      .replace(/<blockquote\b[^>]*>/gi, "\n> ").replace(/<\/blockquote>/gi, "\n")
      .replace(/<p\b[^>]*>/gi, "\n").replace(/<\/p>/gi, "\n")
      .replace(/<div\b[^>]*>/gi, "\n").replace(/<\/div>/gi, "\n");
    const holder = document.createElement("div");
    holder.innerHTML = html;
    return holder.textContent.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function textToBlocks(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const out = [];
    let para = [];
    let list = [];
    let code = null;

    const flushPara = () => {
      if (para.length) { out.push({ t: "p", x: para.join(" ") }); para = []; }
    };
    const flushList = () => {
      if (list.length) { out.push({ t: "ul", items: list }); list = []; }
    };

    lines.forEach((raw) => {
      const line = raw.replace(/\s+$/, "");
      if (code !== null) {
        if (/^```/.test(line)) {
          out.push({ t: "code", x: code.join("\n") });
          code = null;
        } else {
          code.push(raw);
        }
        return;
      }
      if (/^```/.test(line)) { flushPara(); flushList(); code = []; return; }
      if (!line.trim()) { flushPara(); flushList(); return; }
      if (/^###\s+/.test(line)) { flushPara(); flushList(); out.push({ t: "sub", x: line.replace(/^###\s+/, "") }); return; }
      if (/^##\s+/.test(line)) { flushPara(); flushList(); out.push({ t: "h", x: line.replace(/^##\s+/, "") }); return; }
      if (/^[-*]\s+/.test(line)) { flushPara(); list.push(line.replace(/^[-*]\s+/, "")); return; }
      if (/^>\s?/.test(line)) { flushPara(); flushList(); out.push({ t: "quote", x: line.replace(/^>\s?/, "") }); return; }
      flushList();
      para.push(line.trim());
    });

    if (code !== null) out.push({ t: "code", x: code.join("\n") });
    flushPara();
    flushList();
    return out;
  }

  /* ---------------- Petits composants ---------------- */

  function badge(text, kind) {
    return '<span class="badge' + (kind ? " " + kind : "") + '">' + esc(text) + "</span>";
  }

  function creditPill(credits) {
    return '<span class="credit-pill">' + icon("sparkles") + "<span>" + Number(credits) + " crédits</span></span>";
  }

  function tipRows(list) {
    if (!list.length) {
      return emptyState("Aucune astuce trouvée", "Essaie un autre mot-clé ou une autre catégorie.");
    }
    return list.map((t) => {
      const c = catOf(t.cat);
      return '<div class="tip-row" data-tip="' + esc(t.id) + '" role="button" tabindex="0">' +
        (itemImage(t) ? mediaImage(itemImage(t), "tip-thumb", t.title) : '<span class="tip-ic" style="--c:' + esc(c.color) + '">' + icon(c.icon) + "</span>") +
        '<span class="tip-main">' +
          '<span class="tip-cat">' + esc(c.name) + "</span>" +
          '<span class="tip-title">' + esc(t.title) + "</span>" +
          '<span class="tip-meta">' + icon("clock") + t.minutes + " min · " + esc(t.date) + "</span>" +
        "</span>" +
        '<button class="fav-btn" data-fav="tip:' + esc(t.id) + '" aria-label="Enregistrer l\'astuce">' + icon("bookmark") + "</button>" +
      "</div>";
    }).join("");
  }

  function miniTips(list) {
    return list.map((t) => {
      const c = catOf(t.cat);
      return '<div class="mini-tip" data-tip="' + esc(t.id) + '" role="button" tabindex="0">' +
        (itemImage(t) ? mediaImage(itemImage(t), "mini-image", t.title) : "") +
        '<div class="mini-top">' +
          '<span class="mini-cat" style="--c:' + esc(c.color) + '">' + esc(c.name) + "</span>" +
          '<button class="fav-btn" data-fav="tip:' + esc(t.id) + '" aria-label="Enregistrer l\'astuce">' + icon("bookmark") + "</button>" +
        "</div>" +
        "<h3>" + esc(t.title) + "</h3>" +
        "<p>" + esc(t.excerpt) + "</p>" +
        '<div class="mini-meta">' + icon("clock") + t.minutes + " min</div>" +
      "</div>";
    }).join("");
  }

  function episodeCard(story, ep) {
    const locked = ep.cost > 0 && !ep.unlocked;
    return '<div class="ep-card" data-ep="' + esc(story.id) + ":" + ep.n + '" role="button" tabindex="0">' +
      (itemImage(ep) || itemImage(story) ? mediaImage(itemImage(ep) || itemImage(story), "cover sm", story.title) : '<div class="cover sm" style="--g1:' + esc(story.colors[0]) + ";--g2:" + esc(story.colors[1]) + '"><span>' + esc(story.letter) + "</span></div>") +
      '<div class="ep-card-main">' +
        '<span class="ep-series">' + esc(story.title) + "</span>" +
        '<span class="ep-title">' + esc(ep.title) + "</span>" +
        '<span class="ep-meta">Épisode ' + ep.n + " · " + ep.minutes + " min" +
          (locked ? ' <span class="premium-tag">' + icon("lock") + ep.cost + " cr.</span>" : "") +
        "</span>" +
      "</div>" + icon("chevron") +
    "</div>";
  }

  function storyRow(story) {
    const count = story.episodes.length;
    const statusClass = story.status === "Terminée" ? " done" : story.status === "Nouvelle" ? " new" : "";
    const premium = story.episodes.some((e) => e.cost > 0);
    return '<div class="story-row" data-story="' + esc(story.id) + '" role="button" tabindex="0">' +
      (itemImage(story) ? mediaImage(itemImage(story), "cover md", story.title) : '<div class="cover md" style="--g1:' + esc(story.colors[0]) + ";--g2:" + esc(story.colors[1]) + '"><span>' + esc(story.letter) + "</span></div>") +
      '<div class="story-info">' +
        "<h3>" + esc(story.title) + "</h3>" +
        '<p class="tagline">' + esc(story.tagline) + "</p>" +
        '<div class="story-row-meta">' +
          '<span class="status' + statusClass + '"><i></i>' + esc(story.status) + "</span>" +
          "<span>" + count + " épisode" + (count > 1 ? "s" : "") + "</span>" +
          "<span>" + esc(story.genre) + "</span>" +
          (premium ? '<span class="premium-tag">' + icon("lock") + "Premium</span>" : "") +
        "</div>" +
      "</div>" +
      '<button class="fav-btn" data-fav="story:' + esc(story.id) + '" aria-label="Enregistrer la série">' + icon("bookmark") + "</button>" +
    "</div>";
  }

  function isCourse(story) {
    return /cours|informatique/i.test(String(story && story.genre || ""));
  }

  function courseStories() {
    return App.stories.filter(isCourse);
  }

  function emptyState(title, text, goRoute, goLabel) {
    return '<div class="empty">' + icon("sparkles") +
      "<strong>" + esc(title) + "</strong><p>" + esc(text) + "</p>" +
      (goRoute ? '<button class="btn-primary" data-go="' + esc(goRoute) + '">' + esc(goLabel) + "</button>" : "") +
    "</div>";
  }

  function loadingHTML() {
    return '<div class="loading" role="status" aria-label="Chargement"><i></i></div>';
  }

  function loadErrorHTML(err) {
    return '<section class="screen"><div class="empty">' + icon("wifi") +
      "<strong>Impossible de charger les données</strong>" +
      "<p>" + esc(err && err.message ? err.message : "Vérifie ta connexion puis réessaie.") + "</p>" +
      '<button class="btn-primary" data-retry>Réessayer</button>' +
    "</div></section>";
  }

  /* ---------------- Vues publiques ---------------- */

  function renderHome() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bel après-midi" : "Bonsoir";
    const featured = App.tips.filter((t) => t.featured).slice(0, 6);
    const latest = App.stories.map((s) => {
      const eps = s.episodes.filter((e) => e.published);
      return { story: s, ep: eps[eps.length - 1] };
    }).filter((x) => x.ep);

    const guestCard = App.user ? "" :
      '<button class="signup-card" data-go="signup">' +
        '<span class="signup-spark">' + icon("sparkles") + "</span>" +
        "<span class=\"signup-text\"><strong>" + Number(App.settings.welcomeCredits) + " crédits offerts</strong>" +
        "<span>Crée ton compte et débloque les épisodes premium.</span></span>" +
        icon("chevron") +
      "</button>";

    return '<section class="screen">' +
      '<div class="greet">' +
        '<p class="greet-hi">' + greeting + (App.user ? ", " + esc(App.user.name.split(" ")[0]) : "") + "</p>" +
        '<span class="greet-kicker">L’espace BCréation</span>' +
        "<h1>Qu'est-ce qu'on partage <span>aujourd'hui&nbsp;?</span></h1>" +
        '<p class="greet-lead">Des astuces utiles, des idées simples et des histoires à découvrir au quotidien.</p>' +
        (App.user ? '<div class="greet-meta">' + creditPill(App.user.credits) + "</div>" : "") +
      "</div>" +

      guestCard +

      '<div class="feature-grid">' +
        '<button class="feature feature-tips" data-go="tips">' +
          '<span class="feature-icon">' + icon("bulb") + "</span>" +
          '<span class="feature-title">Astuces &amp; tutos</span>' +
          '<span class="feature-sub">' + App.tips.length + " fiches à parcourir</span>" +
          icon("chevron") +
        "</button>" +
        '<button class="feature feature-love" data-go="stories">' +
          '<span class="feature-icon">' + icon("book") + "</span>" +
          '<span class="feature-title">Histoires</span>' +
          '<span class="feature-sub">' + App.stories.length + " séries à suivre</span>" +
          icon("chevron") +
        "</button>" +
      "</div>" +

      (featured.length
        ? '<div class="section">' +
            '<div class="section-head"><h2>Astuces à la une</h2><button class="link" data-go="tips">Tout voir</button></div>' +
            '<div class="hscroll">' + miniTips(featured) + "</div>" +
          "</div>"
        : "") +

      (latest.length
        ? '<div class="section">' +
            '<div class="section-head"><h2>Derniers épisodes</h2><button class="link" data-go="stories">Tout voir</button></div>' +
            '<div class="episode-grid">' + latest.slice(0, 6).map((x) => episodeCard(x.story, x.ep)).join("") + "</div>" +
          "</div>"
        : "") +

      '<div class="section">' +
        '<div class="section-head"><h2>Catégories</h2></div>' +
        '<div class="hscroll">' +
          App.categories.map((c) =>
            '<button class="chip" data-gocat="' + esc(c.id) + '" style="--c:' + esc(c.color) + '">' + icon(c.icon) + esc(c.name) + "</button>"
          ).join("") +
        "</div>" +
      "</div>" +
    "</section>";
  }

  let tipsQuery = "";
  let tipsCat = "all";

  function filteredTips() {
    const q = tipsQuery.trim().toLowerCase();
    return App.tips.filter((t) => {
      if (tipsCat !== "all" && t.cat !== tipsCat) return false;
      if (!q) return true;
      const hay = (t.title + " " + t.excerpt + " " + catOf(t.cat).name).toLowerCase();
      return hay.indexOf(q) >= 0;
    }).slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  function tipsCountText() {
    const n = filteredTips().length;
    return plural(n, "astuce") + (tipsCat !== "all" ? " dans cette catégorie" : "");
  }

  function refreshTipsList() {
    const list = $("#tipsList");
    const count = $("#tipsCount");
    if (!list) return;
    list.innerHTML = tipRows(filteredTips());
    if (count) count.textContent = tipsCountText();
    updateFavButtons();
  }

  function syncChips() {
    $$(".chip[data-cat]").forEach((c) => {
      c.classList.toggle("active", c.dataset.cat === tipsCat);
    });
  }

  function renderTips() {
    const chips = '<button class="chip' + (tipsCat === "all" ? " active" : "") + '" data-cat="all">Tout</button>' +
      App.categories.map((c) =>
        '<button class="chip' + (tipsCat === c.id ? " active" : "") + '" data-cat="' + esc(c.id) + '" style="--c:' + esc(c.color) + '">' +
          icon(c.icon) + esc(c.name) +
        "</button>"
      ).join("");

    return '<section class="screen">' +
      '<h1 class="screen-title">Astuces &amp; tutos</h1>' +
      '<p class="screen-sub">Des fiches courtes et concrètes, classées par catégorie.</p>' +
      '<div class="searchbar">' + icon("search") +
        '<input id="tipSearch" type="search" placeholder="Rechercher une astuce..." autocomplete="off" value="' + esc(tipsQuery) + '">' +
      "</div>" +
      '<div class="chips">' + chips + "</div>" +
      '<p class="result-count" id="tipsCount">' + esc(tipsCountText()) + "</p>" +
      '<div id="tipsList">' + tipRows(filteredTips()) + "</div>" +
    "</section>";
  }

  function bindTips() {
    const input = $("#tipSearch");
    if (!input) return;
    input.addEventListener("input", () => {
      tipsQuery = input.value;
      refreshTipsList();
    });
  }

  function renderTip(params) {
    const t = tipById(params.id);
    if (!t) return renderNotFound();
    const c = catOf(t.cat);
    const related = App.tips.filter((x) => x.cat === t.cat && x.id !== t.id).slice(0, 2);

    return '<section class="screen article">' +
      '<div class="article-hero">' +
        (itemImage(t) ? mediaImage(itemImage(t), "article-image", t.title) : "") +
        '<span class="chip-sec" style="--c:' + esc(c.color) + '">' + icon(c.icon) + esc(c.name) + "</span>" +
        "<h1>" + esc(t.title) + "</h1>" +
        '<div class="meta-row">' +
          "<span>" + icon("clock") + t.minutes + " min de lecture</span>" +
          "<span>" + esc(t.date) + "</span>" +
          "<span>" + icon("user") + esc(t.author) + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="article-actions">' +
        '<button class="pill-btn" data-fav="tip:' + esc(t.id) + '">' + icon("bookmark") + '<span class="fav-label">Enregistrer</span></button>' +
        '<button class="pill-btn" data-share="tip">' + icon("share") + "Partager</button>" +
      "</div>" +
      '<div class="prose">' + blocksHTML(t.body) + "</div>" +
      (related.length
        ? '<div class="section" style="margin-top:26px">' +
            '<div class="section-head"><h2>Dans la même catégorie</h2></div>' +
            '<div class="related-scroll">' + related.slice(0, 6).map((x) => '<div class="related-card">' + tipRows([x]) + '</div>').join("") + '</div>' +
          "</div>"
        : "") +
      '<div class="end-note">' + icon("bulb") +
        "<div><strong>Une astuce à partager ?</strong><p>Le contenu est publié depuis le tableau de bord administrateur, dans Google Sheets.</p></div>" +
      "</div>" +
    "</section>";
  }

  function renderStories() {
    if (!App.stories.length) {
      return '<section class="screen">' +
        '<h1 class="screen-title">Histoires</h1>' +
        emptyState("Aucune série pour l'instant", "Les prochaines histoires arrivent très bientôt.", "home", "Retour à l'accueil") +
      "</section>";
    }
    const featured = App.stories[0];
    const count = featured.episodes.filter((e) => e.published).length;

    return '<section class="screen">' +
      '<h1 class="screen-title">Histoires</h1>' +
      '<p class="screen-sub">Des séries romantiques à suivre épisode après épisode.</p>' +
      '<div class="story-feature" data-story="' + esc(featured.id) + '" role="button" tabindex="0" style="--g1:' + esc(featured.colors[0]) + ";--g2:" + esc(featured.colors[1]) + '">' +
        '<span class="sf-badge">À la une</span>' +
        '<span class="sf-letter">' + esc(featured.letter) + "</span>" +
        "<h2>" + esc(featured.title) + "</h2>" +
        "<p>" + esc(featured.tagline) + "</p>" +
        '<div class="sf-meta">' + icon("book") + count + " épisode" + (count > 1 ? "s" : "") + " en ligne · " + esc(featured.genre) + "</div>" +
        '<button class="sf-fav" data-fav="story:' + esc(featured.id) + '" aria-label="Enregistrer la série">' + icon("bookmark") + "</button>" +
      "</div>" +
      '<div class="section-head"><h2>Toutes les séries</h2><span class="section-count">' + plural(App.stories.length, "série") + "</span></div>" +
      '<div class="stack">' + App.stories.map(storyRow).join("") + "</div>" +
      '<div class="end-note" style="margin-top:20px">' + icon("book") +
        "<div><strong>Un épisode chaque semaine</strong><p>Enregistre une série pour la retrouver dans tes favoris.</p></div>" +
      "</div>" +
    "</section>";
  }

  function renderCourses() {
    const courses = App.courses || [];
    return '<section class="screen">' +
      '<h1 class="screen-title">Cours informatiques</h1>' +
      '<p class="screen-sub">Apprends étape par étape grâce à des leçons courtes et pratiques.</p>' +
      (courses.length
        ? '<div class="course-grid">' + courses.map((course) => '<button class="course-card" data-course="' + esc(course.id) + '">' + (itemImage(course) ? mediaImage(itemImage(course), "course-card-cover", course.title) : '<span class="course-card-cover course-card-placeholder">' + esc(initials(course.title)) + '</span>') + '<span class="course-card-content"><strong class="course-card-title">' + esc(course.title) + '</strong><span class="course-card-description">' + esc(course.description) + '</span><span class="course-card-footer"><span>' + plural((course.lessons || []).length, "leçon") + '</span>' + icon("chevron") + '</span></span></button>').join("") + "</div>"
        : emptyState("Aucun cours pour l'instant", "Les prochains cours seront bientôt disponibles.", "home", "Retour à l'accueil")) +
    "</section>";
  }

  function renderCourse(params) {
    const c = courseById(params.id);
    if (!c) return renderNotFound();
    const lessons = (c.lessons || []).filter((l) => l.published);
    return '<section class="screen"><div class="story-hero course-hero">' + (itemImage(c) ? mediaImage(itemImage(c), "course-cover", c.title) : "") + '<span class="genre">Cours informatique</span><h1>' + esc(c.title) + '</h1><p>' + esc(c.description) + '</p><div class="hero-stats"><span>' + icon("book") + plural(lessons.length, "leçon") + '</span><span>Progression libre</span></div></div><div class="section-head"><h2>Leçons</h2><span class="section-count">' + lessons.length + '</span></div><div class="ep-list">' + (lessons.length ? lessons.map((l) => '<button class="ep-row" data-course-lesson="' + esc(c.id) + ':' + l.n + '"><span class="ep-num">' + l.n + '</span><span class="ep-row-main"><span class="ep-row-title">' + esc(l.title) + '</span><span class="ep-row-meta">Leçon ' + l.n + '</span></span>' + icon("chevron") + '</button>').join("") : '<p class="muted-note">Aucune leçon publiée pour le moment.</p>') + '</div></section>';
  }

  function renderCourseLesson(params) {
    const c = courseById(params.courseId);
    const l = lessonOf(c, params.n);
    if (!c || !l || !l.published) return renderNotFound();
    const next = (c.lessons || []).filter((x) => x.published && Number(x.n) > Number(l.n)).sort((a, b) => a.n - b.n)[0];
    return '<section class="screen reader"><button class="reader-series" data-course="' + esc(c.id) + '">' + icon("book") + esc(c.title) + '</button><h1>' + esc(l.title) + '</h1><div class="meta-row"><span>Leçon ' + l.n + '</span><span>Cours informatique</span></div><div class="prose">' + blocksHTML(l.body || []) + '</div><div class="reader-end">' + (next ? '<button class="btn-primary" data-course-lesson="' + esc(c.id) + ':' + next.n + '">Leçon suivante ' + icon("chevron") + '</button>' : '<div class="end-note"><div><strong>Fin du cours pour le moment</strong><p>De nouvelles leçons pourront être ajoutées prochainement.</p></div></div>') + '</div></section>';
  }

  function renderStory(params) {
    const s = storyById(params.id);
    if (!s) return renderNotFound();
    const online = s.episodes.filter((e) => e.published).length;
    const resume = lastRead && lastRead.storyId === s.id ? episodeOf(s, lastRead.n) : null;
    const resumeOk = resume && resume.published && (!(resume.cost > 0) || resume.unlocked);

    const rows = s.episodes.map((ep) => {
      const premium = ep.cost > 0 && !ep.unlocked;
      const attrs = !ep.published
        ? ' data-locked="1" aria-disabled="true"'
        : premium
          ? ' data-unlock="' + esc(s.id) + ":" + ep.n + '"'
          : ' data-ep="' + esc(s.id) + ":" + ep.n + '"';
      const readPill = (ep.published && !premium && isRead(s.id, ep.n)) ? '<span class="read-pill">Lu</span>' : "";
      const meta = !ep.published
        ? "Disponible bientôt"
        : premium
          ? '<span class="premium-tag">' + icon("lock") + "Premium · " + ep.cost + " crédits</span>"
          : ep.minutes + " min · " + esc(ep.date);
      return '<button class="ep-row' + (!ep.published ? " locked" : "") + (premium ? " premium" : "") + '"' + attrs + ">" +
        '<span class="ep-num">' + (!ep.published || premium ? icon("lock") : ep.n) + "</span>" +
        '<span class="ep-row-main">' +
          '<span class="ep-row-title">' + esc(ep.title) + "</span>" +
          '<span class="ep-row-meta">' + meta + readPill + "</span>" +
        "</span>" +
        icon(!ep.published || premium ? "lock" : "chevron") +
      "</button>";
    }).join("");

    const course = isCourse(s);
    return '<section class="screen">' +
      '<div class="story-hero" style="--g1:' + esc(s.colors[0]) + ";--g2:" + esc(s.colors[1]) + '">' +
        '<span class="genre">' + esc(course ? "Cours informatique" : s.genre) + "</span>" +
        "<h1>" + esc(s.title) + "</h1>" +
        "<p>" + esc(s.tagline) + "</p>" +
        '<div class="hero-stats">' +
          "<span>" + icon("user") + esc(s.author) + "</span>" +
          "<span>" + icon("book") + online + "/" + s.episodes.length + (course ? " leçons" : " épisodes") + "</span>" +
          "<span>" + esc(s.status) + "</span>" +
        "</div>" +
      "</div>" +

      '<div class="story-actions">' +
        '<button class="pill-btn" data-fav="story:' + esc(s.id) + '">' + icon("bookmark") + '<span class="fav-label">Enregistrer</span></button>' +
        '<button class="pill-btn" data-share="story">' + icon("share") + "Partager</button>" +
        (resumeOk
          ? '<button class="pill-btn accent" data-ep="' + esc(s.id) + ":" + resume.n + '">' + icon("play") + "Reprendre · Ép. " + resume.n + "</button>"
          : "") +
      "</div>" +

      '<div class="section-head"><h2>Synopsis</h2></div>' +
      '<p class="synopsis">' + esc(s.synopsis) + "</p>" +

      '<div class="section-head"><h2>' + (course ? "Leçons" : "Épisodes") + '</h2><span class="section-count">' + online + " disponibles</span></div>" +
      '<div class="ep-list">' + rows + "</div>" +

      '<div class="end-note" style="margin-top:18px">' + icon("clock") +
        "<div><strong>Publication au fil des semaines</strong><p>Les épisodes verrouillés arrivent bientôt. Enregistre la série pour ne rien manquer.</p></div>" +
      "</div>" +
    "</section>";
  }

  function renderUnlockScreen(story, ep) {
    const logged = !!App.user;
    const canAfford = logged && App.user.credits >= ep.cost;
    const action = logged
      ? '<button class="btn-primary' + (canAfford ? "" : " disabled") + '" data-unlock="' + esc(story.id) + ":" + ep.n + '"' + (canAfford ? "" : " disabled") + ">" +
          icon("lock") + (canAfford ? "Débloquer · " + ep.cost + " crédits" : "Crédits insuffisants") + "</button>"
      : '<button class="btn-primary" data-go="login">Se connecter pour débloquer</button>';

    return '<section class="screen">' +
      '<div class="unlock-card">' +
        '<span class="unlock-ic">' + icon("lock") + "</span>" +
        '<span class="genre">' + esc(story.title) + " · Épisode " + ep.n + "</span>" +
        "<h1>" + esc(ep.title) + "</h1>" +
        "<p>Cet épisode premium se débloque une seule fois et reste accessible pour toujours.</p>" +
        '<div class="unlock-price"><strong>' + ep.cost + "</strong><span>crédits</span></div>" +
        '<p class="unlock-balance">' + (logged ? "Solde actuel : " + Number(App.user.credits) + " crédits" : "Connecte-toi pour utiliser tes crédits.") + "</p>" +
        action +
        '<button class="btn-ghost" data-story="' + esc(story.id) + '">Retour à la série</button>' +
      "</div>" +
    "</section>";
  }

  function renderEpisode(params) {
    const s = storyById(params.storyId);
    const ep = episodeOf(s, params.n);
    if (!s || !ep || !ep.published) return renderNotFound();
    if (ep.cost > 0 && !ep.unlocked) return renderUnlockScreen(s, ep);

    markRead(s.id, ep.n);
    lastRead = { storyId: s.id, n: ep.n };
    saveJSON(KEYS.last, lastRead);

    const next = adjacentEpisode(s, ep.n, 1);
    let nextHTML = "";
    if (!next) {
      nextHTML = '<div class="end-note">' + icon("clock") +
        "<div><strong>Tu es à jour</strong><p>La suite arrive prochainement. Enregistre la série pour ne rien manquer.</p></div></div>";
    } else if (!next.published) {
      nextHTML = '<div class="end-note">' + icon("clock") +
        "<div><strong>La suite arrive bientôt</strong><p>Le prochain épisode est en préparation.</p></div></div>";
    } else if (next.cost > 0 && !next.unlocked) {
      nextHTML = '<button class="btn-primary" data-unlock="' + esc(s.id) + ":" + next.n + '">' +
        icon("lock") + "Débloquer l'épisode " + next.n + " · " + next.cost + " crédits</button>";
    } else {
      nextHTML = '<button class="btn-primary" data-ep="' + esc(s.id) + ":" + next.n + '">Lire l\'épisode ' + next.n + icon("chevron") + "</button>";
    }

    const course = isCourse(s);
    return '<section class="screen reader">' +
      '<button class="reader-series" data-story="' + esc(s.id) + '">' + icon("book") + esc(s.title) + "</button>" +
      "<h1>" + esc(ep.title) + "</h1>" +
      '<div class="meta-row">' +
        "<span>" + (course ? "Leçon " : "Épisode ") + ep.n + "</span>" +
        "<span>" + icon("clock") + ep.minutes + " min</span>" +
        "<span>" + esc(ep.date) + "</span>" +
      "</div>" +
      '<div class="article-actions"><button class="pill-btn" data-share="episode">' + icon("share") + "Partager l’épisode</button></div>" +
      '<div class="prose">' + blocksHTML(ep.body) + "</div>" +
      '<div class="reader-end">' +
        '<div class="orn"><span></span><i></i><span></span></div>' +
        nextHTML +
      "</div>" +
    "</section>";
  }

  function renderFavorites() {
    const favTips = favs.tips.map(tipById).filter(Boolean);
    const favStories = favs.stories.map(storyById).filter(Boolean);

    return '<section class="screen">' +
      '<h1 class="screen-title">Mes favoris</h1>' +
      '<p class="screen-sub">Tout ce que tu as enregistré, au même endroit.</p>' +

      '<div class="section-head"><h2>Astuces</h2><span class="section-count">' + favTips.length + "</span></div>" +
      (favTips.length
        ? tipRows(favTips)
        : emptyState("Aucune astuce enregistrée", "Touche le marque-page d'une astuce pour la retrouver ici.", "tips", "Voir les astuces")) +

      '<div class="section-head" style="margin-top:24px"><h2>Histoires</h2><span class="section-count">' + favStories.length + "</span></div>" +
      (favStories.length
        ? '<div class="stack">' + favStories.map(storyRow).join("") + "</div>"
        : emptyState("Aucune série enregistrée", "Enregistre une histoire pour suivre ses nouveaux épisodes.", "stories", "Voir les histoires")) +
    "</section>";
  }

  function renderAbout() {
    return '<section class="screen">' +
      '<h1 class="screen-title">À propos</h1>' +
      '<p class="screen-sub">BCréation, un espace simple pour partager deux passions.</p>' +

      '<div class="about-card">' +
        "<h2>Le concept</h2>" +
        "<p>D'un côté, des astuces informatiques courtes et classées par catégorie. De l'autre, des histoires d'amour publiées en séries, épisode après épisode.</p>" +
        "<p>Crée un compte, reçois des crédits de bienvenue et débloque les épisodes premium. Tes favoris et ta progression restent dans ton navigateur.</p>" +
      "</div>" +

      '<div class="about-card">' +
        "<h2>Technologies</h2>" +
        '<div class="about-tags"><span>HTML</span><span>CSS</span><span>JavaScript</span><span>Google Sheets</span><span>Apps Script</span><span>Zéro dépendance</span></div>' +
      "</div>" +

      '<div class="about-card">' +
        "<h2>" + (App.user ? "Ton espace" : "Créer un compte") + "</h2>" +
        (App.user
          ? "<p>Retrouve ton profil, tes crédits et ton historique dans l'onglet Profil.</p>"
          : "<p>L'inscription offre " + Number(App.settings.welcomeCredits) + " crédits, utilisables pour débloquer des épisodes premium.</p>") +
      "</div>" +

      '<div class="end-note">' + icon("book") +
        "<div><strong>Bonne lecture, bonne bidouille.</strong><p>Et si une astuce t'a servi, partage-la.</p></div>" +
      "</div>" +
    "</section>";
  }

  function renderNotFound() {
    return '<section class="screen">' +
      emptyState("Contenu introuvable", "Cette page n'existe pas ou a été déplacée.", "home", "Retour à l'accueil") +
    "</section>";
  }

  /* ---------------- Authentification ---------------- */

  function demoHint() {
    if (!BCApi.isDemo) return "";
    return '<div class="demo-hint">' + icon("info") +
      "<div><strong>Mode démo local</strong><span>Les données restent dans ce navigateur. Compte admin : <code>admin@demo.local</code> · <code>admin1234</code></span></div>" +
    "</div>";
  }

  function renderLogin() {
    return '<section class="screen auth">' +
      '<div class="auth-icon">' + icon("user") + "</div>" +
      '<h1 class="screen-title">Bon retour</h1>' +
      '<p class="screen-sub">Connecte-toi pour retrouver tes crédits et tes épisodes débloqués.</p>' +
      '<form class="form" data-form="login">' +
        '<label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" placeholder="toi@exemple.com" required></label>' +
        '<label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" autocomplete="current-password" placeholder="••••••••" required></label>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn-primary" type="submit">Se connecter</button>' +
      "</form>" +
      '<p class="auth-alt">Pas encore de compte ? <button class="link" data-go="signup">Créer un compte</button></p>' +
      demoHint() +
    "</section>";
  }

  function renderSignup() {
    const welcome = Number(App.settings.welcomeCredits);
    return '<section class="screen auth">' +
      '<div class="auth-icon love">' + icon("sparkles") + "</div>" +
      '<h1 class="screen-title">Créer un compte</h1>' +
      '<p class="screen-sub">Quelques secondes suffisent, et les épisodes premium deviennent accessibles.</p>' +
      '<div class="auth-bonus">' + icon("sparkles") +
        "<div><strong>" + welcome + " crédits offerts</strong><span>Ajoutés automatiquement à ton premier compte.</span></div>" +
      "</div>" +
      '<form class="form" data-form="signup">' +
        '<label class="field"><span>Photo de profil <small>(facultatif)</small></span><input class="input" type="file" name="avatar" accept="image/*"></label>' +
        '<label class="field"><span>Prénom ou pseudo</span><input class="input" name="name" autocomplete="name" maxlength="40" placeholder="Alex" required></label>' +
        '<label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" placeholder="toi@exemple.com" required></label>' +
        '<label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="6" placeholder="6 caractères minimum" required></label>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn-primary" type="submit">Créer mon compte</button>' +
      "</form>" +
      '<p class="auth-alt">Déjà inscrit ? <button class="link" data-go="login">Se connecter</button></p>' +
      demoHint() +
    "</section>";
  }

  /* ---------------- Profil ---------------- */

  function renderProfile() {
    const p = App.profile;
    if (!p || !p.user) return renderNotFound();
    const u = p.user;
    const admin = u.role === "admin";

    const history = p.history.length
      ? p.history.map((c) => {
          const plus = Number(c.delta) > 0;
          return '<div class="credit-item">' +
            '<span class="credit-reason">' + esc(c.reason) + "<small>" + esc(formatDate(c.date)) + "</small></span>" +
            '<span class="credit-amount ' + (plus ? "plus" : "minus") + '">' + (plus ? "+" : "") + Number(c.delta) + "</span>" +
          "</div>";
        }).join("")
      : '<p class="muted-note">Aucun mouvement de crédits pour le moment.</p>';

    const unlocks = p.unlocks.length
      ? p.unlocks.map((u2) =>
          '<div class="credit-item">' +
            '<span class="credit-reason">' + esc(u2.storyTitle || "Série") + " · épisode " + u2.n +
              "<small>Débloqué le " + esc(formatDate(u2.date)) + "</small></span>" +
            badge("Débloqué", "ok") +
          "</div>"
        ).join("")
      : '<p class="muted-note">Aucun épisode premium débloqué.</p>';

    return '<section class="screen">' +
      '<div class="profile-hero">' +
        (localImage("profile:" + u.id) ? mediaImage(localImage("profile:" + u.id), "avatar-xl", u.name) : '<span class="avatar-xl">' + esc(initials(u.name)) + "</span>") +
        '<div class="profile-id">' +
          "<h1>" + esc(u.name) + "</h1>" +
          "<p>" + esc(u.email) + "</p>" +
          '<div class="profile-badges">' + badge(admin ? "Administrateur" : "Membre", admin ? "warn" : "muted") +
            (u.status === "blocked" ? badge("Bloqué", "danger") : badge("Actif", "ok")) + "</div>" +
        "</div>" +
        '<div class="credit-box"><strong>' + Number(u.credits) + "</strong><span>crédits</span></div>" +
      "</div>" +

      (u.bio ? '<p class="profile-bio">' + esc(u.bio) + "</p>" : "") +
      '<p class="profile-since">Membre depuis le ' + esc(formatDate(u.createdAt)) + "</p>" +

      '<div class="profile-actions">' +
        '<button class="pill-btn" data-go="profileEdit">' + icon("user") + "Modifier</button>" +
        '<button class="pill-btn" data-go="passwordForm">' + icon("lock") + "Mot de passe</button>" +
        (admin ? '<button class="pill-btn" data-go="admin">' + icon("grid") + "Administration</button>" : "") +
        '<button class="pill-btn danger-text wide" data-logout>' + icon("logout") + "Déconnexion</button>" +
      "</div>" +

      '<div class="section-head" style="margin-top:24px"><h2>Crédits</h2><span class="section-count">' + p.history.length + " mouvement" + (p.history.length > 1 ? "s" : "") + "</span></div>" +
      '<div class="credit-list">' + history + "</div>" +

      '<div class="section-head" style="margin-top:24px"><h2>Épisodes débloqués</h2><span class="section-count">' + p.unlocks.length + "</span></div>" +
      '<div class="credit-list">' + unlocks + "</div>" +

    "</section>";
  }

  function renderProfileEdit() {
    const u = App.user;
    if (!u) return renderNotFound();
    return '<section class="screen">' +
      '<h1 class="screen-title">Modifier le profil</h1>' +
      '<p class="screen-sub">Ton nom et ta bio apparaissent sur ton espace personnel.</p>' +
      '<form class="form" data-form="profile">' +
        '<label class="field"><span>Nom affiché</span><input class="input" name="name" maxlength="40" value="' + esc(u.name) + '" required></label>' +
        '<label class="field"><span>Bio <small>(facultatif)</small></span><textarea class="input" name="bio" rows="3" maxlength="240" placeholder="Quelques mots sur toi...">' + esc(u.bio || "") + "</textarea></label>" +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn-primary" type="submit">Enregistrer</button>' +
      "</form>" +
    "</section>";
  }

  function renderPasswordForm() {
    return '<section class="screen">' +
      '<h1 class="screen-title">Mot de passe</h1>' +
      '<p class="screen-sub">Choisis un mot de passe d\'au moins 6 caractères, unique sur ce site.</p>' +
      '<form class="form" data-form="password">' +
        '<label class="field"><span>Mot de passe actuel</span><input class="input" type="password" name="current" autocomplete="current-password" required></label>' +
        '<label class="field"><span>Nouveau mot de passe</span><input class="input" type="password" name="next" autocomplete="new-password" minlength="6" required></label>' +
        '<label class="field"><span>Confirmer</span><input class="input" type="password" name="confirm" autocomplete="new-password" minlength="6" required></label>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn-primary" type="submit">Modifier le mot de passe</button>' +
      "</form>" +
    "</section>";
  }

  /* ---------------- Administration ---------------- */

  function adminBackBtn() {
    return '<button class="link" data-go="admin">Tableau de bord</button>';
  }

  function renderAdmin() {
    const s = App.admin;
    if (!s) return loadErrorHTML(new Error("Statistiques indisponibles."));

    const stats = [
      { icon: "user", value: s.users, label: "membres", sub: plural(s.activeUsers, "actif") },
      { icon: "bulb", value: s.tips, label: "astuces", sub: plural(s.publishedTips, "publiée") },
      { icon: "book", value: s.stories, label: "séries", sub: plural(s.episodes, "épisode") },
      { icon: "sparkles", value: s.credits, label: "crédits", sub: plural(s.premiumEpisodes, "premium") }
    ];

    const recent = s.recentSignups.length
      ? s.recentSignups.map((u) =>
          '<div class="credit-item">' +
            '<span class="credit-reason">' + esc(u.name) + "<small>" + esc(u.email) + "</small></span>" +
            '<span class="credit-date">' + esc(formatDate(u.createdAt)) + "</span>" +
          "</div>"
        ).join("")
      : '<p class="muted-note">Aucun inscrit pour le moment.</p>';

    return '<section class="screen">' +
      '<div class="admin-head">' + badge("Administration", "warn") + "</div>" +
      '<h1 class="screen-title">Tableau de bord</h1>' +
      '<p class="screen-sub">Gère le contenu, les membres et les crédits de BCréation.</p>' +

      '<div class="admin-stats">' +
        stats.map((st) =>
          '<div class="stat-card"><span class="stat-icon">' + icon(st.icon) + "</span>" +
            "<strong>" + st.value + "</strong><span>" + esc(st.label) + "</span><small>" + esc(st.sub) + "</small></div>"
        ).join("") +
      "</div>" +

      '<div class="admin-links">' +
        '<button class="admin-link" data-go="adminTips"><span class="al-ic">' + icon("bulb") + "</span><span><strong>Astuces</strong><small>Créer et publier des fiches</small></span>" + icon("chevron") + "</button>" +
        '<button class="admin-link" data-go="adminStories"><span class="al-ic love">' + icon("book") + "</span><span><strong>Séries &amp; épisodes</strong><small>Gérer les histoires et les épisodes premium</small></span>" + icon("chevron") + "</button>" +
        '<button class="admin-link" data-go="adminCourses"><span class="al-ic green">' + icon("monitor") + "</span><span><strong>Cours informatiques</strong><small>Créer des cours et leurs leçons</small></span>" + icon("chevron") + "</button>" +
        '<button class="admin-link" data-go="adminUsers"><span class="al-ic green">' + icon("user") + "</span><span><strong>Utilisateurs</strong><small>Rôles, statut et crédits</small></span>" + icon("chevron") + "</button>" +
        '<button class="admin-link" data-go="adminSettings"><span class="al-ic orange">' + icon("grid") + "</span><span><strong>Réglages</strong><small>Crédits de bienvenue et contenu de démo</small></span>" + icon("chevron") + "</button>" +
      "</div>" +

      '<div class="section-head" style="margin-top:22px"><h2>Derniers inscrits</h2></div>' +
      '<div class="credit-list">' + recent + "</div>" +

      '<div class="end-note" style="margin-top:20px">' + icon("info") +
        "<div><strong>" + (BCApi.isDemo ? "Mode démo local" : "Connecté à Google Sheets") + "</strong>" +
        "<p>" + (BCApi.isDemo
          ? "Les modifications restent dans ce navigateur. Suis le guide pour brancher ta feuille Google."
          : "Les modifications sont enregistrées dans ta feuille Google Sheets.") + "</p></div>" +
      "</div>" +
    "</section>";
  }

  function renderAdminTips() {
    const list = App.tipList || [];
    const items = list.length
      ? list.map((t) => {
          const c = catOf(t.cat);
          return '<div class="admin-item">' +
            '<div class="admin-item-top"><strong>' + esc(t.title) + "</strong>" +
              (t.published ? badge("Publié", "ok") : badge("Brouillon", "muted")) +
              (t.featured ? badge("À la une", "warn") : "") +
            "</div>" +
            '<div class="admin-item-meta">' + esc(c.name) + " · " + esc(t.date) + " · " + t.minutes + " min · " + esc(t.author) + "</div>" +
            '<div class="admin-actions">' +
              '<button class="admin-btn" data-nav="adminTipForm" data-id="' + esc(t.id) + '">' + icon("code") + "Modifier</button>" +
              '<button class="admin-btn danger" data-del-tip="' + esc(t.id) + '">Supprimer</button>' +
            "</div>" +
          "</div>";
        }).join("")
      : '<p class="muted-note">Aucune astuce. Crée la première.</p>';

    return '<section class="screen">' +
      '<div class="admin-topbar"><h1 class="screen-title">Astuces</h1>' + adminBackBtn() + "</div>" +
      '<p class="screen-sub">Chaque fiche enregistrée ici apparaît immédiatement sur le site.</p>' +
      '<button class="btn-primary" data-go="adminTipForm">' + icon("sparkles") + "Nouvelle astuce</button>" +
      '<div class="admin-list">' + items + "</div>" +
    "</section>";
  }

  function categoryOptions(selected) {
    return App.categories.map((c) =>
      '<option value="' + esc(c.id) + '"' + (c.id === selected ? " selected" : "") + ">" + esc(c.name) + "</option>"
    ).join("");
  }

  function renderAdminTipForm(params) {
    const t = params.id ? (App.tipList || []).find((x) => x.id === params.id) : null;
    const v = t || {
      id: "", cat: (App.categories[0] || {}).id || "web", title: "", excerpt: "",
      minutes: 4, date: todayFR(), author: (App.user && App.user.name) || "BCréation",
      featured: false, published: true, body: []
    };

    return '<section class="screen">' +
      '<div class="admin-topbar"><h1 class="screen-title">' + (t ? "Modifier l'astuce" : "Nouvelle astuce") + "</h1>" + adminBackBtn() + "</div>" +
      '<form class="form" data-form="tip">' +
        '<input type="hidden" name="id" value="' + esc(v.id) + '">' +
        '<label class="field"><span>Titre</span><input class="input" name="title" maxlength="90" value="' + esc(v.title) + '" required></label>' +
        '<label class="field"><span>Catégorie</span><select class="input" name="cat">' + categoryOptions(v.cat) + "</select></label>" +
        '<label class="field"><span>Résumé</span><textarea class="input" name="excerpt" rows="2" maxlength="200">' + esc(v.excerpt) + "</textarea></label>" +
        '<div class="field-row">' +
          '<label class="field"><span>Minutes</span><input class="input" type="number" name="minutes" min="1" max="90" value="' + Number(v.minutes) + '"></label>' +
          '<label class="field"><span>Date</span><input class="input" name="date" maxlength="24" value="' + esc(v.date) + '"></label>' +
        "</div>" +
        '<label class="field"><span>Auteur</span><input class="input" name="author" maxlength="40" value="' + esc(v.author) + '"></label>' +
        '<label class="field"><span>Image de l’astuce</span><input class="input" type="file" name="image" accept="image/*"></label>' +
        '<div class="check-row">' +
          '<label class="check-field"><input type="checkbox" name="featured"' + (v.featured ? " checked" : "") + '><span>À la une</span></label>' +
          '<label class="check-field"><input type="checkbox" name="published"' + (v.published ? " checked" : "") + '><span>Publié</span></label>' +
        "</div>" +
         '<div class="editor-shell"><div class="editor-toolbar"><button type="button" data-editor="bold">Gras</button><button type="button" data-editor="italic">Italique</button><button type="button" data-editor="title">Titre</button><button type="button" data-editor="subtitle">Sous-titre</button><button type="button" data-editor="paragraph">Normal</button><button type="button" data-editor="list">Liste</button></div>' +
         '<label class="field"><span>Contenu</span><div class="input editor-content" contenteditable="true" role="textbox" aria-multiline="true">' + blocksToEditorHTML(v.body) + '</div><textarea class="editor-source" name="body" hidden>' + esc(blocksToText(v.body)) + "</textarea></label></div>" +
         '<p class="body-help">Sélectionne un texte, puis utilise la barre d’outils pour le mettre en forme.</p>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn-primary" type="submit">' + (t ? "Enregistrer les modifications" : "Créer l'astuce") + "</button>" +
      "</form>" +
    "</section>";
  }

  function renderAdminStories() {
    const list = App.storyList || [];
    const items = list.length
      ? list.map((s) => {
          const premium = s.episodes.filter((e) => e.cost > 0).length;
          return '<div class="admin-item">' +
            '<div class="admin-item-top"><strong>' + esc(s.title) + "</strong>" +
              (s.published ? badge("Publiée", "ok") : badge("Brouillon", "muted")) +
            "</div>" +
            '<div class="admin-item-meta">' + esc(s.genre) + " · " + plural(s.episodes.length, "épisode") +
              (premium ? " · " + premium + " premium" : "") + "</div>" +
            '<div class="admin-actions">' +
              '<button class="admin-btn" data-nav="adminStory" data-id="' + esc(s.id) + '">' + icon("book") + "Épisodes</button>" +
              '<button class="admin-btn" data-nav="adminStoryForm" data-id="' + esc(s.id) + '">Modifier</button>' +
              '<button class="admin-btn danger" data-del-story="' + esc(s.id) + '">Supprimer</button>' +
            "</div>" +
          "</div>";
        }).join("")
      : '<p class="muted-note">Aucune série. Crée la première.</p>';

    return '<section class="screen">' +
      '<div class="admin-topbar"><h1 class="screen-title">Séries &amp; cours</h1>' + adminBackBtn() + "</div>" +
      '<p class="screen-sub">Crée des séries ou des cours avec leurs épisodes et leçons.</p>' +
      '<div class="story-actions"><button class="btn-primary" data-go="adminStoryForm">' + icon("sparkles") + "Nouvelle série</button>" +
      '<button class="btn-ghost" data-nav="adminStoryForm" data-course="1">' + icon("monitor") + "Nouveau cours</button></div>" +
      '<div class="admin-list">' + items + "</div>" +
    "</section>";
  }

  function renderAdminCourses() {
    const list = App.courseList || [];
    const items = list.length ? list.map((c) => '<div class="admin-item"><div class="admin-item-top"><strong>' + esc(c.title) + '</strong>' + (c.published ? badge("Publié", "ok") : badge("Brouillon", "muted")) + '</div><div class="admin-item-meta">' + plural((c.lessons || []).length, "leçon") + '</div><div class="admin-actions"><button class="admin-btn" data-nav="adminCourse" data-id="' + esc(c.id) + '">Gérer les leçons</button><button class="admin-btn" data-nav="adminCourseForm" data-id="' + esc(c.id) + '">Modifier</button><button class="admin-btn danger" data-del-course="' + esc(c.id) + '">Supprimer</button></div></div>').join("") : '<p class="muted-note">Aucun cours. Crée ton premier cours informatique.</p>';
    return '<section class="screen"><div class="admin-topbar"><h1 class="screen-title">Cours informatiques</h1>' + adminBackBtn() + '</div><p class="screen-sub">Espace indépendant des séries pour publier des cours et leurs leçons.</p><button class="btn-primary" data-go="adminCourseForm">' + icon("monitor") + 'Nouveau cours</button><div class="admin-list">' + items + '</div></section>';
  }

  function renderAdminCourseForm(params) {
    const c = params.id ? (App.courseList || []).find((x) => x.id === params.id) : null;
    const v = c || { id: "", title: "", description: "", published: true };
    return '<section class="screen"><div class="admin-topbar"><h1 class="screen-title">' + (c ? "Modifier le cours" : "Nouveau cours") + '</h1>' + adminBackBtn() + '</div><form class="form" data-form="course"><input type="hidden" name="id" value="' + esc(v.id) + '"><label class="field"><span>Titre du cours</span><input class="input" name="title" maxlength="90" value="' + esc(v.title) + '" required></label><label class="field"><span>Description courte (200 caractères maximum)</span><textarea class="input" name="description" rows="3" maxlength="200">' + esc(v.description) + '</textarea></label><label class="field"><span>Image du cours</span><input class="input" type="file" name="image" accept="image/*"></label><label class="check-field"><input type="checkbox" name="published"' + (v.published ? ' checked' : '') + '><span>Publié</span></label><p class="form-error" role="alert"></p><button class="btn-primary" type="submit">' + (c ? "Enregistrer" : "Créer le cours") + '</button></form></section>';
  }

  function renderAdminCourse(params) {
    const c = (App.courseList || []).find((x) => x.id === params.id);
    if (!c) return renderNotFound();
    const rows = (c.lessons || []).map((l) => '<div class="admin-item"><div class="admin-item-top"><strong>Leçon ' + l.n + ' · ' + esc(l.title) + '</strong>' + (l.published ? badge("Publié", "ok") : badge("Brouillon", "muted")) + '</div><div class="admin-actions"><button class="admin-btn" data-nav="adminCourseLessonForm" data-id="' + esc(c.id) + '" data-n="' + l.n + '">Modifier</button><button class="admin-btn danger" data-del-course-lesson="' + esc(c.id) + ':' + l.n + '">Supprimer</button></div></div>').join("");
    return '<section class="screen"><div class="admin-topbar"><h1 class="screen-title">' + esc(c.title) + '</h1>' + adminBackBtn() + '</div><p class="screen-sub">Gestion indépendante des leçons du cours.</p><button class="btn-primary" data-nav="adminCourseLessonForm" data-id="' + esc(c.id) + '">' + icon("sparkles") + 'Nouvelle leçon</button><div class="admin-list">' + (rows || '<p class="muted-note">Aucune leçon pour ce cours.</p>') + '</div></section>';
  }

  function renderAdminCourseLessonForm(params) {
    const c = (App.courseList || []).find((x) => x.id === params.id);
    if (!c) return renderNotFound();
    const l = params.n ? (c.lessons || []).find((x) => Number(x.n) === Number(params.n)) : null;
    const v = l || { n: (c.lessons || []).length + 1, title: "", body: [], published: true };
    return '<section class="screen"><div class="admin-topbar"><h1 class="screen-title">' + (l ? "Modifier la leçon" : "Nouvelle leçon") + '</h1>' + adminBackBtn() + '</div><form class="form" data-form="courseLesson"><input type="hidden" name="courseId" value="' + esc(c.id) + '"><input type="hidden" name="n" value="' + v.n + '"><label class="field"><span>Titre de la leçon</span><input class="input" name="title" maxlength="100" value="' + esc(v.title) + '" required></label><div class="editor-shell"><div class="editor-toolbar"><button type="button" data-editor="bold">Gras</button><button type="button" data-editor="italic">Italique</button><button type="button" data-editor="title">Titre</button><button type="button" data-editor="subtitle">Sous-titre</button><button type="button" data-editor="paragraph">Normal</button><button type="button" data-editor="list">Liste</button></div><label class="field"><span>Contenu</span><div class="input editor-content" contenteditable="true" role="textbox" aria-multiline="true">' + blocksToEditorHTML(v.body) + '</div><textarea class="editor-source" name="body" hidden>' + esc(blocksToText(v.body)) + '</textarea></label></div><label class="check-field"><input type="checkbox" name="published"' + (v.published ? ' checked' : '') + '><span>Publié</span></label><p class="form-error" role="alert"></p><button class="btn-primary" type="submit">Enregistrer la leçon</button></form></section>';
  }

  function renderAdminStoryForm(params) {
    const s = params.id ? (App.storyList || []).find((x) => x.id === params.id) : null;
    const course = !!(params.course || (s && isCourse(s)));
    const v = s || {
      id: "", title: "", tagline: "", author: (App.user && App.user.name) || "BCréation",
      genre: course ? "Cours informatique" : "Romance", status: "En cours", letter: "", synopsis: "",
      colors: ["#ff7a9c", "#7c3aed"], published: true
    };

    return '<section class="screen">' +
      '<div class="admin-topbar"><h1 class="screen-title">' + (s ? (course ? "Modifier le cours" : "Modifier la série") : (course ? "Nouveau cours" : "Nouvelle série")) + "</h1>" + adminBackBtn() + "</div>" +
      '<form class="form" data-form="story">' +
        '<input type="hidden" name="id" value="' + esc(v.id) + '">' +
        '<label class="field"><span>Titre</span><input class="input" name="title" maxlength="70" value="' + esc(v.title) + '" required></label>' +
        '<label class="field"><span>' + (course ? "Description courte (200 caractères maximum)" : "Accroche") + '</span><input class="input" name="tagline" maxlength="200" value="' + esc(v.tagline) + '"></label>' +
        '<label class="field"><span>Image du ' + (course ? "cours" : "la série") + '</span><input class="input" type="file" name="image" accept="image/*"></label>' +
        '<div class="field-row">' +
          '<label class="field"><span>Auteur</span><input class="input" name="author" maxlength="40" value="' + esc(v.author) + '"></label>' +
          '<label class="field"><span>Genre</span><input class="input" name="genre" maxlength="30" value="' + esc(v.genre) + '"></label>' +
        "</div>" +
        '<div class="field-row">' +
          '<label class="field"><span>Statut</span><input class="input" name="status" maxlength="20" value="' + esc(v.status) + '"></label>' +
          '<label class="field"><span>Initiale</span><input class="input" name="letter" maxlength="2" value="' + esc(v.letter) + '"></label>' +
        "</div>" +
        '<label class="field"><span>Synopsis</span><textarea class="input" name="synopsis" rows="4" maxlength="600">' + esc(v.synopsis) + "</textarea></label>" +
        '<div class="field-row">' +
          '<label class="field color-field"><span>Couleur 1</span><input class="color-input" type="color" name="c1" value="' + esc(v.colors[0]) + '"></label>' +
          '<label class="field color-field"><span>Couleur 2</span><input class="color-input" type="color" name="c2" value="' + esc(v.colors[1]) + '"></label>' +
        "</div>" +
        '<div class="check-row">' +
          '<label class="check-field"><input type="checkbox" name="published"' + (v.published ? " checked" : "") + '><span>Publiée</span></label>' +
        "</div>" +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn-primary" type="submit">' + (s ? "Enregistrer les modifications" : (course ? "Créer le cours" : "Créer la série")) + "</button>" +
      "</form>" +
    "</section>";
  }

  function renderAdminStory(params) {
    const s = (App.storyList || []).find((x) => x.id === params.id);
    if (!s) return renderNotFound();

    const rows = s.episodes.length
      ? s.episodes.map((ep) =>
          '<div class="admin-item">' +
            '<div class="admin-item-top"><strong>' + (isCourse(s) ? "Leçon " : "Épisode ") + ep.n + " · " + esc(ep.title) + "</strong>" +
              (ep.published ? badge("Publié", "ok") : badge("Brouillon", "muted")) +
              (ep.cost > 0 ? badge(ep.cost + " crédits", "warn") : badge("Gratuit", "muted")) +
            "</div>" +
            '<div class="admin-item-meta">' + esc(ep.date) + " · " + ep.minutes + " min</div>" +
            '<div class="admin-actions">' +
              '<button class="admin-btn" data-nav="adminEpisodeForm" data-id="' + esc(s.id) + '" data-n="' + ep.n + '">Modifier</button>' +
              '<button class="admin-btn danger" data-del-ep="' + esc(s.id) + ":" + ep.n + '">Supprimer</button>' +
            "</div>" +
          "</div>"
        ).join("")
      : '<p class="muted-note">Aucune ' + (isCourse(s) ? "leçon pour ce cours." : "épisode pour cette série.") + "</p>";

    return '<section class="screen">' +
      '<div class="story-hero" style="--g1:' + esc(s.colors[0]) + ";--g2:" + esc(s.colors[1]) + '">' +
        '<span class="genre">' + esc(s.genre) + (s.published ? "" : " · brouillon") + "</span>" +
        "<h1>" + esc(s.title) + "</h1>" +
        "<p>" + esc(s.tagline) + "</p>" +
        '<div class="hero-stats"><span>' + icon("book") + plural(s.episodes.length, isCourse(s) ? "leçon" : "épisode") + "</span><span>" + esc(s.status) + "</span></div>" +
      "</div>" +

      '<div class="story-actions">' +
        '<button class="pill-btn" data-nav="adminEpisodeForm" data-id="' + esc(s.id) + '">' + icon("sparkles") + "Nouvelle " + (isCourse(s) ? "leçon" : "épisode") + "</button>" +
        '<button class="pill-btn" data-nav="adminStoryForm" data-id="' + esc(s.id) + '">' + icon("code") + "Modifier</button>" +
      "</div>" +
      '<div class="story-actions" style="margin-top:8px">' +
        '<button class="pill-btn" data-story="' + esc(s.id) + '">' + icon("book") + "Voir la fiche publique</button>" +
      "</div>" +

      '<div class="section-head"><h2>' + (isCourse(s) ? "Leçons" : "Épisodes") + '</h2><span class="section-count">' + s.episodes.length + "</span></div>" +
      '<div class="admin-list">' + rows + "</div>" +
      '<div class="admin-topbar" style="margin-top:18px">' + adminBackBtn() + "</div>" +
    "</section>";
  }

  function renderAdminEpisodeForm(params) {
    const storyId = params.id;
    const s = (App.storyList || []).find((x) => x.id === storyId);
    if (!s) return renderNotFound();
    const ep = params.n ? s.episodes.find((e) => Number(e.n) === Number(params.n)) : null;
    const nextN = s.episodes.reduce((max, e) => Math.max(max, Number(e.n) || 0), 0) + 1;
    const v = ep || {
      n: nextN, title: "", minutes: 5, date: todayFR(), cost: 0, published: true, body: []
    };

    const course = isCourse(s);
    return '<section class="screen">' +
      '<div class="admin-topbar"><h1 class="screen-title">' + (ep ? (course ? "Leçon " : "Épisode ") + ep.n : (course ? "Nouvelle leçon" : "Nouvel épisode")) + "</h1>" + adminBackBtn() + "</div>" +
      '<p class="screen-sub">' + esc(s.title) + "</p>" +
      '<form class="form" data-form="episode">' +
        '<input type="hidden" name="storyId" value="' + esc(s.id) + '">' +
        '<input type="hidden" name="n" value="' + (ep ? ep.n : 0) + '">' +
        '<label class="field"><span>Titre de la ' + (course ? "leçon" : "l\'épisode") + '</span><input class="input" name="title" maxlength="90" value="' + esc(v.title) + '" required></label>' +
        '<label class="field"><span>Image de l’épisode</span><input class="input" type="file" name="image" accept="image/*"></label>' +
        '<div class="field-row">' +
          '<label class="field"><span>Minutes</span><input class="input" type="number" name="minutes" min="1" max="120" value="' + Number(v.minutes) + '"></label>' +
          '<label class="field"><span>Date</span><input class="input" name="date" maxlength="24" value="' + esc(v.date) + '"></label>' +
        "</div>" +
        '<label class="field"><span>Coût en crédits <small>(0 = gratuit)</small></span><input class="input" type="number" name="cost" min="0" max="500" value="' + Number(v.cost) + '"></label>' +
        '<div class="check-row">' +
          '<label class="check-field"><input type="checkbox" name="published"' + (v.published ? " checked" : "") + '><span>Publié</span></label>' +
        "</div>" +
         '<div class="editor-shell"><div class="editor-toolbar"><button type="button" data-editor="bold">Gras</button><button type="button" data-editor="italic">Italique</button><button type="button" data-editor="title">Titre</button><button type="button" data-editor="subtitle">Sous-titre</button><button type="button" data-editor="paragraph">Normal</button><button type="button" data-editor="list">Liste</button></div><label class="field"><span>Contenu</span><div class="input editor-content" contenteditable="true" role="textbox" aria-multiline="true">' + blocksToEditorHTML(v.body) + '</div><textarea class="editor-source" name="body" hidden>' + esc(blocksToText(v.body)) + "</textarea></label></div>" +
         '<p class="body-help">Sélectionne un texte, puis utilise la barre d’outils pour le mettre en forme.</p>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn-primary" type="submit">' + (ep ? "Enregistrer la " + (course ? "leçon" : "épisode") : "Créer la " + (course ? "leçon" : "l'épisode")) + "</button>" +
      "</form>" +
    "</section>";
  }

  function renderAdminUsers() {
    const list = App.userList || [];
    const items = list.map((u) => {
      const admin = u.role === "admin";
      const blocked = u.status === "blocked";
      const self = App.user && App.user.id === u.id;
      return '<div class="admin-item">' +
        '<div class="admin-item-top"><strong>' + esc(u.name) + "</strong>" +
          badge(admin ? "Admin" : "Membre", admin ? "warn" : "muted") +
          (blocked ? badge("Bloqué", "danger") : badge("Actif", "ok")) +
          (self ? badge("Toi", "muted") : "") +
        "</div>" +
        '<div class="admin-item-meta">' + esc(u.email) + " · inscrit le " + esc(formatDate(u.createdAt)) + "</div>" +
        '<div class="user-credits">' + creditPill(u.credits) + "</div>" +
        '<div class="admin-actions">' +
          '<button class="admin-btn" data-credit-user="' + esc(u.id) + '">' + icon("sparkles") + "Crédits</button>" +
          (self ? "" : '<button class="admin-btn" data-role-user="' + esc(u.id) + '">' + (admin ? "Retirer admin" : "Nommer admin") + "</button>") +
          (self ? "" : '<button class="admin-btn danger" data-status-user="' + esc(u.id) + '">' + (blocked ? "Débloquer" : "Bloquer") + "</button>") +
        "</div>" +
      "</div>";
    }).join("");

    return '<section class="screen">' +
      '<div class="admin-topbar"><h1 class="screen-title">Utilisateurs</h1>' + adminBackBtn() + "</div>" +
      '<p class="screen-sub">' + plural(list.length, "compte") + " au total.</p>" +
      '<div class="admin-list">' + (items || '<p class="muted-note">Aucun utilisateur.</p>') + "</div>" +
    "</section>";
  }

  function renderAdminSettings() {
    const s = App.adminSettings;
    if (!s) return loadErrorHTML(new Error("Réglages indisponibles."));

    return '<section class="screen">' +
      '<div class="admin-topbar"><h1 class="screen-title">Réglages</h1>' + adminBackBtn() + "</div>" +
      '<p class="screen-sub">Crédits, connexion Google Sheets et contenu de démonstration.</p>' +

      '<form class="form" data-form="settings">' +
        '<label class="field"><span>Crédits offerts à l\'inscription</span><input class="input" type="number" name="welcomeCredits" min="0" max="500" value="' + Number(s.welcomeCredits) + '"></label>' +
        '<p class="body-help">Ce montant est versé automatiquement lors de la création d\'un compte.</p>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="btn-primary" type="submit">Enregistrer les réglages</button>' +
      "</form>" +

      '<div class="about-card" style="margin-top:18px">' +
        "<h2>Base de données</h2>" +
        "<p>" + (BCApi.isDemo
          ? "Mode démo : aucune feuille Google n'est connectée. Ouvre <code>assets/js/api.js</code> et colle l'URL <code>/exec</code> de ton déploiement Apps Script."
          : "Connectée à Google Sheets via Apps Script.") + "</p>" +
        "<p>Administrateur : <code>" + esc(s.adminEmail) + "</code></p>" +
        (s.spreadsheetUrl ? "<p>Feuille : <code>" + esc(s.spreadsheetUrl) + "</code></p>" : "") +
      "</div>" +

      '<div class="about-card">' +
        "<h2>Contenu de démonstration</h2>" +
        "<p>Importe les 6 catégories, les 9 astuces et les 3 séries fournies avec l'application. Le contenu existant n'est jamais écrasé.</p>" +
        '<button class="btn-primary" data-import-demo>' + icon("sparkles") + "Importer le contenu</button>" +
      "</div>" +

      (BCApi.isDemo
        ? '<div class="about-card">' +
            "<h2>Réinitialiser la démo</h2>" +
            "<p>Efface les comptes et les modifications locales, puis restaure le contenu d'origine.</p>" +
            '<button class="btn-ghost danger" data-reset-demo>Réinitialiser</button>' +
          "</div>"
        : "") +
    "</section>";
  }

  /* ---------------- Router ---------------- */

  const VIEWS = {
    home: renderHome,
    tips: renderTips,
    tip: renderTip,
    stories: renderStories,
    courses: renderCourses,
    course: renderCourse,
    courseLesson: renderCourseLesson,
    story: renderStory,
    episode: renderEpisode,
    favorites: renderFavorites,
    about: renderAbout,
    login: renderLogin,
    signup: renderSignup,
    profile: renderProfile,
    profileEdit: renderProfileEdit,
    passwordForm: renderPasswordForm,
    admin: renderAdmin,
    adminTips: renderAdminTips,
    adminTipForm: renderAdminTipForm,
    adminStories: renderAdminStories,
    adminCourses: renderAdminCourses,
    adminCourseForm: renderAdminCourseForm,
    adminCourse: renderAdminCourse,
    adminCourseLessonForm: renderAdminCourseLessonForm,
    adminStoryForm: renderAdminStoryForm,
    adminStory: renderAdminStory,
    adminEpisodeForm: renderAdminEpisodeForm,
    adminUsers: renderAdminUsers,
    adminSettings: renderAdminSettings
  };

  const ROOTS = ["home", "tips", "stories", "courses", "favorites", "profile", "about", "login", "signup"];

  const ADMIN_ROUTES = ["admin", "adminTips", "adminTipForm", "adminStories", "adminStoryForm", "adminStory", "adminEpisodeForm", "adminCourses", "adminCourseForm", "adminCourse", "adminCourseLessonForm", "adminUsers", "adminSettings"];
  const USER_ROUTES = ["profile", "profileEdit", "passwordForm"];

  let stack = [{ name: "home", params: {} }];
  let navSeq = 0;

  function tabFor(name) {
    if (name === "tip") return "tips";
    if (name === "story" || name === "episode") return "stories";
    if (name === "course" || name === "courseLesson") return "courses";
    if (name === "login" || name === "signup") return "profile";
    if (ADMIN_ROUTES.indexOf(name) >= 0) return "profile";
    return ROOTS.indexOf(name) >= 0 ? name : "home";
  }

  function needsData(name) {
    return ADMIN_ROUTES.indexOf(name) >= 0 || USER_ROUTES.indexOf(name) >= 0;
  }

  function headerInfo(cur) {
    switch (cur.name) {
      case "home": return { title: App.settings.appName || "BCréation", sub: "Astuces & histoires" };
      case "tips": return { title: "Astuces", sub: "" };
      case "stories": return { title: "Histoires", sub: "" };
      case "courses": return { title: "Cours informatiques", sub: "" };
      case "favorites": return { title: "Mes favoris", sub: "" };
      case "profile": return { title: "Mon profil", sub: "" };
      case "profileEdit": return { title: "Modifier le profil", sub: "" };
      case "passwordForm": return { title: "Mot de passe", sub: "" };
      case "login": return { title: "Connexion", sub: "" };
      case "signup": return { title: "Créer un compte", sub: "" };
      case "about": return { title: "À propos", sub: "" };
      case "tip": {
        const t = tipById(cur.params.id);
        return { title: "Astuce", sub: t ? catOf(t.cat).name : "" };
      }
      case "story": {
        const s = storyById(cur.params.id);
        return { title: s ? s.title : "Série", sub: "Série" };
      }
      case "episode": {
        const s = storyById(cur.params.storyId);
        return { title: s ? s.title : "Épisode", sub: "Épisode " + cur.params.n };
      }
      case "course": {
        const c = courseById(cur.params.id);
        return { title: c ? c.title : "Cours", sub: "Cours informatique" };
      }
      case "courseLesson": {
        const c = courseById(cur.params.courseId);
        return { title: c ? c.title : "Leçon", sub: "Leçon " + cur.params.n };
      }
      case "admin": return { title: "Administration", sub: "Tableau de bord" };
      case "adminTips": return { title: "Astuces", sub: "Administration" };
      case "adminTipForm": return { title: "Astuce", sub: "Administration" };
      case "adminStories": return { title: "Séries", sub: "Administration" };
      case "adminStoryForm": return { title: "Série", sub: "Administration" };
      case "adminStory": {
        const s = (App.storyList || []).find((x) => x.id === cur.params.id);
        return { title: s ? s.title : "Série", sub: "Administration" };
      }
      case "adminEpisodeForm": return { title: "Épisode", sub: "Administration" };
      case "adminCourses": return { title: "Cours informatiques", sub: "Administration" };
      case "adminCourseForm": return { title: "Cours", sub: "Administration" };
      case "adminCourse": return { title: "Leçons", sub: "Administration" };
      case "adminCourseLessonForm": return { title: "Leçon", sub: "Administration" };
      case "adminUsers": return { title: "Utilisateurs", sub: "Administration" };
      case "adminSettings": return { title: "Réglages", sub: "Administration" };
      default: return { title: App.settings.appName || "BCréation", sub: "" };
    }
  }

  function applyChrome(cur) {
    const info = headerInfo(cur);
    $("#headerTitle").textContent = info.title;
    const sub = $("#headerSub");
    sub.textContent = info.sub;
    sub.classList.toggle("hidden", !info.sub);

    $("#menuBtn").classList.toggle("hidden", stack.length > 1);
    $("#backBtn").classList.toggle("hidden", stack.length <= 1);

    const searchable = ["home", "stories", "story", "tip", "favorites", "about"].indexOf(cur.name) >= 0;
    $("#searchBtn").classList.toggle("hidden", !searchable);

    const reading = cur.name === "episode" && isEpisodeReadable(cur.params);
    document.body.classList.toggle("reading", reading);

    const tab = tabFor(cur.name);
    $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.go === tab));
    $$(".drawer-item").forEach((b) => b.classList.toggle("active", b.dataset.go === tab));
    $("#drawerAdmin").classList.toggle("active", ADMIN_ROUTES.indexOf(cur.name) >= 0);
  }

  function appBasePath() {
    if (location.protocol === "file:") return "";
    const script = document.querySelector('script[src*="assets/js/app.js"]');
    if (script) {
      const path = new URL(script.src, location.href).pathname;
      return path.replace(/\/assets\/js\/app\.js$/, "");
    }
    return location.pathname.replace(/\/index(?:\.html)?$/, "").replace(/\/$/, "");
  }

  function routePath(cur) {
    const p = cur.params || {};
    const ids = {
      home: "index", tips: "astuces", stories: "histoires", courses: "cours-informatiques",
      favorites: "favoris", profile: "profil", about: "a-propos", login: "connexion", signup: "inscription"
    };
    if (ids[cur.name]) return ids[cur.name];
    if (cur.name === "tip") return "astuce/" + encodeURIComponent(p.id || "");
    if (cur.name === "story") return "histoire/" + encodeURIComponent(p.id || "");
    if (cur.name === "episode") return "episode/" + encodeURIComponent(p.storyId || "") + "/" + p.n;
    if (cur.name === "course") return "cours/" + encodeURIComponent(p.id || "");
    if (cur.name === "courseLesson") return "cours/" + encodeURIComponent(p.courseId || "") + "/lecon/" + p.n;
    if (cur.name.indexOf("admin") === 0) return "administration/" + cur.name.replace(/^admin/, "").toLowerCase();
    return "index";
  }

  function syncUrl(cur) {
    if (location.protocol === "file:") {
      const hash = "#" + routePath(cur);
      if (location.hash !== hash) history.replaceState(null, "", hash);
    } else {
      const target = appBasePath() + "/" + routePath(cur);
      if (location.pathname !== target || location.search || location.hash) history.replaceState(null, "", target);
    }
    const info = headerInfo(cur);
    document.title = (info.title || "BCréation") + " — BCréation";
  }

  function render(dir) {
    const cur = stack[stack.length - 1];
    const view = VIEWS[cur.name] || renderNotFound;
    main.innerHTML = view(cur.params);

    applyChrome(cur);
    syncUrl(cur);

    main.classList.remove("anim-push", "anim-pop");
    void main.offsetWidth;
    if (dir === "push") main.classList.add("anim-push");
    else if (dir === "pop") main.classList.add("anim-pop");

    main.scrollTop = 0;

    updateFavButtons();
    if (cur.name === "tips") bindTips();
    if (document.body.classList.contains("reading")) updateReaderBar();
    updateReadProgress();
  }

  function renderLoadError(err) {
    const cur = stack[stack.length - 1];
    main.innerHTML = loadErrorHTML(err);
    applyChrome(cur);
    document.body.classList.remove("reading");
  }

  function guard(name) {
    if (ADMIN_ROUTES.indexOf(name) >= 0) {
      if (!App.user) return { route: "login", message: "Connecte-toi pour accéder à cet espace." };
      if (App.user.role !== "admin") return { route: "profile", message: "Accès réservé aux administrateurs." };
    }
    if (USER_ROUTES.indexOf(name) >= 0 && !App.user) {
      return { route: "login", message: "Connecte-toi pour accéder à ton profil." };
    }
    if ((name === "login" || name === "signup") && App.user) {
      return { route: "profile", message: "Tu es déjà connecté." };
    }
    return null;
  }

  async function ensureRoute(cur) {
    const name = cur.name;

    if (name === "profile" || name === "profileEdit" || name === "passwordForm") {
      App.profile = await BCApi.api("profile");
      App.user = App.profile.user;
      renderDrawer();
    } else if (name === "admin") {
      App.admin = await BCApi.api("adminStats");
    } else if (name === "adminTips") {
      App.tipList = await BCApi.api("adminTips");
    } else if (name === "adminTipForm") {
      if (cur.params.id) {
        App.tipList = await BCApi.api("adminTips");
        if (!(App.tipList || []).some((x) => x.id === cur.params.id)) throw new Error("Astuce introuvable.");
      }
    } else if (name === "adminStories") {
      App.storyList = await BCApi.api("adminStories");
    } else if (name === "adminCourses" || name === "adminCourseForm" || name === "adminCourse" || name === "adminCourseLessonForm") {
      App.courseList = await BCApi.api("adminCourses");
      if (name !== "adminCourseForm" && cur.params.id && !(App.courseList || []).some((x) => x.id === cur.params.id)) throw new Error("Cours introuvable.");
    } else if (name === "adminStory" || name === "adminStoryForm" || name === "adminEpisodeForm") {
      App.storyList = await BCApi.api("adminStories");
      if (name !== "adminStoryForm" && cur.params.id && !(App.storyList || []).some((x) => x.id === cur.params.id)) {
        throw new Error("Série introuvable.");
      }
    } else if (name === "adminUsers") {
      App.userList = await BCApi.api("adminUsers");
    } else if (name === "adminSettings") {
      App.adminSettings = await BCApi.api("adminSettings");
    }
  }

  async function showRoute(dir) {
    const id = ++navSeq;
    closeDrawer();

    let redirect = guard(stack[stack.length - 1].name);
    if (redirect) {
      toast(redirect.message);
      stack = [{ name: redirect.route, params: {} }];
    }

    const cur = stack[stack.length - 1];
    if (needsData(cur.name)) main.innerHTML = loadingHTML();

    try {
      await ensureRoute(cur);
    } catch (err) {
      if (id !== navSeq) return;
      if (err && err.code === "unauthorized") {
        BCApi.clearToken();
        App.user = null;
        App.profile = null;
        renderDrawer();
        stack = [{ name: "login", params: {} }];
        render("none");
        toast(err.message);
        return;
      }
      renderLoadError(err);
      return;
    }

    if (id !== navSeq) return;
    render(dir);
  }

  async function navigate(name, params, mode) {
    const entry = { name: name, params: params || {} };
    if (mode === "root") stack = [entry];
    else if (mode === "replace") stack[stack.length - 1] = entry;
    else stack.push(entry);
    await showRoute(mode === "root" ? "tab" : "push");
  }

  async function go(name, params) {
    await navigate(name, params, ROOTS.indexOf(name) >= 0 ? "root" : "push");
  }

  async function popView() {
    if (stack.length > 1) {
      stack.pop();
      await showRoute("pop");
    }
  }

  async function goEpisode(storyId, n, dir) {
    stack[stack.length - 1] = { name: "episode", params: { storyId: storyId, n: n } };
    await showRoute(dir || "push");
  }

  async function backAfterForm(fallback) {
    if (stack.length > 1) {
      stack.pop();
      await showRoute("pop");
    } else {
      await navigate(fallback, {}, "root");
    }
  }

  /* ---------------- Drawer ---------------- */

  function renderDrawer() {
    const el = $("#drawerAccount");
    if (!el) return;

    if (App.user) {
      const admin = App.user.role === "admin";
      el.innerHTML =
        '<div class="account-line">' +
          '<span class="avatar-sm">' + esc(initials(App.user.name)) + "</span>" +
          '<span class="account-id"><strong>' + esc(App.user.name) + "</strong><span>" + esc(App.user.email) + "</span></span>" +
        "</div>" +
        '<div class="account-meta">' + creditPill(App.user.credits) + (admin ? badge("Admin", "warn") : "") + "</div>" +
        (BCApi.isDemo ? '<span class="demo-chip">Mode démo local</span>' : "");
    } else {
      el.innerHTML =
        '<p class="account-guest">Connecte-toi pour recevoir ' + Number(App.settings.welcomeCredits) + " crédits et débloquer les épisodes premium.</p>" +
        '<div class="account-actions">' +
          '<button class="btn-primary sm" data-go="login">Se connecter</button>' +
          '<button class="btn-ghost sm" data-go="signup">Créer un compte</button>' +
        "</div>";
    }

    $("#drawerAdmin").classList.toggle("hidden", !(App.user && App.user.role === "admin"));
  }

  function openDrawer() {
    shell.classList.add("drawer-open");
    drawer.setAttribute("aria-hidden", "false");
    resetDrawerStyles();
  }

  function closeDrawer() {
    shell.classList.remove("drawer-open");
    drawer.setAttribute("aria-hidden", "true");
    resetDrawerStyles();
  }

  function resetDrawerStyles() {
    drawer.style.transition = "";
    drawer.style.transform = "";
    overlay.style.opacity = "";
  }

  /* ---------------- Barre de lecture ---------------- */

  function updateReaderBar() {
    const cur = stack[stack.length - 1];
    if (cur.name !== "episode") return;
    const s = storyById(cur.params.storyId);
    if (!s) return;
    const ep = episodeOf(s, cur.params.n);
    if (!ep) return;

    const prev = adjacentEpisode(s, ep.n, -1);
    const next = adjacentEpisode(s, ep.n, 1);

    $("#readerCount").textContent = ep.n + " / " + s.episodes.length;
    $("#readerPrev").disabled = !prev;
    $("#readerNext").disabled = !next;
  }

  function updateReadProgress() {
    const bar = $("#readProgress");
    if (!bar) return;
    if (!document.body.classList.contains("reading")) {
      bar.style.width = "0%";
      return;
    }
    const max = main.scrollHeight - main.clientHeight;
    const p = max > 0 ? Math.min(100, Math.round((main.scrollTop / max) * 100)) : 0;
    bar.style.width = p + "%";
  }

  /* ---------------- Actions métier ---------------- */

  async function refreshBootstrap() {
    const data = await BCApi.api("bootstrap");
    App.settings = Object.assign({ appName: "BCréation", welcomeCredits: 10 }, data.settings || {});
    App.user = data.user || null;
    if (!App.user) BCApi.clearToken();
    App.categories = data.categories || [];
    App.tips = data.tips || [];
    App.stories = data.stories || [];
    App.courses = data.courses || [];

    CAT_MAP = {};
    App.categories.forEach((c) => { CAT_MAP[c.id] = c; });

    App.ready = true;
    renderDrawer();
  }

  function invalidateAdmin() {
    App.admin = null;
    App.tipList = null;
    App.storyList = null;
    App.courseList = null;
    App.userList = null;
    App.adminSettings = null;
  }

  async function unlockFlow(storyId, n) {
    const s = storyById(storyId);
    const ep = episodeOf(s, n);
    if (!s || !ep) return;

    if (!App.user) {
      toast("Connecte-toi pour débloquer cet épisode.");
      await navigate("login", {}, "root");
      return;
    }
    if (!(ep.cost > 0) || ep.unlocked) {
      await goEpisode(storyId, n);
      return;
    }

    const ok = await askConfirm({
      title: "Débloquer l'épisode " + n,
      html: "« " + esc(ep.title) + " »<br><br>Coût : <strong>" + ep.cost + " crédits</strong> · Solde : " + Number(App.user.credits) + " crédits.<br>Le déblocage est définitif.",
      label: "Débloquer · " + ep.cost
    });
    if (!ok) return;

    try {
      const res = await BCApi.api("unlockEpisode", { storyId: storyId, n: n });
      App.user = res.user;
      App.profile = null;
      await refreshBootstrap();
      toast("Épisode débloqué — bonne lecture !");
      if (stack[stack.length - 1].name === "episode") {
        stack[stack.length - 1] = { name: "episode", params: { storyId: storyId, n: n } };
        await showRoute("none");
      } else {
        await navigate("episode", { storyId: storyId, n: n }, "push");
      }
    } catch (err) {
      toast(err.message);
    }
  }

  async function logout() {
    try { await BCApi.api("logout"); } catch (err) { /* ignore */ }
    BCApi.clearToken();
    App.user = null;
    App.profile = null;
    invalidateAdmin();
    try { await refreshBootstrap(); } catch (err) { /* ignore */ }
    stack = [{ name: "home", params: {} }];
    render("pop");
    toast("Tu es déconnecté.");
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Un instant...";
    } else {
      btn.disabled = false;
      if (btn.dataset.label) {
        btn.textContent = btn.dataset.label;
        delete btn.dataset.label;
      }
    }
  }

  async function handleForm(form) {
    const kind = form.dataset.form;
    const visualEditor = form.querySelector('.editor-content[contenteditable="true"]');
    if (visualEditor) {
      const source = form.querySelector('textarea[name="body"]');
      if (source) source.value = editorHTMLToText(visualEditor);
    }
    const fd = new FormData(form);
    const btn = form.querySelector('[type="submit"]');
    const errEl = form.querySelector(".form-error");
    if (errEl) errEl.textContent = "";
    setBusy(btn, true);

    try {
      if (kind === "login") {
        const res = await BCApi.api("login", {
          email: String(fd.get("email") || "").trim(),
          password: String(fd.get("password") || "")
        });
        const avatarFile = form.querySelector('[name="avatar"]') && form.querySelector('[name="avatar"]').files[0];
        if (avatarFile) {
          const reader = new FileReader();
          reader.onload = () => { try { localStorage.setItem("bcreation:image:profile:" + res.user.id, reader.result); } catch (err) {} };
          reader.readAsDataURL(avatarFile);
        }
        BCApi.setToken(res.token);
        App.profile = null;
        await refreshBootstrap();
        toast("Content de te revoir, " + res.user.name.split(" ")[0] + " !");
        await navigate("profile", {}, "root");
      } else if (kind === "signup") {
        const res = await BCApi.api("signup", {
          name: String(fd.get("name") || "").trim(),
          email: String(fd.get("email") || "").trim(),
          password: String(fd.get("password") || "")
        });
        const avatarFile = form.querySelector('[name="avatar"]') && form.querySelector('[name="avatar"]').files[0];
        if (avatarFile) {
          const reader = new FileReader();
          reader.onload = () => { try { localStorage.setItem("bcreation:image:profile:" + res.user.id, reader.result); } catch (err) {} };
          reader.readAsDataURL(avatarFile);
        }
        BCApi.setToken(res.token);
        App.profile = null;
        await refreshBootstrap();
        toast("Bienvenue " + res.user.name.split(" ")[0] + " — " + res.welcomeCredits + " crédits offerts !");
        await navigate("profile", {}, "root");
      } else if (kind === "profile") {
        await BCApi.api("updateProfile", {
          name: String(fd.get("name") || "").trim(),
          bio: String(fd.get("bio") || "").trim()
        });
        App.profile = null;
        await refreshBootstrap();
        toast("Profil mis à jour.");
        await navigate("profile", {}, "root");
      } else if (kind === "password") {
        const next = String(fd.get("next") || "");
        const confirm = String(fd.get("confirm") || "");
        if (next !== confirm) throw new Error("Les deux mots de passe ne correspondent pas.");
        await BCApi.api("changePassword", { current: String(fd.get("current") || ""), next: next });
        toast("Mot de passe modifié.");
        await navigate("profile", {}, "root");
      } else if (kind === "tip") {
        const image = await readImageFile(form.querySelector('[name="image"]') && form.querySelector('[name="image"]').files[0]);
        const tip = {
          id: String(fd.get("id") || ""),
          cat: String(fd.get("cat") || ""),
          title: String(fd.get("title") || "").trim(),
          excerpt: String(fd.get("excerpt") || "").trim(),
          minutes: Number(fd.get("minutes")) || 3,
          date: String(fd.get("date") || "").trim(),
          author: String(fd.get("author") || "").trim(),
          featured: fd.get("featured") === "on",
          published: fd.get("published") === "on",
          body: textToBlocks(fd.get("body")),
          image: image || String((App.tipList || []).find((x) => x.id === String(fd.get("id") || ""))?.image || "")
        };
        await BCApi.api("adminSaveTip", { tip: tip });
        invalidateAdmin();
        await refreshBootstrap();
        toast("Astuce enregistrée.");
        await backAfterForm("adminTips");
      } else if (kind === "course") {
        const image = await readImageFile(form.querySelector('[name="image"]') && form.querySelector('[name="image"]').files[0]);
        const current = (App.courseList || []).find((c) => c.id === String(fd.get("id") || ""));
        const course = { id: String(fd.get("id") || ""), title: String(fd.get("title") || "").trim(), description: String(fd.get("description") || "").trim().slice(0, 200), published: fd.get("published") === "on", image: image || (current && current.image) || "" };
        await BCApi.api("adminSaveCourse", { course: course });
        invalidateAdmin();
        await refreshBootstrap();
        toast("Cours enregistré dans Google Sheets.");
        await backAfterForm("adminCourses");
      } else if (kind === "courseLesson") {
        const lesson = { courseId: String(fd.get("courseId") || ""), n: Number(fd.get("n")) || 1, title: String(fd.get("title") || "").trim(), body: textToBlocks(fd.get("body")), published: fd.get("published") === "on" };
        await BCApi.api("adminSaveCourseLesson", { lesson: lesson });
        invalidateAdmin();
        await refreshBootstrap();
        toast("Leçon enregistrée dans Google Sheets.");
        await backAfterForm("adminCourses");
      } else if (kind === "story") {
        const colors = [String(fd.get("c1") || "#ff7a9c"), String(fd.get("c2") || "#7c3aed")];
        const image = await readImageFile(form.querySelector('[name="image"]') && form.querySelector('[name="image"]').files[0]);
        const story = {
          id: String(fd.get("id") || ""),
          title: String(fd.get("title") || "").trim(),
          tagline: String(fd.get("tagline") || "").trim().slice(0, 200),
          author: String(fd.get("author") || "").trim(),
          genre: String(fd.get("genre") || "").trim(),
          status: String(fd.get("status") || "").trim(),
          letter: String(fd.get("letter") || "").trim(),
          synopsis: String(fd.get("synopsis") || "").trim(),
          colors: colors,
          published: fd.get("published") === "on",
          image: image || String((App.storyList || []).find((x) => x.id === String(fd.get("id") || ""))?.image || "")
        };
        await BCApi.api("adminSaveStory", { story: story });
        invalidateAdmin();
        await refreshBootstrap();
        toast(/cours|informatique/i.test(story.genre) ? "Cours enregistré." : "Série enregistrée.");
        await backAfterForm("adminStories");
      } else if (kind === "episode") {
        const image = await readImageFile(form.querySelector('[name="image"]') && form.querySelector('[name="image"]').files[0]);
        const currentStory = (App.storyList || []).find((story) => story.id === String(fd.get("storyId") || ""));
        const currentEpisode = currentStory && (currentStory.episodes || []).find((existingEpisode) => Number(existingEpisode.n) === Number(fd.get("n")));
        const episode = {
          storyId: String(fd.get("storyId") || ""),
          n: Number(fd.get("n")) || 0,
          title: String(fd.get("title") || "").trim(),
          minutes: Number(fd.get("minutes")) || 5,
          date: String(fd.get("date") || "").trim(),
          cost: Number(fd.get("cost")) || 0,
          published: fd.get("published") === "on",
          body: textToBlocks(fd.get("body")),
          image: image || (currentEpisode && currentEpisode.image) || ""
        };
        await BCApi.api("adminSaveEpisode", { episode: episode });
        invalidateAdmin();
        await refreshBootstrap();
        toast(currentStory && isCourse(currentStory) ? "Leçon enregistrée." : "Épisode enregistré.");
        await backAfterForm("adminStories");
      } else if (kind === "settings") {
        const welcomeCredits = Number(fd.get("welcomeCredits")) || 0;
        await BCApi.api("adminSaveSettings", { welcomeCredits: welcomeCredits });
        App.adminSettings = null;
        await refreshBootstrap();
        toast("Réglages enregistrés.");
        await showRoute("none");
      }
    } catch (err) {
      if (errEl) errEl.textContent = err.message || "Une erreur est survenue.";
      else toast(err.message || "Une erreur est survenue.");
    } finally {
      setBusy(btn, false);
    }
  }

  async function deleteTip(id) {
    const ok = await askConfirm({
      title: "Supprimer l'astuce ?",
      text: "Cette action est définitive.",
      label: "Supprimer",
      danger: true
    });
    if (!ok) return;
    try {
      await BCApi.api("adminDeleteTip", { id: id });
      invalidateAdmin();
      await refreshBootstrap();
      toast("Astuce supprimée.");
      await showRoute("none");
    } catch (err) {
      toast(err.message);
    }
  }

  async function deleteCourse(id) {
    if (!await askConfirm({ title: "Supprimer le cours ?", text: "Le cours et ses leçons seront supprimés.", label: "Supprimer", danger: true })) return;
    try { await BCApi.api("adminDeleteCourse", { id: id }); invalidateAdmin(); await refreshBootstrap(); toast("Cours supprimé."); await showRoute("none"); } catch (err) { toast(err.message); }
  }

  async function deleteCourseLesson(courseId, n) {
    const c = (App.courseList || []).find((x) => x.id === courseId);
    const l = c && (c.lessons || []).find((x) => Number(x.n) === Number(n));
    if (!l || !await askConfirm({ title: "Supprimer la leçon ?", text: "Cette action est définitive.", label: "Supprimer", danger: true })) return;
    try { await BCApi.api("adminDeleteCourseLesson", { id: l.id || "" }); invalidateAdmin(); await refreshBootstrap(); toast("Leçon supprimée."); await showRoute("none"); } catch (err) { toast(err.message); }
  }

  async function deleteStory(id) {
    const ok = await askConfirm({
      title: "Supprimer la série ?",
      text: "La série, ses épisodes et les déblocages liés seront supprimés.",
      label: "Supprimer",
      danger: true
    });
    if (!ok) return;
    try {
      await BCApi.api("adminDeleteStory", { id: id });
      invalidateAdmin();
      await refreshBootstrap();
      toast("Série supprimée.");
      await showRoute("none");
    } catch (err) {
      toast(err.message);
    }
  }

  async function deleteEpisode(storyId, n) {
    const ok = await askConfirm({
      title: "Supprimer l'épisode " + n + " ?",
      text: "Cette action est définitive.",
      label: "Supprimer",
      danger: true
    });
    if (!ok) return;
    try {
      await BCApi.api("adminDeleteEpisode", { storyId: storyId, n: n });
      invalidateAdmin();
      await refreshBootstrap();
      toast("Épisode supprimé.");
      await showRoute("none");
    } catch (err) {
      toast(err.message);
    }
  }

  function openCreditsModal(user) {
    const card = openModal(
      "<h3>Ajuster les crédits</h3>" +
      '<p class="modal-text">' + esc(user.name) + " — solde actuel : <strong>" + Number(user.credits) + " crédits</strong>.</p>" +
      '<form class="form" id="creditsForm">' +
        '<label class="field"><span>Montant (négatif pour retirer)</span><input class="input" type="number" name="delta" step="1" value="10" required></label>' +
        '<label class="field"><span>Motif</span><input class="input" name="reason" maxlength="80" value="Ajustement administrateur"></label>' +
        '<p class="form-error" role="alert"></p>' +
        '<div class="modal-actions">' +
          '<button class="btn-ghost" type="button" data-modal-close>Annuler</button>' +
          '<button class="btn-primary" type="submit">Valider</button>' +
        "</div>" +
      "</form>"
    );

    const form = card.querySelector("form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const errEl = form.querySelector(".form-error");
      const btn = form.querySelector('[type="submit"]');
      errEl.textContent = "";
      setBusy(btn, true);
      try {
        const res = await BCApi.api("adminSetCredits", {
          userId: user.id,
          delta: Number(fd.get("delta")) || 0,
          reason: String(fd.get("reason") || "Ajustement administrateur")
        });
        App.userList = (App.userList || []).map((u) => u.id === res.user.id ? res.user : u);
        if (App.user && App.user.id === res.user.id) await refreshBootstrap();
        App.admin = null;
        closeModal();
        render("none");
        toast("Crédits mis à jour.");
      } catch (err) {
        errEl.textContent = err.message;
      } finally {
        setBusy(btn, false);
      }
    });
  }

  async function toggleRole(user) {
    const nextRole = user.role === "admin" ? "user" : "admin";
    const ok = await askConfirm({
      title: nextRole === "admin" ? "Nommer administrateur ?" : "Retirer le rôle admin ?",
      html: esc(user.name) + " " + (nextRole === "admin" ? "pourra gérer le contenu, les membres et les crédits." : "redeviendra un membre simple."),
      label: nextRole === "admin" ? "Nommer admin" : "Retirer"
    });
    if (!ok) return;
    try {
      const res = await BCApi.api("adminSetRole", { userId: user.id, role: nextRole });
      App.userList = (App.userList || []).map((u) => u.id === res.user.id ? res.user : u);
      if (App.user && App.user.id === res.user.id) {
        await refreshBootstrap();
        renderDrawer();
      }
      App.admin = null;
      render("none");
      toast("Rôle mis à jour.");
    } catch (err) {
      toast(err.message);
    }
  }

  async function toggleStatus(user) {
    const block = user.status !== "blocked";
    const ok = await askConfirm({
      title: block ? "Bloquer ce compte ?" : "Débloquer ce compte ?",
      html: esc(user.name) + (block ? " ne pourra plus se connecter ni débloquer d'épisodes." : " pourra de nouveau se connecter."),
      label: block ? "Bloquer" : "Débloquer",
      danger: block
    });
    if (!ok) return;
    try {
      const res = await BCApi.api("adminSetStatus", { userId: user.id, status: block ? "blocked" : "active" });
      App.userList = (App.userList || []).map((u) => u.id === res.user.id ? res.user : u);
      render("none");
      toast("Statut mis à jour.");
    } catch (err) {
      toast(err.message);
    }
  }

  async function importDemo() {
    const demo = window.BC_DEMO || { categories: [], tips: [], stories: [] };
    const ok = await askConfirm({
      title: "Importer le contenu de démonstration ?",
      text: "Les catégories, astuces et séries manquantes seront ajoutées. Le contenu existant est conservé.",
      label: "Importer"
    });
    if (!ok) return;
    try {
      const counts = await BCApi.api("adminImportDemo", {
        categories: demo.categories,
        tips: demo.tips,
        stories: demo.stories
      });
      const total = counts.categories + counts.tips + counts.stories;
      toast(total
        ? "Import terminé : " + counts.tips + " astuces, " + counts.stories + " séries, " + counts.episodes + " épisodes."
        : "Tout le contenu de démonstration est déjà présent.");
      invalidateAdmin();
      await refreshBootstrap();
      await showRoute("none");
    } catch (err) {
      toast(err.message);
    }
  }

  async function resetDemo() {
    const ok = await askConfirm({
      title: "Réinitialiser la démo ?",
      text: "Tous les comptes et modifications locales seront effacés.",
      label: "Réinitialiser",
      danger: true
    });
    if (!ok) return;
    try {
      await BCApi.api("adminResetDemo");
      BCApi.clearToken();
      location.reload();
    } catch (err) {
      toast(err.message);
    }
  }

  /* ---------------- Partage ---------------- */

  function copyText(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast("Partage copié");
    } catch (err) {
      toast("Copie impossible sur ce navigateur");
    }
    ta.remove();
  }

  async function sharePage(kind) {
    const cur = stack[stack.length - 1] || {};
    let item = null;
    if (kind === "tip") item = tipById(cur.params && cur.params.id);
    if (kind === "story") item = storyById(cur.params && cur.params.id);
    if (kind === "episode") {
      const story = storyById(cur.params && cur.params.storyId);
      const ep = episodeOf(story, cur.params && cur.params.n);
      item = ep && story ? Object.assign({}, ep, { storyId: story.id }) : null;
    }
    const data = {
      title: item ? item.title : document.title,
      text: item ? articleShareText(kind, item) : "Découvre BCréation — astuces et histoires.",
      url: item ? articleShareText(kind, item).split("Lire la suite : ")[1] : location.href
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch (err) { /* annulé */ }
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(data.text + (data.url ? "\n\n" + data.url : ""));
        toast("Partage copié");
        return;
      } catch (err) { /* continue */ }
    }
    copyText(data.text + (data.url ? "\n\n" + data.url : ""));
  }

  /* ---------------- Thème ---------------- */

  function applyTheme(value) {
    document.body.classList.toggle("dark", value === "dark");
    const sw = $("#themeToggle");
    if (sw) sw.setAttribute("aria-checked", value === "dark" ? "true" : "false");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", value === "dark" ? "#0d0c12" : "#f4f3f8");
  }

  let theme = "light";
  try { theme = localStorage.getItem(KEYS.theme) || ""; } catch (err) { theme = ""; }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /* ---------------- Événements globaux ---------------- */

  document.addEventListener("submit", (e) => {
    const form = e.target.closest("form[data-form]");
    if (!form) return;
    e.preventDefault();
    handleForm(form);
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-modal-close]")) return;
    const editorButton = e.target.closest("[data-editor]");
    if (editorButton) {
      const editor = editorButton.closest(".editor-shell") && editorButton.closest(".editor-shell").querySelector(".editor-content");
      if (editor) {
        const command = editorButton.dataset.editor;
        editor.focus();
        if (command === "bold") document.execCommand("bold");
        else if (command === "italic") document.execCommand("italic");
        else if (command === "title") document.execCommand("formatBlock", false, "h2");
        else if (command === "subtitle") document.execCommand("formatBlock", false, "h3");
        else if (command === "paragraph") document.execCommand("formatBlock", false, "p");
        else if (command === "list") document.execCommand("insertUnorderedList");
      }
      return;
    }

    const fav = e.target.closest("[data-fav]");
    if (fav) {
      e.stopPropagation();
      const parts = fav.dataset.fav.split(":");
      toggleFav(parts[0], parts[1]);
      return;
    }

    const unlocked = e.target.closest("[data-unlock]");
    if (unlocked) {
      e.preventDefault();
      const parts = unlocked.dataset.unlock.split(":");
      unlockFlow(parts[0], parseInt(parts[1], 10));
      return;
    }

    const locked = e.target.closest("[data-locked]");
    if (locked) {
      toast("Cet épisode arrive bientôt");
      return;
    }

    const ep = e.target.closest("[data-ep]");
    if (ep) {
      const parts = ep.dataset.ep.split(":");
      const sid = parts[0];
      const n = parseInt(parts[1], 10);
      const s = storyById(sid);
      const target = episodeOf(s, n);
      if (!s || !target) return;
      if (!target.published) {
        toast("Cet épisode arrive bientôt");
        return;
      }
      if (target.cost > 0 && !target.unlocked) {
        unlockFlow(sid, n);
        return;
      }
      if (stack[stack.length - 1].name === "episode") goEpisode(sid, n, "push");
      else navigate("episode", { storyId: sid, n: n }, "push");
      return;
    }

    const tip = e.target.closest("[data-tip]");
    if (tip) {
      const cur = stack[stack.length - 1];
      if (cur.name === "tip" && cur.params.id === tip.dataset.tip) return;
      navigate("tip", { id: tip.dataset.tip }, "push");
      return;
    }

    const storyEl = e.target.closest("[data-story]");
    if (storyEl) {
      const id = storyEl.dataset.story;
      const cur = stack[stack.length - 1];
      if (cur.name === "story" && cur.params.id === id) return;
      if (cur.name === "episode" && stack.length > 1 && stack[stack.length - 2].name === "story" && stack[stack.length - 2].params.id === id) {
        stack.pop();
        showRoute("pop");
      } else {
        navigate("story", { id: id }, "push");
      }
      return;
    }

    const courseLesson = e.target.closest("[data-course-lesson]");
    if (courseLesson) {
      const parts = courseLesson.dataset.courseLesson.split(":");
      navigate("courseLesson", { courseId: parts[0], n: Number(parts[1]) }, "push");
      return;
    }

    const courseEl = e.target.closest("[data-course]");
    if (courseEl) {
      const id = courseEl.dataset.course;
      const cur = stack[stack.length - 1];
      if (cur.name === "course" && cur.params.id === id) return;
      navigate("course", { id: id }, "push");
      return;
    }

    const chip = e.target.closest("[data-cat]");
    if (chip) {
      tipsCat = chip.dataset.cat;
      syncChips();
      refreshTipsList();
      return;
    }

    const gocat = e.target.closest("[data-gocat]");
    if (gocat) {
      tipsCat = gocat.dataset.gocat;
      tipsQuery = "";
      go("tips");
      return;
    }

    const share = e.target.closest("[data-share]");
    if (share) {
      sharePage(share.dataset.share);
      return;
    }

    const logoutBtn = e.target.closest("[data-logout]");
    if (logoutBtn) {
      logout();
      return;
    }

    const delTip = e.target.closest("[data-del-tip]");
    if (delTip) { deleteTip(delTip.dataset.delTip); return; }

    const delStory = e.target.closest("[data-del-story]");
    if (delStory) { deleteStory(delStory.dataset.delStory); return; }

    const delEp = e.target.closest("[data-del-ep]");
    if (delEp) {
      const parts = delEp.dataset.delEp.split(":");
      deleteEpisode(parts[0], parseInt(parts[1], 10));
      return;
    }

    const delCourse = e.target.closest("[data-del-course]");
    if (delCourse) { deleteCourse(delCourse.dataset.delCourse); return; }
    const delCourseLesson = e.target.closest("[data-del-course-lesson]");
    if (delCourseLesson) { const parts = delCourseLesson.dataset.delCourseLesson.split(":"); deleteCourseLesson(parts[0], Number(parts[1])); return; }

    const creditUser = e.target.closest("[data-credit-user]");
    if (creditUser) {
      const user = (App.userList || []).find((u) => u.id === creditUser.dataset.creditUser);
      if (user) openCreditsModal(user);
      return;
    }

    const roleUser = e.target.closest("[data-role-user]");
    if (roleUser) {
      const user = (App.userList || []).find((u) => u.id === roleUser.dataset.roleUser);
      if (user) toggleRole(user);
      return;
    }

    const statusUser = e.target.closest("[data-status-user]");
    if (statusUser) {
      const user = (App.userList || []).find((u) => u.id === statusUser.dataset.statusUser);
      if (user) toggleStatus(user);
      return;
    }

    if (e.target.closest("[data-import-demo]")) { importDemo(); return; }
    if (e.target.closest("[data-reset-demo]")) { resetDemo(); return; }
    if (e.target.closest("[data-retry]")) { retryLoad(); return; }

    const nav = e.target.closest("[data-nav]");
    if (nav) {
      const params = { id: nav.dataset.id };
      if (nav.dataset.n) params.n = parseInt(nav.dataset.n, 10);
      if (nav.dataset.course) params.course = true;
      go(nav.dataset.nav, params);
      return;
    }

    const goEl = e.target.closest("[data-go]");
    if (goEl) {
      go(goEl.dataset.go);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modalRoot.classList.contains("open")) closeModal();
      else closeDrawer();
    }
    if (e.key === "Enter" || e.key === " ") {
      const el = e.target.closest('[role="button"][data-tip], [role="button"][data-story], [role="button"][data-ep]');
      if (el) {
        e.preventDefault();
        el.click();
      }
    }
  });

  $("#menuBtn").addEventListener("click", openDrawer);
  overlay.addEventListener("click", closeDrawer);
  $("#backBtn").addEventListener("click", popView);

  $("#searchBtn").addEventListener("click", () => {
    tipsCat = "all";
    tipsQuery = "";
    go("tips");
    setTimeout(() => {
      const input = $("#tipSearch");
      if (input) input.focus();
    }, 340);
  });

  $("#themeToggle").addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEYS.theme, theme); } catch (err) { /* ignore */ }
    applyTheme(theme);
  });

  $("#readerPrev").addEventListener("click", () => {
    const cur = stack[stack.length - 1];
    if (cur.name !== "episode") return;
    const s = storyById(cur.params.storyId);
    const prev = adjacentEpisode(s, cur.params.n, -1);
    if (!prev) return;
    goEpisode(cur.params.storyId, prev.n, "pop");
  });

  $("#readerNext").addEventListener("click", () => {
    const cur = stack[stack.length - 1];
    if (cur.name !== "episode") return;
    const s = storyById(cur.params.storyId);
    const next = adjacentEpisode(s, cur.params.n, 1);
    if (!next) {
      toast("Tu es arrivé au bout de la série pour l'instant");
      return;
    }
    if (!next.published) {
      toast("L'épisode suivant arrive bientôt");
      return;
    }
    if (next.cost > 0 && !next.unlocked) {
      unlockFlow(s.id, next.n);
      return;
    }
    goEpisode(s.id, next.n, "push");
  });

  main.addEventListener("scroll", () => {
    if (document.body.classList.contains("reading")) updateReadProgress();
  }, { passive: true });

  window.addEventListener("resize", updateReadProgress);

  /* ---------------- Gestes (tiroir) ---------------- */

  let drag = null;

  shell.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (shell.classList.contains("drawer-open")) {
      drag = { mode: "drawer", x0: t.clientX, y0: t.clientY, dx: 0, dy: 0 };
    } else if (t.clientX <= 22) {
      drag = { mode: "edge", x0: t.clientX, y0: t.clientY, dx: 0, dy: 0 };
    }
  }, { passive: true });

  shell.addEventListener("touchmove", (e) => {
    if (!drag) return;
    const t = e.touches[0];
    const dx = t.clientX - drag.x0;
    const dy = t.clientY - drag.y0;
    drag.dx = dx;
    drag.dy = dy;
    if (drag.mode === "drawer" && dx < 0 && Math.abs(dx) > Math.abs(dy)) {
      drawer.style.transition = "none";
      drawer.style.transform = "translateX(" + dx + "px)";
      overlay.style.opacity = String(Math.max(0, 1 + dx / drawer.offsetWidth));
    }
  }, { passive: true });

  shell.addEventListener("touchend", () => {
    if (!drag) return;
    const { mode, dx, dy } = drag;
    drag = null;
    if (mode === "edge" && dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      openDrawer();
    } else if (mode === "drawer") {
      if (dx < -70) closeDrawer();
      else resetDrawerStyles();
    }
  });

  /* ---------------- Démarrage ---------------- */

  function routeFromLocation() {
    let source = location.protocol === "file:" ? String(location.hash || "").replace(/^#/, "") : location.pathname.replace(new RegExp("^" + appBasePath().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ""), "").replace(/^\//, "");
    if (!source || source === "index.html" || source === "index") source = "accueil";
    const parts = source.split("/").filter(Boolean).map((x) => decodeURIComponent(x));
    const root = { accueil: "home", astuces: "tips", histoires: "stories", "cours-informatiques": "courses", favoris: "favorites", profil: "profile", "a-propos": "about", connexion: "login", inscription: "signup" };
    if (!parts.length || root[parts[0]]) return { name: root[parts[0]] || "home", params: {} };
    if ((parts[0] === "astuce" || parts[0] === "tip") && parts[1]) return { name: "tip", params: { id: parts[1] } };
    if ((parts[0] === "histoire" || parts[0] === "story") && parts[1]) return { name: "story", params: { id: parts[1] } };
    if (parts[0] === "episode" && parts[1] && parts[2]) return { name: "episode", params: { storyId: parts[1], n: Number(parts[2]) } };
    if (parts[0] === "cours" && parts[1] && parts[2] === "lecon" && parts[3]) return { name: "courseLesson", params: { courseId: parts[1], n: Number(parts[3]) } };
    if (parts[0] === "cours" && parts[1]) return { name: "course", params: { id: parts[1] } };
    return { name: "home", params: {} };
  }

  async function boot() {
    applyTheme(theme);
    main.innerHTML = loadingHTML();
    try {
      await refreshBootstrap();
      renderDrawer();
      stack = [routeFromLocation()];
      render("none");
    } catch (err) {
      renderDrawer();
      renderLoadError(err);
    }
  }

  let retryLoad = boot;

  window.addEventListener("hashchange", () => {
    const next = routeFromLocation();
    const current = stack[stack.length - 1];
    if (current && routePath(current) === routePath(next)) return;
    stack = [next];
    showRoute("none");
  });

  applyTheme(theme);
  boot();
})();
