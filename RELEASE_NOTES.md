# Race Command v2.0.1 — Weather Forecast Fix

## Correzione meteo
- La previsione `ORA / +10 / +20 / +30` ora arriva dal server ed è la timeline che la gara seguirà davvero.
- Il server non ricalcola più casualmente il meteo a ogni tiro di dado.
- Se il forecast mostra sole/nuvoloso per i prossimi 30 minuti, non può iniziare a piovere al turno successivo.
- Le finestre di pioggia hanno durata finita: massimo 4 slot consecutivi, poi parte una fase di asciugatura di almeno 20 minuti.
- Meteo atmosferico e acqua in pista restano separati: può smettere di piovere ma la pista può restare WET/DAMP per qualche turno.
- Cambiando circuito o facendo rematch viene generata una nuova timeline coerente con le caratteristiche del circuito.

## Circuiti
- Aggiunta selezione circuito in pre-room.
- Catalunya: usura alta, comportamento equilibrato.
- Monza: DRS e scia più forti, usura bassa.
- Monaco: sorpassi più difficili, forte componente tecnica.
- Spa-Francorchamps: meteo più instabile, pit loss maggiore, scia forte.
- Suzuka: usura e rischio tecnico più elevati, maggiore tendenza alla pioggia.

## Meteo e pista
- Meteo atmosferico e stato dell'asfalto ora sono due sistemi distinti.
- La pista mantiene acqua dopo la fine della pioggia e si asciuga gradualmente.
- Le gomme vengono valutate sullo stato reale della pista.

## Pre-race e qualifica
- Qualifica rapida opzionale con SAFE, PUSH e MAX ATTACK.
- Il risultato determina la griglia di partenza.
- Disattivando la qualifica resta la griglia casuale.

## Strategia
- Gomme nuove con warm-up e finestra di grip fresco.
- Pit loss dipendente dal circuito.
- Safety Car rende il pit più economico e crea un giro di restart con bonus.

## Duelli
- Nuovo sistema di contro-mosse INTERNO / ESTERNO / CUTBACK.
- Difesa COPRI INTERNO / COPRI ESTERNO / FRENATA TARDIVA.
- Matchup leggibile nel reveal.
- Contatti rischiosi possono produrre ala danneggiata (-1 ritmo fino al pit).

## Bot
- Apex AI: Duelist.
- Nova AI: Rain Master.
- Velocity AI: Strategist.
- Pulse AI: Tyre Whisperer.
- Titan AI: Aggressor.

## Fine gara
- Driver of the Day.
- Overtake King.
- Duel Master.
- Best Strategist.

## Tecnico
- Versione API: `2.0.1`.
- Asset frontend anti-cache: `app-2.0.1.js`, `styles-2.0.1.css`.
- `AGGIORNA_GITHUB.bat` e `AGGIORNA_GITHUB.ps1` inclusi.
- Suite completa `npm run test:all` aggiornata alla 2.0.