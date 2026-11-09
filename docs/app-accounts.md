# Sending sign-in emails from the app's own Gmail

The app's own address is **thegauntletapp@gmail.com**. This guide moves the **sign-in code emails** (sent through Gmail SMTP from Supabase) off your personal Gmail onto it. It's a Supabase setting only: no new build or app update.

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

## Spotify stays on your account

The playlists stay on your personal Spotify account (the developer app needs a Premium owner, and that's you). Nothing to change there.
