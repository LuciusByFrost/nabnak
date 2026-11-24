# NABNAK
> Tarefas, calendário, metas e mapas mentais em um espaço de trabalho simples.

## Overview
Um simples quadro kanban desenvolvido apenas com HTML, CSS e JavaScript. Utilizando a API e os eventos de [**Drag and Drop**](https://developer.mozilla.org/pt-BR/docs/DragDrop/Drag_and_Drop) do HTML5, manipulando eles e adicionando tarefas ao quadro de forma dinâmica com Vanilla JS e estilizar a aparência com CSS3.

Agradecimentos especiais à [Rocketseat](https://rocketseat.com.br/) que inspirou e auxiliou o desenvolvimento com seu [vídeo do YouTube](https://www.youtube.com/watch?v=6wn8hpUcEcM).

## Recursos

- Kanban com arraste, seletor de coluna e criação rápida.
- Pesquisa e filtros combinados por prazo, meta e situação.
- Calendário, metas e mapas mentais como vistas principais.
- Temas claro, escuro e do sistema, com cores neutras e identidade laranja.
- Identidades Original (padrão), Lo-fi Café e Lo-fi Midnight, com prévias e ilustrações opcionais.
- Português, inglês e espanhol; persistência local de dados e preferências.
- Layout adaptável, teclado e redução de movimento.

Abra `index.html` ou use `npm.cmd run serve` com Node.js 24+. Não há dependências
de produção nem etapa de build. Para testes automatizados: `npm.cmd test`.

Veja o [relatório de redesign e validação](docs/REDESIGN.md) para resultados por
etapa e instruções Playwright. **A validação visual está pendente:** a instalação
do Playwright foi bloqueada pela rede do ambiente; nenhuma captura foi produzida.

Veja também o [relatório dos três temas](docs/THEMES.md), com 113 testes aprovados
e a suíte de aparência: `npm.cmd run test:themes`.

Os temas lo-fi incluem [ilustrações locais de cafeteria e cidade chuvosa](docs/LOFI-ILLUSTRATIONS.md),
com ativação por padrão para novas preferências e opção de desligar em Aparência.

## Deploy
O deploy do projeto está sendo feito com o *github-pages* e está disponível [aqui](https://lucasbecker.github.io/nabnak).

 ## License
 [MIT License](./LICENSE) © [Lucas Becker](http://lucasbecker.github.io/) 
