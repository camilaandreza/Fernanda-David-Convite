const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── BANCO DE DADOS (JSON file — sem dependências nativas) ──
const DB_PATH = path.join(__dirname, 'chabar.json');

function readDB() {
  if (!fs.existsSync(DB_PATH)) return { gifts: [], logs: [], nextId: 1 };
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { gifts: [], logs: [], nextId: 1 }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function timestamp() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function addLog(db, giftId, giftName, action) {
  db.logs.unshift({ id: Date.now(), gift_id: giftId, gift_name: giftName, action, created_at: timestamp() });
  if (db.logs.length > 100) db.logs = db.logs.slice(0, 100);
}

// Seed inicial
if (!fs.existsSync(DB_PATH)) {
  const db = readDB();
  db.gifts = [
    { id: 1, name: 'Jogo de Panelas', category: 'cozinha', description: '8 peças antiaderente, fundo triplo', img_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80', buy_link: 'https://www.amazon.com.br', total_qty: 1, bought_qty: 0, created_at: timestamp() },
    { id: 2, name: 'Jogo de Cama King', category: 'quarto', description: '4 peças, 100% algodão egípcio, 400 fios', img_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=80', buy_link: 'https://www.tokstok.com.br', total_qty: 1, bought_qty: 0, created_at: timestamp() },
    { id: 3, name: 'Aspirador de Pó Robô', category: 'sala', description: 'Mapeamento laser, autonomia 90min', img_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', buy_link: 'https://www.magazineluiza.com.br', total_qty: 1, bought_qty: 0, created_at: timestamp() },
    { id: 4, name: 'Kit Toalhas de Banho', category: 'banheiro', description: '6 toalhas premium, 600g/m², 100% algodão', img_url: 'https://images.unsplash.com/photo-1600369671236-e74521d4b6ad?w=400&q=80', buy_link: 'https://www.casasbahia.com.br', total_qty: 2, bought_qty: 0, created_at: timestamp() },
    { id: 5, name: 'Fritadeira Air Fryer', category: 'cozinha', description: '12L, digital, 10 funções, inox', img_url: 'https://images.unsplash.com/photo-1648215263248-4c9c4fcf3cfe?w=400&q=80', buy_link: 'https://www.americanas.com.br', total_qty: 1, bought_qty: 0, created_at: timestamp() },
    { id: 6, name: 'Conjunto de Talheres', category: 'cozinha', description: '24 peças inox polido, com estojo', img_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', buy_link: 'https://www.tokstok.com.br', total_qty: 1, bought_qty: 0, created_at: timestamp() },
  ];
  db.nextId = 10;
  writeDB(db);
  console.log('✅ Banco criado com itens padrão');
}

// ── ROTAS ─────────────────────────────────────────────────

// GET /api/gifts
app.get('/api/gifts', (req, res) => {
  const db = readDB();
  res.json({ ok: true, data: db.gifts });
});

// POST /api/gifts
app.post('/api/gifts', (req, res) => {
  const { name, category, description, img_url, buy_link, total_qty } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'Nome obrigatório' });
  const db = readDB();
  const gift = {
    id: db.nextId++,
    name: name.trim(),
    category: category || 'outros',
    description: description || '',
    img_url: img_url || '',
    buy_link: buy_link || '',
    total_qty: parseInt(total_qty) || 1,
    bought_qty: 0,
    created_at: timestamp(),
  };
  db.gifts.push(gift);
  addLog(db, gift.id, gift.name, 'criado');
  writeDB(db);
  res.status(201).json({ ok: true, data: gift });
});

// PUT /api/gifts/:id
app.put('/api/gifts/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const idx = db.gifts.findIndex(g => g.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Não encontrado' });
  const { name, category, description, img_url, buy_link, total_qty } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'Nome obrigatório' });
  db.gifts[idx] = { ...db.gifts[idx], name, category, description, img_url, buy_link, total_qty: parseInt(total_qty) || 1 };
  addLog(db, id, name, 'editado');
  writeDB(db);
  res.json({ ok: true, data: db.gifts[idx] });
});

// PATCH /api/gifts/:id/mark
app.patch('/api/gifts/:id/mark', (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const gift = db.gifts.find(g => g.id === id);
  if (!gift) return res.status(404).json({ ok: false, error: 'Não encontrado' });
  if (gift.bought_qty >= gift.total_qty)
    return res.status(409).json({ ok: false, error: 'Já completamente reservado' });
  gift.bought_qty++;
  addLog(db, id, gift.name, 'marcado como presenteado');
  writeDB(db);
  res.json({ ok: true, data: gift });
});

// PATCH /api/gifts/:id/unmark
app.patch('/api/gifts/:id/unmark', (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const gift = db.gifts.find(g => g.id === id);
  if (!gift) return res.status(404).json({ ok: false, error: 'Não encontrado' });
  gift.bought_qty = Math.max(0, gift.bought_qty - 1);
  addLog(db, id, gift.name, 'marcação desfeita');
  writeDB(db);
  res.json({ ok: true, data: gift });
});

// DELETE /api/gifts/:id
app.delete('/api/gifts/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const gift = db.gifts.find(g => g.id === id);
  if (!gift) return res.status(404).json({ ok: false, error: 'Não encontrado' });
  db.gifts = db.gifts.filter(g => g.id !== id);
  addLog(db, id, gift.name, 'removido');
  writeDB(db);
  res.json({ ok: true });
});

// GET /api/logs
app.get('/api/logs', (req, res) => {
  const db = readDB();
  res.json({ ok: true, data: db.logs.slice(0, 50) });
});

// Fallback → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🌿 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📦 Banco de dados: ${DB_PATH}`);
});
