# App Store review checklist

What Apple checks that this app now covers, and the forms to fill in.

## One-time setup

1. **Contact email** is thegauntletapp@gmail.com, on all three pages in `site/`.
2. **Publish the website.** GitHub repo → **Settings → Pages → Build and deployment →
   Source: GitHub Actions**. Then **Actions → Publish website → Run workflow** (it also runs
   by itself whenever `site/` changes on `main`). The pages appear at:
   - Support: https://abolger129.github.io/cuddly-fiesta/
   - Privacy policy: https://abolger129.github.io/cuddly-fiesta/privacy.html
   - Terms of use: https://abolger129.github.io/cuddly-fiesta/terms.html
3. **Run the migration** `supabase/migrations/20261028110000_safety_and_account_deletion.sql`
   in the Supabase SQL editor.
4. **Add yourself as a moderation admin** (see `docs/moderation.md`) so reports reach your phone.

## App Store Connect

- **App Information → Privacy Policy URL**: the privacy link above.
- **Version → Support URL**: the support link above.
- **App Information → License Agreement**: leave Apple's standard EULA. Our terms page adds the
  no-tolerance rules, and players agree to it on the sign-in screen.
- **App Review Information → Notes**: add a line such as
  > Players can report a comment (Report, next to any comment on a finished round) or a player
  > (••• next to a player on the league screen), and block players from the same menu.
  > Reports notify the developer, who reviews them within 24 hours. Accounts can be deleted in
  > Settings → Delete account.
- **Age rating**: answer "None" to the content questions and **No** to unrestricted web access
  (links only open Spotify or YouTube). If asked about user-generated content, say yes, with
  reporting and blocking in place.

## App Privacy (the "nutrition label")

Under **App Privacy → Data Types**, declare these. For each: **linked to the user: Yes**,
**used for tracking: No**, purpose **App Functionality**.

| Category | Data type | What it is |
| --- | --- | --- |
| Contact Info | Email Address | Sign-in |
| Contact Info | Name | Display name |
| User Content | Other User Content | Comments, drawn avatar, category ideas, song picks |
| Identifiers | User ID | Account id |
| Usage Data | Product Interaction | Rankings and guesses |

Not collected: location, contacts, health, financial info, browsing history, diagnostics.

## Sign in with Apple and account deletion

Apple also asks apps that use Sign in with Apple to revoke the Apple token when an account is
deleted. Supabase doesn't do this for us, and it needs a server secret, so this version only
deletes the account. Players can remove the app under iPhone **Settings → Apple Account →
Sign in with Apple**. If a reviewer flags it, that's the follow-up to build.
