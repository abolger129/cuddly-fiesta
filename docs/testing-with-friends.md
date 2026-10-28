# Getting the app onto friends' phones

The app is built in the cloud with [EAS](https://expo.dev/eas) (Expo's build service), so you don't need to build anything in Xcode or Android Studio. The repo already has the build settings in [`eas.json`](../eas.json):

- **preview**: an Android `.apk` you can send to friends as a link. No Google Play account needed.
- **production**: the build that goes to TestFlight (iPhone) and later the App Store and Google Play.

## Accounts you need

| Account | Cost | Needed for |
| --- | --- | --- |
| [Expo](https://expo.dev/signup) | Free (a limited number of cloud builds each month, plenty for this) | Every build |
| [Apple Developer Program](https://developer.apple.com/programs/enroll/) | $99 a year | **Any** install on a friend's iPhone (TestFlight), and the App Store later. Approval can take a day or two, so start this first. |
| [Google Play Console](https://play.google.com/console/signup) | $25 once | Only for Google Play testing and publishing. Not needed to send Android friends the `.apk`. |

Heads up for later: a new personal Google Play account has to run a closed test with at least 12 testers for 14 days before it can publish to everyone. The `.apk` link is the easy way to test with Android friends until then.

## One-time setup (on your Mac, in the project folder)

1. Log in to Expo and link the project. `init` adds a project ID to `app.json`; commit that change.

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

2. Give the cloud builds your settings. Your `.env` file never leaves your Mac (it's in `.gitignore`), so copy its values to EAS:

   ```bash
   npx eas-cli@latest env:push preview --path .env
   npx eas-cli@latest env:push production --path .env
   ```

   These are the same public values already inside the app (Supabase URL and publishable key, Spotify Client ID). Never add the Spotify client secret or Supabase secret key here.

## Android friends: send a link

```bash
npx eas-cli@latest build --profile preview --platform android
```

Accept the offer to generate a new Android keystore. When the build finishes (10 to 20 minutes) you get a link and a QR code. Send the link to friends; they open it on their phone, download the app, and allow installs from their browser when Android asks. For a new version, run the same command and send the new link. Most changes don't need a new build at all: see [over-the-air updates](over-the-air-updates.md).

## iPhone friends: TestFlight

Once Apple has approved your developer account:

```bash
npx eas-cli@latest build --profile production --platform ios --auto-submit
```

Sign in with your Apple ID when asked and let EAS create the certificates and the App Store Connect app for you. When the build is done it's uploaded to TestFlight automatically; Apple then processes it for a few minutes to an hour.

Then in [App Store Connect](https://appstoreconnect.apple.com) > your app > **TestFlight**:

1. You (and anyone you add under **Users and Access**) can test right away as an **internal tester**.
2. For friends, create an **External Testing** group, add the build, and fill in the short test information Apple asks for (what to test, a contact email). The first build gets a quick Apple review, usually within a day.
3. Turn on the group's **public link** and send it to friends. They install the free **TestFlight** app from the App Store, open your link, and tap Install.

For a new version, run the same build command; testers get the update in TestFlight. Most changes can skip this and go out as an [over-the-air update](over-the-air-updates.md). TestFlight builds expire after 90 days.

## Before inviting people

- **Spotify:** nobody needs adding in the Spotify dashboard. Every playlist goes on your Spotify account, so just make sure the three Spotify functions are deployed and your account is connected (see the README).
- **Supabase:** run any new file in `supabase/migrations` you haven't run yet.
- **Push notifications:** iPhone needs nothing extra: `eas build` offers to set up the push key with your Apple developer account, say yes. Android needs a free Firebase project: follow [Expo's FCM guide](https://docs.expo.dev/push-notifications/fcm-credentials/) to add `google-services.json` to the app and upload the key to EAS. Notifications don't work in Expo Go or the simulator.
- **Email:** sign-in codes go out through your custom SMTP (Gmail allows a few hundred emails a day, which is fine for friends).

## Test these on a real phone first

The simulator can't cover everything, so try these yourself on the first build before sending it around:

- Sign in with an emailed code.
- Check a round playlist appears on the round page once ranking starts, and opens in Spotify for a friend.
- Drag songs into order on the ranking screen with your finger.
- Allow notifications, have a friend start a round, and check the notification arrives and opens the round when tapped. Set a short timer (12 hours) to check the "time is almost up" reminder.
