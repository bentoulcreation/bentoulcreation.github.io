/* ============================================================
   Données de l'application — modifie ce fichier pour publier
   de nouvelles astuces, séries et épisodes.
   ============================================================ */

const CATEGORIES = [
  { id: "reseau",      name: "Réseaux & Wi-Fi", icon: "wifi",     color: "#0ea5e9" },
  { id: "securite",    name: "Sécurité",        icon: "shield",   color: "#ef4444" },
  { id: "windows",     name: "Windows & PC",    icon: "monitor",  color: "#6366f1" },
  { id: "mobile",      name: "Smartphone",      icon: "phone",    color: "#10b981" },
  { id: "web",         name: "Web & Dev",       icon: "code",     color: "#8b5cf6" },
  { id: "bureautique", name: "Bureautique",     icon: "grid",     color: "#f59e0b" }
];

const TIPS = [
  {
    id: "mot-de-passe",
    cat: "securite",
    featured: true,
    title: "5 réflexes pour un mot de passe vraiment solide",
    excerpt: "La longueur bat la complexité : des mots de passe faciles à retenir et très difficiles à casser.",
    minutes: 4,
    date: "12 nov. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "On nous répète d'ajouter une majuscule, un chiffre et un symbole. Résultat : des mots de passe comme « Ete2024! » que les outils de piratage testent en quelques secondes. La vraie règle, c'est la longueur." },
      { t: "h", x: "1. Une phrase de passe plutôt qu'un mot" },
      { t: "p", x: "Quatre mots courants mis bout à bout — « lampe-sable-orange-velo » — donnent 26 caractères faciles à retenir et très longs à deviner. Chaque caractère supplémentaire multiplie les combinaisons possibles." },
      { t: "h", x: "2. Un mot de passe unique par service" },
      { t: "p", x: "La réutilisation est le vrai danger : une fuite sur un forum devient une clé pour ta boîte mail, puis pour ta banque. Un gestionnaire de mots de passe retient tout à ta place." },
      { t: "ul", items: [
        "Active la double authentification sur la messagerie et la banque.",
        "Ne réutilise jamais le même mot de passe sur deux services.",
        "Note la phrase de passe du gestionnaire sur papier, chez toi."
      ] },
      { t: "tip", x: "Le maillon faible n'est pas le mot de passe, c'est sa réutilisation." },
      { t: "h", x: "3. Vérifie les fuites une fois par an" },
      { t: "p", x: "Sur haveibeenpwned.com, saisis ton adresse : le site indique les fuites connues. Si elle apparaît, change le mot de passe concerné et active la double authentification." },
      { t: "h", x: "4. Ne partage jamais par SMS ou messagerie" },
      { t: "p", x: "Un mot de passe envoyé par message reste dans l'historique, parfois sauvegardé dans le cloud. Pour partager un accès, utilise la fonction de partage du gestionnaire, avec une expiration." },
      { t: "h", x: "5. Fais le tri" },
      { t: "p", x: "Supprime les comptes inutilisés : vieux forums, essais gratuits, boutiques oubliées. Moins de comptes, c'est moins de surface d'attaque et moins de mots de passe à retenir." }
    ]
  },
  {
    id: "wifi-lent",
    cat: "reseau",
    featured: true,
    title: "Wi-Fi lent ? Les 6 réglages à vérifier avant d'appeler le support",
    excerpt: "Avant de payer un technicien, ces vérifications simples règlent une bonne partie des lenteurs.",
    minutes: 6,
    date: "10 nov. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "Une connexion lente n'est pas toujours la faute de l'opérateur. Avant de payer un déplacement, six vérifications règlent une bonne partie des cas." },
      { t: "h", x: "1. Teste au bon endroit" },
      { t: "p", x: "Fais un test de débit à un mètre de la box, puis dans la pièce où le problème apparaît. Si le débit s'effondre, le souci est la couverture Wi-Fi, pas la ligne." },
      { t: "h", x: "2. Choisis le bon canal" },
      { t: "p", x: "En 2,4 GHz, les voisins saturent souvent les mêmes canaux. Passe sur la bande 5 GHz si tes appareils la supportent : moins de portée, beaucoup plus de débit." },
      { t: "h", x: "3. Repositionne la box" },
      { t: "p", x: "La box aime les endroits dégagés et en hauteur. Évite de l'enfermer dans un meuble, près du micro-ondes ou derrière un mur porteur." },
      { t: "h", x: "4. Compte les appareils" },
      { t: "ul", items: [
        "Un smartphone, une télé, deux ordinateurs et une console peuvent saturer une petite ligne.",
        "Coupe les mises à jour automatiques pendant un appel visio.",
        "Limite le nombre d'appareils connectés en permanence."
      ] },
      { t: "h", x: "5. Redémarre proprement" },
      { t: "p", x: "Débranche la box 30 secondes, rebranche, attends la fin de la synchronisation. Un redémarrage simple résout une part étonnante des lenteurs." },
      { t: "h", x: "6. Vérifie le câble" },
      { t: "p", x: "Un câble Ethernet abîmé ou trop long peut brider la connexion. Essaie un autre câble avant de conclure." },
      { t: "tip", x: "Si le débit est bon en filaire mais mauvais en Wi-Fi, le problème est chez toi — pas chez l'opérateur." }
    ]
  },
  {
    id: "demarrage-windows",
    cat: "windows",
    title: "PC lent au démarrage : nettoie les programmes lancés automatiquement",
    excerpt: "Trois minutes de réglage pour retrouver un ordinateur qui s'allume sans attendre.",
    minutes: 5,
    date: "8 nov. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "Un ordinateur qui met trois minutes à démarrer ne manque souvent pas de puissance : il lance simplement vingt programmes avant de te laisser travailler." },
      { t: "h", x: "Le geste qui change tout" },
      { t: "ul", items: [
        "Ouvre le Gestionnaire des tâches avec Ctrl + Maj + Échap.",
        "Va dans l'onglet « Démarrage ».",
        "Désactive les logiciels non essentiels : lecteurs de musique, mises à jour d'imprimante, launchers de jeux.",
        "Redémarre et chronomètre la différence."
      ] },
      { t: "p", x: "Sur Windows 11, le chemin est Paramètres > Applications > Démarrage. Désactiver un programme ici ne le supprime pas : il ne se lance simplement plus tout seul." },
      { t: "h", x: "Nettoie le disque" },
      { t: "ul", items: [
        "Désinstalle les logiciels que tu n'ouvres jamais.",
        "Utilise le Nettoyage de disque pour les fichiers temporaires.",
        "Garde au moins 15 % d'espace libre : un disque plein ralentit tout."
      ] },
      { t: "h", x: "Vérifie les mises à jour" },
      { t: "p", x: "Un système à jour gère mieux les pilotes et les veilles. Laisse les mises à jour se faire la nuit, branché, une fois par mois." },
      { t: "tip", x: "Passer à un SSD change plus la vie qu'un processeur plus rapide." }
    ]
  },
  {
    id: "liberer-espace",
    cat: "mobile",
    title: "Libérer 5 Go sans supprimer une seule photo",
    excerpt: "Caches, vidéos automatiques et jeux oubliés : par où commencer pour récupérer de la place.",
    minutes: 4,
    date: "6 nov. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "Supprimer des photos pour gagner de la place, c'est dommage. Voici par où commencer pour récupérer plusieurs gigaoctets sans rien perdre." },
      { t: "ul", items: [
        "Vide le cache de WhatsApp : Réglages > Stockage et données > Gérer le stockage. Les conversations restent, les médias déjà vus repartent.",
        "Désactive la lecture automatique des vidéos sur les réseaux : elles téléchargent des dizaines de mégaoctets.",
        "Supprime les jeux auxquels tu ne joues plus : souvent 1 à 3 Go à eux seuls.",
        "Active la sauvegarde des photos dans le cloud, puis utilise l'option « Libérer de l'espace »."
      ] },
      { t: "h", x: "Les vidéos pèsent le plus lourd" },
      { t: "p", x: "Une minute de vidéo 4K peut dépasser 300 Mo. Parcours la galerie en triant par taille : ce sont souvent des vidéos oubliées qui prennent le plus de place." },
      { t: "tip", x: "Vide aussi le dossier Téléchargements : les PDF et installeurs oubliés s'y accumulent." }
    ]
  },
  {
    id: "structure-app",
    cat: "web",
    featured: true,
    title: "Une app mobile en HTML/CSS/JS : la structure en 3 fichiers",
    excerpt: "Pas besoin de framework. Une coquille fixe, un routeur simple et des données séparées.",
    minutes: 7,
    date: "4 nov. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "Une application mobile en HTML, CSS et JavaScript ne demande pas de framework. Trois fichiers suffisent pour une base propre, rapide et facile à maintenir." },
      { t: "h", x: "La structure" },
      { t: "code", x: "index.html\nassets/\n  css/app.css\n  js/data.js\n  js/app.js" },
      { t: "p", x: "index.html ne contient que la coquille : en-tête fixe, zone de contenu, pied fixe, tiroir latéral. Tout le reste est injecté par JavaScript." },
      { t: "code", x: '<section class="app-shell">\n  <header class="app-header">...</header>\n  <aside class="drawer">...</aside>\n  <main id="main" class="app-main"></main>\n  <nav class="tabbar">...</nav>\n</section>' },
      { t: "h", x: "Le CSS mobile natif" },
      { t: "p", x: "Trois détails font la différence : la hauteur en dvh (pour la barre du navigateur mobile), les marges de sécurité avec env(safe-area-inset-*), et le surlignage bleu désactivé au toucher." },
      { t: "code", x: ":root { --header-h: 56px; --tab-h: 64px; }\n.app-shell { height: 100dvh; overflow: hidden; }\nhtml { -webkit-tap-highlight-color: transparent; }" },
      { t: "h", x: "Le routeur" },
      { t: "p", x: "Garde une pile d'écrans : un tableau. Naviguer empile, revenir dépile. Dix lignes suffisent pour gérer le bouton retour et les transitions." },
      { t: "tip", x: "Ce site est construit exactement comme ça : ouvre les fichiers pour voir." },
      { t: "h", x: "Les données" },
      { t: "p", x: "Sépare le contenu du code : un fichier data.js avec les astuces et les épisodes permet à une personne non développeuse de mettre le site à jour sans rien casser." }
    ]
  },
  {
    id: "recherchev",
    cat: "bureautique",
    title: "Excel : RECHERCHEX expliquée avec un exemple simple",
    excerpt: "Plus simple et plus sûre que RECHERCHEV, elle fonctionne même vers la gauche.",
    minutes: 5,
    date: "2 nov. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "RECHERCHEX (XLOOKUP en anglais) remplace avantageusement RECHERCHEV : plus simple, plus sûre, et elle fonctionne dans les deux sens." },
      { t: "code", x: '=RECHERCHEX(A2; Feuille2!B:B; Feuille2!D:D; "Introuvable")' },
      { t: "p", x: "A2 est la valeur cherchée, la première plage contient les valeurs à comparer, la seconde ce qu'on veut ramener. Le quatrième argument affiche un texte si rien n'est trouvé." },
      { t: "ul", items: [
        "Pas besoin de compter les colonnes, contrairement à RECHERCHEV.",
        "La recherche peut se faire vers la gauche.",
        "Un seul argument pour gérer les valeurs absentes."
      ] },
      { t: "tip", x: "Si ta version d'Excel ne connaît pas RECHERCHEX, utilise INDEX + EQUIV." }
    ]
  },
  {
    id: "faux-sms",
    cat: "securite",
    title: "Reconnaître un faux SMS de livraison en 10 secondes",
    excerpt: "Le « colis en attente » est le piège le plus courant. Les signaux qui ne trompent pas.",
    minutes: 3,
    date: "31 oct. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "« Votre colis est en attente, payez 1,99 € de frais » : ce message circule encore beaucoup. Voici les signaux qui ne trompent pas." },
      { t: "ul", items: [
        "L'expéditeur est un numéro mobile ordinaire, pas un numéro court d'entreprise.",
        "Un lien étrange (colis-suivi.info, bits.ly...) au lieu du site officiel.",
        "On te demande de payer une somme minuscule : c'est un appât.",
        "Le message est pressé : « sous 24 h sinon retour à l'expéditeur ».",
        "Aucun numéro de suivi ne correspond à une commande réelle."
      ] },
      { t: "h", x: "Que faire" },
      { t: "p", x: "Ne clique pas, ne réponds pas. Supprime le message et signale-le comme spam (33700 pour les SMS). Si tu as saisi tes informations bancaires, contacte immédiatement ta banque : le remboursement est possible si tu agis vite." },
      { t: "tip", x: "En cas de doute, ouvre toi-même le site du transporteur — jamais par le lien du message." }
    ]
  },
  {
    id: "git-quotidien",
    cat: "web",
    title: "Git : les 5 commandes du quotidien",
    excerpt: "Cinq commandes couvrent 90 % du travail. Le reste, tu l'apprendras quand tu en auras besoin.",
    minutes: 4,
    date: "29 oct. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "Pas besoin d'apprendre Git en entier. Cinq commandes couvrent 90 % du travail quotidien." },
      { t: "code", x: 'git status          # où en suis-je ?\ngit add .           # préparer les changements\ngit commit -m "..." # enregistrer une étape\ngit pull            # récupérer les nouveautés\ngit push            # envoyer son travail' },
      { t: "h", x: "Les réflexes" },
      { t: "ul", items: [
        "Committe petit et souvent : un commit = une idée.",
        "Lis git status avant chaque commande : il te dit quoi faire.",
        "Fais git diff avant de committer pour relire ce que tu envoies."
      ] },
      { t: "tip", x: "Une branche par fonctionnalité : git checkout -b ma-fonctionnalite." }
    ]
  },
  {
    id: "sauvegarde-photos",
    cat: "mobile",
    title: "Sauvegarder ses photos automatiquement (et vérifier que ça marche)",
    excerpt: "Perdre un téléphone ne devrait pas signifier perdre dix ans de souvenirs.",
    minutes: 3,
    date: "26 oct. 2026",
    author: "BCréation",
    body: [
      { t: "p", x: "Perdre un téléphone ne devrait pas signifier perdre dix ans de photos. La sauvegarde automatique prend cinq minutes à configurer, une fois." },
      { t: "ul", items: [
        "Google Photos, iCloud ou un NAS : choisis un service et active la sauvegarde automatique.",
        "Garde la qualité d'origine si tu as de la place, sinon la qualité « économique » reste correcte.",
        "Vérifie une fois par mois que la dernière photo est bien sauvegardée.",
        "Exporte tes souvenirs importants sur un disque dur, une fois par an."
      ] },
      { t: "tip", x: "La règle 3-2-1 : trois copies, deux supports différents, une hors de chez toi." }
    ]
  }
];

const STORIES = [
  {
    id: "messages-2h",
    title: "Nos messages à 2 h du matin",
    tagline: "Deux inconnus, un fil de discussion, et des nuits qui raccourcissent.",
    author: "Lina B.",
    genre: "Romance contemporaine",
    status: "En cours",
    letter: "N",
    colors: ["#ff7a9c", "#7c3aed"],
    synopsis: "Un soir, Inès envoie un message au mauvais numéro. La réponse arrive à 2 h du matin, et elle est drôle. Un an plus tard, ils parlent encore toutes les nuits, sans jamais s'être vus.",
    episodes: [
      {
        n: 1,
        title: "Le message envoyé par erreur",
        minutes: 6,
        date: "12 nov. 2026",
        body: [
          { t: "p", x: "Inès n'avait pas prévu d'envoyer ce message. Encore moins à 23 h 47, un mardi, avec son pyjama à licornes et la pluie qui tambourinait sur la vitre." },
          { t: "p", x: "« Tu as laissé ton écharpe au café. Elle sent la cannelle. » Le message était destiné à Camille. Il est parti chez un inconnu. Le numéro avait un 7 au lieu d'un 1." },
          { t: "p", x: "Trente secondes plus tard, le téléphone vibra. « Je n'ai pas d'écharpe, mais maintenant j'ai envie d'une cannelle. »" },
          { t: "p", x: "Inès fixa l'écran. Écrire « désolée, mauvaise personne » aurait été la réponse normale. Mais il pleuvait, et la journée avait été longue." },
          { t: "p", x: "« Je suis navrée, mauvaise destinataire. » — « Navrée ? Une écharpe qui sent bon, c'est plutôt une bonne nouvelle. »" },
          { t: "quote", x: "Elle sourit sans savoir pourquoi. C'est toujours comme ça que ça commence." },
          { t: "p", x: "Ils s'écrivirent jusqu'à 2 h du matin. Pas de prénom, pas de photo. Juste des phrases courtes qui devenaient de plus en plus longues." }
        ]
      },
      {
        n: 2,
        title: "Le premier « bonne nuit »",
        minutes: 7,
        date: "14 nov. 2026",
        body: [
          { t: "p", x: "Le lendemain, Inès se dit qu'elle ne répondrait pas. Elle tint bon jusqu'à 21 h." },
          { t: "p", x: "« Alors, cette écharpe ? » — « Toujours perdue. Enfin, elle est avec moi. » — « Donc tu mens depuis le début. » — « Seulement sur l'écharpe. »" },
          { t: "p", x: "Ce soir-là, ils se donnèrent des prénoms. Enfin : des prénoms approximatifs. Lui, c'était « le type qui boit du café à 22 h ». Elle, « la fille qui compte les nuages »." },
          { t: "p", x: "À 1 h 58, il écrivit : « Il faudrait dormir. » Elle répondit : « D'accord. Dans une heure. »" },
          { t: "p", x: "Ils se dirent bonne nuit à 3 h 12. Inès posa son téléphone sur l'oreiller, le sourire idiot des gens qui viennent de trouver quelqu'un pour tenir leurs insomnies." },
          { t: "quote", x: "Le pire et le meilleur de ces conversations : personne ne se voyait, et tout le monde était sincère." }
        ]
      },
      {
        n: 3,
        title: "Ce que tu ne dis pas",
        minutes: 8,
        date: "16 nov. 2026",
        body: [
          { t: "p", x: "Une semaine plus tard, il disparut deux jours. Pas de « bonjour », pas de blague, rien. Inès relut leurs trois cents messages en se demandant ce qu'elle avait bien pu écrire de trop." },
          { t: "p", x: "Il revint un jeudi, à 23 h. « Mon père a été hospitalisé. Rien de grave. Enfin si, un peu. »" },
          { t: "p", x: "Elle tapa « je suis désolée », effaça, tapa « veux-tu en parler ? », effaça encore. Elle écrivit finalement : « Je suis là. Même à 2 h. Surtout à 2 h. »" },
          { t: "p", x: "Pour la première fois, il mit quatre minutes à répondre. « C'est la chose la plus gentille qu'on m'ait dite cette semaine. »" },
          { t: "p", x: "Ils ne parlèrent pas de son père ce soir-là. Mais à 2 h 03, il demanda : « On fait quoi, nous ? »" },
          { t: "quote", x: "Inès regarda la question pendant une éternité. Elle n'y répondit pas. C'est là que tout commença vraiment." }
        ]
      },
      { n: 4, title: "La voix au téléphone", locked: true },
      { n: 5, title: "2 h 03", locked: true },
      { n: 6, title: "Le café de trop", locked: true },
      { n: 7, title: "Retour à la case départ", locked: true },
      { n: 8, title: "Le dernier message", locked: true }
    ]
  },
  {
    id: "villa-12",
    title: "L'été de la villa 12",
    tagline: "Un été, deux familles, et une piscine qui n'a jamais été aussi petite.",
    author: "Marc A.",
    genre: "Romance d'été",
    status: "En cours",
    letter: "V",
    colors: ["#f59e0b", "#e11d48"],
    synopsis: "Chaque été, la villa 12 accueille deux familles qui se tolèrent depuis vingt ans. Cette année, les enfants ont grandi, et le mur entre les deux jardins semble beaucoup moins haut.",
    episodes: [
      {
        n: 1,
        title: "Chambre avec vue sur toi",
        minutes: 7,
        date: "9 nov. 2026",
        body: [
          { t: "p", x: "La villa 12 avait une véranda qui grinçait, une piscine un peu verte les premiers jours, et un règlement tacite : les Lambert à gauche, les Moreno à droite, la cuisine en commun le dimanche." },
          { t: "p", x: "Le problème, c'est que Raphaël Lambert avait dix ans la première fois qu'il avait vu Palma Moreno en maillot. Il n'en avait rien à faire, à l'époque. À vingt-trois, c'était différent." },
          { t: "p", x: "« Tu as pris ma chambre. » — « J'ai pris la chambre d'amis. » — « C'est la mienne depuis toujours. » Palma avait le don de dire les choses sans élever la voix." },
          { t: "p", x: "Ils partagèrent la salle de bain, le parasol, et une rancune vieille de trois étés. Celle de la fête où il était parti sans lui dire au revoir." },
          { t: "p", x: "Le premier soir, en cherchant de l'eau à la cuisine, Raphaël la trouva assise sur le plan de travail, à regarder la mer par la fenêtre." },
          { t: "quote", x: "« Il est minuit », dit-il. « Je sais », répondit-elle. Elle ne bougea pas." },
          { t: "p", x: "Il prit un verre, s'assit en face d'elle, et regretta immédiatement de ne pas savoir quoi dire." }
        ]
      },
      {
        n: 2,
        title: "Le mur des hirondelles",
        minutes: 8,
        date: "13 nov. 2026",
        body: [
          { t: "p", x: "Le mur entre les deux jardins était couvert d'hirondelles en céramique. Un été, les pères l'avaient construit pour marquer la limite ; chaque année, les mères y accrochaient quelque chose pour l'adoucir." },
          { t: "p", x: "Raphaël le franchit un matin pour récupérer un ballon. Palma était allongée sur une serviette, un livre ouvert sur le visage." },
          { t: "p", x: "« Il est à toi ? » Il montra le ballon. « Non. Mais je peux te laisser croire qu'il l'est si ça t'évite de repartir. »" },
          { t: "p", x: "Il resta. Il ne lut pas. Elle lut tout haut, un chapitre sur les phares bretons, et il l'écouta comme si c'était la chose la plus importante du monde." },
          { t: "p", x: "À midi, la voix de sa mère fendit l'air : « Raphaël ! Tu laisses Palma tranquille ! » Palma ferma le livre et sourit. « Ta mère a peut-être raison. »" },
          { t: "p", x: "Il repartit sans répondre. Mais il passa par-dessus le mur le lendemain, et le surlendemain." },
          { t: "quote", x: "Le mur ne séparait plus rien. Il était devenu le chemin le plus court." }
        ]
      },
      { n: 3, title: "La fête du port", locked: true },
      { n: 4, title: "Ce qu'on ne dit pas en famille", locked: true },
      { n: 5, title: "La pluie de septembre", locked: true },
      { n: 6, title: "Dernier jour, première fois", locked: true }
    ]
  },
  {
    id: "entre-deux-gares",
    title: "Entre deux gares",
    tagline: "Ils ne devaient se croiser qu'une fois. Le train en a décidé autrement.",
    author: "Sofia K.",
    genre: "Slow burn",
    status: "Nouvelle",
    letter: "G",
    colors: ["#38bdf8", "#1e3a8a"],
    synopsis: "Un retard de quarante minutes sur le quai 4. Un café renversé, un livre oublié, et deux billets qui ne les mèneront jamais tout à fait au même endroit.",
    episodes: [
      {
        n: 1,
        title: "Quai 4, 18 h 42",
        minutes: 5,
        date: "7 nov. 2026",
        body: [
          { t: "p", x: "Le tableau affichait « 18 h 42 — retardé ». Aucune autre précision. Sur le quai 4, les gens soupiraient en regardant leur téléphone, comme si l'application allait annoncer quelque chose que la gare ignorait." },
          { t: "p", x: "Elias avait un livre, un café trop chaud et quarante minutes à perdre. Il choisit la seule place libre sur le banc, à côté d'une fille qui lisait le même livre, à trente pages près." },
          { t: "p", x: "Il s'assit. Elle ne leva pas les yeux. Il essaya de lire par-dessus son épaule, ce qui est une très mauvaise idée avec des inconnus." },
          { t: "p", x: "Au bout de cinq minutes, elle dit, sans regarder : « La fin est moins bonne que le début. »" },
          { t: "p", x: "« Vous venez de gâcher quatre cents pages. » — « Vous allez le lire quand même. »" },
          { t: "p", x: "Le train arriva à 19 h 26. Elle monta dans le wagon 3. Il monta dans le wagon 8, comme prévu sur son billet, et passa tout le trajet à se dire qu'il aurait pu prendre le 3." },
          { t: "quote", x: "C'est toujours plus tard qu'on pense aux phrases qu'il fallait dire." }
        ]
      },
      {
        n: 2,
        title: "Le livre oublié",
        minutes: 6,
        date: "11 nov. 2026",
        body: [
          { t: "p", x: "Le livre, elle l'a oublié sur le banc. Elias l'a vu trop tard, le train avait déjà avalé le quai. Il l'a ramassé, l'a ouvert, et a trouvé un nom sur la page de garde : « Camille »." },
          { t: "p", x: "Il a cherché pendant trois jours. Un profil, un réseau, une trace. Puis il a écrit un message à une inconnue qui n'était peut-être pas elle : « J'ai votre livre. Vous aviez raison pour la fin. »" },
          { t: "p", x: "La réponse est arrivée un dimanche soir : « Je ne vous crois pas. Mais prouvez-le. »" },
          { t: "p", x: "Il a photographié la page 212, celle où l'héroïne descend du train sans se retourner." },
          { t: "p", x: "« Vous êtes donc le type du quai 4 », a-t-elle écrit. « Celui qui lit par-dessus l'épaule des gens. »" },
          { t: "p", x: "Ils ont fixé un rendez-vous. Même gare, même quai, même heure. Cette fois, le train n'était pas en retard." },
          { t: "quote", x: "Camille est arrivée à 18 h 42. Elias tenait deux cafés. Un seul est arrivé intact." }
        ]
      },
      { n: 3, title: "Correspondance", locked: true },
      { n: 4, title: "La gare de ton enfance", locked: true },
      { n: 5, title: "Terminus", locked: true }
    ]
  }
];

/* Contenu de démonstration exposé à la couche API (mode local sans backend). */
window.BC_DEMO = { categories: CATEGORIES, tips: TIPS, stories: STORIES };
