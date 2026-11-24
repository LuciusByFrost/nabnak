# Ilustrações lo-fi locais

Ilustrações originais geradas para o NABNAK com a skill imagegen. Sem texto,
marcas ou dependências de CDN. Os arquivos abaixo são os assets finais utilizados
pelo CSS; não precisam de geração ou conversão durante a publicação.

| Arquivo | Dimensões | Bytes | Conteúdo |
| --- | --- | ---: | --- |
| `lofi-cafe.jpg` | 1200 × 800 | 279797 | Cafeteria com plantas, livros e café, em creme, terracota e sálvia. |
| `lofi-cafe-sidebar.jpg` | 480 × 320 | 45337 | Versão otimizada da mesma cena para a lateral. |
| `lofi-midnight.jpg` | 1200 × 800 | 224125 | Cidade noturna através de janela com chuva, em azul-marinho, índigo e lavanda. |
| `lofi-midnight-sidebar.jpg` | 480 × 320 | 32557 | Versão otimizada da mesma cena para a lateral. |

Total: 581816 bytes, aproximadamente 568 KiB. Formato JPEG RGB, proporção 3:2.
Os originais gerados têm 1536 × 1024; a otimização preserva essa proporção, sem
recortar a composição. `tools/prepare_lofi_assets.ps1` documenta a conversão
Windows e recusa sobrescrever assets existentes.

`css/themes.css` referencia os arquivos por `../assets/themes/...`. Esses caminhos
continuam válidos quando o projeto é publicado sob um prefixo, como `/nabnak/`.

As cenas são decorativas: não contêm instruções nem informação necessária ao uso
da aplicação. O controle **Ilustrações de ambiente** permite ocultá-las.
