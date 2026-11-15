import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  emailLogs,
  orderItems,
  orders,
  products,
  users,
} from './schema.ts';
import { MOCK_PRODUCTS, POPULAR_CATEGORY_CARDS } from '../data/products.ts';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const isAdminEmail =
      email.toLowerCase().includes('admin') ||
      email.toLowerCase() === 'irfathmostofa1@gmail.com';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        role: isAdminEmail ? 'admin' : 'customer',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || email.split('@')[0],
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function seedInitialCatalogIfNeeded() {
  try {
    const existingProducts = await db.select().from(products);
    if (existingProducts.length === 0) {
      for (const cat of POPULAR_CATEGORY_CARDS) {
        await db
          .insert(categories)
          .values({
            slug: cat.id,
            name: cat.title,
            tagline: cat.badge,
            description: cat.subtitle,
            startingPriceAed: cat.startingPrice.toFixed(2),
          })
          .onConflictDoNothing();
      }

      for (const prod of MOCK_PRODUCTS) {
        await db
          .insert(products)
          .values({
            slug: prod.id,
            title: prod.title,
            brand: prod.brand,
            category: prod.category,
            priceAed: prod.price.toFixed(2),
            originalPriceAed: prod.originalPrice ? prod.originalPrice.toFixed(2) : null,
            puffCount: prod.puffCount || 'Standard',
            nicotineStrength: prod.nicotineStrength,
            flavorProfile: prod.flavorProfile,
            image: prod.image,
            stockCount: 48,
            inStock: prod.inStock,
            isOffer: Boolean(prod.isOffer),
            description: prod.description,
            flavorsJson: JSON.stringify(prod.variants.flavors),
            nicotineOptionsJson: JSON.stringify(prod.variants.nicotineOptions),
            specsJson: JSON.stringify(prod.specs),
          })
          .onConflictDoNothing();
      }
    }

    const existingOrders = await db.select().from(orders);
    if (existingOrders.length === 0) {
      const initialTimeline = [
        {
          status: 'order_placed',
          label: 'Order Confirmed & Logged',
          location: 'Vape Dubai King Online Desk',
          timestamp: '14:10 GST',
          completed: true,
        },
        {
          status: 'age_verified',
          label: '21+ Adult ID & ESMA Excise Verified',
          location: 'Dubai Compliance Hub',
          timestamp: '14:18 GST',
          completed: true,
        },
        {
          status: 'packed_al_quoz',
          label: 'Thermal-Sealed & Dispatched',
          location: 'Al Quoz Industrial Area 3, Dubai',
          timestamp: '14:35 GST',
          completed: true,
        },
        {
          status: 'out_for_delivery',
          label: 'Courier En Route (Live GPS Telemetry)',
          location: 'Sheikh Zayed Rd → Downtown Dubai',
          timestamp: '14:52 GST',
          completed: false,
        },
        {
          status: 'delivered',
          label: 'Doorstep Handover & COD Settlement',
          location: 'Customer Destination',
          timestamp: 'Est. 15:25 GST',
          completed: false,
        },
      ];

      const sampleItems = [
        {
          productId: MOCK_PRODUCTS[0].id,
          title: MOCK_PRODUCTS[0].title,
          flavor: MOCK_PRODUCTS[0].variants.flavors[0],
          nicotine: MOCK_PRODUCTS[0].variants.nicotineOptions[0],
          packLabel: 'Single Unit (1x)',
          quantity: 2,
          unitPrice: 40,
        },
        {
          productId: MOCK_PRODUCTS[1].id,
          title: MOCK_PRODUCTS[1].title,
          flavor: MOCK_PRODUCTS[1].variants.flavors[0],
          nicotine: MOCK_PRODUCTS[1].variants.nicotineOptions[0],
          packLabel: 'Single Unit (1x)',
          quantity: 1,
          unitPrice: 65,
        },
      ];

      const insertedOrder = await db
        .insert(orders)
        .values({
          orderNumber: 'VDK-892410',
          userUid: null,
          customerName: 'Tariq Al Maktoum',
          customerEmail: 'tariq.almaktoum@dubai.ae',
          customerPhone: '+971 50 842 9910',
          emirate: 'Dubai',
          deliveryAddress: 'Boulevard Point Tower, Apt 3402, Downtown Dubai',
          paymentMethod: 'Cash on Delivery',
          status: 'packed_al_quoz',
          courierName: 'Rashid Al-Mansoor · Dubai Express Bike #14',
          estimatedArrival: '35 mins (Sheikh Zayed Rd Route)',
          subtotalAed: '145.00',
          shippingFeeAed: '25.00',
          totalAed: '170.00',
          itemsJson: JSON.stringify(sampleItems),
          timelineJson: JSON.stringify(initialTimeline),
        })
        .onConflictDoNothing()
        .returning();

      if (insertedOrder[0]) {
        for (const item of sampleItems) {
          await db.insert(orderItems).values({
            orderId: insertedOrder[0].id,
            productSlug: item.productId,
            productTitle: item.title,
            selectedFlavor: item.flavor,
            selectedNicotine: item.nicotine,
            packLabel: item.packLabel,
            quantity: item.quantity,
            unitPriceAed: item.unitPrice.toFixed(2),
          });
        }

        await db.insert(emailLogs).values({
          orderNumber: 'VDK-892410',
          recipientEmail: 'tariq.almaktoum@dubai.ae',
          subject: 'Vape Dubai King — Order #VDK-892410 Dispatched from Al Quoz Hub',
          emailType: 'status_update',
          provider: 'resend',
          resendMessageId: 're_dubai_dispatch_892410',
          deliveryStatus: 'sent',
        });
      }
    }
  } catch (error) {
    console.error('Database seed failed:', error);
    throw new Error('Failed to initialize store database.', { cause: error });
  }
}

export async function getAllStoreData() {
  try {
    await seedInitialCatalogIfNeeded();
    const [dbProducts, dbCategories, dbOrders, dbUsers, dbEmails] = await Promise.all([
      db.select().from(products).orderBy(desc(products.id)),
      db.select().from(categories).orderBy(categories.id),
      db.select().from(orders).orderBy(desc(orders.id)),
      db.select().from(users).orderBy(desc(users.id)),
      db.select().from(emailLogs).orderBy(desc(emailLogs.id)),
    ]);

    return {
      products: dbProducts,
      categories: dbCategories,
      orders: dbOrders,
      users: dbUsers,
      emailLogs: dbEmails,
    };
  } catch (error) {
    console.error('Database query failed in getAllStoreData:', error);
    throw new Error('Failed to load store data from PostgreSQL.', { cause: error });
  }
}

export async function createOrderRecord(payload: {
  orderNumber: string;
  userUid?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  emirate: string;
  deliveryAddress: string;
  paymentMethod: string;
  subtotalAed: number;
  shippingFeeAed: number;
  totalAed: number;
  items: {
    productId: string;
    title: string;
    flavor: string;
    nicotine: string;
    packLabel: string;
    quantity: number;
    unitPrice: number;
  }[];
  timeline: unknown[];
}) {
  try {
    const inserted = await db
      .insert(orders)
      .values({
        orderNumber: payload.orderNumber,
        userUid: payload.userUid || null,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        customerPhone: payload.customerPhone,
        emirate: payload.emirate,
        deliveryAddress: payload.deliveryAddress,
        paymentMethod: payload.paymentMethod,
        status: 'order_placed',
        subtotalAed: payload.subtotalAed.toFixed(2),
        shippingFeeAed: payload.shippingFeeAed.toFixed(2),
        totalAed: payload.totalAed.toFixed(2),
        itemsJson: JSON.stringify(payload.items),
        timelineJson: JSON.stringify(payload.timeline),
      })
      .returning();

    const orderRow = inserted[0];
    if (orderRow) {
      for (const item of payload.items) {
        await db.insert(orderItems).values({
          orderId: orderRow.id,
          productSlug: item.productId,
          productTitle: item.title,
          selectedFlavor: item.flavor,
          selectedNicotine: item.nicotine,
          packLabel: item.packLabel,
          quantity: item.quantity,
          unitPriceAed: item.unitPrice.toFixed(2),
        });
      }
    }

    return orderRow;
  } catch (error) {
    console.error('Database query failed in createOrderRecord:', error);
    throw new Error('Failed to persist order in database.', { cause: error });
  }
}

export async function updateOrderStatusRecord(
  orderNumber: string,
  status: string,
  timeline: unknown[],
  courierName?: string,
  estimatedArrival?: string
) {
  try {
    const updated = await db
      .update(orders)
      .set({
        status,
        timelineJson: JSON.stringify(timeline),
        ...(courierName ? { courierName } : {}),
        ...(estimatedArrival ? { estimatedArrival } : {}),
      })
      .where(eq(orders.orderNumber, orderNumber))
      .returning();

    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateOrderStatusRecord:', error);
    throw new Error('Failed to update order status in database.', { cause: error });
  }
}

export async function upsertProductRecord(payload: {
  slug: string;
  title: string;
  brand: string;
  category: string;
  priceAed: number;
  originalPriceAed?: number | null;
  puffCount: string;
  nicotineStrength: string;
  flavorProfile: string;
  image: string;
  stockCount: number;
  inStock: boolean;
  isOffer: boolean;
  description: string;
  flavors: string[];
  nicotineOptions: string[];
  specs: { battery: string; capacity: string; display: string };
}) {
  try {
    const result = await db
      .insert(products)
      .values({
        slug: payload.slug,
        title: payload.title,
        brand: payload.brand,
        category: payload.category,
        priceAed: payload.priceAed.toFixed(2),
        originalPriceAed: payload.originalPriceAed ? payload.originalPriceAed.toFixed(2) : null,
        puffCount: payload.puffCount,
        nicotineStrength: payload.nicotineStrength,
        flavorProfile: payload.flavorProfile,
        image: payload.image,
        stockCount: payload.stockCount,
        inStock: payload.inStock,
        isOffer: payload.isOffer,
        description: payload.description,
        flavorsJson: JSON.stringify(payload.flavors),
        nicotineOptionsJson: JSON.stringify(payload.nicotineOptions),
        specsJson: JSON.stringify(payload.specs),
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          title: payload.title,
          brand: payload.brand,
          category: payload.category,
          priceAed: payload.priceAed.toFixed(2),
          originalPriceAed: payload.originalPriceAed ? payload.originalPriceAed.toFixed(2) : null,
          puffCount: payload.puffCount,
          nicotineStrength: payload.nicotineStrength,
          flavorProfile: payload.flavorProfile,
          image: payload.image,
          stockCount: payload.stockCount,
          inStock: payload.inStock,
          isOffer: payload.isOffer,
          description: payload.description,
          flavorsJson: JSON.stringify(payload.flavors),
          nicotineOptionsJson: JSON.stringify(payload.nicotineOptions),
          specsJson: JSON.stringify(payload.specs),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in upsertProductRecord:', error);
    throw new Error('Failed to save product in database.', { cause: error });
  }
}

export async function deleteProductRecord(slug: string) {
  try {
    await db.delete(products).where(eq(products.slug, slug));
    return { deleted: slug };
  } catch (error) {
    console.error('Database query failed in deleteProductRecord:', error);
    throw new Error('Failed to delete product from database.', { cause: error });
  }
}
