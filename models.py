"""
MODELOS DE BASE DE DATOS - PARDOS CHICKEN (Completo)
"""
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import relationship

db = SQLAlchemy()

class Cliente(db.Model):
    __tablename__ = 'Cliente'
    id_cliente = db.Column('idCliente', db.Integer, primary_key=True, autoincrement=True)
    nombre = db.Column('Nombre', db.String(100), nullable=False)
    apellido = db.Column('Apellido', db.String(100))
    direccion = db.Column('Direccion', db.String(200))
    telefono = db.Column('Telefono', db.String(20))
    email = db.Column('Email', db.String(100))
    dni = db.Column('DNI', db.CHAR(8), unique=True)
    
    reservas = db.relationship('Reserva', back_populates='cliente', lazy=True)

class Mesa(db.Model):
    __tablename__ = 'Mesa'
    id_mesa = db.Column('idMesa', db.Integer, primary_key=True, autoincrement=True)
    numero_mesa = db.Column('NumeroMesa', db.Integer)
    capacidad = db.Column('Capacidad', db.Integer)
    ubicacion = db.Column('Ubicacion', db.String(100))
    descripcion = db.Column('Descripcion', db.Text)
    tipo_mesa = db.Column('TipoMesa', db.String(50))
    disponibilidad = db.Column('Disponibilidad', db.Boolean, default=True)

    reservas = db.relationship('Reserva', back_populates='mesa', lazy=True)
    comandas = db.relationship('Comanda', back_populates='mesa', lazy=True)

class Menu(db.Model):
    __tablename__ = 'Menu'
    id_menu = db.Column('idMenu', db.Integer, primary_key=True, autoincrement=True)
    nombre = db.Column('Nombre', db.String(100), nullable=False)
    precio = db.Column('Precio', db.Numeric(10, 2), nullable=False, default=0.00)
    descripcion = db.Column('Descripcion', db.Text)
    categoria = db.Column('Categoria', db.String(50))
    imagen_url = db.Column('ImagenUrl', db.String(255))
    disponibilidad = db.Column('Disponibilidad', db.Boolean, default=True)

class Reserva(db.Model):
    __tablename__ = 'Reserva'
    id_reserva = db.Column('idReserva', db.Integer, primary_key=True, autoincrement=True)
    fecha_reserva = db.Column('FechaReserva', db.Date, nullable=False)
    hora_reserva = db.Column('HoraReserva', db.Time, nullable=False)
    cantidad_personas = db.Column('CantidadPersonas', db.Integer, nullable=False)
    estado = db.Column('Estado', db.String(20), default='pendiente')
    fecha_creacion = db.Column('FechaCreacion', db.DateTime, default=db.func.current_timestamp())
    
    id_mesa = db.Column('idMesa', db.Integer, db.ForeignKey('Mesa.idMesa'))
    id_cliente = db.Column('idCliente', db.Integer, db.ForeignKey('Cliente.idCliente'))

    cliente = db.relationship('Cliente', back_populates='reservas')
    mesa = db.relationship('Mesa', back_populates='reservas')

class Comanda(db.Model):
    __tablename__ = 'Comanda'
    id_comanda = db.Column('idComanda', db.Integer, primary_key=True, autoincrement=True)
    fecha_creacion = db.Column('FechaCreacion', db.DateTime, default=db.func.current_timestamp())
    estado = db.Column('Estado', db.String(20), default='pendiente')
    nombre_cliente = db.Column('NombreCliente', db.String(100))
    observaciones_general = db.Column('ObservacionesGeneral', db.Text)
    
    id_mesa = db.Column('idMesa', db.Integer, db.ForeignKey('Mesa.idMesa'))
    
    mesa = db.relationship('Mesa', back_populates='comandas')
    detalles = db.relationship('DetalleComanda', back_populates='comanda', cascade="all, delete-orphan")
    cuenta = db.relationship('Cuenta', back_populates='comanda', uselist=False)

class DetalleComanda(db.Model):
    __tablename__ = 'DetalleComanda'
    id_detalle = db.Column('idDetalle', db.Integer, primary_key=True, autoincrement=True)
    cantidad = db.Column('Cantidad', db.Integer, nullable=False)
    observaciones = db.Column('Observaciones', db.String(200))
    
    id_comanda = db.Column('idComanda', db.Integer, db.ForeignKey('Comanda.idComanda'))
    id_menu = db.Column('idMenu', db.Integer, db.ForeignKey('Menu.idMenu'))
    
    comanda = db.relationship('Comanda', back_populates='detalles')
    menu = db.relationship('Menu')

class Cuenta(db.Model):
    __tablename__ = 'Cuenta'
    id_cuenta = db.Column('idCuenta', db.Integer, primary_key=True, autoincrement=True)
    hora_apertura = db.Column('HoraApertura', db.Time)
    hora_cierre = db.Column('HoraCierre', db.Time)
    total = db.Column('Total', db.Numeric(10, 2), nullable=False)
    
    id_comanda = db.Column('idComanda', db.Integer, db.ForeignKey('Comanda.idComanda'))
    comanda = db.relationship('Comanda', back_populates='cuenta')
    comprobante = db.relationship('Comprobante', back_populates='cuenta', uselist=False)

class Comprobante(db.Model):
    __tablename__ = 'Comprobante'
    id_comprobante = db.Column('idComprobante', db.Integer, primary_key=True, autoincrement=True)
    metodo_pago = db.Column('MetodoPago', db.String(50))
    fecha_emision = db.Column('FechaEmision', db.DateTime, default=db.func.current_timestamp())
    
    id_cuenta = db.Column('idCuenta', db.Integer, db.ForeignKey('Cuenta.idCuenta'))
    tipo = db.Column(db.String(50))
    
    cuenta = db.relationship('Cuenta', back_populates='comprobante')
    
    __mapper_args__ = {'polymorphic_on': tipo, 'polymorphic_identity': 'comprobante'}

class Boleta(Comprobante):
    __tablename__ = 'Boleta'
    id_comprobante = db.Column(db.Integer, db.ForeignKey('Comprobante.idComprobante'), primary_key=True)
    dni = db.Column('Dni', db.String(20))
    __mapper_args__ = {'polymorphic_identity': 'boleta'}

class Factura(Comprobante):
    __tablename__ = 'Factura'
    id_comprobante = db.Column(db.Integer, db.ForeignKey('Comprobante.idComprobante'), primary_key=True)
    razon_social = db.Column('RazonSocial', db.String(100))
    ruc = db.Column('RUC', db.String(20))
    __mapper_args__ = {'polymorphic_identity': 'factura'}