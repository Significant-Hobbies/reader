import { Sparkles } from 'lucide-react';

interface QuickActionsProps {
  onAction: (prompt: string) => void;
  disabled: boolean;
}

const QUICK_PROMPTS = [
  { label: 'Summarize', prompt: 'Summarize this page concisely.' },
  { label: 'Key takeaways', prompt: 'What are the key takeaways from this page?' },
  { label: 'ELI5', prompt: "Explain this page like I'm 5 years old." },
  {
    label: 'Find claims',
    prompt: 'Find claims in this page that need citations or fact-checking.',
  },
];

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_PROMPTS.map((qp) => (
        <button
          key={qp.label}
          type="button"
          onClick={() => onAction(qp.prompt)}
          disabled={disabled}
          className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900/60 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:border-blue-500/50 hover:bg-gray-800 hover:text-gray-100 disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3 text-blue-400" />
          {qp.label}
        </button>
      ))}
    </div>
  );
}
