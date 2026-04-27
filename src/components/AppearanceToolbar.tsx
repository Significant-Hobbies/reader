import { useEffect, useRef, useState } from 'react';

import type { FontFamily, FontSize, ReaderSettings } from '../types';

export const AppearanceToolbar = ({
  settings,
  onUpdate,
}: {
  settings: ReaderSettings;
  onUpdate: (s: Partial<ReaderSettings>) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    const sizes: FontSize[] = ['xs', 'small', 'medium', 'large', 'xl', '2xl'];
    if (sizes[val]) {
      onUpdate({ fontSize: sizes[val] });
    }
  };

  const getSliderValue = () => {
    const sizes: FontSize[] = ['xs', 'small', 'medium', 'large', 'xl', '2xl'];
    return sizes.indexOf(settings.fontSize);
  };

  return (
    <div className="relative" ref={toolbarRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-lg p-2 transition-colors ${isOpen ? 'bg-gray-800 text-gray-200' : 'text-gray-400 hover:bg-gray-800'}`}
        title="Appearance Settings"
      >
        <span className="font-serif text-xl">Aa</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 flex w-64 flex-col gap-4 rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-xl">
          {/* Font Family */}
          <div className="flex rounded-lg bg-gray-900 p-1">
            {(['sans', 'serif', 'mono'] as FontFamily[]).map((font) => (
              <button
                key={font}
                onClick={() => onUpdate({ fontFamily: font })}
                className={`flex-1 rounded-md py-1 text-sm capitalize transition-colors ${
                  settings.fontFamily === font
                    ? 'bg-gray-700 font-medium text-blue-400 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {font}
              </button>
            ))}
          </div>

          {/* Font Size */}
          <div className="flex flex-col gap-2 px-2">
            <div className="flex justify-between text-xs font-medium tracking-wider text-gray-400 uppercase">
              <span>Size</span>
              <span>{getSliderValue() * 20 + 60}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500">A</span>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={getSliderValue()}
                onChange={handleFontSizeChange}
                className="h-1 flex-grow cursor-pointer appearance-none rounded-lg bg-gray-600 accent-blue-500"
              />
              <span className="text-xl font-bold text-gray-500">A</span>
            </div>
          </div>

          {/* Theme */}
          <div className="flex gap-2">
            <button
              onClick={() => onUpdate({ theme: 'light' })}
              className={`h-8 flex-1 rounded-full border ${settings.theme === 'light' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-600'} bg-white`}
              title="Light"
            />
            <button
              onClick={() => onUpdate({ theme: 'sepia' })}
              className={`h-8 flex-1 rounded-full border ${settings.theme === 'sepia' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-[#e3dccb]'} bg-[#f4ecd8]`}
              title="Sepia"
            />
            <button
              onClick={() => onUpdate({ theme: 'dark' })}
              className={`h-8 flex-1 rounded-full border ${settings.theme === 'dark' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-600'} bg-gray-900`}
              title="Dark"
            />
          </div>
        </div>
      )}
    </div>
  );
};
