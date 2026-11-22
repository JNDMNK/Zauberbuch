-- „Homebrew“ ergibt sich ab jetzt aus der Quelle: bestehende Zauber angleichen
UPDATE "Spell" SET "isHomebrew" = CASE WHEN lower(trim("source")) = 'homebrew' THEN 1 ELSE 0 END;
