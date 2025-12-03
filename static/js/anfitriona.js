// =============================================================================
// MÓDULO: ANFITRIONA DE BIENVENIDA
// =============================================================================

// --- VARIABLES GLOBALES DEL MÓDULO ---
let CART = [];
let MENU_DATA = {};
let RESERVA_ACTUAL_ID = null;

// ==================== HUO01, HUO02: CONSULTAR DISPONIBILIDAD ====================

/**
 * Función: renderDisponibilidad
 * Propósito: Renderiza la interfaz principal para buscar mesas.
 * Async: Se marca como asíncrona porque llama inmediatamente a 'buscarMesasDisponibles()'.
 */
async function renderDisponibilidad() {
    setPageTitle('Consultar Disponibilidad de Mesas', 'fa-calendar-check');
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-search"></i> Buscar Disponibilidad</h3>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-calendar"></i> Fecha</label>
                    <input type="date" id="disp-fecha" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock"></i> Hora</label>
                    <input type="time" id="disp-hora" value="12:00">
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end;">
                    <button class="btn btn-primary" onclick="buscarMesasDisponibles()">
                        <i class="fas fa-search"></i> Consultar
                    </button>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-chair"></i> Mesas Disponibles</h3>
                <span class="badge badge-confirmada" id="count-mesas">0 mesas</span>
            </div>
            <div class="mesas-grid" id="mesas-grid">${showLoader()}</div>
        </div>`;
    buscarMesasDisponibles();
}

/**
 * Función: buscarMesasDisponibles
 * Propósito: Consulta al backend qué mesas están libres.
 */
async function buscarMesasDisponibles() {
    const fecha = document.getElementById('disp-fecha').value;
    const hora = document.getElementById('disp-hora').value;
    const grid = document.getElementById('mesas-grid');
    grid.innerHTML = showLoader();
    
    try {
        const mesas = await fetchAPI(`/mesas/disponibles?fecha=${fecha}&hora=${hora}`);
        document.getElementById('count-mesas').textContent = `${mesas.length} mesas disponibles`;
        
        if (mesas.length === 0) {
            grid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; padding: 40px; color: #666;"><i class="fas fa-exclamation-circle"></i> No hay mesas disponibles</p>';
            return;
        }
        
        grid.innerHTML = mesas.map(m => `
            <div class="mesa-card disponible" onclick="seleccionarMesaParaReserva(${m.id}, ${m.numero})">
                <div class="mesa-numero">${m.numero}</div>
                <div class="mesa-info">
                    <span class="badge badge-confirmada">${m.tipo}</span>
                    <div style="margin-top: 8px;"><i class="fas fa-map-marker-alt"></i> ${m.ubicacion}</div>
                </div>
                <div class="mesa-capacidad"><i class="fas fa-users"></i> ${m.capacidad} personas</div>
            </div>
        `).join('');
    } catch (e) {
        grid.innerHTML = '<p class="text-center" style="color: var(--danger);">Error al cargar mesas</p>';
    }
}

function seleccionarMesaParaReserva(id, numero) {
    showConfirm('Crear Reserva', `¿Desea crear una reserva para la Mesa ${numero}?`, () => {
        renderNuevaReserva(id, numero);
    }, 'fa-calendar-plus', 'var(--success)');
}

// ==================== HUO03, HUO05: NUEVA RESERVA ====================

/**
 * Función: renderNuevaReserva
 * Propósito: Muestra el formulario para registrar una nueva reserva.
 */
async function renderNuevaReserva(mesaId = null, mesaNum = null) {
    setPageTitle('Registrar Nueva Reserva', 'fa-plus-circle');
    const content = document.getElementById('content-area');
    
    let mesasOptions = '<option value="">Seleccione una mesa...</option>';
    try {
        const mesas = await fetchAPI('/mesas');
        mesasOptions += mesas.map(m => `<option value="${m.id}" ${m.id == mesaId ? 'selected' : ''}>Mesa ${m.numero} - ${m.tipo} (${m.capacidad} pers.)</option>`).join('');
    } catch(e) {}
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-user"></i> Datos del Cliente</h3>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-id-card"></i> DNI *</label>
                    <input type="text" id="input-dni" maxlength="8" placeholder="Ingrese DNI" onkeyup="if(this.value.length===8)consultarDNI(this.value)">
                    <small style="color:#666;">Complete 8 dígitos para buscar automáticamente</small>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Nombre *</label>
                    <input type="text" id="input-nombre" placeholder="Nombre">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Apellido</label>
                    <input type="text" id="input-apellido" placeholder="Apellido">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-phone"></i> Teléfono</label>
                    <input type="tel" id="input-telefono" placeholder="987654321">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-envelope"></i> Email</label>
                    <input type="email" id="input-email" placeholder="correo@email.com">
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-calendar-alt"></i> Datos de la Reserva</h3>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-calendar"></i> Fecha *</label>
                    <input type="date" id="input-fecha" min="${new Date().toISOString().split('T')[0]}" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock"></i> Hora *</label>
                    <input type="time" id="input-hora" value="12:00">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-users"></i> Cantidad de Personas *</label>
                    <input type="number" id="input-cantidad" min="1" max="20" value="2">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group full-width">
                    <label><i class="fas fa-chair"></i> Mesa *</label>
                    <select id="input-mesa">${mesasOptions}</select>
                </div>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 15px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="renderDisponibilidad()"><i class="fas fa-arrow-left"></i> Volver</button>
                <button class="btn btn-success" onclick="crearReservaSolaYPreguntar()"><i class="fas fa-save"></i> Crear Reserva</button>
            </div>
        </div>`;
}

/**
 * Función: crearReservaSolaYPreguntar
 * Propósito: Valida datos, crea la reserva y ofrece tomar el pedido.
 * CORRECCIÓN: Eliminado el mensaje de error duplicado en el catch.
 */
async function crearReservaSolaYPreguntar() {
    const data = {
        dni: document.getElementById('input-dni').value.trim(),
        nombre: document.getElementById('input-nombre').value.trim(),
        apellido: document.getElementById('input-apellido').value.trim(),
        telefono: document.getElementById('input-telefono').value.trim(),
        email: document.getElementById('input-email').value.trim(),
        fecha: document.getElementById('input-fecha').value,
        hora: document.getElementById('input-hora').value,
        cantidad: parseInt(document.getElementById('input-cantidad').value) || 1,
        id_mesa: document.getElementById('input-mesa').value
    };
    
    // Validaciones
    if (!data.dni || data.dni.length !== 8) return showToast('❌ El DNI debe tener 8 dígitos', 'error');
    if (!data.nombre) return showToast('❌ El nombre es obligatorio', 'error');
    if (!data.fecha) return showToast('❌ La fecha es obligatoria', 'error');
    if (!data.hora) return showToast('❌ La hora es obligatoria', 'error');
    if (!data.id_mesa) return showToast('❌ Debe seleccionar una mesa', 'error');
    
    // Validación de reglas de negocio
    try {
        const mesas = await fetchAPI('/mesas');
        const mesaSel = mesas.find(m => m.id == data.id_mesa);
        if (mesaSel && data.cantidad > mesaSel.capacidad) {
            return showToast(`❌ Mesa ${mesaSel.numero} solo tiene capacidad para ${mesaSel.capacidad} personas`, 'error');
        }
    } catch (e) {}
    
    const fechaReserva = new Date(data.fecha + 'T' + data.hora);
    if (fechaReserva < new Date()) return showToast('❌ No puede crear reservas en fechas/horas pasadas', 'error');
    
    const [horas] = data.hora.split(':').map(Number);
    if (horas < 11 || horas >= 22) return showToast('⏰ Horario de atención: 11:00 AM a 10:00 PM', 'warning');
    
    try {
        // Enviar al backend
        const resReserva = await fetchAPI('/reservas', { method: 'POST', body: JSON.stringify(data) });
        const idReserva = resReserva.id; 
        
        showToast('✅ Reserva creada exitosamente', 'success');
        
        const bodyHtml = `
            <div class="text-center" style="padding: 20px;">
                <i class="fas fa-check-circle" style="font-size: 4em; color: var(--success); margin-bottom: 20px;"></i>
                <h3 style="color: var(--success);">¡Reserva Creada!</h3>
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left;">
                    <p style="margin: 5px 0; color: #155724;"><strong>📋 Reserva #${idReserva}</strong></p>
                    <p style="margin: 5px 0; color: #155724;">• Cliente: ${data.nombre} ${data.apellido || ''}</p>
                    <p style="margin: 5px 0; color: #155724;">• Fecha: ${data.fecha} ${data.hora}</p>
                    <p style="margin: 5px 0; color: #155724;">• Mesa ${data.id_mesa} - ${data.cantidad} personas</p>
                </div>
                <hr style="margin: 20px 0;">
                <i class="fas fa-utensils" style="font-size: 3em; color: var(--primary); margin: 20px 0;"></i>
                <h4>¿Desea tomar el pedido ahora?</h4>
                <p style="color: #666; margin-top: 10px;">Puede agregar items del menú a esta reserva.</p>
            </div>`;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal(); renderDisponibilidad();">
                <i class="fas fa-times"></i> No, solo reserva
            </button>
            <button class="btn btn-success" onclick="closeModal(); tomarPedidoDeReservaRecienCreada(${idReserva}, ${data.id_mesa}, '${data.nombre}');">
                <i class="fas fa-utensils"></i> Sí, tomar pedido
            </button>`;
        
        openModal('Reserva Creada', bodyHtml, footerHtml);
        
    } catch (e) {
        // ERROR CORREGIDO: Ya no mostramos el toast aquí porque fetchAPI ya lo muestra.
        console.error("Error al crear reserva:", e);
    }
}

// ==================== TOMA DE PEDIDO (RESERVA NUEVA) ====================

/**
 * Función: tomarPedidoDeReservaRecienCreada
 * Propósito: Muestra la interfaz de toma de pedidos (menú + carrito).
 */
async function tomarPedidoDeReservaRecienCreada(idReserva, idMesa, nombreCliente) {
    setPageTitle('Tomar Pedido de Reserva', 'fa-utensils');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const [mesas, menuData] = await Promise.all([fetchAPI('/mesas'), fetchAPI('/menu')]);
        
        MENU_DATA = menuData;
        CART = [];
        window.ID_RESERVA_PEDIDO = idReserva;
        
        const mesasOpt = mesas.map(m => `<option value="${m.id}" ${m.id == idMesa ? 'selected' : ''}>Mesa ${m.numero}</option>`).join('');
        const categorias = Object.keys(menuData);
        
        content.innerHTML = `
            <div class="order-layout">
                <div>
                    <div class="card" style="background: linear-gradient(135deg, #d4edda, #c3e6cb); border: 2px solid var(--success);">
                        <div class="card-header"><h3><i class="fas fa-check-circle" style="color: var(--success);"></i> Pedido de Reserva #${idReserva}</h3></div>
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <p style="margin: 0; color: #1565c0;">
                                <i class="fas fa-info-circle"></i> 
                                <strong>Reserva ya creada</strong><br>
                                <small>Agregue los items del pedido y envíe a cocina.</small>
                            </p>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label><i class="fas fa-chair"></i> Mesa</label>
                                <select id="pedido-mesa" disabled>${mesasOpt}</select>
                            </div>
                            <div class="form-group">
                                <label><i class="fas fa-user"></i> Cliente</label>
                                <input type="text" id="pedido-nombre" value="${nombreCliente || ''}" readonly>
                            </div>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-comment"></i> Observaciones del Pedido</label>
                            <textarea id="pedido-obs" rows="2" placeholder="Observaciones..."></textarea>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-book-open"></i> Menú</h3></div>
                        <div style="padding: 0 20px 15px;">
                            <input type="text" id="search-menu-reserva" 
                                placeholder="🔍 Buscar platos..." 
                                style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 1em;"
                                oninput="cambiarCategoriaReserva(document.querySelector('.category-btn.active')?.textContent || '${categorias[0]}')">
                        </div>
                        <div class="menu-categories">${categorias.map((c, i) => `<button class="category-btn ${i === 0 ? 'active' : ''}" onclick="cambiarCategoriaReserva('${c}')">${c}</button>`).join('')}</div>
                        <div class="menu-items" id="menu-items"></div>
                    </div>
                </div>
                
                <div class="cart-panel">
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-shopping-cart"></i> Pedido</h3><span class="badge badge-pendiente" id="cart-count">0 items</span></div>
                        <div class="cart-items" id="cart-items"><p class="text-center" style="padding: 30px; color: #999;"><i class="fas fa-cart-plus" style="font-size: 2.5em;"></i><br>Agregue items del menú</p></div>
                        <div class="cart-total" id="cart-total" style="display: none;"><div class="cart-total-row"><span>TOTAL</span><span id="total-amount">S/ 0.00</span></div></div>
                        <button class="btn btn-success btn-block mt-3" onclick="enviarPedidoDeReserva()" style="display: none;" id="btn-enviar"><i class="fas fa-paper-plane"></i> Enviar Pedido a Cocina</button>
                        <button class="btn btn-secondary btn-block mt-3" onclick="renderDisponibilidad()"><i class="fas fa-arrow-left"></i> Volver</button>
                    </div>
                </div>
            </div>`;
        
        if (categorias.length > 0) cambiarCategoriaReserva(categorias[0]);
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">❌ Error al cargar datos</div>';
    }
}

function cambiarCategoriaReserva(categoria) {
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.toggle('active', btn.textContent === categoria));
    
    const items = MENU_DATA[categoria] || [];
    const searchInput = document.getElementById('search-menu-reserva');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    const filtrados = items.filter(item => 
        item.nombre.toLowerCase().includes(searchTerm) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm))
    );
    
    const container = document.getElementById('menu-items');
    if (!container) return;
    
    if (filtrados.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">No se encontraron platos</p>';
        return;
    }
    
    container.innerHTML = filtrados.map(item => `
        <div class="menu-item" onclick="agregarAlCarrito(${item.id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.precio})">
            <div class="item-name">${item.nombre}</div>
            <div class="item-price">S/ ${item.precio.toFixed(2)}</div>
            ${item.descripcion ? `<small style="color: #888; font-size: 0.8em; margin-top: 5px; display: block;">${item.descripcion}</small>` : ''}
        </div>
    `).join('');
}

async function enviarPedidoDeReserva() {
    if (CART.length === 0) return showToast('Agregue al menos un item', 'error');
    
    const idReserva = window.ID_RESERVA_PEDIDO;
    const mesa = document.getElementById('pedido-mesa').value;
    const nombre = document.getElementById('pedido-nombre').value;
    const obs = document.getElementById('pedido-obs').value;
    
    const data = {
        id_mesa: mesa,
        nombre_cliente: nombre,
        observaciones: obs,
        items: CART
    };
    
    showConfirm('Enviar Pedido', '¿Enviar este pedido a cocina?', async () => {
        try {
            const res = await fetchAPI(`/reservas/${idReserva}/comanda`, { 
                method: 'POST', 
                body: JSON.stringify(data) 
            });
            
            showToast('' + res.message, 'success');
            
            openModal('Pedido Enviado', `
                <div class="text-center" style="padding: 20px;">
                    <i class="fas fa-check-circle" style="font-size: 4em; color: var(--success);"></i>
                    <h3 style="color: var(--success); margin-top: 15px;">¡Pedido Creado!</h3>
                    <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p style="margin: 5px 0; color: #155724;">${CART.length} items agregados</p>
                        <p style="margin: 5px 0; color: #155724;">Total: S/ ${CART.reduce((s, i) => s + i.precio * i.cantidad, 0).toFixed(2)}</p>
                        <p style="margin: 5px 0; color: #155724;"><strong>Enviado a cocina</strong></p>
                    </div>
                </div>`,
                `<button class="btn btn-primary" onclick="closeModal(); CART = []; renderDisponibilidad();"><i class="fas fa-check"></i> Finalizar</button>`
            );
        } catch (e) {
            console.error('Error:', e);
        }
    }, 'fa-paper-plane', 'var(--success)');
}

// ==================== FUNCIONES DEL CARRITO ====================
function agregarAlCarrito(id, nombre, precio) {
    const existe = CART.find(item => item.id_menu === id);
    if (existe) existe.cantidad++;
    else CART.push({ id_menu: id, nombre, precio, cantidad: 1, observaciones: '' });
    actualizarCarrito();
    showToast(`${nombre} agregado`, 'success');
}

function actualizarCarrito() {
    const container = document.getElementById('cart-items');
    const countBadge = document.getElementById('cart-count');
    const totalEl = document.getElementById('total-amount');
    const cartTotalDiv = document.getElementById('cart-total');
    const btnEnviar = document.getElementById('btn-enviar');
    
    if (!container) return;
    
    if (CART.length === 0) {
        container.innerHTML = `<p class="text-center" style="padding: 30px; color: #999;"><i class="fas fa-cart-plus" style="font-size: 2.5em;"></i><br>Agregue items del menú</p>`;
        if (cartTotalDiv) cartTotalDiv.style.display = 'none';
        if (btnEnviar) btnEnviar.style.display = 'none';
        if (countBadge) countBadge.textContent = '0 items';
        return;
    }
    
    const total = CART.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    
    container.innerHTML = CART.map((item, idx) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.nombre}</div>
                <div class="cart-item-price">S/ ${item.precio.toFixed(2)} c/u</div>
            </div>
            <div class="cart-item-actions">
                <button class="qty-btn-minus" onclick="cambiarCantidad(${idx}, -1)">-</button>
                <span class="cart-item-qty">${item.cantidad}</span>
                <button class="qty-btn-plus" onclick="cambiarCantidad(${idx}, 1)">+</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarDelCarrito(${idx})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    
    if (countBadge) countBadge.textContent = `${CART.length} items`;
    if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
    if (cartTotalDiv) cartTotalDiv.style.display = 'block';
    if (btnEnviar) btnEnviar.style.display = 'block';
}

function cambiarCantidad(idx, delta) {
    CART[idx].cantidad += delta;
    if (CART[idx].cantidad <= 0) CART.splice(idx, 1);
    actualizarCarrito();
}

function eliminarDelCarrito(idx) {
    CART.splice(idx, 1);
    actualizarCarrito();
}

// ==================== HUO04: MODIFICAR RESERVA ====================
async function renderModificarReserva() {
    setPageTitle('Modificar Reserva', 'fa-edit');
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="card">
            <div class="card-header"><h3><i class="fas fa-search"></i> Buscar Reserva por DNI</h3></div>
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-id-card"></i> DNI del Cliente</label>
                    <input type="text" id="buscar-dni" maxlength="8" placeholder="Ingrese DNI">
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end;">
                    <button class="btn btn-primary" onclick="buscarReservaPorDNI()"><i class="fas fa-search"></i> Buscar</button>
                </div>
            </div>
        </div>
        <div id="resultado-busqueda"></div>`;
}

async function buscarReservaPorDNI() {
    const dni = document.getElementById('buscar-dni').value.trim();
    if (dni.length !== 8) return showToast('Ingrese un DNI válido de 8 dígitos', 'warning');
    
    const resultado = document.getElementById('resultado-busqueda');
    resultado.innerHTML = showLoader();
    
    try {
        const reservas = await fetchAPI('/reservas');
        const filtradas = reservas.filter(r => r.dni === dni && ['pendiente', 'confirmada'].includes(r.estado));
        
        if (filtradas.length === 0) {
            resultado.innerHTML = '<div class="card text-center" style="padding: 40px;"><i class="fas fa-info-circle" style="font-size: 3em; color: #999;"></i><p style="margin-top: 15px; color: #666;">No se encontraron reservas activas para este DNI</p></div>';
            return;
        }
        
        resultado.innerHTML = `
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-list"></i> Reservas Encontradas (${filtradas.length})</h3></div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>ID</th><th>Fecha</th><th>Hora</th><th>Mesa</th><th>Personas</th><th>Estado</th><th>Acciones</th></tr></thead>
                        <tbody>
                            ${filtradas.map(r => `
                                <tr>
                                    <td><strong>#${r.id_reserva}</strong></td>
                                    <td>${r.fecha}</td>
                                    <td>${r.hora}</td>
                                    <td>Mesa ${r.mesa}</td>
                                    <td>${r.personas}</td>
                                    <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
                                    <td>
                                        ${r.estado === 'confirmada' ? 
                                            `<button class="btn btn-info btn-sm" onclick="editarReservaAnfitriona(${r.id_reserva})"><i class="fas fa-edit"></i> Editar Datos</button>` : 
                                            `<button class="btn btn-secondary btn-sm" disabled><i class="fas fa-lock"></i> Bloqueado</button>`
                                        }
                                        ${r.estado === 'confirmada' ? 
                                            `<button class="btn btn-success btn-sm" onclick="tomarPedidoDeReservaExistente(${r.id_reserva}, ${r.id_mesa}, '${r.cliente}', '${r.estado}')"><i class="fas fa-utensils"></i> Modificar Pedido</button>` : 
                                            `<button class="btn btn-warning btn-sm" disabled><i class="fas fa-lock"></i> Pendiente</button>`
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        resultado.innerHTML = '<div class="card text-center" style="color: var(--danger);"><i class="fas fa-exclamation-circle"></i> Error al buscar reservas</div>';
    }
}

async function tomarPedidoDeReservaExistente(idReserva, idMesa, nombreCliente, estadoReserva) {
    if (estadoReserva === 'pendiente') {
        showToast('⚠️ Esta reserva está PENDIENTE. Solo puede modificarse cuando el Líder/Cajera la confirme.', 'warning');
        return;
    }
    modificarPedidoDeReserva(idReserva, idMesa, nombreCliente);
}

async function modificarPedidoDeReserva(idReserva, idMesa, nombreCliente) {
    setPageTitle('Modificar Pedido de Reserva', 'fa-edit');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const [comandas, menuData] = await Promise.all([fetchAPI('/comandas'), fetchAPI('/menu')]);
        
        const comandasReserva = comandas.filter(c => c.id_reserva == idReserva && c.estado !== 'pagada');
        
        MENU_DATA = menuData;
        window.ID_RESERVA_PEDIDO = idReserva;
        CART = [];
        
        if (comandasReserva.length > 0) {
            comandasReserva.forEach((comanda) => {
                if (comanda.items && Array.isArray(comanda.items)) {
                    comanda.items.forEach(item => {
                        const existe = CART.find(i => i.id_menu == item.id_menu);
                        if (existe) existe.cantidad += parseInt(item.cantidad || 1);
                        else CART.push({
                            id_menu: item.id_menu,
                            nombre: item.nombre,
                            precio: parseFloat(item.precio),
                            cantidad: parseInt(item.cantidad || 1),
                            observaciones: item.observaciones || ''
                        });
                    });
                }
            });
        }
        
        const categorias = Object.keys(menuData);
        const totalItems = CART.reduce((sum, item) => sum + item.cantidad, 0);
        
        content.innerHTML = `
            <div class="order-layout">
                <div>
                    <div class="card" style="background: linear-gradient(135deg, #fff3cd, #ffeeba); border: 2px solid var(--warning);">
                        <div class="card-header">
                            <h3><i class="fas fa-edit" style="color: var(--warning);"></i> Modificar Pedido de Reserva #${idReserva}</h3>
                        </div>
                        <div style="background: ${CART.length > 0 ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <p style="margin: 0; color: ${CART.length > 0 ? '#155724' : '#721c24'};">
                                <i class="fas fa-${CART.length > 0 ? 'check-circle' : 'exclamation-triangle'}"></i> 
                                <strong>${CART.length > 0 ? `Se cargaron ${totalItems} items` : 'No hay items en el pedido'}</strong>
                            </p>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label><i class="fas fa-chair"></i> Mesa</label>
                                <input type="text" value="Mesa ${idMesa}" readonly style="background: #f8f9fa;">
                            </div>
                            <div class="form-group">
                                <label><i class="fas fa-user"></i> Cliente</label>
                                <input type="text" value="${nombreCliente}" readonly style="background: #f8f9fa;">
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-book-open"></i> Menú</h3></div>
                        <div class="menu-categories" id="menu-categories">
                            ${categorias.map((c, i) => `<button class="category-btn ${i === 0 ? 'active' : ''}" onclick="cambiarCategoriaReserva('${c}')">${c}</button>`).join('')}
                        </div>
                        <div class="menu-items" id="menu-items"></div>
                    </div>
                </div>
                
                <div class="cart-panel">
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-shopping-cart"></i> Pedido</h3><span class="badge badge-${CART.length > 0 ? 'completada' : 'pendiente'}" id="cart-count">${totalItems} items</span></div>
                        <div class="cart-items" id="cart-items"></div>
                        <div class="cart-total" id="cart-total" style="${CART.length === 0 ? 'display: none;' : ''}">
                            <div class="cart-total-row"><span>TOTAL</span><span id="total-amount">S/ 0.00</span></div>
                        </div>
                        <button class="btn btn-success btn-block mt-3" onclick="guardarCambiosPedidoReserva(${idReserva}, ${idMesa})" id="btn-enviar" ${CART.length === 0 ? 'disabled' : ''}>
                            <i class="fas fa-save"></i> Guardar Cambios
                        </button>
                        <button class="btn btn-secondary btn-block mt-3" onclick="renderModificarReserva()">
                            <i class="fas fa-arrow-left"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>`;
        
        if (categorias.length > 0) cambiarCategoriaReserva(categorias[0]);
        setTimeout(() => actualizarCarrito(), 100);
        
    } catch (e) {
        showToast('❌ Error: ' + e.message, 'error');
    }
}

async function guardarCambiosPedidoReserva(idReserva, idMesa) {
    if (CART.length === 0) return showToast('❌ Debe tener al menos un item', 'error');
    
    showConfirm('Guardar Cambios', '¿Desea guardar los cambios en el pedido?', async () => {
        try {
            const comandas = await fetchAPI('/comandas');
            const comandasReserva = comandas.filter(c => c.id_reserva == idReserva && c.estado !== 'pagada');
            
            for (const comanda of comandasReserva) {
                await fetchAPI(`/comandas/${comanda.id}`, { method: 'DELETE' });
            }
            
            const data = {
                id_mesa: idMesa,
                id_reserva: idReserva,
                nombre_cliente: '',
                observaciones: '',
                items: CART
            };
            
            await fetchAPI('/comandas', { method: 'POST', body: JSON.stringify(data) });
            showToast('✅ Pedido actualizado correctamente', 'success');
            
            openModal('✅ Cambios Guardados', `
                <div class="text-center" style="padding: 20px;">
                    <i class="fas fa-check-circle" style="font-size: 4em; color: var(--success);"></i>
                    <h3 style="color: var(--success); margin-top: 15px;">¡Pedido Actualizado!</h3>
                    <p>Cambios enviados a cocina.</p>
                </div>`,
                `<button class="btn btn-primary" onclick="closeModal(); CART = []; renderModificarReserva();"><i class="fas fa-check"></i> Finalizar</button>`
            );
        } catch (e) {
            showToast('❌ Error al guardar cambios', 'error');
        }
    }, 'fa-save', 'var(--success)');
}

async function editarReservaAnfitriona(id) {
    try {
        const reserva = await fetchAPI(`/reservas/${id}`);
        if (reserva.estado !== 'confirmada') {
            showToast('⚠️ Solo puede editar reservas CONFIRMADAS', 'warning');
            return;
        }
        
        const mesas = await fetchAPI('/mesas');
        
        openModal(`Editar Reserva #${id}`, `
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p style="margin: 0; color: #155724;"><i class="fas fa-check-circle"></i> <strong>Reserva CONFIRMADA</strong></p>
            </div>
            
            <h4 style="color: var(--primary); margin-bottom: 15px;">Modificar Datos</h4>
            
            <div class="form-group"><label>Fecha</label><input type="date" id="edit-fecha" value="${reserva.fecha}" min="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label>Hora</label><input type="time" id="edit-hora" value="${reserva.hora}"></div>
            <div class="form-group"><label>Cantidad</label><input type="number" id="edit-cantidad" value="${reserva.cantidad}" min="1"></div>
            <div class="form-group"><label>Mesa</label><select id="edit-mesa">${mesas.map(m => `<option value="${m.id}" ${m.id == reserva.id_mesa ? 'selected' : ''}>Mesa ${m.numero}</option>`).join('')}</select></div>
            
            <hr style="margin: 20px 0;">
            <h4 style="color: var(--primary);">Cliente</h4>
            <div class="form-group"><label>Nombre</label><input type="text" id="edit-nombre" value="${reserva.cliente?.nombre || ''}"></div>
            <div class="form-group"><label>Apellido</label><input type="text" id="edit-apellido" value="${reserva.cliente?.apellido || ''}"></div>
            <div class="form-group"><label>Teléfono</label><input type="tel" id="edit-telefono" value="${reserva.cliente?.telefono || ''}"></div>
            <div class="form-group"><label>Email</label><input type="email" id="edit-email" value="${reserva.cliente?.email || ''}"></div>
        `,
            `<button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancelar</button>
            <button class="btn btn-success" onclick="guardarEdicionReservaAnfitriona(${id})"><i class="fas fa-save"></i> Guardar Cambios</button>`
        );
    } catch (e) {
        showToast('❌ Error al cargar reserva', 'error');
    }
}

async function guardarEdicionReservaAnfitriona(id) {
    const data = {
        fecha: document.getElementById('edit-fecha').value,
        hora: document.getElementById('edit-hora').value,
        cantidad: parseInt(document.getElementById('edit-cantidad').value),
        id_mesa: document.getElementById('edit-mesa').value,
        cliente: {
            nombre: document.getElementById('edit-nombre').value,
            apellido: document.getElementById('edit-apellido').value,
            telefono: document.getElementById('edit-telefono').value,
            email: document.getElementById('edit-email').value
        }
    };
    
    try {
        await fetchAPI(`/reservas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showToast('✅ Reserva actualizada', 'success');
        closeModal();
        buscarReservaPorDNI();
    } catch (e) {}
}

// ==================== HUO06: LISTAR RESERVAS ====================
async function renderListarReservas() {
    setPageTitle('Consultar Reservas del Sistema', 'fa-list');
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="card">
            <div class="card-header"><h3><i class="fas fa-filter"></i> Filtros</h3></div>
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-calendar"></i> Fecha</label>
                    <input type="date" id="filtro-fecha-anf" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-info-circle"></i> Estado</label>
                    <select id="filtro-estado-anf">
                        <option value="" selected>Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="confirmada">Confirmada</option>
                        <option value="cancelada">Cancelada</option>
                        <option value="pagada">Pagada</option>
                        <option value="rechazada">Rechazada</option>
                    </select>
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end;">
                    <button class="btn btn-primary" onclick="buscarReservasAnfitriona()"><i class="fas fa-search"></i> Buscar</button>
                    <button class="btn btn-secondary" onclick="limpiarFiltrosAnfitriona()" style="margin-left: 10px;"><i class="fas fa-eraser"></i> Limpiar</button>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3><i class="fas fa-calendar-alt"></i> Reservas</h3><span class="badge badge-pendiente" id="total-reservas-anf">Cargando...</span></div>
            <div class="table-container" id="tabla-reservas-anf">${showLoader()}</div>
        </div>`;
    buscarReservasAnfitriona();
}

async function buscarReservasAnfitriona() {
    const fecha = document.getElementById('filtro-fecha-anf')?.value;
    const estado = document.getElementById('filtro-estado-anf')?.value;
    const container = document.getElementById('tabla-reservas-anf');
    if (!container) return;
    
    container.innerHTML = showLoader();
    
    try {
        const reservas = await fetchAPI('/reservas');
        let filtradas = reservas;
        if (fecha) filtradas = filtradas.filter(r => r.fecha === fecha);
        if (estado) filtradas = filtradas.filter(r => r.estado === estado);
        filtradas.sort((a, b) => new Date(b.fecha + ' ' + b.hora) - new Date(a.fecha + ' ' + a.hora));
        
        document.getElementById('total-reservas-anf').textContent = `${filtradas.length} reservas`;
        
        if (filtradas.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;"><i class="fas fa-info-circle" style="font-size: 3em;"></i><h3>No hay reservas</h3></div>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead><tr><th>ID</th><th>Fecha</th><th>Hora</th><th>Cliente</th><th>DNI</th><th>Teléfono</th><th>Mesa</th><th>Pers.</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${filtradas.map(r => `
                        <tr>
                            <td><strong>#${r.id_reserva}</strong></td>
                            <td>${r.fecha}</td>
                            <td><strong>${r.hora}</strong></td>
                            <td>${r.cliente}</td>
                            <td>${r.dni}</td>
                            <td>${r.telefono || '-'}</td>
                            <td><span class="badge badge-confirmada">Mesa ${r.mesa}</span></td>
                            <td>${r.personas}</td>
                            <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
                            <td><button class="btn btn-info btn-sm" onclick="verDetalleReservaAnfitriona(${r.id_reserva})"><i class="fas fa-eye"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        showToast(`✅ ${filtradas.length} reservas encontradas`, 'success');
    } catch (e) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);"><i class="fas fa-exclamation-circle"></i><h3>Error</h3><button class="btn btn-primary mt-3" onclick="buscarReservasAnfitriona()">Reintentar</button></div>';
    }
}

function limpiarFiltrosAnfitriona() {
    document.getElementById('filtro-fecha-anf').value = new Date().toISOString().split('T')[0];
    document.getElementById('filtro-estado-anf').value = '';
    buscarReservasAnfitriona();
}

/**
 * Muestra el modal con el detalle completo de la reserva.
 */
async function verDetalleReservaAnfitriona(id) {
    try {
        const reserva = await fetchAPI(`/reservas/${id}`);
        const comandas = await fetchAPI('/comandas');
        
        const comandasMesa = comandas.filter(c => {
            if (c.id_reserva == id) return true;
            if (c.id_mesa == reserva.id_mesa && c.fecha == reserva.fecha) {
                if (c.id_reserva && c.id_reserva != id) return false;
                if (reserva.hora && c.hora) {
                    const horaReserva = parseInt(reserva.hora.split(':')[0]);
                    const horaPedido = parseInt(c.hora.split(':')[0]);
                    if (Math.abs(horaReserva - horaPedido) > 3) return false; 
                }
                return true;
            }
            return false;
        });
        
        const bodyHtml = `
            <div style="padding: 10px;">
                <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 2em;">Reserva #${reserva.id}</h2>
                    <p style="margin: 10px 0 0; opacity: 0.9;">Estado: <span class="badge badge-${reserva.estado}" style="font-size: 1.1em;">${reserva.estado.toUpperCase()}</span></p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <p style="margin: 0; color: #666; font-size: 0.9em;"><i class="fas fa-calendar"></i> Fecha</p>
                        <p style="margin: 5px 0 0; font-size: 1.2em; font-weight: bold;">${reserva.fecha}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <p style="margin: 0; color: #666; font-size: 0.9em;"><i class="fas fa-clock"></i> Hora</p>
                        <p style="margin: 5px 0 0; font-size: 1.2em; font-weight: bold;">${reserva.hora}</p>
                    </div>
                </div>
                
                <div style="background: #e3f2fd; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px; color: var(--primary);"><i class="fas fa-user"></i> Datos del Cliente</h4>
                    ${reserva.cliente ? `
                        <p style="margin: 8px 0;"><strong>Nombre:</strong> ${reserva.cliente.nombre} ${reserva.cliente.apellido || ''}</p>
                        <p style="margin: 8px 0;"><strong>DNI:</strong> ${reserva.cliente.dni}</p>
                        <p style="margin: 8px 0;"><strong>Teléfono:</strong> ${reserva.cliente.telefono || 'No registrado'}</p>
                        <p style="margin: 8px 0;"><strong>Email:</strong> ${reserva.cliente.email || 'No registrado'}</p>
                    ` : '<p style="color: #999;">Sin datos de cliente</p>'}
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; color: #666; font-size: 0.9em;"><i class="fas fa-chair"></i> Mesa</p>
                        <p style="margin: 5px 0 0; font-size: 1.5em; font-weight: bold; color: var(--primary);">Mesa ${reserva.id_mesa}</p>
                    </div>
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; color: #666; font-size: 0.9em;"><i class="fas fa-users"></i> Comensales</p>
                        <p style="margin: 5px 0 0; font-size: 1.5em; font-weight: bold; color: var(--success);">${reserva.cantidad}</p>
                    </div>
                </div>
                
                ${comandasMesa.length > 0 ? `
                    <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; border-left: 4px solid var(--success);">
                        <h4 style="margin: 0 0 15px; color: var(--success);"><i class="fas fa-utensils"></i> Pedidos Asociados (${comandasMesa.length})</h4>
                        ${comandasMesa.map(c => `
                            <div style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid ${c.estado === 'completada' ? 'var(--success)' : c.estado === 'pagada' ? 'var(--info)' : 'var(--warning)'};">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <strong style="font-size: 1.1em;">Pedido #${c.id}</strong>
                                    <span class="badge badge-${c.estado}">${c.estado.toUpperCase()}</span>
                                </div>
                                
                                ${c.nombre_cliente ? `<p style="margin: 5px 0; color: #666;"><i class="fas fa-user"></i> ${c.nombre_cliente}</p>` : ''}
                                
                                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0;">
                                    <strong style="display: block; margin-bottom: 8px; color: var(--primary); font-size: 0.9em;"><i class="fas fa-list"></i> Items:</strong>
                                    ${c.items && c.items.length > 0 ? c.items.map(i => `
                                        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ddd;">
                                            <span>
                                                <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; font-weight: bold;">${i.cantidad}</span>
                                                ${i.nombre}
                                            </span>
                                            <strong>S/ ${(i.cantidad * i.precio).toFixed(2)}</strong>
                                        </div>
                                    `).join('') : '<p style="color: #999; margin: 0;">Sin items registrados</p>'}
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid var(--primary); font-weight: bold; font-size: 1.1em;">
                                    <span>Total Pedido:</span>
                                    <span style="color: var(--primary);">S/ ${c.total ? c.total.toFixed(2) : '0.00'}</span>
                                </div>
                            </div>
                        `).join('')}
                        
                        <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 15px; border-radius: 8px; margin-top: 15px; display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em;">
                            <span>TOTAL GENERAL:</span>
                            <span>S/ ${comandasMesa.reduce((sum, c) => sum + (c.total || 0), 0).toFixed(2)}</span>
                        </div>
                    </div>
                ` : `
                    <div style="background: #fff3cd; padding: 20px; border-radius: 10px; color: #856404; text-align: center;">
                        <i class="fas fa-info-circle" style="font-size: 2em; margin-bottom: 10px;"></i>
                        <p style="margin: 0;"><strong>Sin pedidos registrados</strong></p>
                    </div>
                `}
            </div>`;
        
        const footerHtml = `<button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cerrar</button>`;
        
        openModal('Detalles de la Reserva', bodyHtml, footerHtml);
        
    } catch (e) {
        console.error('Error al cargar detalles:', e);
        showToast('❌ Error al cargar los detalles de la reserva', 'error');
    }
}