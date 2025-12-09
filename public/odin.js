document.addEventListener("DOMContentLoaded", function () {
    // ═══════════════════════════════════════════════════════════════
    //                         CONSTANTES
    // ═══════════════════════════════════════════════════════════════

    const MODE = "PRODUCTION"; // PRODUCTION ou DEVELOPPEMENT
    const DELAI_FIN_MANCHE = 10000;
    const DELAI_RAPPEL_VOCAL = 10000;

    // ═══════════════════════════════════════════════════════════════
    //                      VARIABLES GLOBALES
    // ═══════════════════════════════════════════════════════════════

    /** @type {Object} Socket.io pour la communication avec le serveur */
    let sock = io.connect();

    /** @type {string} Pseudo du joueur actuel */
    let monPseudo = "";

    /** @type {string} Phase actuelle du jeu (btnDemarrer, btnJouerCarte, btnEnvoyerCarteTas, attente) */
    let phase = "btnDemarrer";

    /** @type {boolean} Indique si la partie a commencé */
    let partieCommencee = false;

    /** @type {boolean} Active/désactive la synthèse vocale */
    let TTSactive = true;

    /** @type {number|null} ID de l'intervalle de rappel vocal */
    let intervalRappel = null;

    // ═══════════════════════════════════════════════════════════════
    //                      ÉLÉMENTS DOM
    // ═══════════════════════════════════════════════════════════════

    const inputPseudo = document.getElementById("inputPseudo");
    const btnDemarrer = document.getElementById("btnDemarrer");

    // ═══════════════════════════════════════════════════════════════
    //                   INITIALISATION INTERFACE
    // ═══════════════════════════════════════════════════════════════

    initialiserEvenementClavier();
    initialiserBoutonTTS();
    initialiserFenetreRegles();
    initialiserBoutonDemarrer();

    /**
     * Initialise les événements clavier (touche Enter)
     */
    function initialiserEvenementClavier() {
        document.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                if (phase === "btnDemarrer") {
                    const btn = document.getElementById("btnDemarrer");
                    if (btn && !btn.disabled) btn.click();
                } else if (phase === "btnJouerCarte") {
                    const btn = document.getElementById("btnJouerCarte");
                    if (btn && btn.style.display !== "none") btn.click();
                } else if (phase === "btnEnvoyerCarteTas") {
                    const btn = document.getElementById("btnEnvoyerCarteTas");
                    if (btn && btn.style.display !== "none") btn.click();
                } else if (MODE === "DEVELOPPEMENT") {
                    console.log("Aucune action associée à Enter en phase :", phase);
                }
            }
        });
    }

    /**
     * Initialise le bouton de synthèse vocale
     */
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

    /**
     * Initialise la fenêtre des règles du jeu
     */
    function initialiserFenetreRegles() {
        const overlay = document.createElement("div");
        overlay.id = "overlayhidden";
        const fenRegle = document.createElement("div");
        fenRegle.id = "regleshidden";

        chargerRegles(fenRegle);

        document.body.appendChild(overlay);
        document.body.appendChild(fenRegle);

        creerBoutonCommentJouer(overlay, fenRegle);
    }

    /**
     * Charge le contenu des règles depuis regles.html
     */
    async function chargerRegles(fenRegle) {
        try {
            const reponse = await fetch("./regles.html");
            if (!reponse.ok) throw new Error("Erreur lors du chargement");

            const htmlRegles = await reponse.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlRegles, "text/html");
            const contenuMain = doc.querySelector("main");

            if (contenuMain && contenuMain.innerHTML.trim() !== "") {
                fenRegle.innerHTML = contenuMain.innerHTML;
            } else {
                console.error("Aucun contenu <main> trouvé dans regles.html");
            }
        } catch (error) {
            console.error("Erreur chargement règles :", error);
            fenRegle.textContent = "Erreur lors du chargement des règles.";
        }
    }

    /**
     * Crée le bouton "Comment Jouer" et gère l'ouverture/fermeture des règles
     */
    function creerBoutonCommentJouer(overlay, fenRegle) {
        let boutonCommentJouer = document.getElementById("btnCommentJouer");
        if (!boutonCommentJouer) {
            boutonCommentJouer = document.createElement("button");
            boutonCommentJouer.id = "btnCommentJouer";
            boutonCommentJouer.textContent = "?";
            document.body.appendChild(boutonCommentJouer);
        }

        boutonCommentJouer.addEventListener("click", function () {
            let croix = document.getElementById("croixRegle");
            if (!croix) {
                croix = document.createElement("button");
                croix.id = "croixRegle";
                croix.textContent = "X";

                overlay.id = "overlayvisible";
                fenRegle.id = "reglesvisible";
                fenRegle.appendChild(croix);

                // Fermeture par la croix
                croix.addEventListener("click", fermerRegles);

                // Fermeture par clic sur overlay
                overlay.addEventListener("click", function (event) {
                    if (event.target === overlay) fermerRegles();
                });
            }
        });

        function fermerRegles() {
            overlay.id = "overlayhidden";
            fenRegle.id = "regleshidden";
            const croix = document.getElementById("croixRegle");
            if (croix) croix.remove();
        }
    }

    /**
     * Initialise le bouton de démarrage et sa validation
     */
    function initialiserBoutonDemarrer() {
        btnDemarrer.addEventListener("click", function () {
            const pseudo = inputPseudo.value;

            // Validations
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

            // Envoi au serveur
            sock.emit("demarrer", pseudo);
            phase = "attente";
            monPseudo = pseudo;

            // Désactiver les champs
            btnDemarrer.disabled = true;
            inputPseudo.disabled = true;
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //                    FONCTIONS UTILITAIRES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Affiche un message dans la zone de notification
     */
    function afficherNotification(message, type) {
        const notificationDiv = document.getElementById("notification");
        if (!notificationDiv) return;

        const pElements = notificationDiv.getElementsByTagName("p");
        if (type === "tour") {
            for (let p of pElements) p.textContent = "";
            pElements[0].textContent = message;
        } else if (type === "info") {
            pElements[1].textContent = message;
        }
    }

    /**
     * Affiche les cartes du tas au centre de l'écran
     */
    function afficherTas(tasCartes) {
        if (MODE === "DEVELOPPEMENT") console.log("Tas :", tasCartes);

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
            img.alt = `${carte.valeur} de ${carte.couleur}`;
            li.appendChild(img);
            ul.appendChild(li);
        }
        tasDiv.appendChild(ul);
    }

    /**
     * Affiche les informations des adversaires
     */
    function afficherNbCartesAdversaires(adversaires, monPseudo) {
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

    // ═══════════════════════════════════════════════════════════════
    //                    GESTION SYNTHÈSE VOCALE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Utilise la synthèse vocale pour lire un texte
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
     * Démarre un rappel vocal toutes les 10 secondes
     */
    function demarrerRappelVocal(message) {
        arreterRappelVocal();
        parler(message);

        intervalRappel = setInterval(() => {
            parler(message);
        }, DELAI_RAPPEL_VOCAL);
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

    // ═══════════════════════════════════════════════════════════════
    //                    GESTION DES CARTES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Attache les listeners aux cartes pour la sélection
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

                if (btnJouerCarte) {
                    const cartesSelectionnees = document.querySelectorAll("#maMain li.selectionne");
                    btnJouerCarte.textContent = cartesSelectionnees.length > 0 ? "Jouer la carte" : "Passer le tour";
                }
            });
        }
    }

    /**
     * Initialise le bouton pour jouer une carte
     */
    function jouerUneCarte() {
        let btnJouerCarte = document.getElementById("btnJouerCarte");
        phase = "btnJouerCarte";

        if (!btnJouerCarte) {
            btnJouerCarte = document.createElement("button");
            btnJouerCarte.textContent = "Passer le tour";
            btnJouerCarte.id = "btnJouerCarte";
            document.querySelector("main").appendChild(btnJouerCarte);

            btnJouerCarte.addEventListener("click", gererClicJouerCarte);
        }

        btnJouerCarte.style.display = "block";
        btnJouerCarte.textContent = "Passer le tour";

        attacherListenersCartes();
    }

    /**
     * Gère le clic sur le bouton "Jouer carte" ou "Passer"
     */
    function gererClicJouerCarte() {
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
                document.getElementById("btnJouerCarte").textContent = "Passer le tour";
            }
            return;
        }

        let message = "Vous avez sélectionné:\n";
        for (let carte of cartesJouees) {
            message += `- ${carte.valeur} de ${carte.couleur}\n`;
        }
        message += "Voulez-vous jouer ces cartes ?";

        if (confirm(message)) {
            if (MODE === "DEVELOPPEMENT") console.log("Cartes jouées :", cartesJouees);
            sock.emit("jouer_carte", cartesJouees);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //                  ÉVÉNEMENTS SOCKET - CONNEXION
    // ═══════════════════════════════════════════════════════════════

    sock.on("en_attente", function (message) {
        btnDemarrer.innerHTML = message;
    });

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

    sock.on("deconnexion", function (message) {
        alert("Déconnexion : " + message + "\n\nRedirection dans 10 secondes...");
        setTimeout(() => location.reload(), 10000);
    });

    // ═══════════════════════════════════════════════════════════════
    //                   ÉVÉNEMENTS SOCKET - PARTIE
    // ═══════════════════════════════════════════════════════════════

    sock.on("main", function (cartes) {
        partieCommencee = true;
        if (MODE === "DEVELOPPEMENT") console.log("Mes cartes :", cartes);

        // Supprimer l'écran de pseudo
        const ecran = document.getElementById("ecranPseudo");
        if (ecran) ecran.remove();

        // Sauvegarder l'état du bouton de tri
        const ancienneMain = document.getElementById("maMain");
        let texteBoutonTri = "Trier par valeur";
        if (ancienneMain) {
            const ancienBoutonTri = document.getElementById("btnTri");
            if (ancienBoutonTri) texteBoutonTri = ancienBoutonTri.textContent;
            ancienneMain.remove();
        }

        // Créer la main
        const mainDiv = document.createElement("div");
        mainDiv.id = "maMain";

        const ul = document.createElement("ul");
        for (let carte of cartes) {
            const li = document.createElement("li");
            const valeur = carte.valeur !== undefined ? carte.valeur : carte[0];
            const couleur = carte.couleur !== undefined ? carte.couleur : carte[1];
            const img = document.createElement("img");
            img.src = `./images/${couleur}_${valeur}.png`;
            img.alt = `${valeur} de ${couleur}`;
            li.appendChild(img);
            ul.appendChild(li);
        }
        mainDiv.appendChild(ul);

        const container = document.querySelector("main") || document.body;
        container.appendChild(mainDiv);

        // Créer la notification si elle n'existe pas
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

        // Créer le bouton de tri
        let boutonTri = document.getElementById("btnTri");
        if (!boutonTri) {
            boutonTri = document.createElement("button");
            boutonTri.id = "btnTri";
            boutonTri.textContent = texteBoutonTri;
            mainDiv.appendChild(boutonTri);

            boutonTri.addEventListener("click", function () {
                const parCouleur = boutonTri.textContent.includes("couleur");
                sock.emit("trier_carte", parCouleur);
                boutonTri.textContent = boutonTri.textContent === "Trier par valeur" ? "Trier par couleur" : "Trier par valeur";
            });
        }

        const btnJouerCarte = document.getElementById("btnJouerCarte");
        if (btnJouerCarte && btnJouerCarte.style.display !== "none") {
            attacherListenersCartes();
        }
    });

    sock.on("coup_valide", function () {
        phase = "attente";
        arreterRappelVocal();

        // Désélectionner les cartes
        const maMain = document.getElementById("maMain");
        if (maMain) {
            const cartes = maMain.getElementsByTagName("li");
            for (let carte of cartes) {
                carte.classList.remove("selectionne");
            }
        }

        // Cacher le bouton
        const btnJouerCarte = document.getElementById("btnJouerCarte");
        if (btnJouerCarte) btnJouerCarte.style.display = "none";
    });

    // ═══════════════════════════════════════════════════════════════
    //                   ÉVÉNEMENTS SOCKET - TOUR
    // ═══════════════════════════════════════════════════════════════

    sock.on("a_toi", function (data) {
        if (MODE === "DEVELOPPEMENT") console.log(data.message);
        afficherNotification(data.message, "tour");
        afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        afficherTas(data.tasCartes);
        demarrerRappelVocal("C'est à votre tour de jouer.");
        jouerUneCarte();
    });

    sock.on("a_l_autre", function (data) {
        if (MODE === "DEVELOPPEMENT") console.log(data.message);
        afficherNotification(data.message, "tour");
        afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        afficherTas(data.tasCartes);
        arreterRappelVocal();
        phase = "attente";

        const btn = document.getElementById("btnJouerCarte");
        if (btn) btn.style.display = "none";
    });

    sock.on("selectionner_carte_dans_tas", function (tasCartes) {
        phase = "btnEnvoyerCarteTas";

        const btnJouerCarte = document.getElementById("btnJouerCarte");
        if (btnJouerCarte) btnJouerCarte.style.display = "none";

        let btnEnvoyerCarteTas = document.getElementById("btnEnvoyerCarteTas");
        if (!btnEnvoyerCarteTas) {
            btnEnvoyerCarteTas = document.createElement("button");
            btnEnvoyerCarteTas.id = "btnEnvoyerCarteTas";
            document.querySelector("main").appendChild(btnEnvoyerCarteTas);
        }

        btnEnvoyerCarteTas.textContent = "Sélectionner une carte du tas";
        btnEnvoyerCarteTas.style.display = "block";
        btnEnvoyerCarteTas.disabled = true;

        if (MODE === "DEVELOPPEMENT") console.log("Sélectionner carte tas :", tasCartes);
        afficherNotification("C'est à vous de sélectionner une carte dans le tas.", "info");
        demarrerRappelVocal("Sélectionnez une carte dans le tas.");

        let maCarte;

        // Supprimer anciens listeners
        const cartesTasElements = document.querySelectorAll("#tasCartes li");
        cartesTasElements.forEach((el) => {
            const clone = el.cloneNode(true);
            el.parentNode.replaceChild(clone, el);
        });

        // Réattacher listeners
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

                if (MODE === "DEVELOPPEMENT") console.log("Carte sélectionnée :", maCarte);

                btnEnvoyerCarteTas.disabled = false;
                btnEnvoyerCarteTas.textContent = "Valider la carte du tas";
            });
        }

        // Réinitialiser le bouton pour éviter listeners multiples
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
            if (MODE === "DEVELOPPEMENT") console.log("Carte envoyée :", maCarte);

            phase = "attente";
            btnEnvoyerCarteTas.style.display = "none";
            arreterRappelVocal();

            const cartesTas = document.querySelectorAll("#tasCartes li");
            cartesTas.forEach((el) => el.classList.remove("selectionneTas"));
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //                   ÉVÉNEMENTS SOCKET - FIN
    // ═══════════════════════════════════════════════════════════════

    sock.on("fin_manche", function (data) {
        if (MODE === "DEVELOPPEMENT") console.log("Fin manche :", data.nbManche);

        let gagnantManche = null;
        for (let score of data.scores) {
            if (score.cartesRestantes === 0) {
                gagnantManche = score.pseudo;
                break;
            }
        }

        if (MODE === "DEVELOPPEMENT") console.log("Gagnant :", gagnantManche);
        parler(`Fin de la manche ${data.nbManche}. ${gagnantManche} a gagné la manche.`);

        const main = document.querySelector("main");
        if (main) main.style.display = "none";

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

        const tableau = document.createElement("table");
        tableau.innerHTML = `
            <thead>
                <tr>
                    <th>Joueur</th>
                    <th>Cartes restantes</th>
                    <th>Score total</th>
                </tr>
            </thead>
        `;

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

        const message = document.createElement("p");
        message.className = "message-attente";
        message.textContent = "Nouvelle manche dans 10 secondes...";
        scoreMancheDiv.appendChild(message);

        document.body.appendChild(scoreMancheDiv);

        setTimeout(() => {
            scoreMancheDiv.remove();
            if (main) main.style.display = "flex";
            arreterRappelVocal();
        }, DELAI_FIN_MANCHE);
    });

    sock.on("fin_partie", function (data) {
        if (MODE === "DEVELOPPEMENT") {
            console.log("Fin de la partie !");
            console.log("Gagnant(s) :", data.gagnants);
            console.log("Classement :", data.classement);
        }

        const main = document.querySelector("main");
        if (main) main.style.display = "none";

        const finPartieDiv = document.createElement("div");
        finPartieDiv.id = "finPartie";

        const titre = document.createElement("h1");
        titre.className = "titre-fin";
        titre.textContent = "Partie terminée !";
        finPartieDiv.appendChild(titre);

        const gagnantDiv = document.createElement("div");
        gagnantDiv.className = "encadre-gagnant";

        const gagnantTexte = document.createElement("h2");
        if (data.gagnants.length === 1) {
            const estGagnant = data.gagnants[0] === monPseudo;
            gagnantTexte.textContent = estGagnant ? "Vous avez gagné !" : `${data.gagnants[0]} remporte la partie !`;
            gagnantTexte.className = estGagnant ? "gagnant-moi" : "gagnant-autre";
        } else {
            gagnantTexte.textContent = `Égalité entre : ${data.gagnants.join(", ")}`;
            gagnantTexte.className = "gagnant-egalite";
        }
        gagnantDiv.appendChild(gagnantTexte);
        finPartieDiv.appendChild(gagnantDiv);

        const classementDiv = document.createElement("div");
        classementDiv.className = "encadre-classement";

        const classementTitre = document.createElement("h3");
        classementTitre.textContent = "Classement final";
        classementDiv.appendChild(classementTitre);

        const tableau = document.createElement("table");
        tableau.className = "tableau-classement";
        tableau.innerHTML = `
            <thead>
                <tr>
                    <th>Position</th>
                    <th>Joueur</th>
                    <th>Score</th>
                </tr>
            </thead>
        `;

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

        const btnRejouer = document.createElement("button");
        btnRejouer.className = "btn-rejouer";
        btnRejouer.textContent = "Rejouer";
        btnRejouer.addEventListener("click", () => location.reload());
        finPartieDiv.appendChild(btnRejouer);

        document.body.appendChild(finPartieDiv);
    });
});
