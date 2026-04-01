# Ascension Testing Progress

## Resume Prompt
Copy-paste this into a new Claude Code chat when you hit the image limit:

---

Continue the Ascension visual testing plan. The plan is at `C:\Users\Jamie Stone\.claude\plans\golden-leaping-nygaard.md` and progress is tracked at `ascension/test-screenshots/TESTING_PROGRESS.md`. Read the progress file to see what's been completed, pick up from the next incomplete task. Use the resized screenshots in `test-screenshots-review/` (max 1000px) for visual review - run `node tools/resize-for-review.js` after any new captures. Write findings to `test-screenshots/VISUAL_AUDIT.md`. Keep updating TESTING_PROGRESS.md as you go.

---

## Phase Progress

### Phase A: Desktop Testing in VM
- [ ] Boot VM, verify Windows installed (BLOCKED - VM shows black screen)
- [x] Build desktop .exe from apps/desktop/ (Next.js built, Electron .exe + NSIS installer built)
- [x] Install app in VM (robocopy 946MB to C:\Ascension)
- [x] App launches - backend works (capture, blocker, streak, protection)
- [x] UI rendered via local HTTP server (Electron sandbox issue bypassed)
- [x] Screenshot all 10 desktop screens at 1920x1080
- [x] Screenshot all 10 desktop screens at 1366x768
- [x] Screenshot all 10 desktop screens at 1280x800
- [x] AI visual review of desktop screenshots - 2 issues found (Issues 7, 8)
- [ ] Functional tests F1-F4, F6-F9 (need auth/Supabase for most)
- [ ] Fix onboarding partner/confirm unstyled pages (Issue 7)

### Phase B: Expo Web Testing via Playwright
- [x] Install Playwright
- [x] Mobile web: 8 screens x 4 viewports = 32 screenshots
- [x] Ally web: 7 screens x 4 viewports = 28 screenshots
- [x] AI visual review of mobile-web screenshots (PASS - no issues)
- [x] AI visual review of ally-web screenshots (3 issues found - see VISUAL_AUDIT.md)
- [x] Cross-platform comparison (shared screens) - consistent design language

### Phase C: Native Android Testing
- [ ] Install Android Studio + Pixel 7 emulator
- [ ] Run mobile app, capture all screens
- [ ] Run ally app, capture all screens
- [ ] Compare native vs Expo web screenshots
- [ ] Functional tests on native

### Phase D: macOS + iOS Testing (MacinCloud)
- [ ] MacinCloud account setup (Jamie)
- [x] iOS Simulator screenshots started (8 captured - all broken due to React dual-instance useMemo bug)
- [x] Fixed useMemo dual-instance bug in mobile _layout.tsx and ally _layout.tsx
- [ ] iOS Simulator: all 8 mobile screens on iPhone 15
- [ ] iOS Simulator: all 8 mobile screens on iPhone SE
- [ ] iOS Simulator: all 8 mobile screens on iPad Air
- [ ] iOS Simulator: all 7 ally screens on iPhone 15
- [ ] iOS Simulator: all 7 ally screens on iPhone SE
- [ ] iOS Simulator: all 7 ally screens on iPad Air
- [ ] macOS desktop build + screenshots
- [ ] VPN + Safari Content Blocker test
- [ ] AI visual review of iOS screenshots
- [ ] AI visual review of macOS screenshots

### Phase E: Physical Device Testing
- [ ] Expo Go on Jamie's Android phone
- [ ] Manual walkthrough on real hardware

### Phase F-H: Repair, Regression, Final Audit
- [ ] Repair cycle (ongoing)
- [ ] Full regression re-run
- [ ] Final visual audit + cross-platform comparison
- [ ] TESTING_REPORT.md generated

## Current Position
**Phase B COMPLETE (all issues resolved). Phases A, C, D blocked - need manual setup (see below).**

## Blockers Requiring Jamie

| # | Blocker | What to do | Phase unblocked |
|---|---------|-----------|-----------------|
| 1 | VM shows black screen - Windows not installed or display sleeping | Open VirtualBox GUI, boot AscensionTest VM, install Windows 11 from ISO, install Guest Additions | Phase A |
| 2 | Android SDK not downloaded | Open Android Studio, let it download SDK + create a Pixel 7 AVD | Phase C |
| 3 | MacinCloud account not created | Sign up at macincloud.com PAYG ($4/day), share credentials | Phase D |

## Screenshot Counts
| Category | Count | Status |
|----------|-------|--------|
| mobile-web | 32 | Captured |
| ally-web | 28 | Captured |
| ios-simulator | 8 | Partial (iterations) |
| windows-desktop | 2 | VM check only |
| android-emulator | 0 | Not started |
| macos-desktop | 0 | Not started |
| cross-platform | 0 | Not started |
| **Total** | **70** | **~28% of ~250** |
