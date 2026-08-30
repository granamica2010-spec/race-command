# Race Command 1.2 — Pre-race Weather & Full Tyre Choice

- Meteo di partenza visibile direttamente nella lobby.
- Previsione pre-gara disponibile prima del READY.
- Soft / Medium / Hard / Intermediate / Wet tutte selezionabili in pre-room.
- Il server salva subito la mescola selezionata, anche prima del READY.
- Il meteo mostrato in lobby viene mantenuto fino alla partenza.
- I bot impostano la mescola di partenza in funzione del meteo.
- Il rematch genera un nuovo scenario meteorologico.

---

# Race Command 1.1.1 — Lobby tyre hotfix

- Corretto il bug che riportava sempre la selezione pre-gara su Medium.
- Soft / Medium / Hard sono ora selezionabili prima del READY.
- La mescola scelta viene salvata immediatamente sul server e sopravvive a refresh/riconnessione.
- Una volta READY, la mescola resta bloccata finché non si annulla READY.

# Race Command 1.1 — Release Notes

## Race Awareness
- Duelli con mappa e classifica sempre visibili.
- Evidenziazione dei due piloti coinvolti e distacco pre-duello.
- Informazioni su gomma, usura ed ERS durante la scelta.
- Spettatori mantengono la vista della gara durante i duelli.
- Timer duello sempre visibile.
- ERS non selezionabile se insufficiente, con validazione server-side.
- Classifica con distacco dal leader.
- START/FINISH e senso di marcia resi espliciti sulla mappa.
- Scelta gomme al box con dado previsto e indicazione IDEALE.

## Balance pass
- Soft: degrado 16 (prima 10), curva prestazionale più aggressiva.
- Medium: progressiva e bilanciata.
- Hard: D7 su asciutto e degrado 4 (prima D6/degrado 5).
- Pit loss normale circa -5, Safety Car -2.
- Test Monte Carlo interno: su stint lunghi asciutti Soft e Medium risultano molto vicine, Hard sacrifica qualche casella per evitare soste.

## Correzioni
- Nessun contatto casuale se l’attaccante rinuncia (HOLD) o il difensore lascia passare (DON’T FIGHT).
- Selezionare un’opzione nel duello non ricostruisce più la pagina, evitando salti di scroll su smartphone.

# Race Command 1.0 FINAL

## Versione finale del gameplay base
- griglia fissa da 6 auto;
- bot completamente automatici da 1+5 a 6+0;
- possibilità di avviare la gara anche con un solo umano;
- IA bot migliorata per gomme, meteo, ERS, distacchi, settori, box e duelli;
- sostituzione automatica dei posti liberi in lobby;
- uscita volontaria in gara → monoposto convertita in AI;
- 60 s di grazia per disconnessioni in lobby;
- griglia di partenza randomizzata per evitare vantaggio fisso all'host;
- keep-alive per hosting Internet gratuito durante partite attive;
- PWA con icone 192/512 px;
- configurazione Render Frankfurt pronta;
- test end-to-end di una gara completa fino alla bandiera a scacchi.

## Test finale
`npm run test:all` superato.
