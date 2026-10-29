-- The Gauntlet: avatar colors and stickers
--
-- Players can pick the circle color behind their doodle and the color they
-- draw in, and put a sticker (sunglasses, headphones, a party hat and so on)
-- wherever they like on their drawing. Left empty, the app uses the player's
-- name color and white ink. The crown isn't stored: it goes to whoever is
-- leading a league.
--
-- Safe to run more than once.

alter table public.profiles
  add column if not exists avatar_bg text
    check (avatar_bg is null or avatar_bg ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists avatar_ink text
    check (avatar_ink is null or avatar_ink ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists avatar_sticker text
    check (avatar_sticker is null or avatar_sticker in
      ('sunglasses', 'headphones', 'party-hat', 'top-hat', 'bow', 'star')),
  add column if not exists avatar_sticker_x smallint
    check (avatar_sticker_x is null or avatar_sticker_x between 0 and 100),
  add column if not exists avatar_sticker_y smallint
    check (avatar_sticker_y is null or avatar_sticker_y between 0 and 100);
