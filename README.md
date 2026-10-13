# Organizador de Ideias

Aplicativo para capturar, desenvolver e organizar ideias em um só lugar. Cada ideia pode reunir anotações, imagens, fluxogramas, workflows e checklists, com uma interface responsiva para celular e desktop.

## Baixar o aplicativo Android

- **APK mais recente:** [Baixar o Organizador de Ideias para Android](https://github.com/marcos-scox/organizador-de-ideias/releases/latest)
- **Código-fonte:** https://github.com/marcos-scox/organizador-de-ideias
- **Site online:** https://marcos-scox.github.io/organizador-de-ideias/

Na página da versão mais recente, baixe o arquivo `app-debug.apk`. No Android, autorize a instalação de aplicativos baixados da fonte escolhida e abra o APK para instalar.

> O APK é gerado automaticamente pelo GitHub Actions a cada versão marcada no formato `v1.0.0`. Também é possível baixar o APK gerado na aba **Actions**, em **Artifacts**, para cada execução manual.

## Funcionalidades

- Criar, pesquisar e excluir ideias;
- Editar títulos e blocos de texto;
- Adicionar imagens por seleção de arquivo, arrastar e soltar ou `Ctrl+V`;
- Criar fluxogramas com etapas, decisões, conexões e movimentação dos nós;
- Montar workflows com status pendente, em andamento e feito;
- Criar checklists com acompanhamento de itens concluídos;
- Salvar automaticamente os dados no armazenamento local do aplicativo;
- Layout responsivo e suporte a navegação por teclado;
- Funciona como aplicativo Android usando Capacitor, com a mesma interface do site.

## Sobre

O aplicativo usa uma identidade visual em fundo preto com uma lâmpada dourada acesa, representando ideias que ganham forma. A seção **Sobre o aplicativo**, disponível no menu lateral, apresenta a plataforma, o criador e o link para o código-fonte.

O projeto é mantido por [Marcos Dev](https://github.com/marcos-scox) e está disponível no [GitHub](https://github.com/marcos-scox/organizador-de-ideias). A plataforma é uma aplicação web empacotada para Android com Capacitor, com armazenamento local e sem exigir conta para uso básico.

## Como usar

### No Android

1. Baixe o [APK mais recente](https://github.com/marcos-scox/organizador-de-ideias/releases/latest).
2. Instale o aplicativo no celular.
3. Toque em **Nova ideia**.
4. Dê um nome à ideia e escreva o conteúdo.
5. Use os botões no final da página para adicionar texto, fluxograma, workflow, checklist ou imagem.

### Usando o site publicado

1. Acesse o [site do Organizador de Ideias](https://marcos-scox.github.io/organizador-de-ideias/).
2. Clique em **Nova ideia**.
3. Dê um nome à ideia e escreva o conteúdo.
4. Use os botões no final da página para adicionar texto, fluxograma, workflow, checklist ou imagem.

> Os dados são armazenados localmente no aplicativo ou navegador. Se os dados forem apagados ou você trocar de dispositivo, as ideias não serão transferidas automaticamente.

### Executando localmente

Para abrir o site sem instalar dependências:

```bash
python3 -m http.server 8000
```

Depois, abra <http://localhost:8000>.

Para preparar o projeto Android, é necessário Node.js, Java 21 e Android SDK:

```bash
npm ci
npm run android:sync
npm run android:build
```

O APK será gerado em `android/app/build/outputs/apk/debug/app-debug.apk`.

## Estrutura do projeto

```text
organizador-de-ideias/
├── index.html                 # Interface principal
├── src/
│   ├── app.js                 # Estado, renderização e interações
│   └── styles.css             # Estilos e layout responsivo
├── android/                   # Projeto nativo Android gerado pelo Capacitor
├── capacitor.config.json      # Identidade e configuração do aplicativo
├── package.json               # Scripts e dependências Android
├── .github/workflows/
│   ├── deploy-pages.yml       # Publicação automática do site
│   └── android.yml            # Build e Release do APK
└── README.md                  # Documentação do projeto
```

## Publicação

O site é publicado automaticamente no GitHub Pages sempre que há um push na branch `main`. O APK é gerado no GitHub Actions a cada tag de versão, como `v1.0.0`, e anexado automaticamente à Release correspondente.

## Criador

Criado por **Marcos Dev** ([marcos-scox](https://github.com/marcos-scox)).

## Licença

Este projeto está disponível sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
