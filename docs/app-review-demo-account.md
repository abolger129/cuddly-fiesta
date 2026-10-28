# App Review demo account

Apple (and Google Play) ask for a username and password so a reviewer can sign in.
Our normal sign-in is passwordless, so we keep one demo account that has a password.
The sign-in screen has a small **Sign in with a password** link under the email box for it.

Never commit the demo password to this repo. It lives only in Supabase and in the
App Store Connect / Play Console forms.

## 1. Make the account in Supabase

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**.
2. Email: an address you control, for example `yourname+review@gmail.com`
   (Gmail delivers `+anything` addresses to your normal inbox).
3. Password: a fresh one you don't use anywhere else.
4. Tick **Auto Confirm User**, then **Create user**.

Email sign-in must stay switched on under **Authentication → Sign In / Providers → Email**
(it already is, because the email code uses it).

## 2. Give the reviewer something to look at

An empty account only shows "start a league". Sign in as the demo account yourself
(Expo Go works for this, using the password link) and:

1. Create a league, for example "Demo League", with 3 rounds.
2. Invite yourself and a friend with the invite link, so there are 3 players.
3. Play the first round to the end (everyone submits and ranks), so the results,
   reveal and scores screens have content.
4. Leave round 2 open for submissions, so the reviewer can search for and pick a song.

## 3. Fill in App Store Connect

**App Review Information → Sign-In Information**: tick **Sign-in required**, then

- User name: the demo email
- Password: the demo password

**Notes**, for example:

> Sign-in is normally passwordless (Sign in with Apple, Google, or a one-time code by email).
> For review, tap "Sign in with a password" under the email box on the sign-in screen and
> use the account above. It is already in a league called "Demo League" with a finished
> round and an open round. Connecting Spotify is only needed by the person who starts a
> league, to create its playlist, and is not needed to try the game.

TestFlight external testing has the same fields under **TestFlight → Test Information**.
Google Play has them under **App content → App access**.
