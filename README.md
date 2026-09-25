# Organizador de Ideias

Aplicação web para capturar, desenvolver e organizar ideias em um só lugar. Cada ideia pode reunir anotações, imagens, fluxogramas, workflows e checklists, com uma interface responsiva para desktop e celular.

## Acesso online

- **Site:** https://marcos-scox.github.io/organizador-de-ideias/
- **Repositório:** https://github.com/marcos-scox/organizador-de-ideias

## Funcionalidades

- Criar, pesquisar e excluir ideias;
- Editar títulos e blocos de texto;
- Adicionar imagens por seleção de arquivo, arrastar e soltar ou `Ctrl+V`;
- Criar fluxogramas com etapas, decisões, conexões e movimentação dos nós;
- Montar workflows com status pendente, em andamento e feito;
- Criar checklists com acompanhamento de itens concluídos;
- Salvar automaticamente os dados no `localStorage` do navegador;
- Layout responsivo e suporte a navegação por teclado.

## Como usar

### Usando o site publicado

1. Acesse o [site do Organizador de Ideias](https://marcos-scox.github.io/organizador-de-ideias/).
2. Clique em **Nova ideia**.
3. Dê um nome à ideia e escreva o conteúdo.
4. Use os botões no final da página para adicionar texto, fluxograma, workflow, checklist ou imagem.
5. As alterações são salvas automaticamente neste navegador.

> Os dados são armazenados localmente no navegador. Se você limpar os dados do site ou trocar de navegador/dispositivo, as ideias não serão transferidas automaticamente.

### Executando localmente

Não é necessário instalar dependências. Basta abrir `index.html` no navegador. Para evitar limitações de alguns navegadores com arquivos locais, você também pode iniciar um servidor simples:

```bash
python3 -m http.server 8000
```

Depois, abra <http://localhost:8000>.

## Estrutura do projeto

```text
organizador-de-ideias/
├── index.html                 # Página principal da aplicação
├── src/
│   ├── app.js                 # Estado, renderização e interações
│   └── styles.css             # Estilos e layout responsivo
├── .github/
│   └── workflows/
│       └── deploy-pages.yml   # Publicação automática no GitHub Pages
└── README.md                  # Documentação do projeto
```

## Publicação

O projeto é estático e é publicado automaticamente pelo GitHub Actions sempre que há um push na branch `main`. O workflow usa o sistema oficial de deploy do GitHub Pages.

## Criador

Criado por **Marcos Dev** ([marcos-scox](https://github.com/marcos-scox)).

## Licença

Este projeto está disponível sob a licença MIT. Consulte o arquivo `LICENSE` para mais detalhes.
