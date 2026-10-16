const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || "SUA_STRING_MONGODB_ATLAS_AQUI";
let db;

// Conexão com MongoDB Atlas
MongoClient.connect(mongoUri)
  .then(client => {
    console.log("Conectado com sucesso ao MongoDB Atlas!");
    db = client.db("fretado_db");
  })
  .catch(err => console.error("Erro de conexão com MongoDB:", err));

// Middleware para verificar se a BD está pronta
app.use((req, res, next) => {
  if (!db) {
    return res.status(500).json({ erro: "Banco de dados não conectado. Verifique o MONGODB_URI no Render e o IP Access no Atlas." });
  }
  next();
});

// ROTA DE REGISTRO (Suporta Funcionário por RG e Motorista Terceirizado)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { tipo, nome, identificador, senha, empresaTerceirizada, placaOnibus, linha } = req.body;
    // tipo: 'funcionario' ou 'motorista'
    // identificador: RG do funcionário ou CPF/CNH do motorista

    if (!tipo || !nome || !identificador || !senha) {
      return res.status(400).json({ erro: "Campos obrigatórios ausentes (tipo, nome, identificador/RG, senha)." });
    }

    const usuarios = db.collection('usuarios');
    const usuarioExistente = await usuarios.findOne({ identificador });

    if (usuarioExistente) {
      return res.status(400).json({ erro: "Usuário com este documento/RG já cadastrado." });
    }

    const novoUsuario = {
      tipo,
      nome,
      identificador, // RG do Funcionário ou CNH/CPF do Motorista
      senha, // Recomendado usar bcrypt em produção
      empresaTerceirizada: empresaTerceirizada || null,
      placaOnibus: placaOnibus || null,
      linha: linha || null,
      criadoEm: new Date()
    };

    await usuarios.insertOne(novoUsuario);
    res.status(201).json({ mensagem: "Cadastro realizado com sucesso!", usuario: { nome, tipo, identificador } });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao cadastrar usuário: " + err.message });
  }
});

// ROTA DE LOGIN (Por RG/Identificador + Senha)
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
        empresaTerceirizada: usuario.empresaTerceirizada,
        placaOnibus: usuario.placaOnibus,
        linha: usuario.linha
      }
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao realizar login: " + err.message });
  }
});

// ROTA PARA REGISTRO DE EMBARQUE (Para Lovable, ESP32-CAM e Leitor)
app.post('/api/entrada', async (req, res) => {
  try {
    const { passageiroId, rg, linha, motoristaId, placaOnibus, empresaTerceirizada } = req.body;

    const entradas = db.collection('registros_entrada');
    const novoEmbarque = {
      passageiroId: passageiroId || rg || "Não Identificado",
      rg: rg || passageiroId,
      linha: linha || "Linha Principal",
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

// ROTA PARA LISTAR EMBARQUES
app.get('/api/entradas', async (req, res) => {
  try {
    const entradas = db.collection('registros_entrada');
    const lista = await entradas.find().sort({ dataHora: -1 }).limit(100).toArray();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar registros: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));