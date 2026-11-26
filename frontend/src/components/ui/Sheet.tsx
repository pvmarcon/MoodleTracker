import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';

/** Bottom sheet: thumb-friendly modal for mobile, centered card on desktop. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-md animate-slide-up flex-col rounded-t-3xl border border-line bg-surface pb-safe sm:rounded-3xl sm:pb-0">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" />
        {title && (
          <div className="flex items-center justify-between px-5 pb-1 pt-3">
            <h3 className="text-[17px] font-semibold">{title}</h3>
            <IconButton label="Fechar" onClick={onClose} className="-mr-2">
              <X size={20} />
            </IconButton>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
