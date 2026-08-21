import { useEffect, useRef, useState } from 'react';

import type { FontFamily, FontSize, ReaderSettings } from '../types';

const FONT_SIZES: FontSize[] = ['xs', 'small', 'medium', 'large', 'xl', '2xl'];

function FontFamilySelector({
  current,
  onSelect,
}: {
  current: FontFamily;
  onSelect: (font: FontFamily) => void;
}) {
  return (
    <div className="flex rounded-md bg-[var(--gray-3)] p-1">
      {(['sans', 'serif', 'mono'] as FontFamily[]).map((font) => (
        <button
          type="button"
          key={font}
          onClick={() => onSelect(font)}
          className={`flex-1 rounded-md py-1 text-sm capitalize transition-colors ${
            current === font
              ? 'bg-[var(--accent-4)] font-medium text-[var(--accent-11)] shadow-sm'
              : 'text-[var(--gray-10)] hover:text-[var(--gray-12)]'
          }`}
        >
          {font}
        </button>
      ))}
    </div>
  );
}

function FontSizeSelector({
  current,
  onChange,
}: {
  current: FontSize;
  onChange: (size: FontSize) => void;
}) {
  const sliderValue = FONT_SIZES.indexOf(current);
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (FONT_SIZES[val]) onChange(FONT_SIZES[val]);
  };
  return (
    <div className="flex flex-col gap-2 px-2">
      <div className="flex justify-between text-xs font-medium tracking-wider text-[var(--gray-10)] uppercase">
        <span>Size</span>
        <span>{sliderValue * 20 + 60}%</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[var(--gray-9)]">A</span>
        <input
          type="range"
          min="0"
          max="5"
          step="1"
          value={sliderValue}
          onChange={handleSliderChange}
          className="h-1 flex-grow cursor-pointer appearance-none rounded-sm bg-[var(--gray-6)] accent-[var(--accent-9)]"
        />
        <span className="text-xl font-bold text-[var(--gray-9)]">A</span>
      </div>
    </div>
  );
}

function ThemeSelector({
  current,
  onSelect,
}: {
  current: ReaderSettings['theme'];
  onSelect: (theme: ReaderSettings['theme']) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onSelect('light')}
        className={`h-8 flex-1 rounded-md border ${current === 'light' ? 'border-[var(--accent-9)] ring-1 ring-[var(--accent-9)]' : 'border-[var(--gray-6)]'} bg-white`}
        title="Light"
      />
      <button
        onClick={() => onSelect('sepia')}
        className={`h-8 flex-1 rounded-md border ${current === 'sepia' ? 'border-[var(--accent-9)] ring-1 ring-[var(--accent-9)]' : 'border-[#e3dccb]'} bg-[#f4ecd8]`}
        title="Sepia"
      />
      <button
        onClick={() => onSelect('dark')}
        className={`h-8 flex-1 rounded-md border ${current === 'dark' ? 'border-[var(--accent-9)] ring-1 ring-[var(--accent-9)]' : 'border-[var(--gray-6)]'} bg-[var(--gray-1)]`}
        title="Dark"
      />
    </div>
  );
}

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

  return (
    <div className="relative" ref={toolbarRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-md p-2 transition-colors ${
          isOpen
            ? 'bg-[var(--gray-4)] text-[var(--gray-12)]'
            : 'text-[var(--gray-10)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]'
        }`}
        title="Appearance Settings"
      >
        <span className="font-serif text-xl">Aa</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 flex w-64 flex-col gap-4 rounded-lg border border-[var(--gray-6)] bg-[var(--gray-2)] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
          <FontFamilySelector
            current={settings.fontFamily}
            onSelect={(font) => onUpdate({ fontFamily: font })}
          />
          <FontSizeSelector
            current={settings.fontSize}
            onChange={(size) => onUpdate({ fontSize: size })}
          />
          <ThemeSelector current={settings.theme} onSelect={(theme) => onUpdate({ theme })} />
        </div>
      )}
    </div>
  );
};
