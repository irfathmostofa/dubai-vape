import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Users Table (Linked via Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('customer'), // 'admin' | 'customer'
  emirate: text('emirate').default('Dubai'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Categories Table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  startingPriceAed: numeric('starting_price_aed', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Products Table (Full Vape Hardware & E-Liquid Inventory)
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  brand: text('brand').notNull(),
  category: text('category').notNull(),
  priceAed: numeric('price_aed', { precision: 10, scale: 2 }).notNull(),
  originalPriceAed: numeric('original_price_aed', { precision: 10, scale: 2 }),
  puffCount: text('puff_count'),
  nicotineStrength: text('nicotine_strength').notNull(),
  flavorProfile: text('flavor_profile').notNull(),
  image: text('image').notNull(),
  stockCount: integer('stock_count').notNull().default(45),
  inStock: boolean('in_stock').notNull().default(true),
  isOffer: boolean('is_offer').notNull().default(false),
  description: text('description').notNull(),
  flavorsJson: text('flavors_json').notNull(),
  nicotineOptionsJson: text('nicotine_options_json').notNull(),
  specsJson: text('specs_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Orders Table (UAE Cash on Delivery & Real-Time Status Timeline)
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userUid: text('user_uid'),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  emirate: text('emirate').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  paymentMethod: text('payment_method').notNull(),
  status: text('status').notNull().default('order_placed'),
  courierName: text('courier_name').default('Rashid Al-Mansoor · Dubai Express Bike #14'),
  estimatedArrival: text('estimated_arrival').default('Within 90 mins (Same-Day UAE Dispatch)'),
  subtotalAed: numeric('subtotal_aed', { precision: 10, scale: 2 }).notNull(),
  shippingFeeAed: numeric('shipping_fee_aed', { precision: 10, scale: 2 }).notNull(),
  totalAed: numeric('total_aed', { precision: 10, scale: 2 }).notNull(),
  itemsJson: text('items_json').notNull(),
  timelineJson: text('timeline_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Order Items Table (Normalized Line Items)
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  productSlug: text('product_slug').notNull(),
  productTitle: text('product_title').notNull(),
  selectedFlavor: text('selected_flavor').notNull(),
  selectedNicotine: text('selected_nicotine').notNull(),
  packLabel: text('pack_label').notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceAed: numeric('unit_price_aed', { precision: 10, scale: 2 }).notNull(),
});

// 6. Email Logs Table (Resend Transactional Email Audit Trail)
export const emailLogs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  emailType: text('email_type').notNull(), // 'order_confirmation' | 'status_update' | 'admin_dispatch'
  provider: text('provider').notNull().default('resend'),
  resendMessageId: text('resend_message_id'),
  deliveryStatus: text('delivery_status').notNull(), // 'sent' | 'simulated_no_api_key' | 'failed'
  createdAt: timestamp('created_at').defaultNow(),
});

// Drizzle Relations
export const ordersRelations = relations(orders, ({ many }) => ({
  lineItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));
