# Android push notifications

iPhones get push notifications through Apple, which EAS sets up for you. Android phones get them through Google's **Firebase Cloud Messaging (FCM)**, which needs a free Firebase project that only you can create. Until it's set up, Android phones never get a push token, so the server has nothing to send to and Android players get no notifications at all.

Everything here is free (Firebase's Spark plan). It takes about 15 minutes.

Push notifications never work in **Expo Go** on Android, only in a real build (the preview `.apk` or the Play Store build).

## 1. Make a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with your Google account.
2. Click **Create a project** (or **Add project**). Name it `The Gauntlet`.
3. When it asks about Google Analytics, turn it **off**. You don't need it. Click **Create project**.

## 2. Add the Android app and download `google-services.json`

1. On the project's home page, click the **Android** icon ("Add app").
2. **Android package name**: `com.abolger129.thegauntlet` (it has to match exactly). The nickname and SHA-1 are optional; leave them blank.
3. Click **Register app**, then **Download google-services.json**.
4. Move that file into the project folder on your Mac (next to `app.json`). Git ignores it, so it won't be committed.
5. Skip the rest of Firebase's steps ("Add Firebase SDK" and so on). Expo handles that. Click **Next** until you're back at the console.

## 3. Give EAS the key to send notifications

Expo's push service needs permission to send through your Firebase project.

1. In the Firebase console, click the gear next to **Project Overview**, then **Project settings**, then the **Service accounts** tab.
2. Click **Generate new private key**, then **Generate key**. A `.json` file downloads. This one **is secret**: don't commit it or share it.
3. In the project folder, run:

   ```bash
   npx eas-cli@latest credentials
   ```

   Pick **Android**, then **production**, then **Google Service Account**, then **Manage your Google Service Account Key for Push Notifications (FCM V1)**, then **Set up a Google Service Account Key for Push Notifications (FCM V1)** and choose the file you just downloaded. This covers the preview `.apk` too, since both use the same package name.

4. Once it's uploaded you can delete the downloaded key from your Downloads folder.

## 4. Give the cloud builds `google-services.json`

The file isn't in git, so upload it to EAS as a file variable for both build profiles:

```bash
npx eas-cli@latest env:set --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment preview --environment production
```

[`app.config.js`](../app.config.js) picks it up automatically during the build.

## 5. Make a new Android build

This changes the native app, so an over-the-air update can't deliver it. Build a new `.apk`:

```bash
npx eas-cli@latest build --profile preview --platform android
```

Send the link to Android friends. After installing, they open the app, sign in, and tap **Allow** when asked about notifications (Android 13 and newer ask). Then a nudge or a new round should show up on their phone.

When you make the Play Store build later, `--profile production` uses the same Firebase setup.

## If it still doesn't work

- **No permission prompt / notifications off**: on the phone, Settings, Apps, The Gauntlet, Notifications, and make sure they're on.
- **Old install**: they need the new build from step 5. Reinstalling over the old one is fine.
- **Check for a token**: in Supabase, Table Editor, `push_tokens`. Each Android phone that's set up properly adds a row starting with `ExponentPushToken[`.
