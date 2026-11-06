/* BENTOUL CREATION — configuration unique des URLs.
   Les URLs Apps Script vivent ici et nulle part ailleurs. */
window.BTM_CONFIG = {
  // user.gs — comptes BENTOUL CREATION (feuille Utilisateurs)
  API_URL:
    "https://script.google.com/macros/s/AKfycbyGkXcc6JKx5qxwj7wWX_L8maGeXhmDWMT8a9MnWzd44D5LmJeQ_TfAfAsDTQ7QqJZ-/exec",

  // benamoura.gs — séries et épisodes (feuilles Series / Episodes)
  BENAMOURA_API_URL:
    "https://script.google.com/macros/s/AKfycbxkD29sIlujry6c4m7feYxCwlh0_OcGyvmdJ2Z044xLu1rV9hAEFSp8ZyWpQD6qOOoYvw/exec",

  // bentoul.gs — séries et épisodes BENTOUL. Tant que cette chaîne est vide,
  // les pages bentoul/*.html utilisent l'API benamoura (fallback de démo).
  // Colle ici l'URL /exec de ton déploiement bentoul.gs pour basculer.
  BENTOUL_API_URL: "https://script.google.com/macros/s/AKfycbwut6DoOJLG0oUfWhFNpDWS9OAIouuAMZSj9pMrZGBHIdcYuklD1tAaL62F5NCTFvAK/exec",

  LOGIN_PAGE: "/users.html",
  PROFILE_PAGE: "/profile.html",
  SERIES_PAGE: "/benamoura.html",
  EPISODES_PAGE: "/benamoura/e.html",
  READER_PAGE: "/benamoura/l.html",
  BENTOUL_SERIES_PAGE: "/bentoul.html",
  BENTOUL_EPISODES_PAGE: "/bentoul/e.html",
  BENTOUL_READER_PAGE: "/bentoul/l.html",

  /* ESPACES PUBLICITAIRES (chargés seulement quand visibles).
     Si ADSENSE_CLIENT est renseigné, Google AdSense est prioritaire ;
     sinon le réseau "bunlon" (script biomanos) est utilisé. */
  ADS: {
    BUNLON_KEY: "e1fU52b3U1LFvRi4QtLLF8BbjJ3Y6mKbK5",
    BUNLON_SRC: "https://biomanos.org/22/e1fU52b3U1LFvRi4QtLLF8BbjJ3Y6mKbK5",
    BUNLON_WIDTH: 320,
    BUNLON_HEIGHT: 50,
    // AdSense : colle ton publisher id "ca-pub-..." et ton slot pour activer AdSense.
    ADSENSE_CLIENT: "",
    ADSENSE_SLOT: ""
  }
};
