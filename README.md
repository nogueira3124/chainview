# ChainView — Portfolio Crypto

Gestor de portfólio crypto com carteiras EVM e posições DeFi.

## Instalação local

```bash
# 1. Instalar dependências
npm install

# 2. Correr em modo desenvolvimento
npm run dev
```

Abre http://localhost:5173 no browser.

## Deploy no Vercel

### Opção A — Via GitHub (recomendado)

1. Cria um repositório no GitHub e faz push desta pasta:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/SEU_USER/chainview.git
   git push -u origin main
   ```

2. Vai a [vercel.com](https://vercel.com), clica **Add New Project**
3. Importa o repositório GitHub
4. Deixa as configurações por defeito (Vite é detectado automaticamente)
5. Clica **Deploy** — fica online em ~1 minuto

### Opção B — Via Vercel CLI

```bash
npm install -g vercel
vercel
```

## Build para produção

```bash
npm run build
```

Os ficheiros ficam em `/dist`.

## Tecnologias

- React 18
- Vite
- Tailwind CSS

## Próximos passos

- [ ] Integração Alchemy API (saldos e transações reais)
- [ ] Preços em tempo real via CoinGecko
- [ ] Posições DeFi via DeBank API
