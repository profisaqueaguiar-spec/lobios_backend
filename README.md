O **Lobios Ouvidoria** resolve o problema do receio de retaliação no ambiente de trabalho, oferecendo um canal de comunicação bidirecional onde colaboradores podem registar manifestações sem fornecer dados pessoais ou identificadores de dispositivos.

### Destaques do Sistema
* **Anonimato Garantido:** Isento de recolha de IP ou metadados de utilizadores.
* **Acompanhamento Seguro:** Acesso ao relato via combinação única de Protocolo + Hash de Senha.
* **Painel Administrativo do RH:** Autenticação via JWT para gestão de status e respostas diretas ao colaborador.
* **Audit Log (Histórico):** Registo automático de todas as alterações de status realizadas pelo RH.

---

## 🚀 Tecnologias Utilizadas

* **Runtime:** Node.js
* **Framework Web:** Express
* **Base de Dados:** MySQL (via `mysql2/promise`)
* **Segurança e Autenticação:** `bcrypt` (hash de senhas) e `jsonwebtoken` (JWT)
* **Utilitários:** `uuid` (identificadores únicos) e `dotenv` (variáveis de ambiente)

---

## ⚙️ Pré-requisitos

Antes de iniciar, garante que tens instalado na tua máquina:
* [Node.js](https://nodejs.org/) (versão 18 ou superior)
* [XAMPP](https://www.apachefriends.org/) (ou um servidor MySQL ativo na porta `3306`)
* Um cliente HTTP para testes (ex: [Insomnia](https://insomnia.rest/) ou [Postman](https://www.postman.com/))

---

## 📦 Como Instalar e Executar

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/teu-usuario/lobios-backend.git
   cd lobios-backend
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Configurar a Base de Dados:**
   * Inicia os serviços **Apache** e **MySQL** no XAMPP.
   * Cria uma base de dados chamada `lobios_ouvidoria` no phpMyAdmin (`http://localhost/phpmyadmin`).
   * Executa o script SQL (disponível no ficheiro `schema.sql`) para criar as tabelas.

4. **Configurar as Variáveis de Ambiente:**
   Cria um ficheiro `.env` na raiz do projeto com base no `.env.example`:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=
   DB_NAME=lobios_ouvidoria
   DB_PORT=3306

   JWT_SECRET=sua_chave_secreta_super_segura
   ```

5. **Popular a base de dados com o utilizador inicial do RH (Seed):**
   ```bash
   node src/seed.js
   ```

6. **Iniciar o servidor em modo de desenvolvimento:**
   ```bash
   npm run dev
   ```
   A API estará a rodar no endereço: `http://localhost:3000`

---

## 🛣️ Rotas da API

### Módulo Público (Colaborador)
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/v1/manifestacoes` | Regista um novo relato anónimo |
| `GET` | `/api/v1/manifestacoes/status/:protocolo` | Consulta rápida de status por protocolo |
| `POST` | `/api/v1/manifestacoes/acompanhar` | Exibe o relato e mensagens via Protocolo + Senha |

### Módulo Administrativo (RH) — Requer Bearer Token
| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/v1/rh/login` | Autentica o RH e devolve o Token JWT |
| `GET` | `/api/v1/rh/relatos` | Lista todas as manifestações (com filtros) |
| `GET` | `/api/v1/rh/relatos/:id` | Exibe detalhes, histórico e mensagens do relato |
| `PATCH`| `/api/v1/rh/relatos/:id/status` | Atualiza o status do relato e gera histórico |
| `POST` | `/api/v1/rh/relatos/:id/mensagens` | Envia uma resposta ao colaborador |

---