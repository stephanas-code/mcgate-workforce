import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', 'max-w-3xl', 'max-w-4xl'
  className?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  zIndex?: string; // e.g. 'z-50', 'z-60'
  overlayClassName?: string;
}

/**
 * Universal Modal wrapper component for McGate Workforce.
 * Uses createPortal to mount directly to document.body, ensuring it is immune to
 * parent transforms, overflow constraints, or backdrop-filter containing blocks.
 * Provides viewport-centered positioning, body scroll locking, escape key dismissal,
 * and backdrop click handling.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-xl',
  className = '',
  closeOnEscape = true,
  closeOnBackdropClick = true,
  zIndex = 'z-50',
  overlayClassName = ''
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Save previous overflow style and lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Keyboard ESC listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 ${zIndex} flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto transition-all ${overlayClassName}`}
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        className={`w-full ${maxWidth} my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
