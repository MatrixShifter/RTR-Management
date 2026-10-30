import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import type { BusinessRecord } from '../services/db.js';

export interface RecordActionsMenuProps {
  record: BusinessRecord;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onView?: (record: BusinessRecord) => void;
  onViewDetails?: (record: BusinessRecord) => void;
  onEdit: (record: BusinessRecord) => void;
  onDelete: (record: BusinessRecord) => void;
  /** @deprecated Payment recording has been removed from the records context menu */
  onSettlePayment?: (record: BusinessRecord) => void;
  /** @deprecated Payment recording has been removed from the records context menu */
  onRecordPayment?: (record: BusinessRecord) => void;
}

export const RecordActionsMenu: React.FC<RecordActionsMenuProps> = ({
  record,
  anchorRect,
  onClose,
  onView,
  onViewDetails,
  onEdit,
  onDelete
}) => {
  const handleView = onViewDetails || onView;
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; openUpward: boolean }>({
    top: 0,
    left: 0,
    openUpward: false
  });

  // Calculate collision-aware floating coordinates
  useEffect(() => {
    if (!anchorRect) return;

    const menuWidth = 175;
    const menuHeight = 118;
    const padding = 8;

    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;
    const openUpward = spaceBelow < menuHeight + padding && spaceAbove > menuHeight + padding;

    const top = openUpward
      ? Math.max(padding, anchorRect.top - menuHeight - 4)
      : Math.min(window.innerHeight - menuHeight - padding, anchorRect.bottom + 4);

    let left = anchorRect.right - menuWidth;
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    setCoords({ top, left, openUpward });
  }, [anchorRect]);

  // Close handlers on outside click, Escape key, scroll, resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScrollOrResize = () => {
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [onClose]);

  // Focus the menu container on open for keyboard accessibility
  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  if (!anchorRect) return null;

  const content = (
    <div
      ref={menuRef}
      tabIndex={-1}
      role="menu"
      aria-label={`Actions for record ${record.shopName}`}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: '175px',
        zIndex: 9999
      }}
      className={`bg-white rounded-xl shadow-xl border border-[#D8E7F7] py-1.5 text-left text-xs font-medium text-[#102A4C] animate-fade-in outline-none select-none transition-transform ${
        coords.openUpward ? 'origin-bottom-right' : 'origin-top-right'
      }`}
    >
      {/* 1. View Record Details */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          if (handleView) handleView(record);
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#F4F9FF] text-[#102A4C] transition-colors cursor-pointer text-left focus:bg-[#F4F9FF] focus:outline-none"
      >
        <Eye className="w-3.5 h-3.5 text-[#637A98] flex-shrink-0" />
        <span>View Details</span>
      </button>

      {/* 2. Edit Record */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onEdit(record);
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#F4F9FF] text-[#102A4C] transition-colors cursor-pointer text-left focus:bg-[#F4F9FF] focus:outline-none"
      >
        <Edit2 className="w-3.5 h-3.5 text-[#168BFF] flex-shrink-0" />
        <span>Edit Record</span>
      </button>

      <div className="border-t border-[#EAF2FA] my-1" />

      {/* 3. Delete Record */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onDelete(record);
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer text-left focus:bg-rose-50 focus:outline-none"
      >
        <Trash2 className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
        <span>Delete Record</span>
      </button>
    </div>
  );

  // Use Portal to escape all table overflow clipping
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
};
