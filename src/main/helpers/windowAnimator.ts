// helpers/windowAnimator.ts
import { BrowserWindow } from "electron";

export class WindowAnimator {
  private timeoutId: NodeJS.Timeout | null = null;

  animateResize(
    window: BrowserWindow,
    targetWidth: number,
    targetHeight: number,
    duration = 300
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

      // Keep window centered during resize
      const newX =
        startBounds.x + Math.round((startBounds.width - currentWidth) / 2);
      const newY =
        startBounds.y + Math.round((startBounds.height - currentHeight) / 2);

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
        this.timeoutId = setTimeout(animate, frameInterval);
      } else {
        this.timeoutId = null;
      }
    };

    // Cancel any existing animation
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    animate();
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
