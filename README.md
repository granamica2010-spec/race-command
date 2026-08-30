# Race Command — Web 1.5

Race Command è un gioco strategico di corse multiplayer da browser, pensato per smartphone, tablet e PC.


## Novità 1.5 — Pit stop programmabile

- Il pit stop si può **programmare in qualsiasi punto del circuito**.
- Il piano box è separato dalla scelta del turno: puoi avere, ad esempio, `BOX PROGRAMMATO · INTER` e scegliere comunque NORMAL / ATTACK / CONSERVE / ERS.
- La monoposto entra automaticamente quando il movimento del turno **raggiunge o supera la pit-entry**, quindi un tiro alto non può più farti saltare involontariamente l'ingresso.
- Il piano resta memorizzato per tutti i turni necessari e sopravvive a refresh/riconnessione perché vive sul server.
- Prima di arrivare alla pit-entry puoi cambiare la mescola programmata oppure annullare completamente la sosta.
- La strategia box resta gestibile anche durante un duello.
- I bot usano la stessa logica: possono decidere in anticipo la sosta e proteggere le gomme fino all'ingresso.

## Novità 1.2 — Meteo e gomme già in pre-room

- La lobby mostra il **meteo effettivo della partenza** e una previsione sintetica.
- Il meteo visto in lobby resta invariato fino a LIGHTS OUT.
- In pre-room sono selezionabili tutte e cinque le mescole: **Soft, Medium, Hard, Intermediate e Wet**.
- Ogni mescola mostra il dado previsto con il meteo di partenza e indica quella più adatta.
- La scelta viene salvata sul server appena tocchi la gomma, quindi non torna più automaticamente su Medium.
- I bot scelgono automaticamente le gomme di partenza in base alle condizioni.
- A ogni rematch viene generato un nuovo scenario meteo pre-gara.


## Hotfix 1.1.1
- Selezione reale della gomma di partenza in lobby: Soft / Medium / Hard vengono salvate immediatamente, prima del READY.
- La scelta resta corretta anche dopo refresh o riconnessione.

## Novità 1.1 — Race Awareness
- Durante ogni duello restano visibili **mappa, posizione di tutte e 6 le auto, classifica, gomme, usura ed ERS**.
- I due piloti coinvolti sono evidenziati sulla mappa e in classifica.
- Il duello mostra ruolo (attaccante/difensore), posizione e distacco prima della scelta.
- Le opzioni ERS vengono disabilitate quando l’energia non basta, con controllo anche lato server.
- Classifica normale con distacchi dal leader e maggiore leggibilità delle risorse.
- Mappa con START/FINISH e frecce di direzione più chiare.
- Box: ogni mescola mostra il dado previsto per il meteo attuale e quella migliore viene evidenziata.
- Bilanciamento gomme rivisto: Soft più esplosiva ma molto più corta, Medium equilibrata, Hard più stabile; pit stop normale più costoso.

## Regola fondamentale: griglia sempre da 6
Il server gestisce automaticamente i bot:

- 1 giocatore umano + 5 bot
- 2 umani + 4 bot
- 3 umani + 3 bot
- 4 umani + 2 bot
- 5 umani + 1 bot
- 6 umani + 0 bot

Quando un nuovo umano entra in lobby, sostituisce automaticamente un bot. Se un umano lascia la lobby, il server ripristina automaticamente un bot. Non esistono più pulsanti manuali per aggiungere/rimuovere bot.

## Multiplayer da reti diverse
Quando il progetto è pubblicato su Render (o un altro host Node pubblico), tutti usano lo stesso URL HTTPS. I giocatori possono quindi essere su Wi-Fi diversi, 4G/5G o in città diverse.

Flusso:
1. Un giocatore apre il sito e crea la stanza.
2. Riceve un codice di 4 caratteri e un link invito.
3. Gli altri aprono lo stesso sito da qualsiasi rete e inseriscono il codice (o usano il link).
4. La griglia resta automaticamente da 6.
5. Gli umani scelgono gomma e READY; i bot sono gestiti dal server.
6. L'host avvia la gara.

## Gameplay incluso
- 3 / 5 / 8 / 10 giri
- scelte simultanee segrete
- NORMAL / ATTACK / CONSERVE / ERS come azioni simultanee
- pit stop programmabile separatamente in qualsiasi momento
- Soft / Medium / Hard / Intermediate / Wet
- usura gomme e ritmo/dado dipendente dalla mescola
- meteo dinamico
- DRS e scia
- tre settori con caratteristiche differenti
- pit-entry e pit lane reali
- Safety Car
- duelli attaccante/difensore con scelte segrete e reveal
- bot strategici che valutano meteo, usura, ERS, distacco, settore e momento della prossima sosta
- classifica e Race Control
- schermata finale con statistiche
- rematch
- PWA installabile su Home
- riconnessione automatica
- host migration

## Disconnessioni
- In lobby: un umano disconnesso ha 60 secondi per riconnettersi; dopo viene rimosso e il posto torna a un bot.
- In gara: una perdita di rete non elimina immediatamente il pilota. Il server usa azioni conservative/standard allo scadere dei timer e il giocatore può riconnettersi.
- Se un giocatore preme esplicitamente ESCI durante la gara, la sua monoposto continua come AI per mantenere la griglia da 6.

## Test effettuati
`npm run test:all` verifica automaticamente:
- tutte le composizioni 1+5 fino a 6+0;
- sostituzione automatica bot/umani;
- gara 1 umano + 5 bot;
- gara 2 umani + 4 bot;
- programmazione anticipata del pit e ingresso automatico quando viene raggiunta la pit-entry;
- segretezza delle scelte simultanee;
- gara completa fino alla bandiera a scacchi con duelli.

## Avvio locale Windows
1. Installa Node.js 22 o più recente.
2. Estrai la cartella.
3. Doppio clic su `START_WINDOWS.bat`.
4. Apri `http://localhost:3000` sul PC.
5. Per dispositivi sulla stessa rete usa l'indirizzo LAN mostrato nella finestra del server.

## Avvio locale macOS/Linux
```bash
chmod +x START_MAC_LINUX.sh
./START_MAC_LINUX.sh
```

## Pubblicazione Internet
Vedi `DEPLOY_RENDER.md`.

## Nota sull'hosting gratuito
Le stanze sono conservate nella memoria del server. Durante una partita attiva il client invia un keep-alive periodico, ma un riavvio/redeploy dell'istanza hosting elimina le stanze attive. Per un gioco privato/hobby questo evita database e account; per disponibilità mission-critical servirebbe persistenza esterna.


## Verifica versione online
Dopo il deploy apri `/api/health`: la build corretta deve mostrare `"version":"1.5.0"`. Durante la gara compare anche il badge `v1.5`. Se non compare, il deploy non ha ancora sostituito la build precedente.


## Chiusura condivisa della sessione
Qualunque giocatore umano può usare **FERMA / ESCI**. Il richiedente vota automaticamente **OK, ESCO** e gli altri umani ricevono la richiesta. Chi vota OK esce; chi vota NO resta. Se tutti gli umani accettano, la stanza viene chiusa definitivamente e il codice non è più accessibile durante la vita del server. Durante la votazione la gara è in pausa; nessuna risposta entro 30 secondi vale come **NO, RESTO**.
