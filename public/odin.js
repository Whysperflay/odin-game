document.addEventListener("DOMContentLoaded", function () {
    // socket ouverte vers le serveur
    let sock = io.connect();

    const inputPseudo = document.getElementById("inputPseudo");
    const btnDemarrer = document.getElementById("btnDemarrer");

    // Appuyer sur Entrée déclanche le clic sur le btnDemarrer
    inputPseudo.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            btnDemarrer.click();
        }
    });

    let monPseudo = "";
    // Clic sur le bouton démarrer
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
        monPseudo = pseudo;

        // Désactiver les champs pseudo et bouton démarrer
        btnDemarrer.disabled = true;
        inputPseudo.disabled = true;
    });

    // ========== SYSTÈME DE NOTIFICATIONS ==========

    /**
     * Crée le conteneur de toasts si inexistant
     */
    function creerConteneurToasts() {
        if (!document.getElementById("conteneurToasts")) {
            const conteneur = document.createElement("div");
            conteneur.id = "conteneurToasts";
            document.body.appendChild(conteneur);
        }
    }

    /**
     * Affiche une notification toast
     * @param {string} message - Le message à afficher
     * @param {string} type - Type: 'info', 'succes', 'erreur', 'warning'
     * @param {number} duree - Durée en ms (défaut: 4000)
     */
    function afficherToast(message, type = "info", duree = 4000) {
        creerConteneurToasts();
        const conteneur = document.getElementById("conteneurToasts");

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icones = {
            info: "ℹ️",
            succes: "✅",
            erreur: "❌",
            warning: "⚠️",
        };

        toast.innerHTML = `
            <div class="toast-icone">${icones[type]}</div>
            <div class="toast-contenu">
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-fermer">×</div>
        `;

        conteneur.appendChild(toast);

        // Fermeture manuelle
        toast.querySelector(".toast-fermer").addEventListener("click", () => {
            toast.style.animation = "slideOut 0.3s ease-out";
            setTimeout(() => toast.remove(), 300);
        });

        // Fermeture automatique
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = "slideOut 0.3s ease-out";
                setTimeout(() => toast.remove(), 300);
            }
        }, duree);
    }

    /**
     * Met à jour la bannière d'état en haut
     * @param {string} messagePrincipal
     * @param {string} messageSecondaire
     * @param {string} classe - 'mon-tour', 'tour-autre', 'premier-tour', 'selection-tas'
     */
    function afficherBanniere(messagePrincipal, messageSecondaire = "", classe = "") {
        let banniere = document.getElementById("banniereEtat");

        if (!banniere) {
            banniere = document.createElement("div");
            banniere.id = "banniereEtat";
            document.body.appendChild(banniere);
        }

        banniere.className = classe;
        banniere.innerHTML = `
            <div class="message-principal">${messagePrincipal}</div>
            ${messageSecondaire ? `<div class="message-secondaire">${messageSecondaire}</div>` : ""}
        `;
    }

    /**
     * Affiche un modal de confirmation
     * @param {string} message
     * @param {function} callbackOui
     */
    function afficherModalConfirmation(message, callbackOui) {
        const modal = document.createElement("div");
        modal.id = "modalConfirmation";

        modal.innerHTML = `
            <div class="modal-contenu">
                <div class="modal-titre">Confirmation</div>
                <div class="modal-message">${message}</div>
                <div class="modal-boutons">
                    <button class="modal-btn modal-btn-non">Non</button>
                    <button class="modal-btn modal-btn-oui">Oui</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector(".modal-btn-non").addEventListener("click", () => {
            modal.remove();
        });

        modal.querySelector(".modal-btn-oui").addEventListener("click", () => {
            modal.remove();
            callbackOui();
        });

        // Clic sur le fond pour fermer
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // ========== REMPLACEMENT DES ALERTS ==========

    // Affichage message en attente d'adversaire
    sock.on("en_attente", function (message) {
        btnDemarrer.innerHTML = message;
        afficherBanniere("En attente de joueurs...", "La partie démarrera quand 3 joueurs seront connectés", "tour-autre");
    });

    // Affichage message erreur
    sock.on("erreur", function (message) {
        afficherToast(message, "erreur", 5000);

        // Réafficher le bouton si le joueur avait essayé de jouer
        const btnJouerCarte = document.getElementById("btnJouerCarte");
        if (btnJouerCarte) {
            btnJouerCarte.style.display = "block";
        }

        // Si on est en phase de connexion, réactiver les champs
        if (btnDemarrer && btnDemarrer.disabled) {
            btnDemarrer.disabled = false;
            inputPseudo.disabled = false;
        }
    });

    // déconnexion
    sock.on("deconnexion", function (message) {
        afficherToast(message, "erreur", 10000);
        afficherBanniere("⚠️ Partie interrompue", "Un adversaire s'est déconnecté", "tour-autre");

        // Redirection après 5 secondes
        setTimeout(() => {
            location.reload();
        }, 5000);
    });

    // Réception de la main
    sock.on("main", function (cartes) {
        console.log("Mes cartes :", cartes);

        // enlever ou cacher l'écran de pseudo
        const ecran = document.getElementById("ecranPseudo");
        if (ecran) ecran.remove();

        //si ancienne main, la supprimer
        const ancienneMain = document.getElementById("maMain");
        if (ancienneMain) ancienneMain.remove();

        //Créer une div pour afficher la main
        const mainDiv = document.createElement("div");
        mainDiv.id = "maMain";

        const ul = document.createElement("ul");
        ul.style.listStyle = "none";
        ul.style.padding = "0";
        ul.style.display = "flex";
        ul.style.gap = "10px";

        for (let carte of cartes) {
            const li = document.createElement("li");
            const valeur = carte.valeur !== undefined ? carte.valeur : carte[0];
            const couleur = carte.couleur !== undefined ? carte.couleur : carte[1];
            li.textContent = `${valeur} de ${couleur}`;
            ul.appendChild(li);
        }

        mainDiv.appendChild(ul);

        // ajouter la section dans <main> ou dans body si absent
        const container = document.querySelector("main") || document.body;
        container.appendChild(mainDiv);
    });

    sock.on("coup_valide", function () {
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

    function afficherTas(tasCartes) {
        console.log("Tas de cartes sur la table :", tasCartes);
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
            li.textContent = `${carte.valeur} de ${carte.couleur}`;
            ul.appendChild(li);
        }
        tasDiv.appendChild(ul);
    }

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

    sock.on("a_toi", function (data) {
        console.log(data.message);

        afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        afficherTas(data.tasCartes);

        // Bannière selon le contexte
        if (data.message.includes("Nouveau tour")) {
            afficherBanniere("🎯 Nouveau tour !", "Jouez 1 carte pour démarrer", "premier-tour");
            afficherToast("C'est à vous ! Nouveau tour commence.", "info", 3000);
        } else if (data.message.includes("Nouvelle manche")) {
            afficherBanniere("🎲 Nouvelle manche !", "Vous commencez - Jouez 1 carte", "premier-tour");
            afficherToast("Nouvelle manche ! Vous commencez.", "succes", 3000);
        } else if (data.message.includes("commencez")) {
            afficherBanniere("🎮 Vous commencez !", "Jouez votre première carte", "mon-tour");
        } else {
            afficherBanniere("🎯 À votre tour !", "Sélectionnez vos cartes", "mon-tour");
        }

        jouerUneCarte();
    });

    sock.on("a_l_autre", function (data) {
        console.log(data.message);

        afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        afficherTas(data.tasCartes);

        // Trouver qui joue
        const joueurCourant = data.nbCartesAdversaires.find((adv) => adv.estCourant);
        const pseudoJoueur = joueurCourant ? joueurCourant.pseudo : "Un adversaire";

        afficherBanniere(`⏳ Tour de ${pseudoJoueur}`, "Attendez votre tour...", "tour-autre");

        const btn = document.getElementById("btnJouerCarte");
        if (btn) btn.style.display = "none";
    });

    sock.on("selectionner_carte_dans_tas", function (tasCartes) {
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

        console.log("Sélectionner une carte dans le tas :", tasCartes);

        afficherBanniere("🃏 Sélectionnez une carte", "Choisissez une carte dans le tas", "selection-tas");
        afficherToast("Sélectionnez une carte dans le tas pour continuer", "info", 4000);

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

                const carteTexte = this.textContent;
                const [valeurStr, , couleur] = carteTexte.split(" ");
                const valeur = parseInt(valeurStr);
                maCarte = { valeur, couleur };
                console.log("Carte du tas sélectionnée :", maCarte.valeur, maCarte.couleur);

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
                afficherToast("Veuillez sélectionner une carte du tas.", "warning");
                return;
            }
            sock.emit("carte_dans_tas_selectionnee", maCarte);
            console.log("Carte du tas envoyée :", maCarte.valeur, maCarte.couleur);
            btnEnvoyerCarteTas.style.display = "none";

            const cartesTas = document.querySelectorAll("#tasCartes li");
            cartesTas.forEach((el) => el.classList.remove("selectionneTas"));
        });
    });

    sock.on("fin_manche", function (data) {
        console.log("Fin de la manche :", data.nbManche);

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
        titre.textContent = `Fin de la manche ${data.nbManche} / ${NB_MANCHES_MAX || 5}`;
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
        message.textContent = "Nouvelle manche dans 3 secondes...";
        scoreMancheDiv.appendChild(message);

        document.body.appendChild(scoreMancheDiv);

        // Supprimer après 3 secondes
        setTimeout(() => {
            scoreMancheDiv.remove();
        }, 3000);
    });

    sock.on("fin_partie", function (data) {
        console.log("Fin de la partie !");
        console.log("Gagnant(s) :", data.gagnants);
        console.log("Classement :", data.classement);

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
});
