# Android APK build performance optimization (IndexPilotAI / frontend)

## Steps
- [x] Scan project Gradle + Android app configuration
- [ ] Update `frontend/android/gradle.properties` for RAM/heap stability + Gradle cache + parallel build
- [ ] Expand `frontend/android/app/proguard-rules.pro` for safer release shrinking/minification
- [ ] (Optional) Manifest cleanup after confirming runtime usage
- [ ] Run: `cd frontend/android && ./gradlew clean`
- [ ] Run: `cd frontend/android && ./gradlew assembleRelease`
- [ ] Run: `cd frontend/android && ./gradlew bundleRelease`
- [ ] Verify no build failures / no OOM / output APK/AAB size reduced
