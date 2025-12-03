document.addEventListener("DOMContentLoaded", function () {
    // socket ouverte vers le serveur
    let sock = io.connect();

    // ******************************************************
    // GESTION DU PSEUDO ET DEMARRAGE DE LA PARTIE
    // ******************************************************
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

    // ******************************************************
    // GESTION DES ÉVÉNEMENTS DU JEU
    // ******************************************************

    /**
     * Affichage message en attente d'adversaire
     * @param {string} message
     */
    sock.on("en_attente", function (message) {
        btnDemarrer.innerHTML = message;
    });

    // Affichage message erreur
    sock.on("erreur", function (message) {
        afficherNotification("Erreur : " + message, "info");
        btnDemarrer.disabled = false;
        inputPseudo.disabled = false;
    });

    // déconnexion
    sock.on("deconnexion", function (message) {
        alert("Déconnexion : " + message + "\n\nRedirection dans 10 secondes...");
        setTimeout(() => {
            location.reload();
        }, 10000);
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
    });

    /**
     * Affiche le message de notification
     * @param {String} message
     * @param {string} type
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
     * Permet de jouer une carte
     */
    function jouerUneCarte() {
        let btnJouerCarte = document.getElementById("btnJouerCarte");

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
                        const carteTexte = cartes[i].textContent;
                        const [valeurStr, , couleur] = carteTexte.split(" ");
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
                        console.log("Cartes jouées :", cartesJouees);
                        sock.emit("jouer_carte", cartesJouees);
                    }
                }
            });
        }

        btnJouerCarte.style.display = "block";
        btnJouerCarte.textContent = "Passer le tour";

        attacherListenersCartes();
    }

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
        afficherNotification(data.message, "tour");
        afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        afficherTas(data.tasCartes);
        jouerUneCarte();
    });

    sock.on("a_l_autre", function (data) {
        console.log(data.message);
        afficherNotification(data.message, "tour");
        afficherNbCartesAdversaires(data.nbCartesAdversaires, monPseudo);
        afficherTas(data.tasCartes);
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
        afficherNotification("C'est à vous de sélectionner une carte dans le tas.", "info");

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
                afficherNotification("Veuillez sélectionner une carte du tas.", "info");
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

        // Réafficher le main
        if (main) main.style.display = "block";
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
