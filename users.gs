
/*******************************************************
 * BENTOUL CREATION
 * SYSTEME CENTRAL DE GESTION DES UTILISATEURS
 * Google Apps Script + Google Sheets
 * url "https://script.google.com/macros/s/AKfycbySRbMLmlynTN_NJE4IMrYdVs-Gw3KrEAYchg9y7Ncy873k2yjtt626wKbEqiyXkF8/exec"
 *******************************************************/

const CONFIG = {
  SHEET_NAME: "Utilisateurs",
  INITIAL_CREDITS: 10,
  REFERRAL_BONUS: 10
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

function doGet(e) {

  // Compatibilité avec les pages statiques qui ne peuvent pas toujours
  // lire la réponse d'un POST Google Apps Script à cause du CORS.
  const action = e && e.parameter ? e.parameter.action : "";

  if (action === "register") {
    return jsonResponse(registerUser(e.parameter));
  }

  if (action === "login") {
    return jsonResponse(loginUser(e.parameter));
  }

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
 * 11. INSCRIPTION UTILISATEUR
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
