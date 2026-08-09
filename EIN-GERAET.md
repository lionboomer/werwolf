# Werwölfe von Schattenmoor

Ein browserbasiertes Pass-and-Play Werwolf-Spiel für 5–12 Spieler (empfohlen 7–8), das ein einziges Gerät im Kreis herum führt. Kein Server, kein Build — eine einzige `index.html` mit Vanilla JS, CSS-Animationen und synthetisierten Sounds (Web Audio API, keine externen Assets).

## Spielen

`index.html` im Browser öffnen (lokal per Doppelklick oder über einen beliebigen statischen Webserver/GitHub Pages).

## Ablauf

1. **Setup** — Spieleranzahl wählen, Namen eintragen. Die Rollenverteilung passt sich automatisch an (siehe Tabelle unten).
2. **Kartenverteilung** — Gerät geht im Kreis herum, jede Person deckt kurz die eigene Rolle auf.
3. **Nacht** — Der Erzähler führt durch Amor (nur Nacht 1, ab 9 Spielern), Seherin, Werwölfe, Hexe — in dieser Reihenfolge, wie im klassischen Regelwerk.
4. **Morgen** — Auflösung der Nacht, ggf. letzter Schuss des Jägers.
5. **Tag** — Diskussionstimer, dann Abstimmung mit Stichwahl bei Gleichstand.
6. Wiederholt sich, bis das Dorf, die Werwölfe oder — als Spezialfall — ein Liebespaar gewinnt.

**Hausregel:** Die Werwölfe dürfen jeden Lebenden als Opfer wählen — auch einen Mitwolf oder sich selbst. Reißt sich der letzte Wolf selbst, gewinnt das Dorf.

## Zufallsereignisse am Tag

Jeden Morgen kann ein Ereignis über Schattenmoor kommen (etwa in 3 von 5 Tagen). Der Erzähler verkündet es, dann gilt es für diesen Tag:

| Ereignis | Wirkung |
|---|---|
| Tiefer Schlaf | Eine zufällige Person verschläft: darf heute nicht sprechen und nicht abstimmen — gewählt werden kann sie trotzdem. |
| Heiserkeit | Eine zufällige Person darf nicht sprechen, aber abstimmen. |
| Das Wort des Ältesten | Die Stimme einer zufälligen Person zählt heute doppelt. |
| Dichter Nebel | Es wird gar nicht abgestimmt — niemand wird verbannt. |
| Der Sturm heult | Nur halbe Redezeit (1:30 statt 3:00). |
| Große Ratsversammlung | Doppelte Redezeit (5:00). |
| Geheime Wahl | Die Zwischenstände der Abstimmung bleiben verborgen. |
| Das Los entscheidet | Bei Gleichstand keine Stichwahl — das Los entscheidet. |
| Der fremde Wanderer | Ein Hinweis, der immer stimmt: unter zwei genannten Personen ist mindestens ein Werwolf. |

Die Anzeige der erwarteten Stimmenzahl passt sich automatisch an (bei „Tiefer Schlaf" eine weniger, beim „Wort des Ältesten" eine mehr), damit beim Zählen nichts durcheinandergeht.

## Rollenverteilung nach Spielerzahl

| Spieler | Werwölfe | Seherin | Hexe | Jäger | Amor | Dorfbewohner |
|---|---|---|---|---|---|---|
| 5  | 1 | 1 | – | – | – | 3 |
| 6  | 1 | 1 | – | – | – | 4 |
| 7  | 2 | 1 | 1 | – | – | 3 |
| 8  | 2 | 1 | 1 | 1 | – | 3 |
| 9  | 2 | 1 | 1 | 1 | 1 | 3 |
| 10 | 3 | 1 | 1 | 1 | 1 | 3 |
| 11 | 3 | 1 | 1 | 1 | 1 | 4 |
| 12 | 3 | 1 | 1 | 1 | 1 | 5 |

## Hosting

Statische Datei — lässt sich 1:1 über GitHub Pages, Netlify, Vercel oder jeden Webspace ausliefern (kein Build-Schritt, keine Abhängigkeiten).
