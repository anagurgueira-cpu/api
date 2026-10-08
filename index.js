const express = require('express');
const admin = require('firebase-admin');

// Inicializa o Firebase (você precisará baixar a chave de acesso no console do Firebase)
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(express.json());

// Rota que o ESP32-CAM vai chamar quando alguém passar pela câmera
app.post('/api/entrada', async (req, res) => {
  try {
    const { passageiroId, linha } = req.body;

    // Salva o registro de entrada no Firestore
    const novoRegistro = {
      passageiroId: passageiroId,
      linha: linha,
      dataHora: new Date().toISOString()
    };

    await db.collection('registros_entrada').add(novoRegistro);

    console.log("Entrada registrada com sucesso!");
    return res.status(200).json({ status: "Sucesso", mensagem: "Acesso liberado!" });
    
  } catch (error) {
    console.error("Erro ao registrar entrada:", error);
    return res.status(500).json({ status: "Erro", mensagem: error.message });
  }
});

// Inicia o servidor na porta 3000
app.listen(3000, () => {
  console.log('API rodando na porta 3000');
});