const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors());
// Aumentado o limite de payload para permitir o upload de fotos/ficheiros de atestados em base64
app.use(express.json({ limit: '10mb' }));

const mongoUri = process.env.MONGODB_URI || "SUA_STRING_MONGODB_ATLAS_AQUI";
let db;

// Conexão com MongoDB Atlas
MongoClient.connect(mongoUri)
  .then(client => {
    console.log("Conectado com sucesso ao MongoDB Atlas!");
    db = client.db("fretado_db");
  })
  .catch(err => console.error("Erro de conexão com MongoDB:", err));

// Middleware de verificação do Banco de Dados
app.use((req, res, next) => {
  if (!db) {
    return res.status(500).json({ erro: "Banco de dados não conectado. Verifique o MONGODB_URI no Render e o IP Access no Atlas." });
  }
  next();
});

// ==========================================
// 1. AUTENTICAÇÃO (CADASTRO E LOGIN)
// ==========================================

// Cadastro de Funcionário ou Motorista Terceirizado
app.post('/api/auth/register', async (req, res) => {
  try {
    const { tipo, nome, identificador, senha, empresaTerceirizada, placaOnibus, linha, pontoDefeito } = req.body;

    if (!tipo || !nome || !identificador || !senha) {
      return res.status(400).json({ erro: "Campos obrigatórios ausentes (tipo, nome, identificador/RG, senha)." });
    }

    const usuarios = db.collection('usuarios');
    const usuarioExistente = await usuarios.findOne({ identificador });

    if (usuarioExistente) {
      return res.status(400).json({ erro: "Usuário com este documento/RG já cadastrado." });
    }

    const novoUsuario = {
      tipo, // 'funcionario' ou 'motorista'
      nome,
      identificador, // RG do funcionário ou CNH do motorista
      senha,
      empresaTerceirizada: empresaTerceirizada || null,
      placaOnibus: placaOnibus || null,
      linha: linha || null,
      pontoParada: pontoDefeito || "Ponto Principal",
      criadoEm: new Date()
    };

    await usuarios.insertOne(novoUsuario);
    res.status(201).json({ mensagem: "Cadastro realizado com sucesso!", usuario: { nome, tipo, identificador } });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao cadastrar usuário: " + err.message });
  }
});

// Login por RG/Identificador + Senha
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identificador, senha } = req.body;

    if (!identificador || !senha) {
      return res.status(400).json({ erro: "Informe o RG/Identificador e a senha." });
    }

    const usuarios = db.collection('usuarios');
    const usuario = await usuarios.findOne({ identificador, senha });

    if (!usuario) {
      return res.status(401).json({ erro: "RG/Identificador ou senha incorretos." });
    }

    res.json({
      mensagem: "Login efetuado com sucesso!",
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        tipo: usuario.tipo,
        identificador: usuario.identificador,
        pontoParada: usuario.pontoParada,
        empresaTerceirizada: usuario.empresaTerceirizada,
        placaOnibus: usuario.placaOnibus,
        linha: usuario.linha
      }
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao realizar login: " + err.message });
  }
});

// Atualizar Ponto/Parada Selecionado
app.put('/api/usuario/ponto', async (req, res) => {
  try {
    const { identificador, pontoParada } = req.body;
    const usuarios = db.collection('usuarios');
    await usuarios.updateOne({ identificador }, { $set: { pontoParada } });
    res.json({ mensagem: "Ponto de parada atualizado com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar ponto." });
  }
});

// ==========================================
// 2. EMBARQUES E CHECK-IN (Lovable & ESP32-CAM)
// ==========================================

app.post('/api/entrada', async (req, res) => {
  try {
    const { passageiroId, rg, nome, linha, pontoParada, motoristaId, placaOnibus, empresaTerceirizada } = req.body;

    const entradas = db.collection('registros_entrada');
    const novoEmbarque = {
      passageiroId: passageiroId || rg || "Não Identificado",
      rg: rg || passageiroId,
      nome: nome || "Passageiro",
      linha: linha || "Linha Principal",
      pontoParada: pontoParada || "Ponto Geral",
      motoristaId: motoristaId || "Terceirizado",
      placaOnibus: placaOnibus || "N/A",
      empresaTerceirizada: empresaTerceirizada || "N/A",
      dataHora: new Date(),
      status: "Embarcado"
    };

    await entradas.insertOne(novoEmbarque);
    res.status(201).json({ mensagem: "Entrada registrada com sucesso!", embarque: novoEmbarque });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao registrar entrada: " + err.message });
  }
});

app.get('/api/entradas', async (req, res) => {
  try {
    const entradas = db.collection('registros_entrada');
    const lista = await entradas.find().sort({ dataHora: -1 }).limit(100).toArray();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar registros." });
  }
});

// Histórico do Funcionário Logado
app.get('/api/entradas/usuario/:rg', async (req, res) => {
  try {
    const { rg } = req.params;
    const entradas = db.collection('registros_entrada');
    const historico = await entradas.find({ $or: [{ rg }, { passageiroId: rg }] }).sort({ dataHora: -1 }).toArray();
    res.json(historico);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao carregar histórico." });
  }
});

// ==========================================
// 3. REGISTRO DE AUSÊNCIAS E ATESTADOS
// ==========================================

app.post('/api/ausencia', async (req, res) => {
  try {
    const { usuarioId, nome, rg, motivo, observacao, arquivoAtestado } = req.body;
    const ausencias = db.collection('ausencias');
    const novoRegistro = {
      usuarioId,
      nome,
      rg,
      motivo, // 'Atestado', 'Férias', 'Motivo Pessoal', 'Outro'
      observacao: observacao || '',
      arquivoAtestado: arquivoAtestado || null, // Imagem/PDF em Base64
      dataRegistro: new Date()
    };
    await ausencias.insertOne(novoRegistro);
    res.status(201).json({ mensagem: "Ausência registrada com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao registrar ausência: " + err.message });
  }
});

app.get('/api/ausencias', async (req, res) => {
  try {
    const ausencias = db.collection('ausencias');
    const lista = await ausencias.find().sort({ dataRegistro: -1 }).toArray();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao consultar ausências." });
  }
});

// ==========================================
// 4. CENTRAL DE SUPORTE (ADMIN)
// ==========================================

app.post('/api/suporte', async (req, res) => {
  try {
    const { usuarioId, nome, rg, mensagem } = req.body;
    const suportes = db.collection('suportes');
    await suportes.insertOne({
      usuarioId,
      nome,
      rg,
      mensagem,
      status: 'Pendente',
      dataCriacao: new Date()
    });
    res.status(201).json({ mensagem: "Solicitação de suporte enviada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao registrar suporte." });
  }
});

app.get('/api/suporte', async (req, res) => {
  try {
    const suportes = db.collection('suportes');
    const lista = await suportes.find().sort({ dataCriacao: -1 }).toArray();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar solicitações de suporte." });
  }
});

// ==========================================
// 5. ALERTAS DE TRÂNSITO E AVISOS
// ==========================================

app.post('/api/alertas', async (req, res) => {
  try {
    const { linha, mensagem, nivel } = req.body; // nivel: 'Atenção', 'Atraso', 'Normal'
    const alertas = db.collection('alertas_transito');
    await alertas.insertOne({ linha, mensagem, nivel, data: new Date() });
    res.status(201).json({ mensagem: "Alerta emitido com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao emitir alerta." });
  }
});

app.get('/api/alertas', async (req, res) => {
  try {
    const alertas = db.collection('alertas_transito');
    const lista = await alertas.find().sort({ data: -1 }).limit(10).toArray();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar alertas." });
  }
});

// ==========================================
// 6. DASHBOARD DE MÉTRICAS (ADMIN)
// ==========================================

app.get('/api/metricas', async (req, res) => {
  try {
    const entradas = db.collection('registros_entrada');
    const usuarios = db.collection('usuarios');
    const ausencias = db.collection('ausencias');

    const totalEmbarquesHoje = await entradas.countDocuments();
    const totalUsuarios = await usuarios.countDocuments({ tipo: 'funcionario' });
    const totalAusencias = await ausencias.countDocuments();

    res.json({
      totalEmbarquesHoje,
      totalUsuarios,
      totalAusencias
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar métricas." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));





