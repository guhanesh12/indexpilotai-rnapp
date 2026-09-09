#!/usr/bin/env node
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const logosDir = path.join(__dirname, '..', 'assets', 'logo');

async function resizeIcons() {
  console.log('🔄 Resizing app icons...\n');
  
  // Config for different icon sizes (use logo_app_icon.png as source)
  const iconConfigs = [
    { 
      src: 'logo_app_icon.png', 
      dest: 'icon_original.png', 
      size: 1024,
      desc: 'Source icon (1024x1024)'
    },
    { 
      src: 'splashscreen_logo_original.png', 
      dest: 'splashscreen_logo.png', 
      size: 512,
      desc: 'Splash screen logo (512x512)'
    }
  ];
  
  // Android mipmap icon sizes
  const androidSizes = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 }
  ];
  const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  
  for (const config of iconConfigs) {
    const srcPath = path.join(logosDir, config.src);
    const destPath = path.join(logosDir, config.dest);
    
    if (!fs.existsSync(srcPath)) {
      console.log(`⚠️  Source not found: ${config.src}, skipping...`);
      continue;
    }
    
    try {
      await sharp(srcPath)
        .resize(config.size, config.size, {
          fit: 'inside',
          kernel: sharp.kernel.lanczos3
        })
        .png({ 
          quality: 90,
          compressionLevel: 9
        })
        .toFile(destPath);
      
      console.log(`✅ Resized: ${config.dest} (${config.size}x${config.size}) - ${config.desc}`);
    } catch (err) {
      console.error(`❌ Error resizing ${config.src}:`, err.message);
    }
  }
  
  // Create 320x320 foreground for adaptive icon (changed to cover for proper full icon display without padding)
  const foreground1024Path = path.join(logosDir, 'icon_original.png');
  const icon1024Path = path.join(logosDir, 'icon.png');
  const foreground320Path = path.join(logosDir, 'icon_320.png');
  
  // Copy original as icon.png
  if (fs.existsSync(foreground1024Path)) {
    fs.copyFileSync(foreground1024Path, icon1024Path);
    console.log('✅ Copied: icon.png (1024x1024) - Main icon');
  }
  
  if (fs.existsSync(foreground1024Path)) {
    try {
      await sharp(foreground1024Path)
        .resize(320, 320, {
          fit: 'cover',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ quality: 90 })
        .toFile(foreground320Path);
      
      console.log(`✅ Created: icon_320.png (320x320) - Adaptive icon foreground (full icon, no padding)`);
    } catch (err) {
      console.error('❌ Error creating 320px version:', err.message);
    }
  }
  
  // Generate Android mipmap icons
  console.log('\n🤖 Generating Android mipmap icons...\n');
  for (const android of androidSizes) {
    const mipmapDir = path.join(androidResDir, android.dir);
    if (fs.existsSync(mipmapDir)) {
      try {
        // ic_launcher.png
        await sharp(foreground1024Path)
          .resize(android.size, android.size, { fit: 'cover' })
          .png({ quality: 100 })
          .toFile(path.join(mipmapDir, 'ic_launcher.png'));
        // ic_launcher_round.png
        await sharp(foreground1024Path)
          .resize(android.size, android.size, { fit: 'cover' })
          .png({ quality: 100 })
          .toFile(path.join(mipmapDir, 'ic_launcher_round.png'));
        // ic_launcher_foreground.png
        await sharp(foreground1024Path)
          .resize(android.size, android.size, { fit: 'cover' })
          .png({ quality: 100 })
          .toFile(path.join(mipmapDir, 'ic_launcher_foreground.png'));
        console.log(`✅ Created: ${android.dir}/ic_launcher*.png (${android.size}x${android.size})`);
      } catch (err) {
        console.error(`❌ Error creating Android icon for ${android.dir}:`, err.message);
      }
    }
  }
  
  // Generate iOS icon sizes
  const iosSizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
  const iosDir = path.join(__dirname, '..', 'ios', 'IndexPilotAI', 'Images.xcassets', 'AppIcon.appiconset');
  
  if (fs.existsSync(foreground1024Path)) {
    console.log('\n📱 Generating iOS icon sizes...\n');
    for (const size of iosSizes) {
      const filename = `App-Icon-${size}x${size}@1x.png`;
      const destPath = path.join(iosDir, filename);
      try {
        await sharp(foreground1024Path)
          .resize(size, size, {
            fit: 'cover',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png({ quality: 100 })
          .toFile(destPath);
        console.log(`✅ Created: ${filename} (${size}x${size})`);
      } catch (err) {
        console.error(`❌ Error creating iOS icon ${filename}:`, err.message);
      }
    }
  }
  
  console.log('\n✨ All icon resizing complete!');
}

resizeIcons().catch(console.error);
