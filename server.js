const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());
app.use(cors());

const uri = "mongodb+srv://anagurgueira_db_user:OaiADSR5uJyEMPXE@cluster0.yhyhjie.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri);

let db;

async function conectarBanco() {
  try {
    await client.connect();
    db = client.db('FretadoSmart');
    console.log('Conectado com sucesso ao MongoDB Atlas!');
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
  }
}

conectarBanco();

app.post('/api/entrada', async (req, res) => {
  try {
    const { passageiroId, linha } = req.body;

    const novoRegistro = {
      passageiroId: passageiroId || "Passageiro Teste",
      linha: linha || "Linha Principal",
      dataHora: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), // <--- Atualize para esta linha
      status: "Liberado"
    };

    const colecao = db.collection('registros_entrada');
    await colecao.insertOne(novoRegistro);

    console.log("Entrada registrada com sucesso no MongoDB!");
    return res.status(200).json({ status: "Sucesso", mensagem: "Acesso liberado!" });
    
  } catch (error) {
    console.error("Erro ao registrar entrada:", error);
    return res.status(500).json({ status: "Erro", mensagem: error.message });
  }
});

// Rota para listar os passageiros que já entraram
app.get('/api/entradas', async (req, res) => {
  try {
    const colecao = db.collection('registros_entrada');
    // Busca os registos ordenados do mais recente para o mais antigo (limite de 50)
    const registros = await colecao.find({}).sort({ _id: -1 }).limit(50).toArray();
    return res.status(200).json(registros);
  } catch (error) {
    console.error("Erro ao buscar registros:", error);
    return res.status(500).json({ status: "Erro", mensagem: error.message });
  }
});

app.listen(3000, () => {
  console.log('API rodando na porta 3000');
});