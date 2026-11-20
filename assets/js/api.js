/* ============================================================
   BCréation — couche API
   - API_URL vide  → mode démo local (localStorage)
   - API_URL rempli → backend Google Apps Script (/exec)
   ============================================================ */

(function () {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbyixiSXGDpT8HV3WeojC-dtjVYA5gIhy9sHto1aApMtc9UKtPZ_SZYU0dZETq8IO4DSOw/exec"; // ← colle ici l'URL /exec de ton déploiement Apps Script

  const TOKEN_KEY = "bcreation:token";
  const DB_KEY = "bcreation:mockdb:v2";
  const DEMO = !API_URL.trim();

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* ignore */ }
  }
  function clearToken() { setToken(""); }

  class ApiError extends Error {
    constructor(message, code) {
      super(message);
      this.name = "ApiError";
      this.code = code || "error";
    }
  }

  async function request(action, payload) {
    const body = Object.assign({}, payload || {}, { action, token: getToken() });
    let res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
        redirect: "follow"
      });
    } catch (err) {
      throw new ApiError("Impossible de joindre l'API. Vérifie ta connexion et l'URL de déploiement.", "network");
    }
    let json;
    try {
      json = await res.json();
    } catch (err) {
      throw new ApiError("Réponse invalide de l'API. Vérifie que le déploiement est accessible à « Tout le monde ».", "bad_response");
    }
    if (!json || !json.ok) {
      throw new ApiError((json && json.error) || "Une erreur est survenue.", (json && json.code) || "error");
    }
    return json.data;
  }

  /* ============================================================
     MODE DÉMO LOCAL
     ============================================================ */

  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

  function todayFR() {
    const d = new Date();
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function slugify(title) {
    return String(title).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42) || "element";
  }

  function demoHash(password, salt) {
    let h = 2166136261;
    const s = salt + "::" + password;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function demoSeed() {
    const src = window.BC_DEMO || { categories: [], tips: [], stories: [] };
    const cats = clone(src.categories);
    const tips = src.tips.map((t) => Object.assign(clone(t), {
      published: true,
      createdAt: "2026-11-01T10:00:00.000Z"
    }));
    const stories = src.stories.map((s) => Object.assign(clone(s), {
      published: true,
      createdAt: "2026-11-01T10:00:00.000Z",
      episodes: s.episodes.map((ep) => ({
        n: ep.n,
        title: ep.title,
        minutes: ep.minutes || 5,
        date: ep.date || todayFR(),
        body: ep.body || [],
        published: !ep.locked,
        cost: 0
      }))
    }));

    const salt = "demo-salt";
    return {
      version: 2,
      users: [{
        id: "u_admin_demo",
        email: "admin@demo.local",
        name: "Admin démo",
        passwordHash: demoHash("admin1234", salt),
        salt: salt,
        role: "admin",
        credits: 100,
        bio: "Compte administrateur du mode démo local.",
        status: "active",
        createdAt: "2026-11-01T09:00:00.000Z"
      }],
      sessions: {},
      categories: cats,
      tips: tips,
      stories: stories,
      credits: [{
        id: "c_seed", date: "2026-11-01T09:00:00.000Z", userId: "u_admin_demo",
        delta: 100, reason: "Crédits de démonstration", balance: 100
      }],
      unlocks: [],
      settings: { welcomeCredits: 10 }
    };
  }

  let db = null;

  function loadDB() {
    if (db) return db;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        db = JSON.parse(raw);
        if (!db || !Array.isArray(db.users) || !Array.isArray(db.tips)) db = demoSeed();
      } else {
        db = demoSeed();
      }
    } catch (e) {
      db = demoSeed();
    }
    return db;
  }

  function saveDB() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  }

  function resetDB() {
    db = demoSeed();
    saveDB();
    return db;
  }

  function delay(ms) { return new Promise((r) => setTimeout(r, ms || 140)); }

  function publicUser(u) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === "admin" ? "admin" : "user",
      credits: Number(u.credits) || 0,
      bio: u.bio || "",
      createdAt: u.createdAt,
      status: u.status || "active"
    };
  }

  function me(token) {
    const d = loadDB();
    const userId = d.sessions[token];
    if (!userId) return null;
    return d.users.find((u) => u.id === userId && u.status !== "blocked") || null;
  }

  function needMe(token) {
    const u = me(token);
    if (!u) throw new ApiError("Connecte-toi pour continuer.", "unauthorized");
    return u;
  }

  function needAdmin(token) {
    const u = needMe(token);
    if (u.role !== "admin") throw new ApiError("Accès administrateur requis.", "forbidden");
    return u;
  }

  function logCredit(userId, delta, reason, balance) {
    const d = loadDB();
    d.credits.push({
      id: uid("c"),
      date: new Date().toISOString(),
      userId: userId,
      delta: delta,
      reason: reason,
      balance: balance
    });
  }

  function findUserByEmail(email) {
    const d = loadDB();
    return d.users.find((u) => u.email.toLowerCase() === email) || null;
  }

  function sessionFor(userId) {
    const token = uid("demo_token");
    loadDB().sessions[token] = userId;
    saveDB();
    return token;
  }

  function uniqueTipId(title) {
    const d = loadDB();
    const base = slugify(title);
    let id = base;
    let i = 2;
    while (d.tips.some((t) => t.id === id)) { id = base + "-" + i; i++; }
    return id;
  }

  function uniqueStoryId(title) {
    const d = loadDB();
    const base = slugify(title);
    let id = base;
    let i = 2;
    while (d.stories.some((s) => s.id === id)) { id = base + "-" + i; i++; }
    return id;
  }

  function unlocksOf(userId) {
    const set = new Set();
    loadDB().unlocks.filter((u) => u.userId === userId)
      .forEach((u) => set.add(u.storyId + ":" + u.n));
    return set;
  }

  function tipOut(t) {
    return {
      id: t.id, cat: t.cat, title: t.title, excerpt: t.excerpt || "",
      minutes: Number(t.minutes) || 3, date: t.date, author: t.author || "BCréation",
      featured: !!t.featured, published: t.published !== false, body: clone(t.body || [])
    };
  }

  function episodeOut(ep, unlockedSet, isAdmin) {
    const published = !!ep.published;
    const cost = Number(ep.cost) || 0;
    const unlocked = isAdmin || cost === 0 || unlockedSet.has(ep._key || "");
    const out = {
      n: ep.n, title: ep.title, minutes: Number(ep.minutes) || 5, date: ep.date,
      published: published, cost: cost, unlocked: unlocked
    };
    if (published && unlocked) out.body = clone(ep.body || []);
    return out;
  }

  function bootstrapDemo(token) {
    const d = loadDB();
    const user = token ? me(token) : null;
    const isAdmin = user && user.role === "admin";
    const unlockedSet = user ? unlocksOf(user.id) : new Set();

    const categories = clone(d.categories).sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
    const tips = d.tips.filter((t) => t.published !== false)
      .slice()
      .sort((a, b) => {
        const fa = a.featured ? 1 : 0;
        const fb = b.featured ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      })
      .map(tipOut);

    const stories = d.stories.filter((s) => s.published !== false)
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((s) => {
        const episodes = (s.episodes || []).slice()
          .sort((a, b) => a.n - b.n)
          .map((ep) => {
            const copy = Object.assign({}, ep, { _key: s.id + ":" + ep.n });
            return episodeOut(copy, unlockedSet, isAdmin);
          });
        return {
          id: s.id, title: s.title, tagline: s.tagline, author: s.author,
          genre: s.genre, status: s.status || "En cours",
          letter: s.letter || String(s.title).charAt(0).toUpperCase(),
          colors: s.colors || ["#ff7a9c", "#7c3aed"],
          synopsis: s.synopsis || "",
          episodes: episodes
        };
      });

    return {
      settings: { appName: "BCréation", welcomeCredits: Number(d.settings.welcomeCredits) || 10 },
      user: user ? publicUser(user) : null,
      categories: categories,
      tips: tips,
      stories: stories
    };
  }

  const Demo = {
    async handle(action, payload) {
      await delay();
      const body = payload || {};
      const token = getToken();
      const d = loadDB();

      switch (action) {
        case "bootstrap":
          return bootstrapDemo(token);

        case "signup": {
          const email = String(body.email || "").trim().toLowerCase();
          const name = String(body.name || "").trim();
          const password = String(body.password || "");
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ApiError("Adresse e-mail invalide.", "validation");
          if (name.length < 2) throw new ApiError("Indique un prénom ou un pseudo (2 caractères minimum).", "validation");
          if (password.length < 6) throw new ApiError("Le mot de passe doit contenir au moins 6 caractères.", "validation");
          if (findUserByEmail(email)) throw new ApiError("Un compte existe déjà avec cette adresse.", "email_taken");
          const welcome = Number(d.settings.welcomeCredits) || 10;
          const salt = uid("salt");
          const user = {
            id: uid("u"), email: email, name: name,
            passwordHash: demoHash(password, salt), salt: salt,
            role: "user", credits: welcome, bio: "", status: "active",
            createdAt: new Date().toISOString()
          };
          d.users.push(user);
          logCredit(user.id, welcome, "Bonus de bienvenue", welcome);
          const newToken = sessionFor(user.id);
          saveDB();
          return { token: newToken, user: publicUser(user), welcomeCredits: welcome };
        }

        case "login": {
          const email = String(body.email || "").trim().toLowerCase();
          const password = String(body.password || "");
          const user = findUserByEmail(email);
          if (!user || demoHash(password, user.salt) !== user.passwordHash) {
            throw new ApiError("E-mail ou mot de passe incorrect.", "invalid_credentials");
          }
          if (user.status === "blocked") throw new ApiError("Ce compte est bloqué.", "blocked");
          const newToken = sessionFor(user.id);
          return { token: newToken, user: publicUser(user) };
        }

        case "logout": {
          if (token) { delete d.sessions[token]; saveDB(); }
          return { ok: true };
        }

        case "profile": {
          const user = needMe(token);
          const history = d.credits.filter((c) => c.userId === user.id)
            .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .slice(0, 25)
            .map((c) => ({ date: c.date, delta: c.delta, reason: c.reason, balance: c.balance }));
          const unlocks = d.unlocks.filter((u) => u.userId === user.id)
            .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .map((u) => {
              const story = d.stories.find((s) => s.id === u.storyId);
              return {
                storyId: u.storyId, n: u.n, cost: u.cost, date: u.date,
                storyTitle: story ? story.title : ""
              };
            });
          return { user: publicUser(user), history: history, unlocks: unlocks };
        }

        case "updateProfile": {
          const user = needMe(token);
          const name = String(body.name || "").trim();
          const bio = String(body.bio || "").trim();
          if (name.length < 2) throw new ApiError("Le nom doit contenir au moins 2 caractères.", "validation");
          if (bio.length > 240) throw new ApiError("La bio est limitée à 240 caractères.", "validation");
          user.name = name;
          user.bio = bio;
          saveDB();
          return { user: publicUser(user) };
        }

        case "changePassword": {
          const user = needMe(token);
          const current = String(body.current || "");
          const next = String(body.next || "");
          if (demoHash(current, user.salt) !== user.passwordHash) throw new ApiError("Mot de passe actuel incorrect.", "invalid_credentials");
          if (next.length < 6) throw new ApiError("Le nouveau mot de passe doit contenir au moins 6 caractères.", "validation");
          user.salt = uid("salt");
          user.passwordHash = demoHash(next, user.salt);
          saveDB();
          return { ok: true };
        }

        case "unlockEpisode": {
          const user = needMe(token);
          const storyId = String(body.storyId || "");
          const n = Number(body.n);
          const story = d.stories.find((s) => s.id === storyId);
          if (!story) throw new ApiError("Série introuvable.", "notfound");
          const ep = (story.episodes || []).find((e) => Number(e.n) === n);
          if (!ep || !ep.published) throw new ApiError("Cet épisode n'est pas encore disponible.", "notfound");
          const cost = Number(ep.cost) || 0;
          if (cost <= 0) throw new ApiError("Cet épisode est déjà accessible.", "validation");
          const already = d.unlocks.some((u) => u.userId === user.id && u.storyId === storyId && Number(u.n) === n);
          if (!already) {
            const balance = Number(user.credits) || 0;
            if (balance < cost) throw new ApiError("Crédits insuffisants pour cet épisode.", "insufficient_credits");
            user.credits = balance - cost;
            d.unlocks.push({
              id: uid("un"), date: new Date().toISOString(), userId: user.id,
              storyId: storyId, n: n, cost: cost
            });
            logCredit(user.id, -cost, "Déblocage — " + story.title + " · épisode " + n, user.credits);
            saveDB();
          }
          const episode = episodeOut(Object.assign({}, ep, { _key: storyId + ":" + n }), new Set([storyId + ":" + n]), false);
          return { user: publicUser(user), episode: episode };
        }

        case "adminStats": {
          needAdmin(token);
          const active = d.users.filter((u) => u.status !== "blocked").length;
          const recent = d.users.slice()
            .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
            .slice(0, 5)
            .map((u) => ({ name: u.name, email: u.email, createdAt: u.createdAt }));
          return {
            users: d.users.length,
            activeUsers: active,
            tips: d.tips.length,
            publishedTips: d.tips.filter((t) => t.published !== false).length,
            stories: d.stories.length,
            episodes: d.stories.reduce((n, s) => n + (s.episodes || []).length, 0),
            premiumEpisodes: d.stories.reduce((n, s) => n + (s.episodes || []).filter((e) => Number(e.cost) > 0).length, 0),
            credits: d.users.reduce((n, u) => n + (Number(u.credits) || 0), 0),
            recentSignups: recent
          };
        }

        case "adminUsers": {
          needAdmin(token);
          return d.users.slice()
            .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
            .map((u) => publicUser(u));
        }

        case "adminSetCredits": {
          const admin = needAdmin(token);
          const target = d.users.find((u) => u.id === body.userId);
          if (!target) throw new ApiError("Utilisateur introuvable.", "notfound");
          const delta = Number(body.delta) || 0;
          if (!delta) throw new ApiError("Indique un montant différent de zéro.", "validation");
          const balance = (Number(target.credits) || 0) + delta;
          if (balance < 0) throw new ApiError("Le solde ne peut pas devenir négatif.", "validation");
          if (target.id === admin.id && delta < 0 && balance < 0) throw new ApiError("Solde invalide.", "validation");
          target.credits = balance;
          logCredit(target.id, delta, String(body.reason || "Ajustement administrateur"), balance);
          saveDB();
          return { user: publicUser(target) };
        }

        case "adminSetRole": {
          const admin = needAdmin(token);
          const target = d.users.find((u) => u.id === body.userId);
          if (!target) throw new ApiError("Utilisateur introuvable.", "notfound");
          const role = body.role === "admin" ? "admin" : "user";
          if (target.id === admin.id && role !== "admin") throw new ApiError("Tu ne peux pas retirer ton propre rôle admin.", "validation");
          target.role = role;
          saveDB();
          return { user: publicUser(target) };
        }

        case "adminSetStatus": {
          const admin = needAdmin(token);
          const target = d.users.find((u) => u.id === body.userId);
          if (!target) throw new ApiError("Utilisateur introuvable.", "notfound");
          const status = body.status === "blocked" ? "blocked" : "active";
          if (target.id === admin.id && status === "blocked") throw new ApiError("Tu ne peux pas bloquer ton propre compte.", "validation");
          target.status = status;
          if (status === "blocked") {
            Object.keys(d.sessions).forEach((t) => {
              if (d.sessions[t] === target.id) delete d.sessions[t];
            });
          }
          saveDB();
          return { user: publicUser(target) };
        }

        case "adminTips": {
          needAdmin(token);
          return d.tips.slice()
            .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
            .map(tipOut);
        }

        case "adminSaveTip": {
          const admin = needAdmin(token);
          const tip = body.tip || {};
          const title = String(tip.title || "").trim();
          if (title.length < 4) throw new ApiError("Le titre doit contenir au moins 4 caractères.", "validation");
          if (!d.categories.some((c) => c.id === tip.cat)) throw new ApiError("Catégorie invalide.", "validation");
          const date = String(tip.date || "").trim() || todayFR();
          const existing = tip.id ? d.tips.find((t) => t.id === tip.id) : null;
          if (existing) {
            existing.cat = tip.cat;
            existing.title = title;
            existing.excerpt = String(tip.excerpt || "").trim();
            existing.minutes = Math.max(1, Number(tip.minutes) || 3);
            existing.date = date;
            existing.author = String(tip.author || admin.name || "BCréation").trim();
            existing.featured = !!tip.featured;
            existing.published = tip.published !== false;
            existing.body = clone(Array.isArray(tip.body) ? tip.body : []);
            saveDB();
            return tipOut(existing);
          }
          const created = {
            id: uniqueTipId(title), cat: tip.cat, title: title,
            excerpt: String(tip.excerpt || "").trim(),
            minutes: Math.max(1, Number(tip.minutes) || 3),
            date: date, author: String(tip.author || admin.name || "BCréation").trim(),
            featured: !!tip.featured, published: tip.published !== false,
            body: clone(Array.isArray(tip.body) ? tip.body : []),
            createdAt: new Date().toISOString()
          };
          d.tips.push(created);
          saveDB();
          return tipOut(created);
        }

        case "adminDeleteTip": {
          needAdmin(token);
          d.tips = d.tips.filter((t) => t.id !== body.id);
          saveDB();
          return { ok: true };
        }

        case "adminStories": {
          needAdmin(token);
          return d.stories.slice()
            .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
            .map((s) => ({
              id: s.id, title: s.title, tagline: s.tagline, author: s.author,
              genre: s.genre, status: s.status, letter: s.letter,
              colors: s.colors || ["#ff7a9c", "#7c3aed"],
              synopsis: s.synopsis || "", published: s.published !== false,
              episodes: (s.episodes || []).slice().sort((a, b) => a.n - b.n).map((e) => ({
                n: e.n, title: e.title, minutes: e.minutes, date: e.date,
                published: !!e.published, cost: Number(e.cost) || 0, body: clone(e.body || [])
              }))
            }));
        }

        case "adminSaveStory": {
          const admin = needAdmin(token);
          const s = body.story || {};
          const title = String(s.title || "").trim();
          if (title.length < 3) throw new ApiError("Le titre doit contenir au moins 3 caractères.", "validation");
          const colors = Array.isArray(s.colors) ? s.colors : [];
          const existing = s.id ? d.stories.find((x) => x.id === s.id) : null;
          const data = {
            title: title,
            tagline: String(s.tagline || "").trim(),
            author: String(s.author || admin.name || "BCréation").trim(),
            genre: String(s.genre || "Romance").trim(),
            status: String(s.status || "En cours").trim(),
            letter: String(s.letter || title.charAt(0)).charAt(0).toUpperCase(),
            colors: [colors[0] || "#ff7a9c", colors[1] || "#7c3aed"],
            synopsis: String(s.synopsis || "").trim(),
            published: s.published !== false
          };
          if (existing) {
            Object.assign(existing, data);
            saveDB();
            return Object.assign({}, data, { id: existing.id, episodes: clone(existing.episodes || []) });
          }
          const created = Object.assign({ id: uniqueStoryId(title), createdAt: new Date().toISOString(), episodes: [] }, data);
          d.stories.push(created);
          saveDB();
          return Object.assign({}, data, { id: created.id, episodes: [] });
        }

        case "adminDeleteStory": {
          needAdmin(token);
          d.stories = d.stories.filter((s) => s.id !== body.id);
          d.unlocks = d.unlocks.filter((u) => u.storyId !== body.id);
          saveDB();
          return { ok: true };
        }

        case "adminSaveEpisode": {
          needAdmin(token);
          const e = body.episode || {};
          const story = d.stories.find((s) => s.id === e.storyId);
          if (!story) throw new ApiError("Série introuvable.", "notfound");
          const title = String(e.title || "").trim();
          if (title.length < 2) throw new ApiError("Le titre de l'épisode est trop court.", "validation");
          story.episodes = story.episodes || [];
          let n = Number(e.n) || 0;
          if (!n) n = story.episodes.reduce((max, x) => Math.max(max, Number(x.n) || 0), 0) + 1;
          const data = {
            n: n, title: title,
            minutes: Math.max(1, Number(e.minutes) || 5),
            date: String(e.date || todayFR()).trim(),
            body: clone(Array.isArray(e.body) ? e.body : []),
            published: !!e.published,
            cost: Math.max(0, Number(e.cost) || 0)
          };
          const existing = story.episodes.find((x) => Number(x.n) === n);
          if (existing) Object.assign(existing, data);
          else story.episodes.push(data);
          saveDB();
          return clone(data);
        }

        case "adminDeleteEpisode": {
          needAdmin(token);
          const story = d.stories.find((s) => s.id === body.storyId);
          if (story) {
            story.episodes = (story.episodes || []).filter((e) => Number(e.n) !== Number(body.n));
          }
          d.unlocks = d.unlocks.filter((u) => !(u.storyId === body.storyId && Number(u.n) === Number(body.n)));
          saveDB();
          return { ok: true };
        }

        case "adminSettings": {
          const admin = needAdmin(token);
          return {
            welcomeCredits: Number(d.settings.welcomeCredits) || 10,
            spreadsheetUrl: "Mode démo local — aucune base Google Sheets connectée.",
            adminEmail: admin.email
          };
        }

        case "adminSaveSettings": {
          needAdmin(token);
          const welcome = Math.max(0, Number(body.welcomeCredits) || 0);
          d.settings.welcomeCredits = welcome;
          saveDB();
          return { welcomeCredits: welcome };
        }

        case "adminImportDemo": {
          needAdmin(token);
          const counts = { categories: 0, tips: 0, stories: 0, episodes: 0 };
          (body.categories || []).forEach((c) => {
            if (!c.id || d.categories.some((x) => x.id === c.id)) return;
            d.categories.push({
              id: c.id, name: c.name || c.id, icon: c.icon || "grid",
              color: c.color || "#6c5ce7", ordre: Number(c.ordre) || 99
            });
            counts.categories++;
          });
          (body.tips || []).forEach((t) => {
            if (!t.id || d.tips.some((x) => x.id === t.id)) return;
            d.tips.push(Object.assign({}, clone(t), {
              published: true,
              createdAt: new Date().toISOString()
            }));
            counts.tips++;
          });
          (body.stories || []).forEach((s) => {
            if (!s.id || d.stories.some((x) => x.id === s.id)) return;
            const story = Object.assign({}, clone(s), {
              published: true,
              createdAt: new Date().toISOString(),
              episodes: []
            });
            (s.episodes || []).forEach((ep) => {
              if (!ep.n) return;
              story.episodes.push({
                n: ep.n, title: ep.title || ("Épisode " + ep.n),
                minutes: ep.minutes || 5, date: ep.date || todayFR(),
                body: clone(ep.body || []),
                published: !ep.locked, cost: 0
              });
              counts.episodes++;
            });
            d.stories.push(story);
            counts.stories++;
          });
          saveDB();
          return counts;
        }

        case "adminResetDemo": {
          needAdmin(token);
          resetDB();
          return { ok: true };
        }

        default:
          throw new ApiError("Action inconnue : " + action, "unknown_action");
      }
    }
  };

  /* ============================================================
     API PUBLIQUE
     ============================================================ */

  async function api(action, payload) {
    if (DEMO) return Demo.handle(action, payload);
    return request(action, payload);
  }

  window.BCApi = {
    isDemo: DEMO,
    apiUrl: API_URL,
    api: api,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    resetDemo: function () {
      db = null;
      try { localStorage.removeItem(DB_KEY); localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
      db = loadDB();
    }
  };
})();
