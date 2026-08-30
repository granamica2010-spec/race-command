# Pubblicare Race Command su Render

La build è pronta per Render tramite `render.yaml` e `Dockerfile`.

## Metodo consigliato: GitHub + Render Blueprint
1. Crea un repository GitHub e carica **il contenuto di questa cartella nella root del repository** (quindi `server.js`, `render.yaml`, `Dockerfile`, `public/`, ecc.).
2. Accedi a Render.
3. `New` → `Blueprint`.
4. Collega il repository GitHub.
5. Render rileva `render.yaml`.
6. Conferma il servizio `race-command` nella regione `frankfurt` e piano `free`.
7. Attendi il deploy.
8. Render fornisce un URL tipo `https://race-command-xxxx.onrender.com`.
9. Tutti i giocatori aprono quell'URL, anche da reti diverse.

## Configurazione inclusa
```yaml
services:
  - type: web
    name: race-command
    runtime: docker
    region: frankfurt
    plan: free
    healthCheckPath: /api/health
    autoDeploy: true
```

Il server ascolta automaticamente la variabile `PORT` fornita da Render.

## Render Free
Il piano gratuito può andare in sleep dopo 15 minuti senza traffico in entrata. Race Command invia un keep-alive HTTP ogni 4 minuti **solo mentre un browser è collegato a una stanza**, quindi una gara attiva genera traffico in ingresso. Se nessuno sta giocando, il servizio può addormentarsi e la prima apertura successiva può richiedere un breve cold start.

## Controllo dopo il deploy
Apri:
`https://TUO-URL.onrender.com/api/health`

Deve restituire un JSON con `"ok": true` e versione `1.1.0`.

Poi prova:
- telefono A su Wi-Fi → crea stanza;
- telefono B su 4G/5G o altro Wi-Fi → entra con il codice;
- la lobby deve mostrare `2 UMANI + 4 BOT = 6`.
