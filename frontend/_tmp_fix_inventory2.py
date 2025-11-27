# -*- coding: utf-8 -*-
from pathlib import Path
path = Path('src/views/Inventory.js')
text = path.read_text()
needle = 'const [forecastMap, setForecastMap] = useState({});'
idx = text.find(needle)
if idx == -1:
    raise SystemExit('needle not found')
if 'savingItem' not in text:
    insert = "\n  const [savingItem, setSavingItem] = useState(false);\n  const [deletingId, setDeletingId] = useState(null);"
    text = text[: idx + len(needle)] + insert + text[idx + len(needle):]
path.write_text(text)
