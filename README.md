# Monitor de Silos de Grano (Dashboard)

Proyecto mínimo con Flask que muestra un dashboard moderno para monitorizar silos de grano.

Características:
- Visualización en tarjetas responsive de cada silo.
- Colores de estado (verde/amarillo/rojo).
- Indicador de secado con animación.
- Actualización automática cada 10 segundos (simulada).

Requisitos
- Python 3.9+
- pip

Instalación y ejecución (Windows PowerShell)

```powershell
cd "c:\Users\Usuario\Desktop\2do cuatrimestre 2 año\programacion2\Progra2\Programacion 2\Programacion 2\silo-dashboard"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Luego abrir http://localhost:5000 en el navegador.

Sustituir la fuente de datos
- Reemplaza `silos.py::get_silos_state()` por una función que lea tu base de datos o use tu código Python existente para devolver la lista de silos en el mismo formato:

```python
{
  'name': 'Silo 1',
  'humidity': 18.2,
  'temperature': 24.1,
  'level': 73,
  'requires_drying': False,
  'active': True,
  'last_update': '2025-10-21T12:00:00Z'
}
```

Preguntas o mejoras
- ¿Quieres que añada filtros, ordenar, o alertas sonoras cuando hay silos en rojo? 
- ¿Prefieres que use Plotly Dash en lugar de Flask?

API adicional
- `GET /api/alerts` — devuelve una lista de alertas calculadas a partir de los datos de los silos.
- `POST /api/silos/state` — cambiar el estado de un silo. Body JSON: `{ "name": "Silo 1", "state": "Inactivo" }`.

Integración con Supabase
1. Copia `.env.example` a `.env` y completa `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
2. Instala dependencias: `pip install -r requirements.txt`.
3. Endpoint para obtener la última fila de una tabla:
  - `GET /api/supabase/latest/<tabla>?order_column=<columna>`
  - Por defecto ordena por `created_at` descendente y devuelve 1 fila.
  - Ejemplo: `/api/supabase/latest/readings?order_column=timestamp`

Mostrar la última humedad en el Dashboard (Silo 1)
- El backend ahora intenta leer la última fila real desde Supabase y reemplaza la humedad del "Silo 1" con ese valor.
- Variables opcionales para ajustar nombres de tabla/columnas (poner en `.env` si tu esquema difiere):
  - `READINGS_TABLE` (default: `readings`)
  - `READINGS_ORDER_COLUMN` (default: `created_at`)
  - `READINGS_HUMIDITY_FIELD` (default: `moisture`)
  - `READINGS_TIMESTAMP_FIELD` (default: `created_at`)

Uso programático (Python):
```python
from supabase_utils import get_last_row

row = get_last_row("readings", order_column="timestamp")
print(row)
```

Interacción
- Usa la barra lateral para navegar entre Dashboard, Silos y Alertas.
- En la vista Silos puedes cambiar el estado de cada silo desde un selector; el cambio se aplica en tiempo real en la simulación.
