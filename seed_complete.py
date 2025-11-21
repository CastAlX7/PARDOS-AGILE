"""
SCRIPT COMPLETO PARA POBLAR LA BASE DE DATOS (CORREGIDO)
"""
from app import app
from models import db, Cliente, Mesa, Menu, Reserva, Comanda, DetalleComanda, Cuenta
from sqlalchemy import text
from datetime import datetime, date

def seed_complete_database():
    with app.app_context():
        print("🌱 INICIANDO LIMPIEZA PROFUNDA...")
        
        try:
            # 1. Desactivar protección de claves foráneas
            db.session.execute(text('SET FOREIGN_KEY_CHECKS = 0'))
            db.session.commit()
            
            # 2. BORRAR TABLA FANTASMA 'Pedido' (Esta es la causante de tu error)
            print("🗑️  Eliminando tablas antiguas...")
            db.session.execute(text('DROP TABLE IF EXISTS Pedido'))
            db.session.commit()

            # 3. Borrar el resto de tablas
            db.drop_all()
            
            # 4. Reactivar protección
            db.session.execute(text('SET FOREIGN_KEY_CHECKS = 1'))
            db.session.commit()
            print("✅ Base de datos limpia.")

            # 5. CREAR TABLAS NUEVAS
            print("🏗️  Creando nueva estructura...")
            db.create_all()
            
            # --- POBLANDO DATOS ---
            
            # CLIENTES
            print("👥 Creando Clientes...")
            clientes = []
            for i in range(10):
                c = Cliente(nombre=f"Cliente{i}", apellido="Test", dni=f"1000000{i}", telefono="999888777")
                clientes.append(c)
            db.session.add_all(clientes)
            
            # MESAS
            print("🪑 Creando Mesas...")
            mesas = [
                Mesa(numero_mesa=1, capacidad=2, ubicacion='Ventana', tipo_mesa='Regular'),
                Mesa(numero_mesa=2, capacidad=4, ubicacion='Centro', tipo_mesa='Regular'),
                Mesa(numero_mesa=3, capacidad=6, ubicacion='Terraza', tipo_mesa='Premium'),
                Mesa(numero_mesa=4, capacidad=8, ubicacion='Privado', tipo_mesa='VIP'),
                Mesa(numero_mesa=5, capacidad=2, ubicacion='Barra', tipo_mesa='Barra'),
            ]
            db.session.add_all(mesas)
            
            # MENÚ
            print("🍗 Creando Menú...")
            menu_data = [
                ('1/4 Pollo a la Brasa', 18.90), ('1/2 Pollo a la Brasa', 32.90), ('Pollo Entero', 59.90),
                ('Alitas BBQ', 24.90), ('Chaufa de Pollo', 19.90), ('Inca Kola 1.5L', 8.00),
                ('Papas Fritas', 12.00), ('Ensalada', 14.00)
            ]
            menus = [Menu(nombre=n, precio=p, descripcion="Delicioso") for n, p in menu_data]
            db.session.add_all(menus)
            db.session.commit() 
            
            # RESERVAS
            print("📅 Creando Reservas...")
            r1 = Reserva(fecha_reserva=date.today(), hora_reserva=datetime.strptime("13:00", "%H:%M").time(), cantidad_personas=4, estado='pendiente', id_mesa=2, id_cliente=1)
            db.session.add(r1)
            
            # COMANDAS
            print("🍽️  Creando Comandas...")
            c1 = Comanda(id_mesa=3, estado='pendiente')
            db.session.add(c1)
            db.session.flush()
            
            # DETALLES
            d1 = DetalleComanda(id_comanda=c1.id_comanda, id_menu=menus[2].id_menu, cantidad=1, observaciones="Sin ensalada")
            d2 = DetalleComanda(id_comanda=c1.id_comanda, id_menu=menus[5].id_menu, cantidad=2, observaciones="Helada")
            db.session.add_all([d1, d2])
            
            db.session.commit()
            print("✨ ¡EXITO! BASE DE DATOS POBLADA CORRECTAMENTE ✨")
            
        except Exception as e:
            print(f"\n❌ Ocurrió un error: {e}")
            db.session.rollback()

if __name__ == '__main__':
    seed_complete_database()