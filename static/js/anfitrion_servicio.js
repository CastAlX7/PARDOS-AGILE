// =============================================================================
// MÓDULO: ANFITRION DE SERVICIO (MOZO)
// Responsabilidad: Tomar pedidos y gestionar comandas.
// =============================================================================

// ==================== HUO09: TOMAR PEDIDO - VISTA PRINCIPAL ====================

/**
 * Función Asíncrona: renderTomarPedido
 * Propósito: Renderiza la vista principal del mapa de mesas.
 * Lógica:
 * 1. Carga datos en paralelo (Mesas, Comandas, Reservas).
 * 2. Calcula el estado de cada mesa basado en la hora actual y reglas de negocio.
 * 3. Genera el HTML dinámico de la grilla de mesas.
 */
async function renderTomarPedido() {
    setPageTitle('Tomar Pedido - Seleccione Mesa', 'fa-utensils');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        // SOLICITUD ASÍNCRONA PARALELA:
        // Usamos Promise.all para esperar a que las 3 peticiones terminen antes de continuar.
        // Esto optimiza el tiempo de carga.
        const [mesas, comandas, reservas] = await Promise.all([
            fetchAPI('/mesas'),
            fetchAPI('/comandas'),
            fetchAPI('/reservas')
        ]);
        
        // Filtrado: Obtenemos solo las comandas que están activas (no pagadas)
        // Esto sirve para saber qué mesas tienen gente comiendo ahora mismo.
        const comandasActivas = comandas.filter(c => c.estado !== 'pagada');
        
        // Configuración de Fecha y Hora Local:
        // Necesario para comparar con las reservas del día.
        const ahora = new Date();
        const year = ahora.getFullYear();
        const month = String(ahora.getMonth() + 1).padStart(2, '0');
        const day = String(ahora.getDate()).padStart(2, '0');
        const hoyLocal = `${year}-${month}-${day}`;
        
        // Cálculo de minutos actuales (0 - 1439) para comparaciones matemáticas simples.
        const minutosActuales = (ahora.getHours() * 60) + ahora.getMinutes();

        // Renderizado del HTML contenedor
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-chair"></i> Mapa de Mesas</h3>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <span class="badge badge-confirmada">${mesas.length} mesas</span>
                        <span class="badge badge-pendiente">${comandasActivas.length} ocupadas</span>
                    </div>
                </div>
                
                <div style="padding: 15px 25px; display: flex; gap: 20px; background: #f8f9fa; border-radius: 8px; margin: 0 25px 20px; border: 1px solid #eee; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 20px; height: 20px; background: #28a745; border-radius: 4px;"></div>
                        <span style="font-size: 0.9em; color: #555;"><strong>Libre</strong> (Disponible)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 20px; height: 20px; background: #FFC107; border-radius: 4px;"></div>
                        <span style="font-size: 0.9em; color: #555;"><strong>Ocupada</strong> (Comiendo)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 20px; height: 20px; background: #fd7e14; border-radius: 4px;"></div>
                        <span style="font-size: 0.9em; color: #555;"><strong>Reservada</strong> (Prep. 1h antes)</span>
                    </div>
                </div>
                
                <div class="mesas-grid" style="padding: 0 25px 25px;">
                    ${mesas.map(m => {
                        // LÓGICA DE ESTADOS DE MESA:
                        
                        // PRIORIDAD 1: OCUPADA
                        // Si hay una comanda activa en esta mesa, está ocupada (Amarillo).
                        const comandaMesa = comandasActivas.find(c => c.id_mesa === m.id);
                        const ocupada = !!comandaMesa;
                        
                        // PRIORIDAD 2: RESERVADA PRÓXIMAMENTE
                        // Solo calculamos si NO está ocupada comiendo.
                        let reservadaProxima = null;
                        
                        if (!ocupada) {
                            reservadaProxima = reservas.find(r => {
                                // Validaciones básicas: mesa correcta, fecha de hoy, estado válido.
                                if (r.id_mesa !== m.id || r.fecha !== hoyLocal || !['confirmada', 'pendiente'].includes(r.estado)) return false;
                                
                                // Convertir hora reserva a minutos para comparar
                                const [h, min] = r.hora.split(':').map(Number);
                                const minutosReserva = (h * 60) + min;
                                
                                // Diferencia: Minutos que faltan para la reserva
                                const diff = minutosReserva - minutosActuales;
                                
                                // REGLA DE TIEMPO:
                                // TRUE si faltan 60 min o menos, O si ya pasó la hora hace menos de 2 horas.
                                return diff <= 60 && diff > -120; 
                            });
                        }
                        
                        // 3. Determinar variables visuales (Color, Icono, Texto) según estado
                        let color = '#28a745'; // Verde (Default: Libre)
                        let bgColor = '#e6f9e9';
                        let estadoKey = 'libre';
                        let infoExtra = 'Disponible';
                        let reservaStr = 'null';
                        let icon = 'fa-check';
                        
                        if (ocupada) {
                            // CASO: MESA OCUPADA
                            color = '#FFC107'; 
                            bgColor = '#fff9db';
                            estadoKey = 'ocupada';
                            icon = 'fa-utensils';
                            // Diferenciar si es cliente de paso o reserva atendida
                            if (comandaMesa.id_reserva) {
                                infoExtra = '<span style="color:#17a2b8; font-weight:bold;">Atendiendo Reserva</span>';
                            } else {
                                infoExtra = 'Pedido Mozo';
                            }
                        } else if (reservadaProxima) {
                            // CASO: MESA RESERVADA (Bloqueo preventivo)
                            color = '#fd7e14'; 
                            bgColor = '#fff3e0';
                            estadoKey = 'reservada';
                            icon = 'fa-clock';
                            infoExtra = `Reserva ${reservadaProxima.hora}`;
                            // Serializamos el objeto reserva para pasarlo al onclick
                            reservaStr = JSON.stringify(reservadaProxima).replace(/"/g, '&quot;');
                        }
                        
                        // Retorno del HTML de la tarjeta de mesa
                        return `
                            <div class="mesa-card" 
                                 style="border-top: 5px solid ${color}; background: ${bgColor}; cursor: pointer; transition: transform 0.2s;"
                                 onmouseover="this.style.transform='translateY(-3px)'"
                                 onmouseout="this.style.transform='translateY(0)'"
                                 onclick="gestionarClickMesa(${m.id}, ${m.numero}, '${estadoKey}', ${reservaStr})"
                                 title="${estadoKey.toUpperCase()}">
                                
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    <div class="mesa-numero" style="color: ${color};">${m.numero}</div>
                                    <i class="fas ${icon}" style="font-size: 1.5em; color: ${color}; opacity: 0.5;"></i>
                                </div>
                                
                                <div class="mesa-info">
                                    <span class="badge" style="background: ${color}; color: white;">${m.tipo}</span>
                                    <div style="margin-top: 8px; font-size: 0.85em; color: #666;">
                                        <i class="fas fa-users"></i> ${m.capacidad} pers.
                                    </div>
                                </div>
                                
                                <div style="margin-top: 15px; background: rgba(255,255,255,0.8); padding: 5px; border-radius: 4px; text-align: center; font-weight: bold; color: ${color}; border: 1px solid ${color}; font-size: 0.9em;">
                                    ${infoExtra}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>`;
    } catch (e) {
        // Manejo de error en la carga asíncrona
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">❌ Error al cargar mesas</div>';
    }
}

/**
 * Función: gestionarClickMesa
 * Propósito: Router de acciones. Decide qué función ejecutar dependiendo del estado de la mesa clickeada.
 * @param {number} mesaId - ID de la mesa en BD
 * @param {number} mesaNum - Número visible de la mesa
 * @param {string} estado - 'ocupada', 'reservada' o 'libre'
 * @param {object|null} reservaData - Datos de la reserva si el estado es 'reservada'
 */
function gestionarClickMesa(mesaId, mesaNum, estado, reservaData) {
    if (estado === 'ocupada') {
        // Si está ocupada -> Ver detalles del pedido actual
        verPedidosDeMesaMozoMejorado(mesaId, mesaNum);
    } else if (estado === 'reservada') {
        // Si está reservada -> Mostrar alerta preventiva
        mostrarAlertaReserva(mesaNum, reservaData, mesaId);
    } else {
        // Si está libre -> Iniciar flujo de tomar pedido
        tomarPedidoMesaDirecto(mesaId, mesaNum);
    }
}

/**
 * Función: mostrarAlertaReserva
 * Propósito: Muestra un modal de advertencia cuando se intenta usar una mesa reservada próximamente.
 * Nota: Incluye un botón "Forzar Uso" para casos de emergencia.
 */
function mostrarAlertaReserva(mesaNum, reserva, mesaId) {
    const bodyHtml = `
        <div style="text-align: center; padding: 20px;">
            <i class="fas fa-hand-sparkles" style="font-size: 4em; color: #fd7e14; margin-bottom: 15px;"></i>
            <h3 style="color: #fd7e14;">Mesa ${mesaNum} Reservada</h3>
            <p style="color: #666; font-size: 1.1em;">Preparación para reserva a las <strong>${reserva.hora}</strong>.</p>
            
            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: left; border-left: 5px solid #fd7e14;">
                <p style="margin: 5px 0;"><strong>Cliente:</strong> ${reserva.cliente.nombre || reserva.cliente}</p>
                <p style="margin: 5px 0;"><strong>Hora:</strong> ${reserva.hora}</p>
                <p style="margin: 5px 0;"><strong>Personas:</strong> ${reserva.cantidad}</p>
            </div>
            
            <div style="margin-top: 20px; padding: 10px; background: #e3f2fd; border-radius: 8px; color: #0d47a1; font-size: 0.9em;">
                <i class="fas fa-info-circle"></i> <strong>Nota:</strong> Si este es el cliente de la reserva, vaya a "Modificar Pedidos de Reservas".
            </div>
        </div>`;
    
    // Botones del modal
    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        <button class="btn btn-warning btn-sm" onclick="tomarPedidoMesaDirecto(${mesaId}, ${mesaNum}); closeModal();" title="Usar mesa para otro cliente">Forzar Uso</button>
    `;
    
    openModal(`⚠️ Mesa ${mesaNum}`, bodyHtml, footerHtml);
}

// ==================== TOMA DE PEDIDO (WALK-IN) ====================

/**
 * Función Asíncrona: tomarPedidoMesaDirecto
 * Propósito: Renderiza la interfaz de toma de pedidos (Menú + Carrito).
 * Inicializa variables globales MENU_DATA y CART.
 */
async function tomarPedidoMesaDirecto(mesaId, mesaNum) {
    setPageTitle(`Nuevo Pedido - Mesa ${mesaNum}`, 'fa-utensils');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        // Carga asíncrona del menú completo
        const menuData = await fetchAPI('/menu');
        
        // Inicialización de variables globales para el contexto del pedido
        MENU_DATA = menuData;
        CART = [];
        const categorias = Object.keys(menuData);
        
        // Renderizado de la UI de pedido
        content.innerHTML = `
            <div class="order-layout">
                <div>
                    <div class="card" style="border-top: 4px solid var(--success);">
                        <div class="card-header"><h3><i class="fas fa-user-edit"></i> Datos del Pedido</h3></div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Cliente (Opcional)</label>
                                <input type="text" id="pedido-nombre-directo" placeholder="Nombre del cliente">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Observaciones</label>
                            <textarea id="pedido-obs-directo" rows="2" placeholder="Ej: Sin sal, término medio..."></textarea>
                        </div>
                        <input type="hidden" id="mesa-id-directo" value="${mesaId}">
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-book-open"></i> Menú</h3></div>
                        <div style="padding: 0 20px 15px;">
                            <input type="text" id="search-menu-directo" 
                                placeholder="🔍 Buscar platos..." 
                                style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px;"
                                oninput="cambiarCategoriaDirecto(document.querySelector('.category-btn.active')?.textContent || '${categorias[0]}')">
                        </div>
                        <div class="menu-categories">
                            ${categorias.map((c, i) => `<button class="category-btn ${i===0?'active':''}" onclick="cambiarCategoriaDirecto('${c}')">${c}</button>`).join('')}
                        </div>
                        <div class="menu-items" id="menu-items-directo"></div>
                    </div>
                </div>
                
                <div class="cart-panel">
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-shopping-cart"></i> Pedido Actual</h3><span class="badge badge-pendiente" id="cart-count-directo">0</span></div>
                        <div class="cart-items" id="cart-items-directo">
                            <p class="text-center" style="padding: 30px; color: #999;">Seleccione platos del menú</p>
                        </div>
                        <div class="cart-total" id="cart-total-directo" style="display:none;">
                            <div class="cart-total-row"><span>TOTAL</span><span id="total-amount-directo">S/ 0.00</span></div>
                        </div>
                        <button class="btn btn-success btn-block mt-3" onclick="enviarPedidoDirecto()" id="btn-enviar-directo" style="display:none;">
                            <i class="fas fa-paper-plane"></i> Enviar a Cocina
                        </button>
                        <button class="btn btn-secondary btn-block mt-3" onclick="renderTomarPedido()">
                            <i class="fas fa-arrow-left"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>`;
        
        // Cargar la primera categoría por defecto
        if(categorias.length > 0) cambiarCategoriaDirecto(categorias[0]);
        
    } catch (e) {
        content.innerHTML = '<div class="card text-center">Error al cargar menú</div>';
    }
}

// ==================== FUNCIONES AUXILIARES (CARRITO Y MENÚ) ====================

/**
 * Función: cambiarCategoriaDirecto
 * Propósito: Filtra y muestra los items del menú según categoría y búsqueda.
 */
function cambiarCategoriaDirecto(cat) {
    document.querySelectorAll('.category-btn').forEach(b => b.classList.toggle('active', b.textContent === cat));
    const items = MENU_DATA[cat] || [];
    const term = document.getElementById('search-menu-directo').value.toLowerCase();
    const filtrados = items.filter(i => i.nombre.toLowerCase().includes(term));
    const c = document.getElementById('menu-items-directo');
    if(!c) return;
    c.innerHTML = filtrados.map(i => `
        <div class="menu-item" onclick="agregarAlCarritoDirecto(${i.id}, '${i.nombre}', ${i.precio})">
            <div class="item-name">${i.nombre}</div><div class="item-price">S/ ${i.precio.toFixed(2)}</div>
        </div>`).join('');
}

/**
 * Función: agregarAlCarritoDirecto
 * Propósito: Añade un item al array CART global.
 */
function agregarAlCarritoDirecto(id, nombre, precio) {
    const ex = CART.find(i => i.id_menu === id);
    if(ex) ex.cantidad++; else CART.push({id_menu: id, nombre, precio, cantidad: 1, observaciones: ''});
    actualizarCarritoDirecto();
    showToast(`${nombre} agregado`, 'success');
}

/**
 * Función: actualizarCarritoDirecto
 * Propósito: Refresca el DOM del carrito, totales y visibilidad de botones.
 */
function actualizarCarritoDirecto() {
    const c = document.getElementById('cart-items-directo');
    const count = document.getElementById('cart-count-directo');
    const totalDiv = document.getElementById('cart-total-directo');
    const totalEl = document.getElementById('total-amount-directo');
    const btn = document.getElementById('btn-enviar-directo');
    
    if(!c) return;
    
    if(CART.length === 0) {
        c.innerHTML = '<p class="text-center" style="padding:30px;color:#999;">Vacío</p>';
        totalDiv.style.display = 'none';
        btn.style.display = 'none';
        count.textContent = '0';
        return;
    }
    
    const total = CART.reduce((s, i) => s + i.precio * i.cantidad, 0);
    c.innerHTML = CART.map((i, x) => `
        <div class="cart-item">
            <div>${i.nombre}<br><small>S/ ${i.precio.toFixed(2)}</small></div>
            <div>
                <button class="qty-btn-minus" onclick="cambiarCantidadDirecto(${x}, -1)">-</button>
                <span class="cart-item-qty">${i.cantidad}</span>
                <button class="qty-btn-plus" onclick="cambiarCantidadDirecto(${x}, 1)">+</button>
            </div>
        </div>`).join('');
        
    count.textContent = CART.length;
    totalEl.textContent = `S/ ${total.toFixed(2)}`;
    totalDiv.style.display = 'block';
    btn.style.display = 'block';
}

/**
 * Función: cambiarCantidadDirecto
 * Propósito: Modifica la cantidad de un item en el array CART. Si es 0, lo elimina.
 */
function cambiarCantidadDirecto(x, d) {
    CART[x].cantidad += d;
    if(CART[x].cantidad <= 0) CART.splice(x, 1);
    actualizarCarritoDirecto();
}

/**
 * Función Asíncrona: enviarPedidoDirecto
 * Propósito: Envía la comanda creada al servidor (POST /comandas).
 */
async function enviarPedidoDirecto() {
    const mesa = document.getElementById('mesa-id-directo').value;
    const nombre = document.getElementById('pedido-nombre-directo').value;
    const obs = document.getElementById('pedido-obs-directo').value;
    
    if(CART.length === 0) return showToast('Agregue items', 'error');
    
    const data = { id_mesa: mesa, nombre_cliente: nombre, observaciones: obs, items: CART };
    
    showConfirm('Enviar', '¿Enviar a cocina?', async () => {
        try {
            await fetchAPI('/comandas', { method: 'POST', body: JSON.stringify(data) });
            showToast('✅ Enviado', 'success');
            setTimeout(() => renderTomarPedido(), 1000);
        } catch(e) { showToast('Error', 'error'); }
    }, 'fa-paper-plane', 'var(--success)');
}

// ==================== HUO10: MODIFICAR COMANDAS ====================

// 1. Modificar comandas de MESA (creadas por mozo)

/**
 * Función Asíncrona: renderModificarComanda
 * Propósito: Lista las comandas pendientes de tipo 'Walk-in' (sin reserva).
 */
async function renderModificarComanda() {
    setPageTitle('Modificar Comanda (Mesa)', 'fa-edit');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas?estado=pendiente');
        // Filtrar: Solo las que NO tienen id_reserva (son walk-ins)
        const mesasDirectas = comandas.filter(c => !c.id_reserva);
        
        if (mesasDirectas.length === 0) {
            content.innerHTML = `
                <div class="card text-center" style="padding: 60px;">
                    <i class="fas fa-check-circle" style="font-size: 4em; color: var(--success);"></i>
                    <h3 style="margin-top: 20px;">No hay comandas de mesa pendientes</h3>
                    <button class="btn btn-secondary mt-3" onclick="renderTomarPedido()">Volver al Tomar un pedido</button>
                </div>`;
            return;
        }
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-list"></i> Comandas de Mesa (Walk-in)</h3></div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>ID</th><th>Mesa</th><th>Cliente</th><th>Total</th><th>Acciones</th></tr></thead>
                        <tbody>
                            ${mesasDirectas.map(c => `
                                <tr>
                                    <td><strong>#${c.id}</strong></td>
                                    <td><span class="badge badge-confirmada">Mesa ${c.mesa}</span></td>
                                    <td>${c.nombre_cliente || 'Cliente Mesa'}</td>
                                    <td><strong>S/ ${c.total.toFixed(2)}</strong></td>
                                    <td>
                                        <button class="btn btn-info btn-sm" onclick="editarComanda(${c.id}, 'mesa')"><i class="fas fa-edit"></i> Editar</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = 'Error al cargar comandas';
    }
}

// 2. Modificar pedidos de RESERVAS (creados por Anfitriona)

/**
 * Función Asíncrona: renderModificarPedidosReservas
 * Propósito: Lista las comandas pendientes vinculadas a una reserva.
 */
async function renderModificarPedidosReservas() {
    setPageTitle('Modificar Pedidos de Reserva', 'fa-calendar-check');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas?estado=pendiente');
        // Filtrar: Solo las que TIENEN id_reserva
        const reservasConPedido = comandas.filter(c => c.id_reserva);
        
        if (reservasConPedido.length === 0) {
            content.innerHTML = `
                <div class="card text-center" style="padding: 60px;">
                    <i class="fas fa-info-circle" style="font-size: 4em; color: var(--info);"></i>
                    <h3 style="margin-top: 20px;">No hay pedidos de reserva pendientes</h3>
                    <p>Las reservas nuevas aparecen aquí cuando la anfitriona crea el pedido.</p>
                    <button class="btn btn-secondary mt-3" onclick="renderTomarPedido()">Volver al Mapa</button>
                </div>`;
            return;
        }
        
        content.innerHTML = `
            <div class="card" style="border-top: 4px solid var(--info);">
                <div class="card-header"><h3><i class="fas fa-calendar-alt"></i> Pedidos de Reservas</h3></div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Pedido</th><th>Reserva</th><th>Mesa</th><th>Cliente</th><th>Total</th><th>Acciones</th></tr></thead>
                        <tbody>
                            ${reservasConPedido.map(c => `
                                <tr>
                                    <td><strong>#${c.id}</strong></td>
                                    <td><span class="badge badge-info">R-${c.id_reserva}</span></td>
                                    <td>Mesa ${c.mesa}</td>
                                    <td>${c.nombre_cliente || '-'}</td>
                                    <td><strong>S/ ${c.total.toFixed(2)}</strong></td>
                                    <td>
                                        <button class="btn btn-info btn-sm" onclick="editarComanda(${c.id}, 'reserva')"><i class="fas fa-edit"></i> Editar</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = 'Error al cargar pedidos';
    }
}

// ==================== FUNCIONES DE EDICIÓN (MODAL ESTILIZADO) ====================

/**
 * Función Asíncrona: editarComanda
 * Propósito: Abre un modal para editar una comanda existente.
 * Lógica: Recupera la comanda y el menú, llena el carrito (CART) y muestra el modal.
 */
async function editarComanda(id, tipoOrigen) {
    try {
        // Carga paralela de datos necesarios
        const [comanda, menuData] = await Promise.all([fetchAPI(`/comandas/${id}`), fetchAPI('/menu')]);
        
        MENU_DATA = menuData;
        // Reconstruimos el carrito local con los datos de la BD
        CART = comanda.items.map(i => ({ id_menu: i.id_menu, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, observaciones: i.observaciones }));
        const cats = Object.keys(menuData);
        
        const bodyHtml = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <h4 style="color: var(--primary); margin-bottom: 10px;"><i class="fas fa-shopping-cart"></i> Items Actuales</h4>
                <div id="modal-cart"></div>
                
                <hr style="margin: 20px 0;">
                
                <h4 style="color: var(--primary); margin-bottom: 10px;"><i class="fas fa-plus-circle"></i> Agregar Productos</h4>
                <div class="menu-categories">
                    ${cats.map((c, i) => `<button class="category-btn ${i===0?'active':''}" onclick="cambiarCategoriaModal('${c}')">${c}</button>`).join('')}
                </div>
                <div class="menu-items" id="modal-menu" style="margin-top: 15px;"></div>
            </div>`;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancelar</button>
            <button class="btn btn-success" onclick="guardarCambiosComanda(${id}, '${tipoOrigen}')"><i class="fas fa-save"></i> Guardar Cambios</button>`;

        openModal(`Editar Pedido #${id}`, bodyHtml, footerHtml);
        
        actualizarModal();
        if(cats.length) cambiarCategoriaModal(cats[0]);
    } catch(e) {
        showToast('Error al cargar comanda', 'error');
    }
}

/**
 * Función: actualizarModal
 * Propósito: Refresca la lista de items dentro del modal de edición.
 */
function actualizarModal() {
    const c = document.getElementById('modal-cart');
    if(c) c.innerHTML = CART.map((i,x)=>`
        <div class="cart-item" style="margin-bottom: 8px;">
            <div><strong>${i.cantidad}x</strong> ${i.nombre}</div>
            <div style="display:flex; gap:5px;">
                <button class="btn btn-sm" onclick="CART[${x}].cantidad--; if(CART[${x}].cantidad<=0) CART.splice(${x},1); actualizarModal()">-</button>
                <button class="btn btn-sm" onclick="CART[${x}].cantidad++; actualizarModal()">+</button>
                <button class="btn btn-danger btn-sm" onclick="CART.splice(${x},1);actualizarModal()"><i class="fas fa-times"></i></button>
            </div>
        </div>`).join('');
}

/**
 * Función: cambiarCategoriaModal
 * Propósito: Cambia la categoría de productos mostrada en el modal de edición.
 */
function cambiarCategoriaModal(cat) {
    document.querySelectorAll('#modal-menu .category-btn').forEach(b => b.classList.toggle('active', b.textContent === cat));
    const c = document.getElementById('modal-menu');
    if(c) c.innerHTML = (MENU_DATA[cat]||[]).map(i=>`
        <div class="menu-item" onclick="CART.push({id_menu:${i.id}, nombre:'${i.nombre}', precio:${i.precio}, cantidad:1, observaciones:''});actualizarModal()">
            <div class="item-name">${i.nombre}</div>
            <div class="item-price">S/ ${i.precio.toFixed(2)}</div>
        </div>`).join('');
}

/**
 * Función Asíncrona: guardarCambiosComanda
 * Propósito: Envía los cambios de la comanda editada al servidor (PUT).
 */
async function guardarCambiosComanda(id, tipo) {
    if(CART.length===0) return showToast('El pedido no puede estar vacío', 'error');
    try {
        await fetchAPI(`/comandas/${id}`, { method: 'PUT', body: JSON.stringify({ items: CART }) });
        showToast('✅ Pedido actualizado', 'success');
        closeModal();
        if(tipo === 'reserva') renderModificarPedidosReservas(); else renderModificarComanda();
    } catch(e) { showToast('Error al guardar', 'error'); }
}

// ==================== DETALLE DE MESA OCUPADA ====================

/**
 * Función Asíncrona: verPedidosDeMesaMozoMejorado
 * Propósito: Muestra un modal informativo con los pedidos activos de una mesa ocupada.
 */
async function verPedidosDeMesaMozoMejorado(mesaId, mesaNum) {
    try {
        const comandas = await fetchAPI('/comandas');
        const m = comandas.filter(c => c.id_mesa === mesaId && c.estado !== 'pagada');
        
        const bodyHtml = `
            <div style="padding:10px;">
                <h3 style="text-align:center; color: var(--primary);">Mesa ${mesaNum}</h3>
                ${m.map(c => `
                    <div style="background:#f8f9fa; padding:15px; margin-bottom:15px; border-radius:8px; border-left: 4px solid ${c.estado==='completada'?'#28a745':'#ffc107'};">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>Pedido #${c.id}</strong>
                            <span class="badge badge-${c.estado}">${c.estado.toUpperCase()}</span>
                        </div>
                        <p style="margin: 5px 0;">Total: <strong>S/ ${c.total.toFixed(2)}</strong></p>
                        <div style="margin-top:10px; border-top:1px dashed #ddd; padding-top:5px;">
                            ${c.items.map(i => `<small style="display:block;">• ${i.cantidad}x ${i.nombre}</small>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>`;
            
        openModal('Detalles de Mesa', bodyHtml, '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>');
    } catch(e) {}
}