'use client';

import { useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const { updateEdgeData } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  const edgeData = (data ?? {}) as { label?: string; style?: 'solid' | 'dashed' };
  const isDashed = edgeData.style === 'dashed';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateEdgeData(id, { label: e.target.value });
    },
    [id, updateEdgeData]
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#3b82f6' : '#4b5563',
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: isDashed ? '6 3' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          {isEditing ? (
            <input
              type="text"
              autoFocus
              value={edgeData.label || ''}
              onChange={handleLabelChange}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditing(false);
              }}
              className="w-24 rounded border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-center text-[10px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <button
              onDoubleClick={() => setIsEditing(true)}
              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                edgeData.label
                  ? 'bg-gray-800/90 text-gray-300 hover:bg-gray-700'
                  : 'text-transparent hover:bg-gray-800/60 hover:text-gray-500'
              }`}
            >
              {edgeData.label || 'label'}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
