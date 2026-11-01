# Installing Spark Lift on a phone

## Android — install the APK

1. Copy `SparkLift-v1.0.0.apk` (in the project folder) to the phone: USB cable, Google Drive, WhatsApp-to-self, or email.
2. On the phone, tap the file. If Android blocks it: **Settings → Apps → (the app you opened it from, e.g. Files or Chrome) → Install unknown apps → Allow**.
3. Tap **Install** (if Play Protect warns about an unknown developer: **More details → Install anyway**).
4. Open **Spark Lift** → **Try without an account**.

The APK contains everything; no laptop, Wi-Fi or Expo Go is needed.
It needs Android 7.0+ on a 64-bit ARM phone (practically every Android phone from 2017 onward).

### Rebuilding the APK on this Windows laptop

Two Windows quirks broke the first build; both have workarounds already set up:

1. **Path length** — native C++ object paths exceed 260 characters from `C:\Mithun\Projects_Spark\Gym_tracker`.
   Build from the short copy **`C:\sl`** instead.
2. **Old Ninja** — SDK CMake 3.22.1 ships Ninja 1.10.2, which ignores Windows long-path support.
   `C:\slcmake` is a copy of that CMake with Visual Studio 2022's Ninja 1.12.1, wired in via
   `cmake.dir` in `C:\sl\android\local.properties`.

After changing code, refresh the copy and build (PowerShell):

```powershell
$src = "C:\Mithun\Projects_Spark\Gym_tracker"; robocopy $src C:\sl /MIR /XD "$src\.git" "$src\android\app\build" "$src\android\build" "$src\android\.gradle" .cxx /XF local.properties /NFL /NDL
```
```powershell
cd C:\sl\android; $env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Output: `C:\sl\android\app\build\outputs\apk\release\app-release.apk`. If you add a native library, run
`npx expo prebuild --platform android --no-install` in the main project first. The cloud build (EAS) has none of these issues.

> This APK is signed with the debug key — fine for your own phones and friends, **not** for the Play Store.
> For the store, build an `.aab` with EAS: `npx eas-cli@latest build -p android --profile production`.

---

## iPhone — there is no "APK" equivalent

Apple does not allow installing app files directly. There are three legitimate ways, depending on what you have:

| Option | Needs | Good for |
|---|---|---|
| **A. Expo Go** | Free; laptop running `npx expo start --go --tunnel` | Quick testing while developing |
| **B. EAS build + ad hoc install** | Apple Developer Program ($99/year), no Mac | Installing on your own / a few registered iPhones |
| **C. TestFlight** | Apple Developer Program ($99/year), no Mac | Sharing with up to 10,000 testers; the path to the App Store |

### A. Expo Go (free, development only)
1. Install **Expo Go** from the App Store.
2. On the laptop (needs a free Expo account, because of the office firewall):
   ```bash
   npx expo login -u YOUR_EXPO_USERNAME
   ```
   ```bash
   npx expo start --go --tunnel
   ```
3. Scan the QR code with the iPhone **Camera** app → it opens in Expo Go.
   The laptop must keep running; Google/Apple sign-in doesn't work in Expo Go — use guest mode.

### B. Ad hoc install on your own iPhone (no Mac needed)
1. Join the **Apple Developer Program** at https://developer.apple.com/programs ($99/year).
2. Log in to Expo and link the project:
   ```bash
   npx eas-cli@latest login
   ```
   ```bash
   npx eas-cli@latest init
   ```
3. Register your iPhone (opens a page on the phone that installs a profile capturing its device ID):
   ```bash
   npx eas-cli@latest device:create
   ```
4. Build (EAS creates the certificates for you when asked to log in with your Apple ID):
   ```bash
   npx eas-cli@latest build --platform ios --profile preview
   ```
5. Open the link/QR EAS gives you **on the iPhone** → Install.
6. On iOS 16+: **Settings → Privacy & Security → Developer Mode → On**, restart, confirm.

Only iPhones registered in step 3 can install that build; register new ones and rebuild to add more.

### C. TestFlight (best for sharing, leads to the App Store)
1. Apple Developer Program + create the app in **App Store Connect** (bundle ID `com.spark.lift`).
2. Build and upload:
   ```bash
   npx eas-cli@latest build --platform ios --profile production
   ```
   ```bash
   npx eas-cli@latest submit --platform ios
   ```
3. In App Store Connect → TestFlight → add testers by email. They install **TestFlight** from the App Store and get the app from there.

Before an App Store release, configure **Sign in with Apple** (required alongside Google sign-in) — see `SETUP.md` §4.
