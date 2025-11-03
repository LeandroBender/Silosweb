from flask import Flask, render_template, jsonify
from silos import get_silos_state, set_silo_state, add_silo, get_history, get_all_histories
from silos import set_silo_state
from flask import request
from supabase_utils import get_last_row

app = Flask(__name__, static_url_path='/static')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/silos')
def api_silos():
    """Devuelve el estado actual de todos los silos en JSON."""
    silos = get_silos_state()
    return jsonify(silos)


@app.route('/api/alerts')
def api_alerts():
    """Generar lista de alertas a partir de los silos (simulado)."""
    silos = get_silos_state()
    alerts = []
    for s in silos:
        if not s.get('active'):
            alerts.append({'silo': s['name'], 'msg': 'Silo inactivo', 'level': 'critical'})
        if s.get('humidity', 0) >= 22:
            alerts.append({'silo': s['name'], 'msg': f'humedad alta ({s["humidity"]}%)', 'level': 'critical'})
        elif s.get('humidity', 0) > 18:
            alerts.append({'silo': s['name'], 'msg': f'humedad elevada ({s["humidity"]}%)', 'level': 'warning'})
        if s.get('requires_drying'):
            alerts.append({'silo': s['name'], 'msg': 'requiere secado', 'level': 'warning'})
        if s.get('state') == 'Mantenimiento':
            alerts.append({'silo': s['name'], 'msg': 'en mantenimiento', 'level': 'warning'})
    return jsonify(alerts)


@app.route('/api/silos/state', methods=['POST'])
def api_set_state():
    data = request.get_json() or {}
    name = data.get('name')
    new_state = data.get('state')
    if not name or not new_state:
        return jsonify({'error': 'name and state required'}), 400
    updated = set_silo_state(name, new_state)
    if not updated:
        return jsonify({'error': 'silo not found'}), 404
    return jsonify(updated)



@app.route('/api/silos', methods=['POST'])
def api_add_silo():
    data = request.get_json() or {}
    name = data.get('name')
    humidity = data.get('humidity')
    temperature = data.get('temperature')
    level = data.get('level')
    if not name:
        return jsonify({'error': 'name required'}), 400
    new = add_silo(name, humidity, temperature, level)
    if not new:
        return jsonify({'error': 'silo exists'}), 409
    return jsonify(new), 201


@app.route('/api/silos/history')
def api_histories():
    return jsonify(get_all_histories())


@app.route('/api/silos/history/<name>')
def api_history(name):
    return jsonify(get_history(name))


@app.route('/api/supabase/latest/<table>')
def api_supabase_latest(table):
    """Devuelve la última fila de una tabla de Supabase.

    Query params:
      - order_column: nombre de la columna por la que ordenar desc (por defecto: created_at)
    """
    order_column = request.args.get('order_column', 'created_at')
    try:
        row = get_last_row(table, order_column=order_column)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    if not row:
        return jsonify({"error": "sin datos"}), 404
    return jsonify(row)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
