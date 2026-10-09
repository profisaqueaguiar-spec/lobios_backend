const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const authMiddleware = require('../middlewares/auth.middleware');

const routes = Router();

// ==========================================
// 1. POST /rh/login - Autenticação do RH
// ==========================================
routes.post('/rh/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    }

    const [rows] = await db.execute(
      'SELECT id, nome, email, senha_hash, cargo, ativo FROM usuarios_rh WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const usuario = rows[0];

    if (!usuario.ativo) {
      return res.status(403).json({ erro: 'Usuário inativo.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    // Gera o token JWT com validade de 8 horas
    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      mensagem: 'Login realizado com sucesso!',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo
      },
      token
    });

  } catch (error) {
    console.error('Erro no login do RH:', error);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// A PARTIR DAQUI, TODAS AS ROTAS EXIGEM TOKEN DE AUTENTICAÇÃO (Bearer Token)
routes.use(authMiddleware);

// ==========================================
// 2. GET /rh/relatos - Listar todos os relatos
// ==========================================
routes.get('/rh/relatos', async (req, res) => {
  try {
    const { status, categoria } = req.query;

    let query = 'SELECT id, protocolo, categoria, descricao, status, criado_em, atualizado_em FROM relatos WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (categoria) {
      query += ' AND categoria = ?';
      params.push(categoria);
    }

    query += ' ORDER BY criado_em DESC';

    const [relatos] = await db.execute(query, params);

    return res.json(relatos);
  } catch (error) {
    console.error('Erro ao listar relatos:', error);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ==========================================
// 3. GET /rh/relatos/:id - Detalhes do relato + mensagens e histórico
// ==========================================
routes.get('/rh/relatos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [relatos] = await db.execute(
      'SELECT id, protocolo, categoria, descricao, status, criado_em, atualizado_em FROM relatos WHERE id = ?',
      [id]
    );

    if (relatos.length === 0) {
      return res.status(404).json({ erro: 'Relato não encontrado.' });
    }

    // Buscar mensagens vinculadas ao relato
    const [mensagens] = await db.execute(
      'SELECT id, remetente_tipo, mensagem, criado_em FROM mensagens_relato WHERE relato_id = ? ORDER BY criado_em ASC',
      [id]
    );

    // Buscar histórico de alteração de status
    const [historico] = await db.execute(
      `SELECT h.id, h.status_anterior, h.status_novo, h.observacao_interna, h.alterado_em, u.nome as alterado_por
       FROM historico_status_relato h
       JOIN usuarios_rh u ON h.usuario_rh_id = u.id
       WHERE h.relato_id = ?
       ORDER BY h.alterado_em DESC`,
      [id]
    );

    return res.json({
      ...relatos[0],
      mensagens,
      historico_status: historico
    });

  } catch (error) {
    console.error('Erro ao buscar detalhes do relato:', error);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ==========================================
// 4. PATCH /rh/relatos/:id/status - Alterar status e gravar histórico
// ==========================================
routes.patch('/rh/relatos/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevo_status, observacao_interna } = req.body;
    const usuarioRhId = req.usuarioRh.id;

    if (!nuevo_status) {
      return res.status(400).json({ erro: 'O campo nuevo_status é obrigatório.' });
    }

    // Busca o relato atual para pegar o status antigo
    const [relatos] = await db.execute('SELECT status FROM relatos WHERE id = ?', [id]);

    if (relatos.length === 0) {
      return res.status(404).json({ erro: 'Relato não encontrado.' });
    }

    const statusAnterior = relatos[0].status;

    // Atualiza o status do relato
    await db.execute(
      'UPDATE relatos SET status = ? WHERE id = ?',
      [nuevo_status, id]
    );

    // Registra a alteração na tabela de histórico (audit log)
    const historicoId = uuidv4();
    await db.execute(
      `INSERT INTO historico_status_relato 
       (id, relato_id, usuario_rh_id, status_anterior, status_novo, observacao_interna) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [historicoId, id, usuarioRhId, statusAnterior, nuevo_status, observacao_interna || null]
    );

    return res.json({
      mensagem: 'Status atualizado com sucesso!',
      status_anterior: statusAnterior,
      status_novo: nuevo_status
    });

  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ==========================================
// 5. POST /rh/relatos/:id/mensagens - RH envia resposta para o colaborador
// ==========================================
routes.post('/rh/relatos/:id/mensagens', async (req, res) => {
  try {
    const { id } = req.params;
    const { mensagem } = req.body;

    if (!mensagem) {
      return res.status(400).json({ erro: 'O campo mensagem é obrigatório.' });
    }

    // Verifica se o relato existe
    const [relatos] = await db.execute('SELECT id FROM relatos WHERE id = ?', [id]);

    if (relatos.length === 0) {
      return res.status(404).json({ erro: 'Relato não encontrado.' });
    }

    const mensagemId = uuidv4();

    await db.execute(
      `INSERT INTO mensagens_relato (id, relato_id, remetente_tipo, mensagem) 
       VALUES (?, ?, 'RH', ?)`,
      [mensagemId, id, mensagem]
    );

    return res.status(201).json({
      mensagem: 'Resposta enviada com sucesso!'
    });

  } catch (error) {
    console.error('Erro ao enviar mensagem do RH:', error);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

module.exports = routes;