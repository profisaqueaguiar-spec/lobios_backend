const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

async function criarUsuarioRH() {
  try {
    const id = uuidv4();
    const nome = 'Admin Lobios';
    const email = 'admin@lobios.com.br';
    const senhaLimpa = 'admin123';
    const senha_hash = await bcrypt.hash(senhaLimpa, 10);
    const cargo = 'Analista de RH';

    // Verifica se já existe o e-mail cadastrado
    const [existente] = await db.execute('SELECT id FROM usuarios_rh WHERE email = ?', [email]);
    if (existente.length > 0) {
      console.log('⚠️ Usuário de RH já cadastrado!');
      process.exit(0);
    }

    await db.execute(
      'INSERT INTO usuarios_rh (id, nome, email, senha_hash, cargo, ativo) VALUES (?, ?, ?, ?, ?, TRUE)',
      [id, nome, email, senha_hash, cargo]
    );

    console.log('✅ Usuário de RH criado com sucesso!');
    console.log(`📧 E-mail: ${email}`);
    console.log(`🔑 Senha: ${senhaLimpa}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar usuário de RH:', error);
    process.exit(1);
  }
}

criarUsuarioRH();