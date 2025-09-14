// helpers/windowAnimator.ts
import { BrowserWindow } from "electron";

export class WindowAnimator {
  private resizeTimeoutId: NodeJS.Timeout | null = null;
  private moveTimeoutId: NodeJS.Timeout | null = null;

  animateResize(
    window: BrowserWindow,
    targetWidth: number,
    targetHeight: number,
    duration = 300,
    anchorPoint: 'center' | 'bottom-center' = 'center'
  ) {
    const startBounds = window.getBounds();
    const startTime = Date.now();
    const frameRate = 60; // 60 FPS
    const frameInterval = 1000 / frameRate;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentWidth = Math.round(
        startBounds.width + (targetWidth - startBounds.width) * easeOut
      );
      const currentHeight = Math.round(
        startBounds.height + (targetHeight - startBounds.height) * easeOut
      );

      // Calculate new position based on anchor point
      let newX: number;
      let newY: number;

      if (anchorPoint === 'bottom-center') {
        // Bottom-center anchored: keep bottom edge fixed, expand upward
        newX = startBounds.x + Math.round((startBounds.width - currentWidth) / 2);
        newY = startBounds.y + (startBounds.height - currentHeight);
      } else {
        // Center anchored: keep window centered during resize (default behavior)
        newX = startBounds.x + Math.round((startBounds.width - currentWidth) / 2);
        newY = startBounds.y + Math.round((startBounds.height - currentHeight) / 2);
      }

      try {
        window.setBounds({
          x: newX,
          y: newY,
          width: currentWidth,
          height: currentHeight,
        });
      } catch (error) {
        console.error("[WindowAnimator] Error setting window bounds:", error);
        return;
      }

      if (progress < 1) {
        this.resizeTimeoutId = setTimeout(animate, frameInterval);
      } else {
        this.resizeTimeoutId = null;
      }
    };

    // Cancel any existing animation
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
    }

    animate();
  }

  // animateMove method removed - using instant positioning for cross-display movement
  // This avoids Electron's cross-display coordinate system issues

  stop(): void {
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
      this.resizeTimeoutId = null;
    }
    if (this.moveTimeoutId) {
      clearTimeout(this.moveTimeoutId);
      this.moveTimeoutId = null;
    }
  }
}
