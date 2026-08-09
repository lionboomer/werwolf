# Werwölfe von Schattenmoor — Multiplayer

Echter Multiplayer-Modus: jede Person joint mit dem eigenen Handy in eine Lobby, bekommt ihre Rolle privat auf dem eigenen Gerät angezeigt, und ein separates Erzähler-Gerät (Laptop/Tablet — spielt nicht mit) sieht alle Rollen mit Namen und steuert Nacht/Tag.

Kleiner Node.js-Server (nur Abhängigkeit: `ws`) + zwei statische Web-Ansichten. Kein Datenbank, kein Build-Schritt. Raum-Zustand liegt im Arbeitsspeicher — für eine einzelne Spielrunde völlig ausreichend, überlebt aber keinen Server-Neustart.

## Lokal starten

```bash
cd werwolf-multiplayer
npm install
npm start                 # Standardport 8791
# oder: PORT=3000 npm start
```

- Spieler-Ansicht: `http://<server>:8791/`
- Erzähler-Ansicht: `http://<server>:8791/narrator`

Solange alle Handys im selben WLAN sind, reicht die lokale IP des Rechners, der den Server startet (z. B. `http://192.168.0.50:8791/`).

## Ablauf

1. Erzähler öffnet `/narrator`, klickt „Neue Lobby erstellen“ → bekommt einen 4-stelligen Code.
2. Jede Person öffnet `/` auf dem eigenen Handy, trägt Namen + Code ein, tippt „Beitreten“.
3. Sobald 5–12 Spieler in der Lobby sind, startet der Erzähler die Runde — Rollen werden zufällig verteilt (Verteilung wie im Pass-and-Play-Modus, siehe `../werwolf-game/README.md`).
4. Jede Person deckt privat die eigene Karte auf. Der Erzähler sieht live, wer schon bestätigt hat.
5. Nacht- und Tagphasen laufen automatisch auf den jeweils zuständigen Geräten (Werwölfe, Seherin, Hexe, Jäger, Amor); alle anderen sehen einen Warte-Bildschirm. Der Erzähler führt Timer, Abstimmung und Fortschritt.
6. Am Ende gibt es eine neue Runde in derselben Lobby, ohne dass sich jemand neu verbinden muss.

**Verbindungsabbrüche:** Jedes Gerät merkt sich seine Sitzung (Name/Rolle) lokal und verbindet sich nach Reload oder kurzer Netzwerkunterbrechung automatisch wieder mit der laufenden Runde.

## Auf dem Homelab hosten

### Als systemd-Service (z. B. auf CT106)

```ini
# /etc/systemd/system/werwolf.service
[Unit]
Description=Werwoelfe von Schattenmoor - Multiplayer-Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/werwolf-multiplayer
ExecStart=/usr/bin/node server/server.js
Environment=PORT=8791
Restart=on-failure
User=werwolf

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now werwolf
```

### Reverse Proxy über Caddy (WebSocket muss durchgereicht werden)

```
werwolf.deine-domain.tld {
  reverse_proxy localhost:8791
}
```

Caddy leitet Upgrade-Header für WebSocket-Verbindungen automatisch weiter — kein zusätzliches Config nötig. Mit TLS über die öffentliche Domain funktioniert das Spiel dann auch, wenn Gäste über Mobilfunk statt WLAN joinen.

## Kostenlos online hosten, ohne eigenen Server erreichbar zu machen

Falls das Homelab gerade nicht erreichbar ist: `render.yaml` in diesem Ordner ist ein fertiges [Render](https://render.com) Blueprint für den kostenlosen Web-Service-Tier (unterstützt WebSockets nativ).

1. Bei Render.com anmelden (kein Server-Zugriff nötig, läuft komplett bei Render).
2. „New +“ → „Blueprint“ → dieses GitHub-Repo verbinden, Branch wählen.
3. Render erkennt `werwolf-multiplayer/render.yaml` automatisch und deployt Spieler- und Erzähler-Seite unter einer `onrender.com`-URL.

Kostenloser Tier schläft nach ~15 Minuten Inaktivität ein und braucht beim nächsten Aufruf ca. 30–50 Sekunden zum Aufwachen — für eine verabredete Spielrunde unproblematisch. Alternativen mit ähnlich kostenlosem Node+WebSocket-Hosting: Fly.io, Glitch.

## Warum kein Hosting über Artifacts?

Die gehostete Artifact-Version (siehe Hauptprojekt) kann keinen Zustand zwischen mehreren Geräten teilen — nur einzelne Dateien anbieten und eigene Connector-Tools aufrufen. Für „alle joinen mit eigenem Handy“ ist deshalb ein echter kleiner Server nötig, wie er hier liegt.

## Dateien

```
werwolf-multiplayer/
├── package.json
├── server/
│   ├── server.js     — HTTP + WebSocket-Server, komplette Spiellogik
│   └── roleData.js   — Rollen & Verteilungstabelle (serverseitig)
└── public/
    ├── player.html   — Spieler-Ansicht (eigenes Handy)
    ├── narrator.html — Erzähler-Konsole (eigenes Gerät, sieht alles)
    ├── roles.js       — Rollen-Metadaten + Icons (clientseitig, von beiden Ansichten genutzt)
    └── style.css      — geteiltes Design
```

## Bots für kleine Runden

Sind zu wenige am Tisch, füllt der Erzähler die Lobby mit Bots auf — Knöpfe **+ Bot** /
**− Bot** im Lobby-Bildschirm.

Ein Bot zieht **zufällig, aber immer regelkonform**: Er bestätigt seine Rolle sofort,
wählt nachts ein gültiges Ziel, stimmt tagsüber für jemanden ab und hält als Hexe seine
Tränke zurück. Er bluffft nicht und deduziert nicht — er ersetzt nur die fehlende Hand
am Tisch. Das ist Absicht: Ein kluger Bot würde die Runde dominieren, ein wirrer sie
verderben.

Bots handeln über **dieselben Zustandsfelder** wie echte Spieler. Es gibt keinen zweiten
Regelweg, der auseinanderlaufen könnte.

**Geprüft** mit je 6 vollständigen Partien: 3 Spieler → 3× Dorf / 3× Wölfe,
6 Spieler → 2× Dorf / 4× Wölfe (bei reinen Zufallszügen erwartbar — echte Spieler
deduzieren, Bots nicht). Keine Partie blieb hängen.

## Kleine Runde (3–4 Spieler)

Gleiche Ausnahmen wie in der Ein-Gerät-Fassung: **kein Riss in Nacht 1**, und die Wölfe
gewinnen erst bei **vollständiger Auslöschung** statt schon bei Gleichstand. Ohne beides
wäre eine Dreierpartie nach der ersten Nacht entschieden.

## Betrieb bei Lion

Läuft als systemd-Dienst in **CT122** (neben Caddy), Port 8791, Benutzer `werwolf`,
gehärtet über `ProtectSystem=strict`.

Öffentlich erreichbar unter **https://werwolf.lionwitte.de/** (Spieler) und
**/narrator** (Erzähler) — Caddy reicht die WebSocket-Verbindung mit einer Stunde
Zeitlimit durch, damit eine stille Lobby nicht getrennt wird. Der Name liegt als lokaler
DNS-Eintrag in Pi-hole auf `192.168.178.14`.
