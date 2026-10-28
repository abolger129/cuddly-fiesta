# Over-the-air updates

Most changes to the app are JavaScript only: screens, wording, colors, scoring rules. Those can go straight to everyone's phone without a new build, a new `.apk` link or a new TestFlight review. The app downloads the update in the background and uses it the next time it's opened.

This uses [EAS Update](https://expo.dev/eas) (free tier is plenty for a group of friends).

## One-time: make a new build

Phones only get updates from a build that already has updates switched on, so you need **one new build of each kind you use** after this change is merged:

```bash
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform ios --auto-submit
```

Send friends the new `.apk` link and the new TestFlight build as usual. Builds from before this change never receive updates.

Each build listens to one **channel**, set in [`eas.json`](../eas.json):

| Build profile | Channel | Who has it |
| --- | --- | --- |
| `preview` | `preview` | Android friends with the `.apk` |
| `production` | `production` | TestFlight now, the App Store and Google Play later |

## Shipping a change

On your Mac, in the project folder, after pulling the latest `main`:

```bash
npm run update:preview -- --message "Fix ranking screen"
npm run update:production -- --message "Fix ranking screen"
```

These run `eas update` for that channel with the matching EAS environment (so the app gets the same Supabase and Spotify settings as the builds). The update is live in a minute or two. On each phone, the app picks it up when it's opened or brought back to the front, then switches to it the **next time the app is fully closed and reopened**. If someone wants it right away, they swipe the app away and open it again.

## When you need a new build instead

An update can only change JavaScript and images. A new build is needed when a change:

- adds or upgrades a package with native code (anything installed with `npx expo install` that isn't pure JavaScript),
- changes `app.json` settings such as the icon, splash screen, app name, permissions or sign-in setup,
- upgrades the Expo SDK.

Updates are matched to builds by the app's **version** in [`app.json`](../app.json) (`"version": "1.0.0"`). A build only accepts updates published with the same version. So when a change needs a new build, **bump the version first** (for example to `1.0.1`), then build, and publish later updates from that version. That way old builds never receive code they can't run. The PR descriptions in this repo say when a new build is needed.

## Undoing a bad update

```bash
npx eas-cli@latest update:rollback
```

Pick the channel's branch and roll back to the previous update (or to the code that shipped inside the build). Phones switch back on their next restart.

## Things to know

- Database changes still go through the Supabase SQL editor as before. Run the migration **before** publishing an update that relies on it.
- Updates don't run in Expo Go or in `npx expo start`; those always load the latest code from your Mac.
- App Store and Google Play rules allow bug fixes and small changes over the air. Anything that changes what the app fundamentally does should go through a normal store release.
