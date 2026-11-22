import type { WikiEntryInput } from '@zauberbuch/shared';

/**
 * Regeln nach dem System Reference Document 5.1 (CC-BY-4.0, Wizards of the Coast), eigene deutsche Zusammenfassung:
 * Zustände (verknüpft mit den Zuständen im Kampf), Grundregeln, Kampf, Abenteuer, Rasten und Zauberwirken.
 */
const rule = (name: string, category: string, summary: string, description: string, condition: string | null = null): WikiEntryInput => ({
  kind: 'rule',
  name,
  summary,
  description,
  data: { category, condition },
});

export const RULE_SEED: WikiEntryInput[] = [
  // ---------------------------------------------------------------- Zustände
  rule(
    'Blind',
    'condition',
    'Die Kreatur kann nichts sehen.',
    `- Eine blinde Kreatur kann nicht sehen und scheitert automatisch an jedem Attributswurf, für den Sicht nötig ist.
- Angriffswürfe gegen die Kreatur sind im Vorteil, ihre eigenen Angriffswürfe im Nachteil.`,
    'blinded',
  ),
  rule(
    'Bezaubert',
    'condition',
    'Die Kreatur ist dem Bezauberer freundlich gesinnt.',
    `- Eine bezauberte Kreatur kann den Bezauberer nicht angreifen und ihn nicht zum Ziel schädlicher Fähigkeiten oder magischer Effekte machen.
- Der Bezauberer ist bei Attributswürfen für soziale Interaktion mit der Kreatur im Vorteil.`,
    'charmed',
  ),
  rule(
    'Taub',
    'condition',
    'Die Kreatur kann nichts hören.',
    `- Eine taube Kreatur kann nicht hören und scheitert automatisch an jedem Attributswurf, für den Gehör nötig ist.`,
    'deafened',
  ),
  rule(
    'Erschöpfung',
    'condition',
    'Sechs Stufen zunehmender Erschöpfung.',
    `Manche Fähigkeiten und Gefahren (Hunger, Kälte, Gewaltmärsche …) verursachen Erschöpfung. Sie wird in sechs Stufen gemessen; ein Effekt kann eine oder mehrere Stufen verursachen.

| Stufe | Wirkung |
| --- | --- |
| 1 | Nachteil bei Attributswürfen |
| 2 | Bewegungsrate halbiert |
| 3 | Nachteil bei Angriffs- und Rettungswürfen |
| 4 | Trefferpunktmaximum halbiert |
| 5 | Bewegungsrate auf 0 reduziert |
| 6 | Tod |

- Eine erschöpfte Kreatur erleidet die Wirkung ihrer aktuellen Stufe **und aller niedrigeren Stufen**.
- Eine weitere Erschöpfung erhöht die Stufe um den angegebenen Wert.
- Ein Effekt, der Erschöpfung verringert, senkt die Stufe entsprechend; unter Stufe 1 endet der Zustand.
- Eine **lange Rast** mit etwas Nahrung und Wasser senkt die Erschöpfung um 1 Stufe.`,
    'exhaustion',
  ),
  rule(
    'Verängstigt',
    'condition',
    'Die Kreatur fürchtet die Quelle ihrer Angst.',
    `- Eine verängstigte Kreatur ist bei Attributs- und Angriffswürfen im Nachteil, solange sich die Quelle ihrer Angst in ihrer Sichtlinie befindet.
- Sie kann sich nicht freiwillig näher an die Quelle ihrer Angst heranbewegen.`,
    'frightened',
  ),
  rule(
    'Gepackt',
    'condition',
    'Die Kreatur wird festgehalten und kann sich nicht fortbewegen.',
    `- Die Bewegungsrate einer gepackten Kreatur ist 0 und sie profitiert von keinen Boni auf ihre Bewegungsrate.
- Der Zustand endet, wenn der Packende kampfunfähig wird.
- Er endet auch, wenn ein Effekt die gepackte Kreatur aus der Reichweite des Packenden entfernt (z. B. wenn sie weggeschleudert wird).
- Siehe auch **Ringen**.`,
    'grappled',
  ),
  rule(
    'Kampfunfähig',
    'condition',
    'Die Kreatur kann weder Aktionen noch Reaktionen ausführen.',
    `- Eine kampfunfähige Kreatur kann keine Aktionen und keine Reaktionen ausführen.`,
    'incapacitated',
  ),
  rule(
    'Unsichtbar',
    'condition',
    'Die Kreatur kann ohne Magie oder besondere Sinne nicht gesehen werden.',
    `- Eine unsichtbare Kreatur kann ohne Hilfe von Magie oder besonderen Sinnen nicht gesehen werden. Zum Verstecken gilt sie als komplett verborgen.
- Ihr Aufenthaltsort lässt sich anhand von Geräuschen oder Spuren ermitteln.
- Angriffswürfe gegen die Kreatur sind im Nachteil, ihre eigenen Angriffswürfe im Vorteil.`,
    'invisible',
  ),
  rule(
    'Gelähmt',
    'condition',
    'Die Kreatur kann sich weder bewegen noch sprechen.',
    `- Eine gelähmte Kreatur ist kampfunfähig und kann sich weder bewegen noch sprechen.
- Sie scheitert automatisch an Stärke- und Geschicklichkeitsrettungswürfen.
- Angriffswürfe gegen sie sind im Vorteil.
- Jeder Treffer durch einen Angreifer im Umkreis von 1,5 m ist ein **kritischer Treffer**.`,
    'paralyzed',
  ),
  rule(
    'Versteinert',
    'condition',
    'Die Kreatur wird samt ihrer Ausrüstung in eine feste, leblose Substanz verwandelt.',
    `- Eine versteinerte Kreatur wird zusammen mit allen nichtmagischen Gegenständen, die sie trägt oder hält, in eine feste, leblose Substanz verwandelt (meist Stein). Ihr Gewicht verzehnfacht sich, und sie altert nicht mehr.
- Sie ist kampfunfähig, kann sich weder bewegen noch sprechen und nimmt ihre Umgebung nicht wahr.
- Angriffswürfe gegen sie sind im Vorteil.
- Sie scheitert automatisch an Stärke- und Geschicklichkeitsrettungswürfen.
- Sie ist resistent gegen alle Schadensarten.
- Sie ist immun gegen Gift und Krankheit; ein bereits wirkendes Gift oder eine Krankheit wird ausgesetzt, aber nicht beendet.`,
    'petrified',
  ),
  rule(
    'Vergiftet',
    'condition',
    'Die Kreatur ist bei Angriffs- und Attributswürfen im Nachteil.',
    `- Eine vergiftete Kreatur ist bei Angriffswürfen und Attributswürfen im Nachteil.`,
    'poisoned',
  ),
  rule(
    'Liegend',
    'condition',
    'Die Kreatur liegt am Boden.',
    `- Eine liegende Kreatur kann sich nur kriechend fortbewegen, bis sie aufsteht und den Zustand damit beendet. Aufstehen kostet die Hälfte ihrer Bewegungsrate.
- Ihre Angriffswürfe sind im Nachteil.
- Angriffswürfe gegen sie sind im Vorteil, wenn der Angreifer höchstens 1,5 m entfernt ist, andernfalls im Nachteil.`,
    'prone',
  ),
  rule(
    'Festgesetzt',
    'condition',
    'Die Kreatur ist gefesselt oder festgehalten und kann sich nicht bewegen.',
    `- Die Bewegungsrate einer festgesetzten Kreatur ist 0 und sie profitiert von keinen Boni auf ihre Bewegungsrate.
- Angriffswürfe gegen sie sind im Vorteil, ihre eigenen Angriffswürfe im Nachteil.
- Sie ist bei Geschicklichkeitsrettungswürfen im Nachteil.`,
    'restrained',
  ),
  rule(
    'Betäubt',
    'condition',
    'Die Kreatur ist benommen und kaum handlungsfähig.',
    `- Eine betäubte Kreatur ist kampfunfähig, kann sich nicht bewegen und nur stockend sprechen.
- Sie scheitert automatisch an Stärke- und Geschicklichkeitsrettungswürfen.
- Angriffswürfe gegen sie sind im Vorteil.`,
    'stunned',
  ),
  rule(
    'Bewusstlos',
    'condition',
    'Die Kreatur ist ohnmächtig und nimmt ihre Umgebung nicht wahr.',
    `- Eine bewusstlose Kreatur ist kampfunfähig, kann sich weder bewegen noch sprechen und nimmt ihre Umgebung nicht wahr.
- Sie lässt fallen, was sie hält, und ist **liegend**.
- Sie scheitert automatisch an Stärke- und Geschicklichkeitsrettungswürfen.
- Angriffswürfe gegen sie sind im Vorteil.
- Jeder Treffer durch einen Angreifer im Umkreis von 1,5 m ist ein **kritischer Treffer**.`,
    'unconscious',
  ),

  // ---------------------------------------------------------------- Grundregeln
  rule(
    'Vorteil und Nachteil',
    'basics',
    'Zwei W20 würfeln und das bessere bzw. schlechtere Ergebnis nehmen.',
    `- **Vorteil:** Zwei W20 würfeln und das **höhere** Ergebnis verwenden.
- **Nachteil:** Zwei W20 würfeln und das **niedrigere** Ergebnis verwenden.
- Mehrere Quellen von Vorteil (oder Nachteil) addieren sich nicht – es bleibt bei zwei W20.
- Haben die Umstände sowohl Vorteil als auch Nachteil zur Folge, heben sie sich auf, unabhängig von der Anzahl der Quellen; es wird ein W20 gewürfelt.
- Erlaubt eine Fähigkeit (z. B. *Glückspilz* der Halblinge), den W20 neu zu würfeln, darf nur einer der beiden Würfel neu gewürfelt werden.`,
  ),
  rule(
    'Attributswürfe',
    'basics',
    'W20 + Attributsmodifikator (+ Übungsbonus) gegen einen Schwierigkeitsgrad.',
    `Für einen Attributswurf (Probe) würfelt man einen W20 und addiert den passenden Attributsmodifikator; ist die Kreatur in der verwendeten Fertigkeit oder dem Werkzeug geübt, kommt der Übungsbonus hinzu. Erreicht oder übertrifft das Ergebnis den **Schwierigkeitsgrad (SG)**, gelingt der Wurf.

| Aufgabe | SG |
| --- | --- |
| Sehr leicht | 5 |
| Leicht | 10 |
| Mittel | 15 |
| Schwer | 20 |
| Sehr schwer | 25 |
| Nahezu unmöglich | 30 |

- **Vergleichender Wurf:** Beide Seiten würfeln; das höhere Ergebnis gewinnt, bei Gleichstand bleibt die Lage unverändert.
- **Passiver Wurf:** 10 + alle Modifikatoren, die normalerweise gelten (+5 bei Vorteil, −5 bei Nachteil), z. B. passive Weisheit (Wahrnehmung).
- **Gruppenwurf:** Gelingt mindestens der Hälfte der Gruppe der Wurf, hat die ganze Gruppe Erfolg.`,
  ),
  rule(
    'Rettungswürfe',
    'basics',
    'Widerstand gegen Zauber, Fallen, Gifte und andere Gefahren.',
    `- Rettungswurf: W20 + Attributsmodifikator, plus Übungsbonus, wenn die Kreatur in diesem Rettungswurf geübt ist.
- Der SG ergibt sich aus dem Effekt, z. B. dem Zauberrettungswurf-SG des Zauberwirkers: **8 + Übungsbonus + Modifikator des Zauberattributs**.
- Was bei Erfolg oder Misserfolg geschieht, steht im jeweiligen Effekt.`,
  ),

  // ---------------------------------------------------------------- Kampf
  rule(
    'Ablauf des Kampfes',
    'combat',
    'Überraschung, Initiative und Züge in Runden zu je etwa 6 Sekunden.',
    `1. **Überraschung bestimmen:** Der Spielleiter legt fest, ob jemand überrascht ist (siehe **Überraschung**).
2. **Positionen festlegen.**
3. **Initiative würfeln:** Jeder Teilnehmer würfelt einen Geschicklichkeitswurf; die Reihenfolge gilt für den ganzen Kampf. Gleiche Monster würfeln meist gemeinsam.
4. **Züge ausführen:** In Initiativereihenfolge ist jeder Teilnehmer am Zug.
5. **Nächste Runde:** Sind alle am Zug gewesen, beginnt die nächste Runde – bis der Kampf endet.

**Dein Zug:** Du kannst dich bis zu deiner Bewegungsrate bewegen und **eine Aktion** ausführen. Die Bewegung lässt sich vor, nach und zwischen Angriffen aufteilen. Dazu können eine **Bonusaktion** (nur wenn eine Fähigkeit sie gewährt) und eine kostenlose Interaktion mit einem Gegenstand kommen (z. B. eine Tür öffnen, eine Waffe ziehen).

**Reaktion:** Einmal pro Runde, auch außerhalb des eigenen Zuges, als Antwort auf einen Auslöser (z. B. **Gelegenheitsangriff**). Sie steht ab dem Beginn des eigenen Zuges wieder zur Verfügung.`,
  ),
  rule(
    'Überraschung',
    'combat',
    'Wer überrascht ist, verliert seinen ersten Zug.',
    `- Der Spielleiter vergleicht die Geschicklichkeitswürfe (Heimlichkeit) der Verborgenen mit der passiven Weisheit (Wahrnehmung) der Gegner.
- Wer keine Bedrohung bemerkt, ist zu Beginn des Kampfes **überrascht**.
- Eine überraschte Kreatur kann sich in ihrem ersten Zug weder bewegen noch Aktionen ausführen und bis zum Ende dieses Zuges keine Reaktion nutzen.
- Es können auch nur einzelne Mitglieder einer Gruppe überrascht sein.`,
  ),
  rule(
    'Aktionen im Kampf',
    'combat',
    'Angriff, Zaubern, Spurt, Rückzug, Ausweichen, Helfen, Verstecken, Vorbereiten, Suchen, Gegenstand benutzen.',
    `- **Angriff:** Einen Nah- oder Fernkampfangriff ausführen (manche Klassen erhalten später mehrere Angriffe).
- **Zaubern:** Einen Zauber mit dem Zeitaufwand von 1 Aktion wirken.
- **Spurt:** Zusätzliche Bewegung in Höhe der eigenen Bewegungsrate für diesen Zug.
- **Rückzug:** Die eigene Bewegung provoziert in diesem Zug keine Gelegenheitsangriffe.
- **Ausweichen:** Bis zum Beginn des nächsten Zuges sind Angriffswürfe gegen dich im Nachteil (wenn du den Angreifer sehen kannst), und Geschicklichkeitsrettungswürfe sind im Vorteil. Endet, wenn du kampfunfähig wirst oder deine Bewegungsrate 0 ist.
- **Helfen:** Ein Verbündeter erhält Vorteil beim nächsten Attributswurf für die Aufgabe, bei der du hilfst, oder beim nächsten Angriff gegen eine Kreatur im Umkreis von 1,5 m um dich.
- **Verstecken:** Geschicklichkeitswurf (Heimlichkeit), um dich zu verstecken.
- **Vorbereiten:** Einen Auslöser und eine Reaktion festlegen, die beim Auslöser ausgeführt wird (ein vorbereiteter Zauber erfordert Konzentration).
- **Suchen:** Aufmerksam nach etwas suchen (Weisheit (Wahrnehmung) oder Intelligenz (Nachforschungen)).
- **Gegenstand benutzen:** Einen Gegenstand verwenden, der dafür eine Aktion erfordert (z. B. einen Heiltrank einem anderen verabreichen).`,
  ),
  rule(
    'Gelegenheitsangriff',
    'combat',
    'Ein Nahkampfangriff als Reaktion, wenn ein Gegner die eigene Reichweite verlässt.',
    `- Verlässt eine feindliche Kreatur, die du sehen kannst, deine Reichweite, kannst du mit deiner **Reaktion** einen Nahkampfangriff gegen sie ausführen – unmittelbar bevor sie die Reichweite verlässt.
- Kein Gelegenheitsangriff entsteht, wenn sich die Kreatur per **Rückzug**, durch Teleportation oder unfreiwillig bewegt (z. B. durch eine Explosion oder Schwerkraft).`,
  ),
  rule(
    'Deckung',
    'combat',
    'Hindernisse schützen vor Angriffen und manchen Rettungswürfen.',
    `| Deckung | Wirkung | Beispiel |
| --- | --- | --- |
| Halbe Deckung | +2 auf RK und Geschicklichkeitsrettungswürfe | niedrige Mauer, Möbel, eine andere Kreatur |
| Dreiviertel-Deckung | +5 auf RK und Geschicklichkeitsrettungswürfe | Schießscharte, dicker Baumstamm |
| Vollständige Deckung | kann nicht direkt angegriffen oder als Ziel eines Zaubers gewählt werden | vollständig verdeckt |

- Mehrere Deckungen addieren sich nicht; es zählt die beste.`,
  ),
  rule(
    'Kampf mit zwei Waffen',
    'combat',
    'Mit einer zweiten leichten Waffe als Bonusaktion angreifen.',
    `- Führst du mit einer leichten Nahkampfwaffe in einer Hand die Angriffsaktion aus, kannst du mit einer Bonusaktion mit einer anderen leichten Nahkampfwaffe in der anderen Hand angreifen.
- Den Attributsmodifikator addierst du nicht zum Schaden des Bonusangriffs, außer er ist negativ.
- Hat eine der Waffen die Eigenschaft *Wurfwaffe*, kannst du sie werfen, statt mit ihr im Nahkampf anzugreifen.`,
  ),
  rule(
    'Ringen',
    'combat',
    'Eine Kreatur mit einem Angriff packen und festhalten.',
    `- Statt eines Angriffs (im Rahmen der Angriffsaktion) kannst du eine Kreatur packen, die höchstens eine Größenkategorie größer ist als du und sich in Reichweite befindet. Du brauchst eine freie Hand.
- Wurf: Stärke (Athletik) gegen Stärke (Athletik) oder Geschicklichkeit (Akrobatik) des Ziels (nach dessen Wahl). Bei Erfolg ist das Ziel **gepackt**.
- **Befreien:** Das Ziel kann seine Aktion nutzen, um sich mit einem vergleichenden Wurf zu befreien.
- **Gepackte Kreatur bewegen:** Du kannst sie mitziehen oder -tragen; deine Bewegungsrate halbiert sich, außer die Kreatur ist zwei oder mehr Größenkategorien kleiner als du.`,
  ),
  rule(
    'Kreatur stoßen',
    'combat',
    'Einen Gegner umstoßen oder zurückdrängen.',
    `- Statt eines Angriffs kannst du eine Kreatur stoßen, die höchstens eine Größenkategorie größer ist als du und sich in Reichweite befindet.
- Wurf: Stärke (Athletik) gegen Stärke (Athletik) oder Geschicklichkeit (Akrobatik) des Ziels.
- Bei Erfolg wird das Ziel **liegend** oder 1,5 m von dir weggestoßen (deine Wahl).`,
  ),
  rule(
    'Kritische Treffer',
    'combat',
    'Eine natürliche 20 trifft immer und verdoppelt die Schadenswürfel.',
    `- Bei einer natürlichen 20 trifft der Angriff unabhängig von Modifikatoren und RK – ein **kritischer Treffer**.
- Alle Schadenswürfel des Angriffs werden zweimal gewürfelt und addiert, danach kommen die Modifikatoren einmal hinzu (auch zusätzliche Würfel z. B. durch *Hinterhältiger Angriff*).
- Eine natürliche 1 verfehlt immer.`,
  ),
  rule(
    'Auf 0 Trefferpunkte fallen',
    'combat',
    'Bewusstlosigkeit, Todesrettungswürfe und sofortiger Tod.',
    `- **Sofortiger Tod:** Bleibt nach dem Fall auf 0 TP noch Schaden übrig, der mindestens so hoch ist wie das Trefferpunktmaximum, stirbt die Kreatur sofort.
- Ansonsten wird sie **bewusstlos**; der Zustand endet, sobald sie wieder Trefferpunkte erhält.
- **Todesrettungswürfe:** Zu Beginn jedes eigenen Zuges einen W20 würfeln (ohne Modifikatoren). Ab 10 ist es ein Erfolg, darunter ein Fehlschlag. Drei Erfolge: Die Kreatur ist **stabil**. Drei Fehlschläge: Sie stirbt. Eine **1** zählt als zwei Fehlschläge, eine **20** bringt sofort 1 TP zurück.
- **Schaden bei 0 TP:** Jeder Schaden verursacht einen Fehlschlag, ein kritischer Treffer zwei; erreicht der Schaden das Trefferpunktmaximum, stirbt die Kreatur.
- **Stabilisieren:** Mit einer Aktion und einem Weisheitswurf (Heilkunde) gegen SG 10. Eine stabile Kreatur erhält nach 1W4 Stunden 1 TP zurück.`,
  ),

  // ---------------------------------------------------------------- Abenteuer
  rule(
    'Sicht und Licht',
    'adventuring',
    'Leicht und komplett verborgene Bereiche, Dunkelsicht und Blindsicht.',
    `- **Leicht verborgen** (dämmriges Licht, leichter Nebel, dichtes Laub): Nachteil bei Weisheitswürfen (Wahrnehmung), die auf Sicht beruhen.
- **Komplett verborgen** (Dunkelheit, dichter Nebel, undurchdringliches Laub): Die Sicht ist vollständig blockiert; wer hineinsieht, ist praktisch **blind**.
- **Helles Licht:** normale Sicht. **Dämmriges Licht:** leicht verborgen. **Dunkelheit:** komplett verborgen.
- **Dunkelsicht:** In der angegebenen Reichweite gilt Dunkelheit als dämmriges und dämmriges Licht als helles Licht; Farben sind in der Dunkelheit nur als Grautöne erkennbar.
- **Blindsicht:** Wahrnehmung der Umgebung in der angegebenen Reichweite ohne Sicht.
- **Wahrsicht:** Sieht in normaler und magischer Dunkelheit, Unsichtbares, Illusionen und die wahre Gestalt von Gestaltwandlern.`,
  ),
  rule(
    'Reisetempo',
    'adventuring',
    'Schnelles, normales und langsames Reisen über Land.',
    `| Tempo | pro Minute | pro Stunde | pro Tag | Wirkung |
| --- | --- | --- | --- | --- |
| Schnell | 120 m | 6 km | 45 km | −5 auf passive Weisheit (Wahrnehmung) |
| Normal | 90 m | 4,5 km | 36 km | – |
| Langsam | 60 m | 3 km | 27 km | Heimlichkeit möglich |

- **Gewaltmarsch:** Wer mehr als 8 Stunden am Tag reist, muss am Ende jeder weiteren Stunde einen Konstitutionsrettungswurf (SG 10 + 1 je weitere Stunde) ablegen; bei Misserfolg erleidet er eine Stufe **Erschöpfung**.
- **Schwieriges Gelände:** Jeder Meter kostet einen zusätzlichen Meter Bewegung.`,
  ),
  rule(
    'Fallschaden',
    'adventuring',
    '1W6 Wuchtschaden je 3 m Fallhöhe, höchstens 20W6.',
    `- Am Ende eines Sturzes erleidet eine Kreatur 1W6 Wuchtschaden je 3 m Fallhöhe, höchstens 20W6.
- Sie landet **liegend**, außer sie vermeidet den Schaden ganz.`,
  ),
  rule(
    'Ersticken',
    'adventuring',
    'Wie lange eine Kreatur die Luft anhalten kann.',
    `- Eine Kreatur kann 1 + ihren Konstitutionsmodifikator Minuten lang die Luft anhalten (mindestens 30 Sekunden).
- Danach überlebt sie noch so viele Runden, wie ihr Konstitutionsmodifikator beträgt (mindestens 1). Zu Beginn des nächsten Zuges fällt sie auf 0 Trefferpunkte und liegt im Sterben.`,
  ),
  rule(
    'Springen',
    'adventuring',
    'Weit- und Hochsprung abhängig von der Stärke.',
    `- **Weitsprung:** Mit mindestens 3 m Anlauf so viele Fuß weit wie der Stärkewert (jeweils 30 cm); aus dem Stand die Hälfte. Jeder Meter kostet Bewegung.
- **Hochsprung:** Mit mindestens 3 m Anlauf 3 Fuß + Stärkemodifikator hoch (jeweils 30 cm); aus dem Stand die Hälfte.`,
  ),

  // ---------------------------------------------------------------- Rasten
  rule(
    'Kurze Rast',
    'resting',
    'Mindestens eine Stunde Pause; Trefferwürfel ausgeben.',
    `- Eine kurze Rast dauert mindestens **1 Stunde**, in der die Charaktere nichts Anstrengenderes tun als essen, trinken, lesen und Wunden versorgen.
- Am Ende kann ein Charakter beliebig viele seiner verfügbaren **Trefferwürfel** ausgeben: Je Würfel W + Konstitutionsmodifikator Trefferpunkte zurückerhalten (Würfel einzeln, nacheinander).
- Manche Fähigkeiten (z. B. Paktmagie des Hexenmeisters) werden nach einer kurzen Rast wieder aufgefüllt.`,
  ),
  rule(
    'Lange Rast',
    'resting',
    'Mindestens acht Stunden Ruhe; alle Trefferpunkte und die Hälfte der Trefferwürfel zurück.',
    `- Eine lange Rast dauert mindestens **8 Stunden**, davon mindestens 6 Stunden Schlaf und höchstens 2 Stunden leichte Tätigkeit (lesen, reden, essen, Wache halten).
- Wird sie durch mindestens 1 Stunde anstrengende Tätigkeit (Gehen, Kämpfen, Zaubern …) unterbrochen, muss sie neu begonnen werden.
- Am Ende erhält der Charakter **alle Trefferpunkte** und verbrauchte Trefferwürfel bis zur **Hälfte** seiner gesamten Trefferwürfel (mindestens 1) zurück; Zauberplätze werden aufgefüllt.
- Pro 24 Stunden ist nur eine lange Rast möglich, und der Charakter braucht zu Beginn mindestens 1 Trefferpunkt.
- Eine lange Rast senkt die **Erschöpfung** um 1 Stufe (mit Nahrung und Wasser).`,
  ),

  // ---------------------------------------------------------------- Zauberwirken
  rule(
    'Konzentration',
    'spellcasting',
    'Manche Zauber halten nur, solange der Wirker sich konzentriert.',
    `- Es kann immer nur **ein** Konzentrationszauber gleichzeitig aufrechterhalten werden; ein neuer beendet den alten.
- Die Konzentration endet jederzeit freiwillig (keine Aktion), wenn der Wirker **kampfunfähig** wird oder stirbt.
- **Schaden:** Bei jedem Schaden ist ein Konstitutionsrettungswurf nötig, SG 10 oder die Hälfte des Schadens (der höhere Wert). Bei Misserfolg endet der Zauber. Bei mehreren Schadensquellen ist für jede ein eigener Wurf nötig.
- Der Spielleiter kann auch bei Ablenkungen (z. B. einer Welle, die über ein Schiffsdeck spült) einen Rettungswurf gegen SG 10 verlangen.`,
    'concentrating',
  ),
  rule(
    'Rituale',
    'spellcasting',
    'Zauber mit Ritual-Kennzeichnung ohne Zauberplatz wirken.',
    `- Ein Zauber mit der Kennzeichnung **Ritual** kann als Ritual gewirkt werden, wenn die Klasse das erlaubt.
- Das Ritual dauert **10 Minuten länger** als der normale Zeitaufwand und verbraucht **keinen Zauberplatz**; der Zauber kann daher nicht auf einem höheren Grad gewirkt werden.
- Der Zauber muss vorbereitet sein oder (z. B. beim Magier) im Zauberbuch stehen.`,
  ),
  rule(
    'Zauber wirken',
    'spellcasting',
    'Zauberplätze, Zeitaufwand, Komponenten und Wirkungsbereiche.',
    `- **Zauberplätze:** Ein Zauber ab dem 1. Grad verbraucht einen Platz seines Grades oder höher; höhere Plätze verstärken manche Zauber. Zaubertricks kosten keinen Platz.
- **Bonusaktion:** Wer einen Zauber als Bonusaktion wirkt, kann in diesem Zug nur noch einen Zaubertrick mit dem Zeitaufwand von 1 Aktion wirken.
- **Komponenten:** V (verbal – sprechen), G (Gesten – eine freie Hand), M (Material – eine Komponententasche oder ein Zauberfokus ersetzt Materialien ohne angegebenen Preis).
- **Angriffswurf:** W20 + Übungsbonus + Modifikator des Zauberattributs. **Rettungswurf-SG:** 8 + Übungsbonus + Modifikator des Zauberattributs.
- **Wirkungsbereiche:** Kegel, Würfel, Zylinder, Linie und Kugel; der Ursprung ist im Zauber angegeben.`,
  ),
];
