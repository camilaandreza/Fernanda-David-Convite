const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── CONEXÃO MONGODB ───────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ Variável MONGO_URI não definida!');
  process.exit(1);
}

let db;
const client = new MongoClient(MONGO_URI);

async function connectDB() {
  await client.connect();
  db = client.db('chabar'); // nome do banco no Atlas
  console.log('✅ Conectado ao MongoDB Atlas');

  // Seed: só insere se a coleção estiver vazia
  const count = await db.collection('gifts').countDocuments();
  if (count === 0) {
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await db.collection('gifts').insertMany([
      { name: 'Jogo de Panelas',       category: 'cozinha',   description: '8 peças antiaderente, fundo triplo',          img_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80', price: 350, total_qty: 1, bought_qty: 0, created_at: now },
      { name: 'Jogo de Cama King',     category: 'quarto',    description: '4 peças, 100% algodão egípcio, 400 fios',      img_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=80', price: 280, total_qty: 1, bought_qty: 0, created_at: now },
      { name: 'Aspirador de Pó Robô',  category: 'sala',      description: 'Mapeamento laser, autonomia 90min',             img_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', price: 900, total_qty: 1, bought_qty: 0, created_at: now },
      { name: 'Kit Toalhas de Banho',  category: 'banheiro',  description: '6 toalhas premium, 600g/m²',                   img_url: 'https://images.unsplash.com/photo-1600369671236-e74521d4b6ad?w=400&q=80', price: 180, total_qty: 2, bought_qty: 0, created_at: now },
      { name: 'Fritadeira Air Fryer',  category: 'cozinha',   description: '12L, digital, 10 funções, inox',               img_url: 'https://images.unsplash.com/photo-1648215263248-4c9c4fcf3cfe?w=400&q=80', price: 420, total_qty: 1, bought_qty: 0, created_at: now },
      { name: 'Conjunto de Talheres',  category: 'cozinha',   description: '24 peças inox polido, com estojo',             img_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', price: 150, total_qty: 1, bought_qty: 0, created_at: now },
    ]);
    console.log('🌱 Seed inserido com itens padrão');
  }
}

app.use(cors());
app.use(express.json());

function timestamp() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// ── ROTAS ─────────────────────────────────────────────────

// POST /api/login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === 'fernanda2025') {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Senha incorreta' });
  }
});

// GET /api/gifts
app.get('/api/gifts', async (req, res) => {
  try {
    const gifts = await db.collection('gifts').find().sort({ _id: 1 }).toArray();
    // Converte _id do Mongo para id numérico esperado pelo frontend
    const data = gifts.map(g => ({ ...g, id: g._id.toString(), _id: undefined }));
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/gifts
app.post('/api/gifts', async (req, res) => {
  try {
    const { name, category, description, img_url, price, total_qty } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: 'Nome obrigatório' });
    const gift = {
      name: name.trim(),
      category: category || 'outros',
      description: description || '',
      img_url: img_url || '',
      price: parseFloat(price) || 0,
      total_qty: parseInt(total_qty) || 1,
      bought_qty: 0,
      created_at: timestamp(),
    };
    const result = await db.collection('gifts').insertOne(gift);
    await db.collection('logs').insertOne({ gift_id: result.insertedId.toString(), gift_name: gift.name, action: 'criado', created_at: timestamp() });
    res.status(201).json({ ok: true, data: { ...gift, id: result.insertedId.toString() } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PUT /api/gifts/:id
app.put('/api/gifts/:id', async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const { name, category, description, img_url, price, total_qty } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: 'Nome obrigatório' });
    const update = { name, category, description, img_url, price: parseFloat(price) || 0, total_qty: parseInt(total_qty) || 1 };
    const result = await db.collection('gifts').findOneAndUpdate({ _id }, { $set: update }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ ok: false, error: 'Não encontrado' });
    await db.collection('logs').insertOne({ gift_id: req.params.id, gift_name: name, action: 'editado', created_at: timestamp() });
    res.json({ ok: true, data: { ...result, id: result._id.toString(), _id: undefined } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PATCH /api/gifts/:id/mark
app.patch('/api/gifts/:id/mark', async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const gift = await db.collection('gifts').findOne({ _id });
    if (!gift) return res.status(404).json({ ok: false, error: 'Não encontrado' });
    if (gift.bought_qty >= gift.total_qty)
      return res.status(409).json({ ok: false, error: 'Já completamente reservado' });
    const updated = await db.collection('gifts').findOneAndUpdate({ _id }, { $inc: { bought_qty: 1 } }, { returnDocument: 'after' });
    await db.collection('logs').insertOne({ gift_id: req.params.id, gift_name: gift.name, action: 'marcado como presenteado', created_at: timestamp() });
    res.json({ ok: true, data: { ...updated, id: updated._id.toString(), _id: undefined } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PATCH /api/gifts/:id/unmark
app.patch('/api/gifts/:id/unmark', async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const gift = await db.collection('gifts').findOne({ _id });
    if (!gift) return res.status(404).json({ ok: false, error: 'Não encontrado' });
    const newQty = Math.max(0, gift.bought_qty - 1);
    const updated = await db.collection('gifts').findOneAndUpdate({ _id }, { $set: { bought_qty: newQty } }, { returnDocument: 'after' });
    await db.collection('logs').insertOne({ gift_id: req.params.id, gift_name: gift.name, action: 'marcação desfeita', created_at: timestamp() });
    res.json({ ok: true, data: { ...updated, id: updated._id.toString(), _id: undefined } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE /api/gifts/:id
app.delete('/api/gifts/:id', async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const gift = await db.collection('gifts').findOne({ _id });
    if (!gift) return res.status(404).json({ ok: false, error: 'Não encontrado' });
    await db.collection('gifts').deleteOne({ _id });
    await db.collection('logs').insertOne({ gift_id: req.params.id, gift_name: gift.name, action: 'removido', created_at: timestamp() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/logs
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await db.collection('logs').find().sort({ _id: -1 }).limit(50).toArray();
    const data = logs.map(l => ({ ...l, id: l._id.toString(), _id: undefined }));
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── INICIALIZA ────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🌿 Servidor rodando na porta ${PORT}`);
  });
}).catch(err => {
  console.error('❌ Erro ao conectar ao MongoDB:', err);
  process.exit(1);
});
