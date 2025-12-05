from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from config import Config
from models import db, Cliente, Mesa, Reserva, Comanda, DetalleComanda, Menu, Cuenta, Comprobante, Boleta, Factura
from sqlalchemy.orm import joinedload
from sqlalchemy import and_
from datetime import datetime, date, time as dt_time
from functools import wraps
import os
import time  # módulo time del sistema (para tzset)
import requests

# Configurar zona horaria del proceso (Render usa UTC por defecto)
os.environ["TZ"] = Config.TIMEZONE  # en config.py tienes TIMEZONE = 'America/Lima'
time.tzset()

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
HORA_APERTURA = dt_time(11, 0)  # 11:00 AM
HORA_CIERRE = dt_time(24, 0)    # 10:00 PM

@app.route('/api/reservas', methods=['GET', 'POST'])
@login_required
def gestion_reservas():
    if request.method == 'POST':
        data = request.json
        
        # Validación DNI
        if not data.get('dni') or len(data['dni']) != 8:
            return jsonify({'error': 'DNI inválido (debe ser 8 dígitos)'}), 400
        
        # Validación Fecha y Hora
        if not data.get('fecha') or not data.get('hora'):
            return jsonify({'error': 'Fecha y hora son obligatorios'}), 400
        
        # Validar que no sea fecha pasada
        fecha_reserva = datetime.strptime(data['fecha'], '%Y-%m-%d').date()
        hora_reserva = datetime.strptime(data['hora'], '%H:%M').time()
        ahora = datetime.now()
        hoy = ahora.date()

        if fecha_reserva > hoy:
            pass
        elif fecha_reserva == hoy:
            hora_actual = ahora.time()
            if hora_reserva <= hora_actual:
                return jsonify({'error': 'No se pueden crear reservas para horas pasadas'}), 400
        else:
            return jsonify({'error': 'No se pueden crear reservas para fechas pasadas'}), 400
        
        # Validar horario de atención
        if not (HORA_APERTURA <= hora_reserva <= HORA_CIERRE):
            return jsonify({'error': 'Horario fuera de atención (11:00 AM - 10:00 PM)'}), 400

        if not data.get('id_mesa'):
            return jsonify({'error': 'Debe seleccionar una mesa'}), 400
        
        mesa = Mesa.query.get(data['id_mesa'])
        if mesa and data.get('cantidad', 1) > mesa.capacidad:
            return jsonify({'error': f'Mesa {mesa.numero_mesa} solo tiene capacidad para {mesa.capacidad} personas'}), 400
        
        from datetime import timedelta
        
        # ✅ Buscar cliente
        cliente_intenta_reservar = Cliente.query.filter_by(dni=data['dni']).first()
        id_cliente_intenta = cliente_intenta_reservar.id_cliente if cliente_intenta_reservar else None
        
        # ✅ REGLA 1: NADIE puede usar la misma mesa con menos de 2 horas de diferencia
        reservas_en_esta_mesa = Reserva.query.filter(
            Reserva.id_mesa == data['id_mesa'],
            Reserva.fecha_reserva == fecha_reserva,
            Reserva.estado.in_(['pendiente', 'confirmada'])
        ).all()
        
        for reserva_existente in reservas_en_esta_mesa:
            hora_existente = reserva_existente.hora_reserva
            dt_nueva = datetime.combine(fecha_reserva, hora_reserva)
            dt_existente = datetime.combine(fecha_reserva, hora_existente)
            diferencia_minutos = abs((dt_nueva - dt_existente).total_seconds() / 60)
            
            if diferencia_minutos < 120:
                hora_disponible = (dt_existente + timedelta(hours=2)).strftime('%H:%M')
                
                if reserva_existente.id_cliente == id_cliente_intenta:
                    return jsonify({
                        'error': f'⚠️ Ya tienes una reserva en Mesa {mesa.numero_mesa} a las {hora_existente.strftime("%H:%M")}.\n\n'
                                f'Próxima disponibilidad: {hora_disponible}\n\n'
                                f'💡 Puedes reservar OTRA MESA ahora mismo'
                    }), 409
                else:
                    otro = f"{reserva_existente.cliente.nombre} {reserva_existente.cliente.apellido}"
                    return jsonify({
                        'error': f'❌ Mesa {mesa.numero_mesa} reservada por {otro} a las {hora_existente.strftime("%H:%M")}.\n\n'
                                f'Próxima disponibilidad: {hora_disponible}'
                    }), 409
        
        # ✅ REGLA 2: Un cliente puede tener múltiples reservas si hay 2+ horas entre ellas
        if cliente_intenta_reservar:
            todas_reservas_cliente = Reserva.query.filter(
                Reserva.id_cliente == id_cliente_intenta,
                Reserva.fecha_reserva == fecha_reserva,
                Reserva.estado.in_(['pendiente', 'confirmada'])
            ).all()
            
            print(f"\n🔍 DEBUG: Cliente {data['dni']} tiene {len(todas_reservas_cliente)} reserva(s) en {fecha_reserva}")
            
            for otra_reserva in todas_reservas_cliente:
                hora_otra = otra_reserva.hora_reserva
                dt_nueva = datetime.combine(fecha_reserva, hora_reserva)
                dt_otra = datetime.combine(fecha_reserva, hora_otra)
                diferencia_minutos = abs((dt_nueva - dt_otra).total_seconds() / 60)
                
                print(f"   📋 Reserva existente: Mesa {otra_reserva.mesa.numero_mesa} a las {hora_otra}")
                print(f"   ⏱️  Diferencia con nueva reserva ({hora_reserva}): {diferencia_minutos} minutos")
                
                # ✅ PERMITIR si hay 2+ horas de diferencia
                if diferencia_minutos >= 120:
                    print(f"   ✅ OK: {diferencia_minutos} >= 120, puede crear reserva")
                    continue
                
                # ❌ BLOQUEAR si hay menos de 2 horas
                print(f"   ❌ BLOQUEADO: {diferencia_minutos} < 120")
                hora_disponible = (dt_otra + timedelta(hours=2)).strftime('%H:%M')
                return jsonify({
                    'error': f'⚠️ Ya tienes una reserva a las {hora_otra.strftime("%H:%M")} (Mesa {otra_reserva.mesa.numero_mesa}).\n\n'
                            f'Debes esperar 2 horas entre reservas.\n\n'
                            f'✅ Próxima disponibilidad: {hora_disponible}'
                }), 409
        
        # ✅ Crear o actualizar cliente
        if not cliente_intenta_reservar:
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
            cliente = cliente_intenta_reservar
            if data.get('nombre'): cliente.nombre = data['nombre']
            if data.get('apellido'): cliente.apellido = data['apellido']
            if data.get('telefono'): cliente.telefono = data['telefono']
            if data.get('email'): cliente.email = data['email']

        # ✅ CREAR RESERVA
        nueva = Reserva(
            fecha_reserva=data['fecha'],
            hora_reserva=data['hora'],
            cantidad_personas=data.get('cantidad', 1),
            id_mesa=data['id_mesa'],
            id_cliente=cliente.id_cliente,
            estado='pendiente'
        )
        db.session.add(nueva)
        db.session.flush()

        # ✅ Crear comanda si hay items
        if data.get('items') and len(data['items']) > 0:
            nueva_comanda = Comanda(
                id_mesa=data['id_mesa'],
                id_reserva=nueva.id_reserva,
                estado='pendiente',
                nombre_cliente=data.get('nombre_cliente', ''),
                observaciones_general=data.get('observaciones', ''),
                fecha_creacion=ahora
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
        
        return jsonify({
            'success': True, 
            'message': '✅ Reserva creada exitosamente',
            'id': nueva.id_reserva
        })

    # GET - Listar reservas
    query = Reserva.query.options(joinedload(Reserva.cliente), joinedload(Reserva.mesa))
    if request.args.get('estado'):
        query = query.filter_by(estado=request.args.get('estado'))
    
    return jsonify([{
        'id_reserva': r.id_reserva,
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

# ==================== NUEVA RUTA: AGREGAR COMANDA A RESERVA EXISTENTE ====================
@app.route('/api/reservas/<int:id>/comanda', methods=['POST'])
@login_required
def agregar_comanda_a_reserva(id):
    """
    Permite agregar un pedido a una reserva existente
    SIN crear conflictos
    """
    reserva = Reserva.query.get_or_404(id)
    data = request.json
    
    if not data.get('items') or len(data['items']) == 0:
        return jsonify({'error': 'Debe agregar al menos un plato'}), 400
    
    ahora = datetime.now()
    
    # Verificar si ya existe comanda activa para esta reserva
    comanda_existente = Comanda.query.filter(
        Comanda.id_reserva == id,
        Comanda.estado.in_(['pendiente', 'completada'])
    ).first()
    
    if comanda_existente:
        # Si ya existe, actualizar los items (agregar más)
        print(f'ðŸ"¥ Actualizando comanda existente #{comanda_existente.id_comanda}')
        comanda = comanda_existente
    else:
        # Crear nueva comanda para la reserva
        print(f'ðŸ"¥ Creando nueva comanda para reserva #{id}')
        comanda = Comanda(
            id_mesa=reserva.id_mesa,
            id_reserva=id,
            estado='pendiente',
            nombre_cliente=data.get('nombre_cliente', reserva.cliente.nombre if reserva.cliente else ''),
            observaciones_general=data.get('observaciones', ''),
            fecha_creacion=ahora
        )
        db.session.add(comanda)
        db.session.flush()
    
    # Agregar items
    for item in data['items']:
        detalle = DetalleComanda(
            id_comanda=comanda.id_comanda,
            id_menu=item['id_menu'],
            cantidad=item['cantidad'],
            observaciones=item.get('observaciones', '')
        )
        db.session.add(detalle)
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Pedido agregado a la reserva exitosamente',
        'id_comanda': comanda.id_comanda
    })

# ==================== HUO08: Eliminar reservas canceladas ====================
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
    
    if request.method == 'PUT':
        data = request.json
    
        # ✅ Si cambian fecha/hora/mesa, RE-VALIDAR disponibilidad
        if 'fecha' in data or 'hora' in data or 'id_mesa' in data:
            from datetime import timedelta
            
            nueva_fecha = datetime.strptime(data.get('fecha', str(reserva.fecha_reserva)), '%Y-%m-%d').date()
            nueva_hora = datetime.strptime(data.get('hora', str(reserva.hora_reserva)), '%H:%M').time()
            nueva_mesa = data.get('id_mesa', reserva.id_mesa)
            
            # Validar que no sea pasado
            ahora = datetime.now()
            if nueva_fecha < ahora.date() or (nueva_fecha == ahora.date() and nueva_hora <= ahora.time()):
                return jsonify({'error': 'No se pueden programar reservas en el pasado'}), 400
            
            # Validar horario de atención
            if not (HORA_APERTURA <= nueva_hora <= HORA_CIERRE):
                return jsonify({'error': 'Horario fuera de atención (11:00 AM - 10:00 PM)'}), 400
            
            # ✅ Validar disponibilidad de la mesa (ignorar la reserva actual)
            conflictos = Reserva.query.filter(
                Reserva.id_mesa == nueva_mesa,
                Reserva.fecha_reserva == nueva_fecha,
                Reserva.estado.in_(['pendiente', 'confirmada']),
                Reserva.id_reserva != id  # ← Ignorar esta reserva
            ).all()
            
            for conflicto in conflictos:
                dt_nueva = datetime.combine(nueva_fecha, nueva_hora)
                dt_conflicto = datetime.combine(nueva_fecha, conflicto.hora_reserva)
                diferencia = abs((dt_nueva - dt_conflicto).total_seconds() / 60)
                
                if diferencia < 120:
                    return jsonify({
                        'error': f'❌ La mesa ya está reservada a las {conflicto.hora_reserva.strftime("%H:%M")}'
                    }), 409
        
        # ✅ Aplicar cambios
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
        return jsonify({'success': True, 'message': '✅ Reserva actualizada correctamente'})
    
    if request.method == 'DELETE':
        # ✅ VALIDAR ESTADO
        if reserva.estado not in ['cancelada', 'rechazada']:
            return jsonify({'error': '❌ Solo se pueden eliminar reservas canceladas o rechazadas'}), 400
        
        # ✅ ELIMINAR COMANDAS ASOCIADAS PRIMERO
        try:
            # Buscar y eliminar todas las comandas vinculadas a esta reserva
            comandas_asociadas = Comanda.query.filter_by(id_reserva=id).all()
            
            for comanda in comandas_asociadas:
                # Eliminar detalles de la comanda
                DetalleComanda.query.filter_by(id_comanda=comanda.id_comanda).delete()
                # Eliminar cuenta si existe
                Cuenta.query.filter_by(id_comanda=comanda.id_comanda).delete()
                # Eliminar la comanda
                db.session.delete(comanda)
            
            # Ahora sí eliminar la reserva
            db.session.delete(reserva)
            db.session.commit()
            
            return jsonify({'success': True, 'message': '✅ Reserva eliminada correctamente'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'❌ Error al eliminar: {str(e)}'}), 500

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

# ==================== EN app.py - LÍNEA ~390 ====================
@app.route('/api/comandas', methods=['GET', 'POST'])
@login_required
def gestion_comandas():
    if request.method == 'POST':
        data = request.json
        if not data.get('id_mesa'):
            return jsonify({'error': '❌ Debe seleccionar una mesa'}), 400
        if not data.get('items') or len(data['items']) == 0:
            return jsonify({'error': '❌ Debe agregar al menos un plato'}), 400
            
        mesa_id = data['id_mesa']
        
        # ✅ CAPTURAR id_reserva PRIMERO (ANTES DE USARLO)
        id_reserva_vinculada = data.get('id_reserva')
        
        # ✅ CORRECCIÓN: Usar hora de la RESERVA si existe
        if id_reserva_vinculada:
            reserva = Reserva.query.get(id_reserva_vinculada)
            ahora = datetime.combine(reserva.fecha_reserva, reserva.hora_reserva)
            hoy = reserva.fecha_reserva
        else:
            ahora = datetime.now()
            hoy = ahora.date()

        # ✅ NUEVO: Si viene de modificar reserva, PERMITIR sin validar conflictos
        if id_reserva_vinculada:
            print(f"✅ Modificando pedido de reserva #{id_reserva_vinculada}, PERMITIDO sin validaciones")
            
            # Buscar si ya existe comanda para esta reserva
            comanda_existente = Comanda.query.filter(
                Comanda.id_reserva == id_reserva_vinculada,
                Comanda.estado.in_(['pendiente', 'completada'])
            ).first()
            
            if comanda_existente:
                # ✅ ACTUALIZAR comanda existente (eliminar items viejos, agregar nuevos)
                print(f"📝 Actualizando comanda existente #{comanda_existente.id_comanda}")
                
                # Eliminar items viejos
                DetalleComanda.query.filter_by(id_comanda=comanda_existente.id_comanda).delete()
                
                # Agregar items nuevos
                for item in data['items']:
                    detalle = DetalleComanda(
                        id_comanda=comanda_existente.id_comanda,
                        id_menu=item['id_menu'],
                        cantidad=item['cantidad'],
                        observaciones=item.get('observaciones', '')
                    )
                    db.session.add(detalle)
                
                db.session.commit()
                return jsonify({'success': True, 'message': '✅ Pedido actualizado exitosamente'})
            else:
                # ✅ Crear nueva comanda vinculada a reserva
                print(f"📝 Creando nueva comanda para reserva #{id_reserva_vinculada}")
                nueva_comanda = Comanda(
                    id_mesa=mesa_id,
                    id_reserva=id_reserva_vinculada,
                    estado='pendiente',
                    nombre_cliente=data.get('nombre_cliente', ''),
                    observaciones_general=data.get('observaciones', ''),
                    fecha_creacion=ahora
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
                return jsonify({'success': True, 'message': '✅ Pedido enviado a cocina exitosamente'})

        # ✅ VALIDACIÓN 1: Verificar si hay RESERVA PENDIENTE (solo para pedidos SIN reserva)
        reserva_pendiente = Reserva.query.filter(
            Reserva.id_mesa == mesa_id,
            Reserva.fecha_reserva == hoy,
            Reserva.estado == 'pendiente'
        ).first()

        if reserva_pendiente:
            return jsonify({
                'error': f'⏸️ La Mesa tiene una RESERVA PENDIENTE'
            }), 409

        # ✅ VALIDACIÓN 2: Verificar comanda activa del MISMO DÍA (solo para pedidos SIN reserva)
        comanda_activa = Comanda.query.filter(
            Comanda.id_mesa == mesa_id,
            Comanda.estado.in_(['pendiente', 'completada']),
            db.func.date(Comanda.fecha_creacion) == hoy
        ).first()

        if comanda_activa:
            return jsonify({
                'error': f'❌ La Mesa ya tiene un pedido activo'
            }), 409
        
        # ✅ CREAR COMANDA NUEVA (sin reserva vinculada)
        nueva_comanda = Comanda(
            id_mesa=data['id_mesa'],
            id_reserva=id_reserva_vinculada,
            estado='pendiente',
            nombre_cliente=data.get('nombre_cliente', ''),
            observaciones_general=data.get('observaciones', ''),
            fecha_creacion=ahora
        )
        db.session.add(nueva_comanda)
        db.session.flush()

        print(f"🔥 DEBUG: id_reserva recibido = {id_reserva_vinculada}")
        print(f"🔥 DEBUG: Comanda creada ID = {nueva_comanda.id_comanda}")
        print(f"🔥 DEBUG: Comanda.id_reserva guardado = {nueva_comanda.id_reserva}")
        
        for item in data['items']:
            detalle = DetalleComanda(
                id_comanda=nueva_comanda.id_comanda,
                id_menu=item['id_menu'],
                cantidad=item['cantidad'],
                observaciones=item.get('observaciones', '')
            )
            db.session.add(detalle)
        
        db.session.commit()
        return jsonify({'success': True, 'message': '✅ Comanda enviada a cocina exitosamente'})

    # ========== GET - LISTAR COMANDAS (NO TOCAR) ==========
    estado = request.args.get('estado')
    query = Comanda.query.options(
        joinedload(Comanda.mesa),
        joinedload(Comanda.reserva),
        joinedload(Comanda.detalles).joinedload(DetalleComanda.menu)
    )

    if estado:
        query = query.filter_by(estado=estado)
    else:
        query = query.filter(Comanda.estado != 'pagada')

    comandas = query.order_by(Comanda.fecha_creacion.desc()).all()

    return jsonify([{
        'id': c.id_comanda,
        'mesa': c.mesa.numero_mesa if c.mesa else 0,
        'id_mesa': c.id_mesa,
        'id_reserva': c.id_reserva, 
        'estado_reserva': c.reserva.estado if c.reserva else None,
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
    } for c in comandas])

# ==================== NUEVA RUTA: LIBERAR MESA SIN PAGAR (LÍDER ADMIN) ====================
@app.route('/api/mesas/<int:id>/liberar', methods=['POST'])
@login_required
def liberar_mesa(id):
    """
    Permite al Líder liberar una mesa sin pagar
    Cancela el pedido y la reserva
    SOLO LÍDER puede hacer esto
    """
    if session.get('user_role') != 'Líder de Restaurante':
        return jsonify({'error': 'Solo el Líder puede liberar mesas sin pagar'}), 403
    
    mesa = Mesa.query.get_or_404(id)
    data = request.json or {}
    motivo = data.get('motivo', 'Acción administrativa')
    
    hoy = datetime.now().date()
    
    # Cancelar todas las comandas activas de esta mesa hoy
    comandas = Comanda.query.filter(
        Comanda.id_mesa == id,
        Comanda.estado.in_(['pendiente', 'completada']),
        db.func.date(Comanda.fecha_creacion) == hoy
    ).all()
    
    for c in comandas:
        c.estado = 'cancelada'
    
    # Cancelar todas las reservas pendientes de esta mesa hoy
    reservas = Reserva.query.filter(
        Reserva.id_mesa == id,
        Reserva.fecha_reserva == hoy,
        Reserva.estado.in_(['pendiente', 'confirmada'])
    ).all()
    
    for r in reservas:
        r.estado = 'cancelada'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Mesa #{mesa.numero_mesa} liberada sin pagar. {len(comandas)} comanda(s) cancelada(s). {len(reservas)} reserva(s) cancelada(s). Motivo: {motivo}'
    })


# ==================== FIX: ESTADÍSTICAS - CONTAR BIEN LAS PAGADAS ====================
@app.route('/api/informes', methods=['GET'])
@login_required
def renderInformes():
    """
    Endpoint para obtener estadísticas EN TIEMPO REAL
    """
    try:
        # 1. Cargar comandas con sus detalles y menú asociado
        comandas_con_detalles = Comanda.query.options(
            joinedload(Comanda.detalles).joinedload(DetalleComanda.menu)
        ).all()
        
        reservas = Reserva.query.all()
        
        hoy = datetime.now().date()
        
        # Función auxiliar para calcular el total de una comanda dinámicamente
        def calcular_total_comanda(comanda):
            # Asegura que d.menu exista antes de acceder al precio
            return sum(d.cantidad * float(d.menu.precio) for d in comanda.detalles if d.menu)

        # 2. CALCULAR MÉTRICAS
        
        comandas_pagadas = [c for c in comandas_con_detalles if c.estado == 'pagada']
        
        # Variables de desagregación
        ventas_mozo = 0.0
        ventas_reserva = 0.0
        
        for c in comandas_pagadas:
            total_comanda = calcular_total_comanda(c)
            
            if c.id_reserva:
                # Es un pedido ligado a una reserva
                ventas_reserva += total_comanda
            else:
                # Es un pedido de mozo (Mesa Directa, sin reserva)
                ventas_mozo += total_comanda

        # Cálculos Generales
        total_ventas = ventas_mozo + ventas_reserva
        
        comandas_hoy_pagadas = [c for c in comandas_pagadas if c.fecha_creacion and c.fecha_creacion.date() == hoy]
        ventas_hoy = sum(calcular_total_comanda(c) for c in comandas_hoy_pagadas)
        
        reservas_pagadas_count = len([r for r in reservas if r.estado == 'pagada'])
        promedio_gasto = total_ventas / reservas_pagadas_count if reservas_pagadas_count > 0 else 0
        total_reservas = len(reservas)
        
        # Agrupar por mes (sin cambios)
        ventas_por_mes = {}
        for c in comandas_pagadas:
            if c.fecha_creacion:
                mes = c.fecha_creacion.strftime('%Y-%m')
                if mes not in ventas_por_mes:
                    ventas_por_mes[mes] = 0
                ventas_por_mes[mes] += calcular_total_comanda(c)
        
        return jsonify({
            'reservas_total': total_reservas,
            'reservas_pendientes': len([r for r in reservas if r.estado == 'pendiente']),
            'reservas_confirmadas': len([r for r in reservas if r.estado == 'confirmada']),
            'reservas_pagadas': reservas_pagadas_count,
            'reservas_canceladas': len([r for r in reservas if r.estado in ['cancelada', 'rechazada']]),
            'comandas_pagadas': len(comandas_pagadas),
            'total_ventas': float(total_ventas),
            'ventas_hoy': float(ventas_hoy),
            'promedio_gasto': float(promedio_gasto),
            
            # NUEVOS CAMPOS DESAGREGADOS:
            'ventas_mozo': float(ventas_mozo),          
            'ventas_reserva': float(ventas_reserva),    
            'ventas_por_mes': ventas_por_mes
        })
    except Exception as e:
        print(f"ERROR en renderInformes: {e}")
        return jsonify({'error': str(e)}), 500

def comandas_por_mesa():
    """Retorna todas las comandas agrupadas por mesa"""
    try:
        comandas = Comanda.query.options(
            joinedload(Comanda.mesa),
            joinedload(Comanda.detalles).joinedload(DetalleComanda.menu)
        ).filter(Comanda.estado != 'pagada').all()
        
        return jsonify({
            'success': True,
            'comandas': [{
                'id': c.id_comanda,
                'mesa': c.mesa.numero_mesa if c.mesa else 0,
                'id_mesa': c.id_mesa,
                'hora': c.fecha_creacion.strftime('%H:%M') if c.fecha_creacion else '',
                'fecha': c.fecha_creacion.strftime('%Y-%m-%d') if c.fecha_creacion else '',
                'estado': c.estado,
                'nombre_cliente': c.nombre_cliente or '',
                'items': [{
                    'id_detalle': d.id_detalle,
                    'nombre': d.menu.nombre if d.menu else '',
                    'cantidad': d.cantidad,
                    'precio': float(d.menu.precio) if d.menu else 0,
                    'observaciones': d.observaciones or ''
                } for d in c.detalles],
                'total': sum(d.cantidad * float(d.menu.precio) for d in c.detalles if d.menu)
            } for c in comandas]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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
    
    # ✅ MARCAR COMANDA COMO PAGADA
    comanda.estado = 'pagada'
    print(f"🔒 Comanda #{comanda.id_comanda} marcada como PAGADA")

    # ✅ SI HAY RESERVA VINCULADA, CAMBIARLA A PAGADA
    if data.get('id_reserva'):
        res = Reserva.query.get(data['id_reserva'])
        if res and res.estado != 'pagada':
            res.estado = 'pagada'
            print(f"✅ Reserva #{res.id_reserva} marcada como PAGADA")
    else:
        # Si no viene ID de reserva, buscar por mesa y fecha
        hoy = datetime.now().date()
        reserva_mesa = Reserva.query.filter(
            Reserva.id_mesa == comanda.id_mesa,
            Reserva.fecha_reserva == hoy,
            Reserva.estado.in_(['confirmada', 'pendiente'])
        ).first()
        
        if reserva_mesa:
            reserva_mesa.estado = 'pagada'
            print(f"✅ Reserva #{reserva_mesa.id_reserva} de Mesa {comanda.id_mesa} marcada como PAGADA")

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'✅ Pago registrado correctamente. {data["tipo"].title()} generada. Mesa liberada.',
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