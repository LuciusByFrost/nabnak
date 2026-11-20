// Keep map controls in the same translation registry as the Kanban and planner.
(() => {
  const messages = {
    en: {
      mmConnections: 'Connections', mmChooseConnection: 'Choose a connection',
      mmMaps: 'Mind maps', mmNewMap: 'Untitled map', mmCentral: 'Central idea', mmNew: 'New map', mmBack: 'Back to tasks', mmMapName: 'Map name', mmChoose: 'Choose a map',
      mmAdd: 'Add main idea', mmChild: 'Add subidea', mmIdea: 'New idea', mmConnect: 'Connect ideas', mmConnectHint: 'Select two different ideas to connect. Escape cancels.', mmDuplicateEdge: 'These ideas are already connected, or the connection is invalid.',
      mmOrganize: 'Organize map', mmUndo: 'Undo', mmRedo: 'Redo', mmZoomIn: 'Zoom in', mmZoomOut: 'Zoom out', mmCenter: 'Center on the central idea', mmFit: 'Fit all ideas', mmExport: 'Export', mmFormat: 'Export format',
      mmSelection: 'Idea details', mmTitle: 'Idea title', mmDescription: 'Description (optional)', mmColor: 'Branch color', mmDuplicate: 'Duplicate idea', mmDelete: 'Delete idea and descendants', mmDeleteConfirm: 'Delete this idea and all its subideas?',
      mmCollapse: 'Collapse / expand branch', mmCollapsed: 'Collapsed', mmTask: 'Create task from this idea', mmSelectHint: 'Select an idea to edit its details. Double-click its title to edit directly.',
      mmHelp: 'Drag the background to navigate · Wheel or pinch to zoom · Tab: subidea · Delete: remove · Ctrl/Cmd+Z: undo',
      mmReadError: 'Saved maps could not be safely read. The original data is preserved. Editing is disabled; export the original JSON to recover it.',
      mmWriteError: 'The map could not be saved. Your changes are in memory; export JSON before leaving.', mmRootProtected: 'The central idea cannot be deleted. Edit it or create a new map.',
      mmRemoveEdge: 'Remove connection', mmEdgeSelected: 'Connection selected', mmSaved: 'Saved on this device', mmEmpty: 'Create a map to begin.', mmCanvas: 'Mind map workspace', mmSaveTitle: 'Finish editing with Enter; Shift+Enter adds a line. Escape cancels.', mmImport: 'Import JSON', mmImportError: 'This file is not a supported map. Existing maps have been preserved.'
    },
    'pt-BR': {
      mmConnections: 'Conexões', mmChooseConnection: 'Escolher uma conexão',
      mmMaps: 'Mapas mentais', mmNewMap: 'Mapa sem título', mmCentral: 'Ideia central', mmNew: 'Novo mapa', mmBack: 'Voltar às tarefas', mmMapName: 'Nome do mapa', mmChoose: 'Escolher mapa',
      mmAdd: 'Adicionar ideia principal', mmChild: 'Adicionar subideia', mmIdea: 'Nova ideia', mmConnect: 'Conectar ideias', mmConnectHint: 'Selecione duas ideias diferentes para conectar. Escape cancela.', mmDuplicateEdge: 'Estas ideias já estão conectadas ou a conexão é inválida.',
      mmOrganize: 'Organizar mapa', mmUndo: 'Desfazer', mmRedo: 'Refazer', mmZoomIn: 'Aumentar zoom', mmZoomOut: 'Diminuir zoom', mmCenter: 'Centralizar na ideia central', mmFit: 'Ajustar todas as ideias à tela', mmExport: 'Exportar', mmFormat: 'Formato de exportação',
      mmSelection: 'Detalhes da ideia', mmTitle: 'Título da ideia', mmDescription: 'Descrição (opcional)', mmColor: 'Cor da ramificação', mmDuplicate: 'Duplicar ideia', mmDelete: 'Excluir ideia e descendentes', mmDeleteConfirm: 'Excluir esta ideia e todas as suas subideias?',
      mmCollapse: 'Recolher / expandir ramificação', mmCollapsed: 'Recolhida', mmTask: 'Criar tarefa a partir desta ideia', mmSelectHint: 'Selecione uma ideia para editar seus detalhes. Dê dois cliques no título para editar diretamente.',
      mmHelp: 'Arraste o fundo para navegar · Roda do mouse ou pinça para zoom · Tab: subideia · Delete: excluir · Ctrl/Cmd+Z: desfazer',
      mmReadError: 'Não foi possível ler os mapas salvos com segurança. Os dados originais foram preservados. A edição está desativada; exporte o JSON original para recuperá-los.',
      mmWriteError: 'Não foi possível salvar o mapa. As alterações estão na memória; exporte o JSON antes de sair.', mmRootProtected: 'A ideia central não pode ser excluída. Edite-a ou crie um novo mapa.',
      mmRemoveEdge: 'Remover conexão', mmEdgeSelected: 'Conexão selecionada', mmSaved: 'Salvo neste dispositivo', mmEmpty: 'Crie um mapa para começar.', mmCanvas: 'Área de trabalho do mapa mental', mmSaveTitle: 'Enter conclui a edição; Shift+Enter cria uma linha. Escape cancela.', mmImport: 'Importar JSON', mmImportError: 'Este arquivo não é um mapa compatível. Os mapas existentes foram preservados.'
    },
    es: {
      mmConnections: 'Conexiones', mmChooseConnection: 'Elegir una conexión',
      mmMaps: 'Mapas mentales', mmNewMap: 'Mapa sin título', mmCentral: 'Idea central', mmNew: 'Nuevo mapa', mmBack: 'Volver a las tareas', mmMapName: 'Nombre del mapa', mmChoose: 'Elegir mapa',
      mmAdd: 'Añadir idea principal', mmChild: 'Añadir subidea', mmIdea: 'Nueva idea', mmConnect: 'Conectar ideas', mmConnectHint: 'Selecciona dos ideas diferentes para conectar. Escape cancela.', mmDuplicateEdge: 'Estas ideas ya están conectadas o la conexión no es válida.',
      mmOrganize: 'Organizar mapa', mmUndo: 'Deshacer', mmRedo: 'Rehacer', mmZoomIn: 'Acercar', mmZoomOut: 'Alejar', mmCenter: 'Centrar en la idea central', mmFit: 'Ajustar todas las ideas', mmExport: 'Exportar', mmFormat: 'Formato de exportación',
      mmSelection: 'Detalles de la idea', mmTitle: 'Título de la idea', mmDescription: 'Descripción (opcional)', mmColor: 'Color de la rama', mmDuplicate: 'Duplicar idea', mmDelete: 'Eliminar idea y descendientes', mmDeleteConfirm: '¿Eliminar esta idea y todas sus subideas?',
      mmCollapse: 'Contraer / expandir rama', mmCollapsed: 'Contraída', mmTask: 'Crear tarea desde esta idea', mmSelectHint: 'Selecciona una idea para editar sus detalles. Haz doble clic en el título para editar directamente.',
      mmHelp: 'Arrastra el fondo para navegar · Rueda o pellizco para zoom · Tab: subidea · Delete: eliminar · Ctrl/Cmd+Z: deshacer',
      mmReadError: 'No se pudieron leer los mapas guardados de forma segura. Los datos originales se han conservado. La edición está desactivada; exporta el JSON original para recuperarlos.',
      mmWriteError: 'No se pudo guardar el mapa. Los cambios están en memoria; exporta el JSON antes de salir.', mmRootProtected: 'No se puede eliminar la idea central. Edítala o crea un nuevo mapa.',
      mmRemoveEdge: 'Eliminar conexión', mmEdgeSelected: 'Conexión seleccionada', mmSaved: 'Guardado en este dispositivo', mmEmpty: 'Crea un mapa para empezar.', mmCanvas: 'Área de trabajo del mapa mental', mmSaveTitle: 'Enter termina la edición; Shift+Enter añade una línea. Escape cancela.', mmImport: 'Importar JSON', mmImportError: 'Este archivo no es un mapa compatible. Los mapas existentes se han conservado.'
    }
  };
  for (const [language, dictionary] of Object.entries(messages)) Object.assign(window.NabnakMessages[language], dictionary);
})();
