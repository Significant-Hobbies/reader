'use client';

import { ShareLinkDialog } from '../ui/ShareLinkDialog';

interface ArticleShareDialogProps {
  open: boolean;
  onClose: () => void;
  articleId: string;
  shareId?: string;
  onShareIdChange: (shareId: string | undefined) => void;
}

export function ArticleShareDialog({
  open,
  onClose,
  articleId,
  shareId,
  onShareIdChange,
}: ArticleShareDialogProps) {
  return (
    <ShareLinkDialog
      open={open}
      onClose={onClose}
      apiPath={`/api/articles/${articleId}`}
      sharePathPrefix="article/"
      entityLabel="Article"
      shareId={shareId}
      onShareIdChange={onShareIdChange}
    />
  );
}
