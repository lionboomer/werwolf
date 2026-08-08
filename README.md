# 🐺 Werwölfe von Düsterwald

Ein Spielleiter-Werkzeug für Werwolf-Runden — **im Browser, ohne Anmeldung, ohne Server**.
Ein Handy reicht für die ganze Gruppe.

**▶ [Hier spielen](https://lionboomer.github.io/werwolf/)**

---

## Was es macht

Werwolf braucht sonst einen Spielleiter, der Rollen mischt, die Nachtreihenfolge im Kopf
hat und aufpasst, dass die Hexe ihren Trank nur einmal benutzt. Das übernimmt diese Seite.

- **Rollen automatisch verteilen** — ausbalanciert nach Spielerzahl (4 bis 30)
- **Verdeckte Rollenvergabe** — das Gerät wandert reihum, jeder sieht nur sich selbst
- **Nachtphase führt sich selbst** — richtige Reihenfolge, richtige Auswahl, keine Regelfehler
- **Zufallsereignisse** — Vollmond, Nebel, Erntedankfest und sieben weitere
- **Erzähler mit Stimme** — spricht die Ansagen auf Deutsch vor
- **Chronik** — was in welcher Nacht geschah, zum Nachlesen am Ende

Es wird **nichts gespeichert und nichts gesendet**. Nur die Namensliste bleibt lokal im
Browser, damit die nächste Runde schneller startet.

---

## Rollen

| | Rolle | Team | Fähigkeit |
|---|---|---|---|
| 🐺 | **Werwolf** | Wölfe | Reißt jede Nacht gemeinsam mit dem Rudel ein Opfer |
| 🧑‍🌾 | **Dorfbewohner** | Dorf | Keine Fähigkeit — nur Stimme und Verstand |
| 🔮 | **Seherin** | Dorf | Erfährt jede Nacht die Rolle einer Person |
| 🧪 | **Hexe** | Dorf | Ein Heiltrank, ein Gifttrank — je einmal im Spiel |
| 🏹 | **Jäger** | Dorf | Stirbt er, reißt sein letzter Schuss jemanden mit |
| 🛡️ | **Beschützer** | Dorf | Schützt nachts eine Person, nie zweimal dieselbe hintereinander |
| 💘 | **Amor** | Dorf | Verkuppelt in Nacht 1 zwei Menschen auf Leben und Tod |
| 🃏 | **Dorfnarr** | allein | Gewinnt sofort, wenn das Dorf ihn lyncht |

### Balance

Die Verteilung folgt der Faustregel **ein Wolf auf vier Spieler**, Sonderrollen kommen
gestaffelt dazu, damit kleine Runden nicht von Fähigkeiten erschlagen werden.

| Spieler | Wölfe | Anteil | Sonderrollen ab |
|---|---|---|---|
| 4–5 | 1 | 20–25 % | Seherin |
| 6 | 2 | 33 % | + Hexe |
| 7–8 | 2 | 25–29 % | + Jäger |
| 9 | 2 | 22 % | + Beschützer |
| 10–11 | 2 | 18–20 % | + Amor |
| 12–15 | 3 | 20–25 % | + Dorfnarr (optional) |
| 16+ | 4–5 | ~20 % | |

Ab 8 Spielern ist immer mindestens ein einfacher Dorfbewohner dabei — sonst wird das Spiel
zum Fähigkeiten-Wettrennen. Die Regel wird von `pruefeBalance()` für jede Spielerzahl
zwischen 4 und 30 geprüft.

---

## Zufallsereignisse

Schaltbar. Ab der zweiten Nacht zieht das Spiel jede Phase ein Ereignis — meistens
passiert nichts Besonderes, manchmal wird es interessant.

| Ereignis | Wirkung |
|---|---|
| **Ein langer Schlaf** | Eine Person verschläft den Tag und darf nicht mitreden — wählen schon |
| **Vollmond** | Das Rudel reißt in dieser Nacht **zwei** Opfer |
| **Dichter Nebel** | Die Seherin sieht nichts |
| **Sturmnacht** | Die Abstimmung läuft geheim |
| **Erntedankfest** | Heute wird niemand hingerichtet |
| **Die Krähen** | Eine Person startet mit einer Stimme gegen sich |
| **Der Rat des Ältesten** | Eine Person hat eine doppelte Stimme |
| **Ein Wanderer** | Verrät, wie viele Werwölfe noch leben |
| **Ruhige Nacht / gewöhnlicher Tag** | Nichts passiert (am häufigsten) |

---

## Ablauf einer Runde

1. **Namen eintragen**, Einstellungen wählen, Spiel starten
2. **Rollenvergabe** — Gerät wandert reihum, jeder tippt „Rolle ansehen", merkt sie sich, gibt weiter
3. **Nacht** — der Erzähler ruft die Rollen der Reihe nach auf, der Spielleiter tippt die Aktionen
4. **Tag** — Tote werden verkündet, ein Ereignis kann eintreten, das Dorf diskutiert
5. **Abstimmung** — jede lebende Person wählt, das Spiel zählt aus
6. Zurück zu 3, bis eine Seite gewinnt

**Siegbedingungen:** Das Dorf gewinnt, wenn der letzte Wolf tot ist. Die Wölfe gewinnen,
sobald sie mindestens so viele sind wie alle anderen zusammen. Der Dorfnarr gewinnt allein,
wenn er gelyncht wird. Ein Liebespaar über die Fronten hinweg gewinnt zu zweit, wenn nur
noch die beiden übrig sind.

---

## Selbst betreiben

Es ist eine statische Seite — drei Dateien, keine Abhängigkeiten, kein Bauschritt.

```bash
git clone https://github.com/lionboomer/werwolf.git
cd werwolf
python3 -m http.server 8000     # oder irgendein Webserver
```

Dann `http://localhost:8000` öffnen. Genauso funktioniert jeder Hoster, der Dateien
ausliefert — GitHub Pages, Caddy, nginx, ein USB-Stick.

### Tests

```bash
node tests.js
```

Prüft Balance über alle Spielerzahlen, alle Siegbedingungen, jede Sonderrolle, die
Wirkung jedes Ereignisses und spielt **300 vollständige Partien** mit Zufallszügen durch,
um Endlosschleifen und einseitige Balance auszuschließen.

---

## Aufbau

| Datei | Inhalt |
|---|---|
| `spiel.js` | Regeln, Rollen, Balance, Ereignisse, Zustandsmaschine — **kein DOM** |
| `oberflaeche.js` | Zeichnet Ansichten, entscheidet nichts |
| `index.html` | Gerüst und Gestaltung |
| `tests.js` | Läuft mit Node, ohne Browser |

Die Trennung ist Absicht: `spiel.js` lässt sich ohne Browser testen, und eine neue Rolle
oder ein neues Ereignis braucht nur einen Eintrag in der jeweiligen Tabelle.

### Eine Rolle ergänzen

```js
// in spiel.js, Objekt ROLLEN
meineRolle: {
  name: "Wächter", team: TEAM.DORF, symbol: "🔔",
  kurz: "Kurzbeschreibung für die Vorschau",
  text: "Was der Spieler auf seiner Rollenkarte liest",
  nachtaktion: "wachen",   // oder null
  reihenfolge: 15,         // wann in der Nacht (kleiner = früher)
},
```

Dann in `verteilung()` festlegen, ab welcher Spielerzahl sie dabei ist, und in
`fuehreAus()` die Wirkung ergänzen.

### Ein Ereignis ergänzen

```js
// in spiel.js, Feld EREIGNISSE
{
  id: "unwetter", titel: "Unwetter", gewicht: 2, phase: "tag",
  text: (n) => `${n} kommt nicht aus dem Haus.`,
  wirkung: "stumm", brauchtSpieler: true,
}
```

`gewicht` steuert die Häufigkeit. `wirkung` ist die Marke, die die Zustandsmaschine
auswertet — bestehende Marken sind `stumm`, `doppelriss`, `blind`, `geheimwahl`,
`keinewahl`, `vorstimme`, `doppelstimme`, `hinweis_wolfzahl`.

---

## Browser

Läuft in allem, was ES2020 kann. Die **Sprachausgabe** nutzt die Web-Speech-API — in
Chrome, Edge und Safari vorhanden, in Firefox je nach System. Fehlt sie, wird der Schalter
ausgegraut und alles andere funktioniert weiter.

---

## Lizenz

MIT — mach damit, was du willst.
