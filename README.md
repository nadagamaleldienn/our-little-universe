# Our Little Universe

A cozy, shared, pretend world for two people. Each of you has a character. Open the site and you see the other person's character in the room (live if they are around, a soft ghost with "last here ..." if not), plus a world map, letters left at imaginary places, a tic-tac-toe game drawn as a circuit board, a shared plant shelf, weather, and music.

It is a fictional world. No real locations or GPS, ever. There are always options to appear offline or hide what you are doing.

No build step: plain HTML, CSS and ES modules. It runs on GitHub Pages straight from the repo root.

## Run locally (demo mode)

```
npx serve .
# or
python -m http.server 8000
```

Open the printed address. With an empty `config.js` the app runs in **local mode**: data lives in your browser (localStorage) and two tabs talk over a BroadcastChannel.

To see the pair together: open one tab and pick **I'm Her**, open a second tab and pick **I'm Him**. Click spots in the room and watch the other character walk over. If you both pick the same spot you curl up under one blanket. Use **Wave** to send a wave and a little heart.

## Supabase setup (real two-person use)

1. Create a free project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql` and run it.
3. Add your two emails (lowercase) to the guest list:
   ```sql
   insert into public.allowed_users (email) values ('her@example.com'), ('him@example.com');
   ```
4. **Authentication > Providers > Email**: keep Email on, and turn **off** "Allow new users to sign up". Then create the two users under **Authentication > Users > Add user** (or Invite), using those same emails.
5. **Authentication > URL Configuration**: set **Site URL** and add a **Redirect URL** that is your GitHub Pages address, for example `https://YOUR-NAME.github.io/YOUR-REPO/`. For local testing also add `http://localhost:3000/` or `http://localhost:8000/`.
6. **Project Settings > Realtime**: turn **off** "Allow public access" so the presence channel is private (the schema adds the policies for your two emails).
7. **Project Settings > API**: copy the Project URL and the `anon` public key into `config.js`:
   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```
8. Open the site, enter your email, tap the magic link, then pick **Her** or **Him** (once each).

The anon key is meant to be public. Row Level Security (see the comments in `schema.sql`) lets only the two allowed users read or write anything. Never use the `service_role` key here.

## Deploy on GitHub Pages

Push the folder contents to a repo, then **Settings > Pages > Deploy from a branch**, pick `main` and `/ (root)`. All paths are relative, so it works under `/<repo>/`.

## Privacy notes

- Everything happens in an invented world: places are Cozy Corner, Lantern Library and so on. Nothing uses device location.
- **Live / Last stop only / Appear offline** (status chip or settings). Appearing offline means nothing is tracked or broadcast, and the other person only sees "Somewhere in the world".
- **Hide what I'm doing** shares only where you are in the pretend world, never the activity.
- Reading a letter or the bell never notifies the other person.
- Browser notifications are off by default, only asked for after you click the button in settings, and quiet hours are respected.
- **Delete my data** removes your profile, last-seen status, letters you wrote and plants you planted.

## Adding music

1. Put your audio files in the `audio/` folder (mp3 works everywhere).
2. List them in `audio/playlist.json`:
   ```json
   [{ "title": "Song name", "artist": "Artist", "src": "audio/my-song.mp3" }]
   ```
3. For the rain ambience, add `audio/rain.mp3` (a seamless loop works best).

The two example entries point to files that do not exist yet; the player shows a friendly message until you add them. Only add music you have the right to use. Nothing autoplays: tap "Tap to start the sound" first.

## Structure

```
index.html  css/styles.css  config.js  config.example.js
js/app.js        shell, router, presence HUD, bell, settings
js/scene.js      Cozy Corner scene (SVG + CSS)
js/characters.js all character drawing (replaceable, one module)
js/weather.js    weather modes and particles
js/music.js      music + rain player
js/views/        home, map, letters, xo, plants
js/backend/      index.js picks supabase.js or local.js
supabase/schema.sql
audio/playlist.json
```
