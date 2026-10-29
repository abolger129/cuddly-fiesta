# The web version

The same app runs in a browser, so you (and friends without the app) can play on a laptop and type comments with a real keyboard. It's free: GitHub Pages hosts it next to the privacy policy and terms.

**Address:** https://abolger129.github.io/cuddly-fiesta/app/

It's built and published automatically by `.github/workflows/pages.yml` every time something in the app changes on `main`. Phones are not affected: the web build is separate from EAS builds and over-the-air updates.

## One-time setup (about 5 minutes)

### 1. Turn on GitHub Pages (skip if the privacy page already works)

Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### 2. Give the build your Supabase settings

The web build needs the same two values as your `.env` file. They're public (they ship inside the phone app too), so they go in as variables, not secrets.

Repo **Settings → Secrets and variables → Actions → Variables tab → New repository variable**, twice:

| Name | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | the same value as in your `.env` |
| `EXPO_PUBLIC_SUPABASE_KEY` | the same value as in your `.env` |

### 3. Let Google sign-in come back to the website

Supabase **Authentication → URL Configuration → Redirect URLs → Add URL**:

```
https://abolger129.github.io/cuddly-fiesta/app/**
```

Keep `musicleague://**` there for the phone app. Nothing changes in Google Cloud: Google still sends people to your Supabase callback URL, and Supabase sends them on to the website.

### 4. Publish it

Merging the pull request publishes it. To publish again by hand: repo **Actions → Publish website → Run workflow**. It takes about 3 minutes; the address above then shows the sign-in screen.

## How it differs from the phone app

- **Sign-in:** Google and the emailed code work. Sign in with Apple is iPhone-only, so it isn't shown.
- **Comments:** every song in the ranking has its comment box open. Press **Tab** to go to the next song's box. Enter starts a new line.
- **Ranking:** drag a song up or down by its **≡** handle with the mouse.
- **Avatar doodles:** draw with the mouse or a trackpad.
- **Sharing:** if the browser has no share menu (most desktop browsers), the text is copied so you can paste it into the group chat. Invite links shared from the web open the web version, and a friend who isn't signed in yet lands on the join screen with the code filled in after signing in.
- **Notifications:** browsers don't get push notifications. Players who also have the phone app still get them there.
- **Results picture:** "Share to the group chat" shares the results as text instead of a picture.

## Trying it on your Mac

```bash
npm run web
```

That opens it at http://localhost:8081 with your `.env` settings. Google sign-in from localhost needs `http://localhost:8081/**` in the Supabase Redirect URLs too; the emailed code works without it.
