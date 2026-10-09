const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const db = require('../database');

const routes = Router();

// Função utilitária para gerar protocolo amigável (ex: LOB-2026-X8A9)
function gerarProtocolo() {
  const sufixo = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ano = new Date().getFullYear();
  return `LOB-${ano}-${sufixo}`;
}

// 1. POST /manifestacoes - Enviar Relato Anônimo
routes.post('/manifestacoes', async (req, res) => {
  try {
    const { categoria, descricao, senha } = req.body;

    if (!categoria || !descricao || !senha) {
      return res.status(400).json({ 
        erro: 'Os campos categoria, descricao e senha são obrigatórios.' 
      });
    }

    const id = uuidv4();
    const protocolo = gerarProtocolo();
    
    // Hash da senha do protocolo para o colaborador poder consultar depois
    const senha_hash = await bcrypt.hash(senha, 10);

    const query = `
      INSERT INTO relatos (id, protocolo, senha_hash, categoria, descricao, status) 
      VALUES (?, ?, ?, ?, ?, 'Recebido')
    `;

    await db.execute(query, [id, protocolo, senha_hash, categoria, descricao]);

    return res.status(201).json({
      mensagem: 'Manifestação registrada com sucesso!',
      protocolo,
      status: 'Recebido'
    });

  } catch (error) {
    console.error('Erro ao registrar manifestação:', error);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// 2. POST /manifestacoes/acompanhar - Consultar Status por Protocolo e Senha
// (Usamos POST para enviar a senha no body de forma segura)
routes.post('/manifestacoes/acompanhar', async (req, res) => {
  try {
    const { protocolo, senha } = req.body;

    if (!protocolo || !senha) {
      return res.status(400).json({ 
        erro: 'Protocolo e senha são obrigatórios.' 
      });
    }

    // Busca o relato pelo protocolo
    const [rows] = await db.execute(
      'SELECT id, protocolo, senha_hash, categoria, descricao, status, criado_em, atualizado_em FROM relatos WHERE protocolo = ?',
      [protocolo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Manifestação não encontrada.' });
    }

    const relato = rows[0];

    // Valida se a senha enviada confere com o hash salvo
    const senhaValida = await bcrypt.compare(senha, relato.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha incorreta para este protocolo.' });
    }

    // Busca mensagens trocadas no relato
    const [mensagens] = await db.execute(
      'SELECT id, remetente_tipo, mensagem, criado_em FROM mensagens_relato WHERE relato_id = ? ORDER BY criado_em ASC',
      [relato.id]
    );

    // Remove o hash da senha da resposta
    delete relato.senha_hash;

    return res.json({
      ...relato,
      mensagens
    });

  } catch (error) {
    console.error('Erro ao consultar manifestação:', error);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// 3. GET /manifestacoes/:protocolo - Consulta Básica de Status Apenas com o Protocolo
routes.get('/manifestacoes/:protocolo', async (req, res) => {
  try {
    const { protocolo } = req.params;

    const [rows] = await db.execute(
      'SELECT protocolo, categoria, status, criado_em, atualizado_em FROM relatos WHERE protocolo = ?',
      [protocolo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Manifestação não encontrada.' });
    }

    return res.json(rows[0]);

  } catch (error) {
    console.error('Erro ao buscar status da manifestação:', error);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = routes;