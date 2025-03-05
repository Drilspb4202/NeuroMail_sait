from cairosvg import svg2png

# Читаем SVG файл
with open('static/images/neuromail-preview.svg', 'r', encoding='utf-8') as svg_file:
    svg_content = svg_file.read()

# Конвертируем SVG в PNG
svg2png(bytestring=svg_content.encode('utf-8'),
        write_to='static/images/neuromail-preview.png',
        output_width=1200,
        output_height=630) 