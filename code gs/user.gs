
/*******************************************************
 * BENTOUL CREATION
 * SYSTEME CENTRAL DE GESTION DES UTILISATEURS
 * Google Apps Script + Google Sheets
 *******************************************************/

const CONFIG = {
  SHEET_NAME: "Utilisateurs",
  SHEET_DEBLOCAGES: "Deblocages",
  EPISODE_CREDIT_COST: 1,
  INITIAL_CREDITS: 10,
  REFERRAL_BONUS: 10,
  SESSION_TTL_DAYS: 30
};

const HEADERS = [
  "ID",
  "Nom",
  "Username",
  "PINHash",
  "Email",
  "Numero",
  "Credits",
  "CodeReference",
  "Parrain",
  "DateCreation"
];


/*******************************************************
 * 1. CONNEXION A LA BASE DE DONNEES
 *******************************************************/

function getDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      "Aucun Google Sheets associé à ce projet Apps Script."
    );
  }

  return ss;
}


/*******************************************************
 * 2. RECUPERATION DE LA FEUILLE UTILISATEURS
 *******************************************************/

function getUserSheet() {
  const ss = getDatabase();

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}


/*******************************************************
 * 3. INITIALISATION DE LA BASE DE DONNEES
 *******************************************************/

function setupDatabase() {

  const ss = getDatabase();

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  const firstRow = sheet.getRange(
    1, 1, 1, HEADERS.length
  ).getValues()[0];

  const isEmpty = firstRow.every(
    value => value === ""
  );

  if (isEmpty) {
    sheet.getRange(
      1, 1, 1, HEADERS.length
    ).setValues([HEADERS]);
  }

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, HEADERS.length)
       .setFontWeight("bold");

  return "Base de données BENTOUL CREATION initialisée.";
}


/*******************************************************
 * 4. REPONSE JSON
 *******************************************************/

function jsonResponse(data) {

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

}


/*******************************************************
 * 5. API GET
 *******************************************************/

function doGet() {

  return jsonResponse({
    success: true,
    application: "BENTOUL CREATION",
    message: "API opérationnelle.",
    version: "1.0"
  });

}


/*******************************************************
 * 6. GENERATION ID UTILISATEUR
 *******************************************************/

function generateUserID() {

  return "USER-" +
    Utilities.getUuid()
      .replace(/-/g, "")
      .substring(0, 12)
      .toUpperCase();

}


/*******************************************************
 * 7. GENERATION CODE REFERENCE
 * Format : BC-123ABC
 *******************************************************/

function generateReference() {

  const numbers = "0123456789";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let code = "BC-";

  for (let i = 0; i < 3; i++) {
    code += numbers[
      Math.floor(Math.random() * numbers.length)
    ];
  }

  for (let i = 0; i < 3; i++) {
    code += letters[
      Math.floor(Math.random() * letters.length)
    ];
  }

  return code;

}


/*******************************************************
 * 8. HASH SECURISE DU PIN
 *******************************************************/

function hashPIN(pin) {

  const salt = Utilities.getUuid();

  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + pin,
    Utilities.Charset.UTF_8
  );

  const hash = bytes.map(function(byte) {

    return ("0" + ((byte + 256) % 256)
      .toString(16)).slice(-2);

  }).join("");

  return salt + ":" + hash;

}


/*******************************************************
 * 9. VERIFICATION DU PIN
 *******************************************************/

function verifyPIN(pin, storedHash) {

  const parts = String(storedHash).split(":");

  if (parts.length !== 2) {
    return false;
  }

  const salt = parts[0];

  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + pin,
    Utilities.Charset.UTF_8
  );

  const hash = bytes.map(function(byte) {

    return ("0" + ((byte + 256) % 256)
      .toString(16)).slice(-2);

  }).join("");

  return hash === parts[1];

}


/*******************************************************
 * 10. GENERATION CODE UNIQUE
 *******************************************************/

function generateUniqueReference(users) {

  let code;
  let exists;

  do {

    code = generateReference();

    exists = users.some(function(user) {
      return String(user[7]).toUpperCase() === code;
    });

  } while (exists);

  return code;

}


/*******************************************************
 * 11bis. SESSIONS (TOKENS)
 *******************************************************/

function sessionStore() {
  return PropertiesService.getScriptProperties();
}

function createSession(username) {

  const store = sessionStore();
  const token = Utilities.getUuid().replace(/-/g, "");

  store.setProperty(
    "SESSION_" + token,
    JSON.stringify({
      username: String(username).toLowerCase(),
      expires: Date.now() + CONFIG.SESSION_TTL_DAYS * 86400000
    })
  );

  return token;
}

function resolveSession(token) {

  const store = sessionStore();
  const raw = store.getProperty("SESSION_" + String(token || "").trim());

  if (!raw) {
    return null;
  }

  let session;

  try {
    session = JSON.parse(raw);
  } catch (error) {
    return null;
  }

  if (!session || Date.now() > Number(session.expires)) {
    store.deleteProperty("SESSION_" + String(token).trim());
    return null;
  }

  return session;
}

function findUserRow(usernameLower) {

  const sheet = getUserSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const users = sheet.getRange(
    2, 1, lastRow - 1, HEADERS.length
  ).getValues();

  const row = users.find(function(user) {
    return String(user[2]).toLowerCase() === usernameLower;
  });

  return row || null;
}

function userPayload(user) {

  return {
    id: user[0],
    nom: user[1],
    username: user[2],
    email: user[4],
    numero: user[5],
    credits: Number(user[6]) || 0,
    codeReference: user[7],
    parrain: user[8],
    dateCreation: user[9] instanceof Date
      ? Utilities.formatDate(user[9], Session.getScriptTimeZone(), "dd/MM/yyyy")
      : String(user[9] || "")
  };
}

function profileAction(data) {

  const session = resolveSession(data.token);

  if (!session) {
    return {
      success: false,
      code: "SESSION_INVALID",
      message: "Session expirée. Reconnecte-toi."
    };
  }

  const user = findUserRow(session.username);

  if (!user) {
    return {
      success: false,
      code: "SESSION_INVALID",
      message: "Compte introuvable. Reconnecte-toi."
    };
  }

  return {
    success: true,
    user: userPayload(user)
  };
}

function logoutAction(data) {

  const store = sessionStore();
  const key = "SESSION_" + String(data.token || "").trim();

  if (store.getProperty(key)) {
    store.deleteProperty(key);
  }

  return { success: true, message: "Déconnexion effectuée." };
}


/*******************************************************
 * 11ter. DEBLOCAGE D'EPISODES (1 CREDIT)
 *******************************************************/

function getDeblocagesSheet() {
  const ss = getDatabase();

  let sheet = ss.getSheetByName(CONFIG.SHEET_DEBLOCAGES);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_DEBLOCAGES);
    sheet.appendRow(["ID", "Username", "EpisodeID", "Date"]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getUnlocksAction(data) {

  const session = resolveSession(data.token);

  if (!session) {
    return {
      success: false,
      code: "SESSION_INVALID",
      message: "Session expirée. Reconnecte-toi."
    };
  }

  const sheet = getDeblocagesSheet();

  if (sheet.getLastRow() < 2) {
    return { success: true, episodes: [] };
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  const episodes = rows
    .filter(function (row) {
      return String(row[1]).toLowerCase() === session.username;
    })
    .map(function (row) { return String(row[2]); });

  return { success: true, episodes: episodes };
}

function unlockEpisodeAction(data) {

  const session = resolveSession(data.token);

  if (!session) {
    return {
      success: false,
      code: "SESSION_INVALID",
      message: "Session expirée. Reconnecte-toi."
    };
  }

  const episodeId = String(data.episodeId || "").trim();

  if (!episodeId) {
    return { success: false, message: "Episode manquant." };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(20000);
  } catch (error) {
    return { success: false, message: "Serveur occupé, réessaie dans quelques secondes." };
  }

  try {
    const sheet = getDeblocagesSheet();

    const alreadyUnlocked = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 4)
      .getValues()
      .some(function (row) {
        return String(row[1]).toLowerCase() === session.username &&
          String(row[2]) === episodeId;
      });

    if (alreadyUnlocked) {
      const user = findUserRow(session.username);
      return {
        success: true,
        alreadyUnlocked: true,
        credits: user ? (Number(user[6]) || 0) : 0,
        message: "Épisode déjà débloqué."
      };
    }

    const usersSheet = getUserSheet();
    const lastRow = usersSheet.getLastRow();
    const values = usersSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

    let userRowIndex = -1;
    let credits = 0;

    for (let i = 0; i < values.length; i++) {
      if (String(values[i][2]).toLowerCase() === session.username) {
        userRowIndex = i + 2;
        credits = Number(values[i][6]) || 0;
        break;
      }
    }

    if (userRowIndex < 0) {
      return {
        success: false,
        code: "SESSION_INVALID",
        message: "Compte introuvable. Reconnecte-toi."
      };
    }

    if (credits < CONFIG.EPISODE_CREDIT_COST) {
      return {
        success: false,
        code: "NO_CREDITS",
        message: "Crédits insuffisants : il te faut " + CONFIG.EPISODE_CREDIT_COST +
          " crédit pour débloquer cet épisode."
      };
    }

    const creditCell = usersSheet.getRange(userRowIndex, 7);
    creditCell.setValue(credits - CONFIG.EPISODE_CREDIT_COST);

    sheet.appendRow([
      "DBG_" + new Date().getTime(),
      session.username,
      episodeId,
      new Date()
    ]);

    return {
      success: true,
      credits: credits - CONFIG.EPISODE_CREDIT_COST,
      message: "Épisode débloqué !"
    };
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}



/*******************************************************
 * 12. INSCRIPTION UTILISATEUR
 *******************************************************/

function registerUser(data) {

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const sheet = getUserSheet();

    const nom = String(data.nom || "").trim();
    const username = String(data.username || "").trim();
    const pin = String(data.pin || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const numero = String(data.numero || "").trim();
    const parrain = String(data.parrain || "").trim().toUpperCase();

    // Validation des champs

    if (!nom || !username || !pin || !email || !numero) {
      throw new Error("Veuillez remplir tous les champs obligatoires.");
    }

    if (!/^\d{6}$/.test(pin)) {
      throw new Error("Le PIN doit contenir exactement 6 chiffres.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Adresse email invalide.");
    }

    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
      throw new Error("Username invalide. Utilisez 3 à 30 caractères.");
    }

    if (nom.length > 100 || email.length > 254 ||
        numero.length > 30) {
      throw new Error("Un ou plusieurs champs sont trop longs.");
    }

    // Lecture des utilisateurs existants

    const lastRow = sheet.getLastRow();

    const users = lastRow >= 2
      ? sheet.getRange(
          2, 1, lastRow - 1, HEADERS.length
        ).getValues()
      : [];

    // Vérification des doublons

    for (let i = 0; i < users.length; i++) {

      const existingUsername =
        String(users[i][2]).toLowerCase();

      const existingEmail =
        String(users[i][4]).toLowerCase();

      const existingNumero =
        String(users[i][5]).replace(/\s/g, "");

      if (existingUsername === username.toLowerCase()) {
        throw new Error("Ce username est déjà utilisé.");
      }

      if (existingEmail === email) {
        throw new Error("Cette adresse email est déjà utilisée.");
      }

      if (existingNumero === numero.replace(/\s/g, "")) {
        throw new Error("Ce numéro est déjà enregistré.");
      }

    }

    // Vérification du parrain

    let parrainIndex = -1;

    if (parrain) {

      parrainIndex = users.findIndex(function(user) {
        return String(user[7]).toUpperCase() === parrain;
      });

      if (parrainIndex === -1) {
        throw new Error("Code de parrainage invalide.");
      }

    }

    // Création du compte

    const userID = generateUserID();
    const codeReference = generateUniqueReference(users);

    const user = [
      userID,
      nom,
      username,
      hashPIN(pin),
      email,
      numero,
      CONFIG.INITIAL_CREDITS,
      codeReference,
      parrain,
      new Date()
    ];

    // Enregistrement

    sheet.appendRow(user);

    // Bonus du parrain
    // Uniquement après la création réussie du compte.

    if (parrainIndex !== -1) {

      const parrainRow = parrainIndex + 2;

      const creditsCell = sheet.getRange(parrainRow, 7);

      const currentCredits =
        Number(creditsCell.getValue()) || 0;

      creditsCell.setValue(
        currentCredits + CONFIG.REFERRAL_BONUS
      );

    }

    // Réponse au frontend

    return {
      success: true,
      message: "Inscription effectuée avec succès !",
      token: createSession(username),

      user: {
        id: userID,
        nom: nom,
        username: username,
        email: email,
        numero: numero,
        credits: CONFIG.INITIAL_CREDITS,
        codeReference: codeReference,
        parrain: parrain
      }

    };

  } catch (error) {

    return {
      success: false,
      message: error.message
    };

  } finally {

    if (lock.hasLock()) {
      lock.releaseLock();
    }

  }

}


/*******************************************************
 * 12. RECEPTION DES DONNEES DU FORMULAIRE
 *******************************************************/

function doPost(e) {

  try {

    if (!e || !e.parameter) {
      throw new Error("Aucune donnée reçue.");
    }

    const data = e.parameter;

  
    switch (data.action) {

  case "register":
    return jsonResponse(registerUser(data));

  case "login":
    return jsonResponse(loginUser(data));

  case "profile":
    return jsonResponse(profileAction(data));

  case "logout":
    return jsonResponse(logoutAction(data));

  case "getUnlocks":
    return jsonResponse(getUnlocksAction(data));

  case "unlockEpisode":
    return jsonResponse(unlockEpisodeAction(data));

  default:
    return jsonResponse({
      success: false,
      message: "Action inconnue."
    });
}


  } catch (error) {

    return jsonResponse({
      success: false,
      message: error.message
    });

  }

}


/*******************************************************
 * 13. CONNEXION UTILISATEUR
 *******************************************************/

function loginUser(data) {

  const username = String(data.username || "").trim();
  const pin = String(data.pin || "").trim();

  if (!username || !pin) {
    return {
      success: false,
      message: "Veuillez saisir votre username et votre PIN."
    };
  }

  if (!/^\d{6}$/.test(pin)) {
    return {
      success: false,
      message: "Le PIN doit contenir 6 chiffres."
    };
  }

  const sheet = getUserSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      success: false,
      message: "Identifiants incorrects."
    };
  }

  const users = sheet.getRange(
    2, 1, lastRow - 1, HEADERS.length
  ).getValues();

  const user = users.find(function(row) {
    return String(row[2]).toLowerCase() === username.toLowerCase();
  });

  if (!user || !verifyPIN(pin, user[3])) {
    return {
      success: false,
      message: "Username ou PIN incorrect."
    };
  }

  return {
    success: true,
    message: "Connexion réussie !",
    token: createSession(username),
    user: {
      id: user[0],
      nom: user[1],
      username: user[2],
      email: user[4],
      numero: user[5],
      credits: Number(user[6]) || 0,
      codeReference: user[7],
      parrain: user[8]
    }
  };
}
