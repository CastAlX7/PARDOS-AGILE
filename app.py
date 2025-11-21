from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from config import Config
from models import db, Cliente, Mesa, Reserva, Comanda, DetalleComanda, Menu, Cuenta, Comprobante, Boleta, Factura
from sqlalchemy.orm import joinedload
from sqlalchemy import and_
from datetime import datetime, date
from functools import wraps
import requests

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, supports_credentials=True)
db.init_app(app)

# ==================== SEGURIDAD Y ROLES ====================
ROLES = {
    'anfitriona_bienvenida': 'Anfitriona de Bienvenida',
    'lider_restaurante': 'Líder de Restaurante',
    'anfitrion_servicio': 'Anfitrión de Servicio',
    'maestro_brasa': 'Maestro Brasa',
    'cajera': 'Cajera'
}

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Sesión expirada'}), 401
        return f(*args, **kwargs)
    return decorated_function

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if session.get('user_role') not in allowed_roles:
                return jsonify({'error': 'Acceso denegado'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    users = {
        'anfitriona': {'pass': '123', 'role': ROLES['anfitriona_bienvenida']},
        'lider': {'pass': '123', 'role': ROLES['lider_restaurante']},
        'anfitrion': {'pass': '123', 'role': ROLES['anfitrion_servicio']},
        'maestro': {'pass': '123', 'role': ROLES['maestro_brasa']},
        'cajera': {'pass': '123', 'role': ROLES['cajera']}
    }
    u = users.get(data.get('username'))
    if u and u['pass'] == data.get('password'):
        session['user_id'] = data['username']
        session['user_role'] = u['role']
        return jsonify({'success': True, 'role': u['role'], 'username': data['username']})
    return jsonify({'error': 'Credenciales incorrectas'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/session', methods=['GET'])
def check_session():
    return jsonify({'logged_in': 'user_id' in session, 'role': session.get('user_role'), 'username': session.get('user_id')})

# ==================== API DNI EXTERNO ====================
@app.route('/api/consulta-dni/<dni>', methods=['GET'])
@login_required
def consulta_dni(dni):
    try:
        response = requests.get(f'https://apiperu.dev/api/dni/{dni}', 
            headers={'Authorization': 'Bearer demo'}, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return jsonify({
                    'success': True,
                    'nombre': data['data'].get('nombre_completo', ''),
                    'nombres': data['data'].get('nombres', ''),
                    'apellido_paterno': data['data'].get('apellido_paterno', ''),
                    'apellido_materno': data['data'].get('apellido_materno', '')
                })
    except:
        pass
    
    cliente = Cliente.query.filter_by(dni=dni).first()
    if cliente:
        return jsonify({
            'success': True,
            'nombre': f"{cliente.nombre} {cliente.apellido}",
            'nombres': cliente.nombre,
            'apellido_paterno': cliente.apellido,
            'apellido_materno': '',
            'telefono': cliente.telefono,
            'email': cliente.email,
            'local': True
        })
    return jsonify({'success': False, 'message': 'DNI no encontrado'})

# ==================== HUO01, HUO02: MESAS ====================
@app.route('/api/mesas', methods=['GET'])
@login_required
def get_all_mesas():
    mesas = Mesa.query.all()
    return jsonify([{
        'id': m.id_mesa, 'numero': m.numero_mesa, 'capacidad': m.capacidad,
        'ubicacion': m.ubicacion, 'tipo': m.tipo_mesa, 'disponibilidad': m.disponibilidad
    } for m in mesas])

@app.route('/api/mesas/disponibles', methods=['GET'])
@login_required
def consultar_disponibilidad():
    fecha = request.args.get('fecha', date.today().isoformat())
    hora = request.args.get('hora', '12:00')
    
    mesas_ocupadas = db.session.query(Reserva.id_mesa).filter(
        Reserva.fecha_reserva == fecha,
        Reserva.hora_reserva == hora,
        Reserva.estado.in_(['confirmada', 'pendiente'])
    ).all()
    ids_ocupadas = [m[0] for m in mesas_ocupadas]
    
    query = Mesa.query.filter_by(disponibilidad=True)
    if ids_ocupadas:
        query = query.filter(Mesa.id_mesa.notin_(ids_ocupadas))
    
    return jsonify([{
        'id': m.id_mesa, 'numero': m.numero_mesa, 'capacidad': m.capacidad,
        'ubicacion': m.ubicacion, 'tipo': m.tipo_mesa
    } for m in query.all()])

# ==================== HUO03-HUO08: RESERVAS ====================
@app.route('/api/reservas', methods=['GET', 'POST'])
@login_required
def gestion_reservas():
    if request.method == 'POST':
        data = request.json
        if not data.get('dni') or len(data['dni']) != 8:
            return jsonify({'error': 'DNI inválido (debe ser 8 dígitos)'}), 400
        if not data.get('fecha') or not data.get('hora'):
            return jsonify({'error': 'Fecha y hora son obligatorios'}), 400
        if not data.get('id_mesa'):
            return jsonify({'error': 'Debe seleccionar una mesa'}), 400
        
        existe = Reserva.query.filter(
            Reserva.fecha_reserva == data['fecha'],
            Reserva.hora_reserva == data['hora'],
            Reserva.id_mesa == data['id_mesa'],
            Reserva.estado.in_(['confirmada', 'pendiente'])
        ).first()
        if existe:
            return jsonify({'error': 'La mesa ya está reservada para esa fecha y hora'}), 400
        
        cliente = Cliente.query.filter_by(dni=data['dni']).first()
        if not cliente:
            cliente = Cliente(
                nombre=data.get('nombre', ''),
                apellido=data.get('apellido', ''),
                telefono=data.get('telefono', ''),
                email=data.get('email', ''),
                dni=data['dni']
            )
            db.session.add(cliente)
            db.session.flush()
        else:
            if data.get('nombre'): cliente.nombre = data['nombre']
            if data.get('apellido'): cliente.apellido = data['apellido']
            if data.get('telefono'): cliente.telefono = data['telefono']
            if data.get('email'): cliente.email = data['email']

        nueva = Reserva(
            fecha_reserva=data['fecha'],
            hora_reserva=data['hora'],
            cantidad_personas=data.get('cantidad', 1),
            id_mesa=data['id_mesa'],
            id_cliente=cliente.id_cliente,
            estado='pendiente'
        )
        db.session.add(nueva)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Reserva creada exitosamente. Solicitud enviada a Cajera para confirmación.'})

    query = Reserva.query.options(joinedload(Reserva.cliente), joinedload(Reserva.mesa))
    if request.args.get('estado'):
        query = query.filter_by(estado=request.args.get('estado'))
    
    return jsonify([{
        'id': r.id_reserva,
        'fecha': str(r.fecha_reserva),
        'hora': str(r.hora_reserva),
        'cliente': f"{r.cliente.nombre} {r.cliente.apellido}" if r.cliente else 'N/A',
        'dni': r.cliente.dni if r.cliente else '',
        'telefono': r.cliente.telefono if r.cliente else '',
        'mesa': r.mesa.numero_mesa if r.mesa else 0,
        'id_mesa': r.id_mesa,
        'personas': r.cantidad_personas,
        'estado': r.estado
    } for r in query.order_by(Reserva.fecha_reserva.desc()).all()])

@app.route('/api/reservas/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def modificar_reserva(id):
    reserva = Reserva.query.get_or_404(id)
    
    if request.method == 'GET':
        return jsonify({
            'id': reserva.id_reserva,
            'fecha': str(reserva.fecha_reserva),
            'hora': str(reserva.hora_reserva),
            'cantidad': reserva.cantidad_personas,
            'id_mesa': reserva.id_mesa,
            'estado': reserva.estado,
            'cliente': {
                'dni': reserva.cliente.dni,
                'nombre': reserva.cliente.nombre,
                'apellido': reserva.cliente.apellido,
                'telefono': reserva.cliente.telefono,
                'email': reserva.cliente.email
            } if reserva.cliente else None
        })
    
    if request.method == 'DELETE':
        if reserva.estado not in ['cancelada', 'rechazada']:
            return jsonify({'error': 'Solo se pueden eliminar reservas canceladas o rechazadas'}), 400
        db.session.delete(reserva)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Reserva eliminada correctamente'})

    data = request.json
    if 'estado' in data:
        reserva.estado = data['estado']
    if 'fecha' in data:
        reserva.fecha_reserva = data['fecha']
    if 'hora' in data:
        reserva.hora_reserva = data['hora']
    if 'id_mesa' in data:
        reserva.id_mesa = data['id_mesa']
    if 'cantidad' in data:
        reserva.cantidad_personas = data['cantidad']
    
    if reserva.cliente and data.get('cliente'):
        c = data['cliente']
        if c.get('nombre'): reserva.cliente.nombre = c['nombre']
        if c.get('apellido'): reserva.cliente.apellido = c['apellido']
        if c.get('telefono'): reserva.cliente.telefono = c['telefono']
        if c.get('email'): reserva.cliente.email = c['email']
    
    db.session.commit()
    return jsonify({'success': True, 'message': 'Reserva actualizada correctamente'})

# ==================== HUO09-HUO11: COMANDAS ====================
@app.route('/api/menu', methods=['GET'])
@login_required
def get_menu():
    categorias = {}
    for m in Menu.query.filter_by(disponibilidad=True).all():
        cat = m.categoria or 'Otros'
        if cat not in categorias:
            categorias[cat] = []
        categorias[cat].append({
            'id': m.id_menu, 'nombre': m.nombre,
            'precio': float(m.precio), 'descripcion': m.descripcion
        })
    return jsonify(categorias)

@app.route('/api/comandas', methods=['GET', 'POST'])
@login_required
def gestion_comandas():
    if request.method == 'POST':
        data = request.json
        if not data.get('id_mesa'):
            return jsonify({'error': 'Debe seleccionar una mesa'}), 400
        if not data.get('items') or len(data['items']) == 0:
            return jsonify({'error': 'Debe agregar al menos un plato'}), 400
        
        nueva_comanda = Comanda(
            id_mesa=data['id_mesa'],
            estado='pendiente',
            nombre_cliente=data.get('nombre_cliente', ''),
            observaciones_general=data.get('observaciones', '')
        )
        db.session.add(nueva_comanda)
        db.session.flush()
        
        for item in data['items']:
            detalle = DetalleComanda(
                id_comanda=nueva_comanda.id_comanda,
                id_menu=item['id_menu'],
                cantidad=item['cantidad'],
                observaciones=item.get('observaciones', '')
            )
            db.session.add(detalle)
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Comanda enviada a cocina exitosamente'})

    estado = request.args.get('estado')
    query = Comanda.query.options(
        joinedload(Comanda.mesa),
        joinedload(Comanda.detalles).joinedload(DetalleComanda.menu)
    )
    if estado:
        query = query.filter_by(estado=estado)
    else:
        query = query.filter(Comanda.estado != 'pagada')
    
    return jsonify([{
        'id': c.id_comanda,
        'mesa': c.mesa.numero_mesa if c.mesa else 0,
        'id_mesa': c.id_mesa,
        'hora': c.fecha_creacion.strftime('%H:%M') if c.fecha_creacion else '',
        'fecha': c.fecha_creacion.strftime('%Y-%m-%d') if c.fecha_creacion else '',
        'estado': c.estado,
        'nombre_cliente': c.nombre_cliente or '',
        'observaciones': c.observaciones_general or '',
        'items': [{
            'id_detalle': d.id_detalle,
            'id_menu': d.id_menu,
            'nombre': d.menu.nombre if d.menu else '',
            'cantidad': d.cantidad,
            'precio': float(d.menu.precio) if d.menu else 0,
            'observaciones': d.observaciones or ''
        } for d in c.detalles],
        'total': sum(d.cantidad * float(d.menu.precio) for d in c.detalles if d.menu)
    } for c in query.order_by(Comanda.fecha_creacion.desc()).all()])

@app.route('/api/comandas/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def actualizar_comanda(id):
    comanda = Comanda.query.options(
        joinedload(Comanda.detalles).joinedload(DetalleComanda.menu)
    ).get_or_404(id)
    
    if request.method == 'GET':
        return jsonify({
            'id': comanda.id_comanda,
            'id_mesa': comanda.id_mesa,
            'estado': comanda.estado,
            'nombre_cliente': comanda.nombre_cliente or '',
            'observaciones': comanda.observaciones_general or '',
            'items': [{
                'id_detalle': d.id_detalle,
                'id_menu': d.id_menu,
                'nombre': d.menu.nombre,
                'cantidad': d.cantidad,
                'precio': float(d.menu.precio),
                'observaciones': d.observaciones or ''
            } for d in comanda.detalles]
        })
    
    if request.method == 'DELETE':
        if comanda.estado == 'pagada':
            return jsonify({'error': 'No se puede eliminar una comanda pagada'}), 400
        db.session.delete(comanda)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Comanda eliminada'})
    
    data = request.json
    
    if 'estado' in data:
        comanda.estado = data['estado']
    
    if 'nombre_cliente' in data:
        comanda.nombre_cliente = data['nombre_cliente']
    
    if 'observaciones' in data:
        comanda.observaciones_general = data['observaciones']
    
    if 'items' in data:
        DetalleComanda.query.filter_by(id_comanda=comanda.id_comanda).delete()
        for item in data['items']:
            detalle = DetalleComanda(
                id_comanda=comanda.id_comanda,
                id_menu=item['id_menu'],
                cantidad=item['cantidad'],
                observaciones=item.get('observaciones', '')
            )
            db.session.add(detalle)
    
    db.session.commit()
    return jsonify({'success': True, 'message': 'Comanda actualizada correctamente'})

# ==================== HUO12-HUO14: PAGOS ====================
@app.route('/api/cuentas/previsualizar/<int:id_comanda>', methods=['GET'])
@login_required
def previsualizar_cuenta(id_comanda):
    comanda = Comanda.query.options(
        joinedload(Comanda.detalles).joinedload(DetalleComanda.menu),
        joinedload(Comanda.mesa)
    ).get_or_404(id_comanda)
    
    items = []
    total = 0
    for d in comanda.detalles:
        subtotal = d.cantidad * float(d.menu.precio)
        total += subtotal
        items.append({
            'id_detalle': d.id_detalle,
            'id_menu': d.id_menu,
            'nombre': d.menu.nombre,
            'precio': float(d.menu.precio),
            'cantidad': d.cantidad,
            'subtotal': subtotal,
            'observaciones': d.observaciones or ''
        })
    
    return jsonify({
        'id_comanda': comanda.id_comanda,
        'mesa': comanda.mesa.numero_mesa if comanda.mesa else 0,
        'nombre_cliente': comanda.nombre_cliente or '',
        'items': items,
        'total': total
    })

@app.route('/api/pagos', methods=['POST'])
@login_required
def registrar_pago():
    data = request.json
    
    if not data.get('id_comanda'):
        return jsonify({'error': 'ID de comanda requerido'}), 400
    if not data.get('tipo') or data['tipo'] not in ['boleta', 'factura']:
        return jsonify({'error': 'Tipo de comprobante inválido'}), 400
    
    comanda = Comanda.query.get_or_404(data['id_comanda'])
    if comanda.estado == 'pagada':
        return jsonify({'error': 'Esta comanda ya fue pagada'}), 400
    
    total = sum(d.cantidad * float(d.menu.precio) for d in comanda.detalles)
    
    cuenta = Cuenta(
        hora_apertura=datetime.now().time(),
        hora_cierre=datetime.now().time(),
        total=total,
        id_comanda=data['id_comanda']
    )
    db.session.add(cuenta)
    db.session.flush()
    
    if data['tipo'] == 'boleta':
        comp = Boleta(
            id_cuenta=cuenta.id_cuenta,
            metodo_pago=data.get('metodo', 'Efectivo'),
            dni=data.get('dni', '')
        )
    else:
        comp = Factura(
            id_cuenta=cuenta.id_cuenta,
            metodo_pago=data.get('metodo', 'Efectivo'),
            razon_social=data.get('razon_social', ''),
            ruc=data.get('ruc', '')
        )
    db.session.add(comp)
    
    comanda.estado = 'pagada'
    
    if data.get('id_reserva'):
        res = Reserva.query.get(data['id_reserva'])
        if res:
            res.estado = 'pagada'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Pago registrado correctamente. {data["tipo"].title()} generada.',
        'id_comprobante': comp.id_comprobante,
        'total': float(total)
    })

# ==================== UTILIDADES ====================
@app.route('/api/admin/seed', methods=['POST'])
def seed_db():
    from seed_complete import seed_complete_database
    seed_complete_database()
    return jsonify({'success': True, 'message': 'Base de datos repoblada exitosamente'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000, host='0.0.0.0')