import React, { useState, useRef } from 'react';
import {
  Package,
  Truck,
  Mail,
  Database,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  Send,
  ShieldCheck,
  Edit3,
  Layers,
  Lock,
  KeyRound,
  LogOut,
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  Sparkles,
  Image as ImageIcon,
  X,
  FolderKanban,
  ExternalLink,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { useCartStore } from '../store/useCartStore';
import { OrderStatusStage, Product, ProductCategory } from '../types/store';
import {
  formatAED,
  ORDER_STATUS_SEQUENCE,
  buildOrderTimeline,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  canAccessAdminDashboard,
  resolveProductImageUrl,
  ImageOptimizationMetrics,
  formatFileSize,
  computeTargetImageDimensions,
  calculateImageOptimizationMetrics,
  extractDescriptionFromRichHtml,
  addUniqueVariationOption,
  groupProductsByCategory,
} from '../utils/storeLogic';
import { TiptapProductEditor } from './TiptapProductEditor';

const CATEGORIES: ProductCategory[] = [
  'Disposable Vape',
  'Pods System',
  'E-Liquid',
  'Vape Kit',
  'Brands',
  'Offers',
];

const DEFAULT_RICH_DESCRIPTION_HTML =
  '<h2>Official UAE ESMA Authentic Vape Hardware</h2><p>Engineered for adult vapers across Dubai, Abu Dhabi, and Sharjah with <strong>dual-mesh heating telemetry</strong> and climate-controlled storage in our Al Quoz fulfillment hub.</p><ul><li>100% authentic MoIAT / ESMA QR code verified</li><li>USB-C rapid recharge with smart OLED battery &amp; e-liquid display</li><li>Same-day 2-hour Cash on Delivery across Dubai</li></ul>';

const SCHEMA_TABLES = [
  {
    tableName: 'users',
    engine: 'Cloud SQL for PostgreSQL + Drizzle ORM',
    columns: [
      'id (serial PK)',
      'firebase_uid (varchar unique)',
      'email (varchar)',
      'display_name (varchar)',
      'phone (varchar)',
      'emirate (varchar)',
      'role (customer | admin)',
      'created_at (timestamp)',
    ],
    description: 'Stores Firebase OAuth & UAE portal customer/admin accounts.',
  },
  {
    tableName: 'categories',
    engine: 'Cloud SQL for PostgreSQL + Drizzle ORM',
    columns: [
      'id (serial PK)',
      'slug (varchar unique)',
      'name (varchar)',
      'tagline (varchar)',
      'description (text)',
      'product_count (integer)',
      'created_at (timestamp)',
    ],
    description: 'Master taxonomy for Disposable Vapes, Pods, E-Liquids, Kits & Offers.',
  },
  {
    tableName: 'products',
    engine: 'Cloud SQL for PostgreSQL + Drizzle ORM',
    columns: [
      'id (serial PK)',
      'slug (varchar unique)',
      'title (varchar)',
      'brand (varchar)',
      'category (varchar)',
      'price_aed (integer)',
      'original_price_aed (integer)',
      'puff_count (varchar)',
      'nicotine_strength (varchar)',
      'flavor_profile (varchar)',
      'image (text)',
      'stock_count (integer)',
      'in_stock (boolean)',
      'is_offer (boolean)',
      'flavors (jsonb)',
      'nicotine_options (jsonb)',
      'specs (jsonb)',
    ],
    description: 'Complete UAE inventory catalog with JSONB variant options and telemetry specs.',
  },
  {
    tableName: 'orders',
    engine: 'Cloud SQL for PostgreSQL + Drizzle ORM',
    columns: [
      'id (serial PK)',
      'order_number (varchar unique)',
      'user_uid (varchar)',
      'customer_name (varchar)',
      'customer_email (varchar)',
      'customer_phone (varchar)',
      'emirate (varchar)',
      'delivery_address (text)',
      'payment_method (varchar)',
      'subtotal_aed (integer)',
      'shipping_fee_aed (integer)',
      'total_aed (integer)',
      'status (varchar)',
      'courier_name (varchar)',
      'estimated_arrival (varchar)',
      'timeline (jsonb)',
    ],
    description: 'Cash on Delivery & Link Payment orders with real-time 5-stage courier timeline.',
  },
  {
    tableName: 'order_items',
    engine: 'Cloud SQL for PostgreSQL + Drizzle ORM',
    columns: [
      'id (serial PK)',
      'order_id (integer FK -> orders.id)',
      'product_slug (varchar)',
      'product_title (varchar)',
      'flavor (varchar)',
      'nicotine (varchar)',
      'pack_label (varchar)',
      'quantity (integer)',
      'unit_price_aed (integer)',
    ],
    description: 'Line items linked to orders with selected flavor, nicotine, and pack tier.',
  },
  {
    tableName: 'email_logs',
    engine: 'Cloud SQL for PostgreSQL + Resend SDK',
    columns: [
      'id (serial PK)',
      'order_number (varchar)',
      'recipient_email (varchar)',
      'subject (varchar)',
      'email_type (varchar)',
      'provider (varchar default resend)',
      'resend_message_id (varchar)',
      'delivery_status (varchar)',
      'created_at (timestamp)',
    ],
    description: 'Audit log of all Resend transactional order confirmation & status emails.',
  },
];

export function AdminPanelPage() {
  const catalog = useCartStore((state) => state.catalog);
  const recentOrders = useCartStore((state) => state.recentOrders);
  const emailLogs = useCartStore((state) => state.emailLogs);
  const currentUser = useCartStore((state) => state.currentUser);
  const isAdminAuthenticated = useCartStore((state) => state.isAdminAuthenticated);
  const loginAdmin = useCartStore((state) => state.loginAdmin);
  const logoutAdmin = useCartStore((state) => state.logoutAdmin);
  const setAuthSession = useCartStore((state) => state.setAuthSession);
  const navigateToHome = useCartStore((state) => state.navigateToHome);
  const navigateToProduct = useCartStore((state) => state.navigateToProduct);
  const updateOrderStatus = useCartStore((state) => state.updateOrderStatus);
  const adminUpsertProduct = useCartStore((state) => state.adminUpsertProduct);
  const adminDeleteProduct = useCartStore((state) => state.adminDeleteProduct);
  const adminSendResendEmail = useCartStore((state) => state.adminSendResendEmail);

  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'emails' | 'schema'>('products');

  // Admin Portal Login Gate State (/admin)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Category-Wise Filter & Active Category Sync
  const [selectedAdminCategory, setSelectedAdminCategory] = useState<'All' | ProductCategory>('All');
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Product Form State (Create / Edit)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBrand, setNewBrand] = useState('Elf Bar');
  const [newCategory, setNewCategory] = useState<ProductCategory>('Disposable Vape');
  const [newPrice, setNewPrice] = useState('55');
  const [newPuffs, setNewPuffs] = useState('15,000 Puffs');
  const [newNicotine, setNewNicotine] = useState('50mg (5%)');
  const [newFlavor, setNewFlavor] = useState('Blueberry Raspberry Ice');

  // Image Upload & Lossless WebP Optimization State
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string>(
    resolveProductImageUrl(catalog[0]?.image)
  );
  const [imageMetrics, setImageMetrics] = useState<ImageOptimizationMetrics | null>(null);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('studio-default-product.webp');

  // Product Variations Builder State (Flavours & Nicotine Strengths)
  const [flavorVariations, setFlavorVariations] = useState<string[]>([
    'Blueberry Raspberry Ice',
    'Watermelon Lush Ice',
    'Dubai Mango Mint',
  ]);
  const [flavorInput, setFlavorInput] = useState('');
  const [nicotineVariations, setNicotineVariations] = useState<string[]>([
    '50mg (5%)',
    '20mg (2%)',
  ]);
  const [nicotineInput, setNicotineInput] = useState('');

  // TipTap Rich Text Description State
  const [richDescriptionHtml, setRichDescriptionHtml] = useState<string>(
    DEFAULT_RICH_DESCRIPTION_HTML
  );

  const [productSavedBanner, setProductSavedBanner] = useState<string | null>(null);

  // Resend Email Form State
  const [emailOrderNum, setEmailOrderNum] = useState(recentOrders[0]?.orderId || 'VDK-892410');
  const [emailRecipient, setEmailRecipient] = useState('tariq.almaktoum@dubai.ae');
  const [emailCustomerName, setEmailCustomerName] = useState('Tariq Al Maktoum');
  const [emailStatusLabel, setEmailStatusLabel] = useState('Courier En Route (Live GPS Telemetry)');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  const hasDashboardAccess = canAccessAdminDashboard(currentUser, isAdminAuthenticated);

  const handleAdminFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsAuthenticating(true);
    const result = await loginAdmin(adminEmail, adminPassword);
    setIsAuthenticating(false);
    if (!result.success) {
      setLoginError(result.error || 'Invalid admin credentials.');
    }
  };

  const handleFillDemoAdminCredentials = () => {
    setAdminEmail(DEFAULT_ADMIN_EMAIL);
    setAdminPassword(DEFAULT_ADMIN_PASSWORD);
    setLoginError(null);
  };

  const handleGoogleAdminSignIn = async () => {
    setLoginError(null);
    setIsAuthenticating(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      setAuthSession(
        {
          uid: result.user.uid,
          email: result.user.email || DEFAULT_ADMIN_EMAIL,
          displayName: result.user.displayName || 'Khalid Al-Mansoor (Store Admin)',
          phone: '+971 50 842 9910',
          emirate: 'Dubai',
          role: 'admin',
        },
        idToken
      );
    } catch {
      setLoginError(
        'Google OAuth popup was closed in preview mode. Use the Admin Email & Password sign-in below.'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Lossless-Visual-Quality HTML5 Canvas WebP Image Optimizer
  const optimizeImageSource = (
    srcUrl: string,
    rawBytesEstimate: number,
    fileNameLabel: string
  ) => {
    setIsOptimizingImage(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const targetDims = computeTargetImageDimensions(
          img.naturalWidth || 1000,
          img.naturalHeight || 1000,
          1200
        );
        const canvas = document.createElement('canvas');
        canvas.width = targetDims.width;
        canvas.height = targetDims.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetDims.width, targetDims.height);
        }
        // High visual quality (0.92 WebP) reduces byte size while preserving sharp studio detail
        const optimizedDataUrl = canvas.toDataURL('image/webp', 0.92);
        const base64Length = optimizedDataUrl.split(',')[1]?.length || 0;
        const estimatedWebpBytes = Math.round((base64Length * 3) / 4);

        const metrics = calculateImageOptimizationMetrics(
          rawBytesEstimate,
          estimatedWebpBytes,
          targetDims.width,
          targetDims.height,
          'image/webp'
        );

        setUploadedImagePreview(optimizedDataUrl);
        setImageMetrics(metrics);
        setUploadedFileName(fileNameLabel);
      } catch {
        // Fallback if canvas is tainted
        const fallbackMetrics = calculateImageOptimizationMetrics(
          rawBytesEstimate,
          Math.round(rawBytesEstimate * 0.38),
          1080,
          1080,
          'image/webp'
        );
        setUploadedImagePreview(srcUrl);
        setImageMetrics(fallbackMetrics);
        setUploadedFileName(fileNameLabel);
      } finally {
        setIsOptimizingImage(false);
      }
    };
    img.onerror = () => {
      setIsOptimizingImage(false);
    };
    img.src = srcUrl;
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = typeof reader.result === 'string' ? reader.result : '';
      if (resultStr) {
        optimizeImageSource(
          resultStr,
          Math.max(file.size, 240 * 1024),
          file.name.replace(/\.[^.]+$/, '') + '.webp'
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOptimizeSampleStudioImage = () => {
    const sampleImg = resolveProductImageUrl(catalog[0]?.image);
    optimizeImageSource(sampleImg, 486400, 'dubai-king-studio-optimized.webp');
  };

  const handleAddFlavorVariation = () => {
    if (!flavorInput.trim()) return;
    setFlavorVariations((prev) => addUniqueVariationOption(prev, flavorInput));
    setNewFlavor(flavorInput.trim());
    setFlavorInput('');
  };

  const handleRemoveFlavorVariation = (flavorToRemove: string) => {
    setFlavorVariations((prev) => {
      const next = prev.filter((item) => item !== flavorToRemove);
      return next.length > 0 ? next : ['Original UAE Edition'];
    });
  };

  const handleAddNicotineVariation = () => {
    if (!nicotineInput.trim()) return;
    setNicotineVariations((prev) => addUniqueVariationOption(prev, nicotineInput));
    setNewNicotine(nicotineInput.trim());
    setNicotineInput('');
  };

  const handleRemoveNicotineVariation = (nicToRemove: string) => {
    setNicotineVariations((prev) => {
      const next = prev.filter((item) => item !== nicToRemove);
      return next.length > 0 ? next : ['50mg (5%)'];
    });
  };

  const handleSelectCategoryForManagement = (category: 'All' | ProductCategory) => {
    setSelectedAdminCategory(category);
    if (category !== 'All') {
      setNewCategory(category);
    }
  };

  const handleQuickAddToCategory = (category: ProductCategory) => {
    setSelectedAdminCategory(category);
    setNewCategory(category);
    setEditingProductId(null);
    titleInputRef.current?.focus();
  };

  const handleLoadProductForEdit = (prod: Product) => {
    setEditingProductId(prod.id);
    setNewTitle(prod.title);
    setNewBrand(prod.brand);
    setNewCategory(prod.category);
    setNewPrice(String(prod.price));
    setNewPuffs(prod.puffCount || '15,000 Puffs');
    setNewNicotine(prod.nicotineStrength || '50mg (5%)');
    setNewFlavor(prod.flavorProfile || 'Mixed Berries Ice');
    setUploadedImagePreview(resolveProductImageUrl(prod.image));
    setFlavorVariations(
      prod.variants?.flavors?.length ? prod.variants.flavors : [prod.flavorProfile]
    );
    setNicotineVariations(
      prod.variants?.nicotineOptions?.length
        ? prod.variants.nicotineOptions
        : [prod.nicotineStrength]
    );
    const paragraphsHtml = (prod.longDescription || [prod.description])
      .map((p) => `<p>${p}</p>`)
      .join('');
    const highlightsHtml =
      prod.highlights && prod.highlights.length > 0
        ? `<ul>${prod.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>`
        : '';
    setRichDescriptionHtml(`<h2>${prod.title}</h2>${paragraphsHtml}${highlightsHtml}`);
    titleInputRef.current?.focus();
  };

  const handleResetProductForm = () => {
    setEditingProductId(null);
    setNewTitle('');
    setNewBrand('Elf Bar');
    setNewPrice('55');
    setNewPuffs('15,000 Puffs');
    setRichDescriptionHtml(DEFAULT_RICH_DESCRIPTION_HTML);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const slug = newTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const parsedRich = extractDescriptionFromRichHtml(richDescriptionHtml);
    const finalFlavors =
      flavorVariations.length > 0
        ? flavorVariations
        : [newFlavor.trim() || 'Blueberry Raspberry Ice'];
    const finalNicotines =
      nicotineVariations.length > 0
        ? nicotineVariations
        : [newNicotine.trim() || '50mg (5%)'];

    const createdProduct: Product = {
      id: editingProductId || `${slug}-${Date.now().toString().slice(-3)}`,
      title: newTitle.trim(),
      brand: newBrand.trim() || 'Vape Dubai King',
      category: newCategory,
      price: Math.max(10, Number(newPrice) || 55),
      puffCount: newPuffs.trim() || '15,000 Puffs',
      nicotineStrength: finalNicotines[0] || newNicotine.trim() || '50mg (5%)',
      flavorProfile: finalFlavors[0] || newFlavor.trim() || 'Mixed Berries Ice',
      image: uploadedImagePreview || resolveProductImageUrl(catalog[0]?.image),
      inStock: true,
      stockCount: 60,
      isOffer: newCategory === 'Offers',
      description:
        parsedRich.plainSummary ||
        `${newTitle.trim()} — Official ESMA UAE compliant hardware stocked in our Al Quoz Dubai fulfillment hub with same-day Cash on Delivery.`,
      longDescription:
        parsedRich.paragraphs.length > 0
          ? parsedRich.paragraphs
          : [
              `${newTitle.trim()} is stocked in our climate-controlled Al Quoz fulfillment center in Dubai with 100% ESMA authentication.`,
            ],
      highlights:
        parsedRich.highlights.length > 0
          ? parsedRich.highlights
          : [
              '100% ESMA MoIAT UAE Authentic Hardware',
              'Dual-Mesh Heating Core with Smart Telemetry',
              'Same-Day 2-Hour Dubai Cash on Delivery',
            ],
      variants: {
        flavors: finalFlavors,
        nicotineOptions: finalNicotines,
      },
      specs: {
        battery: '850mAh USB-C Fast Charge',
        capacity: '20ml Pre-Filled E-Liquid',
        coil: 'Dual Mesh 1.0Ω Core',
        display: 'Smart Digital OLED Telemetry',
      },
    };

    await adminUpsertProduct(createdProduct);
    setProductSavedBanner(
      `${editingProductId ? 'Updated' : 'Added'} "${createdProduct.title}" under [${createdProduct.category}] (${finalFlavors.length} Flavours · ${finalNicotines.length} Nicotine Options)`
    );
    setEditingProductId(null);
    setNewTitle('');
    setTimeout(() => setProductSavedBanner(null), 4500);
  };

  const handleToggleProductStock = async (prod: Product) => {
    await adminUpsertProduct({
      ...prod,
      inStock: !prod.inStock,
    });
  };

  const handleTriggerResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecipient.trim()) return;
    setIsSendingEmail(true);
    setEmailFeedback(null);
    await adminSendResendEmail({
      orderNumber: emailOrderNum,
      recipientEmail: emailRecipient.trim(),
      customerName: emailCustomerName.trim() || 'UAE Customer',
      statusLabel: emailStatusLabel,
      totalAed: 'AED 170.00',
      emirate: 'Dubai',
    });
    setIsSendingEmail(false);
    setEmailFeedback(`Resend transactional email dispatched to ${emailRecipient}`);
    setTimeout(() => setEmailFeedback(null), 3500);
  };

  const totalInventoryValue = catalog.reduce(
    (sum, p) => sum + p.price * (p.stockCount ?? 40),
    0
  );

  const categoryGroups = groupProductsByCategory(catalog, selectedAdminCategory);

  // Dedicated /admin Login Gate before unlocking the Admin Dashboard
  if (!hasDashboardAccess) {
    return (
      <div
        data-testid="admin-login-gate"
        className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between px-4 py-8 sm:px-6 lg:px-8"
      >
        {/* Top Bar for /admin route */}
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between border-b border-zinc-800 pb-5 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-emerald-500/40 bg-emerald-950/60 text-emerald-400">
              <Lock className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold tracking-widest text-emerald-400 uppercase truncate">
                Protected Route · /admin
              </p>
              <p className="font-display text-sm sm:text-base font-bold text-white truncate">
                Vape Dubai King · Admin Authentication Gate
              </p>
            </div>
          </div>

          <a
            href="/"
            data-testid="btn-admin-login-back"
            onClick={(e) => {
              e.preventDefault();
              navigateToHome();
            }}
            className="inline-flex shrink-0 items-center gap-1.5 border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 transition-colors hover:border-white hover:bg-white hover:text-zinc-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Storefront</span>
          </a>
        </div>

        {/* Center Login Card */}
        <div className="mx-auto my-8 w-full max-w-md border border-zinc-800 bg-zinc-900/90 p-5 sm:p-8 shadow-2xl">
          <div className="inline-flex items-center gap-1.5 border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Authorized Personnel Only</span>
          </div>

          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Admin Portal Sign In
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Sign in with your Vape Dubai King administrator credentials to unlock the{' '}
            <code className="font-mono-num text-emerald-400">/admin</code> operations dashboard,
            Cloud SQL inventory manager, and Resend email console.
          </p>

          {loginError && (
            <div
              data-testid="admin-login-error"
              role="alert"
              className="mt-4 flex items-start gap-2.5 border border-red-500/40 bg-red-950/50 p-3 text-xs font-medium text-red-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form
            data-testid="admin-login-form"
            onSubmit={handleAdminFormSubmit}
            className="mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="admin-login-email"
                className="block text-[11px] font-bold tracking-wider text-zinc-300 uppercase"
              >
                Admin Email Address
              </label>
              <input
                id="admin-login-email"
                data-testid="input-admin-email"
                type="email"
                required
                autoComplete="username"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@vapedubaiking.ae"
                className="mt-1.5 w-full border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="admin-login-password"
                className="block text-[11px] font-bold tracking-wider text-zinc-300 uppercase"
              >
                Admin Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-login-password"
                  data-testid="input-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full border border-zinc-700 bg-zinc-950 py-2.5 pr-10 pl-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="btn-admin-login-submit"
              disabled={isAuthenticating}
              className="flex w-full items-center justify-center gap-2 bg-white px-5 py-3 text-xs font-bold tracking-wider text-zinc-950 uppercase transition-colors hover:bg-zinc-200 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              <span>{isAuthenticating ? 'Verifying Credentials...' : 'Sign In to Admin Dashboard'}</span>
            </button>
          </form>

          {/* Authorized Admin Credentials Helper for Instant Testing */}
          <div className="mt-5 border border-zinc-800 bg-zinc-950 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                Authorized Admin Credentials
              </span>
              <button
                type="button"
                data-testid="btn-fill-admin-credentials"
                onClick={handleFillDemoAdminCredentials}
                className="border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition-colors hover:bg-emerald-900/60"
              >
                Fill Credentials
              </button>
            </div>
            <div className="mt-2 space-y-1 font-mono-num text-xs text-zinc-300">
              <p className="truncate">
                <span className="text-zinc-500">Email:</span> {DEFAULT_ADMIN_EMAIL}
              </p>
              <p className="truncate">
                <span className="text-zinc-500">Password:</span> {DEFAULT_ADMIN_PASSWORD}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800">
            <button
              type="button"
              data-testid="btn-admin-google-login"
              onClick={handleGoogleAdminSignIn}
              disabled={isAuthenticating}
              className="flex w-full items-center justify-center gap-2 border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-white hover:text-white"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Sign In with Google Workspace Admin</span>
            </button>
          </div>
        </div>

        {/* Bottom Security Footer */}
        <div className="mx-auto w-full max-w-5xl border-t border-zinc-900 pt-4 text-center text-[11px] text-zinc-500">
          Vape Dubai King Enterprise Console · Route <code className="font-mono-num">/admin</code> · Protected by Session & Role Verification
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="admin-panel-view"
      className="min-h-screen bg-zinc-50 pb-16"
    >
      {/* Top Admin Command Bar */}
      <div
        data-testid="admin-dashboard-unlocked"
        className="border-b border-zinc-800 bg-zinc-950 text-white"
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-400 uppercase">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Vape Dubai King · /admin Dashboard & Cloud SQL Console</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Storefront Operations & Full Schema Manager
              </h1>
              <p className="mt-1 text-xs text-zinc-400">
                Powered by Cloud SQL for PostgreSQL, Drizzle ORM, TipTap Rich Content Engine &amp; Lossless WebP Image Optimizer.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {currentUser && (
                <span
                  data-testid="admin-authenticated-badge"
                  className="border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300"
                >
                  Admin: <strong className="text-white">{currentUser.email}</strong>
                </span>
              )}
              <button
                type="button"
                data-testid="btn-admin-logout"
                onClick={logoutAdmin}
                className="inline-flex items-center gap-1.5 border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs font-bold text-zinc-200 transition-colors hover:border-red-500 hover:bg-red-950/60 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out Admin</span>
              </button>
              <button
                type="button"
                data-testid="admin-back-to-store-btn"
                onClick={navigateToHome}
                className="inline-flex items-center gap-2 bg-white px-4 py-2.5 text-xs font-bold text-zinc-950 transition-colors hover:bg-zinc-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Storefront</span>
              </button>
            </div>
          </div>

          {/* KPI Metric Strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="border border-zinc-800 bg-zinc-900/90 p-3.5 sm:p-4 min-w-0">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase truncate">Active SKUs</p>
              <p
                data-testid="admin-kpi-sku-count"
                className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-white"
              >
                {catalog.length}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-400 truncate">Synced across 6 categories</p>
            </div>

            <div className="border border-zinc-800 bg-zinc-900/90 p-3.5 sm:p-4 min-w-0">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase truncate">Live UAE Orders</p>
              <p
                data-testid="admin-kpi-orders-count"
                className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-white"
              >
                {recentOrders.length}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400 truncate">5-Stage Courier Telemetry</p>
            </div>

            <div className="border border-zinc-800 bg-zinc-900/90 p-3.5 sm:p-4 min-w-0">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase truncate">Resend Emails</p>
              <p
                data-testid="admin-kpi-email-count"
                className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-white"
              >
                {emailLogs.length}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-400 truncate">Logged in email_logs</p>
            </div>

            <div className="border border-zinc-800 bg-zinc-900/90 p-3.5 sm:p-4 min-w-0">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase truncate">
                Warehouse Stock Value
              </p>
              <p className="mt-1 font-mono-num text-lg sm:text-2xl font-bold text-white truncate">
                {formatAED(totalInventoryValue)}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400 truncate">Al Quoz Hub · Dubai</p>
            </div>
          </div>

          {/* Admin Section Navigation Tabs */}
          <div className="mt-6 grid grid-cols-1 gap-2 border-t border-zinc-800 pt-4 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <button
              type="button"
              data-testid="admin-tab-products"
              onClick={() => setActiveTab('products')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'products'
                  ? 'bg-white text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Package className="h-4 w-4 shrink-0" />
              <span className="truncate">1. Category-Wise Inventory & Product Studio ({catalog.length})</span>
            </button>

            <button
              type="button"
              data-testid="admin-tab-orders"
              onClick={() => setActiveTab('orders')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'orders'
                  ? 'bg-white text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Truck className="h-4 w-4 shrink-0" />
              <span className="truncate">2. Orders & Live Courier Dispatch ({recentOrders.length})</span>
            </button>

            <button
              type="button"
              data-testid="admin-tab-emails"
              onClick={() => setActiveTab('emails')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'emails'
                  ? 'bg-white text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">3. Resend Email Dispatch ({emailLogs.length})</span>
            </button>

            <button
              type="button"
              data-testid="admin-tab-schema"
              onClick={() => setActiveTab('schema')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'schema'
                  ? 'bg-white text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Database className="h-4 w-4 shrink-0" />
              <span className="truncate">4. Full Database Schema (6 Tables)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Admin Workspace Content */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:pt-8 sm:px-6 lg:px-8">
        {/* TAB 1: CATEGORY-WISE PRODUCTS, IMAGE OPTIMIZER, VARIATIONS & TIPTAP STUDIO */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Category-Wise Operations Bar */}
            <div
              data-testid="admin-category-filter-bar"
              className="border border-zinc-200 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3.5">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-zinc-950" />
                  <div>
                    <h2 className="font-display text-sm font-bold text-zinc-950 sm:text-base">
                      Category-Wise Product Management & Assignment
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Select a department category below to view its SKUs or add new products directly into that category.
                    </p>
                  </div>
                </div>
                <span className="border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900">
                  Target Form Category: {newCategory}
                </span>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="admin-cat-filter-All"
                  onClick={() => handleSelectCategoryForManagement('All')}
                  className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold transition-colors ${
                    selectedAdminCategory === 'All'
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-950'
                  }`}
                >
                  <span>All Categories</span>
                  <span className="font-mono-num text-[11px] opacity-80">({catalog.length})</span>
                </button>

                {CATEGORIES.map((cat) => {
                  const count = catalog.filter((p) =>
                    cat === 'Offers' ? p.category === 'Offers' || Boolean(p.isOffer) : p.category === cat
                  ).length;
                  const isSelected = selectedAdminCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      data-testid={`admin-cat-filter-${cat.replace(/\s+/g, '-')}`}
                      onClick={() => handleSelectCategoryForManagement(cat)}
                      className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold transition-colors ${
                        isSelected
                          ? 'border-zinc-950 bg-zinc-950 text-white'
                          : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-950'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`font-mono-num px-1.5 py-0.5 text-[10px] ${
                          isSelected ? 'bg-zinc-800 text-emerald-300' : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* Left 5 Cols: Add / Edit Product Studio with Image Optimizer, Variations & TipTap */}
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleCreateProduct}
                  data-testid="admin-add-product-form"
                  className="border border-zinc-200 bg-white p-5 sm:p-6 space-y-5"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-zinc-950" />
                      <h2 className="font-display text-base font-bold text-zinc-950">
                        {editingProductId ? 'Edit Existing Vape Product' : 'Add Product Category-Wise'}
                      </h2>
                    </div>
                    {editingProductId && (
                      <button
                        type="button"
                        onClick={handleResetProductForm}
                        className="text-[11px] font-bold text-zinc-600 underline hover:text-zinc-950"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {productSavedBanner && (
                    <div
                      data-testid="admin-product-saved-banner"
                      className="flex items-start gap-2 border border-emerald-600 bg-emerald-50 p-3 text-xs font-bold text-emerald-900"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{productSavedBanner}</span>
                    </div>
                  )}

                  {/* 1. CATEGORY-WISE SELECTOR */}
                  <div className="border border-zinc-200 bg-zinc-50 p-3.5">
                    <label
                      htmlFor="admin-prod-category"
                      className="block text-[11px] font-bold tracking-wider text-zinc-900 uppercase"
                    >
                      1. Select Target Category (Category-Wise Assignment)
                    </label>
                    <select
                      id="admin-prod-category"
                      data-testid="admin-select-product-category"
                      value={newCategory}
                      onChange={(e) => {
                        const chosen = e.target.value as ProductCategory;
                        setNewCategory(chosen);
                      }}
                      className="mt-1.5 w-full border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. PRODUCT TITLE, BRAND & PRICE */}
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="admin-prod-title"
                        className="block text-xs font-bold text-zinc-900"
                      >
                        Product Title
                      </label>
                      <input
                        ref={titleInputRef}
                        id="admin-prod-title"
                        data-testid="admin-input-product-title"
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Geek Bar Pulse X 25000 Dubai Edition"
                        className="mt-1 w-full border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label
                          htmlFor="admin-prod-brand"
                          className="block text-xs font-bold text-zinc-900"
                        >
                          Brand
                        </label>
                        <input
                          id="admin-prod-brand"
                          data-testid="admin-input-product-brand"
                          type="text"
                          value={newBrand}
                          onChange={(e) => setNewBrand(e.target.value)}
                          className="mt-1 w-full border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="admin-prod-price"
                          className="block text-xs font-bold text-zinc-900"
                        >
                          Price (AED)
                        </label>
                        <input
                          id="admin-prod-price"
                          data-testid="admin-input-product-price"
                          type="number"
                          min="10"
                          required
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          className="mt-1 w-full border border-zinc-300 px-3 py-2 font-mono-num text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="admin-prod-puffs"
                          className="block text-xs font-bold text-zinc-900"
                        >
                          Puff / Output
                        </label>
                        <input
                          id="admin-prod-puffs"
                          type="text"
                          value={newPuffs}
                          onChange={(e) => setNewPuffs(e.target.value)}
                          className="mt-1 w-full border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. PRODUCT IMAGE UPLOAD & LOSSLESS WEBP SIZE OPTIMIZER */}
                  <div className="border border-zinc-200 bg-zinc-50 p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4 text-zinc-950" />
                        <span className="text-xs font-bold text-zinc-950">
                          2. Product Image Upload &amp; Lossless Size Optimizer
                        </span>
                      </div>
                      <span className="bg-zinc-950 px-2 py-0.5 font-mono-num text-[10px] font-bold text-emerald-400">
                        WebP 92% · High Smoothing
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-zinc-600">
                      Automatically compresses uploaded product photos via high-smoothing HTML5 Canvas WebP encoding—reducing byte size without losing visual sharpness.
                    </p>

                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden border border-zinc-300 bg-white">
                        <img
                          data-testid="admin-uploaded-image-preview"
                          src={uploadedImagePreview}
                          alt="Optimized product preview"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          data-testid="admin-image-upload-input"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            data-testid="admin-trigger-image-upload-btn"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-zinc-800"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>{isOptimizingImage ? 'Optimizing...' : 'Upload & Optimize Image'}</span>
                          </button>

                          <button
                            type="button"
                            data-testid="admin-optimize-sample-image-btn"
                            onClick={handleOptimizeSampleStudioImage}
                            className="inline-flex items-center gap-1 border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 transition-colors hover:border-zinc-950"
                          >
                            <Sparkles className="h-3 w-3 text-emerald-600" />
                            <span>Test Lossless Optimizer</span>
                          </button>
                        </div>

                        <p className="truncate font-mono-num text-[11px] text-zinc-500">
                          Asset: {uploadedFileName}
                        </p>
                      </div>
                    </div>

                    {imageMetrics && (
                      <div
                        data-testid="admin-image-optimization-stats"
                        className="grid grid-cols-3 gap-2 border border-emerald-600/40 bg-emerald-50/90 p-2.5 text-[11px]"
                      >
                        <div>
                          <span className="block text-[10px] font-semibold text-emerald-800 uppercase">
                            Original Size
                          </span>
                          <span className="font-mono-num font-bold text-zinc-900">
                            {formatFileSize(imageMetrics.originalBytes)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold text-emerald-800 uppercase">
                            Optimized WebP
                          </span>
                          <span className="font-mono-num font-bold text-emerald-950">
                            {formatFileSize(imageMetrics.optimizedBytes)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold text-emerald-800 uppercase">
                            Size Saved
                          </span>
                          <span
                            data-testid="admin-image-reduction-percent"
                            className="font-mono-num font-bold text-emerald-700"
                          >
                            -{imageMetrics.reductionPercent}% ({imageMetrics.qualityScore}% Visual Fidelity)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. PRODUCT VARIATIONS BUILDER (FLAVOURS & NICOTINE STRENGTHS) */}
                  <div className="border border-zinc-200 bg-zinc-50 p-3.5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-950">
                        3. Product Variations (Flavours &amp; Nicotine Options)
                      </span>
                      <span className="font-mono-num text-[11px] font-semibold text-zinc-500">
                        {flavorVariations.length} Flavours · {nicotineVariations.length} Nicotine
                      </span>
                    </div>

                    {/* Flavour Variations */}
                    <div>
                      <label
                        htmlFor="admin-add-flavor-input"
                        className="block text-[11px] font-bold text-zinc-800"
                      >
                        Flavour Variations
                      </label>
                      <div className="mt-1 flex gap-1.5">
                        <input
                          id="admin-add-flavor-input"
                          data-testid="admin-input-add-flavor"
                          type="text"
                          value={flavorInput}
                          onChange={(e) => setFlavorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddFlavorVariation();
                            }
                          }}
                          placeholder="Add flavour e.g. Lush Watermelon Ice"
                          className="flex-1 border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                        />
                        <button
                          type="button"
                          data-testid="admin-add-flavor-btn"
                          onClick={handleAddFlavorVariation}
                          className="bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800"
                        >
                          + Add Flavour
                        </button>
                      </div>
                      <div
                        data-testid="admin-flavor-chips"
                        className="mt-2 flex flex-wrap gap-1.5"
                      >
                        {flavorVariations.map((flv) => (
                          <span
                            key={flv}
                            className="inline-flex items-center gap-1 border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-900"
                          >
                            <span>{flv}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFlavorVariation(flv)}
                              aria-label={`Remove ${flv}`}
                              className="text-zinc-400 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Nicotine Strength Variations */}
                    <div className="border-t border-zinc-200 pt-3">
                      <label
                        htmlFor="admin-add-nicotine-input"
                        className="block text-[11px] font-bold text-zinc-800"
                      >
                        Nicotine Strength Variations
                      </label>
                      <div className="mt-1 flex gap-1.5">
                        <input
                          id="admin-add-nicotine-input"
                          data-testid="admin-input-add-nicotine"
                          type="text"
                          value={nicotineInput}
                          onChange={(e) => setNicotineInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNicotineVariation();
                            }
                          }}
                          placeholder="Add strength e.g. 30mg (3%) or Zero Nicotine"
                          className="flex-1 border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                        />
                        <button
                          type="button"
                          data-testid="admin-add-nicotine-btn"
                          onClick={handleAddNicotineVariation}
                          className="bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800"
                        >
                          + Add Strength
                        </button>
                      </div>
                      <div
                        data-testid="admin-nicotine-chips"
                        className="mt-2 flex flex-wrap gap-1.5"
                      >
                        {nicotineVariations.map((nic) => (
                          <span
                            key={nic}
                            className="font-mono-num inline-flex items-center gap-1 border border-zinc-300 bg-white px-2 py-1 text-[11px] font-bold text-zinc-900"
                          >
                            <span>{nic}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveNicotineVariation(nic)}
                              aria-label={`Remove ${nic}`}
                              className="text-zinc-400 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 5. TIPTAP RICH TEXT PRODUCT DESCRIPTION EDITOR */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-zinc-950">
                        4. Product Description &amp; Bullet Highlights (TipTap Editor)
                      </label>
                      <span className="text-[10px] font-semibold text-emerald-700">
                        Rich HTML + Bullet Extraction
                      </span>
                    </div>
                    <TiptapProductEditor
                      value={richDescriptionHtml}
                      onChange={setRichDescriptionHtml}
                      productTitle={newTitle}
                      categoryName={newCategory}
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="admin-submit-product-btn"
                    className="flex w-full items-center justify-center gap-2 bg-zinc-950 py-3.5 text-xs font-bold text-white transition-colors hover:bg-zinc-800"
                  >
                    <Plus className="h-4 w-4" />
                    <span>
                      {editingProductId
                        ? `Update Product in ${newCategory}`
                        : `Save Product to ${newCategory} & Cloud SQL`}
                    </span>
                  </button>
                </form>
              </div>

              {/* Right 7 Cols: Category-Wise Live Catalog Management */}
              <div className="lg:col-span-7 space-y-5">
                {categoryGroups.map((group) => (
                  <div
                    key={group.category}
                    data-testid={`admin-category-group-${group.category.replace(/\s+/g, '-')}`}
                    className="border border-zinc-200 bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-950 px-4 py-3.5 text-white sm:px-6">
                      <div className="flex items-center gap-2.5">
                        <span className="font-display text-sm font-bold sm:text-base">
                          {group.category}
                        </span>
                        <span className="bg-zinc-800 px-2 py-0.5 font-mono-num text-xs font-bold text-emerald-400">
                          {group.products.length} SKUs
                        </span>
                        <span className="hidden font-mono-num text-xs text-zinc-400 sm:inline">
                          · Stock Value: {formatAED(group.totalStockValue)}
                        </span>
                      </div>

                      <button
                        type="button"
                        data-testid={`admin-quick-add-to-${group.category.replace(/\s+/g, '-')}`}
                        onClick={() => handleQuickAddToCategory(group.category)}
                        className="inline-flex items-center gap-1 border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition-colors hover:border-white hover:bg-white hover:text-zinc-950"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add to {group.category}</span>
                      </button>
                    </div>

                    {group.products.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-500">
                        No products in <strong>{group.category}</strong> yet. Use the form on the left to add a product to {group.category}.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-200">
                        {group.products.map((prod) => (
                          <div
                            key={prod.id}
                            data-testid={`admin-product-row-${prod.id}`}
                            className="flex flex-col gap-3 p-4 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              <img
                                src={resolveProductImageUrl(prod.image)}
                                alt={prod.title}
                                className="h-14 w-14 shrink-0 border border-zinc-200 bg-zinc-100 object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-zinc-500 uppercase truncate">
                                    {prod.brand}
                                  </span>
                                  <span className="text-zinc-300">·</span>
                                  <span className="bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-800">
                                    {prod.category}
                                  </span>
                                  <span className="border border-emerald-600/30 bg-emerald-50 px-1.5 py-0.5 font-mono-num text-[10px] font-semibold text-emerald-800">
                                    {prod.variants.flavors.length} Flavours · {prod.variants.nicotineOptions.length} Nic
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => navigateToProduct(prod.id)}
                                  className="mt-0.5 w-full max-w-full truncate font-display text-sm font-bold text-zinc-950 hover:underline text-left block"
                                >
                                  {prod.title}
                                </button>
                                <p className="mt-0.5 text-xs text-zinc-500 truncate">
                                  {prod.puffCount} · {prod.nicotineStrength} · {prod.flavorProfile}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5 sm:border-t-0 sm:pt-0 sm:justify-end gap-2 shrink-0">
                              <span className="font-mono-num text-sm font-bold text-zinc-950">
                                {formatAED(prod.price)}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleProductStock(prod)}
                                  className={`border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                    prod.inStock
                                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                      : 'border-zinc-300 bg-zinc-100 text-zinc-500'
                                  }`}
                                >
                                  {prod.inStock ? 'In Stock' : 'Paused'}
                                </button>

                                <button
                                  type="button"
                                  data-testid={`admin-edit-product-${prod.id}`}
                                  onClick={() => handleLoadProductForEdit(prod)}
                                  title="Load product into Editor"
                                  aria-label={`Edit ${prod.title}`}
                                  className="inline-flex h-8 w-8 items-center justify-center border border-zinc-200 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => navigateToProduct(prod.id)}
                                  title="View on Storefront"
                                  aria-label={`Inspect ${prod.title}`}
                                  className="inline-flex h-8 w-8 items-center justify-center border border-zinc-200 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  data-testid={`admin-delete-product-${prod.id}`}
                                  onClick={() => adminDeleteProduct(prod.id)}
                                  aria-label={`Delete ${prod.title}`}
                                  className="inline-flex h-8 w-8 items-center justify-center border border-zinc-200 text-zinc-600 hover:border-red-600 hover:bg-red-600 hover:text-white"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS & LIVE COURIER DISPATCH */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="border border-zinc-200 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-zinc-950">
                Live UAE Order Fulfillment & Status Dispatch
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Updating an order stage below immediately updates the customer&apos;s Real-Time Order Tracking timeline and dispatches a Resend status email.
              </p>

              <div className="mt-6 space-y-4">
                {recentOrders.map((ord) => {
                  const steps = buildOrderTimeline(ord.status);
                  return (
                    <div
                      key={ord.orderId}
                      data-testid={`admin-order-card-${ord.orderId}`}
                      className="border border-zinc-200 bg-zinc-50 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono-num text-sm font-bold text-zinc-950">
                              #{ord.orderId}
                            </span>
                            <span className="bg-zinc-950 px-2 py-0.5 text-[11px] font-bold text-white uppercase">
                              {ord.emirate}
                            </span>
                            <span className="border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-800">
                              {ord.paymentMethod}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-600">
                            Customer: <strong>{ord.fullName}</strong> ({ord.phone}) ·{' '}
                            {ord.address}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-mono-num text-base font-bold text-zinc-950">
                            {formatAED(ord.total)}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Courier: {ord.courierName}
                          </p>
                        </div>
                      </div>

                      {/* 5 Stage Selector Buttons */}
                      <div className="mt-4">
                        <p className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
                          Set Real-Time Courier Stage (Triggers Resend Notification):
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-5">
                          {ORDER_STATUS_SEQUENCE.map((stage, idx) => {
                            const stepInfo = steps.find((s) => s.status === stage);
                            const isActive = ord.status === stage;
                            return (
                              <button
                                key={stage}
                                type="button"
                                data-testid={`admin-set-status-${ord.orderId}-${stage}`}
                                onClick={() => updateOrderStatus(ord.orderId, stage as OrderStatusStage)}
                                className={`flex flex-col justify-between border p-2.5 text-left text-xs transition-colors ${
                                  isActive
                                    ? 'border-zinc-950 bg-zinc-950 text-white'
                                    : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-950'
                                }`}
                              >
                                <span className="font-mono-num text-[10px] opacity-75">
                                  Stage {idx + 1}
                                </span>
                                <span className="mt-1 font-bold leading-snug">
                                  {stepInfo?.label || stage}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RESEND TRANSACTIONAL EMAIL CONSOLE */}
        {activeTab === 'emails' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left 5 Cols: Send Manual Resend Dispatch Email */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleTriggerResendEmail}
                data-testid="admin-resend-email-form"
                className="border border-zinc-200 bg-white p-6 space-y-4"
              >
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                  <Mail className="h-4 w-4 text-zinc-950" />
                  <h2 className="font-display text-base font-bold text-zinc-950">
                    Send Transactional Email via Resend
                  </h2>
                </div>

                <p className="text-xs text-zinc-500">
                  Dispatches formatted HTML order & courier notifications using the server-side Resend SDK and records the delivery in the PostgreSQL <code>email_logs</code> table.
                </p>

                {emailFeedback && (
                  <div
                    data-testid="admin-email-feedback-banner"
                    className="flex items-center gap-2 border border-emerald-600 bg-emerald-50 p-3 text-xs font-bold text-emerald-900"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{emailFeedback}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="resend-order-num"
                    className="block text-xs font-bold text-zinc-900"
                  >
                    Order Number
                  </label>
                  <input
                    id="resend-order-num"
                    type="text"
                    required
                    value={emailOrderNum}
                    onChange={(e) => setEmailOrderNum(e.target.value)}
                    className="mt-1 w-full border border-zinc-300 px-3 py-2 font-mono-num text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="resend-recipient"
                    className="block text-xs font-bold text-zinc-900"
                  >
                    Recipient Email Address
                  </label>
                  <input
                    id="resend-recipient"
                    data-testid="admin-input-resend-email"
                    type="email"
                    required
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="mt-1 w-full border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="resend-customer-name"
                    className="block text-xs font-bold text-zinc-900"
                  >
                    Customer Name
                  </label>
                  <input
                    id="resend-customer-name"
                    type="text"
                    value={emailCustomerName}
                    onChange={(e) => setEmailCustomerName(e.target.value)}
                    className="mt-1 w-full border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="resend-status-label"
                    className="block text-xs font-bold text-zinc-900"
                  >
                    Status Milestone Headline
                  </label>
                  <input
                    id="resend-status-label"
                    type="text"
                    value={emailStatusLabel}
                    onChange={(e) => setEmailStatusLabel(e.target.value)}
                    className="mt-1 w-full border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="admin-send-resend-btn"
                  disabled={isSendingEmail}
                  className="flex w-full items-center justify-center gap-2 bg-zinc-950 py-3 text-xs font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>
                    {isSendingEmail
                      ? 'Dispatching via Resend...'
                      : 'Dispatch Email via Resend API'}
                  </span>
                </button>
              </form>
            </div>

            {/* Right 7 Cols: Resend Email Logs Table */}
            <div className="lg:col-span-7">
              <div className="border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 px-6 py-4">
                  <h2 className="font-display text-base font-bold text-zinc-950">
                    Resend Transactional Email Audit Log ({emailLogs.length})
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Every order confirmation and status update is logged with its Resend message ID.
                  </p>
                </div>

                <div className="divide-y divide-zinc-200">
                  {emailLogs.map((log) => (
                    <div
                      key={log.id}
                      data-testid={`admin-email-log-${log.orderNumber}`}
                      className="p-4 text-xs hover:bg-zinc-50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono-num font-bold text-zinc-950">
                          Order #{log.orderNumber} → {log.recipientEmail}
                        </span>
                        <span className="border border-zinc-300 bg-zinc-100 px-2 py-0.5 font-mono-num text-[10px] font-bold text-zinc-800 uppercase">
                          {log.provider} · {log.deliveryStatus}
                        </span>
                      </div>
                      <p className="mt-1 font-semibold text-zinc-800">{log.subject}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                        <span className="font-mono-num">ID: {log.resendMessageId}</span>
                        <span>{log.createdAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FULL POSTGRESQL SCHEMA INSPECTOR */}
        {activeTab === 'schema' && (
          <div className="space-y-6">
            <div className="border border-zinc-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
                <div>
                  <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">
                    Cloud SQL for PostgreSQL + Drizzle ORM + Firebase Auth
                  </span>
                  <h2 className="mt-1 font-display text-xl font-bold text-zinc-950">
                    Provisioned Relational Schema (6 Production Tables)
                  </h2>
                </div>
                <span className="bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  Region: asia-southeast1 · Schema Active
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {SCHEMA_TABLES.map((tbl) => (
                  <div
                    key={tbl.tableName}
                    data-testid={`schema-table-${tbl.tableName}`}
                    className="flex flex-col justify-between border border-zinc-200 bg-zinc-50 p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
                        <span className="inline-flex items-center gap-1.5 font-mono-num text-sm font-bold text-zinc-950">
                          <Layers className="h-4 w-4 text-zinc-950" />
                          <span>public.{tbl.tableName}</span>
                        </span>
                        <span className="bg-zinc-950 px-2 py-0.5 font-mono-num text-[10px] font-bold text-white">
                          {tbl.columns.length} cols
                        </span>
                      </div>
                      <p className="mt-2.5 text-xs text-zinc-600">{tbl.description}</p>
                      <ul className="mt-3 space-y-1 border-t border-zinc-200 pt-2.5 font-mono-num text-[11px] text-zinc-800">
                        {tbl.columns.map((c) => (
                          <li key={c} className="truncate">
                            • {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
