/**
 * BACKEND API BENTOUL — SÉRIES & ÉPISODES (même logique que benamoura.gs)
 * Déployer sur un projet Apps Script lié au Google Sheet BENTOUL (Series / Episodes).
 * Les fonctions existantes Series/Episodes/Commentaires/Statistiques/Drive sont conservées.
 */

const SHEET_SERIES = "Series";
const SHEET_EPISODES = "Episodes";
const SHEET_COMMENTS = "Commentaires";
const SHEET_STATS = "Statistiques";
const SHEET_PROFILE = "Profile";
const SHEET_REACTIONS = "Reactions";
const DRIVE_FOLDER_NAME = "Bentoul_Uploads";

// Les 3 premiers épisodes d'une série sont gratuits, les suivants coûtent 1 crédit
// (débit géré par user.gs, feuille Deblocages ; 'achete' reste informatif ici).
const FREE_EPISODE_COUNT = 3;
const EPISODE_CREDIT_COST = 1;

const REACTIONS_HEADERS = ["ID", "ContentID", "Identity", "Type", "Date"];

const PROFILE_HEADERS = [
  "ID","Nom","Email","Telephone","Pays","Ville","Adresse","Orientation","Role","DateCreation",
  "Likes","Dislikes","Age","Genre","StatutAmoureux","Enfants","RelationRecherchee","Presentation",
  "Interets","Musique","Personnalite","Valeurs","Habitudes","GenreRecherche","AgeMinRecherche",
  "AgeMaxRecherche","LieuRecherche","QualitesRecherchees","InteretsSouhaites","ImportanceRelation",
  "NonNegociables","Communication","Distance","Projets","Complement","Consentement","Pseudo","PINHash"
];

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  checkAndCreateSheets(ss);
  const action = e && e.parameter ? e.parameter.action : "";
  let response = { status: "error", message: "Action non valide" };

  try {
    if (action === "getSeries") {
      const sheet = ss.getSheetByName(SHEET_SERIES);
      const data = sheet.getDataRange().getValues();
      const viewsCol = headerIndex_(data[0], "vues");
      const series = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) series.push({
          id: data[i][0], titre: data[i][1], contenu: data[i][2], image: data[i][3] || "",
          likes: Number(data[i][5]) || 0, dislikes: Number(data[i][6]) || 0,
          shares: Number(data[i][7]) || 0, statut: data[i][8] || "Publié",
          views: viewsCol >= 0 ? (Number(data[i][viewsCol]) || 0) : 0
        });
      }
      response = { status: "success", data: series };

    } else if (action === "getEpisodes") {
      const seriesId = e.parameter.seriesId;
      const sheet = ss.getSheetByName(SHEET_EPISODES);
      const data = sheet.getDataRange().getValues();
      const viewsCol = headerIndex_(data[0], "vues");
      const episodes = [];
      let numero = 0;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(seriesId)) {
          numero++;
          const gratuit = numero <= FREE_EPISODE_COUNT;
          episodes.push({
            id: data[i][0], seriesId: data[i][1], titre: data[i][2], contenu: data[i][3],
            image: data[i][4] || "", likes: Number(data[i][6]) || 0,
            dislikes: Number(data[i][7]) || 0, shares: Number(data[i][8]) || 0,
            statut: data[i][9] || "Publié",
            views: viewsCol >= 0 ? (Number(data[i][viewsCol]) || 0) : 0,
            numero: numero,
            gratuit: gratuit,
            achete: false,
            verrouille: !gratuit,
            coutCredits: gratuit ? 0 : EPISODE_CREDIT_COST
          });
        }
      }
      response = { status: "success", data: episodes };

    } else if (action === "getEpisodeState") {
      const episodeId = String(e.parameter.episodeId || "");
      const identity = String(e.parameter.identity || "").trim().toLowerCase();
      const sheet = ss.getSheetByName(SHEET_EPISODES);
      const data = sheet.getDataRange().getValues();
      const viewsCol = headerIndex_(data[0], "vues");
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === episodeId) { rowIndex = i; break; }
      }
      if (rowIndex < 0) throw new Error("Episode introuvable.");

      const myVote = identity ? findReactionType_(ss, episodeId, identity, ["like", "dislike"]) : "";

      response = {
        status: "success",
        likes: Number(data[rowIndex][6]) || 0,
        dislikes: Number(data[rowIndex][7]) || 0,
        shares: Number(data[rowIndex][8]) || 0,
        views: viewsCol >= 0 ? (Number(data[rowIndex][viewsCol]) || 0) : 0,
        myVote: myVote
      };

    } else if (action === "getComments") {
      const episodeId = e.parameter.episodeId;
      const sheet = ss.getSheetByName(SHEET_COMMENTS);
      const data = sheet.getDataRange().getValues();
      const comments = [];
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(episodeId)) comments.push({
          id: data[i][0], episodeId: data[i][1], pseudo: data[i][2],
          message: data[i][3], date: data[i][4]
        });
      }
      response = { status: "success", data: comments.reverse() };

    } else if (action === "getProfiles") {
      const sheet = ss.getSheetByName(SHEET_PROFILE);
      const data = sheet.getDataRange().getValues();
      const profiles = [];
      for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue;
        profiles.push({
          id: data[i][0], nom: data[i][1] || "", email: data[i][2] || "",
          telephone: data[i][3] || "", pays: data[i][4] || "", ville: data[i][5] || "",
          adresse: data[i][6] || "", orientation: data[i][7] || "", role: data[i][8] || "",
          date: data[i][9] || "", likes: Number(data[i][10]) || 0, dislikes: Number(data[i][11]) || 0,
          age: data[i][12] || "", genre: data[i][13] || "", statutAmoureux: data[i][14] || "",
          enfants: data[i][15] || "", relationRecherchee: data[i][16] || "", presentation: data[i][17] || "",
          interets: data[i][18] || "", musique: data[i][19] || "", personnalite: data[i][20] || "",
          valeurs: data[i][21] || "", habitudes: data[i][22] || "", genreRecherche: data[i][23] || "",
          ageMinRecherche: data[i][24] || "", ageMaxRecherche: data[i][25] || "",
          lieuRecherche: data[i][26] || "", qualitesRecherchees: data[i][27] || "",
          interetsSouhaites: data[i][28] || "", importanceRelation: data[i][29] || "",
          nonNegociables: data[i][30] || "", communication: data[i][31] || "",
          distance: data[i][32] || "", projets: data[i][33] || "", complement: data[i][34] || "",
          consentement: data[i][35] || "",
          pseudo: getProfileColumnValue(sheet, data[i], "Pseudo")
        });
      }
      response = { status: "success", data: profiles.reverse() };

    } else if (action === "getStats") {
      const sheet = ss.getSheetByName(SHEET_STATS);
      const stats = [];
      if (sheet && sheet.getLastRow() > 1) {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0]) {
            let dateVal = data[i][0];
            if (dateVal instanceof Date) {
              dateVal = Utilities.formatDate(dateVal, Session.getScriptTimeZone() || "GMT", "dd/MM/yyyy HH:mm:ss");
            } else {
              dateVal = String(dateVal || "");
            }

            stats.push({
              date: dateVal,
              visitorId: String(data[i][1] || "Anonyme"),
              pays: String(data[i][2] || "Inconnu"),
              eventType: String(data[i][3] || "Vue"),
              targetTitle: String(data[i][4] || ""),
              targetId: String(data[i][5] || ""),
              device: String(data[i][6] || "Inconnu"),
              os: String(data[i][7] || ""),
              browser: String(data[i][8] || "")
            });
          }
        }
      }
      response = { status: "success", data: stats.reverse() };
    }
  } catch (err) {
    response = { status: "error", message: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // Sérialise les compteurs pour garantir « une seule réaction par utilisateur ».
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  checkAndCreateSheets(ss);
  let response = { status: "error" };

  try {
    const postData = JSON.parse(e.postData.contents);
    const type = postData.type;
    const now = new Date().toLocaleString("fr-FR");

    if (type === "vote") {
      response = vote_(ss, postData, now);

    } else if (type === "view") {
      response = view_(ss, postData, now);

    } else if (type === "share") {
      response = share_(ss, postData);

    } else if (type === "analytics") {
      const sheet = ss.getSheetByName(SHEET_STATS);
      sheet.appendRow([
        now, postData.visitorId || "Anonyme", postData.pays || "Inconnu",
        postData.eventType || "Vue", postData.targetTitle || "", postData.targetId || "",
        postData.device || "Inconnu", postData.os || "", postData.browser || ""
      ]);
      response = { status: "success", message: "Statistique enregistrée" };

    } else if (type === "comment") {
      const sheet = ss.getSheetByName(SHEET_COMMENTS);
      const pseudo = String(postData.pseudo || "").trim();
      const message = String(postData.message || "").trim();
      if (!postData.episodeId) throw new Error("Episode manquant.");
      if (!pseudo) throw new Error("Commentaire réservé aux utilisateurs connectés.");
      if (!message || message.length > 500) throw new Error("Message de commentaire invalide.");
      const commentId = "COM_" + new Date().getTime();
      sheet.appendRow([commentId, postData.episodeId, pseudo, message, now]);
      response = { status: "success", message: "Commentaire publié avec succès", commentId: commentId };

    } else if (type === "interaction") {
      const targetType = postData.targetType;
      const targetId = postData.targetId;
      const likeDelta = Number(postData.likeDelta) || 0;
      const dislikeDelta = Number(postData.dislikeDelta) || 0;
      const shareDelta = Number(postData.shareDelta) || 0;
      const sheet = ss.getSheetByName(targetType === "serie" ? SHEET_SERIES : SHEET_EPISODES);
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) { rowIndex = i + 1; break; }
      }
      if (rowIndex > 0) {
        const colLike = targetType === "serie" ? 6 : 7;
        const colDislike = targetType === "serie" ? 7 : 8;
        const colShare = targetType === "serie" ? 8 : 9;
        if (likeDelta !== 0) {
          const val = Number(sheet.getRange(rowIndex, colLike).getValue()) || 0;
          sheet.getRange(rowIndex, colLike).setValue(Math.max(0, val + likeDelta));
        }
        if (dislikeDelta !== 0) {
          const val = Number(sheet.getRange(rowIndex, colDislike).getValue()) || 0;
          sheet.getRange(rowIndex, colDislike).setValue(Math.max(0, val + dislikeDelta));
        }
        if (shareDelta !== 0) {
          const val = Number(sheet.getRange(rowIndex, colShare).getValue()) || 0;
          sheet.getRange(rowIndex, colShare).setValue(Math.max(0, val + shareDelta));
        }
        response = { status: "success", message: "Interaction enregistrée" };
      }

    } else if (type === "serie" || type === "episode") {
      const id = postData.id;
      const isSerie = type === "serie";
      const sheet = ss.getSheetByName(isSerie ? SHEET_SERIES : SHEET_EPISODES);
      const data = sheet.getDataRange().getValues();
      const statut = postData.statut || "Publié";
      let rowIndex = -1;
      let finalImageUrl = postData.image || "";
      if (finalImageUrl.indexOf("data:image") !== -1) {
        finalImageUrl = uploadBase64ToDrive(finalImageUrl, isSerie ? "Serie" : "Episode");
      }
      let cleanContent = postData.contenu || "";
      if (postData.image && postData.image.indexOf("data:image") !== -1 && finalImageUrl) {
        cleanContent = cleanContent.split(postData.image).join(finalImageUrl);
      }
      if (id) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) === String(id)) { rowIndex = i + 1; break; }
        }
      }
      if (rowIndex > 0) {
        if (isSerie) {
          sheet.getRange(rowIndex, 2).setValue(postData.titre);
          sheet.getRange(rowIndex, 3).setValue(cleanContent);
          if (finalImageUrl) sheet.getRange(rowIndex, 4).setValue(finalImageUrl);
          sheet.getRange(rowIndex, 5).setValue(now);
          sheet.getRange(rowIndex, 9).setValue(statut);
        } else {
          sheet.getRange(rowIndex, 2).setValue(postData.seriesId);
          sheet.getRange(rowIndex, 3).setValue(postData.titre);
          sheet.getRange(rowIndex, 4).setValue(cleanContent);
          if (finalImageUrl) sheet.getRange(rowIndex, 5).setValue(finalImageUrl);
          sheet.getRange(rowIndex, 6).setValue(now);
          sheet.getRange(rowIndex, 10).setValue(statut);
        }
        response = { status: "success", id: id, imageUrl: finalImageUrl, message: "Mise à jour réussie !" };
      } else {
        const uniqueId = (isSerie ? "SERIE_" : "EP_") + new Date().getTime();
        if (isSerie) sheet.appendRow([uniqueId, postData.titre, cleanContent, finalImageUrl, now, 0, 0, 0, statut]);
        else sheet.appendRow([uniqueId, postData.seriesId, postData.titre, cleanContent, finalImageUrl, now, 0, 0, 0, statut]);
        response = { status: "success", id: uniqueId, imageUrl: finalImageUrl, message: "Création réussie !" };
      }

    } else if (type === "profileLogin") {
      const sheet = ss.getSheetByName(SHEET_PROFILE);
      const identifier = String(postData.identifier || "").trim().toLowerCase();
      const pin = String(postData.pin || "").trim();
      if (!identifier || !/^\d{6}$/.test(pin)) throw new Error("Saisis ton email ou pseudo et un PIN de 6 chiffres.");
      const values = sheet.getDataRange().getValues();
      const headers = values.length ? values[0].map(String) : [];
      const emailCol = headers.indexOf("Email");
      const pseudoCol = headers.indexOf("Pseudo");
      const hashCol = headers.indexOf("PINHash");
      if (emailCol < 0 || pseudoCol < 0 || hashCol < 0) throw new Error("Les colonnes de connexion sont absentes. Réexécute checkAndCreateSheets ou déploie la version mise à jour.");
      let found = null;
      for (let i = 1; i < values.length; i++) {
        const emailValue = String(values[i][emailCol] || "").trim().toLowerCase();
        const pseudoValue = String(values[i][pseudoCol] || "").trim().toLowerCase();
        if (identifier === emailValue || identifier === pseudoValue) { found = values[i]; break; }
      }
      const accountEmail = found ? String(found[emailCol] || "").trim().toLowerCase() : "";
      if (!found || String(found[hashCol] || "") !== hashProfilePin_(pin, accountEmail)) {
        throw new Error("Email/pseudo ou code PIN incorrect.");
      }
      response = { status: "success", message: "Connexion vérifiée", id: found[0], pseudo: String(found[pseudoCol] || "") };

    } else if (type === "profile") {
      const sheet = ss.getSheetByName(SHEET_PROFILE);
      const nom = String(postData.nom || "").trim();
      const email = String(postData.email || "").trim();
      const telephone = String(postData.telephone || "").trim();
      const pays = String(postData.pays || "").trim();
      const ville = String(postData.ville || "").trim();
      const adresse = String(postData.adresse || "").trim();
      const orientation = String(postData.orientation || "").trim();
      const role = String(postData.role || "").trim();
      const pseudo = String(postData.pseudo || "").trim();
      const pin = String(postData.pin || "").trim();
      const age = Number(postData.age) || 0;
      const ageMinRecherche = Number(postData.ageMinRecherche) || 18;
      const ageMaxRecherche = Number(postData.ageMaxRecherche) || 0;

      if (!nom || !email || !pseudo || !pin || !telephone || !pays || !ville || !orientation ||
          !postData.genre || !postData.statutAmoureux || !postData.relationRecherchee ||
          !postData.genreRecherche || !postData.consentement) {
        throw new Error("Veuillez remplir les champs obligatoires.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse email invalide.");
      if (!/^[A-Za-z0-9_.-]{3,30}$/.test(pseudo)) throw new Error("Le pseudo doit contenir 3 à 30 caractères autorisés.");
      if (!/^\d{6}$/.test(pin)) throw new Error("Le code PIN doit contenir exactement 6 chiffres.");
      const allProfiles = sheet.getDataRange().getValues();
      const profileHeaders = allProfiles.length ? allProfiles[0].map(String) : [];
      const colNom = profileHeaders.indexOf("Nom");
      const colEmail = profileHeaders.indexOf("Email");
      const colPseudo = profileHeaders.indexOf("Pseudo");
      const normalizedNom = normalizeProfileValue_(nom);
      const normalizedEmail = email.toLowerCase();
      const normalizedPseudo = pseudo.toLowerCase();
      for (let r = 1; r < allProfiles.length; r++) {
        if (colEmail >= 0 && String(allProfiles[r][colEmail] || "").trim().toLowerCase() === normalizedEmail) throw new Error("Cette adresse email est déjà utilisée.");
        if (colPseudo >= 0 && String(allProfiles[r][colPseudo] || "").trim().toLowerCase() === normalizedPseudo) throw new Error("Ce pseudo est déjà utilisé.");
        if (colNom >= 0 && normalizeProfileValue_(String(allProfiles[r][colNom] || "")) === normalizedNom) throw new Error("Un profil portant ce nom complet existe déjà. Si c’est toi, utilise la connexion au lieu de créer un autre compte.");
      }
      if (age < 18 || age > 120) throw new Error("Le profil est réservé aux personnes âgées de 18 ans ou plus.");
      if (ageMinRecherche < 18 || ageMaxRecherche < ageMinRecherche || ageMaxRecherche > 120) {
        throw new Error("La tranche d’âge recherchée est invalide.");
      }
      if (orientation === "Homosexuel" && role && !["Actif","Passif","Versatile"].includes(role)) {
        throw new Error("Le rôle choisi est invalide.");
      }

      const profilId = "PROF_" + new Date().getTime();
      const profileRow = [
        profilId, nom, email, telephone, pays, ville, adresse, orientation,
        orientation === "Homosexuel" ? role : "", now, 0, 0,
        age, String(postData.genre || ""), String(postData.statutAmoureux || ""),
        String(postData.enfants || ""), String(postData.relationRecherchee || ""),
        String(postData.presentation || ""), String(postData.interets || ""),
        String(postData.musique || ""), String(postData.personnalite || ""),
        String(postData.valeurs || ""), String(postData.habitudes || ""),
        String(postData.genreRecherche || ""), ageMinRecherche, ageMaxRecherche,
        String(postData.lieuRecherche || ""), String(postData.qualitesRecherchees || ""),
        String(postData.interetsSouhaites || ""), String(postData.importanceRelation || ""),
        String(postData.nonNegociables || ""), String(postData.communication || ""),
        String(postData.distance || ""), String(postData.projets || ""),
        String(postData.complement || ""), String(postData.consentement || ""),
        pseudo, hashProfilePin_(pin, normalizedEmail)
      ];
      sheet.appendRow(profileRow);
      response = { status: "success", message: "Profil enregistré avec succès", id: profilId };
    }
  } catch (err) {
    response = { status: "error", message: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/*******************************************************
   RÉACTIONS — UNE SEULE FOIS PAR UTILISATEUR (STRICT)
*******************************************************/

function headerIndex_(headers, name) {
  const target = String(name).toLowerCase();
  for (let i = 0; i < (headers || []).length; i++) {
    if (normalizeHeaderName_(headers[i]) === target) return i;
  }
  return -1;
}

function normalizeHeaderName_(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function ensureVuesColumn_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const index = headerIndex_(headers, "vues");
  if (index >= 0) return index + 1;
  const column = lastCol + 1;
  sheet.getRange(1, column).setValue("Vues");
  sheet.getRange(1, column).setFontWeight("bold");
  return column;
}

function findEpisodeRow_(sheet, episodeId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(episodeId)) return i + 1;
  }
  return -1;
}

function findReactionType_(ss, episodeId, identity, types) {
  const reactions = ss.getSheetByName(SHEET_REACTIONS);
  if (!reactions || reactions.getLastRow() < 2) return "";
  const data = reactions.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(episodeId) &&
        String(data[i][2]).trim().toLowerCase() === identity &&
        types.indexOf(String(data[i][3])) >= 0) {
      return String(data[i][3]);
    }
  }
  return "";
}

function vote_(ss, p, now) {
  const episodeId = String(p.episodeId || "");
  const identity = String(p.identity || "").trim().toLowerCase();
  const vote = String(p.vote || "");

  if (!identity) throw new Error("Connexion requise pour voter.");
  if (["like", "dislike"].indexOf(vote) === -1) throw new Error("Vote invalide.");

  const sheet = ss.getSheetByName(SHEET_EPISODES);
  const rowIndex = findEpisodeRow_(sheet, episodeId);
  if (rowIndex < 0) throw new Error("Episode introuvable.");

  const COL_LIKE = 7;
  const COL_DISLIKE = 8;

  const reactions = ss.getSheetByName(SHEET_REACTIONS);
  const data = reactions.getDataRange().getValues();
  let voteRow = -1;
  let previousVote = "";
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === episodeId &&
        String(data[i][2]).trim().toLowerCase() === identity &&
        ["like", "dislike"].indexOf(String(data[i][3])) >= 0) {
      voteRow = i + 1;
      previousVote = String(data[i][3]);
      break;
    }
  }

  if (previousVote !== vote) {
    if (previousVote === "like") {
      const val = Number(sheet.getRange(rowIndex, COL_LIKE).getValue()) || 0;
      sheet.getRange(rowIndex, COL_LIKE).setValue(Math.max(0, val - 1));
    }
    if (previousVote === "dislike") {
      const val = Number(sheet.getRange(rowIndex, COL_DISLIKE).getValue()) || 0;
      sheet.getRange(rowIndex, COL_DISLIKE).setValue(Math.max(0, val - 1));
    }
    const targetCol = vote === "like" ? COL_LIKE : COL_DISLIKE;
    const val = Number(sheet.getRange(rowIndex, targetCol).getValue()) || 0;
    sheet.getRange(rowIndex, targetCol).setValue(val + 1);

    if (voteRow > 0) {
      reactions.getRange(voteRow, 4).setValue(vote);
      reactions.getRange(voteRow, 5).setValue(now);
    } else {
      reactions.appendRow(["RX_" + new Date().getTime(), episodeId, identity, vote, now]);
    }
  }

  return {
    status: "success",
    myVote: vote,
    likes: Number(sheet.getRange(rowIndex, COL_LIKE).getValue()) || 0,
    dislikes: Number(sheet.getRange(rowIndex, COL_DISLIKE).getValue()) || 0
  };
}

function view_(ss, p, now) {
  const episodeId = String(p.episodeId || "");
  const identity = String(p.identity || "").trim().toLowerCase();

  if (!identity) throw new Error("Identifiant de visite manquant.");

  const sheet = ss.getSheetByName(SHEET_EPISODES);
  const rowIndex = findEpisodeRow_(sheet, episodeId);
  if (rowIndex < 0) throw new Error("Episode introuvable.");

  const reactions = ss.getSheetByName(SHEET_REACTIONS);
  const rData = reactions.getDataRange().getValues();
  for (let i = 1; i < rData.length; i++) {
    if (String(rData[i][1]) === episodeId &&
        String(rData[i][2]).trim().toLowerCase() === identity &&
        String(rData[i][3]) === "view") {
      const viewsCol = headerIndex_(
        sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0], "vues");
      const current = viewsCol >= 0 ? (Number(sheet.getRange(rowIndex, viewsCol + 1).getValue()) || 0) : 0;
      return { status: "success", counted: false, views: current };
    }
  }

  const viewsCol = ensureVuesColumn_(sheet);
  const current = Number(sheet.getRange(rowIndex, viewsCol).getValue()) || 0;
  sheet.getRange(rowIndex, viewsCol).setValue(current + 1);
  reactions.appendRow(["RX_" + new Date().getTime(), episodeId, identity, "view", now]);

  return { status: "success", counted: true, views: current + 1 };
}

function share_(ss, p) {
  const episodeId = String(p.episodeId || "");
  const sheet = ss.getSheetByName(SHEET_EPISODES);
  const rowIndex = findEpisodeRow_(sheet, episodeId);
  if (rowIndex < 0) throw new Error("Episode introuvable.");

  const COL_SHARE = 9;
  const val = Number(sheet.getRange(rowIndex, COL_SHARE).getValue()) || 0;
  sheet.getRange(rowIndex, COL_SHARE).setValue(val + 1);

  return { status: "success", shares: val + 1 };
}

function normalizeProfileValue_(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function hashProfilePin_(pin, accountEmail) {
  const raw = String(accountEmail || "").trim().toLowerCase() + "|" + String(pin || "");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(digest);
}

function getProfileColumnValue(sheet, row, columnName) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return "";
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const index = headers.indexOf(columnName);
  return index >= 0 ? (row[index] || "") : "";
}

function uploadBase64ToDrive(base64Data, prefix) {
  try {
    const parts = base64Data.split(",");
    const contentType = parts[0].split(";")[0].replace("data:", "");
    const decoded = Utilities.base64Decode(parts[1]);
    let ext = "jpg";
    if (contentType.indexOf("png") !== -1) ext = "png";
    if (contentType.indexOf("webp") !== -1) ext = "webp";
    const fileName = prefix + "_" + new Date().getTime() + "." + ext;
    const blob = Utilities.newBlob(decoded, contentType, fileName);
    const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (error) {
    Logger.log("Erreur Drive: " + error.toString());
    return "";
  }
}

function checkAndCreateSheets(ss) {
  if (!ss.getSheetByName(SHEET_SERIES)) {
    const s1 = ss.insertSheet(SHEET_SERIES);
    s1.appendRow(["ID","Titre Série","Description/HTML","Image","Date","Likes","Dislikes","Shares","Statut"]);
    s1.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SHEET_EPISODES)) {
    const s2 = ss.insertSheet(SHEET_EPISODES);
    s2.appendRow(["ID","SeriesID","Titre Episode","ContenuHTML","Image","Date","Likes","Dislikes","Shares","Statut"]);
    s2.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SHEET_COMMENTS)) {
    const s3 = ss.insertSheet(SHEET_COMMENTS);
    s3.appendRow(["ID","EpisodeID","Pseudo","Message","Date"]);
    s3.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SHEET_STATS)) {
    const s4 = ss.insertSheet(SHEET_STATS);
    s4.appendRow(["Date","Visiteur_ID","Pays","Type_Evenement","Titre_Consulte","ID_Consulte","Device","OS","Navigateur"]);
    s4.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SHEET_REACTIONS)) {
    const s6 = ss.insertSheet(SHEET_REACTIONS);
    s6.appendRow(REACTIONS_HEADERS);
    s6.setFrozenRows(1);
  }

  let profileSheet = ss.getSheetByName(SHEET_PROFILE);
  if (!profileSheet) {
    profileSheet = ss.insertSheet(SHEET_PROFILE);
    profileSheet.getRange(1, 1, 1, PROFILE_HEADERS.length).setValues([PROFILE_HEADERS]);
    profileSheet.setFrozenRows(1);
  } else {
    const lastCol = Math.max(profileSheet.getLastColumn(), 1);
    const currentHeaders = profileSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    PROFILE_HEADERS.forEach(header => {
      if (currentHeaders.indexOf(header) === -1) {
        profileSheet.getRange(1, profileSheet.getLastColumn() + 1).setValue(header);
        currentHeaders.push(header);
      }
    });
    profileSheet.setFrozenRows(1);
  }
}