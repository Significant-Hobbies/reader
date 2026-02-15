'use client';

import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';

const NOTE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  yellow: { bg: 'bg-yellow-300/90', border: 'border-yellow-400', text: 'text-yellow-950' },
  blue: { bg: 'bg-blue-300/90', border: 'border-blue-400', text: 'text-blue-950' },
  green: { bg: 'bg-green-300/90', border: 'border-green-400', text: 'text-green-950' },
  pink: { bg: 'bg-pink-300/90', border: 'border-pink-400', text: 'text-pink-950' },
  purple: { bg: 'bg-purple-300/90', border: 'border-purple-400', text: 'text-purple-950' },
  orange: { bg: 'bg-orange-300/90', border: 'border-orange-400', text: 'text-orange-950' },
};

const COLOR_KEYS = Object.keys(NOTE_COLORS);

type NoteData = {
  text: string;
  color: string;
};

function NoteNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as NoteData;
  const { updateNodeData } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  const colorKey = NOTE_COLORS[nodeData.color] ? nodeData.color : 'yellow';
  const colors = NOTE_COLORS[colorKey];

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleColorChange = useCallback(
    (newColor: string) => {
      updateNodeData(id, { color: newColor });
    },
    [id, updateNodeData]
  );

  return (
    <div
      className={`w-52 rounded-lg border-2 shadow-lg ${colors.bg} ${colors.border} ${
        selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-950' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-2 !h-2" />

      {selected && (
        <div className="flex gap-0.5 border-b border-black/10 px-2 py-1">
          {COLOR_KEYS.map((c) => (
            <button
              key={c}
              onClick={() => handleColorChange(c)}
              className={`h-4 w-4 rounded-full border ${
                c === colorKey ? 'border-gray-800 ring-1 ring-gray-800' : 'border-transparent'
              }`}
              style={{
                backgroundColor:
                  c === 'yellow'
                    ? '#fde047'
                    : c === 'blue'
                      ? '#93c5fd'
                      : c === 'green'
                        ? '#86efac'
                        : c === 'pink'
                          ? '#f9a8d4'
                          : c === 'purple'
                            ? '#c4b5fd'
                            : '#fdba74',
              }}
            />
          ))}
        </div>
      )}

      <div className="p-3">
        {isEditing ? (
          <textarea
            value={nodeData.text}
            onChange={handleTextChange}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className={`w-full resize-none bg-transparent text-sm ${colors.text} placeholder:text-black/30 focus:outline-none`}
            placeholder="Type your note..."
            rows={4}
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            className={`min-h-[4rem] cursor-text whitespace-pre-wrap text-sm ${colors.text} ${
              !nodeData.text ? 'opacity-40 italic' : ''
            }`}
          >
            {nodeData.text || 'Double-click to edit'}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-2 !h-2" />
    </div>
  );
}

export const NoteNode = memo(NoteNodeComponent);
