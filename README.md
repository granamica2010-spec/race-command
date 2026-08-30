# Race Command — Web 1.0 FINAL

Race Command è un gioco strategico di corse multiplayer da browser, pensato per smartphone, tablet e PC.

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
- NORMAL / ATTACK / CONSERVE / ERS / BOX
- Soft / Medium / Hard / Intermediate / Wet
- usura gomme e ritmo/dado dipendente dalla mescola
- meteo dinamico
- DRS e scia
- tre settori con caratteristiche differenti
- pit-entry e pit lane reali
- Safety Car
- duelli attaccante/difensore con scelte segrete e reveal
- bot strategici che valutano meteo, usura, ERS, distacco, settore e pit window
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
- protezione della pit window;
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
