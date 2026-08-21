'use client';

import { ShareLinkDialog } from '../ui/ShareLinkDialog';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  boardId: string;
  shareId?: string;
  onShareIdChange: (shareId: string | undefined) => void;
}

export function ShareDialog({
  open,
  onClose,
  boardId,
  shareId,
  onShareIdChange,
}: ShareDialogProps) {
  return (
    <ShareLinkDialog
      open={open}
      onClose={onClose}
      config={{
        apiPath: `/api/boards/${boardId}`,
        sharePathPrefix: '',
        entityLabel: 'Board',
      }}
      shareId={shareId}
      onShareIdChange={onShareIdChange}
    />
  );
}
