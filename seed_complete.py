"""
SCRIPT COMPLETO Y FUNCIONAL PARA POBLAR LA BASE DE DATOS CON EL MENÚ COMPLETO DE PARDO'S CHICKEN.

Incrementos:
- Mesas: 12
- Menú: ~60 Platos clasificados por categoría (Aperitivos, Pollos, Parrillas, Bebidas, etc.)
- Asegura la limpieza completa de la BD antes de poblar.
"""
from app import app
from models import db, Cliente, Mesa, Menu, Reserva, Comanda, DetalleComanda, Cuenta, Comprobante, Boleta, Factura
from sqlalchemy import text
from datetime import datetime, date, timedelta
import random

# =================================================================
# FUNCIONES AUXILIARES
# =================================================================

def create_paid_transaction(id_cliente, id_mesa, menu_items, target_date, target_time_str, dni_str, is_reservation=True):
    """
    Crea una transacción completa (Reserva/Comanda, Detalles, Cuenta, Boleta Pagada).
    Si is_reservation=False, crea una Comanda de Mesa Directa (Mozo).
    """
    
    time_obj = datetime.strptime(target_time_str, "%H:%M").time()
    dt_completo = datetime.combine(target_date, time_obj)
    id_reserva = None
    
    if is_reservation:
        # 1. Crear Reserva (Estado: 'pagada')
        reserva = Reserva(
            fecha_reserva=target_date, 
            hora_reserva=time_obj, 
            cantidad_personas=random.randint(2, 6), 
            estado='pagada', 
            id_mesa=id_mesa, 
            id_cliente=id_cliente
        )
        db.session.add(reserva)
        db.session.flush() 
        id_reserva = reserva.id_reserva

    # 2. Crear Comanda (Estado: 'pagada')
    comanda = Comanda(
        id_mesa=id_mesa, 
        id_reserva=id_reserva, 
        estado='pagada', 
        nombre_cliente=f"Cliente {id_cliente}",
        fecha_creacion=dt_completo
    )
    db.session.add(comanda)
    db.session.flush()
    
    total = 0
    
    # 3. Crear Detalles de Comanda
    for item in menu_items:
        detalle = DetalleComanda(
            id_comanda=comanda.id_comanda, 
            id_menu=item[0].id_menu, 
            cantidad=item[1], 
            observaciones=""
        )
        db.session.add(detalle)
        total += item[1] * float(item[0].precio)
    
    # 4. Crear Cuenta y Comprobante
    cuenta = Cuenta(
        hora_apertura=time_obj,
        hora_cierre=time_obj,
        total=total,
        id_comanda=comanda.id_comanda
    )
    db.session.add(cuenta)
    db.session.flush()
    
    # Comprobante Boleta (para simplificar)
    boleta = Boleta(
        id_cuenta=cuenta.id_cuenta,
        metodo_pago=random.choice(['Tarjeta', 'Efectivo', 'Yape', 'Plin']),
        dni=dni_str
    )
    db.session.add(boleta)


# =================================================================
# FUNCIÓN PRINCIPAL DE POBLAMIENTO
# =================================================================

def seed_complete_database():
    with app.app_context():
        print("🌱 INICIANDO LIMPIEZA PROFUNDA...")
        
        try:
            # 1. Desactivar comprobación de FK
            db.session.execute(text('SET FOREIGN_KEY_CHECKS = 0'))
            
            # 2. Eliminar las restricciones de Clave Foránea manualmente (Solución al Error 3730)
            print("🔨 Eliminando restricciones de FK conflictivas...")
            
            # Eliminamos la FK de DetalleComanda que apunta a Comanda (error reportado)
            try:
                db.session.execute(text("ALTER TABLE DetalleComanda DROP FOREIGN KEY ComandaDetalle_ibfk_1;"))
                print("   ✅ Restricción 'ComandaDetalle_ibfk_1' eliminada.")
            except Exception:
                pass
                
            # Eliminamos FKs comunes si existen para evitar otros errores
            try:
                db.session.execute(text("ALTER TABLE Cuenta DROP FOREIGN KEY Cuenta_ibfk_1;"))
                db.session.execute(text("ALTER TABLE Factura DROP FOREIGN KEY Factura_ibfk_1;"))
            except Exception:
                pass

            db.session.commit()
            
            # 3. Eliminar las tablas en el orden correcto (Hijo -> Padre)
            print("🗑️   Eliminando tablas en orden inverso de dependencia...")
            
            tablas_a_eliminar = [
                db.metadata.tables.get('Factura'), 
                db.metadata.tables.get('Boleta'),
                db.metadata.tables.get('Cuenta'),
                db.metadata.tables.get('DetalleComanda'),
                db.metadata.tables.get('Comprobante'), 
                db.metadata.tables.get('Comanda'),
                db.metadata.tables.get('Reserva'),
                db.metadata.tables.get('Mesa'), 
                db.metadata.tables.get('Cliente'),
                db.metadata.tables.get('Menu')
            ]
            
            db.metadata.drop_all(
                bind=db.engine, 
                tables=[t for t in tablas_a_eliminar if t is not None]
            )

            db.session.execute(text('DROP TABLE IF EXISTS Pedido')) 
            db.session.commit()
            
            # 4. Reactivar protección y crear tablas
            db.session.execute(text('SET FOREIGN_KEY_CHECKS = 1'))
            db.session.commit()
            print("✅ Base de datos limpia.")

            print("🏗️   Creando nueva estructura...")
            db.create_all()
            
            # --- POBLANDO DATOS ESTÁTICOS ---
            
            # CLIENTES (IDs 1 a 15)
            print("👥 Creando 15 Clientes...")
            clientes = []
            for i in range(1, 16): 
                dni_num = 10000000 + i 
                c = Cliente(nombre=f"Cliente{i}", apellido="Global", dni=str(dni_num), telefono=f"999888{100+i}")
                clientes.append(c)
            db.session.add_all(clientes)
            
            # MESAS (IDs 1 a 12 - Mayor Variedad)
            print("🪑 Creando 12 Mesas (Mayor capacidad)...")
            mesas = [
                Mesa(numero_mesa=1, capacidad=2, ubicacion='Ventana', tipo_mesa='Regular'),
                Mesa(numero_mesa=2, capacidad=4, ubicacion='Ventana', tipo_mesa='Regular'),
                Mesa(numero_mesa=3, capacidad=4, ubicacion='Centro', tipo_mesa='Regular'),
                Mesa(numero_mesa=4, capacidad=6, ubicacion='Centro', tipo_mesa='Premium'),
                Mesa(numero_mesa=5, capacidad=2, ubicacion='Barra', tipo_mesa='Barra'),
                Mesa(numero_mesa=6, capacidad=2, ubicacion='Barra', tipo_mesa='Barra'),
                Mesa(numero_mesa=7, capacidad=8, ubicacion='Terraza', tipo_mesa='Premium'),
                Mesa(numero_mesa=8, capacidad=4, ubicacion='Terraza', tipo_mesa='Regular'),
                Mesa(numero_mesa=9, capacidad=10, ubicacion='Privado', tipo_mesa='VIP'), 
                Mesa(numero_mesa=10, capacidad=4, ubicacion='Centro', tipo_mesa='Regular'),
                Mesa(numero_mesa=11, capacidad=6, ubicacion='Ventana', tipo_mesa='Premium'),
                Mesa(numero_mesa=12, capacidad=12, ubicacion='Patio', tipo_mesa='Gran Cap.') 
            ]
            db.session.add_all(mesas)
            
            # MENÚ (COMPLETO - PARDO'S CHICKEN)
            print("🍗 Creando Menú Completo de Pardo's Chicken...")
            menu_data = [
                # APERITIVOS (Index 0-3)
                ('Chorizos Cocktail (4)', 12.90, 'Aperitivos', 'Con papas doradas.'), # 0
                ('Anticuchos Cocktail (1)', 13.90, 'Aperitivos', 'Con papas doradas.'), # 1
                ('Tequeños Brasa', 20.50, 'Aperitivos', 'Rellenos de queso, con salsa de la casa.'), # 2
                
                # PIQUES (Index 3-9)
                ('Piqueo Chorizo Cocktail', 17.90, 'Piques', 'Chorizo y papas doradas.'), # 3
                ('Piqueo Brocheta', 17.50, 'Piques', 'Brochetas de pollo y papa dorada.'), # 4
                ('Piqueo Mollejitas', 19.50, 'Piques', 'Mollejitas y papas doradas.'), # 5
                ('Piqueo Anticucho', 19.50, 'Piques', 'Anticucho de corazón y papa dorada.'), # 6
                ('Piqueo Mini Pollitos Pardo', 21.90, 'Piques', 'Trozos de pollo y papa dorada.'), # 7
                ('Piqueo Chicharron de Pollo', 24.90, 'Piques', 'Chicharrón de pollo y salsa honey mustard.'), # 8
                
                # SÁNGUCHES (Index 9-11)
                ('Sánguche Brasa con Papas Fritas', 26.90, 'Sánguches', 'Filete de pierna, ensalada y papas fritas.'), # 9
                ('Sánguche Lomo Saltado con Papas Fritas', 27.90, 'Sánguches', 'Clásico Lomo Saltado en sánguche.'), # 10
                
                # PLATOS DE FONDO (Index 11-14)
                ('Bife a la Parrilla (Deseado o entero)', 62.90, 'Platos', 'Con papa horneada y ensalada.'), # 11
                ('Pechuga a la Parrilla', 58.90, 'Platos', 'Con papa horneada y ensalada.'), # 12
                ('Sopa con Esquína (Preguntar por la sopa)', 25.90, 'Platos', 'Sopa del día con guarnición.'), # 13
                
                # PARRILLAS (Index 14-22)
                ('Brochetas de Pollo', 25.90, 'Parrilla', '2 brochetas de pollo con choclo y papas doradas.'), # 14
                ('Anticuchos de Corazón', 26.90, 'Parrilla', '2 anticuchos de corazón con choclo y papas doradas.'), # 15
                ('Mollejitas a la Parrilla', 26.90, 'Parrilla', 'Mollejitas, choclo y papas doradas.'), # 16
                ('Carretillero', 27.90, 'Parrilla', 'Brocheta de pollo y anticucho.'), # 17
                ('Piqueo Chorizos & Anticuchos', 28.90, 'Parrilla', 'Chorizos y anticuchos.'), # 18
                ('Parrilla para 2 (Aprox)', 98.90, 'Parrilla', '1/2 pollo, Anticucho, Brocheta, Chorizo y guarniciones.'), # 19
                ('Familiar Premium (Aprox)', 184.90, 'Parrilla', 'Pollo entero, 2 Anticuchos, 2 Brochetas, 2 Chorizos, guarniciones.'), # 20
                ('Sabor para 4 (Aprox)', 143.90, 'Parrilla', 'Pollo entero, 1 Anticucho, 1 Brocheta, 1 Chorizo, guarniciones.'), # 21

                # POLLO A LA BRASA (Index 22-29)
                ('Pardos Brasa 1/4', 30.50, 'Pollo a la Brasa', '1/4 de pollo a la brasa original.'), # 22
                ('Pardos Brasa 1/2', 48.50, 'Pollo a la Brasa', '1/2 de pollo a la brasa original.'), # 23
                ('Pardos Brasa Entero', 58.90, 'Pollo a la Brasa', 'Pollo entero a la brasa original.'), # 24
                ('Pardos Parrillero 1/4', 33.90, 'Pollo Parrillero', '1/4 de pollo parrillero.'), # 25
                ('Pardos Parrillero 1/2', 49.50, 'Pollo Parrillero', '1/2 de pollo parrillero.'), # 26
                ('Pardos Parrillero Entero', 60.50, 'Pollo Parrillero', 'Pollo entero parrillero.'), # 27
                ('Pardos Brasa + Ensalada', 40.90, 'Pollo a la Brasa', '1/4 de pollo a la brasa con ensalada.'), # 28
                
                # ESPECIALES DEL PLATO (Index 29-32)
                ('Chicharrón Pollo (fondo)', 34.90, 'Especiales del Plato', 'Con papas fritas, arroz y ensalada criolla.'), # 29
                ('Pollo a la Plancha (fondo)', 31.50, 'Especiales del Plato', 'Con papas fritas, arroz y ensalada fresca.'), # 30
                ('Mollejitas a la Parrilla (fondo)', 32.50, 'Especiales del Plato', 'Con papas fritas, arroz y ensalada fresca.'), # 31

                # ENSALADAS PARA COMPARTIR (Index 32-34)
                ('Criolla', 19.90, 'Ensaladas', 'Cebolla, tomate, zanahoria y palta.'), # 32
                ('Fresca', 19.90, 'Ensaladas', 'Lechuga, tomate, pepinillo, choclo y palta.'), # 33
                
                # ENSALADAS DE FONDO (Index 34-37)
                ('Delicia', 24.90, 'Ensaladas', 'Lechuga, americana, queso fresco, durazno, palta y espinaca.'), # 34
                ('Caesar’s', 24.90, 'Ensaladas', 'Lechuga americana, crutones, queso parmesano y pollo.'), # 35
                ('Sensación', 24.90, 'Ensaladas', 'Lechuga americana, espinaca, palta, pepinillo, chifles y piña.'), # 36

                # GUARNICIONES (Index 37-44)
                ('Papas Fritas', 10.90, 'Guarniciones', 'Porción clásica.'), # 37
                ('Papas Doradas', 16.90, 'Guarniciones', 'Porción dorada.'), # 38
                ('Rijelitas de Camote', 17.90, 'Guarniciones', 'Rijelitas de camote fritas.'), # 39
                ('Arroz de la Casa', 7.50, 'Guarniciones', 'Arroz blanco.'), # 40
                ('Choclo', 9.90, 'Guarniciones', 'Choclo desgranado.'), # 41
                ('Palta', 9.90, 'Guarniciones', 'Porción de palta.'), # 42
                ('Huevo', 3.90, 'Guarniciones', 'Huevo frito.'), # 43
                ('A lo Pobre', 6.90, 'Guarniciones', 'Plátano frito y huevo.'), # 44
                
                # BEBIDAS CHICHA (Index 45-48)
                ('Chicha Vaso', 7.90, 'Bebidas', 'Chicha Morada, vaso.'), # 45
                ('Chicha Vaso Extra Grande', 10.90, 'Bebidas', 'Chicha Morada, vaso extra grande.'), # 46
                ('Chicha Jarra', 22.90, 'Bebidas', 'Chicha Morada, jarra.'), # 47
                
                # BEBIDAS LIMONADA (Index 48-51)
                ('Limonada Vaso', 8.90, 'Bebidas', 'Limonada clásica, vaso.'), # 48
                ('Limonada Vaso Extra Grande', 13.90, 'Bebidas', 'Limonada clásica, vaso extra grande.'), # 49
                ('Limonada Frozen Jarra', 23.90, 'Bebidas', 'Limonada congelada, jarra.'), # 50
                
                # BEBIDAS MARACUMANGO (Index 51-54)
                ('Maracumango Vaso', 11.90, 'Bebidas', 'Maracuyá y mango, vaso.'), # 51
                ('Maracumango Vaso Extra Grande', 15.90, 'Bebidas', 'Maracuyá y mango, vaso extra grande.'), # 52
                ('Maracumango Jarra', 28.90, 'Bebidas', 'Maracuyá y mango, jarra.'), # 53
                
                # BEBIDAS ADICIONALES (Index 54-56)
                ('Gaseosa regular/sin azúcar (500ml)', 7.50, 'Bebidas', 'Coca Cola, Inca Kola.'), # 54
                ('Botella de Agua (S/G)', 7.00, 'Bebidas', 'Agua con o sin gas.'), # 55

                # TRAGOS (Index 56-59)
                ('Pisco Sour Clásico', 18.90, 'Tragos', 'Pisco, limón, jarabe, clara de huevo.'), # 56
                ('Margarita Premium', 30.90, 'Tragos', 'Tequila, triple sec, limón.'), # 57
                ('Vino Tinto/Blanco (Copa)', 16.90, 'Tragos', 'Copa de vino de la casa.'), # 58
                ('Cerveza Pilsen', 12.00, 'Tragos', 'Botella de cerveza Pilsen (330ml).'), # 59

                # POSTRES (Index 60-63)
                ('Postre Suspiro Limeño', 15.90, 'Postres', 'Postre tradicional.'), # 60
                ('Macarromán Pardo', 8.90, 'Postres', 'Postre con manjar blanco.'), # 61
                ('1 Bola de Helado', 8.90, 'Postres', 'Bola de helado de vainilla, fresa o chocolate.'), # 62
                ('Torta de Chocolate', 16.90, 'Postres', 'Porción de torta de chocolate.'), # 63
            ]

            menus = [Menu(nombre=n, precio=p, categoria=cat, descripcion=desc) 
                     for n, p, cat, desc in menu_data]
            db.session.add_all(menus)
            db.session.commit() # Guardar para obtener los IDs de los objetos!
            
            # Reutilizando el menú para simplificar la adaptación
            def get_menu_item(index): return menus[index]

            # Definir fechas históricas (4 meses)
            hoy = date.today()
            hace_1_mes = hoy - timedelta(days=random.randint(28, 32)) 
            hace_2_meses = hoy - timedelta(days=random.randint(58, 62))
            hace_3_meses = hoy - timedelta(days=random.randint(88, 92))
            
            # Helper para obtener DNI y Cliente ID
            def get_dni(index): return clientes[index-1].dni
            def get_cliente_id(index): return clientes[index-1].id_cliente

            # --- POBLANDO DATA TRANSACCIONAL HISTÓRICA (4 MESES) ---
            print("💰 Creando 20 Ventas Pagadas (10 Reserva, 10 Mozo) adaptadas al nuevo menú...")
            
            # Índices de algunos platos clave en el nuevo menú:
            P_1_4 = get_menu_item(22) # Pardos Brasa 1/4 (Index 22)
            P_ENTERO = get_menu_item(24) # Pardos Brasa Entero (Index 24)
            A_ANTICUCHOS = get_menu_item(6) # Piqueo Anticucho (Index 6)
            A_CHORIZOS = get_menu_item(0) # Chorizos Cocktail (Index 0)
            PARR_P2 = get_menu_item(19) # Parrilla para 2 (Index 19)
            ENSALADA_FRESCA = get_menu_item(33) # Ensalada Fresca (Index 33)
            G_PAPAS_FRITAS = get_menu_item(37) # Papas Fritas (Index 37)
            B_CHICHA_JARRA = get_menu_item(47) # Chicha Jarra (Index 47)
            B_PILSEN = get_menu_item(59) # Cerveza Pilsen (Index 59)
            POST_SUSPIRO = get_menu_item(60) # Suspiro Limeño (Index 60)
            
            # === MES 1 (Hace 3 Meses) ===
            # Venta 1 (Reserva - Parrilla, Mesa 9)
            create_paid_transaction(get_cliente_id(1), mesas[8].id_mesa, [(PARR_P2, 1), (G_PAPAS_FRITAS, 1), (B_PILSEN, 4)], 
                                    hace_3_meses + timedelta(days=5), "20:00", get_dni(1), is_reservation=True)
            # Venta 2 (Mozo - Pollo, Mesa 2)
            create_paid_transaction(get_cliente_id(2), mesas[1].id_mesa, [(P_1_4, 2), (A_CHORIZOS, 1), (B_CHICHA_JARRA, 1)], 
                                    hace_3_meses + timedelta(days=15), "13:30", get_dni(2), is_reservation=False)
            # Venta 3 (Mozo - Anticuchos, Mesa 3)
            create_paid_transaction(get_cliente_id(15), mesas[2].id_mesa, [(A_ANTICUCHOS, 2), (G_PAPAS_FRITAS, 1)], 
                                    hace_3_meses + timedelta(days=25), "20:30", get_dni(15), is_reservation=False)
            # Venta 4 (Reserva - Gran Fiesta, Mesa 12)
            create_paid_transaction(get_cliente_id(3), mesas[11].id_mesa, [(P_ENTERO, 1), (P_1_4, 1), (B_CHICHA_JARRA, 2), (POST_SUSPIRO, 3)], 
                                    hace_3_meses + timedelta(days=10), "19:00", get_dni(3), is_reservation=True)
            # Venta 5 (Mozo - Ligero, Mesa 5)
            create_paid_transaction(get_cliente_id(4), mesas[4].id_mesa, [(ENSALADA_FRESCA, 1), (P_1_4, 1)], 
                                    hace_3_meses + timedelta(days=18), "14:00", get_dni(4), is_reservation=False)

            
            # === MES 2 (Hace 2 Meses) ===
            # Venta 6 (Reserva - Familiar, Mesa 7)
            create_paid_transaction(get_cliente_id(5), mesas[6].id_mesa, [(P_ENTERO, 1), (ENSALADA_FRESCA, 1)], 
                                    hace_2_meses + timedelta(days=5), "20:30", get_dni(5), is_reservation=True)
            # Venta 7 (Mozo - Pollo solo, Mesa 1)
            create_paid_transaction(get_cliente_id(6), mesas[0].id_mesa, [(P_1_4, 1), (G_PAPAS_FRITAS, 1)], 
                                    hace_2_meses + timedelta(days=12), "14:00", get_dni(6), is_reservation=False)
            # Venta 8 (Mozo - Postre, Mesa 6)
            create_paid_transaction(get_cliente_id(7), mesas[5].id_mesa, [(POST_SUSPIRO, 2), (B_PILSEN, 1)], 
                                    hace_2_meses + timedelta(days=20), "12:15", get_dni(7), is_reservation=False)
            # Venta 9 (Reserva - Parrilla, Mesa 8)
            create_paid_transaction(get_cliente_id(8), mesas[7].id_mesa, [(PARR_P2, 1), (B_CHICHA_JARRA, 1)], 
                                    hace_2_meses + timedelta(days=28), "19:30", get_dni(8), is_reservation=True)
            # Venta 10 (Mozo - Piqueo, Mesa 10)
            create_paid_transaction(get_cliente_id(9), mesas[9].id_mesa, [(A_ANTICUCHOS, 1), (G_PAPAS_FRITAS, 1), (B_PILSEN, 1)], 
                                    hace_2_meses + timedelta(days=10), "15:00", get_dni(9), is_reservation=False)

            
            # === MES 3 (Hace 1 Mes) ===
            # Venta 11 (Reserva - Pollo Entero, Mesa 4)
            create_paid_transaction(get_cliente_id(10), mesas[3].id_mesa, [(P_ENTERO, 1), (G_PAPAS_FRITAS, 2), (POST_SUSPIRO, 2)], 
                                    hace_1_mes + timedelta(days=3), "19:45", get_dni(10), is_reservation=True)
            # Venta 12 (Reserva - 1/2 Pollo, Mesa 11)
            create_paid_transaction(get_cliente_id(11), mesas[10].id_mesa, [(get_menu_item(23), 1), (B_CHICHA_JARRA, 1)], 
                                    hace_1_mes + timedelta(days=10), "13:00", get_dni(11), is_reservation=True)
            # Venta 13 (Mozo - Brochetas, Mesa 5)
            create_paid_transaction(get_cliente_id(12), mesas[4].id_mesa, [(get_menu_item(14), 2), (G_PAPAS_FRITAS, 1)], 
                                    hace_1_mes + timedelta(days=15), "18:00", get_dni(12), is_reservation=False)
            # Venta 14 (Mozo - Alitas, Mesa 1)
            create_paid_transaction(get_cliente_id(13), mesas[0].id_mesa, [(get_menu_item(8), 1), (B_CHICHA_JARRA, 2)], 
                                    hace_1_mes + timedelta(days=25), "15:30", get_dni(13), is_reservation=False)
            # Venta 15 (Reserva - Parrilla, Mesa 9)
            create_paid_transaction(get_cliente_id(1), mesas[8].id_mesa, [(PARR_P2, 1), (B_PILSEN, 2), (POST_SUSPIRO, 1)], 
                                    hace_1_mes + timedelta(days=18), "21:00", get_dni(1), is_reservation=True)

            
            # === MES 4 (HOY) ===
            # Venta 16 (Reserva - Pollo y Papas, Mesa 1)
            create_paid_transaction(get_cliente_id(14), mesas[0].id_mesa, [(P_1_4, 2), (G_PAPAS_FRITAS, 2), (POST_SUSPIRO, 1)], 
                                    hoy, "12:30", get_dni(14), is_reservation=True)
            # Venta 17 (Reserva - Parrilla, Mesa 3)
            create_paid_transaction(get_cliente_id(15), mesas[2].id_mesa, [(PARR_P2, 1), (B_PILSEN, 2)], 
                                    hoy, "14:00", get_dni(15), is_reservation=True)
            # Venta 18 (Reserva - Familia Grande, Mesa 12)
            create_paid_transaction(get_cliente_id(2), mesas[11].id_mesa, [(P_ENTERO, 1), (G_PAPAS_FRITAS, 3), (B_CHICHA_JARRA, 3)], 
                                    hoy, "19:15", get_dni(2), is_reservation=True)
            # Venta 19 (Mozo - Soltero, Mesa 5)
            create_paid_transaction(get_cliente_id(4), mesas[4].id_mesa, [(P_1_4, 1), (get_menu_item(49), 1)], # Limonada XG
                                    hoy, "11:30", get_dni(4), is_reservation=False)
            # Venta 20 (Mozo - Cena ligera, Mesa 6)
            create_paid_transaction(get_cliente_id(5), mesas[5].id_mesa, [(A_CHORIZOS, 1), (ENSALADA_FRESCA, 1)], 
                                    hoy, "16:00", get_dni(5), is_reservation=False)
            
            
            # --- DATA PENDIENTE (Activa para simular operación) ---
            print("⏸️ Creando Data Pendiente (Reserva y Comanda)...")

            # RESERVA PENDIENTE HOY (Mesa 9 - La VIP)
            r_pend = Reserva(fecha_reserva=hoy, hora_reserva=datetime.strptime("20:30", "%H:%M").time(), 
                             cantidad_personas=7, estado='pendiente', id_mesa=mesas[8].id_mesa, id_cliente=clientes[6].id_cliente)
            db.session.add(r_pend)
            
            # COMANDA PENDIENTE (Mesa Directa, Mesa 10)
            c_pend = Comanda(id_mesa=mesas[9].id_mesa, estado='pendiente', nombre_cliente="Cliente en Espera (Mesa 10)", fecha_creacion=datetime.now())
            db.session.add(c_pend)
            db.session.flush()
            
            # DETALLES PENDIENTES
            d_pend1 = DetalleComanda(id_comanda=c_pend.id_comanda, id_menu=P_ENTERO.id_menu, cantidad=1, observaciones="Sin alas")
            d_pend2 = DetalleComanda(id_comanda=c_pend.id_comanda, id_menu=B_CHICHA_JARRA.id_menu, cantidad=1, observaciones="Con hielo")
            db.session.add_all([d_pend1, d_pend2])
            
            db.session.commit()
            print("✨ ¡EXITO! BASE DE DATOS POBLADA CON MENÚ PARDO'S CHICKEN. ✨")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Ocurrió un error al poblar la BD: {e}")
            if hasattr(e, 'orig') and hasattr(e.orig, 'args'):
                print(f"DEBUG DB: {e.orig.args}")

if __name__ == '__main__':
    seed_complete_database()