# Race Command v1.9.0 — True Widescreen

- Layout gara desktop completamente rifatto: 3 colonne reali `CONTROLLI | CIRCUITO | CLASSIFICA/RACE CONTROL`.
- La schermata gara usa quasi tutto il viewport (`100vw`) invece di restare dentro una colonna centrale stretta.
- Circuito molto più grande e sempre al centro della scena.
- Classifica e Race Control spostati in una sidebar dedicata a destra.
- Pannello strategia a sinistra compattato: azioni su 4 pulsanti orizzontali, meteo/pit/status redistribuiti.
- Dado e risoluzione restano in overlay sempre visibile.
- Layout tablet/mobile resta adattivo.
- `AGGIORNA_GITHUB.bat` + `.ps1` inclusi e aggiornati alla v1.9.

# Race Command v1.9 — Layout & UX Update

- Nuovo layout desktop a viewport singolo: niente scroll globale durante la gara sui desktop/laptop standard.
- Pannello sinistro riorganizzato su due colonne compatte: stato, gomme/ERS, settore/meteo, pit e azioni restano visibili insieme.
- Classifica desktop su due colonne compatte per sfruttare meglio lo spazio orizzontale.
- Race Control contenuto in un'area a scorrimento interno.
- Il lancio del dado e la pipeline DADO → BONUS → MOVIMENTO ora compaiono in un overlay broadcast fisso al centro: sono visibili anche se la pagina era scorsa.
- Overlay del dado chiuso esplicitamente al termine della sequenza.
- Asset frontend rinominati `app-1.9.js` / `styles-1.9.css` e cache PWA aggiornata.
- `AGGIORNA_GITHUB.bat` e relativo script PowerShell inclusi e aggiornati alla v1.9.

# Race Command v1.9.0

- Corretto `AGGIORNA_GITHUB.bat`: sostituita la copia via `robocopy` con PowerShell, più robusta con cartelle estratte da ZIP e percorsi Windows.
- Aggiunti controlli di integrità (`server.js`, `package.json`, `public/index.html`) prima del commit.
- Nessuna modifica alle regole di gioco rispetto alla v1.7.

# Race Command Web 1.7 — Game Feel Update

## Animazioni e feedback
- Nuovo lancio animato del dado per ogni risoluzione del turno.
- Il valore mostrato non viene generato dal client: deriva sempre dal risultato server-side già deciso.
- Pipeline `DADO → BONUS → MOVIMENTO` con reveal progressivo dei modificatori.
- PACE finale evidenziata prima/durante il movimento.
- Movimento auto reso più rapido e leggibile.
- Auto che guadagnano posizioni evidenziate durante il movimento.
- Banner live per sorpassi, posizioni perse, pit stop e DRS.
- Effetti pioggia visuali per pista umida/bagnata e glow DRS.
- Effetti sonori browser opzionali tramite `FX`.
- Animazioni ridotte se il dispositivo usa `prefers-reduced-motion`.

## Duelli
- Il server ora espone anche `attackerRoll`, `defenderRoll`, `attackerBonus` e `defenderBonus`.
- Reveal del duello con D6 grezzo + bonus + totale per entrambi.
- Scelte, mappa, classifica, gomme, usura ed ERS restano visibili come dalla 1.1.

## Aggiornamento automatico GitHub
- Nuovo `AGGIORNA_GITHUB.bat`.
- Primo avvio: chiede il link HTTPS del repository e lo memorizza nel profilo Windows.
- Se Git manca e `winget` è disponibile, propone l'installazione automatica di Git for Windows.
- Clona l'ultima versione del repository in una cartella temporanea.
- Sostituisce tutti i file tracciati con la nuova build.
- Crea commit e push automatico su `main`.
- Nessuna password/token hardcoded nel progetto; l'autenticazione è delegata a Git/Git Credential Manager.
- Con Render Auto-Deploy `On Commit`, il push aggiorna automaticamente il sito.

## Cache e versione
- Asset frontend rinominati `app-1.9.js` e `styles-1.9.css`.
- Cache server `no-store` applicata genericamente agli asset JS/CSS versionati.
- Service Worker aggiornato a `race-command-v1-7`.
- `/api/health` → `version: 1.9.0`.
- Badge `v1.7` durante la gara.

## Test
- Suite multiplayer completa superata.
- Gara completa fino al traguardo superata.
- Session close/live exit superati.
- Balance guard superato.
- Nuovo release guard per asset v1.7 e updater GitHub.
- Sequenza Git clone → sostituzione → commit → push verificata anche contro un repository Git reale di test.

---

## Funzioni ereditate dalle release precedenti

### 1.6
- Uscita/chiusura sessione live senza refresh.

### 1.5
- Votazione condivisa `FERMA / ESCI` con pausa della gara.

### 1.4 / 1.3
- Pit programmabile in anticipo, persistente e indipendente dall'azione del turno.

### 1.2
- Meteo pre-room e tutte le cinque mescole selezionabili prima del READY.

### 1.1
- Mappa/classifica sempre visibili durante i duelli, migliore race awareness e primo pass di bilanciamento gomme.
## Hotfix updater GitHub 1.9.0

- `AGGIORNA_GITHUB.bat` non contiene più comandi PowerShell complessi inline.
- La copia dei file è delegata a `AGGIORNA_GITHUB.ps1`, evitando che `cmd.exe` interpreti caratteri PowerShell come `@(...)`, pipe o parentesi.
- Controllo esplicito di `server.js`, `package.json` e `public/index.html` prima del commit.
- Nessuna modifica alle regole di gioco rispetto alla 1.7.1.


## Hotfix updater GitHub 1.9.0

- Eliminato il passaggio di `Source` e `Destination` come parametri PowerShell dalla riga di comando.
- I percorsi vengono ora passati tramite variabili d'ambiente (`RC_SOURCE` e `RC_DESTINATION`).
- Questo evita il prompt inatteso `Destination:` causato dal parsing Windows dei percorsi con backslash finale.
