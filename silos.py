import os
import json
from datetime import datetime, timedelta
from typing import Any, Optional

from dotenv import load_dotenv
from supabase_utils import get_last_row, get_last_rows

# Simulador simple de estados de silos
SILO_NAMES = [f"Silo {i+1}" for i in range(8)]

# Crear estados iniciales SIN aleatoriedad
def base_silo(name: str):
    last_update = datetime.utcnow()
    return {
        'name': name,
        'humidity': 0.0,
        'temperature': 20.0,
        'level': 50.0,
        'requires_drying': False,
        'active': True,
        'state': 'Activo',
        'last_update': last_update.isoformat() + 'Z'
    }

# Cargar variables de entorno (para configurar Supabase opcionalmente)
load_dotenv()

# Configuración opcional para tomar la última lectura real de Supabase
READINGS_TABLE = os.getenv("READINGS_TABLE", "readings")
READINGS_ORDER_COLUMN = os.getenv("READINGS_ORDER_COLUMN", "created_at")
READINGS_HUMIDITY_FIELD = os.getenv("READINGS_HUMIDITY_FIELD", "moisture")
READINGS_TIMESTAMP_FIELD = os.getenv("READINGS_TIMESTAMP_FIELD", "created_at")
SUPABASE_DEBUG = os.getenv("SUPABASE_DEBUG", "1") == "1"

_state = [base_silo(n) for n in SILO_NAMES]

# Historial por silo: lista de registros {timestamp, humidity, level, temperature}
_history = {}


def _add_history_record(name, humidity, level, temperature, ts=None):
    if ts is None:
        ts = datetime.utcnow().isoformat() + 'Z'
    rec = {'timestamp': ts, 'humidity': humidity, 'level': level, 'temperature': temperature}
    if name not in _history:
        _history[name] = []
    _history[name].append(rec)
    # limitar historial a 300 registros
    if len(_history[name]) > 300:
        _history[name] = _history[name][-300:]


for s in _state:
    _add_history_record(s['name'], s['humidity'], s['level'], s['temperature'], s['last_update'])

# Sin simulación: no hay función de mutación aleatoria


def get_silos_state():
    # Intentamos obtener hasta N últimas lecturas de Supabase (N = número de silos)
    try:
        rows = get_last_rows(READINGS_TABLE, order_column=READINGS_ORDER_COLUMN, limit=len(_state))
        if SUPABASE_DEBUG:
            try:
                print(f"[SUPABASE] Tabla={READINGS_TABLE} order_by={READINGS_ORDER_COLUMN} -> filas={len(rows)}")
                if rows:
                    print("[SUPABASE] Muestra (hasta 5):", json.dumps(rows[:5], default=str, ensure_ascii=False))
                    # Log de la última fila (más reciente)
                    last = rows[0]
                    last_id = last.get('id')
                    last_ts = last.get(READINGS_TIMESTAMP_FIELD) or last.get('timestamp') or last.get('created_at')
                    last_moist = last.get(READINGS_HUMIDITY_FIELD) or last.get('moisture')
                    print(f"[SUPABASE] Ultima fila -> id={last_id} {READINGS_TIMESTAMP_FIELD}={last_ts} {READINGS_HUMIDITY_FIELD}={last_moist}")
                else:
                    print("[SUPABASE] 0 filas recibidas. Posible RLS con ANON KEY o tabla vacía.")
            except Exception as e:
                print("[SUPABASE] Error imprimiendo filas:", e)
        if rows:
            # rows está ordenado desc (más reciente primero)
            # intentamos mapear por nombre si la fila trae identificador, sino por índice
            name_keys = ['silo', 'name', 'sensor', 'device', 'silo_name']
            mapped_by_name: dict[str, dict] = {}
            for r in rows:
                for nk in name_keys:
                    if nk in r and r[nk]:
                        mapped_by_name[str(r[nk])] = r
                        break

            for i, silo_name in enumerate(SILO_NAMES):
                assigned = None
                # try exact name match
                if silo_name in mapped_by_name:
                    assigned = mapped_by_name[silo_name]
                else:
                    # try more flexible matches
                    short = silo_name.replace(' ', '').lower()
                    for k in mapped_by_name.keys():
                        if k.replace(' ', '').lower() == short or k.lower() == short:
                            assigned = mapped_by_name[k]
                            break

                # fallback por índice (rows[0] -> Silo 1, rows[1] -> Silo 2...)
                if not assigned and i < len(rows):
                    assigned = rows[i]

                if assigned:
                    if SUPABASE_DEBUG:
                        try:
                            print(f"[SUPABASE] Asignando fila a {silo_name}:", json.dumps(assigned, default=str, ensure_ascii=False))
                        except Exception:
                            print(f"[SUPABASE] Asignando fila a {silo_name}: <no-json>")
                    # obtener valor de humedad en campos comunes
                    humidity_val: Optional[Any] = None
                    for key in [READINGS_HUMIDITY_FIELD, 'moisture', 'humidity', 'humedad', 'value', 'hum', 'hum_perc']:
                        if key in assigned and assigned[key] is not None:
                            humidity_val = assigned[key]
                            break
                    if humidity_val is not None:
                        try:
                            h = max(0.0, float(humidity_val))
                            _state[i]['humidity'] = round(h, 1)
                            _state[i]['requires_drying'] = _state[i]['humidity'] > 18
                            if SUPABASE_DEBUG:
                                print(f"[SUPABASE] {silo_name} humedad={_state[i]['humidity']}")
                        except (ValueError, TypeError):
                            pass
                    ts = assigned.get(READINGS_TIMESTAMP_FIELD) or assigned.get('timestamp') or assigned.get('created_at')
                    if ts:
                        _state[i]['last_update'] = str(ts)
    except Exception:
        # si hay error (credenciales, RLS, red), dejamos los valores tal cual
        if SUPABASE_DEBUG:
            print("[SUPABASE] Error consultando lecturas:", repr(e))
        pass

    # Registrar en historial el estado actual y asegurar last_update
    now_iso = datetime.utcnow().isoformat() + 'Z'
    for s in _state:
        if not s.get('last_update'):
            s['last_update'] = now_iso
        _add_history_record(s['name'], s['humidity'], s['level'], s['temperature'], s['last_update'])

    return _state


def set_silo_state(name, new_state):
    """Cambiar el estado textual de un silo por su nombre.
    new_state esperados: 'Activo', 'Inactivo', 'Mantenimiento'
    """
    for s in _state:
        if s['name'] == name:
            s['state'] = new_state
            if new_state == 'Activo':
                s['active'] = True
            else:
                s['active'] = False
            # si cambia a mantenimiento, vaciar nivel y cancelar requires_drying
            if new_state == 'Mantenimiento':
                s['level'] = 0
                s['requires_drying'] = False
            s['last_update'] = datetime.utcnow().isoformat() + 'Z'
            # registrar el cambio en el historial
            _add_history_record(s['name'], s.get('humidity'), s.get('level'), s.get('temperature'), s['last_update'])
            return s
    return None


def add_silo(name, humidity=None, temperature=None, level=None):
    """Agregar un nuevo silo con valores iniciales opcionales."""
    # evitar duplicados por nombre
    for s in _state:
        if s['name'] == name:
            return None
    # Valores por defecto deterministas (sin random)
    humidity = round(float(humidity), 1) if humidity is not None else 15.0
    temperature = round(float(temperature), 1) if temperature is not None else 20.0
    level = int(level) if level is not None else 50
    requires_drying = humidity > 18
    active = True
    last_update = datetime.utcnow().isoformat() + 'Z'
    s = {
        'name': name,
        'humidity': humidity,
        'temperature': temperature,
        'level': level,
        'requires_drying': requires_drying,
        'active': active,
        'state': 'Activo',
        'last_update': last_update
    }
    _state.append(s)
    _add_history_record(name, humidity, level, temperature, last_update)
    return s


def get_history(name):
    return _history.get(name, [])


def get_all_histories():
    return _history
