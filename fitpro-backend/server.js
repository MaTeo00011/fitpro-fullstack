const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./db');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const {
  firebaseEnabled,
  db: firestoreDb,
  normalizeFirestoreValue,
  toTimestamp,
  getDocumentRefByIdOrLegacyId,
  getUserByUsername,
} = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3000;
const useFirestore = firebaseEnabled;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : [
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'https://fitpro-gym-shop.vercel.app'
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS origin denied: ${origin}`));
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const getServerBaseUrl = req =>
  process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

const s3Bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const s3Region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
let upload = null;
if (s3Bucket && s3Region) {
  const s3Client = new S3Client({ region: s3Region });
  const memoryStorage = multer.memoryStorage();
  upload = multer({ storage: memoryStorage, limits: { fileSize: 5 * 1024 * 1024 } });

  app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const key = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const putParams = {
        Bucket: s3Bucket,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: 'public-read'
      };
      await s3Client.send(new PutObjectCommand(putParams));
      const imageUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${encodeURIComponent(key)}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      res.status(500).json({ error: 'Error al subir archivo a S3' });
    }
  });
} else {
  const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      cb(null, safeName);
    }
  });
  upload = multer({ storage: diskStorage, limits: { fileSize: 5 * 1024 * 1024 } });

  app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Error al subir archivo' });
    }
  });
}

const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ventas (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        customer_email VARCHAR(200) NOT NULL,
        customer_name VARCHAR(200) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        city VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        total NUMERIC(10,2) NOT NULL,
        shipping_cost NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS venta_items (
        id SERIAL PRIMARY KEY,
        venta_id INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        name VARCHAR(200) NOT NULL,
        quantity INTEGER NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    console.log('Tablas de ventas inicializadas.');
  } catch (error) {
    console.error('Error inicializando tablas de ventas:', error);
  }
};

if (!useFirestore) {
  initializeDatabase();
}

const toCamelCase = row => {
  if (!row) return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value
    ])
  );
};

const calculatePaymentEnd = (startDate, paymentType) => {
  const end = new Date(startDate);
  switch (paymentType) {
    case 'dia': end.setDate(end.getDate() + 1); break;
    case 'semana': end.setDate(end.getDate() + 7); break;
    case 'mes': end.setMonth(end.getMonth() + 1); break;
    case 'trimestre': end.setMonth(end.getMonth() + 3); break;
    case 'semestre': end.setMonth(end.getMonth() + 6); break;
    case 'ano': end.setFullYear(end.getFullYear() + 1); break;
    default: end.setMonth(end.getMonth() + 1); break;
  }
  return end;
};

const calculateStatus = endDate => {
  const now = new Date();
  const diffDays = Math.ceil((new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 3) return 'expiring';
  return 'active';
};

const normalizeFirestoreDoc = snap => {
  if (!snap || !snap.exists) return null;
  const data = normalizeFirestoreValue(snap.data());
  return toCamelCase({ id: snap.id, ...data });
};

const getFirestoreDocById = async (collectionName, id) => {
  const ref = await getDocumentRefByIdOrLegacyId(collectionName, id);
  if (!ref) return null;
  const snap = await ref.get();
  return normalizeFirestoreDoc(snap);
};

const getFirestoreCollectionArray = async query => {
  const snapshot = await query.get();
  return snapshot.docs.map(doc => normalizeFirestoreDoc(doc));
};

const queryFirestoreUserByUsername = async username => {
  const userDoc = await getUserByUsername(username);
  if (!userDoc) return null;
  return normalizeFirestoreDoc(userDoc);
};

app.get('/', (req, res) => {
  res.json({ mensaje: '🚀 Servidor FitPro funcionando!' });
});

app.get('/api/productos', async (req, res) => {
  try {
    if (useFirestore) {
      const productsQuery = firestoreDb.collection('productos');
      const products = await getFirestoreCollectionArray(productsQuery);
      return res.json(products);
    }
    const result = await pool.query('SELECT * FROM productos ORDER BY id');
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.get('/api/productos/:id', async (req, res) => {
  try {
    if (useFirestore) {
      const product = await getFirestoreDocById('productos', req.params.id);
      if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
      return res.json(product);
    }
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

app.post('/api/productos', async (req, res) => {
  try {
    const { name, description, price, currency, stock, icon, image, imageUrl, category } = req.body;
    let finalImage = imageUrl || null;
    if (image && image.startsWith('data:image')) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const extension = image.split(';')[0].split('/')[1];
      const safeName = Date.now() + '-product.' + extension;
      const filePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(filePath, buffer);
      finalImage = `${getServerBaseUrl(req)}/uploads/${safeName}`;
}
    if (useFirestore) {
      const now = new Date();
      const docRef = firestoreDb.collection('productos').doc();
      const product = {
        name,
        description,
        price: Number(price),
        currency,
        stock: Number(stock),
        icon,
        image: finalImage,
        category,
        created_at: toTimestamp(now),
        updated_at: toTimestamp(now),
      };
      await docRef.set(product);
      return res.status(201).json(toCamelCase({ id: docRef.id, ...product }));
    }

    const result = await pool.query(
      `INSERT INTO productos (name, description, price, currency, stock, icon, image, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [name, description, price, currency, stock, icon, finalImage, category]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

app.put('/api/productos/:id', async (req, res) => {
  try {
    const { name, description, price, currency, stock, icon, image, imageUrl, category } = req.body;
    const productId = req.params.id;
    let finalImage = imageUrl || image || null;

    if (image && image.startsWith('data:image')) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const extension = image.split(';')[0].split('/')[1];
      const safeName = Date.now() + '-product.' + extension;
      const filePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(filePath, buffer);
      finalImage = `${getServerBaseUrl(req)}/uploads/${safeName}`;
    }

    if (useFirestore) {
      const ref = await getDocumentRefByIdOrLegacyId('productos', productId);
      if (!ref) return res.status(404).json({ error: 'Producto no encontrado' });
      const updates = {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(stock !== undefined ? { stock: Number(stock) } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(finalImage !== undefined ? { image: finalImage } : {}),
        ...(category !== undefined ? { category } : {}),
        updated_at: toTimestamp(new Date())
      };
      await ref.update(updates);
      const updatedProduct = await getFirestoreDocById('productos', productId);
      return res.json(updatedProduct);
    }

    const result = await pool.query(
      `UPDATE productos
       SET name = $1,
           description = $2,
           price = $3,
           currency = $4,
           stock = $5,
           icon = $6,
           image = $7,
           category = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, description, price, currency, stock, icon, finalImage, category, productId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

app.delete('/api/productos/:id', async (req, res) => {
  try {
    if (useFirestore) {
      const ref = await getDocumentRefByIdOrLegacyId('productos', req.params.id);
      if (!ref) return res.status(404).json({ error: 'Producto no encontrado' });
      await ref.delete();
      return res.json({ message: 'Producto eliminado correctamente' });
    }
    const result = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

app.get('/api/usuarios', async (req, res) => {
  try {
    if (useFirestore) {
      const usersQuery = firestoreDb.collection('usuarios');
      const users = await getFirestoreCollectionArray(usersQuery);
      return res.json(users);
    }
    const result = await pool.query('SELECT * FROM usuarios ORDER BY id');
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

app.get('/api/usuarios/:id', async (req, res) => {
  try {
    if (useFirestore) {
      const user = await getFirestoreDocById('usuarios', req.params.id);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      return res.json(user);
    }
    const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

app.post('/api/usuarios', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      age,
      phone,
      trainingType,
      personalizedType,
      paymentType,
      paymentStart
    } = req.body;

    if (!paymentStart) {
      return res.status(400).json({ error: 'paymentStart es obligatorio' });
    }
    const paymentStartDate = new Date(paymentStart);
    if (Number.isNaN(paymentStartDate.getTime())) {
      return res.status(400).json({ error: 'paymentStart inválido' });
    }

    const personalizedTypeValue = personalizedType || null;
    const paymentTypeValue = paymentType || 'mes';
    const paymentEndDate = calculatePaymentEnd(paymentStartDate, paymentTypeValue);
    const status = calculateStatus(paymentEndDate);

    if (useFirestore) {
      const now = new Date();
      const firstNameValue = firstName || '';
      const lastNameValue = lastName || '';
      const fullName = `${firstNameValue} ${lastNameValue}`.trim();
      const user = {
        first_name: firstNameValue,
        last_name: lastNameValue,
        full_name: fullName,
        first_name_lower: firstNameValue.toLowerCase(),
        last_name_lower: lastNameValue.toLowerCase(),
        full_name_lower: fullName.toLowerCase(),
        age: Number(age),
        phone,
        training_type: trainingType,
        personalized_type: personalizedTypeValue,
        payment_type: paymentType,
        payment_start: toTimestamp(paymentStartDate),
        payment_end: toTimestamp(paymentEndDate),
        status,
        created_at: toTimestamp(now),
        updated_at: toTimestamp(now),
      };
      const docRef = firestoreDb.collection('usuarios').doc();
      await docRef.set(user);
      return res.status(201).json(toCamelCase({ id: docRef.id, ...user }));
    }

    const result = await pool.query(
      `INSERT INTO usuarios (first_name, last_name, age, phone, training_type, personalized_type, payment_type, payment_start, payment_end, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *`,
      [firstName, lastName, age, phone, trainingType, personalizedType, paymentType, paymentStartDate, paymentEndDate, status]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.get('/api/ventas', async (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : null;
  if (req.query.userId && Number.isNaN(userId)) {
    return res.status(400).json({ error: 'userId inválido' });
  }

  try {
    if (useFirestore) {
      let ventasQuery = firestoreDb.collection('ventas');
      if (userId !== null) {
        ventasQuery = ventasQuery.where('usuario_id', '==', Number(userId));
      }
      const ventas = await getFirestoreCollectionArray(ventasQuery);
      const ventasConItems = await Promise.all(ventas.map(async venta => {
        const itemsSnapshot = await firestoreDb.collection('ventas').doc(venta.id).collection('venta_items').get();
        const items = itemsSnapshot.docs.map(normalizeFirestoreDoc);
        return { ...venta, items };
      }));
      return res.json(ventasConItems);
    }

    const ventasResult = userId
      ? await pool.query('SELECT * FROM ventas WHERE usuario_id = $1 ORDER BY created_at DESC', [userId])
      : await pool.query('SELECT * FROM ventas ORDER BY created_at DESC');
    const ventas = ventasResult.rows.map(toCamelCase);
    const ventaIds = ventas.map(venta => venta.id);
    if (ventaIds.length === 0) {
      return res.json([]);
    }
    const itemsResult = await pool.query('SELECT * FROM venta_items WHERE venta_id = ANY($1::int[]) ORDER BY id', [ventaIds]);
    const items = itemsResult.rows.map(toCamelCase);
    const ventasConItems = ventas.map(venta => ({ ...venta, items: items.filter(item => item.ventaId === venta.id) }));
    res.json(ventasConItems);
  } catch (error) {
    console.error('Error fetching ventas:', error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

app.get('/api/ventas/:id', async (req, res) => {
  const orderId = Number(req.params.id);
  if (Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'ID de orden inválido' });
  }

  try {
    if (useFirestore) {
      const order = await getFirestoreDocById('ventas', req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }
      const itemsSnapshot = await firestoreDb.collection('ventas').doc(order.id).collection('venta_items').get();
      const items = itemsSnapshot.docs.map(normalizeFirestoreDoc);
      return res.json({ ...order, items });
    }

    const orderResult = await pool.query('SELECT * FROM ventas WHERE id = $1', [orderId]);
    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    const order = toCamelCase(orderResult.rows[0]);
    const itemsResult = await pool.query('SELECT * FROM venta_items WHERE venta_id = $1 ORDER BY id', [orderId]);
    const items = itemsResult.rows.map(toCamelCase);
    res.json({ ...order, items });
  } catch (error) {
    console.error('Error fetching orden:', error);
    res.status(500).json({ error: 'Error al obtener la orden' });
  }
});

app.post('/api/ventas', async (req, res) => {
  const { customerInfo, items, total, shippingCost, currency, userId } = req.body;
  if (!customerInfo || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Información de la venta incompleta' });
  }
  const { email, fullName, phone, city, address, paymentMethod } = customerInfo;
  if (!email || !fullName || !phone || !city || !address || !paymentMethod) {
    return res.status(400).json({ error: 'Faltan datos de envío o pago' });
  }

  if (useFirestore) {
    try {
      const orderRef = firestoreDb.collection('ventas').doc();
      const now = new Date();
      const orderData = {
        usuario_id: userId || null,
        customer_email: email,
        customer_name: fullName,
        phone,
        city,
        address,
        payment_method: paymentMethod,
        total: Number(total),
        shipping_cost: Number(shippingCost),
        currency,
        created_at: toTimestamp(now),
      };

      await firestoreDb.runTransaction(async tx => {
        for (const item of items) {
          const productRef = await getDocumentRefByIdOrLegacyId('productos', item.productId);
          if (!productRef) {
            throw new Error(`Producto no encontrado: ${item.name}`);
          }
          const productSnap = await tx.get(productRef);
          const productData = productSnap.data();
          const stock = Number(productData.stock || 0);
          if (item.quantity > stock) {
            throw new Error(`Stock insuficiente para ${item.name}`);
          }
          tx.update(productRef, {
            stock: stock - Number(item.quantity),
            updated_at: toTimestamp(now),
          });
        }
        tx.set(orderRef, orderData);
        for (const item of items) {
          const itemRef = orderRef.collection('venta_items').doc();
          tx.set(itemRef, {
            producto_id: item.productId,
            name: item.name,
            quantity: Number(item.quantity),
            price: Number(item.price),
            currency: item.currency,
            created_at: toTimestamp(now),
          });
        }
      });

      return res.status(201).json({
        orderId: orderRef.id,
        customerInfo,
        items,
        total,
        shippingCost,
        currency,
        createdAt: now
      });
    } catch (error) {
      console.error('Error al registrar la venta en Firestore:', error);
      const message = error.message?.includes('Stock insuficiente') ? error.message : 'Error al procesar la venta';
      return res.status(500).json({ error: message });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const productResult = await client.query('SELECT stock FROM productos WHERE id = $1 FOR UPDATE', [item.productId]);
      if (productResult.rowCount === 0) {
        throw new Error(`Producto no encontrado: ${item.name}`);
      }
      const stock = productResult.rows[0].stock;
      if (item.quantity > stock) {
        throw new Error(`Stock insuficiente para ${item.name}`);
      }
    }
    const insertOrder = await client.query(
      `INSERT INTO ventas (usuario_id, customer_email, customer_name, phone, city, address, payment_method, total, shipping_cost, currency, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
      [userId || null, email, fullName, phone, city, address, paymentMethod, total, shippingCost, currency]
    );
    const orderId = insertOrder.rows[0].id;
    for (const item of items) {
      await client.query(
        `INSERT INTO venta_items (venta_id, producto_id, name, quantity, price, currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [orderId, item.productId, item.name, item.quantity, item.price, item.currency]
      );
      await client.query('UPDATE productos SET stock = stock - $1, updated_at = NOW() WHERE id = $2', [item.quantity, item.productId]);
    }
    await client.query('COMMIT');
    res.status(201).json({
      orderId,
      customerInfo,
      items,
      total,
      shippingCost,
      currency,
      createdAt: insertOrder.rows[0].created_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar la venta:', error);
    const message = error.message?.includes('Stock insuficiente') ? error.message : 'Error al procesar la venta';
    res.status(500).json({ error: message });
  } finally {
    client.release();
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      age,
      phone,
      trainingType,
      personalizedType,
      paymentType,
      paymentStart
    } = req.body;
    if (!paymentStart) {
      return res.status(400).json({ error: 'paymentStart es obligatorio' });
    }
    const paymentStartDate = new Date(paymentStart);
    if (Number.isNaN(paymentStartDate.getTime())) {
      return res.status(400).json({ error: 'paymentStart inválido' });
    }

    const personalizedTypeValue = personalizedType || null;
    const paymentTypeValue = paymentType || 'mes';
    const paymentEndDate = calculatePaymentEnd(paymentStartDate, paymentTypeValue);
    const status = calculateStatus(paymentEndDate);

    if (useFirestore) {
      const ref = await getDocumentRefByIdOrLegacyId('usuarios', req.params.id);
      if (!ref) return res.status(404).json({ error: 'Usuario no encontrado' });
      const firstNameValue = firstName || '';
      const lastNameValue = lastName || '';
      const fullName = `${firstNameValue} ${lastNameValue}`.trim();
      const updatePayload = {
        first_name: firstNameValue,
        last_name: lastNameValue,
        full_name: fullName,
        first_name_lower: firstNameValue.toLowerCase(),
        last_name_lower: lastNameValue.toLowerCase(),
        full_name_lower: fullName.toLowerCase(),
        age: Number(age),
        phone,
        training_type: trainingType,
        personalized_type: personalizedTypeValue,
        payment_type: paymentType,
        payment_start: toTimestamp(paymentStartDate),
        payment_end: toTimestamp(paymentEndDate),
        status,
        updated_at: toTimestamp(new Date()),
      };
      await ref.update(updatePayload);
      const updated = await ref.get();
      return res.json(normalizeFirestoreDoc(updated));
    }
    const result = await pool.query(
      `UPDATE usuarios
       SET first_name = $1, last_name = $2, age = $3, phone = $4, training_type = $5, personalized_type = $6,
           payment_type = $7, payment_start = $8, payment_end = $9, status = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [firstName, lastName, age, phone, trainingType, personalizedType, paymentType, paymentStartDate, paymentEndDate, status, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    if (useFirestore) {
      const ref = await getDocumentRefByIdOrLegacyId('usuarios', req.params.id);
      if (!ref) return res.status(404).json({ error: 'Usuario no encontrado' });
      await ref.delete();
      return res.json({ message: 'Usuario eliminado correctamente' });
    }
    const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_USER || !ADMIN_PASS || !JWT_SECRET) {
  throw new Error('Faltan variables de entorno obligatorias: ADMIN_USER, ADMIN_PASS, JWT_SECRET');
}
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '12h';

const createToken = payload => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
};

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('[/api/auth/login] received', { method: req.method, origin: req.headers.origin, url: req.originalUrl });
    const { username, password } = req.body;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'username is required' });
    }
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    }

    let authPayload;
    if (trimmedUsername === ADMIN_USER) {
      if (password !== ADMIN_PASS) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      authPayload = { role: 'admin', username: ADMIN_USER };
    } else {
      if (useFirestore) {
        const user = await queryFirestoreUserByUsername(trimmedUsername);
        if (!user) {
          return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        authPayload = {
          role: 'user',
          username: `${user.firstName} ${user.lastName}`,
          userId: user.id,
          status: user.status
        };
      } else {
        const result = await pool.query(
          `SELECT * FROM usuarios WHERE lower(first_name || ' ' || last_name) = lower($1) OR lower(first_name) = lower($1) OR lower(last_name) = lower($1)`,
          [trimmedUsername]
        );
        if (result.rowCount === 0) {
          return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        const user = toCamelCase(result.rows[0]);
        authPayload = {
          role: 'user',
          username: `${user.firstName} ${user.lastName}`,
          userId: user.id,
          status: user.status
        };
      }
    }

    const token = createToken(authPayload);
    res.json({ token, ...authPayload });
  } catch (error) {
    console.error('Error authenticating usuario:', error);
    res.status(500).json({ error: 'Error al autenticar usuario' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
