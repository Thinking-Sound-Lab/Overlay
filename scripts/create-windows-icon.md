# Creating Windows Icon File

## Option 1: Online Conversion (Quickest)
1. Upload `assets/icon.png` to https://convertio.co/png-ico/
2. Select multiple sizes: 16x16, 32x32, 48x48, 256x256
3. Download as `icon.ico`
4. Save to `assets/icon.ico`

## Option 2: ImageMagick (Command Line)
```bash
# Install ImageMagick first
brew install imagemagick  # macOS
# or
sudo apt-get install imagemagick  # Linux

# Convert PNG to ICO with multiple sizes
magick assets/icon.png -define icon:auto-resize="256,64,48,32,16" assets/icon.ico
```

## Option 3: GIMP (Free Software)
1. Open `assets/icon.png` in GIMP
2. File → Export As → `icon.ico`
3. Select multiple sizes in the export dialog
4. Save to `assets/` directory

## Option 4: Windows Built-in
On Windows machines:
1. Right-click on `icon.png`
2. Open with → Paint
3. File → Save As → Type: ICO
4. Choose quality and save as `assets/icon.ico`

## Verification
The icon should be:
- Multiple sizes (16, 32, 48, 256px minimum)
- 32-bit color depth with transparency
- Under 1MB file size
- Square aspect ratio

After creating the icon, Windows builds should work correctly.