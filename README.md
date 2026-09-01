# Race Command Web 2.0

Race Command è un gioco multiplayer da browser/PWA per 1–6 giocatori reali. La griglia è sempre da 6: i posti mancanti vengono riempiti automaticamente dai bot.

## Novità principali 2.0

- **Scelta circuito in pre-room**: Catalunya, Monza, Monaco, Spa-Francorchamps e Suzuka.
- Ogni circuito modifica realmente il gameplay: usura gomme, bonus DRS/scia, perdita ai box, difficoltà di sorpasso, rischio tecnico e tendenza alla pioggia.
- **Meteo e stato pista separati**: può smettere di piovere ma l'asfalto resta bagnato e si asciuga gradualmente.
- **Qualifica rapida opzionale**: SAFE / PUSH / MAX ATTACK. Se disattivata, griglia casuale.
- **Duelli a contro-mosse**: INTERNO / ESTERNO / CUTBACK contro COPRI INTERNO / COPRI ESTERNO / FRENATA TARDIVA, più ERS.
- **Bot con personalità**: Duelist, Rain Master, Strategist, Tyre Whisperer e Aggressor.
- **Undercut/overcut**: gomme nuove con warm-up e breve finestra di grip fresco.
- **Danni leggeri**: un contatto rischioso può danneggiare l'ala (-1 ritmo) fino al pit stop, che la ripara.
- **Safety Car restart**: al giro di ripartenza ATTACK/ERS ricevono un bonus dedicato.
- Premi finali: Driver of the Day, Overtake King, Duel Master, Best Strategist.
- Layout widescreen, dado animato e aggiornamento automatico GitHub già inclusi.

## Avvio locale Windows

Estrai completamente lo ZIP e fai doppio clic su `START_WINDOWS.bat`.

Il PC apre il gioco su `http://localhost:3000`. Gli altri dispositivi sulla stessa rete possono usare l'indirizzo LAN mostrato nella finestra.

## Gioco online

La build è pronta per Render. Con il servizio pubblico attivo, tutti i giocatori possono usare Wi-Fi/5G/reti diverse aprendo lo stesso URL e inserendo il codice stanza.

## Aggiornamento GitHub automatico

Fai doppio clic su `AGGIORNA_GITHUB.bat`.

La prima volta il programma chiede il link HTTPS del repository GitHub e lo salva sul PC. Le volte successive basta confermare con `S`. Lo script clona il repository, sostituisce i file con questa build, crea il commit e fa push sul branch `main`. Se Render ha Auto-Deploy attivo, il sito online si aggiorna da solo.

Lo script non salva token o password dentro il progetto.

## Controllo versione

Apri:

`https://TUO-SITO/api/health`

La versione corretta deve mostrare:

```json
{"ok":true,"version":"2.0.1"}
```

## Test

Con Node.js installato:

`npm run test:all`

La suite controlla multiplayer, griglia 6/6, chiusura sessione live, circuiti, qualifica, meteo/pista, gara completa, pit, duelli, bilanciamento e asset della release.

### Previsioni meteo 2.0.1
La fascia `ORA / +10 / +20 / +30` non è più una stima grafica inventata dal browser: viene calcolata dal server e rappresenta l’evoluzione che la gara seguirà realmente per i successivi 30 minuti di gioco. Una finestra di pioggia non può durare indefinitamente: dopo un massimo di quattro slot consecutivi il sistema impone una fase senza precipitazioni, mentre la pista può comunque restare bagnata e asciugarsi gradualmente.
