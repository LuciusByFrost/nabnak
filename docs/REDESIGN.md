# Redesign do NABNAK

Implementação em HTML, CSS e JavaScript, sem framework nem dependências de produção.
Data: 23/11/2026.

## Alterações

- Sistema compartilhado de cores, superfícies, tipografia, bordas e espaçamentos.
- Temas Claro, Escuro e Sistema. A preferência persiste em `nabnak.theme`; o modo
  Sistema acompanha mudanças na preferência do sistema operacional.
- Menu à esquerda, com Tarefas, Calendário, Metas e Mapas mentais, indicação da
  vista atual e preferências separadas. O estado do menu no desktop persiste em
  `nabnak.sidebar`. No celular, a navegação abre como painel temporário e fecha
  ao escolher uma vista, sem apagar a preferência do desktop.
- Calendário e metas são vistas principais. Somente os editores continuam em
  diálogos nativos. Os IDs existentes foram mantidos para preservar integrações.
- Pesquisa por título, sem distinção de maiúsculas ou acentos, combinável com
  filtros de prazo, meta e situação. Contadores mostram resultados e total.
- Filtros de prazo: qualquer prazo, atrasadas ainda não concluídas, hoje,
  próximos sete dias (amanhã até hoje + 7), futuras e sem prazo.
- Criação rápida em cada coluna; o formulário superior com prazo/meta permanece.
- Cartões com edição e exclusão visíveis, metadados organizados, indicação
  textual de atraso e seletor de coluna como alternativa ao arraste.
- Colunas empilhadas no celular. Em monitores muito largos, cada coluna acomoda
  mais cartões por linha, evitando cartões excessivamente largos.
- Mapas mentais com ferramentas agrupadas, arquivos em menu próprio, inspetor
  recolhível e controles para mover ideias/navegar sem arrastar.
- Atalho Tab para criar subideias preservado em modo de edição opcional,
  desativado inicialmente. Escape desativa esse modo. A criação por botão permanece.
- Rascunhos dos mapas são salvos ao trocar de vista; desfazer/refazer, gestos,
  conexões, organização, cores, múltiplos mapas, importação, exportação e criação
  de tarefa a partir de ideia continuam disponíveis.
- Navegação por setas no calendário, foco visível, contenção de foco no menu
  móvel, link para pular a navegação, avisos de tarefas e movimento reduzido.
- Português, inglês e espanhol, incluindo novos controles e rótulos acessíveis.

`js/store.js` e `js/mindmap-data.js` não foram alterados. As chaves existentes
`nabnak.data`, `nabnak.language` e as chaves de mapas/migração continuam em uso.
O redesign não troca o formato dos dados nem traduz textos escritos pelo usuário.

## Aplicação crítica da UI/UX Pro Max

Skill local: `../.agents/skills/ui-ux-pro-max/SKILL.md`, relativa à raiz do repositório.
Python 3.12.10 executou `search.py` com `-B`, consultando `styles.csv` e
`ux-guidelines.csv`. Consultas utilizadas nesta implementação:

```powershell
python -B .agents/skills/ui-ux-pro-max/scripts/search.py "minimalism neutral" --domain style -n 1
python -B .agents/skills/ui-ux-pro-max/scripts/search.py "dragging movements" --domain ux -n 1
python -B .agents/skills/ui-ux-pro-max/scripts/search.py "reduced motion" --domain ux -n 1
```

Execute essas consultas a partir da pasta pai do repositório, onde está `.agents`.
Foram adotados hierarquia, cores neutras, alternativas ao arraste e movimento
reduzido. Espaçamento de landing page, neon e recomendações decorativas não
foram aplicados. Nunito e um acento laranja foram preservados como identidade.

## Regressão progressiva executada

Ambiente: Windows, Node.js 24.22.1. Suíte executada após cada etapa:

| Marco | Testes aprovados | Falhas |
| --- | ---: | ---: |
| Antes das alterações | 80 | 0 |
| 1. Estilos compartilhados e tema | 81 | 0 |
| 2. Navegação e preferências | 83 | 0 |
| 3. Quadro, pesquisa, filtros e criação rápida | 89 | 0 |
| 4. Calendário, metas e mapas como vistas principais | 92 | 0 |
| 5. Revisão final e acessibilidade automatizada | 96 | 0 |

Os testes cobrem CRUD, datas/anos bissextos/fusos, vínculos, progresso das metas,
persistência, migração, dados ilegíveis/futuros, falhas de armazenamento, idiomas,
filtros combinados, teclado, preferências, alterações de viewport/sistema,
rascunhos e os recursos dos mapas, inclusive ponteiros de mouse e toque simulados.

Os testes de apresentação antigos que fixavam abertura pela direita, fade dos
botões e largura máxima foram substituídos por verificações de comportamento
compatíveis com o redesign. A cobertura funcional foi mantida.

Os pares semânticos de texto dos dois temas passaram no cálculo de contraste
de 4,5:1; foco e bordas de controles passaram em 3:1. Esse resultado é sobre os
tokens: não certifica a renderização completa nem conformidade integral com WCAG.
JavaScript e scripts de teste passaram na verificação de sintaxe; `git diff --check`
passou. Nenhum commit ou push foi realizado.

## Playwright: validação visual pendente

**Não houve execução de navegador nem captura de tela neste ambiente.**

- Playwright ausente e sem cópia no cache local (`ENOTCACHED`).
- A tentativa de instalação com acesso à rede retornou `ECONNREFUSED 127.0.0.1:9`.
- O comando da suíte foi tentado e registrou `blocked`, zero verificações de
  navegador e zero capturas em `artifacts/ui/report.json`.
- A tentativa anterior de iniciar Chrome também foi bloqueada pelo ambiente.

A suíte em `tests/browser/validate.cjs` foi preparada e passou na verificação de
sintaxe. Suas próprias asserções ainda precisam ser executadas em navegador.
Ela inicia um servidor local e cria contextos isolados com dados de teste,
sem acessar o perfil ou os dados salvos no navegador habitual do usuário.

Para executar localmente, na pasta que contém `index.html`, com Node.js 24+:

```powershell
npm.cmd install
npx.cmd playwright install chromium
npm.cmd test
npm.cmd run test:browser
```

Em macOS/Linux, use `npm` e `npx` sem `.cmd`. A instalação é apenas para ferramentas
de desenvolvimento. O aplicativo continua podendo ser servido como site estático.

A suíte foi programada para:

- Executar as quatro vistas nos temas claro/escuro, desktop 1440 × 1000 e
  celular emulado 375 × 812, gerando 16 PNGs.
- Verificar adicionalmente 320 × 740, 768 × 1024, 812 × 375 e 2560 × 1440.
- Exercitar criação, edição, exclusão/cancelamento, pesquisa, filtros, mudança de
  coluna, calendário, mapas, histórico, importação/exportação JSON, idiomas,
  tema do sistema, preferências e preservação de campos extras.
- Verificar overflow horizontal, nomes acessíveis, foco, redução de movimento,
  contraste de textos representativos e exceções JavaScript.
- Registrar `passed`, `failed` ou `blocked` e somente capturas efetivamente
  produzidas em `artifacts/ui/report.json`.

Para acompanhar o navegador visivelmente:

```powershell
$env:HEADED = '1'
npm.cmd run test:browser
```

Se já houver Chrome instalado, é possível apontar seu executável:

```powershell
$env:NABNAK_BROWSER_EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm.cmd run test:browser
```

Para conferir a interface manualmente:

```powershell
npm.cmd run serve
```

Abra `http://127.0.0.1:4173`. Um endereço/origem diferente tem armazenamento
próprio; os testes isolados não migram nem apagam dados do endereço original.

Após rodar a suíte, revisar as capturas e conferir zoom de 200%, leitor de tela,
gestos em dispositivo físico, títulos longos, teclado virtual e todos os estados
nos dois temas. Capturas automáticas não substituem essa revisão humana. Nenhuma
dessas verificações visuais ou em dispositivo físico é apresentada como concluída.

Referências técnicas: [Playwright Library](https://playwright.dev/docs/library),
[capturas de tela](https://playwright.dev/docs/screenshots).
