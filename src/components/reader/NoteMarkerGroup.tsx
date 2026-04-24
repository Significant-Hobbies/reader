'use client';

import { memo, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Note } from '../../types';

interface NoteMarkerGroupProps {
  anchorElement: HTMLElement;
  notes: { note: Note; index: number }[];
  onScrollTo: (note: Note) => void;
  registerMarker: (noteId: number, el: HTMLElement | null) => void;
  onStartDrag: (note: Note, displayIndex: number) => (event: React.MouseEvent) => void;
  ignoreClicksRef: React.MutableRefObject<boolean>;
  onShowTooltip: (text: string, e: React.MouseEvent) => void;
  onHideTooltip: () => void;
  onMoveTooltip: (e: MouseEvent) => void;
}

function NoteMarkerGroup({
  anchorElement,
  notes,
  onScrollTo,
  registerMarker,
  onStartDrag,
  ignoreClicksRef,
  onShowTooltip,
  onHideTooltip,
  onMoveTooltip,
}: NoteMarkerGroupProps) {
  const tagName = anchorElement.tagName.toLowerCase();
  const isMedia = ['img', 'video', 'iframe'].includes(tagName);
  const portalTarget = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const mount = document.createElement('span');
    mount.className = 'annotation-mount';
    return mount;
  }, []);

  useEffect(() => {
    if (!portalTarget) return;

    const host = anchorElement.parentElement ?? anchorElement;
    host.classList.add('annotation-host');

    if (isMedia) {
      const referenceNode = anchorElement;
      const parentNode = referenceNode.parentElement ?? host;
      parentNode.insertBefore(portalTarget, referenceNode);
    } else {
      anchorElement.classList.add('annotation-host');
      anchorElement.appendChild(portalTarget);
    }

    return () => {
      if (portalTarget.parentNode) {
        portalTarget.parentNode.removeChild(portalTarget);
      }
    };
  }, [anchorElement, isMedia, portalTarget]);

  if (!portalTarget) return null;

  return createPortal(
    <div className={`annotation-marker-group ${isMedia ? 'annotation-marker-group-media' : ''}`}>
      {notes.map(({ note, index }) => (
        <button
          key={note.id}
          className="annotation-marker"
          ref={(el) => registerMarker(note.id, el)}
          onMouseDown={onStartDrag(note, index)}
          onMouseEnter={(e) =>
            onShowTooltip(note.text?.trim() || note.anchor?.textPreview || `Note ${index + 1}`, e)
          }
          onMouseMove={(e) => onMoveTooltip(e.nativeEvent)}
          onMouseLeave={onHideTooltip}
          onClick={(e) => {
            e.stopPropagation();
            if (ignoreClicksRef.current) return;
            onScrollTo(note);
          }}
          title={`Note ${index + 1}`}
        >
          {index + 1}
        </button>
      ))}
    </div>,
    portalTarget
  );
}

export const NoteMarkerGroupMemo = memo(NoteMarkerGroup, (prev, next) => {
  if (prev.anchorElement !== next.anchorElement) return false;
  if (prev.notes.length !== next.notes.length) return false;
  for (let i = 0; i < prev.notes.length; i++) {
    const a = prev.notes[i].note;
    const b = next.notes[i].note;
    if (a.id !== b.id) return false;
    if (a.text !== b.text) return false;
    if (a.anchor?.elementIndex !== b.anchor?.elementIndex) return false;
    if (a.anchor?.textPreview !== b.anchor?.textPreview) return false;
  }
  return true;
});
