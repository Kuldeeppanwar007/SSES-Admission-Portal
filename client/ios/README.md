# iOS Build — SSES Admission Portal

## Prerequisites (Mac pe karna hoga)
- Xcode 15+
- Node.js 18+
- CocoaPods: `sudo gem install cocoapods`

---

## Step 1 — Dependencies install karo

```bash
cd client
npm install
```

---

## Step 2 — Web build banao

```bash
npm run build
```

---

## Step 3 — Capacitor iOS platform add karo

```bash
npx cap add ios
```

> Yeh command `ios/` folder generate karegi — **iske baad** Step 4 karo.

---

## Step 4 — Sync karo

```bash
npx cap sync ios
```

---

## Step 5 — Custom plugin files copy karo

`npx cap add ios` ne jo `ios/App/App/` folder banaya hai, usme ek naya folder banao:

```
ios/App/App/LocationPlugin/
```

Aur repo ke `ios/App/App/LocationPlugin/` se yeh 3 files usme copy karo:
- `LocationService.swift`
- `LocationTrackingPlugin.swift`
- `LocationTrackingPlugin.m`

---

## Step 6 — Info.plist mein permissions merge karo

`npx cap add ios` apna `Info.plist` banata hai. Repo ke `ios/App/App/Info.plist` se yeh keys **Xcode ke Info tab** mein add karo:

| Key | Value |
|---|---|
| NSLocationAlwaysAndWhenInUseUsageDescription | SSES Portal ko background mein attendance ke liye aapki location chahiye. |
| NSLocationAlwaysUsageDescription | SSES Portal ko background mein attendance ke liye aapki location chahiye. |
| NSLocationWhenInUseUsageDescription | SSES Portal ko attendance track karne ke liye location chahiye. |
| NSCameraUsageDescription | SSES Portal ko photo upload ke liye camera access chahiye. |

Ya seedha `Info.plist` file mein yeh keys paste karo (Capacitor ke existing keys ke saath).

---

## Step 7 — Xcode mein open karo

```bash
npx cap open ios
```

**`.xcworkspace` open karo — `.xcodeproj` nahi.**

---

## Step 8 — Xcode mein plugin files add karo

1. Left panel mein `App` → `App` folder pe right-click karo
2. **"Add Files to App..."** select karo
3. `LocationPlugin/` folder navigate karo → **"Add"** click karo
4. "Copy items if needed" checkbox **untick** rakho (files already sahi jagah hain)

---

## Step 9 — Capabilities set karo

Xcode mein `App` target select karo → **Signing & Capabilities** tab:

1. **Team** select karo (Apple Developer account chahiye)
2. **Bundle Identifier:** `com.sses.portal`
3. **+ Capability** → `Background Modes` add karo:
   - ✅ Location updates
   - ✅ Background fetch

---

## Step 10 — Build / Archive

- **Device pe test:** Real iPhone connect karo → ▶ Run
- **IPA ke liye:** Product → Archive → Distribute App → Ad Hoc / App Store

---

## Important Notes

- User ko location permission dialog mein **"Always Allow"** select karna hoga — "While Using" se background tracking kaam nahi karegi
- iOS mein Android jaisi persistent foreground notification nahi hoti — status bar mein **blue location indicator** aayega
- Mock GPS detection iOS 15.4+ pe native hai, purane iOS pe heuristic checks kaam karti hain
- `npx cap sync` dobara run karne se `LocationPlugin/` files delete **nahi** hongi

---

## Folder Structure (jo iOS developer ko manually add karni hain)

```
ios/App/App/
├── AppDelegate.swift        ← repo se copy karo (Capacitor wala replace karo)
├── Info.plist               ← permissions merge karo (replace mat karo)
└── LocationPlugin/          ← naya folder banao, teeno files copy karo
    ├── LocationService.swift
    ├── LocationTrackingPlugin.swift
    └── LocationTrackingPlugin.m
```
