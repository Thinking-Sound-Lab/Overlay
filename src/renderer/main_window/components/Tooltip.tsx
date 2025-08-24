import React, { useState, useRef } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, side = 'bottom' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x, y;

      switch (side) {
        case 'top':
          x = rect.left + rect.width / 2;
          y = rect.top - 10;
          break;
        case 'bottom':
          x = rect.left + rect.width / 2;
          y = rect.bottom + 10;
          break;
        case 'left':
          x = rect.left - 10;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + 10;
          y = rect.top + rect.height / 2;
          break;
        default:
          x = rect.left + rect.width / 2;
          y = rect.bottom + 10;
      }

      setPosition({ x, y });
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative inline-block"
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          className="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg pointer-events-none"
          style={{
            left: position.x,
            top: position.y,
            transform: side === 'left' || side === 'right' 
              ? `translate(-50%, -50%)` 
              : `translate(-50%, ${side === 'top' ? '100%' : '0'})`
          }}
        >
          {content}
        </div>
      )}
    </>
  );
};