# Race Command Web 1.9.1

## Novità 1.9.1 — Layout Rebalance

- Desktop largo: circa 32% controlli, 45% circuito, 23% classifica/Race Control.
- Colonna sinistra più larga e testi più leggibili.
- Azioni in griglia 2×2 con pulsanti più grandi.
- Circuito centrale meno dominante.
- Dado/risoluzione sempre in overlay fisso.


Race Command è un party strategy game di corse multiplayer da browser, pensato soprattutto per smartphone ma giocabile anche da tablet e PC.

## Novità 1.9 — Layout & UX

La schermata gara desktop ora usa tutto lo spazio disponibile senza trasformarsi in una pagina lunga: il pannello strategico è compatto, la classifica usa due colonne e Race Control scorre internamente. Il lancio del dado appare in un overlay centrale sempre visibile, quindi non serve più usare la rotella del mouse per vedere la risoluzione del turno.


## Novità 1.7 — Game Feel Update

- **Lancio del dado animato** a ogni turno: il server decide sempre il risultato, il client anima soltanto il valore ufficiale ricevuto.
- Sequenza visiva del turno: **DADO → BONUS → MOVIMENTO**.
- Reveal separato di dado base, modificatori (ATTACK / ERS / DRS / SCIA / PIT) e **PACE totale**.
- Movimento auto più rapido e fluido, con evidenziazione delle auto che guadagnano posizioni.
- Banner live per **sorpasso, posizione persa, pit stop e DRS**.
- Effetti meteo animati sulla pista per DAMP / WET / VERY WET.
- Zona DRS più evidente quando è realmente disponibile.
- Duelli migliorati: entrambi i piloti mostrano **D6 grezzo + bonus + punteggio totale**, oltre alle scelte già presenti.
- Effetti audio sintetizzati dal browser, **opzionali** tramite pulsante `FX` (nessun file audio esterno).
- Rispetto di `prefers-reduced-motion` per chi disabilita le animazioni di sistema.
- Nuovo `AGGIORNA_GITHUB.bat`: dopo la prima configurazione aggiorna GitHub e quindi Render senza dover caricare a mano tutti i file.

## Aggiornamento GitHub con doppio clic

Da questa versione non è più necessario usare `Upload files` su GitHub ogni volta.

1. Estrai la nuova versione di Race Command.
2. Fai doppio clic su `AGGIORNA_GITHUB.bat`.
3. Al primo utilizzo incolla il link HTTPS del repository, ad esempio:
   `https://github.com/tuo-utente/race-command`
4. Il BAT salva quel link nel tuo profilo Windows.
5. Clona automaticamente l'ultima versione presente su GitHub.
6. Sostituisce i file con quelli della build che hai appena estratto.
7. Crea il commit e fa `git push` sul branch `main`.
8. Se Render è collegato a `main` con Auto-Deploy attivo, il deploy parte automaticamente dopo il push.

### Primo utilizzo del BAT

- È necessario **Git for Windows**.
- Se Git non è presente e Windows dispone di `winget`, il BAT propone di installarlo automaticamente.
- Alla prima operazione GitHub può aprire il browser tramite Git Credential Manager per effettuare il login. Non vengono salvati token o password dentro Race Command.
- Il repository usato viene salvato in `%USERPROFILE%\.race-command-github-repo.txt`.
- Se vuoi cambiare repository, riapri il BAT e scegli `C = Cambia`.

## Regola fondamentale: griglia sempre da 6

Il server mantiene automaticamente sei monoposto:

- 1 umano + 5 bot
- 2 umani + 4 bot
- 3 umani + 3 bot
- 4 umani + 2 bot
- 5 umani + 1 bot
- 6 umani + 0 bot

Quando entra un nuovo umano, sostituisce un bot. Quando un umano lascia la lobby, torna automaticamente un bot.

## Multiplayer da reti diverse

Con il progetto pubblicato su Render (o altro host Node pubblico), tutti aprono lo stesso URL HTTPS. Possono quindi essere su Wi-Fi diversi, 4G/5G o in città diverse.

Flusso:
1. Un giocatore crea la stanza.
2. Riceve codice e link invito.
3. Gli altri entrano dallo stesso sito.
4. La griglia resta da 6.
5. Ogni umano sceglie gomma e READY.
6. L'host avvia la gara.

## Gameplay incluso

- gare da 3 / 5 / 8 / 10 giri;
- scelte simultanee segrete;
- NORMAL / ATTACK / CONSERVE / ERS;
- pit stop programmabile in qualsiasi momento e indipendente dall'azione del turno;
- Soft / Medium / Hard / Intermediate / Wet;
- meteo iniziale visibile in pre-room e meteo dinamico durante la gara;
- usura e prestazione delle gomme;
- DRS e scia;
- tre settori con caratteristiche differenti;
- pit-entry e pit lane reali;
- Safety Car;
- duelli attaccante/difensore con mappa e classifica sempre visibili;
- bot strategici per meteo, usura, ERS, distacchi, settori, box e duelli;
- chiusura condivisa della sessione;
- classifica e Race Control;
- statistiche finali e rematch;
- PWA installabile;
- riconnessione automatica e host migration.

## Pit programmato

BOX non è un'azione del turno. Puoi programmare una mescola in qualunque momento e continuare a selezionare normalmente il ritmo. Il piano resta server-side finché la monoposto non raggiunge o supera la pit-entry; a quel punto la sosta viene eseguita automaticamente nello stesso turno.

## Chiusura condivisa della sessione

Qualunque umano può usare **FERMA / ESCI**.

- Il richiedente parte come `OK · ESCO`.
- Gli altri umani scelgono `OK · ESCO` oppure `NO · RESTO`.
- Nessuna risposta entro 30 secondi = `NO · RESTO`.
- Durante il voto gara/duelli/semafori sono in pausa.
- Chi vota OK esce live senza F5.
- Chi vota NO resta; le auto lasciate dagli umani passano all'IA per conservare 6 auto.
- Se tutti gli umani accettano, la stanza viene chiusa definitivamente e non è più accessibile.

## Disconnessioni

- Lobby: 60 secondi di grazia, poi il posto torna a un bot.
- Gara: una perdita temporanea di rete non elimina subito il pilota; è possibile riconnettersi.
- Uscita esplicita durante una gara: la monoposto continua come AI.

## Avvio locale Windows

1. Installa Node.js 22 o più recente.
2. Estrai lo ZIP.
3. Doppio clic su `START_WINDOWS.bat`.
4. Sul PC apri `http://localhost:3000`.
5. Sulla stessa LAN puoi usare l'indirizzo mostrato nella finestra del server.

## Avvio locale macOS/Linux

```bash
chmod +x START_MAC_LINUX.sh
./START_MAC_LINUX.sh
```

## Pubblicazione Internet

Vedi `DEPLOY_RENDER.md`.

## Aggiornare una versione già pubblicata

Se il repository e Render sono già configurati, per le prossime versioni il flusso consigliato è semplicemente:

1. scarica ed estrai il nuovo ZIP;
2. doppio clic `AGGIORNA_GITHUB.bat`;
3. conferma il repository salvato;
4. attendi il messaggio `FATTO`;
5. Render esegue l'auto-deploy del nuovo commit.

## Verifica versione online

Apri:

`https://TUO-SITO.onrender.com/api/health`

La build 1.7 corretta deve mostrare:

```json
{"ok":true,"version":"1.9.1"}
```

Durante la gara compare anche il badge `v1.9.1`.

## Test automatici

`npm run test:all` verifica:

- griglia automatica 1+5 fino a 6+0;
- multiplayer e scelte segrete;
- votazione/chiusura sessione e uscita live;
- gara completa fino alla bandiera a scacchi;
- pit programmato;
- duelli;
- bilanciamento gomme;
- presenza degli asset v1.7, animazioni e updater GitHub.

## Nota sull'hosting

Le stanze vivono nella memoria del processo Node. Un riavvio o redeploy dell'host elimina le partite attive. È una scelta adatta all'uso hobby/privato attuale e mantiene l'architettura semplice; una versione con persistenza delle sessioni richiederebbe uno storage esterno.

### Updater GitHub 1.9.1

Se una versione precedente mostrava il prompt PowerShell `Destination:`, la 1.9.1 elimina quel problema: i percorsi non vengono più passati come parametri della riga di comando.

## Layout desktop v1.9

La schermata gara su monitor da almeno 1200 px usa una struttura a tre colonne e quasi tutta la larghezza del browser: pannello strategico a sinistra, circuito grande al centro, classifica e Race Control a destra. Il dado rimane un overlay fisso e non richiede scroll.
