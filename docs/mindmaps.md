# Editor de mapas mentais

Abra **Mapas mentais** na sidebar. O primeiro acesso cria um mapa com uma ideia central; **Novo mapa** cria outro sem substituir os anteriores. O seletor no topo alterna entre mapas. Títulos e ideias são conteúdo do usuário: trocar o idioma traduz os controles, sem traduzir esse conteúdo.

## Controles

- **Adicionar ideia principal** conecta uma nova ramificação à ideia central. **Adicionar subideia** conecta ao nó selecionado; o atalho é Tab quando o foco está no nó ou no quadro.
- Arraste um cartão para movê-lo. Arraste o fundo para mover a câmera. A roda do mouse, os botões +/− e o gesto de pinça alteram o zoom em torno do ponto escolhido.
- Dois cliques no título permitem edição direta. Enter confirma, Shift+Enter cria uma linha e Escape cancela. O painel de detalhes permite editar título, descrição e cor. As setas do teclado percorrem as ideias visíveis.
- **Conectar ideias** usa a seleção atual como origem; selecione outra ideia como destino. Sem seleção, selecione a origem e depois o destino. Escape cancela. Arestas duplicadas, invertidas ou para o próprio nó são recusadas. Selecione uma curva, ou use o seletor **Conexões** por teclado/toque, e pressione **Remover conexão** para removê-la.
- **Recolher / expandir** oculta ou revela descendentes sem excluí-los. **Duplicar** copia a ideia selecionada, incluindo descrição e cor, sem copiar toda a ramificação.
- Delete exclui a ideia e seus descendentes após confirmação. A ideia central é preservada. Atalhos de mapa ficam desativados em campos de edição, na sidebar e em diálogos.
- **Organizar mapa** distribui ramificações à esquerda e à direita e pode reposicionar nós manuais. Nas demais edições, posições manuais são preservadas. Textos são medidos no DOM para dimensionar a organização; os testes sem navegador usam medidas determinísticas.
- **Desfazer / refazer** cobre as últimas 60 alterações na sessão: ideias, conexões, edição, organização e exclusão. Ctrl/Cmd+Z desfaz; Ctrl/Cmd+Shift+Z ou Ctrl+Y refaz. Câmera e zoom são salvos sem criar entradas de histórico.
- **Criar tarefa a partir desta ideia** abre o editor existente do NABNAK com o título preenchido. A tarefa só é criada após Salvar. Prazos, coluna e associação a metas continuam disponíveis nesse editor. O nó original permanece no mapa.
- **Exportar** baixa todos os mapas em JSON ou o mapa visível em SVG (sem descendentes recolhidos). Selecione o formato à direita da barra. **Importar JSON** acrescenta mapas com identificadores novos, sem substituir mapas existentes.

## Armazenamento e compatibilidade

O módulo usa `nabnak.mindmaps`, versão 2, separado de `nabnak.data` e `nabnak.language`. Nenhuma tarefa é armazenada novamente pelo editor de mapas. Funciona como arquivos estáticos, inclusive no GitHub Pages.

Não havia implementação anterior de mapas neste checkout. O leitor aceita os formatos reconhecidos abaixo, com backup literal antes da primeira gravação:

- Envelope `{version: 1 ou 2, maps: [...], activeMapId}`;
- Lista de mapas ou mapa único `{nodes, edges}`;
- Chaves antigas `nabnak.mindMaps` e `nabnak.maps`, sem apagar essas chaves;
- Nós com identificadores de texto, `title`, `text` ou `label`; posições `x/y` ou `position.x/y`; hierarquia em `parentId` ou arestas explicitamente marcadas `kind: "tree"`;
- Conexões `source/target` ou `from/to`, em `edges` ou `connections`.

O original fica em `<chave original>.backup`; um backup existente nunca é substituído. Propriedades adicionais são preservadas quando reconhecidas. Cores são validadas e textos entram no DOM como texto, não como HTML.

Arquivos desconhecidos, corrompidos, cíclicos na hierarquia ou de versões futuras não são sobrescritos: a edição fica bloqueada e a exportação JSON baixa o conteúdo original. Isso é uma proteção, não uma garantia de migração de qualquer formato externo. Falhas de gravação exibem um aviso e mantêm as alterações na memória para exportação.

## Verificação

```powershell
node --test --test-isolation=none tests/store.test.cjs tests/translations.test.cjs tests/task-form.test.cjs tests/ui.test.cjs tests/mindmap-data.test.cjs tests/mindmap-ui.test.cjs
```

Os testes de interface usam um DOM simulado: verificam eventos e estado, mas não substituem a conferência em navegador real. A medição de fontes, gestos nativos, captura de ponteiros e a aparência em telas pequenas precisam de validação visual quando houver um navegador disponível no ambiente.
