# The Gauntlet

A mobile app for playing a Music League style game with friends. Create a group, set a category for each round, and everyone submits a song that fits. Once all songs are in, a Spotify playlist is made for the round, everyone ranks the songs, and the person with the highest total score after the last round wins.

Built with [Expo](https://expo.dev) (React Native + TypeScript) for iPhone and Android, with [Supabase](https://supabase.com) for sign-in and the database.

## Status

- [x] Foundation: app skeleton, email sign-in, database tables and access rules
- [x] Game loop: create and join groups, rounds, song submissions, drag-and-drop ranking, scoring and leaderboard
- [x] Spotify: song search and a playlist per round
- [x] Round timers (e.g. 24 hours to pick, 48 to rank) and push notifications
- [ ] Testing with friends (TestFlight, Android `.apk` link), then store release. Steps: [docs/testing-with-friends.md](docs/testing-with-friends.md)
- Shipping changes without a new build (over-the-air updates): [docs/over-the-air-updates.md](docs/over-the-air-updates.md)

## Run it on your Mac

You need [Node.js](https://nodejs.org) 22.13 or newer (the current LTS is fine). For the iPhone simulator you also need Xcode from the Mac App Store; or install the **Expo Go** app on your phone instead.

### 1. Install

```bash
git clone https://github.com/abolger129/cuddly-fiesta.git
cd cuddly-fiesta
npm install
```

### 2. Set up Supabase (free)

1. Create a project at [supabase.com](https://supabase.com/dashboard). Find your project ref in its URL (`https://<project-ref>.supabase.co`), then log in and link the CLI to it:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

2. Apply the database migrations in [`supabase/migrations`](supabase/migrations). When a new file shows up there later, run the same command again and only the new one is applied.
   - Hosted project: `npx supabase db push`
   - Running the Supabase stack locally: `npx supabase migration up`
   - Or, without the CLI, open **SQL Editor** and run each file in order, oldest first: paste in its contents and press Run.
3. Sign-in uses a one-time code sent by email (8 digits by default; the length is under **Authentication > Sign In / Providers > Email**, and the app accepts 6 to 10). Under **Authentication > Emails > Templates**, edit both **Magic Link** (returning users) and **Confirm signup** (someone's first sign-in) so the email body shows `{{ .Token }}` instead of a link, for example:

   ```html
   <h2>Your code for The Gauntlet</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

   Save both templates. Changes can take a moment to apply, so if the email still contains a link instead of a code, wait a couple of minutes and request a fresh code (old emails keep their old format).

4. Copy `.env.example` to `.env` and fill in the Supabase values: the project URL (from the **Connect** button) and the **publishable** (or anon) key from **Project Settings > API Keys**. Never use the secret / service_role key in the app.

5. Optional but recommended: turn on **Sign in with Apple** and **Google** by following [docs/sign-in-setup.md](docs/sign-in-setup.md). The emailed code keeps working either way.

Note: Supabase's built-in email sender only allows a few emails per hour. That's fine while testing; before inviting lots of friends, set up a free custom SMTP provider under **Authentication > Emails > SMTP Settings**.

### 3. Set up Spotify (free, but needs Premium)

Spotify requires the owner of a developer app to have **Spotify Premium**, and a new app can have at most **5 Spotify users**. So nobody in the app connects Spotify: every playlist is made on Supabase, on **your** Spotify account, and players just get the link. Opening a link and searching for songs don't count towards the limit, so a league can have any number of players. Playlists are private, so they stay off your public profile, but anyone with the link can open them.

1. Go to the [Spotify developer dashboard](https://developer.spotify.com/dashboard) and create an app.
   - **Redirect URI:** `https://<project-ref>.supabase.co/functions/v1/spotify-owner-connect` (your Supabase project URL, then `/functions/v1/spotify-owner-connect`)
   - **APIs used:** Web API
2. Copy the app's **Client ID** into `.env` as `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`. The **Client secret** never goes in the app; it only goes to Supabase in the next step.
3. Deploy the Spotify functions to Supabase and give them your Spotify keys (this uses the CLI login and link from the Supabase step above).

   ```bash
   npx supabase secrets set SPOTIFY_CLIENT_ID=<client id> SPOTIFY_CLIENT_SECRET=<client secret>
   npx supabase functions deploy spotify-search
   npx supabase functions deploy spotify-playlist --no-verify-jwt
   npx supabase functions deploy spotify-owner-connect --no-verify-jwt
   ```

4. Connect your Spotify account once: open `https://<project-ref>.supabase.co/functions/v1/spotify-owner-connect` in a browser and sign in to Spotify. The page shows a command; run it to save your refresh token:

   ```bash
   npx supabase secrets set SPOTIFY_REFRESH_TOKEN=<token from the page>
   ```

   Keep that token private: it lets anyone make playlists on your account. If playlists ever stop being made with "The playlist account needs reconnecting", repeat this step.

A round's playlist is made as soon as ranking starts, and the league playlist updates itself as each round finishes, without anyone opening the app. (The database finds the function the first time anyone uses it after it's deployed, so the very first playlist may wait until someone opens the round.) This works in Expo Go too.

### 4. Start the app

```bash
npx expo start
```

Press `i` to open the iPhone simulator, `a` for an Android emulator, or scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android).

## How a game works

1. Someone creates a group with a list of categories, one per round, and shares the invite code.
2. The group creator starts round 1. Everyone picks one song that fits the category.
3. Once everyone has picked (or the creator moves things on), ranking opens. Each player drags the other songs into order, favourite first. Nobody can see who picked what yet.
4. Once everyone has ranked (or the creator ends voting), the round's results show who picked each song and how many points it got, and the next round opens for songs straight away.
5. The leaderboard adds up points across rounds. Most points after the last round wins.

Scoring lives in [`src/lib/scoring.ts`](src/lib/scoring.ts) so it's easy to change. Right now a voter ranking n songs gives n points to their favourite, down to 1 point for their last pick.

Each group can change the scoring when it's created (or on the group page, until the first round starts):

- **Points cap:** only each voter's top 3 or top 5 songs score (3 or 5 points down to 1); the rest get 0.
- **Downvotes:** each voter's last-place song loses a point, and the songs above it score as if it weren't there.

While ranking, players can also leave a comment on any song. Comments stay hidden from everyone else until the round ends, then show on the results with the commenter's name.

## Project layout

```
src/app/          Screens (Expo Router: each file is a screen)
src/components/   Shared UI pieces
src/lib/          Supabase client, sign-in state, Spotify, scoring, shared types
supabase/         Database schema, access rules, and the Spotify search function
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
```
