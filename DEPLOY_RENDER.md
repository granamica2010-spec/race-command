# Pubblicare e aggiornare Race Command su Render

La build include `render.yaml` e `Dockerfile` ed è pronta per essere eseguita come servizio Node/Docker.

## Prima pubblicazione

1. Crea un repository GitHub, ad esempio `race-command`.
2. Metti i file di Race Command nella **root** del repository.
3. Su Render scegli `New` → `Blueprint`.
4. Collega il repository GitHub.
5. Render legge `render.yaml`.
6. Conferma il servizio `race-command`.
7. Terminato il deploy, Render assegna un URL HTTPS pubblico.

La configurazione inclusa è:

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

## Aggiornamenti successivi — metodo consigliato

Dalla v1.7 usa `AGGIORNA_GITHUB.bat`:

1. estrai il nuovo ZIP;
2. doppio clic sul BAT;
3. al primo utilizzo incolla il link GitHub HTTPS;
4. completa eventualmente il login GitHub nel browser;
5. il BAT esegue clone, sostituzione file, commit e push su `main`;
6. Render, se Auto-Deploy è attivo su `On Commit`, avvia automaticamente il deploy del nuovo commit.

Non è quindi necessario ricaricare ogni volta tutti i file dal sito GitHub.

## Controllo versione

Apri:

`https://TUO-URL.onrender.com/api/health`

Per la v1.7 deve comparire `"version":"1.7.3"`.

## Multiplayer da reti diverse

Una volta online, tutti i giocatori utilizzano lo stesso URL Render. Non devono essere sulla stessa rete: possono usare Wi-Fi diversi o rete mobile.

## Nota sul piano gratuito

Un host gratuito può sospendere servizi inattivi. Race Command invia un keep-alive HTTP periodico mentre un browser è collegato a una stanza. Se il servizio è stato sospeso perché nessuno giocava, la prima apertura successiva può richiedere il riavvio dell'istanza.

## Persistenza

Le stanze sono in memoria. Un redeploy o riavvio del server elimina le partite attive: esegui quindi gli aggiornamenti tra una sessione e l'altra.
