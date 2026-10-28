# Setting up Apple and Google sign-in

The sign-in screen offers **Sign in with Apple** (iPhone only), **Continue with Google**, and the emailed code as a fallback. The code is in the app already; these are the console steps only you can do. Everything here is free.

You need your Supabase project's callback URL a few times. It's `https://<your-project-ref>.supabase.co/auth/v1/callback`, and Supabase shows it ready to copy on the Google provider page (step 3 below).

## 1. Supabase redirect URL (do this first)

**Authentication > URL Configuration > Redirect URLs**, click **Add URL** and add:

```
musicleague://**
```

That covers `musicleague://auth-callback`, where Google sign-in returns to the app. If the redirect isn't on this list, Supabase falls back to the **Site URL** instead, which is how you end up on a `localhost` page.

If you also test in Expo Go, add `exp://**` too.

## 2. Google Cloud: OAuth client

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (for example "The Gauntlet").
2. Open **Google Auth Platform** (search for "OAuth consent screen"), click **Get started**, and fill in:
   - App name: The Gauntlet, and your Gmail as the support and contact email.
   - Audience: **External**.
3. Under **Audience**, click **Publish app** so friends can sign in. Only the basic `email`, `profile` and `openid` scopes are used, so Google doesn't need to review it. (If you leave it in Testing, add each friend's Gmail under **Test users** instead.)
4. Under **Clients**, click **Create client**:
   - Application type: **Web application** (yes, web, even though it's a phone app: the sign-in page runs on Supabase).
   - Authorized redirect URIs: your Supabase callback URL from the top of this page.
5. Copy the **Client ID** and **Client secret**.

You don't need separate iOS or Android client IDs.

## 3. Supabase: turn on Google

**Authentication > Sign In / Providers > Google**: switch it on, paste the Client ID and Client secret, and save.

## 4. Apple Developer: turn on the capability

1. On [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list), open **Certificates, IDs & Profiles > Identifiers** and click `com.abolger129.thegauntlet`.
2. Tick **Sign In with Apple** (leave it as a primary App ID) and save.

EAS usually does this for you on the next iOS build, but doing it by hand means the build can't trip over it. You do **not** need an Apple key (.p8) or a Services ID: those are only for signing in with Apple on a website, and the app uses the native iPhone sign-in.

## 5. Supabase: turn on Apple

**Authentication > Sign In / Providers > Apple**: switch it on and set **Client IDs** to:

```
com.abolger129.thegauntlet
```

(Add `host.exp.Exponent` after a comma if you want to try it in Expo Go.) Leave the secret key field empty and save.

## 6. Make a new build

Both buttons are new app code, and Sign in with Apple adds a native module, so friends need a new build (the steps are in [testing-with-friends.md](testing-with-friends.md)):

```bash
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest build --profile preview --platform android
```

Until friends have the new build, the emailed code keeps working.

## What happens to existing accounts

- **Google**: if the Gmail address matches an account that already signed in with an emailed code, Supabase links them, so it's the same account with the same groups.
- **Apple**: the same is true if you pick **Share My Email** and it's the address you used before. If you pick **Hide My Email**, Apple gives the app a private relay address and you get a **new, separate** account. Friends who already play should share their email the first time.
- New Apple users get their name from Apple. New Google and email users start with the first part of their email as their display name, which they can change in Settings.
