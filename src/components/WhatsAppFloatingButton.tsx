import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import {
  buildWhatsAppSupportUrl,
  WHATSAPP_SUPPORT_NUMBER_DISPLAY,
} from '../utils/storeLogic';

export function WhatsAppFloatingButton() {
  const currentView = useCartStore((state) => state.currentView);
  const activeCategory = useCartStore((state) => state.activeCategory);
  const selectedProductId = useCartStore((state) => state.selectedProductId);
  const catalog = useCartStore((state) => state.catalog);

  const activeProduct = catalog.find((p) => p.id === selectedProductId) || null;

  const whatsappUrl = buildWhatsAppSupportUrl({
    currentView,
    productTitle: activeProduct?.title || null,
    activeCategory,
  });

  return (
    <div
      data-testid="whatsapp-fab-container"
      className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6"
    >
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="whatsapp-floating-btn"
        aria-label={`Initiate WhatsApp conversation with Vape Dubai King support at ${WHATSAPP_SUPPORT_NUMBER_DISPLAY}`}
        className="group flex items-center gap-2.5 border border-emerald-500 bg-zinc-950 px-3.5 py-2.5 sm:px-4 sm:py-3 text-white shadow-2xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-950"
      >
        <span className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center bg-emerald-500 text-zinc-950 transition-transform group-hover:scale-105">
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 border border-zinc-950" />
          </span>
          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 fill-zinc-950 text-zinc-950" />
        </span>

        <div className="text-left leading-tight">
          <span className="block text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
            WhatsApp Live Support
          </span>
          <span
            data-testid="whatsapp-floating-number"
            className="font-mono-num block text-xs sm:text-sm font-bold text-white whitespace-nowrap"
          >
            {WHATSAPP_SUPPORT_NUMBER_DISPLAY}
          </span>
        </div>
      </a>
    </div>
  );
}
