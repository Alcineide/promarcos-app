# Guia de Publicação — Promarcos Clientes no TestFlight
**App:** Promarcos Clientes  
**Bundle ID:** `br.com.mendesadvocacia.scanner`  
**Plataforma:** iOS (iPhone)  
**Serviço de build:** Expo EAS Build (compila na nuvem, sem necessidade de Mac)

---

## Pré-requisitos

| O que precisa | Onde obter |
|---|---|
| Conta Apple Developer (paga, $99/ano) | developer.apple.com — já tem |
| Conta no Expo (gratuita) | expo.dev — já tem |
| Node.js instalado no computador | nodejs.org (versão 18 ou superior) |
| Git for Windows (se usar Windows) | git-scm.com/download/win |
| Acesso ao código-fonte do projeto | Replit — marcosaurelionu |

### ⚠️ Usuários Windows — Leia antes de começar

O projeto usa scripts Unix (`sh`) que **não funcionam no CMD ou PowerShell do Windows**. Use uma destas opções:

**Opção A — Git Bash (recomendado):**
1. Instale o **Git for Windows**: [git-scm.com/download/win](https://git-scm.com/download/win)
2. Durante a instalação, deixe marcado "Git Bash Here"
3. Abra a pasta do projeto → clique direito → **"Git Bash Here"**
4. Use o Git Bash para todos os comandos abaixo

**Opção B — Ignorar os scripts (solução rápida):**
Substitua `pnpm install` por:
```bash
pnpm install --ignore-scripts
```

**Opção C — WSL (Windows Subsystem for Linux):**
Ative o WSL no Windows e use o terminal Ubuntu integrado.

---

## Parte 1 — Preparar o ambiente no computador

### 1.1 Instalar o EAS CLI
Abra o Terminal e rode:
```bash
npm install -g eas-cli
```

Verifique a instalação:
```bash
eas --version
```

### 1.2 Fazer login na conta Expo
```bash
eas login
```
Digite o e-mail e senha da conta expo.dev do escritório.

---

## Parte 2 — Baixar o código do Replit

### 2.1 Acessar o projeto no Replit
1. Acesse: **replit.com** e entre na conta do projeto
2. Abra o projeto **Mendes Advocacia / Promarcos**
3. No painel superior direito, clique em **"File tree"** para abrir o explorador de arquivos
4. Passe o mouse sobre a **pasta raiz** (primeira pasta no topo da lista)
5. Clique nos **três pontinhos `⋯`** que aparecem ao lado do nome da pasta
6. Selecione **"Download"** — isso baixa todo o projeto como `.zip`

### 2.2 Extrair o zip e entrar na pasta RAIZ

> ⚠️ **ATENÇÃO:** Instale as dependências na pasta RAIZ do projeto, não dentro de `artifacts/scanner-mobile`. O projeto usa um workspace compartilhado (pnpm workspace).

A estrutura de pastas é assim:
```
📁 workspace/                  ← PASTA RAIZ — entre aqui primeiro
  📁 artifacts/
    📁 scanner-mobile/         ← pasta do app mobile
    📁 escritorio/
    📁 api-server/
  📄 pnpm-workspace.yaml       ← confirma que é a pasta raiz
  📄 package.json
```

No Terminal:
```bash
# Entre na pasta RAIZ (onde está o arquivo pnpm-workspace.yaml)
cd caminho/para/pasta/extraida/workspace
```

### 2.3 Instalar as dependências (na pasta RAIZ)
```bash
# Instalar o pnpm caso não tenha
npm install -g pnpm

# Instalar TODAS as dependências do projeto (rodar na pasta RAIZ)
pnpm install
```

> Se aparecer o erro `Cannot determine which native SDK version...`, significa que o `pnpm install` não foi rodado na pasta raiz. Volte um nível (`cd ..`) e rode novamente.

### 2.4 Entrar na pasta do app mobile
```bash
# Só depois do pnpm install na raiz, entre na pasta do app
cd artifacts/scanner-mobile
```

---

## Parte 3 — Vincular o projeto ao Expo

### 3.1 Inicializar o EAS no projeto
Ainda dentro da pasta `artifacts/scanner-mobile`:
```bash
eas init
```

Isso vai:
- Conectar o projeto à conta Expo
- Gerar automaticamente o `projectId` e atualizar o `app.json`

> **Importante:** Após esse comando, abra o arquivo `app.json` e confirme que o campo `"projectId"` dentro de `"extra" > "eas"` foi preenchido com um ID real (não mais "SEU_PROJECT_ID_AQUI").

---

## Parte 4 — Configurar credenciais Apple

### 4.1 Configurar credenciais de forma automática
```bash
eas credentials
```

Selecione **iOS** quando perguntado.

O EAS vai pedir:
- **Apple ID** (e-mail da conta de desenvolvedor Apple)
- **Senha** (ou App-Specific Password se tiver 2FA ativado)
- **Team ID** — encontrado em developer.apple.com → Account → Membership

O EAS vai criar e gerenciar automaticamente:
- Certificado de distribuição iOS
- Provisioning Profile

### 4.2 Encontrar seu Team ID
1. Acesse: [developer.apple.com/account](https://developer.apple.com/account)
2. No menu superior, clique em **Account**
3. Role até **Membership Details**
4. Copie o **Team ID** (formato: `XXXXXXXXXX`)

Abra o arquivo `eas.json` e substitua `SEU_TEAM_ID_AQUI` pelo seu Team ID real:
```json
"submit": {
  "production": {
    "ios": {
      "appleTeamId": "XXXXXXXXXX"
    }
  }
}
```

---

## Parte 5 — Cadastrar o app no App Store Connect

Antes de submeter o build, o app precisa existir no App Store Connect.

### 5.1 Criar o app no App Store Connect
1. Acesse: [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Clique em **"Meus Apps"**
3. Clique no botão **"+"** → **"Novo App"**
4. Preencha:
   - **Plataformas:** iOS
   - **Nome:** `Promarcos Clientes`
   - **Idioma principal:** Português (Brasil)
   - **Bundle ID:** `br.com.mendesadvocacia.scanner`
   - **SKU:** `promarcos-clientes-001` (qualquer identificador único)
   - **Acesso do usuário:** Acesso total
5. Clique em **Criar**

---

## Parte 6 — Compilar o app (Build)

### 6.1 Compilar para distribuição interna (TestFlight)
```bash
eas build --platform ios --profile preview
```

Esse comando vai:
1. Enviar o código para os servidores do Expo
2. Compilar o app como arquivo `.ipa` nativo
3. Disponibilizar o link para download

**Tempo estimado:** 15 a 25 minutos (a fila pode variar)

Você verá um progresso no terminal e pode acompanhar também em:  
[expo.dev/accounts/SEU_USUARIO/projects/scanner-mobile/builds](https://expo.dev)

### 6.2 Acompanhar o build
Ao final, o EAS mostrará:
```
✅ Build finished
Artifact URL: https://expo.dev/artifacts/...
```

---

## Parte 7 — Enviar para o TestFlight

### 7.1 Submeter o build automaticamente
```bash
eas submit --platform ios --latest
```

O EAS vai pedir as credenciais Apple para acessar o App Store Connect e enviar o `.ipa` automaticamente.

**Alternativa manual:** Baixe o `.ipa` do link gerado e arraste para o App Store Connect via **Transporter** (app gratuito da Apple na Mac App Store).

### 7.2 Aguardar processamento
Após o envio, o TestFlight processa o build em **10 a 30 minutos**.  
Você receberá um e-mail da Apple confirmando.

---

## Parte 8 — Distribuir para testadores

### 8.1 Testadores internos (equipe do escritório)
1. No App Store Connect → seu app → **TestFlight**
2. Clique em **Testadores Internos**
3. Selecione o grupo ou clique em **"+"** para criar um
4. Adicione os e-mails da equipe (ex: Brenda, Marcos Aurélio)
5. Cada pessoa receberá um e-mail com convite do TestFlight
6. Elas instalam o app **TestFlight** no iPhone pelo App Store e aceitam o convite

---

## Referência rápida — Comandos mais usados

| Ação | Comando |
|---|---|
| Fazer login no Expo | `eas login` |
| Build para TestFlight | `eas build --platform ios --profile preview` |
| Enviar para TestFlight | `eas submit --platform ios --latest` |
| Build + envio de uma vez | `eas build --platform ios --profile preview --auto-submit` |
| Ver builds anteriores | `eas build:list` |
| Atualizar credenciais | `eas credentials` |

---

## Informações do projeto

| Campo | Valor |
|---|---|
| Nome do app | Promarcos Clientes |
| Bundle ID iOS | br.com.mendesadvocacia.scanner |
| Versão atual | 1.0.0 |
| Expo SDK | 54 |
| Pasta do app | `artifacts/scanner-mobile` |
| Slug Expo | `scanner-mobile` |

---

## Dúvidas frequentes

**O build falha com erro de certificado?**  
Rode `eas credentials` e selecione "Manage credentials" → "Build Credentials" → delete as antigas e crie novas automaticamente.

**Precisa de Mac?**  
Não. O EAS compila na nuvem nos servidores do Expo.

**Posso atualizar o app sem gerar um novo build?**  
Para mudanças de interface e lógica JavaScript, sim: use `eas update`. Para mudanças de permissões, ícone ou dependências nativas, é necessário um novo build.

**Como fazer um novo build após atualizar o código?**  
Baixe o código atualizado do Replit e rode novamente `eas build --platform ios --profile preview`.

---

*Documento gerado em março de 2026 — Mendes Advocacia / Promarcos*
