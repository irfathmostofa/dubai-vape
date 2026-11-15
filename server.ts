import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getAllStoreData,
  getOrCreateUser,
  createOrderRecord,
  updateOrderStatusRecord,
  upsertProductRecord,
  deleteProductRecord,
} from './src/db/repository.ts';
import {
  sendOrderTransactionalEmail,
  sendNewsletterWelcomeEmail,
} from './src/services/emailService.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Bootstrap Store Data (Products, Categories, Orders, Users, Resend Email Logs)
  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const data = await getAllStoreData();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/bootstrap:', error);
      res.status(500).json({ error: error.message || 'Failed to load store data' });
    }
  });

  // 2. Sync Authenticated Firebase User into PostgreSQL `users` table
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || 'customer@vapedubaiking.ae';
      const name = req.user?.name;
      if (!uid) {
        return res.status(400).json({ error: 'Missing user UID' });
      }
      const userRecord = await getOrCreateUser(uid, email, name);
      res.json({ user: userRecord });
    } catch (error: any) {
      console.error('Error in /api/auth/sync:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // 3. Create New Order + Send Resend Confirmation Email
  app.post('/api/orders', async (req, res) => {
    try {
      const orderRow = await createOrderRecord(req.body);
      const emailLog = await sendOrderTransactionalEmail({
        orderNumber: req.body.orderNumber,
        recipientEmail: req.body.customerEmail || 'customer@vapedubaiking.ae',
        customerName: req.body.customerName,
        statusLabel: 'Order Confirmed & Queued for Dubai Dispatch',
        totalAed: `AED ${Number(req.body.totalAed).toFixed(2)}`,
        emirate: req.body.emirate,
        emailType: 'order_confirmation',
      });
      res.status(201).json({ order: orderRow, emailLog });
    } catch (error: any) {
      console.error('Error in POST /api/orders:', error);
      res.status(500).json({ error: error.message || 'Failed to create order' });
    }
  });

  // 4. Update Order Status & Timeline + Send Resend Status Email
  app.patch('/api/orders/:orderNumber/status', async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const { status, statusLabel, timeline, courierName, estimatedArrival } = req.body;
      const updated = await updateOrderStatusRecord(
        orderNumber,
        status,
        timeline,
        courierName,
        estimatedArrival
      );
      let emailLog = null;
      if (updated) {
        emailLog = await sendOrderTransactionalEmail({
          orderNumber: updated.orderNumber,
          recipientEmail: updated.customerEmail,
          customerName: updated.customerName,
          statusLabel: statusLabel || status,
          totalAed: `AED ${Number(updated.totalAed).toFixed(2)}`,
          emirate: updated.emirate,
          emailType: 'status_update',
        });
      }
      res.json({ order: updated, emailLog });
    } catch (error: any) {
      console.error('Error in PATCH /api/orders/:orderNumber/status:', error);
      res.status(500).json({ error: error.message || 'Failed to update order status' });
    }
  });

  // 5. Admin Portal Login (/admin) — Validates Admin Credentials & Syncs Admin Record in PostgreSQL
  app.post('/api/admin/login', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '').trim();
      const isAuthorizedEmail =
        email === 'admin@vapedubaiking.ae' || email.endsWith('@vapedubaiking.ae');
      const isAuthorizedPassword = password === 'DubaiKing2026!' || password === 'admin123';

      if (!isAuthorizedEmail || !isAuthorizedPassword) {
        return res.status(401).json({
          error: 'Invalid admin credentials. Use admin@vapedubaiking.ae and password DubaiKing2026!',
        });
      }

      let dbUser = null;
      try {
        dbUser = await getOrCreateUser(
          'admin-vdk-hub',
          email,
          'Khalid Al-Mansoor (Store Admin)'
        );
      } catch {
        // Fallback if database connection is transient
      }

      return res.json({
        success: true,
        token: `vdk_admin_tok_${Date.now()}`,
        user: {
          uid: dbUser?.uid || 'admin-vdk-hub',
          email,
          displayName: dbUser?.displayName || 'Khalid Al-Mansoor (Store Admin)',
          phone: dbUser?.phone || '+971 50 842 9910',
          emirate: dbUser?.emirate || 'Dubai',
          role: 'admin',
        },
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/login:', error);
      res.status(500).json({ error: error.message || 'Admin login failed' });
    }
  });

  // 6. Admin Create / Update Product in PostgreSQL
  app.post('/api/admin/products', async (req, res) => {
    try {
      const product = await upsertProductRecord(req.body);
      res.json({ product });
    } catch (error: any) {
      console.error('Error in POST /api/admin/products:', error);
      res.status(500).json({ error: error.message || 'Failed to save product' });
    }
  });

  // 6. Admin Delete Product from PostgreSQL
  app.delete('/api/admin/products/:slug', async (req, res) => {
    try {
      const result = await deleteProductRecord(req.params.slug);
      res.json(result);
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/products/:slug:', error);
      res.status(500).json({ error: error.message || 'Failed to delete product' });
    }
  });

  // 7. Admin Manual Resend Transactional Email Trigger
  app.post('/api/admin/resend-email', async (req, res) => {
    try {
      const emailLog = await sendOrderTransactionalEmail({
        orderNumber: req.body.orderNumber || 'VDK-892410',
        recipientEmail: req.body.recipientEmail || 'customer@vapedubaiking.ae',
        customerName: req.body.customerName || 'Valued UAE Customer',
        statusLabel: req.body.statusLabel || 'Courier Out for Delivery',
        totalAed: req.body.totalAed || 'AED 170.00',
        emirate: req.body.emirate || 'Dubai',
        emailType: 'admin_dispatch',
      });
      res.json({ emailLog });
    } catch (error: any) {
      console.error('Error in POST /api/admin/resend-email:', error);
      res.status(500).json({ error: error.message || 'Failed to send email' });
    }
  });

  // 8. Marketing Inactivity Popup Newsletter Lead Capture via Resend
  app.post('/api/newsletter/subscribe', async (req, res) => {
    try {
      const recipientEmail = String(req.body.email || '').trim();
      const customerName = String(req.body.name || 'UAE VIP Subscriber').trim();
      const discountCode = String(req.body.discountCode || 'DUBAIKING15').trim();
      if (!recipientEmail || !recipientEmail.includes('@')) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }
      const emailLog = await sendNewsletterWelcomeEmail({
        recipientEmail,
        customerName,
        discountCode,
      });
      res.status(201).json({
        success: true,
        discountCode,
        emailLog,
      });
    } catch (error: any) {
      console.error('Error in POST /api/newsletter/subscribe:', error);
      res.status(500).json({ error: error.message || 'Failed to subscribe to newsletter' });
    }
  });

  // Mount Vite dev middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vape Dubai King full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
