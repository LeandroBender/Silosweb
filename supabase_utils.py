import os
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from supabase import create_client, Client

# Carga variables desde .env si existe
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
# Preferir SERVICE KEY si está disponible; si no, usar ANON KEY
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

_client: Optional[Client] = None


def get_client() -> Client:
    """Obtiene (lazy) el cliente de Supabase configurado por variables de entorno.

    Variables requeridas:
    - SUPABASE_URL
    - SUPABASE_ANON_KEY (o SUPABASE_SERVICE_KEY)
    """
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError(
                "Faltan variables de entorno SUPABASE_URL y/o SUPABASE_ANON_KEY/SERVICE_KEY"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_last_row(table: str, order_column: str = "created_at") -> Optional[Dict[str, Any]]:
    """Devuelve la última fila de una tabla ordenando por una columna descendente.

    Args:
        table: Nombre de la tabla en Supabase (Postgres)
        order_column: Columna por la que se ordena descendente (por defecto 'created_at')

    Returns:
        dict con la última fila o None si no hay datos.
    """
    client = get_client()
    try:
        res = (
            client.table(table)
            .select("*")
            .order(order_column, desc=True)
            .limit(1)
            .execute()
        )
        data = res.data or []
        return data[0] if data else None
    except Exception as e:
        # Puedes loguear el error si lo deseas
        raise


def get_last_rows(table: str, order_column: str = "created_at", limit: int = 1) -> list[Dict[str, Any]]:
    """Devuelve las últimas `limit` filas de una tabla ordenando por una columna descendente.

    Retorna la lista (posible vacía) de registros en el mismo formato que los devuelve Supabase.
    """
    client = get_client()
    try:
        res = (
            client.table(table)
            .select("*")
            .order(order_column, desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception:
        raise
