/**
 * ============================================================
 * BCréation — Backend Google Sheets (Google Apps Script)
 * ============================================================
 * Ce fichier est l'API de l'application. Il gère :
 *   - la base Google Sheets (création automatique du classeur)
 *   - l'inscription / connexion (mots de passe hachés, sessions)
 *   - les crédits (10 offerts à l'inscription, déblocage d'épisodes)
 *   - le contenu (astuces, catégories, séries, épisodes)
 *   - le dashboard administrateur (stats, CRUD, utilisateurs)
 *
 * INSTALLATION : voir GUIDE-GOOGLE-SHEETS.md à la racine du projet.
 * ============================================================
 */

var CONFIG = {
  // Laisser vide pour que setup() crée automatiquement un classeur.
  // Sinon, coller l'ID du Google Sheet existant.
  SPREADSHEET_ID: "",

  // Compte administrateur créé par setup(). CHANGEZ CES VALEURS.
  ADMIN_EMAIL: "admin@bcreation.app",
  ADMIN_PASSWORD: "Bcreation2026!",

  WELCOME_CREDITS: 10,
  SESSION_DAYS: 30,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_MINUTES: 10
};

var SCHEMA = {
  Users: ["id", "email", "name", "passwordHash", "salt", "role", "credits", "bio", "status", "failedAttempts", "lockedUntil", "createdAt", "lastLogin"],
  Sessions: ["token", "userId", "createdAt", "expiresAt"],
  Categories: ["id", "name", "icon", "color", "ordre"],
  Tips: ["id", "cat", "title", "excerpt", "minutes", "date", "author", "featured", "published", "imageUrl", "body", "createdAt", "updatedAt"],
  Series: ["id", "title", "tagline", "author", "genre", "status", "letter", "color1", "color2", "synopsis", "published", "imageUrl", "createdAt"],
  Episodes: ["id", "storyId", "n", "title", "minutes", "date", "body", "published", "cost", "imageUrl", "createdAt"],
  Courses: ["id", "title", "description", "imageUrl", "published", "createdAt", "updatedAt"],
  CourseLessons: ["id", "courseId", "n", "title", "body", "published", "createdAt", "updatedAt"],
  Credits: ["id", "date", "userId", "delta", "reason", "balance"],
  Unlocks: ["id", "date", "userId", "storyId", "episodeN", "cost"],
  Settings: ["key", "value"]
};

var SEED_CATEGORIES = [
  { id: "reseau", name: "Réseaux & Wi-Fi", icon: "wifi", color: "#0ea5e9", ordre: 1 },
  { id: "securite", name: "Sécurité", icon: "shield", color: "#ef4444", ordre: 2 },
  { id: "windows", name: "Windows & PC", icon: "monitor", color: "#6366f1", ordre: 3 },
  { id: "mobile", name: "Smartphone", icon: "phone", color: "#10b981", ordre: 4 },
  { id: "web", name: "Web & Dev", icon: "code", color: "#8b5cf6", ordre: 5 },
  { id: "bureautique", name: "Bureautique", icon: "grid", color: "#f59e0b", ordre: 6 }
];

/* ---------------- Point d'entrée HTTP ---------------- */

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = String(body.action || "");
    var fn = ACTIONS[action];
    if (!fn) fail_("Action inconnue : " + action, "unknown_action");

    var data;
    if (READ_ACTIONS[action]) {
      data = fn(body, body.token || "");
    } else {
      var lock = LockService.getScriptLock();
      if (lock.tryLock(15000)) {
        try { data = fn(body, body.token || ""); }
        finally { lock.releaseLock(); }
      } else {
        fail_("Le serveur est occupé, réessaie dans un instant.", "busy");
      }
    }
    return jsonOut_({ ok: true, data: data });
  } catch (err) {
    return jsonOut_({
      ok: false,
      error: err && err.message ? err.message : String(err),
      code: err && err.code ? err.code : "error"
    });
  }
}

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";
  if (action === "health") {
    return jsonOut_({ ok: true, data: { status: "ok", time: new Date().toISOString(), version: "1.0" } });
  }
  return jsonOut_({
    ok: false,
    error: "API BCréation : utilise une requête POST JSON.",
    code: "method_not_allowed"
  });
}

var READ_ACTIONS = {
  bootstrap: true,
  login: false,
  signup: false,
  profile: true,
  health: true
};

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Actions ---------------- */

var ACTIONS = {
  bootstrap: actionBootstrap_,
  signup: actionSignup_,
  login: actionLogin_,
  logout: actionLogout_,
  profile: actionProfile_,
  updateProfile: actionUpdateProfile_,
  changePassword: actionChangePassword_,
  unlockEpisode: actionUnlockEpisode_,

  adminStats: actionAdminStats_,
  adminUsers: actionAdminUsers_,
  adminSetCredits: actionAdminSetCredits_,
  adminSetRole: actionAdminSetRole_,
  adminSetStatus: actionAdminSetStatus_,
  adminTips: actionAdminTips_,
  adminSaveTip: actionAdminSaveTip_,
  adminDeleteTip: actionAdminDeleteTip_,
  adminStories: actionAdminStories_,
  adminSaveStory: actionAdminSaveStory_,
  adminDeleteStory: actionAdminDeleteStory_,
  adminSaveEpisode: actionAdminSaveEpisode_,
  adminDeleteEpisode: actionAdminDeleteEpisode_,
  adminCourses: actionAdminCourses_,
  adminSaveCourse: actionAdminSaveCourse_,
  adminDeleteCourse: actionAdminDeleteCourse_,
  adminSaveCourseLesson: actionAdminSaveCourseLesson_,
  adminDeleteCourseLesson: actionAdminDeleteCourseLesson_,
  adminSettings: actionAdminSettings_,
  adminSaveSettings: actionAdminSaveSettings_,
  adminImportDemo: actionAdminImportDemo_
};

/* ---------------- Bootstrap / contenu public ---------------- */

function actionBootstrap_(body, token) {
  ensureReady_();
  var user = token ? sessionUser_(token, false) : null;
  var cats = readTable_("Categories").sort(function (a, b) { return num_(a.ordre, 99) - num_(b.ordre, 99); });
  var tips = readTable_("Tips").filter(function (t) { return bool_(t.published); });
  tips.sort(function (a, b) {
    var fa = bool_(a.featured) ? 1 : 0;
    var fb = bool_(b.featured) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  var stories = readTable_("Series").filter(function (s) { return bool_(s.published); });
  stories.sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });

  var episodes = readTable_("Episodes");
  var unlocks = user ? readTable_("Unlocks").filter(function (u) { return u.userId === user.id; }) : [];
  var unlockedMap = {};
  unlocks.forEach(function (u) { unlockedMap[u.storyId + ":" + num_(u.episodeN, 0)] = true; });
  var isAdmin = user && user.role === "admin";

  var storiesOut = stories.map(function (s) {
    var eps = episodes.filter(function (ep) { return ep.storyId === s.id; })
      .sort(function (a, b) { return num_(a.n, 0) - num_(b.n, 0); })
      .map(function (ep) {
        return episodeOut_(s.id, ep, unlockedMap, isAdmin);
      });
    return {
      id: s.id,
      title: s.title,
      tagline: s.tagline,
      author: s.author,
      genre: s.genre,
      status: s.status || "En cours",
      letter: s.letter || String(s.title || "?").charAt(0).toUpperCase(),
      colors: [s.color1 || "#ff7a9c", s.color2 || "#7c3aed"],
      synopsis: s.synopsis,
      image: s.imageUrl || "",
      episodes: eps
    };
  });

  var lessons = readTable_("CourseLessons");
  var courses = readTable_("Courses").filter(function (c) { return bool_(c.published); })
    .sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); })
    .map(function (c) {
      return {
        id: c.id,
        title: c.title,
        description: c.description || "",
        image: c.imageUrl || "",
        lessons: lessons.filter(function (l) { return l.courseId === c.id; })
          .sort(function (a, b) { return num_(a.n, 0) - num_(b.n, 0); })
          .map(function (l) { return { n: num_(l.n, 0), title: l.title, body: json_(l.body, []), published: bool_(l.published) }; })
      };
    });

  return {
    settings: {
      appName: "BCréation",
      welcomeCredits: num_(setting_("welcomeCredits", CONFIG.WELCOME_CREDITS), CONFIG.WELCOME_CREDITS)
    },
    user: user ? publicUser_(user) : null,
    categories: cats.map(function (c) {
      return { id: c.id, name: c.name, icon: c.icon || "grid", color: c.color || "#6c5ce7" };
    }),
    tips: tips.map(function (t) { return tipOut_(t); }),
    stories: storiesOut,
    courses: courses
  };
}

function tipOut_(t) {
  return {
    id: t.id,
    cat: t.cat,
    title: t.title,
    excerpt: t.excerpt,
    minutes: num_(t.minutes, 3),
    date: t.date,
    author: t.author || "BCréation",
    featured: bool_(t.featured),
    published: bool_(t.published),
    image: t.imageUrl || "",
    body: json_(t.body, [])
  };
}

function episodeOut_(storyId, ep, unlockedMap, isAdmin) {
  var published = bool_(ep.published);
  var cost = num_(ep.cost, 0);
  var unlocked = cost === 0 || !!unlockedMap[storyId + ":" + num_(ep.n, 0)] || !!isAdmin;
  var out = {
    n: num_(ep.n, 0),
    title: ep.title,
    minutes: num_(ep.minutes, 5),
    date: ep.date,
    published: published,
    cost: cost,
    image: ep.imageUrl || "",
    unlocked: !!unlocked
  };
  if (published && unlocked) out.body = json_(ep.body, []);
  return out;
}

/* ---------------- Authentification ---------------- */

function actionSignup_(body) {
  ensureReady_();
  var email = String(body.email || "").trim().toLowerCase();
  var name = String(body.name || "").trim();
  var password = String(body.password || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail_("Adresse e-mail invalide.", "validation");
  if (name.length < 2) fail_("Indique un prénom ou un pseudo (2 caractères minimum).", "validation");
  if (password.length < 6) fail_("Le mot de passe doit contenir au moins 6 caractères.", "validation");
  if (findUserByEmail_(email)) fail_("Un compte existe déjà avec cette adresse.", "email_taken");

  var salt = Utilities.getUuid();
  var welcome = num_(setting_("welcomeCredits", CONFIG.WELCOME_CREDITS), CONFIG.WELCOME_CREDITS);
  var user = {
    id: uid_("u"),
    email: email,
    name: name,
    passwordHash: hashPassword_(password, salt),
    salt: salt,
    role: "user",
    credits: welcome,
    bio: "",
    status: "active",
    failedAttempts: 0,
    lockedUntil: "",
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
  append_("Users", user);
  creditLog_(user.id, welcome, "Bonus de bienvenue", welcome);

  var token = createSession_(user.id);
  return { token: token, user: publicUser_(user), welcomeCredits: welcome };
}

function actionLogin_(body) {
  ensureReady_();
  var email = String(body.email || "").trim().toLowerCase();
  var password = String(body.password || "");
  var record = findUserByEmail_(email);
  if (!record) fail_("E-mail ou mot de passe incorrect.", "invalid_credentials");
  if (record.status === "blocked") fail_("Ce compte est bloqué. Contacte l'administrateur.", "blocked");

  var lockedUntil = record.lockedUntil ? new Date(record.lockedUntil).getTime() : 0;
  if (lockedUntil && lockedUntil > Date.now()) {
    fail_("Trop de tentatives. Réessaie dans quelques minutes.", "locked");
  }

  var expected = hashPassword_(password, record.salt);
  if (expected !== record.passwordHash) {
    var attempts = num_(record.failedAttempts, 0) + 1;
    var patch = { failedAttempts: attempts };
    if (attempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
      patch.lockedUntil = new Date(Date.now() + CONFIG.LOCK_MINUTES * 60000).toISOString();
      patch.failedAttempts = 0;
    }
    update_("Users", record._row, patch);
    fail_("E-mail ou mot de passe incorrect.", "invalid_credentials");
  }

  update_("Users", record._row, { failedAttempts: 0, lockedUntil: "", lastLogin: new Date().toISOString() });
  record.failedAttempts = 0;
  var token = createSession_(record.id);
  return { token: token, user: publicUser_(record) };
}

function actionLogout_(body, token) {
  ensureReady_();
  if (token) {
    deleteWhere_("Sessions", function (s) { return s.token === token; });
  }
  return { ok: true };
}

function actionProfile_(body, token) {
  var user = sessionUser_(token, true);
  var history = readTable_("Credits")
    .filter(function (c) { return c.userId === user.id; })
    .sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); })
    .slice(0, 25)
    .map(function (c) {
      return { date: c.date, delta: num_(c.delta, 0), reason: c.reason, balance: num_(c.balance, 0) };
    });
  var stories = readTable_("Series");
  var storyMap = {};
  stories.forEach(function (s) { storyMap[s.id] = s.title; });
  var unlocks = readTable_("Unlocks")
    .filter(function (u) { return u.userId === user.id; })
    .sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); })
    .map(function (u) {
      return {
        storyId: u.storyId,
        n: num_(u.episodeN, 0),
        storyTitle: storyMap[u.storyId] || "",
        cost: num_(u.cost, 0),
        date: u.date
      };
    });
  return { user: publicUser_(user), history: history, unlocks: unlocks };
}

function actionUpdateProfile_(body, token) {
  var user = sessionUser_(token, true);
  var name = String(body.name || "").trim();
  var bio = String(body.bio || "").trim();
  if (name.length < 2) fail_("Le nom doit contenir au moins 2 caractères.", "validation");
  if (bio.length > 240) fail_("La bio est limitée à 240 caractères.", "validation");
  update_("Users", user._row, { name: name, bio: bio });
  user.name = name;
  user.bio = bio;
  return { user: publicUser_(user) };
}

function actionChangePassword_(body, token) {
  var user = sessionUser_(token, true);
  var current = String(body.current || "");
  var next = String(body.next || "");
  if (hashPassword_(current, user.salt) !== user.passwordHash) fail_("Mot de passe actuel incorrect.", "invalid_credentials");
  if (next.length < 6) fail_("Le nouveau mot de passe doit contenir au moins 6 caractères.", "validation");
  var salt = Utilities.getUuid();
  update_("Users", user._row, { passwordHash: hashPassword_(next, salt), salt: salt });
  return { ok: true };
}

/* ---------------- Crédits / déblocage ---------------- */

function actionUnlockEpisode_(body, token) {
  var user = sessionUser_(token, true);
  var storyId = String(body.storyId || "");
  var n = num_(body.n, 0);
  var story = readTable_("Series").filter(function (s) { return s.id === storyId; })[0];
  if (!story) fail_("Série introuvable.", "notfound");
  var ep = readTable_("Episodes").filter(function (e) { return e.storyId === storyId && num_(e.n, 0) === n; })[0];
  if (!ep || !bool_(ep.published)) fail_("Cet épisode n'est pas encore disponible.", "notfound");

  var cost = num_(ep.cost, 0);
  if (cost <= 0) fail_("Cet épisode est déjà accessible.", "validation");

  var already = readTable_("Unlocks").filter(function (u) {
    return u.userId === user.id && u.storyId === storyId && num_(u.episodeN, 0) === n;
  })[0];

  var credits = num_(user.credits, 0);
  if (!already) {
    if (credits < cost) fail_("Crédits insuffisants pour cet épisode.", "insufficient_credits");
    credits -= cost;
    update_("Users", user._row, { credits: credits });
    append_("Unlocks", {
      id: uid_("un"),
      date: new Date().toISOString(),
      userId: user.id,
      storyId: storyId,
      episodeN: n,
      cost: cost
    });
    creditLog_(user.id, -cost, "Déblocage — " + (story.title || "série") + " · épisode " + n, credits);
  }

  user.credits = credits;
  var unlockedMap = {};
  unlockedMap[storyId + ":" + n] = true;
  return { user: publicUser_(user), episode: episodeOut_(storyId, ep, unlockedMap, false) };
}

/* ---------------- Admin : stats & utilisateurs ---------------- */

function actionAdminStats_(body, token) {
  var user = sessionUser_(token, true);
  requireAdmin_(user);
  var users = readTable_("Users");
  var tips = readTable_("Tips");
  var stories = readTable_("Series");
  var episodes = readTable_("Episodes");
  var credits = users.reduce(function (sum, u) { return sum + num_(u.credits, 0); }, 0);
  var recent = users.slice().sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  }).slice(0, 5).map(function (u) {
    return { name: u.name, email: u.email, createdAt: u.createdAt };
  });
  return {
    users: users.length,
    activeUsers: users.filter(function (u) { return u.status !== "blocked"; }).length,
    tips: tips.length,
    publishedTips: tips.filter(function (t) { return bool_(t.published); }).length,
    stories: stories.length,
    episodes: episodes.length,
    premiumEpisodes: episodes.filter(function (e) { return num_(e.cost, 0) > 0; }).length,
    credits: credits,
    recentSignups: recent
  };
}

function actionAdminUsers_(body, token) {
  var user = sessionUser_(token, true);
  requireAdmin_(user);
  return readTable_("Users").map(function (u) {
    var out = publicUser_(u);
    out.status = u.status || "active";
    return out;
  }).sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
}

function actionAdminSetCredits_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var target = findUserById_(String(body.userId || ""));
  if (!target) fail_("Utilisateur introuvable.", "notfound");
  var delta = num_(body.delta, 0);
  if (!delta) fail_("Indique un montant différent de zéro.", "validation");
  var balance = num_(target.credits, 0) + delta;
  if (balance < 0) fail_("Le solde ne peut pas devenir négatif.", "validation");
  update_("Users", target._row, { credits: balance });
  creditLog_(target.id, delta, String(body.reason || "Ajustement administrateur"), balance);
  target.credits = balance;
  return { user: publicUser_(target) };
}

function actionAdminSetRole_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var target = findUserById_(String(body.userId || ""));
  if (!target) fail_("Utilisateur introuvable.", "notfound");
  var role = body.role === "admin" ? "admin" : "user";
  if (target.id === admin.id && role !== "admin") fail_("Tu ne peux pas retirer ton propre rôle admin.", "validation");
  update_("Users", target._row, { role: role });
  target.role = role;
  return { user: publicUser_(target) };
}

function actionAdminSetStatus_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var target = findUserById_(String(body.userId || ""));
  if (!target) fail_("Utilisateur introuvable.", "notfound");
  var status = body.status === "blocked" ? "blocked" : "active";
  if (target.id === admin.id && status === "blocked") fail_("Tu ne peux pas bloquer ton propre compte.", "validation");
  update_("Users", target._row, { status: status });
  if (status === "blocked") {
    deleteWhere_("Sessions", function (s) { return s.userId === target.id; });
  }
  target.status = status;
  return { user: publicUser_(target) };
}

/* ---------------- Admin : astuces ---------------- */

function actionAdminTips_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  return readTable_("Tips").map(tipOut_).sort(function (a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
}

function actionAdminSaveTip_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var tip = body.tip || {};
  var title = String(tip.title || "").trim();
  if (title.length < 4) fail_("Le titre doit contenir au moins 4 caractères.", "validation");
  var cat = String(tip.cat || "");
  if (!readTable_("Categories").some(function (c) { return c.id === cat; })) fail_("Catégorie invalide.", "validation");

  var normalized = {
    cat: cat,
    title: title,
    excerpt: String(tip.excerpt || "").trim(),
    minutes: Math.max(1, num_(tip.minutes, 3)),
    date: String(tip.date || "").trim(),
    author: String(tip.author || admin.name || "BCréation").trim(),
    featured: !!tip.featured,
    published: tip.published !== false,
    imageUrl: String(tip.imageUrl || tip.image || "").trim(),
    body: JSON.stringify(Array.isArray(tip.body) ? tip.body : [])
  };
  if (!normalized.date) normalized.date = formatDateFr_(new Date());

  var existing = tip.id ? readTable_("Tips").filter(function (t) { return t.id === tip.id; })[0] : null;
  if (existing) {
    normalized.updatedAt = new Date().toISOString();
    update_("Tips", existing._row, normalized);
    normalized.id = existing.id;
    normalized.createdAt = existing.createdAt;
  } else {
    normalized.id = tip.id || uniqueSlug_("Tips", title);
    normalized.createdAt = new Date().toISOString();
    normalized.updatedAt = normalized.createdAt;
    append_("Tips", normalized);
  }
  return tipOut_(normalized);
}

function actionAdminDeleteTip_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var id = String(body.id || "");
  deleteWhere_("Tips", function (t) { return t.id === id; });
  return { ok: true };
}

/* ---------------- Admin : séries & épisodes ---------------- */

function actionAdminStories_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var episodes = readTable_("Episodes");
  return readTable_("Series").map(function (s) {
    var eps = episodes.filter(function (ep) { return ep.storyId === s.id; })
      .sort(function (a, b) { return num_(a.n, 0) - num_(b.n, 0); })
      .map(function (ep) {
        return {
          n: num_(ep.n, 0),
          title: ep.title,
          minutes: num_(ep.minutes, 5),
          date: ep.date,
          published: bool_(ep.published),
          cost: num_(ep.cost, 0),
          image: ep.imageUrl || "",
          body: json_(ep.body, [])
        };
      });
    return {
      id: s.id,
      title: s.title,
      tagline: s.tagline,
      author: s.author,
      genre: s.genre,
      status: s.status,
      letter: s.letter,
      colors: [s.color1, s.color2],
      synopsis: s.synopsis,
      image: s.imageUrl || "",
      published: bool_(s.published),
      episodes: eps
    };
  }).sort(function (a, b) { return String(a.title || "").localeCompare(String(b.title || "")); });
}

function actionAdminSaveStory_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var s = body.story || {};
  var title = String(s.title || "").trim();
  if (title.length < 3) fail_("Le titre doit contenir au moins 3 caractères.", "validation");
  var colors = Array.isArray(s.colors) ? s.colors : [];
  var imageUrl = imageUrl_(s.image, "serie-" + title);
  var existing = s.id ? readTable_("Series").filter(function (x) { return x.id === s.id; })[0] : null;
  if (!imageUrl && existing) imageUrl = existing.imageUrl || "";
  var normalized = {
    title: title,
    tagline: String(s.tagline || "").trim(),
    author: String(s.author || admin.name || "BCréation").trim(),
    genre: String(s.genre || "Romance").trim(),
    status: String(s.status || "En cours").trim(),
    letter: String(s.letter || title.charAt(0)).charAt(0).toUpperCase(),
    color1: colors[0] || "#ff7a9c",
    color2: colors[1] || "#7c3aed",
    synopsis: String(s.synopsis || "").trim(),
    imageUrl: imageUrl,
    published: s.published !== false
  };
  if (existing) {
    update_("Series", existing._row, normalized);
    normalized.id = existing.id;
    normalized.createdAt = existing.createdAt;
  } else {
    normalized.id = s.id || uniqueSlug_("Series", title);
    normalized.createdAt = new Date().toISOString();
    append_("Series", normalized);
  }
  normalized.episodes = [];
  return normalized;
}

function actionAdminDeleteStory_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var id = String(body.id || "");
  deleteWhere_("Episodes", function (e) { return e.storyId === id; });
  deleteWhere_("Series", function (s) { return s.id === id; });
  deleteWhere_("Unlocks", function (u) { return u.storyId === id; });
  return { ok: true };
}

function actionAdminSaveEpisode_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var e = body.episode || {};
  var storyId = String(e.storyId || "");
  var story = readTable_("Series").filter(function (s) { return s.id === storyId; })[0];
  if (!story) fail_("Série introuvable.", "notfound");
  var title = String(e.title || "").trim();
  if (title.length < 2) fail_("Le titre de l'épisode est trop court.", "validation");

  var existingEps = readTable_("Episodes").filter(function (x) { return x.storyId === storyId; });
  var n = num_(e.n, 0);
  if (!n) {
    n = existingEps.reduce(function (max, x) { return Math.max(max, num_(x.n, 0)); }, 0) + 1;
  }
  var existing = existingEps.filter(function (x) { return num_(x.n, 0) === n; })[0];
  var imageUrl = imageUrl_(e.image, "episode-" + storyId + "-" + n);
  if (!imageUrl && existing) imageUrl = existing.imageUrl || "";

  var normalized = {
    storyId: storyId,
    n: n,
    title: title,
    minutes: Math.max(1, num_(e.minutes, 5)),
    date: String(e.date || formatDateFr_(new Date())).trim(),
    body: JSON.stringify(Array.isArray(e.body) ? e.body : []),
    published: !!e.published,
    cost: Math.max(0, num_(e.cost, 0)),
    imageUrl: imageUrl
  };
  if (existing) {
    update_("Episodes", existing._row, normalized);
    normalized.id = existing.id;
    normalized.createdAt = existing.createdAt;
  } else {
    normalized.id = storyId + ":" + n;
    normalized.createdAt = new Date().toISOString();
    append_("Episodes", normalized);
  }
  return {
    n: n,
    title: normalized.title,
    minutes: normalized.minutes,
    date: normalized.date,
    published: normalized.published,
    cost: normalized.cost,
    image: normalized.imageUrl || "",
    body: JSON.parse(normalized.body)
  };
}

function actionAdminDeleteEpisode_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var storyId = String(body.storyId || "");
  var n = num_(body.n, 0);
  deleteWhere_("Episodes", function (e) { return e.storyId === storyId && num_(e.n, 0) === n; });
  deleteWhere_("Unlocks", function (u) { return u.storyId === storyId && num_(u.episodeN, 0) === n; });
  return { ok: true };
}

/* ---------------- Admin : cours informatiques ---------------- */

function actionAdminCourses_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var lessons = readTable_("CourseLessons");
  return readTable_("Courses").sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); }).map(function (c) {
    return {
      id: c.id,
      title: c.title,
      description: c.description || "",
      image: c.imageUrl || "",
      published: bool_(c.published),
      lessons: lessons.filter(function (l) { return l.courseId === c.id; }).sort(function (a, b) { return num_(a.n, 0) - num_(b.n, 0); }).map(function (l) {
        return { id: l.id, n: num_(l.n, 0), title: l.title, body: json_(l.body, []), published: bool_(l.published) };
      })
    };
  });
}

function actionAdminSaveCourse_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var c = body.course || {};
  var title = String(c.title || "").trim();
  if (title.length < 3) fail_("Le titre du cours doit contenir au moins 3 caractères.", "validation");
  var existing = c.id ? readTable_("Courses").filter(function (x) { return x.id === c.id; })[0] : null;
  var imageUrl = imageUrl_(c.image, "cours-" + title);
  if (!imageUrl && existing) imageUrl = existing.imageUrl || "";
  var now = new Date().toISOString();
  var normalized = { title: title, description: String(c.description || "").trim().slice(0, 200), imageUrl: imageUrl, published: c.published !== false, updatedAt: now };
  if (existing) { update_("Courses", existing._row, normalized); normalized.id = existing.id; normalized.createdAt = existing.createdAt; }
  else { normalized.id = c.id || uniqueSlug_("Courses", title); normalized.createdAt = now; append_("Courses", normalized); }
  normalized.lessons = [];
  return normalized;
}

function actionAdminDeleteCourse_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var id = String(body.id || "");
  deleteWhere_("CourseLessons", function (l) { return l.courseId === id; });
  deleteWhere_("Courses", function (c) { return c.id === id; });
  return { ok: true };
}

function actionAdminSaveCourseLesson_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var l = body.lesson || {};
  var courseId = String(l.courseId || "");
  var title = String(l.title || "").trim();
  if (!readTable_("Courses").some(function (c) { return c.id === courseId; })) fail_("Cours introuvable.", "notfound");
  if (title.length < 2) fail_("Le titre de la leçon est obligatoire.", "validation");
  var n = Math.max(1, num_(l.n, 1));
  var rows = readTable_("CourseLessons");
  var existing = l.id ? rows.filter(function (x) { return x.id === l.id; })[0] : rows.filter(function (x) { return x.courseId === courseId && num_(x.n, 0) === n; })[0];
  var now = new Date().toISOString();
  var normalized = { courseId: courseId, n: n, title: title, body: JSON.stringify(Array.isArray(l.body) ? l.body : []), published: l.published !== false, updatedAt: now };
  if (existing) { update_("CourseLessons", existing._row, normalized); normalized.id = existing.id; normalized.createdAt = existing.createdAt; }
  else { normalized.id = l.id || uniqueSlug_("CourseLessons", courseId + "-" + n + "-" + title); normalized.createdAt = now; append_("CourseLessons", normalized); }
  normalized.body = json_(normalized.body, []);
  return normalized;
}

function actionAdminDeleteCourseLesson_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var id = String(body.id || "");
  deleteWhere_("CourseLessons", function (l) { return l.id === id; });
  return { ok: true };
}

/* ---------------- Admin : réglages & import ---------------- */

function actionAdminSettings_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  return {
    welcomeCredits: num_(setting_("welcomeCredits", CONFIG.WELCOME_CREDITS), CONFIG.WELCOME_CREDITS),
    spreadsheetUrl: db_().getUrl(),
    adminEmail: admin.email
  };
}

function actionAdminSaveSettings_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var welcome = Math.max(0, num_(body.welcomeCredits, CONFIG.WELCOME_CREDITS));
  setSetting_("welcomeCredits", welcome);
  return { welcomeCredits: welcome };
}

/**
 * Importe le contenu de démonstration envoyé par le frontend.
 * N'écrase jamais un contenu existant (même id).
 */
function actionAdminImportDemo_(body, token) {
  var admin = sessionUser_(token, true);
  requireAdmin_(admin);
  var counts = { categories: 0, tips: 0, stories: 0, episodes: 0 };

  var cats = readTable_("Categories");
  (body.categories || []).forEach(function (c) {
    if (!c.id || cats.some(function (x) { return x.id === c.id; })) return;
    append_("Categories", {
      id: c.id, name: c.name || c.id, icon: c.icon || "grid",
      color: c.color || "#6c5ce7", ordre: num_(c.ordre, 99)
    });
    counts.categories++;
  });

  var tips = readTable_("Tips");
  (body.tips || []).forEach(function (t) {
    if (!t.id || !t.title || tips.some(function (x) { return x.id === t.id; })) return;
    append_("Tips", {
      id: t.id,
      cat: t.cat || "web",
      title: t.title,
      excerpt: t.excerpt || "",
      minutes: Math.max(1, num_(t.minutes, 4)),
      date: t.date || formatDateFr_(new Date()),
      author: t.author || "BCréation",
      featured: !!t.featured,
      published: true,
      body: JSON.stringify(Array.isArray(t.body) ? t.body : []),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    counts.tips++;
  });

  var series = readTable_("Series");
  var episodes = readTable_("Episodes");
  (body.stories || []).forEach(function (s) {
    if (!s.id || !s.title || series.some(function (x) { return x.id === s.id; })) return;
    append_("Series", {
      id: s.id,
      title: s.title,
      tagline: s.tagline || "",
      author: s.author || "BCréation",
      genre: s.genre || "Romance",
      status: s.status || "En cours",
      letter: s.letter || s.title.charAt(0).toUpperCase(),
      color1: (s.colors && s.colors[0]) || "#ff7a9c",
      color2: (s.colors && s.colors[1]) || "#7c3aed",
      synopsis: s.synopsis || "",
      published: true,
      createdAt: new Date().toISOString()
    });
    counts.stories++;
    var seen = {};
    (s.episodes || []).forEach(function (ep) {
      var n = num_(ep.n, 0);
      if (!n || seen[n]) return;
      if (episodes.some(function (x) { return x.storyId === s.id && num_(x.n, 0) === n; })) return;
      seen[n] = true;
      append_("Episodes", {
        id: s.id + ":" + n,
        storyId: s.id,
        n: n,
        title: ep.title || ("Épisode " + n),
        minutes: Math.max(1, num_(ep.minutes, 5)),
        date: ep.date || formatDateFr_(new Date()),
        body: JSON.stringify(Array.isArray(ep.body) ? ep.body : []),
        published: !ep.locked,
        cost: 0,
        createdAt: new Date().toISOString()
      });
      counts.episodes++;
    });
  });

  return counts;
}

/* ---------------- Sessions & utilisateurs ---------------- */

function createSession_(userId) {
  var token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  var now = new Date();
  append_("Sessions", {
    token: token,
    userId: userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CONFIG.SESSION_DAYS * 86400000).toISOString()
  });
  return token;
}

function sessionUser_(token, required) {
  ensureReady_();
  if (!token) {
    if (required) fail_("Connexion requise.", "unauthorized");
    return null;
  }
  var session = readTable_("Sessions").filter(function (s) { return s.token === token; })[0];
  if (!session) {
    if (required) fail_("Session expirée, reconnecte-toi.", "unauthorized");
    return null;
  }
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    deleteWhere_("Sessions", function (s) { return s.token === token; });
    if (required) fail_("Session expirée, reconnecte-toi.", "unauthorized");
    return null;
  }
  var user = findUserById_(session.userId);
  if (!user || user.status === "blocked") {
    if (required) fail_("Compte introuvable ou bloqué.", "unauthorized");
    return null;
  }
  return user;
}

function publicUser_(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role === "admin" ? "admin" : "user",
    credits: num_(u.credits, 0),
    bio: u.bio || "",
    createdAt: u.createdAt,
    status: u.status || "active"
  };
}

function findUserByEmail_(email) {
  return readTable_("Users").filter(function (u) {
    return String(u.email || "").toLowerCase() === email;
  })[0];
}

function findUserById_(id) {
  return readTable_("Users").filter(function (u) { return u.id === id; })[0];
}

function requireAdmin_(user) {
  if (!user || user.role !== "admin") fail_("Accès administrateur requis.", "forbidden");
}

function creditLog_(userId, delta, reason, balance) {
  append_("Credits", {
    id: uid_("c"),
    date: new Date().toISOString(),
    userId: userId,
    delta: delta,
    reason: reason,
    balance: balance
  });
}

/* ---------------- Base de données ---------------- */

function ensureReady_() {
  var props = PropertiesService.getScriptProperties();
  var id = CONFIG.SPREADSHEET_ID || props.getProperty("BC_SPREADSHEET_ID");
  if (!id) fail_("Base non initialisée. Exécute setup() dans Apps Script.", "not_setup");
  ensureImageColumns_(id);
}

function ensureImageColumns_(spreadsheetId) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("BC_IMAGE_COLUMNS_READY") === "1") return;
  var ss = SpreadsheetApp.openById(spreadsheetId);
  ["Tips", "Series", "Episodes"].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var last = Math.max(1, sh.getLastColumn());
    var headers = sh.getRange(1, 1, 1, last).getValues()[0].map(String);
    if (headers.indexOf("imageUrl") < 0) {
      var anchor = name === "Tips" ? "body" : "createdAt";
      var anchorIndex = headers.indexOf(anchor);
      var column = anchorIndex >= 0 ? anchorIndex + 1 : last + 1;
      if (column <= last) sh.insertColumnBefore(column);
      sh.getRange(1, column).setValue("imageUrl").setFontWeight("bold");
    }
  });
  props.setProperty("BC_IMAGE_COLUMNS_READY", "1");
}

function db_() {
  ensureReady_();
  var props = PropertiesService.getScriptProperties();
  var id = CONFIG.SPREADSHEET_ID || props.getProperty("BC_SPREADSHEET_ID");
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  var ss = db_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var headers = SCHEMA[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function readTable_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row.join("")) continue;
    var obj = { _row: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = row[j];
    }
    rows.push(obj);
  }
  return rows;
}

function append_(name, obj) {
  var sh = sheet_(name);
  var headers = SCHEMA[name];
  var values = headers.map(function (h) {
    return obj[h] === undefined || obj[h] === null ? "" : obj[h];
  });
  sh.appendRow(values);
}

function update_(name, rowIndex, patch) {
  var sh = sheet_(name);
  var headers = SCHEMA[name];
  var range = sh.getRange(rowIndex, 1, 1, headers.length);
  var values = range.getValues()[0];
  headers.forEach(function (h, i) {
    if (patch[h] !== undefined) values[i] = patch[h];
  });
  range.setValues([values]);
}

function deleteWhere_(name, predicate) {
  var rows = readTable_(name).filter(predicate)
    .sort(function (a, b) { return b._row - a._row; });
  var sh = sheet_(name);
  rows.forEach(function (r) { sh.deleteRow(r._row); });
}

function setting_(key, fallback) {
  var row = readTable_("Settings").filter(function (s) { return s.key === key; })[0];
  if (!row) return fallback;
  if (typeof row.value === "number") return row.value;
  var n = Number(row.value);
  return isNaN(n) ? row.value : n;
}

function setSetting_(key, value) {
  var rows = readTable_("Settings");
  var row = rows.filter(function (s) { return s.key === key; })[0];
  if (row) {
    update_("Settings", row._row, { value: value });
  } else {
    append_("Settings", { key: key, value: value });
  }
}

function uniqueSlug_(sheetName, title) {
  var base = String(title).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "element";
  var existing = readTable_(sheetName).map(function (r) { return r.id; });
  var id = base;
  var i = 2;
  while (existing.indexOf(id) >= 0) {
    id = base + "-" + i;
    i++;
  }
  return id;
}

/* ---------------- Utilitaires ---------------- */

function imageUrl_(value, name) {
  var raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  var match = raw.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) fail_("Format d’image invalide. Utilise JPG, PNG, WEBP ou GIF.", "validation");
  var bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 5 * 1024 * 1024) fail_("L’image ne doit pas dépasser 5 Mo.", "validation");
  var ext = match[1].split("/")[1].replace("jpeg", "jpg");
  var folderId = PropertiesService.getScriptProperties().getProperty("BCREATION_DRIVE_FOLDER_ID");
  var folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    var folders = DriveApp.getFoldersByName("BCréation Images");
    folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("BCréation Images");
    PropertiesService.getScriptProperties().setProperty("BCREATION_DRIVE_FOLDER_ID", folder.getId());
  }
  var safeName = String(name || "image").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80);
  var file = folder.createFile(Utilities.newBlob(bytes, match[1], safeName + "." + ext));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function hashPassword_(password, salt) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + "::" + password,
    Utilities.Charset.UTF_8
  );
  return raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function uid_(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function num_(value, fallback) {
  var n = Number(value);
  return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
}

function bool_(value) {
  if (value === true) return true;
  var s = String(value).toLowerCase();
  return s === "true" || s === "1" || s === "oui" || s === "yes";
}

function json_(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    var parsed = JSON.parse(String(value));
    return parsed === null ? fallback : parsed;
  } catch (err) {
    return fallback;
  }
}

function fail_(message, code) {
  var err = new Error(message);
  err.code = code || "error";
  throw err;
}

function formatDateFr_(date) {
  var months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return date.getDate() + " " + months[date.getMonth()] + " " + date.getFullYear();
}

/* ---------------- Initialisation ---------------- */

/**
 * À exécuter UNE FOIS depuis l'éditeur Apps Script.
 * Crée le classeur (ou utilise CONFIG.SPREADSHEET_ID), les feuilles,
 * les catégories, le compte admin et les réglages.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss;
  if (CONFIG.SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  } else if (props.getProperty("BC_SPREADSHEET_ID")) {
    ss = SpreadsheetApp.openById(props.getProperty("BC_SPREADSHEET_ID"));
  } else {
    ss = SpreadsheetApp.create("BCréation — Base de données");
    props.setProperty("BC_SPREADSHEET_ID", ss.getId());
  }

  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      var headers = SCHEMA[name];
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, headers.length);
    }
  });

  // Catégories
  var cats = readTable_("Categories");
  if (!cats.length) {
    SEED_CATEGORIES.forEach(function (c) { append_("Categories", c); });
  }

  // Réglage crédits de bienvenue
  setSetting_("welcomeCredits", CONFIG.WELCOME_CREDITS);

  // Compte admin
  var admin = findUserByEmail_(String(CONFIG.ADMIN_EMAIL).toLowerCase());
  if (!admin) {
    var salt = Utilities.getUuid();
    append_("Users", {
      id: uid_("u"),
      email: String(CONFIG.ADMIN_EMAIL).toLowerCase(),
      name: "Administrateur",
      passwordHash: hashPassword_(CONFIG.ADMIN_PASSWORD, salt),
      salt: salt,
      role: "admin",
      credits: 0,
      bio: "Compte administrateur de BCréation.",
      status: "active",
      failedAttempts: 0,
      lockedUntil: "",
      createdAt: new Date().toISOString(),
      lastLogin: ""
    });
  }

  Logger.log("Base prête : " + ss.getUrl());
  Logger.log("Compte admin : " + CONFIG.ADMIN_EMAIL + " / " + CONFIG.ADMIN_PASSWORD);
  Logger.log("Pense à changer le mot de passe admin après la première connexion.");
  return ss.getUrl();
}
