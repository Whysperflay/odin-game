document.addEventListener("DOMContentLoaded", function () {
    /** @type {Object} Socket.io pour la communication avec le serveur */
    let sock = io.connect();

    // ******************************************************
    // GESTION DU PSEUDO ET DEMARRAGE DE LA PARTIE
    // ******************************************************
    const inputPseudo = document.getElementById("inputPseudo");
    const btnDemarrer = document.getElementById("btnDemarrer");

    let phase = "btnDemarrer";
    const mode = "PRODUCTION"; // PRODUCTION ou DEVELOPPEMENT

    // touche Enter
    document.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            if (phase === "btnDemarrer") {
                const btnDemarrer = document.getElementById("btnDemarrer");
                if (btnDemarrer && !btnDemarrer.disabled) {
                    btnDemarrer.click();
                }
            } else if (phase === "btnJouerCarte") {
                const btnJouerCarte = document.getElementById("btnJouerCarte");
                if (btnJouerCarte && btnJouerCarte.style.display !== "none") {
                    btnJouerCarte.click();
                }
            } else if (phase === "btnEnvoyerCarteTas") {
                const btnEnvoyerCarteTas = document.getElementById("btnEnvoyerCarteTas");
                if (btnEnvoyerCarteTas && btnEnvoyerCarteTas.style.display !== "none") {
                    btnEnvoyerCarteTas.click();
                }
            } else {
                if (mode === "DEVELOPPEMENT") console.log("Aucune action associée à la touche Enter en phase :", phase);
            }
        }
    });

    /**
     * Initialise le bouton de synthèse vocale
     */
    let TTSactive = true;
    function initialiserBoutonTTS() {
        let boutonTTS = document.getElementById("btnTTS");
        if (!boutonTTS) {
            boutonTTS = document.createElement("button");
            boutonTTS.id = "btnTTS";
            boutonTTS.textContent = "TTS : ON";
            document.body.appendChild(boutonTTS);
        }

        boutonTTS.addEventListener("click", function () {
            if (!TTSactive) {
                parler("Vous m'avez manqué !", true);
            } else {
                parler("Vous allez me manquer !", true);
            }

            TTSactive = !TTSactive;
            boutonTTS.textContent = TTSactive ? "TTS : ON" : "TTS : OFF";
        });
    }

    initialiserBoutonTTS();

    //création de la fenêtre des règles du jeu
    const overlay = document.createElement("div");
    overlay.id = "overlayhidden";
    const fenRegle = document.createElement("div");
    fenRegle.id = "regleshidden";
    creerRegle();
    document.body.appendChild(overlay);
    document.body.appendChild(fenRegle);

    //création bouton Comment Jouer
    let boutonCommentJouer = document.getElementById("btnCommentJouer");
    if (!boutonCommentJouer) {
        if (mode === "DEVELOPPEMENT") console.log("boutonCommentJouer inexistant");
        boutonCommentJouer = document.createElement("button");
        boutonCommentJouer.id = "btnCommentJouer";
        boutonCommentJouer.textContent = "?";
        if (mode === "DEVELOPPEMENT") console.log("boutonCommentJouer créé");
        document.body.appendChild(boutonCommentJouer);
        if (mode === "DEVELOPPEMENT") console.log("boutonCommentJouer ajouté à body");

        boutonCommentJouer.addEventListener("click", function () {
            let croix = document.getElementById("croixRegle");
            if (!croix) {
                croix = document.createElement("button");
                croix.id = "croixRegle";
                croix.textContent = "X";

                overlay.id = "overlayvisible";
                fenRegle.id = "reglesvisible";
                fenRegle.appendChild(croix);

                croix.addEventListener("click", function () {
                    overlay.id = "overlayhidden";
                    fenRegle.id = "regleshidden";
                    croix.remove();
                });

                overlay.addEventListener("click", function () {
                    if (event.target === overlay) {
                        overlay.id = "overlayhidden";
                        fenRegle.id = "regleshidden";
                        const croix = document.getElementById("croixRegle");
                        if (croix) {
                            croix.remove();
                        }
                    }
                });
            }
        });
    }

    /** @type {string} Pseudo du joueur actuel, stocké après la connexion */
    let monPseudo = "";

    /**
     * Gestion du clic sur le bouton de démarrage
     * Valide le pseudo et envoie la demande de connexion au serveur
     */
    btnDemarrer.addEventListener("click", function () {
        let pseudo = inputPseudo.value;
        // verification du pseudo
        if (!pseudo) {
            alert("Veuillez entrer un pseudo.");
            inputPseudo.focus();
            return;
        }
        if (pseudo.trim().length === 0) {
            alert("Veuillez entrer un pseudo valide.");
            inputPseudo.value = "";
            inputPseudo.focus();
            return;
        }
        if (pseudo.length > 20) {
            alert("Le pseudo ne doit pas dépasser 20 caractères.");
            inputPseudo.value = "";
            inputPseudo.focus();
            return;
        }

        // Envoi du pseudo au serveur pour démarrer une partie
        sock.emit("demarrer", pseudo);
        phase = "attente";
        monPseudo = pseudo;

        // Désactiver les champs pseudo et bouton démarrer
        btnDemarrer.disabled = true;
        inputPseudo.disabled = true;
    });

    // ******************************************************
    // GESTION DES ÉVÉNEMENTS DU JEU
    // ******************************************************

    /**
     * Affiche un message d'attente pendant la recherche d'adversaires
     * Met à jour le texte du bouton de démarrage
     * @param {string} message - Message d'attente à afficher
     */
    sock.on("en_attente", function (message) {
        btnDemarrer.innerHTML = message;
    });

    /**
     * Affiche un message d'erreur et réactive les champs de connexion si nécessaire
     * Permet au joueur de réessayer en cas d'erreur de pseudo ou de jeu
     * @param {string} message - Message d'erreur à afficher
     */
    sock.on("erreur", function (message) {
        afficherNotification("Erreur : " + message, "info");
        parler(message);

        if (btnDemarrer && document.body.contains(btnDemarrer)) {
            btnDemarrer.disabled = false;
        }
        if (inputPseudo && document.body.contains(inputPseudo)) {
            inputPseudo.disabled = false;
        }
    });

    /**
     * Gère la déconnexion d'un adversaire
     * Affiche un message d'alerte et recharge automatiquement la page après 10 secondes
     * @param {string} message - Message indiquant quel joueur s'est déconnecté
     */
    sock.on("deconnexion", function (message) {
        alert("Déconnexion : " + message + "\n\nRedirection dans 10 secondes...");
        setTimeout(() => {
            location.reload();
        }, 10000);
    });

    // ******************************************************
    // GESTION DES ÉVÉNEMENTS WEBSOCKET
    // ******************************************************

    let partieCommencee = false;
    /**
     * Reçoit la main du joueur et l'affiche
     * Crée les éléments HTML nécessaires (cartes, bouton de tri, zone de notification)
     */
    sock.on("main", function (cartes) {
        partieCommencee = true;
        if (mode === "DEVELOPPEMENT") console.log("Mes cartes :", cartes);

        // enlever ou cacher l'écran de pseudo
        const ecran = document.getElementById("ecranPseudo");
        if (ecran) ecran.remove();

        //si ancienne main, la supprimer (mais sauvegarder l'état du bouton de tri)
        const ancienneMain = document.getElementById("maMain");
        let texteBoutonTri = "Trier par valeur";
        if (ancienneMain) {
            const ancienBoutonTri = document.getElementById("btnTri");
            if (ancienBoutonTri) {
                texteBoutonTri = ancienBoutonTri.textContent;
            }
            ancienneMain.remove();
        }

        //Créer une div pour afficher la main
        const mainDiv = document.createElement("div");
        mainDiv.id = "maMain";

        const ul = document.createElement("ul");

        for (let carte of cartes) {
            const li = document.createElement("li");
            const valeur = carte.valeur !== undefined ? carte.valeur : carte[0];
            const couleur = carte.couleur !== undefined ? carte.couleur : carte[1];
            const img = document.createElement("img");
            img.src = `./images/${couleur}_${valeur}.png`;
            if (mode === "DEVELOPPEMENT") console.log(img.src);
            img.alt = `${valeur} de ${couleur}`;
            li.appendChild(img);
            ul.appendChild(li);
        }

        mainDiv.appendChild(ul);

        // ajouter la section dans <main> ou dans body si absent
        const container = document.querySelector("main") || document.body;
        container.appendChild(mainDiv);

        // crée l'écran de notification
        if (!document.getElementById("notification")) {
            const notificationDiv = document.createElement("div");
            notificationDiv.id = "notification";
            const p1 = document.createElement("p");
            p1.textContent = "Ligne 1 de la notification";
            notificationDiv.appendChild(p1);
            const p2 = document.createElement("p");
            p2.textContent = "Ligne 2 de la notification";
            notificationDiv.appendChild(p2);
            container.appendChild(notificationDiv);
        }

        //créer le bouton de tri
        let boutonTri = document.getElementById("btnTri");
        if (!boutonTri) {
            boutonTri = document.createElement("button");
            boutonTri.id = "btnTri";
            boutonTri.textContent = texteBoutonTri;
            mainDiv.appendChild(boutonTri);
            container.appendChild(mainDiv);

            boutonTri.addEventListener("click", function () {
                if (boutonTri.textContent.includes("couleur")) {
                    sock.emit("trier_carte", true);
                } else {
                    sock.emit("trier_carte", false);
                }

                if (boutonTri.textContent == "Trier par valeur") {
                    boutonTri.textContent = "Trier par couleur";
                } else {
                    boutonTri.textContent = "Trier par valeur";
                }
            });
        }

        const btnJouerCarte = document.getElementById("btnJouerCarte");
        if (btnJouerCarte && btnJouerCarte.style.display !== "none") {
            attacherListenersCartes();
        }
    });

    /**
     * Charge et affiche les règles depuis le fichier regles.html
     */
    async function creerRegle() {
        try {
            const reponse = await fetch("./regles.html");
            if (!reponse.ok) {
                throw new Error("Erreur lors du chargement des règles du jeu.");
            }
            const htmlRegles = await reponse.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlRegles, "text/html");
            const contenuRegles = doc.querySelector("main");

            if (contenuRegles && contenuRegles.innerHTML.trim() !== "") {
                fenRegle.innerHTML = contenuRegles.innerHTML;
            } else {
                console.error("Aucun contenu de règles trouvé dans le fichier.");
            }
        } catch (error) {
            console.error("Erreur lors du chargement des règles du jeu :", error);
            fenRegle.textContent = "Erreur lors du chargement des règles du jeu.";
        }
    }

    /**
     * Affiche un message dans la zone de notification
     * @param {string} message - Le texte à afficher
     * @param {string} type - Type de notification : "tour" (ligne 1) ou "info" (ligne 2)
     */
    function afficherNotification(message, type) {
        let notificationDiv = document.getElementById("notification");
        const pElements = notificationDiv.getElementsByTagName("p");
        if (type === "tour") {
            // vide les 2 lignes
            for (let p of pElements) {
                p.textContent = "";
            }
            // selectionne la première ligne
            const p1 = pElements[0];
            p1.textContent = message;
        } else if (type === "info") {
            // selectionne la deuxième ligne
            const p2 = pElements[1];
            p2.textContent = message;
        }
    }

    /**
     * Initialise et affiche le bouton pour jouer une carte ou passer son tour
     * Gère la sélection des cartes et l'envoi au serveur
     * Le texte du bouton change dynamiquement selon les cartes sélectionnées
     */
    function jouerUneCarte() {
        let btnJouerCarte = document.getElementById("btnJouerCarte");
        phase = "btnJouerCarte";

        if (!btnJouerCarte) {
            btnJouerCarte = document.createElement("button");
            btnJouerCarte.textContent = "Passer le tour";
            btnJouerCarte.id = "btnJouerCarte";
            document.querySelector("main").appendChild(btnJouerCarte);

            btnJouerCarte.addEventListener("click", function () {
                const maMain = document.getElementById("maMain");
                const cartes = maMain.getElementsByTagName("li");
                const cartesJouees = [];

                for (let i = 0; i < cartes.length; i++) {
                    if (cartes[i].classList.contains("selectionne")) {
                        const img = cartes[i].querySelector("img");
                        const alt = img.alt;
                        const [valeurStr, , couleur] = alt.split(" ");
                        const valeur = parseInt(valeurStr);
                        cartesJouees.push({ valeur, couleur });
                    }
                }

                if (cartesJouees.length === 0) {
                    if (confirm("Voulez-vous passer votre tour ?")) {
                        sock.emit("jouer_carte", []);
                        for (let i = 0; i < cartes.length; i++) {
                            cartes[i].classList.remove("selectionne");
                        }
                        btnJouerCarte.textContent = "Passer le tour";
                    }
                    return;
                }

                if (cartesJouees.length > 0) {
                    let message = "Voulez-vous jouer:\n";
                    for (let carte of cartesJouees) {
                        message += `- ${carte.valeur} de ${carte.couleur}\n`;
                    }
                    message += "?";

                    if (confirm(message)) {
                        if (mode === "DEVELOPPEMENT") console.log("Cartes jouées :", cartesJouees);
                        sock.emit("jouer_carte", cartesJouees);
                    }
                }
            });
        }

        btnJouerCarte.style.display = "block";
        btnJouerCarte.textContent = "Passer le tour";

        attacherListenersCartes();
    }

    /**
     * Attache les écouteurs d'événements aux cartes de la main du joueur
     * Permet de sélectionner/désélectionner les cartes et met à jour le texte du bouton
     * Utilise cloneNode pour éviter les listeners multiples
     */
    function attacherListenersCartes() {
        const maMain = document.getElementById("maMain");
        if (!maMain) return;

        const cartes = maMain.getElementsByTagName("li");
        const btnJouerCarte = document.getElementById("btnJouerCarte");

        for (let i = 0; i < cartes.length; i++) {
            const nouvelleCarteLi = cartes[i].cloneNode(true);
            cartes[i].parentNode.replaceChild(nouvelleCarteLi, cartes[i]);

            nouvelleCarteLi.addEventListener("click", function () {
                this.classList.toggle("selectionne");

                // Mettre à jour le texte du bouton
                if (btnJouerCarte) {
                    const cartesSelectionnees = document.querySelectorAll("#maMain li.selectionne");
                    if (cartesSelectionnees.length > 0) {
                        btnJouerCarte.textContent = "Jouer la carte";
                    } else {
                        btnJouerCarte.textContent = "Passer le tour";
                    }
                }
            });
        }
    }

    /**
     * Gestion de la validation d'un coup par le serveur
     * Désélectionne toutes les cartes et cache le bouton de jeu
     */
    sock.on("coup_valide", function () {
        phase = "attente";
        arreterRappelVocal();
        // Désélectionner toutes les cartes
        const maMain = document.getElementById("maMain");
        if (maMain) {
            const cartes = maMain.getElementsByTagName("li");
            for (let carte of cartes) {
                carte.classList.remove("selectionne");
            }
        }

        // Cacher le bouton
        const btnJouerCarte = document.getElementById("btnJouerCarte");
        if (btnJouerCarte) {
            btnJouerCarte.style.display = "none";
        }
    });

    /**
     * Affiche les cartes du tas au centre de l'écran
     * Les cartes sont automatiquement triées par valeur décroissante
     * @param {Array<Object>} tasCartes - Tableau des cartes à afficher dans le tas
     */
    function afficherTas(tasCartes) {
        if (mode === "DEVELOPPEMENT") console.log("Tas de cartes sur la table :", tasCartes);
        let tasDiv = document.getElementById("tasCartes");
        if (!tasDiv) {
            tasDiv = document.createElement("div");
            tasDiv.id = "tasCartes";
            document.querySelector("main").appendChild(tasDiv);
        }

        const tasTrié = tasCartes.slice().sort((a, b) => b.valeur - a.valeur);

        tasDiv.innerHTML = "";
        const ul = document.createElement("ul");
        for (let carte of tasTrié) {
            const li = document.createElement("li");
            const img = document.createElement("img");
            img.src = `./images/${carte.couleur}_${carte.valeur}.png`;
            if (mode === "DEVELOPPEMENT") console.log(img.src);
            img.alt = `${carte.valeur} de ${carte.couleur}`;
            li.appendChild(img);
            ul.appendChild(li);
        }
        tasDiv.appendChild(ul);
    }

    /**
     * Affiche les informations des adversaires (pseudo et nombre de cartes)
     * Crée ou met à jour les zones d'affichage des adversaires en haut de l'écran
     * @param {Array<Object>} adversaires - Liste des joueurs avec pseudo et nbCartes
     * @param {string} monPseudo - Pseudo du joueur actuel (pour ne pas l'afficher comme adversaire)
     */
    function afficherNbCartesAdversaires(adversaires, monPseudo) {
        // Supprimer les anciens adversaires
        document.querySelectorAll(".adversaire").forEach((el) => el.remove());

        let compteur = 1;
        for (let adv of adversaires) {
            if (adv.pseudo === monPseudo) continue;

            const advDiv = document.createElement("div");
            advDiv.className = "adversaire";
            advDiv.id = `adversaire${compteur}`;

            const nom = document.createElement("div");
            nom.className = "nom";
            nom.textContent = adv.pseudo;

            const nbCartes = document.createElement("div");
            nbCartes.className = "nbCartes";
            nbCartes.textContent = `${adv.nbCartes} 🃏`;

            advDiv.appendChild(nom);
            advDiv.appendChild(nbCartes);
            document.querySelector("main").appendChild(advDiv);

            compteur++;
        }
    }

    /** @type {number | null} ID de l'intervalle de rappel */
    let intervalRappel = null;
    /**
     * Gestion de l'événement "C'est votre tour de jouer"
     * Affiche la notification, met à jour l'interface et active le bouton de jeu
     * Déclenche également la synthèse vocale
     */
    sock.on("a_toi", function (data) {
        if (mode === "DEVELOPPEMENT") console.log(data.message);
        afficherNotification(data.message, "tour");
        afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        afficherTas(data.tasCartes);
        demarrerRappelVocal("C'est à votre tour de jouer.");
        jouerUneCarte();
    });

    /**
     * Gestion de l'événement "C'est le tour d'un autre joueur"
     * Affiche la notification d'attente et cache le bouton de jeu
     */
    sock.on("a_l_autre", function (data) {
        if (mode === "DEVELOPPEMENT") console.log(data.message);
        afficherNotification(data.message, "tour");
        afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        afficherTas(data.tasCartes);
        arreterRappelVocal();
        phase = "attente";
        const btn = document.getElementById("btnJouerCarte");
        if (btn) btn.style.display = "none";
    });

    /**
     * Gestion de la sélection d'une carte dans le tas après avoir joué
     * Affiche le bouton de validation, rend les cartes du tas cliquables
     * Le bouton est désactivé tant qu'aucune carte n'est sélectionnée
     */
    sock.on("selectionner_carte_dans_tas", function (tasCartes) {
        phase = "btnEnvoyerCarteTas";
        // Cacher le bouton btnJouerCarte si visible
        const btnJouerCarte = document.getElementById("btnJouerCarte");
        if (btnJouerCarte) btnJouerCarte.style.display = "none";

        // Réutiliser ou créer le bouton au même emplacement
        let btnEnvoyerCarteTas = document.getElementById("btnEnvoyerCarteTas");

        if (!btnEnvoyerCarteTas) {
            btnEnvoyerCarteTas = document.createElement("button");
            btnEnvoyerCarteTas.id = "btnEnvoyerCarteTas";
            document.querySelector("main").appendChild(btnEnvoyerCarteTas);
        }

        btnEnvoyerCarteTas.textContent = "Sélectionner une carte du tas";
        btnEnvoyerCarteTas.style.display = "block";
        btnEnvoyerCarteTas.disabled = true;

        if (mode === "DEVELOPPEMENT") console.log("Sélectionner une carte dans le tas :", tasCartes);
        afficherNotification("C'est à vous de sélectionner une carte dans le tas.", "info");
        demarrerRappelVocal("Sélectionnez une carte dans le tas.");

        let maCarte;

        const cartesTasElements = document.querySelectorAll("#tasCartes li");

        // Supprimer les anciens listeners
        cartesTasElements.forEach((el) => {
            const clone = el.cloneNode(true);
            el.parentNode.replaceChild(clone, el);
        });

        // Réattacher les listeners
        const nouvellesCartesTas = document.querySelectorAll("#tasCartes li");

        for (let i = 0; i < nouvellesCartesTas.length; i++) {
            nouvellesCartesTas[i].addEventListener("click", function () {
                nouvellesCartesTas.forEach((el) => el.classList.remove("selectionneTas"));

                this.classList.add("selectionneTas");

                const img = this.querySelector("img");
                const alt = img.alt;
                const [valeurStr, , couleur] = alt.split(" ");
                const valeur = parseInt(valeurStr);
                maCarte = { valeur, couleur };
                if (mode === "DEVELOPPEMENT") console.log("Carte du tas sélectionnée :", maCarte.valeur, maCarte.couleur);

                // Activer le bouton
                btnEnvoyerCarteTas.disabled = false;
                btnEnvoyerCarteTas.textContent = "Valider la carte du tas";
            });
        }

        // Supprimer l'ancien listener si existant
        const nouveauBtn = btnEnvoyerCarteTas.cloneNode(true);
        btnEnvoyerCarteTas.parentNode.replaceChild(nouveauBtn, btnEnvoyerCarteTas);
        btnEnvoyerCarteTas = nouveauBtn;

        btnEnvoyerCarteTas.addEventListener("click", function () {
            if (!maCarte) {
                afficherNotification("Veuillez sélectionner une carte du tas.", "info");
                return;
            }
            if (!confirm(`Voulez-vous récupérer la carte ${maCarte.valeur} de ${maCarte.couleur} du tas ?`)) {
                return;
            }
            sock.emit("carte_dans_tas_selectionnee", maCarte);
            if (mode === "DEVELOPPEMENT") console.log("Carte du tas envoyée :", maCarte.valeur, maCarte.couleur);
            phase = "attente";
            btnEnvoyerCarteTas.style.display = "none";
            arreterRappelVocal();

            const cartesTas = document.querySelectorAll("#tasCartes li");
            cartesTas.forEach((el) => el.classList.remove("selectionneTas"));
        });
    });

    /**
     * Gestion de la fin de manche
     * Affiche l'écran de scores avec le tableau des joueurs et leurs points
     * Cache temporairement la zone de jeu pendant 10 secondes avant la nouvelle manche
     * data : {nbManche, nbManchesMax, scores: [{pseudo, cartesRestantes, scoreTotal}], nbCartesAdversaires}
     */
    sock.on("fin_manche", function (data) {
        if (mode === "DEVELOPPEMENT") console.log("Fin de la manche :", data.nbManche);
        // chercher qui a gagné la manche
        let gagnantManche = null;
        for (let score of data.scores) {
            if (score.cartesRestantes === 0) {
                gagnantManche = score.pseudo;
                break;
            }
        }
        if (mode === "DEVELOPPEMENT") console.log("Gagnant de la manche :", gagnantManche);
        parler(`Fin de la manche ${data.nbManche}. ${gagnantManche} a gagné la manche.`);

        // cacher le main
        const main = document.querySelector("main");
        if (main) main.style.display = "none";

        // Afficher les infos adversaires envoyées par le serveur
        if (data.nbCartesAdversaires) {
            afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        }

        afficherTas([]);

        const btnJouerCarte = document.getElementById("btnJouerCarte");
        if (btnJouerCarte) btnJouerCarte.style.display = "none";

        const scoreMancheDiv = document.createElement("div");
        scoreMancheDiv.id = "scoreManche";

        const titre = document.createElement("h2");
        titre.textContent = `Fin de la manche ${data.nbManche} / ${data.nbManchesMax}`;
        scoreMancheDiv.appendChild(titre);

        // Tableau des scores
        const tableau = document.createElement("table");

        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Joueur</th>
                <th>Cartes restantes</th>
                <th>Score total</th>
            </tr>
        `;
        tableau.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (let score of data.scores) {
            const tr = document.createElement("tr");
            tr.className = score.pseudo === monPseudo ? "moi" : "";

            tr.innerHTML = `
                <td>${score.pseudo} ${score.pseudo === monPseudo ? "(vous)" : ""}</td>
                <td>${score.cartesRestantes}</td>
                <td>${score.scoreTotal}</td>
            `;
            tbody.appendChild(tr);
        }
        tableau.appendChild(tbody);

        scoreMancheDiv.appendChild(tableau);

        // Message
        const message = document.createElement("p");
        message.className = "message-attente";
        message.textContent = "Nouvelle manche dans 10 secondes...";
        scoreMancheDiv.appendChild(message);

        document.body.appendChild(scoreMancheDiv);

        // Supprimer après 10 secondes
        setTimeout(() => {
            scoreMancheDiv.remove();

            // Réafficher le main
            if (main) main.style.display = "flex";
            arreterRappelVocal();
        }, 10000);
    });

    /**
     * Gestion de la fin de partie
     * Affiche l'écran final avec le gagnant, le classement et un bouton pour rejouer
     * Crée une interface complète avec médailles et mise en évidence du joueur actuel
     */
    sock.on("fin_partie", function (data) {
        if (mode === "DEVELOPPEMENT") console.log("Fin de la partie !");
        if (mode === "DEVELOPPEMENT") console.log("Gagnant(s) :", data.gagnants);
        if (mode === "DEVELOPPEMENT") console.log("Classement :", data.classement);

        // Masquer tout le jeu
        const main = document.querySelector("main");
        if (main) main.style.display = "none";

        // Créer l'écran de fin
        const finPartieDiv = document.createElement("div");
        finPartieDiv.id = "finPartie";

        // Titre avec animation
        const titre = document.createElement("h1");
        titre.className = "titre-fin";
        titre.textContent = "Partie terminée !";
        finPartieDiv.appendChild(titre);

        // Gagnant
        const gagnantDiv = document.createElement("div");
        gagnantDiv.className = "encadre-gagnant";

        const gagnantTexte = document.createElement("h2");
        if (data.gagnants.length === 1) {
            const estGagnant = data.gagnants[0] === monPseudo;
            gagnantTexte.textContent = estGagnant ? `Vous avez gagné !` : `${data.gagnant} remporte la partie !`;
            gagnantTexte.className = estGagnant ? "gagnant-moi" : "gagnant-autre";
        } else {
            gagnantTexte.textContent = `Égalité entre : ${data.gagnants.join(", ")}`;
            gagnantTexte.className = "gagnant-egalite";
        }
        gagnantDiv.appendChild(gagnantTexte);
        finPartieDiv.appendChild(gagnantDiv);

        // Classement final
        const classementDiv = document.createElement("div");
        classementDiv.className = "encadre-classement";

        const classementTitre = document.createElement("h3");
        classementTitre.textContent = "Classement final";
        classementDiv.appendChild(classementTitre);

        const tableau = document.createElement("table");
        tableau.className = "tableau-classement";

        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Position</th>
                <th>Joueur</th>
                <th>Score</th>
            </tr>
        `;
        tableau.appendChild(thead);

        const tbody = document.createElement("tbody");
        const medailles = ["🥇", "🥈", "🥉"];

        for (let i = 0; i < data.classement.length; i++) {
            const joueur = data.classement[i];
            const medaille = medailles[i] || "  ";
            const estMoi = joueur.pseudo === monPseudo;

            const tr = document.createElement("tr");
            tr.className = estMoi ? "ligne-moi" : "";

            tr.innerHTML = `
                <td class="medaille">${medaille}</td>
                <td>${joueur.pseudo} ${estMoi ? "(vous)" : ""}</td>
                <td class="score">${joueur.score}</td>
            `;
            tbody.appendChild(tr);
        }
        tableau.appendChild(tbody);

        classementDiv.appendChild(tableau);
        finPartieDiv.appendChild(classementDiv);

        // Bouton rejouer
        const btnRejouer = document.createElement("button");
        btnRejouer.className = "btn-rejouer";
        btnRejouer.textContent = "Rejouer";
        btnRejouer.addEventListener("click", function () {
            location.reload();
        });
        finPartieDiv.appendChild(btnRejouer);

        document.body.appendChild(finPartieDiv);
    });

    /**
     * Utilise la synthèse vocale du navigateur pour lire un texte
     * Annule toute lecture en cours avant de démarrer la nouvelle
     * @param {string} texte - Le texte à lire à voix haute
     * @param {boolean} forcer - Force la lecture même si TTS désactivé (pour bouton TTS)
     */
    function parler(texte, forcer = false) {
        if (!forcer) {
            if (!TTSactive) return;
            if (!partieCommencee) return;
        }

        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(texte);
            utterance.lang = "fr-FR";
            utterance.pitch = 1;
            utterance.rate = 1;
            utterance.volume = 1;

            window.speechSynthesis.speak(utterance);
        }
    }

    /**
     * Démarre un rappel vocal qui se répète toutes les 10 secondes
     * @param {string} message - Le message à répéter
     */
    function demarrerRappelVocal(message) {
        arreterRappelVocal();
        parler(message);

        // répète toutes les 10 secondes
        intervalRappel = setInterval(() => {
            parler(message);
        }, 10000);
    }

    /**
     * Arrête le rappel vocal en cours
     */
    function arreterRappelVocal() {
        if (intervalRappel !== null) {
            clearInterval(intervalRappel);
            intervalRappel = null;
        }
    }
});
