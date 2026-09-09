# Tab Bar Fix TODO

## Completed Tasks
- [x] 1. Update `frontend/app/(tabs)/_layout.tsx` - Navigation bar setup + floating tab bar config
- [x] 2. Update `frontend/app/(tabs)/home.tsx` - Add proper paddingBottom with insets
- [x] 3. Update `frontend/app/(tabs)/symbols.tsx` - Add proper paddingBottom with insets
- [x] 4. Update `frontend/app/(tabs)/broker.tsx` - Add proper paddingBottom with insets
- [x] 5. Update `frontend/app/(tabs)/journal.tsx` - Add proper paddingBottom with insets
- [x] 6. Update `frontend/app/(tabs)/support.tsx` - Add proper paddingBottom with insets
- [x] 7. Update `frontend/app/(tabs)/logs.tsx` - Add proper paddingBottom with insets
- [x] 8. Update `frontend/app/(tabs)/strategies.tsx` - Add proper paddingBottom with insets
- [x] 9. Update `frontend/app/_layout.tsx` - Global navigation bar setup on app load

## Requirements Implemented
- Android navigation bar: black background, light buttons ✓
- Floating tab bar: height 65, marginHorizontal 16, borderRadius 20, #111 background ✓
- Tab bar position: bottom = insets.bottom + 10 ✓
- Tab colors: Home=cyan, Signals=orange, Journal=green, Broker=purple, Support=blue, Logs=gray ✓
- Screen padding: paddingBottom = insets.bottom + 80 ✓
- Animated tab icons: scale 1→1.2 on active (using react-native-reanimated) ✓
