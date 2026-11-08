# Moving Spotify and sign-in emails to the app's own Gmail

The app's own address is **thegauntletapp@gmail.com**. This guide moves two things off your personal accounts onto it:

1. The **sign-in code emails** (sent through Gmail SMTP from Supabase).
2. The **Spotify account that owns every playlist** (the `SPOTIFY_REFRESH_TOKEN` secret).

Neither needs a new build or an app update: both are settings in Supabase and Spotify. Do them in either order.

## 1. Sign-in emails

### On thegauntletapp@gmail.com

1. Sign in to Google as thegauntletapp@gmail.com and open [myaccount.google.com/security](https://myaccount.google.com/security).
2. Turn on **2-Step Verification** if it isn't on yet. Google only offers app passwords after this.
3. Open [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), name it `Supabase`, and click **Create**. Copy the 16 letter password (leave out the spaces). You only see it once.

### In Supabase

4. Open your project, then **Authentication > Emails > SMTP Settings** (sometimes under **Authentication > Settings**).
5. Change these and click **Save**:

   | Field | Value |
   | --- | --- |
   | Sender email | `thegauntletapp@gmail.com` |
   | Sender name | `The Gauntlet` |
   | Host | `smtp.gmail.com` |
   | Port | `465` |
   | Username | `thegauntletapp@gmail.com` |
   | Password | the app password from step 3 |

   Gmail only lets you send as the account you sign in with, so the sender email and the username must be the same address.

6. Test it: sign out of the app, ask for a code, and check the email comes from The Gauntlet <thegauntletapp@gmail.com>. If no email arrives, look under **Authentication > Logs** (or **Logs > Auth**) for an SMTP error; the usual cause is a mistyped app password.

### Tidy up your personal account

7. Once a code arrives from the new address, go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) on **your personal** Google account and delete the app password you made for Supabase before.

Your email templates (Magic Link and Confirm signup showing `{{ .Token }}`) don't change. Bounces and replies now land in the thegauntletapp inbox. Gmail allows about 500 emails a day, which is plenty for friends.

## 2. The Spotify playlist account

Spotify has two separate accounts in play:

- The **developer app** (Client ID and secret). Its owner must have Premium. It stays on your personal account, which already has Premium, so nothing costs extra.
- The **account that makes the playlists**. This is the one moving. It can be a free Spotify account.

While the developer app is in development mode, every Spotify account that signs in to it has to be on its user list (up to 5).

### Make the Spotify account

1. Sign up at [spotify.com/signup](https://www.spotify.com/signup) with thegauntletapp@gmail.com. Free is fine. A display name like `The Gauntlet` looks nice, since people see it as the playlist owner.

### Let it use the developer app

2. In the [Spotify developer dashboard](https://developer.spotify.com/dashboard), signed in as **you**, open the app, then **Settings > User Management**.
3. Add a user: name `The Gauntlet`, email `thegauntletapp@gmail.com`. Save.

### Connect it

4. Open a **private / incognito browser window** (so it doesn't reuse your personal Spotify sign-in) and go to

   `https://<project-ref>.supabase.co/functions/v1/spotify-owner-connect`

5. Sign in to Spotify as thegauntletapp@gmail.com and approve. The page should say **Connected Spotify account: The Gauntlet** (or whatever name you chose). If it shows your own name, you were still signed in as yourself: close the window and try again in a fresh private window.
6. Run the command the page shows:

   ```bash
   npx supabase secrets set SPOTIFY_REFRESH_TOKEN=<token from the page>
   ```

   No redeploy is needed; the functions pick up the new secret on their next run.

7. Check it: the next round that opens for ranking should get a playlist owned by The Gauntlet.

### Optional: tidy up your personal Spotify

8. In a day or two, once new playlists are appearing on the new account, you can remove the app from your personal Spotify at [spotify.com/account/apps](https://www.spotify.com/account/apps). That only stops the old token working. **Don't delete the old playlists**, because their links are still in the app (see below).

## What happens to playlists that already exist

- **Round playlists already made** stay on your personal account. Their links in the app keep working as long as you don't delete them. New rounds get playlists on the new account.
- **League playlists** move by themselves. The next time a round in that league finishes, the new account can't edit the old playlist, so it makes a fresh league playlist with every song so far and the app switches to the new link. Anyone who saved the old league playlist keeps a copy that stops updating.
- If you'd rather nothing stays on your account, you can leave things as they are for a while and delete the old round playlists once those leagues are over.

## If you ever want the developer app on the new account too

That means paying for Premium on thegauntletapp@gmail.com. Then: create a new app in the dashboard as that account (same Redirect URI as in the README), run `npx supabase secrets set SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=...`, and repeat steps 4 to 6 above. The phone app doesn't use the Client ID, so no build is needed.
