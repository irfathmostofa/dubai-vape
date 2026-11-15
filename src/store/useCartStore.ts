import { create } from 'zustand';
import {
  AuthenticatedUser,
  CartItem,
  CustomerOrder,
  EmailLogRecord,
  OrderStatusStage,
  Product,
  ProductCategory,
  SelectedVariant,
} from '../types/store';
import { MOCK_PRODUCTS } from '../data/products';
import {
  addOrIncrementCartItem,
  removeCartItem,
  updateCartItemQuantity,
  RECENTLY_VIEWED_SESSION_KEY,
  recordRecentlyViewedId,
  WISHLIST_STORAGE_KEY,
  toggleWishlistId,
  buildOrderTimeline,
  ADMIN_AUTH_SESSION_KEY,
  resolveInitialViewFromPathname,
  getPathnameForView,
  verifyAdminCredentials,
} from '../utils/storeLogic';

function syncBrowserUrlForView(view: 'home' | 'category' | 'product' | 'admin'): void {
  if (typeof window === 'undefined') return;
  try {
    const targetPath = getPathnameForView(view);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view }, '', `${targetPath}${window.location.search || ''}`);
    }
  } catch {
    // ignore history API errors in restricted environments
  }
}

function loadInitialAdminSession(): {
  isAdminAuthenticated: boolean;
  adminUser: AuthenticatedUser | null;
  token: string | null;
} {
  if (typeof window === 'undefined') {
    return { isAdminAuthenticated: false, adminUser: null, token: null };
  }
  try {
    const raw = window.sessionStorage.getItem(ADMIN_AUTH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isAdminAuthenticated && parsed.user?.role === 'admin') {
        return {
          isAdminAuthenticated: true,
          adminUser: parsed.user,
          token: parsed.token || null,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { isAdminAuthenticated: false, adminUser: null, token: null };
}

function saveAdminSessionToStorage(
  isAdminAuthenticated: boolean,
  user: AuthenticatedUser | null,
  token: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    if (!isAdminAuthenticated || !user) {
      window.sessionStorage.removeItem(ADMIN_AUTH_SESSION_KEY);
    } else {
      window.sessionStorage.setItem(
        ADMIN_AUTH_SESSION_KEY,
        JSON.stringify({ isAdminAuthenticated: true, user, token })
      );
    }
  } catch {
    // ignore storage errors
  }
}

function loadInitialRecentlyViewed(): string[] {
  if (typeof window === 'undefined') {
    return [MOCK_PRODUCTS[0].id, MOCK_PRODUCTS[1].id, MOCK_PRODUCTS[2].id];
  }
  try {
    const raw = window.sessionStorage.getItem(RECENTLY_VIEWED_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((id): id is string => typeof id === 'string');
      }
    }
  } catch {
    // fallback if sessionStorage is restricted
  }
  const initialSeed = [MOCK_PRODUCTS[0].id, MOCK_PRODUCTS[1].id, MOCK_PRODUCTS[2].id];
  try {
    window.sessionStorage.setItem(RECENTLY_VIEWED_SESSION_KEY, JSON.stringify(initialSeed));
  } catch {
    // ignore storage errors
  }
  return initialSeed;
}

function saveRecentlyViewedToSession(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RECENTLY_VIEWED_SESSION_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage quota errors
  }
}

function loadInitialWishlist(): string[] {
  if (typeof window === 'undefined') {
    return [MOCK_PRODUCTS[1].id];
  }
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string');
      }
    }
  } catch {
    // fallback if localStorage is restricted
  }
  const initialSeed = [MOCK_PRODUCTS[1].id];
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(initialSeed));
  } catch {
    // ignore storage errors
  }
  return initialSeed;
}

function saveWishlistToStorage(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage quota errors
  }
}

const INITIAL_SAMPLE_ORDER: CustomerOrder = {
  orderId: 'VDK-892410',
  fullName: 'Tariq Al Maktoum',
  email: 'tariq.almaktoum@dubai.ae',
  phone: '+971 50 842 9910',
  emirate: 'Dubai',
  address: 'Boulevard Point Tower, Apt 3402, Downtown Dubai',
  paymentMethod: 'Cash on Delivery',
  items: [
    {
      product: MOCK_PRODUCTS[0],
      quantity: 2,
      selectedVariant: {
        flavor: MOCK_PRODUCTS[0].variants.flavors[0],
        nicotine: MOCK_PRODUCTS[0].variants.nicotineOptions[0],
        packId: 'single',
        packLabel: 'Single Unit (1x)',
        unitPrice: MOCK_PRODUCTS[0].price,
      },
    },
    {
      product: MOCK_PRODUCTS[1],
      quantity: 1,
      selectedVariant: {
        flavor: MOCK_PRODUCTS[1].variants.flavors[0],
        nicotine: MOCK_PRODUCTS[1].variants.nicotineOptions[0],
        packId: 'single',
        packLabel: 'Single Unit (1x)',
        unitPrice: MOCK_PRODUCTS[1].price,
      },
    },
  ],
  subtotal: 145,
  shippingFee: 25,
  total: 170,
  createdAt: '14:10 GST',
  status: 'packed_al_quoz',
  courierName: 'Rashid Al-Mansoor · Dubai Express Bike #14',
  estimatedArrival: '35 mins (Sheikh Zayed Rd Route)',
  timeline: buildOrderTimeline('packed_al_quoz'),
};

const INITIAL_EMAIL_LOGS: EmailLogRecord[] = [
  {
    id: 'em-101',
    orderNumber: 'VDK-892410',
    recipientEmail: 'tariq.almaktoum@dubai.ae',
    subject: 'Vape Dubai King — Order #VDK-892410 Dispatched from Al Quoz Hub',
    emailType: 'status_update',
    provider: 'resend',
    resendMessageId: 're_dubai_dispatch_892410',
    deliveryStatus: 'sent',
    createdAt: '14:35 GST',
  },
];

export type StoreView = 'home' | 'category' | 'product' | 'admin';

interface CartStoreState {
  catalog: Product[];
  items: CartItem[];
  isCartOpen: boolean;
  wishlistIds: string[];
  isWishlistOpen: boolean;
  currentView: StoreView;
  selectedProductId: string;
  activeCategory: 'All' | ProductCategory;
  selectedBrand: string | null;
  nicotineFilter: string | null;
  onlyOffers: boolean;
  searchQuery: string;
  sortBy: 'featured' | 'price-asc' | 'price-desc';
  quickViewProduct: Product | null;
  lastOrder: CustomerOrder | null;
  recentOrders: CustomerOrder[];
  emailLogs: EmailLogRecord[];
  currentUser: AuthenticatedUser | null;
  authToken: string | null;
  isAdminAuthenticated: boolean;
  recentlyAddedId: string | null;
  recentlyViewedIds: string[];

  // Cart Actions
  addItem: (product: Product, quantity?: number, selectedVariant?: SelectedVariant) => void;
  updateQuantity: (itemKeyOrProductId: string, delta: number) => void;
  removeItem: (itemKeyOrProductId: string) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;

  // Wishlist Actions
  toggleWishlist: (productId: string) => void;
  removeWishlistItem: (productId: string) => void;
  clearWishlist: () => void;
  setWishlistOpen: (open: boolean) => void;
  moveWishlistItemToCart: (product: Product) => void;

  // View Routing Actions
  navigateToHome: () => void;
  navigateToCategory: (
    category: 'All' | ProductCategory,
    options?: { brand?: string | null; search?: string; nicotine?: string | null; onlyOffers?: boolean }
  ) => void;
  navigateToProduct: (productId: string) => void;
  navigateToAdmin: () => void;
  syncViewFromLocation: () => void;

  // Filter Actions
  setActiveCategory: (category: 'All' | ProductCategory) => void;
  setSelectedBrand: (brand: string | null) => void;
  setNicotineFilter: (nicotine: string | null) => void;
  setOnlyOffers: (onlyOffers: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: 'featured' | 'price-asc' | 'price-desc') => void;
  resetAllFilters: () => void;
  setQuickViewProduct: (product: Product | null) => void;

  // Auth Actions (In-memory token storage + /admin session verification)
  setAuthSession: (user: AuthenticatedUser | null, token: string | null) => void;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => void;

  // Recently Viewed Actions (session-storage backed)
  trackProductClick: (productId: string) => void;
  clearRecentlyViewed: () => void;

  // Checkout & Order Status Actions
  placeOrder: (
    orderData: Omit<
      CustomerOrder,
      'orderId' | 'createdAt' | 'status' | 'courierName' | 'estimatedArrival' | 'timeline'
    >
  ) => CustomerOrder;
  updateOrderStatus: (
    orderId: string,
    nextStatus: OrderStatusStage,
    courierName?: string,
    estimatedArrival?: string
  ) => void;
  clearLastOrder: () => void;

  // Admin & Backend Sync Actions
  bootstrapFromBackend: () => Promise<void>;
  adminUpsertProduct: (product: Product) => Promise<void>;
  adminDeleteProduct: (productId: string) => Promise<void>;
  adminSendResendEmail: (payload: {
    orderNumber: string;
    recipientEmail: string;
    customerName: string;
    statusLabel: string;
    totalAed: string;
    emirate: string;
  }) => Promise<void>;
  subscribeNewsletterLead: (payload: {
    email: string;
    name?: string;
    discountCode?: string;
  }) => Promise<{ discountCode: string }>;
}

const initialAdminSession = loadInitialAdminSession();

export const useCartStore = create<CartStoreState>((set, get) => ({
  catalog: [...MOCK_PRODUCTS],
  items: [
    {
      product: MOCK_PRODUCTS[0],
      quantity: 1,
      selectedVariant: {
        flavor: MOCK_PRODUCTS[0].variants.flavors[0],
        nicotine: MOCK_PRODUCTS[0].variants.nicotineOptions[0],
        packId: 'single',
        packLabel: 'Single Unit (1x)',
        unitPrice: MOCK_PRODUCTS[0].price,
      },
      cartItemId: `${MOCK_PRODUCTS[0].id}__${MOCK_PRODUCTS[0].variants.flavors[0]}__${MOCK_PRODUCTS[0].variants.nicotineOptions[0]}__single`,
    },
  ],
  isCartOpen: false,
  wishlistIds: loadInitialWishlist(),
  isWishlistOpen: false,
  currentView:
    typeof window !== 'undefined'
      ? resolveInitialViewFromPathname(window.location.pathname)
      : 'home',
  selectedProductId: MOCK_PRODUCTS[0].id,
  activeCategory: 'All',
  selectedBrand: null,
  nicotineFilter: null,
  onlyOffers: false,
  searchQuery: '',
  sortBy: 'featured',
  quickViewProduct: null,
  lastOrder: null,
  recentOrders: [INITIAL_SAMPLE_ORDER],
  emailLogs: INITIAL_EMAIL_LOGS,
  currentUser: initialAdminSession.adminUser,
  authToken: initialAdminSession.token,
  isAdminAuthenticated: initialAdminSession.isAdminAuthenticated,
  recentlyAddedId: null,
  recentlyViewedIds: loadInitialRecentlyViewed(),

  addItem: (product, quantity = 1, selectedVariant) =>
    set((state) => {
      const nextViewed = recordRecentlyViewedId(state.recentlyViewedIds, product.id);
      saveRecentlyViewedToSession(nextViewed);
      const variantToUse: SelectedVariant = selectedVariant || {
        flavor: product.variants.flavors[0] || product.flavorProfile,
        nicotine: product.variants.nicotineOptions[0] || product.nicotineStrength,
        packId: 'single',
        packLabel: 'Single Unit (1x)',
        unitPrice: product.price,
      };
      return {
        items: addOrIncrementCartItem(state.items, product, quantity, variantToUse),
        recentlyAddedId: product.id,
        recentlyViewedIds: nextViewed,
      };
    }),

  updateQuantity: (itemKeyOrProductId, delta) =>
    set((state) => ({
      items: updateCartItemQuantity(state.items, itemKeyOrProductId, delta),
    })),

  removeItem: (itemKeyOrProductId) =>
    set((state) => ({
      items: removeCartItem(state.items, itemKeyOrProductId),
    })),

  clearCart: () => set({ items: [] }),

  setCartOpen: (open) => set({ isCartOpen: open }),

  toggleWishlist: (productId) =>
    set((state) => {
      const nextWishlist = toggleWishlistId(state.wishlistIds, productId);
      saveWishlistToStorage(nextWishlist);
      return { wishlistIds: nextWishlist };
    }),

  removeWishlistItem: (productId) =>
    set((state) => {
      const nextWishlist = state.wishlistIds.filter((id) => id !== productId);
      saveWishlistToStorage(nextWishlist);
      return { wishlistIds: nextWishlist };
    }),

  clearWishlist: () => {
    saveWishlistToStorage([]);
    set({ wishlistIds: [] });
  },

  setWishlistOpen: (open) => set({ isWishlistOpen: open }),

  moveWishlistItemToCart: (product) =>
    set((state) => {
      const variantToUse: SelectedVariant = {
        flavor: product.variants.flavors[0] || product.flavorProfile,
        nicotine: product.variants.nicotineOptions[0] || product.nicotineStrength,
        packId: 'single',
        packLabel: 'Single Unit (1x)',
        unitPrice: product.price,
      };
      const nextWishlist = state.wishlistIds.filter((id) => id !== product.id);
      saveWishlistToStorage(nextWishlist);
      return {
        items: addOrIncrementCartItem(state.items, product, 1, variantToUse),
        wishlistIds: nextWishlist,
      };
    }),

  navigateToHome: () => {
    syncBrowserUrlForView('home');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    set({
      currentView: 'home',
    });
  },

  navigateToCategory: (category, options) => {
    syncBrowserUrlForView('category');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    set({
      currentView: 'category',
      activeCategory: category,
      selectedBrand: options?.brand !== undefined ? options.brand : null,
      searchQuery: options?.search !== undefined ? options.search : '',
      nicotineFilter: options?.nicotine !== undefined ? options.nicotine : null,
      onlyOffers: options?.onlyOffers !== undefined ? options.onlyOffers : category === 'Offers',
    });
  },

  navigateToProduct: (productId) =>
    set((state) => {
      syncBrowserUrlForView('product');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const nextViewed = recordRecentlyViewedId(state.recentlyViewedIds, productId);
      saveRecentlyViewedToSession(nextViewed);
      return {
        currentView: 'product',
        selectedProductId: productId,
        recentlyViewedIds: nextViewed,
        quickViewProduct: null,
      };
    }),

  navigateToAdmin: () => {
    syncBrowserUrlForView('admin');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    set({ currentView: 'admin' });
  },

  syncViewFromLocation: () => {
    if (typeof window === 'undefined') return;
    const resolved = resolveInitialViewFromPathname(window.location.pathname);
    set((state) => {
      if (resolved === 'admin' && state.currentView !== 'admin') {
        return { currentView: 'admin' };
      }
      if (resolved === 'home' && state.currentView === 'admin') {
        return { currentView: 'home' };
      }
      return state;
    });
  },

  setActiveCategory: (category) =>
    set({
      activeCategory: category,
      selectedBrand: null,
      onlyOffers: category === 'Offers',
    }),

  setSelectedBrand: (brand) => set({ selectedBrand: brand }),

  setNicotineFilter: (nicotine) => set({ nicotineFilter: nicotine }),

  setOnlyOffers: (onlyOffers) => set({ onlyOffers }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSortBy: (sort) => set({ sortBy: sort }),

  resetAllFilters: () =>
    set({
      activeCategory: 'All',
      selectedBrand: null,
      nicotineFilter: null,
      onlyOffers: false,
      searchQuery: '',
      sortBy: 'featured',
    }),

  setQuickViewProduct: (product) =>
    set((state) => {
      if (!product) {
        return { quickViewProduct: null };
      }
      const nextViewed = recordRecentlyViewedId(state.recentlyViewedIds, product.id);
      saveRecentlyViewedToSession(nextViewed);
      return {
        quickViewProduct: product,
        recentlyViewedIds: nextViewed,
      };
    }),

  setAuthSession: (user, token) =>
    set((state) => {
      const isAdmin = Boolean(user && user.role === 'admin' && state.currentView === 'admin');
      if (isAdmin && user) {
        saveAdminSessionToStorage(true, user, token);
      }
      return {
        currentUser: user,
        authToken: token,
        isAdminAuthenticated: isAdmin ? true : state.isAdminAuthenticated,
      };
    }),

  loginAdmin: async (email, password) => {
    const check = verifyAdminCredentials(email, password);
    if (!check.valid || !check.adminUser) {
      return {
        success: false,
        error: check.error || 'Invalid admin credentials.',
      };
    }

    let adminUser: AuthenticatedUser = check.adminUser;
    let token = `vdk_admin_tok_${Date.now()}`;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          adminUser = data.user;
        }
        if (data?.token) {
          token = data.token;
        }
      }
    } catch {
      // Local verified admin session remains active if offline
    }

    saveAdminSessionToStorage(true, adminUser, token);
    syncBrowserUrlForView('admin');
    set({
      isAdminAuthenticated: true,
      currentUser: adminUser,
      authToken: token,
      currentView: 'admin',
    });

    return { success: true };
  },

  logoutAdmin: () => {
    saveAdminSessionToStorage(false, null, null);
    set((state) => ({
      isAdminAuthenticated: false,
      currentUser: state.currentUser?.role === 'admin' ? null : state.currentUser,
      authToken: state.currentUser?.role === 'admin' ? null : state.authToken,
    }));
  },

  trackProductClick: (productId) =>
    set((state) => {
      const nextViewed = recordRecentlyViewedId(state.recentlyViewedIds, productId);
      saveRecentlyViewedToSession(nextViewed);
      return { recentlyViewedIds: nextViewed };
    }),

  clearRecentlyViewed: () => {
    saveRecentlyViewedToSession([]);
    set({ recentlyViewedIds: [] });
  },

  placeOrder: (orderData) => {
    const orderNumber = `VDK-${Math.floor(100000 + Math.random() * 900000)}`;
    const timeline = buildOrderTimeline('order_placed');
    const newOrder: CustomerOrder = {
      ...orderData,
      orderId: orderNumber,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'order_placed',
      courierName: 'Rashid Al-Mansoor · Dubai Express Bike #14',
      estimatedArrival: 'Within 90 mins (Same-Day UAE Dispatch)',
      timeline,
    };

    set((state) => ({
      items: [],
      lastOrder: newOrder,
      recentOrders: [newOrder, ...state.recentOrders],
    }));

    // Persist asynchronously to Cloud SQL PostgreSQL + trigger Resend email
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber,
        userUid: get().currentUser?.uid || null,
        customerName: orderData.fullName,
        customerEmail: orderData.email || get().currentUser?.email || 'customer@vapedubaiking.ae',
        customerPhone: orderData.phone,
        emirate: orderData.emirate,
        deliveryAddress: orderData.address,
        paymentMethod: orderData.paymentMethod,
        subtotalAed: orderData.subtotal,
        shippingFeeAed: orderData.shippingFee,
        totalAed: orderData.total,
        items: orderData.items.map((i) => ({
          productId: i.product.id,
          title: i.product.title,
          flavor: i.selectedVariant?.flavor || i.product.flavorProfile,
          nicotine: i.selectedVariant?.nicotine || i.product.nicotineStrength,
          packLabel: i.selectedVariant?.packLabel || 'Single Unit (1x)',
          quantity: i.quantity,
          unitPrice: i.selectedVariant?.unitPrice || i.product.price,
        })),
        timeline,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.emailLog) {
          set((s) => ({
            emailLogs: [
              {
                id: data.emailLog.id || `em-${Date.now()}`,
                orderNumber: data.emailLog.orderNumber,
                recipientEmail: data.emailLog.recipientEmail,
                subject: data.emailLog.subject,
                emailType: data.emailLog.emailType,
                provider: 'resend',
                resendMessageId: data.emailLog.resendMessageId,
                deliveryStatus: data.emailLog.deliveryStatus,
                createdAt: 'Just now',
              },
              ...s.emailLogs,
            ],
          }));
        }
      })
      .catch(() => {
        // Keep optimistic order state even if offline
      });

    return newOrder;
  },

  updateOrderStatus: (orderId, nextStatus, courierName, estimatedArrival) => {
    const nextTimeline = buildOrderTimeline(nextStatus);
    const activeStep = nextTimeline.find((t) => t.current);

    set((state) => ({
      recentOrders: state.recentOrders.map((ord) =>
        ord.orderId === orderId
          ? {
              ...ord,
              status: nextStatus,
              timeline: nextTimeline,
              ...(courierName ? { courierName } : {}),
              ...(estimatedArrival ? { estimatedArrival } : {}),
            }
          : ord
      ),
    }));

    fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: nextStatus,
        statusLabel: activeStep?.label || nextStatus,
        timeline: nextTimeline,
        courierName,
        estimatedArrival,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.emailLog) {
          set((s) => ({
            emailLogs: [
              {
                id: data.emailLog.id || `em-${Date.now()}`,
                orderNumber: data.emailLog.orderNumber,
                recipientEmail: data.emailLog.recipientEmail,
                subject: data.emailLog.subject,
                emailType: data.emailLog.emailType,
                provider: 'resend',
                resendMessageId: data.emailLog.resendMessageId,
                deliveryStatus: data.emailLog.deliveryStatus,
                createdAt: 'Just now',
              },
              ...s.emailLogs,
            ],
          }));
        }
      })
      .catch(() => {});
  },

  clearLastOrder: () => set({ lastOrder: null }),

  bootstrapFromBackend: async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.emailLogs) && data.emailLogs.length > 0) {
        set({
          emailLogs: data.emailLogs.map((log: any) => ({
            id: log.id,
            orderNumber: log.orderNumber,
            recipientEmail: log.recipientEmail,
            subject: log.subject,
            emailType: log.emailType,
            provider: log.provider || 'resend',
            resendMessageId: log.resendMessageId,
            deliveryStatus: log.deliveryStatus,
            createdAt: log.createdAt
              ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Today',
          })),
        });
      }
    } catch {
      // fallback to local initial state
    }
  },

  adminUpsertProduct: async (product) => {
    set((state) => {
      const exists = state.catalog.some((p) => p.id === product.id);
      const nextCatalog = exists
        ? state.catalog.map((p) => (p.id === product.id ? product : p))
        : [product, ...state.catalog];
      return { catalog: nextCatalog };
    });

    try {
      await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: product.id,
          title: product.title,
          brand: product.brand,
          category: product.category,
          priceAed: product.price,
          originalPriceAed: product.originalPrice ?? null,
          puffCount: product.puffCount || '10,000 Puffs',
          nicotineStrength: product.nicotineStrength,
          flavorProfile: product.flavorProfile,
          image: product.image,
          stockCount: product.stockCount ?? 45,
          inStock: product.inStock,
          isOffer: Boolean(product.isOffer),
          description: product.description,
          flavors: product.variants.flavors,
          nicotineOptions: product.variants.nicotineOptions,
          specs: product.specs,
        }),
      });
    } catch {
      // local catalog already updated
    }
  },

  adminDeleteProduct: async (productId) => {
    set((state) => ({
      catalog: state.catalog.filter((p) => p.id !== productId),
    }));

    try {
      await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      });
    } catch {
      // local catalog already updated
    }
  },

  adminSendResendEmail: async (payload) => {
    try {
      const res = await fetch('/api/admin/resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const newLog: EmailLogRecord = {
        id: data?.emailLog?.id || `em-${Date.now()}`,
        orderNumber: payload.orderNumber,
        recipientEmail: payload.recipientEmail,
        subject:
          data?.emailLog?.subject ||
          `Vape Dubai King — Order #${payload.orderNumber} Update: ${payload.statusLabel}`,
        emailType: 'admin_dispatch',
        provider: 'resend',
        resendMessageId: data?.emailLog?.resendMessageId || `sim_${Date.now()}`,
        deliveryStatus: data?.emailLog?.deliveryStatus || 'simulated_no_api_key',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      set((state) => ({
        emailLogs: [newLog, ...state.emailLogs],
      }));
    } catch {
      const fallbackLog: EmailLogRecord = {
        id: `em-${Date.now()}`,
        orderNumber: payload.orderNumber,
        recipientEmail: payload.recipientEmail,
        subject: `Vape Dubai King — Order #${payload.orderNumber} Update: ${payload.statusLabel}`,
        emailType: 'admin_dispatch',
        provider: 'resend',
        resendMessageId: `sim_${Date.now()}`,
        deliveryStatus: 'simulated_no_api_key',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      set((state) => ({
        emailLogs: [fallbackLog, ...state.emailLogs],
      }));
    }
  },

  subscribeNewsletterLead: async (payload) => {
    const discountCode = payload.discountCode || 'DUBAIKING15';
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          name: payload.name || 'UAE VIP Subscriber',
          discountCode,
        }),
      });
      const data = await res.json();
      const newLog: EmailLogRecord = {
        id: data?.emailLog?.id || `em-lead-${Date.now()}`,
        orderNumber: data?.emailLog?.orderNumber || `VIP-${discountCode}`,
        recipientEmail: payload.email,
        subject:
          data?.emailLog?.subject ||
          `Vape Dubai King VIP Club — Your 15% OFF Code (${discountCode}) Inside`,
        emailType: 'newsletter_welcome',
        provider: 'resend',
        resendMessageId: data?.emailLog?.resendMessageId || `sim_lead_${Date.now()}`,
        deliveryStatus: data?.emailLog?.deliveryStatus || 'simulated_no_api_key',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      set((state) => ({
        emailLogs: [newLog, ...state.emailLogs],
      }));
      return { discountCode };
    } catch {
      const fallbackLog: EmailLogRecord = {
        id: `em-lead-${Date.now()}`,
        orderNumber: `VIP-${discountCode}`,
        recipientEmail: payload.email,
        subject: `Vape Dubai King VIP Club — Your 15% OFF Code (${discountCode}) Inside`,
        emailType: 'newsletter_welcome',
        provider: 'resend',
        resendMessageId: `sim_lead_${Date.now()}`,
        deliveryStatus: 'simulated_no_api_key',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      set((state) => ({
        emailLogs: [fallbackLog, ...state.emailLogs],
      }));
      return { discountCode };
    }
  },
}));
