# 🐺 Werwölfe von Schattenmoor

Werwolf-Partyspiel im Browser — **ohne Anmeldung, ohne Installation**.
In zwei Ausführungen: ein Gerät zum Herumreichen, oder jeder an seinem eigenen Handy.

**▶ [Direkt spielen (Ein-Gerät)](https://lionboomer.github.io/werwolf/)**
· 📄 [Regelzettel zum Ausdrucken](regelzettel.pdf)

---

## Zwei Varianten

| | Ein-Gerät | Multiplayer |
|---|---|---|
| **Ordner** | `index.html` (Wurzel) | `multiplayer/` |
| **Zustand** | ✅ fertig, gespielt und getestet | ⚙️ läuft, einzelne Rollen fehlen noch |
| **Wie** | Ein Handy geht im Kreis herum, die App ist der Erzähler | Node.js/WebSocket-Server, Lobby-Code, eigener Erzähler-Bildschirm |
| **Braucht** | nichts — eine einzige HTML-Datei | Node 18+, oder kostenloses Hosting per `render.yaml` |

Die Ein-Gerät-Fassung ist **eine einzige Datei ohne Abhängigkeiten**. Herunterladen und
doppelklicken genügt — sie funktioniert auch offline und auf einem USB-Stick.

---

## Regeln

**Nachtreihenfolge:** Amor (nur Nacht 1) → Seherin → Werwölfe → Hexe.
Nach jeder Rolle sagt der Erzähler ausdrücklich, dass sie wieder einschläft, bevor die
nächste geweckt wird — so verrät die Pause niemanden.

### Rollenverteilung

| Spieler | 🐺 Wölfe | 🔮 Seherin | 🧪 Hexe | 🏹 Jäger | 💘 Amor | 🧑‍🌾 Dorf |
|---|---|---|---|---|---|---|
| **3** | 1 | 1 | – | – | – | 1 |
| **4** | 1 | 1 | – | – | – | 2 |
| 5 | 1 | 1 | – | – | – | 3 |
| 6 | 1 | 1 | – | – | – | 4 |
| 7 | 2 | 1 | 1 | – | – | 3 |
| 8 | 2 | 1 | 1 | 1 | – | 3 |
| 9 | 2 | 1 | 1 | 1 | 1 | 3 |
| 10 | 3 | 1 | 1 | 1 | 1 | 3 |
| 11 | 3 | 1 | 1 | 1 | 1 | 4 |
| 12 | 3 | 1 | 1 | 1 | 1 | 5 |

> **Balance-Entscheid:** Bei 6 Spielern standen vorher Seherin *und* Hexe gegen einen
> einzigen Wolf — erdrückend. Jetzt gibt es dort nur **eine** Sonderrolle, dafür einen
> Dorfbewohner mehr. Die Hexe kommt ab 7 Spielern dazu.

### Kleine Runde (3–4 Spieler)

Zu dritt bricht das normale Regelwerk: Der Wolf reißt in Nacht 1 einen von zwei
Dorfbewohnern, steht dann eins zu eins da — und **gewinnt durch Gleichstand, bevor
überhaupt geredet wurde**. Deshalb gelten ab 4 Spielern abwärts zwei Ausnahmen:

1. **In Nacht 1 reißt das Rudel nicht.** Der Erzähler erklärt es im Spiel: „Die Runde
   ist klein, das Moor liegt offen — wer heute Nacht reißt, verrät sich morgen selbst."
   Die Seherin schaut trotzdem.
2. **Die Wölfe gewinnen erst, wenn *alle* Dorfbewohner tot sind** — nicht schon bei
   Gleichstand.

Damit läuft eine Dreierrunde so: eine Nacht mit Vision, **eine** Diskussion, **eine**
Abstimmung. Trifft das Dorf den Wolf, gewinnt es. Trifft es daneben, holt sich der Wolf
in Nacht 2 den Rest.

Kurz, dicht und ohne Leerlauf — das Salz liegt darin, dass der Wolf ebenso gut behaupten
kann, die Seherin zu sein. Bei 4 Spielern bekommt das Dorf entsprechend zwei Versuche.

**Hausregel Wolfs-Selbstwahl:** Die Werwölfe dürfen **jeden Lebenden** reißen, auch einen
Mitwolf oder sich selbst — mit eigener Erzähler-Meldung („Das Rudel hat sich selbst
zerfleischt"). Reißt sich der letzte Wolf selbst, gewinnt das Dorf.

**Siegbedingungen:** Dorf, wenn alle Wölfe tot sind · Werwölfe, sobald sie an Zahl
ebenbürtig oder überlegen sind · Liebespaar, wenn nur noch die zwei Verliebten übrig
sind — unabhängig vom Team.

---

## Erzähler und Zufallsereignisse

Jede Erzähler-Zeile wird per **Web Speech API** auf Deutsch vorgelesen (`de-DE`, tiefere
Tonlage). Mehrere Textblöcke auf einem Bildschirm werden zu **einer** Äußerung
zusammengefasst — sonst schneidet die nächste die vorige ab.

Dazu **Zufallsereignisse am Tag**, damit keine Runde wie die vorige läuft.

Fehlt die Sprachausgabe im Browser (Firefox je nach System), läuft alles andere weiter.

---

## Multiplayer betreiben

```bash
cd multiplayer
npm install
npm start          # http://localhost:8791
```

**Bei Lion läuft er schon:** [werwolf.lionwitte.de](https://werwolf.lionwitte.de/) für
Spieler, `/narrator` für den Erzähler.

**Zu wenige am Tisch?** Der Erzähler füllt die Lobby per Knopfdruck mit **Bots** auf.
Sie ziehen zufällig, aber immer regelkonform — sie bluffen nicht, sie ersetzen nur die
fehlende Hand. Damit läuft schon eine Dreierrunde.

Ein Gerät öffnet den **Erzähler-Bildschirm** und sieht alle Rollen, alle anderen treten
mit einem **Lobby-Code** bei. Für kostenloses Hosting liegt ein `render.yaml` bei —
Blueprint auf [render.com](https://render.com) importieren, fertig.

Details in [`multiplayer/README.md`](multiplayer/README.md).

---

## Herkunft

Entstanden im `lion-wiki`-Repo und am **2026-08-09** hierher ausgelagert — Anwendungscode
gehört nicht in eine Wissensdatenbank. Die Projektdokumentation bleibt dort unter
`wiki/projects/werwolf-schattenmoor.md`.

## Lizenz

MIT — mach damit, was du willst.
