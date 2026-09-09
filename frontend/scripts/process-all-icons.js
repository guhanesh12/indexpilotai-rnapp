#!/usr/bin/env node
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const logosDir = path.join(__dirname, '..', 'assets', 'logo');
const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const iosDir = path.join(__dirname, '..', 'ios', 'IndexPilotAI', 'Images.xcassets', 'AppIcon.appiconset');

async function processAllIcons() {
  console.log('🚀 Starting icon processing...\n');
  
  // ============================================
  // 1. APP ICON PROCESSING
  // ============================================
  const appIconSrc = path.join(logosDir, 'logo_app_icon.png');
  
  if (!fs.existsSync(appIconSrc)) {
    console.error('❌ logo_app_icon.png not found!');
    process.exit(1);
  }
  
  console.log('📱 Processing App Icon...\n');
  
  // Android mipmap icon sizes
  const androidSizes = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 }
  ];
  
  for (const android of androidSizes) {
    const mipmapDir = path.join(androidResDir, android.dir);
    if (!fs.existsSync(mipmapDir)) {
      console.log(`⚠️  Directory not found: ${mipmapDir}, creating...`);
      fs.mkdirSync(mipmapDir, { recursive: true });
    }
    
    try {
      // Create ic_launcher.webp (using sharp to resize)
      await sharp(appIconSrc)
        .resize(android.size, android.size, {
          fit: 'cover',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 100 })
        .toFile(path.join(mipmapDir, 'ic_launcher.webp'));
      
      // Create ic_launcher_round.webp
      await sharp(appIconSrc)
        .resize(android.size, android.size, {
          fit: 'cover',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 100 })
        .toFile(path.join(mipmapDir, 'ic_launcher_round.webp'));
      
      // Create ic_launcher_foreground.webp
      await sharp(appIconSrc)
        .resize(android.size, android.size, {
          fit: 'cover',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 100 })
        .toFile(path.join(mipmapDir, 'ic_launcher_foreground.webp'));
      
      console.log(`✅ Created: ${android.dir}/ic_launcher*.webp (${android.size}x${android.size})`);
    } catch (err) {
      console.error(`❌ Error creating Android icon for ${android.dir}:`, err.message);
    }
  }
  
  // iOS icon sizes
  const iosSizes = [
    { size: 20, suffix: '' },
    { size: 29, suffix: '' },
    { size: 40, suffix: '' },
    { size: 58, suffix: '' },
    { size: 60, suffix: '' },
    { size: 76, suffix: '' },
    { size: 80, suffix: '' },
    { size: 87, suffix: '' },
    { size: 120, suffix: '' },
    { size: 152, suffix: '' },
    { size: 167, suffix: '' },
    { size: 180, suffix: '' },
    { size: 1024, suffix: '' }
  ];
  
  console.log('\n📱 Processing iOS App Icons...\n');
  
  for (const ios of iosSizes) {
    const filename = `AppIcon-${ios.size}x${ios.size}.png`;
    try {
      await sharp(appIconSrc)
        .resize(ios.size, ios.size, {
          fit: 'cover',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(path.join(iosDir, filename));
      
      console.log(`✅ Created: ${filename} (${ios.size}x${ios.size})`);
    } catch (err) {
      console.error(`❌ Error creating iOS icon ${filename}:`, err.message);
    }
  }
  
  // Create main icon.png (1024x1024)
  const icon1024Path = path.join(logosDir, 'icon.png');
  await sharp(appIconSrc)
    .resize(1024, 1024, {
      fit: 'cover',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(icon1024Path);
  console.log('✅ Created: icon.png (1024x1024)');
  
  // Create icon_320.png for adaptive icon
  const icon320Path = path.join(logosDir, 'icon_320.png');
  await sharp(appIconSrc)
    .resize(320, 320, {
      fit: 'cover',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(icon320Path);
  console.log('✅ Created: icon_320.png (320x320) - Adaptive icon foreground');
  
  // ============================================
  // 2. SPLASH SCREEN LOGO PROCESSING
  // ============================================
  const splashSrc = path.join(logosDir, 'splashscreen_logo_original.png');
  const splashDest = path.join(logosDir, 'splashscreen_logo.png');
  const splashTemp = path.join(logosDir, 'splashscreen_logo_temp.png');
  
  console.log('\n🖼️  Processing Splash Screen Logo...\n');
  
  // Use original if exists, otherwise use existing file
  const srcFile = fs.existsSync(splashSrc) ? splashSrc : path.join(logosDir, 'splashscreen_logo.png');
  
  if (!fs.existsSync(srcFile)) {
    console.error('❌ No splash screen logo found!');
  } else {
    // Resize to 512x512 with contain fit for proper splash screen
    await sharp(srcFile)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: 90, compressionLevel: 9 })
      .toFile(splashTemp);
    
    // Rename temp to destination
    if (fs.existsSync(splashDest)) fs.unlinkSync(splashDest);
    fs.renameSync(splashTemp, splashDest);
    console.log('✅ Created: splashscreen_logo.png (512x512, contain fit)');
  }
  
  // ============================================
  // 3. NOTIFICATION ICON PROCESSING
  // ============================================
  const notifSrc = path.join(logosDir, 'white.png');
  const notifTemp = path.join(logosDir, 'icon_notification_temp.png');
  
  console.log('\n🔔 Processing Notification Icon...\n');
  
  if (!fs.existsSync(notifSrc)) {
    console.error('❌ white.png not found!');
  } else {
    // Resize to 48x48 for Android notification icon (recommended size)
    await sharp(notifSrc)
      .resize(48, 48, {
        fit: 'cover',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(notifTemp);
    
    console.log('✅ Created: icon_notification_temp.png (48x48) - Notification icon (temp)');
  }
  
  // ============================================
  // 4. UPDATE iOS AppIcon.appiconset Contents.json
  // ============================================
  console.log('\n📝 Updating iOS Contents.json...\n');
  
  const iosContents = {
    "images": [
      { "idiom": "iphone", "scale": "2x", "size": "20x20", "filename": "AppIcon40x40.png" },
      { "idiom": "iphone", "scale": "3x", "size": "20x20", "filename": "AppIcon60x60.png" },
      { "idiom": "iphone", "scale": "2x", "size": "29x29", "filename": "AppIcon58x58.png" },
      { "idiom": "iphone", "scale": "3x", "size": "29x29", "filename": "AppIcon87x87.png" },
      { "idiom": "iphone", "scale": "2x", "size": "40x40", "filename": "AppIcon80x80.png" },
      { "idiom": "iphone", "scale": "3x", "size": "40x40", "filename": "AppIcon120x120.png" },
      { "idiom": "iphone", "scale": "2x", "size": "60x60", "filename": "AppIcon120x120.png" },
      { "idiom": "iphone", "scale": "3x", "size": "60x60", "filename": "AppIcon180x180.png" },
      { "idiom": "ipad", "scale": "1x", "size": "20x20", "filename": "AppIcon20x20.png" },
      { "idiom": "ipad", "scale": "2x", "size": "20x20", "filename": "AppIcon40x40.png" },
      { "idiom": "ipad", "scale": "1x", "size": "29x29", "filename": "AppIcon29x29.png" },
      { "idiom": "ipad", "scale": "2x", "size": "29x29", "filename": "AppIcon58x58.png" },
      { "idiom": "ipad", "scale": "1x", "size": "40x40", "filename": "AppIcon40x40.png" },
      { "idiom": "ipad", "scale": "2x", "size": "40x40", "filename": "AppIcon80x80.png" },
      { "idiom": "ipad", "scale": "1x", "size": "76x76", "filename": "AppIcon76x76.png" },
      { "idiom": "ipad", "scale": "2x", "size": "76x76", "filename": "AppIcon152x152.png" },
      { "idiom": "ipad", "scale": "2x", "size": "167x167", "filename": "AppIcon167x167.png" },
      { "idiom": "ios-marketing", "scale": "1x", "size": "1024x1024", "filename": "AppIcon1024x1024.png" },
      { "idiom": "universal", "platform": "ios", "size": "1024x1024" }
    ],
    "info": {
      "author": "expo",
      "version": 1
    }
  };
  
  fs.writeFileSync(
    path.join(iosDir, 'Contents.json'),
    JSON.stringify(iosContents, null, 2)
  );
  console.log('✅ Updated: Contents.json for iOS');
  
  console.log('\n🎉 All icon processing complete!');
  console.log('\n📋 Summary:');
  console.log('  ✅ Android mipmap icons (5 sizes)');
  console.log('  ✅ iOS App Icons (13 sizes)');
  console.log('  ✅ Main icon.png (1024x1024)');
  console.log('  ✅ icon_320.png (320x320)');
  console.log('  ✅ splashscreen_logo.png (512x512)');
  console.log('  ✅ notification icon (48x48) - saved as icon_notification_temp.png');
  console.log('  ✅ iOS Contents.json updated');
}

processAllIcons().catch(console.error);
