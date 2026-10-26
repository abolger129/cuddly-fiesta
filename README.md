# Music League

A mobile app for playing Music League with friends. Create a group, set a category for each round, and everyone submits a song that fits. Once all songs are in, a Spotify playlist is made for the round, everyone ranks the songs, and the person with the highest total score after the last round wins.

Built with [Expo](https://expo.dev) (React Native + TypeScript) for iPhone and Android, with [Supabase](https://supabase.com) for sign-in and the database.

## Status

- [x] Foundation: app skeleton, email sign-in, database tables and access rules
- [x] Game loop: create and join groups, rounds, song submissions, drag-and-drop ranking, scoring and leaderboard
- [x] Spotify: song search and a playlist per round
- [ ] Testing with friends (TestFlight, Google Play internal testing), then store release

## Run it on your Mac

You need [Node.js](https://nodejs.org) 22.13 or newer (the current LTS is fine). For the iPhone simulator you also need Xcode from the Mac App Store; or install the **Expo Go** app on your phone instead.

### 1. Install

```bash
git clone https://github.com/abolger129/cuddly-fiesta.git
cd cuddly-fiesta
npm install
```

### 2. Set up Supabase (free)

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor** and run each file in [`supabase/migrations`](supabase/migrations) in order, oldest first: paste in its contents and press Run. When a new file shows up there later, run just that one.
3. Sign-in uses a 6-digit code sent by email. Under **Authentication > Emails > Templates**, edit both **Magic Link** (returning users) and **Confirm signup** (someone's first sign-in) so the email body shows `{{ .Token }}` instead of a link, for example:

   ```html
   <h2>Your Music League code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

4. Copy `.env.example` to `.env` and fill in the Supabase values: the project URL (from the **Connect** button) and the **publishable** (or anon) key from **Project Settings > API Keys**. Never use the secret / service_role key in the app.

Note: Supabase's built-in email sender only allows a few emails per hour. That's fine while testing; before inviting lots of friends, set up a free custom SMTP provider under **Authentication > Emails > SMTP Settings**.

### 3. Set up Spotify (free, but needs Premium)

Spotify requires the owner of a developer app to have **Spotify Premium**, and a new app can have at most **5 Spotify users** connect to it. Only the person who creates a group connects their Spotify (the playlists go on their account); everyone else's song search doesn't count towards that limit.

1. Go to the [Spotify developer dashboard](https://developer.spotify.com/dashboard) and create an app.
   - **Redirect URI:** `musicleague://spotify-auth`
   - **APIs used:** Web API
2. Copy the app's **Client ID** into `.env` as `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`. The Client ID is fine to put in the app; the **Client secret is not**, it only goes to Supabase in the next step.
3. If friends will create groups too, add their Spotify email under the app's **User Management**.
4. Deploy the song search function to Supabase and give it your Spotify keys. Find your project ref in your Supabase project URL (`https://<project-ref>.supabase.co`).

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase secrets set SPOTIFY_CLIENT_ID=<client id> SPOTIFY_CLIENT_SECRET=<client secret>
   npx supabase functions deploy spotify-search
   ```

Song search works in Expo Go. **Connecting Spotify to make playlists needs a development build** instead of Expo Go, because Expo Go can't use the app's own `musicleague://` address. Run `npx expo run:ios` to build it into the iPhone simulator (needs Xcode).

### 4. Start the app

```bash
npx expo start
```

Press `i` to open the iPhone simulator, `a` for an Android emulator, or scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android).

## How a game works

1. Someone creates a group with a list of categories, one per round, and shares the invite code.
2. The group creator starts each round. Everyone picks one song that fits the category.
3. Once everyone has picked (or the creator moves things on), ranking opens. Each player drags the other songs into order, favourite first. Nobody can see who picked what yet.
4. Once everyone has ranked (or the creator ends voting), the round's results show who picked each song and how many points it got.
5. The leaderboard adds up points across rounds. Most points after the last round wins.

Scoring lives in [`src/lib/scoring.ts`](src/lib/scoring.ts) so it's easy to change. Right now a voter ranking n songs gives n points to their favourite, down to 1 point for their last pick.

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
