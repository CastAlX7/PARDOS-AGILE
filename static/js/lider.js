// =============================================================================
// MÓDULO: LÍDER DE RESTAURANTE (ADMINISTRADOR) - CÓDIGO COMPLETO
// Responsabilidad: Gestión Total (Reservas, Comandas, Informes, Control de Roles).
// =============================================================================

// --- Variables Globales (Asumidas globales en la aplicación) ---
// Se asume que window.CART, window.MENU_DATA, fetchAPI, closeModal, showToast, 
// showConfirm, setPageTitle, showLoader, renderEdicionCaja, toggleCamposComprobante, 
// buscarClienteDNI, buscarClienteRUC, imprimirPrecuenta, procesarPago, anularComandaCompletamente, 
// mostrarComprobanteFinal existen globalmente o son importadas.

let VENTA_FILTRO_TIPO = 'dia'; // 'dia', 'mes', 'anual'
let VENTA_FILTRO_VALOR = new Date().toISOString().split('T')[0]; // Fecha actual por defecto

// Función Auxiliar para la impresión del Documento Interno (Pre-cuenta)
function imprimirDocumentoLider() {
    const contenido = window.DOCUMENTO_LIDER_CONTENT;
    const ventana = window.open('', '', 'height=600,width=800');
    ventana.document.write('<html><head><title>Documento Interno - Pardos Chicken</title>');
    ventana.document.write('<style>body{font-family:Arial,sans-serif;padding:20px;}</style>');
    ventana.document.write('</head><body>');
    ventana.document.write(contenido);
    ventana.document.write('</body></html>');
    ventana.document.close();
    ventana.print();
}

// =============================================================================
// I. GESTIÓN DE RESERVAS (HUO06, HUO07, HUO08, HUO05)
// =============================================================================

/**
 * Función: renderGestionReservas (HUO06)
 * Propósito: Listar y filtrar todas las reservas del sistema.
 */
async function renderGestionReservas() {
    setPageTitle('📅 Gestión de Reservas', 'fa-list-alt');
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-filter"></i> Filtros</h3>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Estado</label>
                    <select id="filtro-estado" onchange="cargarReservas()">
                        <option value="">Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="confirmada">Confirmada</option>
                        <option value="cancelada">Cancelada</option>
                        <option value="pagada">Pagada</option>
                        <option value="rechazada">Rechazada</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-calendar-alt"></i> Lista de Reservas</h3>
                <span class="badge badge-pendiente" id="total-reservas">Cargando...</span>
            </div>
            <div class="table-container" id="tabla-reservas">${showLoader()}</div>
        </div>`;
    cargarReservas();
}

async function cargarReservas() {
    const estado = document.getElementById('filtro-estado').value;
    const container = document.getElementById('tabla-reservas');
    container.innerHTML = showLoader();
    
    try {
        let url = '/reservas';
        if (estado) url += `?estado=${estado}`;
        const reservas = await fetchAPI(url);
        
        document.getElementById('total-reservas').textContent = `${reservas.length} reservas`;
        
        if (reservas.length === 0) {
            container.innerHTML = '<p class="text-center" style="padding: 40px; color: #666;">No hay reservas registradas</p>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead><tr><th>ID</th><th>Fecha/Hora</th><th>Cliente</th><th>DNI</th><th>Mesa</th><th>Pers.</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${reservas.map(r => `
                        <tr>
                            <td><strong>#${r.id_reserva}</strong></td>
                            <td>${r.fecha}<br><strong>${r.hora}</strong></td>
                            <td>${r.cliente}</td>
                            <td>${r.dni || '-'}</td>
                            <td>Mesa ${r.mesa}</td>
                            <td>${r.personas}</td>
                            <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
                            <td>
                                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                                    ${r.estado === 'pendiente' ? `
                                        <button class="btn btn-success btn-sm" onclick="cambiarEstadoReserva(${r.id_reserva}, 'confirmada')" title="Confirmar"><i class="fas fa-check"></i></button>
                                        <button class="btn btn-danger btn-sm" onclick="cambiarEstadoReserva(${r.id_reserva}, 'rechazada')" title="Rechazar"><i class="fas fa-times"></i></button>
                                    ` : ''}
                                    ${['pendiente', 'confirmada'].includes(r.estado) ? `
                                        <button class="btn btn-info btn-sm" onclick="editarReservaLider(${r.id_reserva})" title="Editar (HUO07)"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-warning btn-sm" onclick="cambiarEstadoReserva(${r.id_reserva}, 'cancelada')" title="Cancelar"><i class="fas fa-ban"></i></button>
                                    ` : ''}
                                    ${['cancelada', 'rechazada'].includes(r.estado) ? `
                                        <button class="btn btn-danger btn-sm" onclick="eliminarReserva(${r.id_reserva})" title="Eliminar (HUO08)"><i class="fas fa-trash"></i></button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    } catch (e) {
        container.innerHTML = '<p class="text-center" style="color: var(--danger);">Error al cargar reservas</p>';
    }
}

function cambiarEstadoReserva(id, nuevoEstado) {
    const mensajes = {
        'confirmada': '¿Confirmar esta reserva?',
        'rechazada': '¿Rechazar esta reserva?',
        'cancelada': '¿Cancelar esta reserva?'
    };
    const iconos = {
        'confirmada': ['fa-check-circle', 'var(--success)'],
        'rechazada': ['fa-times-circle', 'var(--danger)'],
        'cancelada': ['fa-ban', 'var(--warning)']
    };
    
    showConfirm('Cambiar Estado', mensajes[nuevoEstado], async () => {
        try {
            await fetchAPI(`/reservas/${id}`, { method: 'PUT', body: JSON.stringify({ estado: nuevoEstado }) });
            showToast(`Reserva ${nuevoEstado} correctamente`, 'success');
            cargarReservas();
        } catch (e) {
             showToast('Error al cambiar estado', 'error');
        }
    }, iconos[nuevoEstado][0], iconos[nuevoEstado][1]);
}

async function editarReservaLider(id) {
    try {
        const reserva = await fetchAPI(`/reservas/${id}`);
        const mesas = await fetchAPI('/mesas');
        
        const bodyHtml = `
            <h4 style="color: var(--primary); margin-bottom: 15px;"><i class="fas fa-edit"></i> Editar Reserva #${id}</h4>
            <div class="form-group">
                <label><i class="fas fa-calendar"></i> Fecha</label>
                <input type="date" id="edit-fecha" value="${reserva.fecha}">
            </div>
            <div class="form-group">
                <label><i class="fas fa-clock"></i> Hora</label>
                <input type="time" id="edit-hora" value="${reserva.hora}">
            </div>
            <div class="form-group">
                <label><i class="fas fa-users"></i> Cantidad de Personas</label>
                <input type="number" id="edit-cantidad" value="${reserva.cantidad}" min="1">
            </div>
            <div class="form-group">
                <label><i class="fas fa-chair"></i> Mesa</label>
                <select id="edit-mesa">
                    ${mesas.map(m => `<option value="${m.id}" ${m.id == reserva.id_mesa ? 'selected' : ''}>Mesa ${m.numero} - ${m.tipo} (${m.capacidad} pers.)</option>`).join('')}
                </select>
            </div>
            <hr style="margin: 20px 0;">
            <h4><i class="fas fa-user"></i> Datos del Cliente</h4>
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="edit-nombre" value="${reserva.cliente?.nombre || ''}">
            </div>
            <div class="form-group">
                <label>Apellido</label>
                <input type="text" id="edit-apellido" value="${reserva.cliente?.apellido || ''}">
            </div>
            <div class="form-group">
                <label>Teléfono</label>
                <input type="tel" id="edit-telefono" value="${reserva.cliente?.telefono || ''}">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="edit-email" value="${reserva.cliente?.email || ''}">
            </div>`;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancelar</button>
            <button class="btn btn-success" onclick="guardarEdicionReservaLider(${id})"><i class="fas fa-save"></i> Guardar Cambios</button>`;
        
        openModal(`Editar Reserva #${id}`, bodyHtml, footerHtml);
    } catch (e) {
        showToast('Error al cargar datos de reserva', 'error');
    }
}

async function guardarEdicionReservaLider(id) {
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
        showToast('✅ Reserva actualizada correctamente', 'success');
        closeModal();
        cargarReservas();
    } catch (e) {
        showToast('Error al guardar edición', 'error');
    }
}

function eliminarReserva(id) {
    showConfirm('🗑️ Eliminar Reserva', '¿Está seguro de eliminar permanentemente esta reserva?\n\n¡Esta acción es IRREVERSIBLE y eliminará también el pedido si existe!', async () => {
        try {
            // El backend se encargará de borrar la reserva, la comanda y liberar la mesa.
            await fetchAPI(`/reservas/${id}`, { method: 'DELETE' });
            showToast('✅ Reserva y pedidos asociados eliminados correctamente. Mesa liberada.', 'success');
            cargarReservas();
        } catch (e) {
            showToast('❌ Error al eliminar reserva', 'error');
        }
    }, 'fa-trash-alt', 'var(--danger)');
}


// =============================================================================
// II. SUPERVISIÓN DE PEDIDOS Y COMANDAS (HUO10 & Admin)
// =============================================================================

/**
 * Función: renderModificarComandaLider (HUO10)
 * Propósito: Muestra un listado de SOLO las comandas creadas por Mozo (Mesa Directa).
 * Incluye acciones de Editar (Modal) y Anular (Liberar Mesa).
 */
async function renderModificarComandaLider() {
    setPageTitle('✏️ Modificar Comandas (Mozo/Admin)', 'fa-edit');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();

    try {
        const comandas = await fetchAPI('/comandas');
        
        // FILTRO: Solo comandas activas SIN id_reserva (Pedidos de Mozo)
        const activasMozo = comandas.filter(c => 
            ['pendiente', 'completada'].includes(c.estado) &&
            (!c.id_reserva || c.id_reserva === null)
        );

        if (activasMozo.length === 0) {
            content.innerHTML = `<div class="card text-center" style="padding: 60px;"><i class="fas fa-check-circle" style="font-size: 4em; color: var(--success);"></i><h3 style="margin-top: 20px;">No hay comandas de Mozo activas para modificar</h3></div>`;
            return;
        }

        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-list"></i> Comandas de Mozo Activas para Edición</h3>
                    <span class="badge badge-warning">${activasMozo.length} comandas</span>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>ID</th><th>Mesa</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
                        <tbody>
                            ${activasMozo.map(c => `
                                <tr>
                                    <td><strong>#${c.id}</strong></td>
                                    <td><span class="badge badge-warning">Mesa ${c.mesa}</span></td>
                                    <td>${c.nombre_cliente || 'General'}</td>
                                    <td><strong>S/ ${c.total.toFixed(2)}</strong></td>
                                    <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
                                    <td>
                                        <button class="btn btn-info btn-sm" onclick="editarComandaMozoLider(${c.id}, 'mesa')"><i class="fas fa-edit"></i> Editar</button>
                                        <button class="btn btn-danger btn-sm" onclick="eliminarComandaDefinitivo(${c.id}, ${c.mesa})"><i class="fas fa-trash"></i> Anular/Liberar</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = '<div class="card text-center">Error al cargar comandas.</div>';
    }
}

// [NUEVO] ESTADO GLOBAL para el filtro de la tabla de Gestión de Pedidos
let PEDIDO_FILTRO_ESTADO = ''; // 'pendiente', 'completada', 'pagada', 'cancelada'

/**
 * Función Principal: renderGestionPedidosLider
 * Propósito: Renderiza la interfaz de auditoría y gestión de todos los pedidos de Mozo.
 */
async function renderGestionPedidosLider() {
    setPageTitle('🛒 Gestión de Pedidos (Mozo)', 'fa-list');
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-filter"></i> Filtros de Pedidos de Mozo</h3>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Estado</label>
                    <select id="filtro-pedido-estado" onchange="PEDIDO_FILTRO_ESTADO = this.value; cargarPedidosMozoLider()">
                        <option value="">Todos</option>
                        <option value="pendiente">Pendiente (Cocina)</option>
                        <option value="completada">Completada (Lista)</option>
                        <option value="pagada">Pagada (Facturada)</option>
                        <option value="cancelada">Cancelada/Anulada</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-list-alt"></i> Lista de Pedidos de Mozo</h3>
                <span class="badge badge-pendiente" id="total-pedidos-mozo">Cargando...</span>
            </div>
            <div class="table-container" id="tabla-pedidos-mozo">${showLoader()}</div>
        </div>`;
    
    // Inicializar el filtro y cargar la tabla
    PEDIDO_FILTRO_ESTADO = document.getElementById('filtro-pedido-estado').value;
    cargarPedidosMozoLider();
}

/**
 * Función Asíncrona: cargarPedidosMozoLider
 * Propósito: Obtiene y renderiza solo las comandas de mozo (sin id_reserva) según el filtro de estado.
 */
async function cargarPedidosMozoLider() {
    const container = document.getElementById('tabla-pedidos-mozo');
    container.innerHTML = showLoader();
    
    try {
        let url = '/comandas';
        // El backend /comandas por defecto no devuelve pagadas. Si el filtro es 'todos' o 'pagadas', lo pedimos explícitamente.
        if (PEDIDO_FILTRO_ESTADO) {
            url += `?estado=${PEDIDO_FILTRO_ESTADO}`;
        }
        
        const comandas = await fetchAPI(url);
        
        // FILTRO LADO DEL CLIENTE: Solo comandas de Mozo (Mesa Directa, id_reserva es null/falso)
        const pedidosMozo = comandas.filter(c => 
            !c.id_reserva
        );
        
        document.getElementById('total-pedidos-mozo').textContent = `${pedidosMozo.length} pedidos`;
        
        if (pedidosMozo.length === 0) {
            container.innerHTML = '<p class="text-center" style="padding: 40px; color: #666;">No hay pedidos de mozo que coincidan con el filtro.</p>';
            return;
        }
        
        container.innerHTML = `
            <table>
                <thead><tr><th>ID</th><th>Mesa</th><th>Cliente</th><th>Fecha/Hora</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${pedidosMozo.map(c => `
                        <tr>
                            <td><strong>#${c.id}</strong></td>
                            <td>Mesa ${c.mesa}</td>
                            <td>${c.nombre_cliente || 'General'}</td>
                            <td>${c.fecha}<br><strong>${c.hora}</strong></td>
                            <td><strong>S/ ${c.total.toFixed(2)}</strong></td>
                            <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
                            <td>
                                <div style="display: flex; gap: 5px;">
                                    <button class="btn btn-info btn-sm" onclick="verDetalleComandaLider(${c.id})" title="Ver Detalles"><i class="fas fa-eye"></i></button>
                                    ${c.estado !== 'pagada' && c.estado !== 'cancelada' ? `<button class="btn btn-warning btn-sm" onclick="editarComandaMozoLider(${c.id}, 'mesa')" title="Editar Pedido"><i class="fas fa-edit"></i></button>` : ''}
                                    ${c.estado !== 'pagada' ? `<button class="btn btn-danger btn-sm" onclick="eliminarComandaDefinitivo(${c.id}, ${c.mesa})" title="Anular y Liberar Mesa"><i class="fas fa-trash"></i></button>` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
            
        // Restaurar el estado seleccionado en el filtro
        document.getElementById('filtro-pedido-estado').value = PEDIDO_FILTRO_ESTADO;
            
    } catch (e) {
        container.innerHTML = '<p class="text-center" style="color: var(--danger);">Error al cargar pedidos del mozo.</p>';
    }
}

/**
 * Función Asíncrona: verDetalleComandaLider (NUEVO)
 * Propósito: Muestra el detalle completo de la comanda en un modal (similar a Cajera).
 */
async function verDetalleComandaLider(idComanda) {
     try {
        const comanda = await fetchAPI(`/comandas/${idComanda}`);
        
        const itemsHtml = comanda.items.map(i => `
            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ddd; padding:5px 0;">
                <span>${i.cantidad}x ${i.nombre}</span>
                <span>S/ ${(i.cantidad * i.precio).toFixed(2)}</span>
            </div>
        `).join('');

        const total = comanda.items.reduce((sum, i) => sum + i.cantidad * i.precio, 0);

        const bodyHtml = `
            <h4 style="color: var(--primary); margin-bottom: 15px;">Mesa ${comanda.mesa} - Pedido #${comanda.id}</h4>
            <p><strong>Cliente:</strong> ${comanda.nombre_cliente || 'General'}</p>
            <p><strong>Estado:</strong> <span class="badge badge-${comanda.estado}">${comanda.estado.toUpperCase()}</span></p>
            <hr>
            <div style="max-height: 300px; overflow-y: auto;">
                ${itemsHtml}
            </div>
            <div style="margin-top: 15px; font-size: 1.2em; font-weight: bold; display: flex; justify-content: space-between; border-top: 2px solid #333; padding-top: 5px;">
                <span>TOTAL:</span><span>S/ ${total.toFixed(2)}</span>
            </div>
            ${comanda.observaciones ? `<div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;">Nota: ${comanda.observaciones}</div>` : ''}
        `;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
            ${comanda.estado !== 'pagada' && comanda.estado !== 'cancelada' ? `<button class="btn btn-warning" onclick="editarComandaMozoLider(${idComanda}, 'mesa');">Editar Pedido</button>` : ''}
            ${comanda.estado !== 'pagada' ? `<button class="btn btn-danger" onclick="eliminarComandaDefinitivo(${idComanda}, ${comanda.mesa}); closeModal();">Anular</button>` : ''}
        `;

        openModal(`Detalle de Pedido #${idComanda}`, bodyHtml, footerHtml);

    } catch (e) {
        showToast('Error al cargar detalles de la comanda', 'error');
    }
}

/**
 * Función Asíncrona: editarComandaMozoLider
 * Propósito: Cargar la comanda y abrir un modal de edición (similar al Mozo).
 */
async function editarComandaMozoLider(id, tipoOrigen) {
    try {
        const [comanda, menuData] = await Promise.all([fetchAPI(`/comandas/${id}`), fetchAPI('/menu')]);
        
        window.MENU_DATA = menuData; // Asignación global
        // Reconstruimos el carrito local con los datos de la BD
        window.CART = comanda.items.map(i => ({ 
            id_menu: i.id_menu, 
            nombre: i.nombre, 
            precio: i.precio, 
            cantidad: i.cantidad, 
            observaciones: i.observaciones 
        }));
        const cats = Object.keys(menuData);
        
        const bodyHtml = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <h4 style="color: var(--primary); margin-bottom: 10px;"><i class="fas fa-shopping-cart"></i> Items Actuales (Mesa ${comanda.mesa})</h4>
                <div id="modal-cart" style="padding-bottom: 10px; border-bottom: 1px solid #eee;"></div>
                
                <hr style="margin: 20px 0;">
                
                <h4 style="color: var(--primary); margin-bottom: 10px;"><i class="fas fa-plus-circle"></i> Agregar Productos</h4>
                <div class="menu-categories">
                    ${cats.map((c, i) => `<button class="category-btn ${i===0?'active':''}" onclick="cambiarCategoriaModalLider('${c}')">${c}</button>`).join('')}
                </div>
                <div class="menu-items" id="modal-menu" style="margin-top: 15px;"></div>
            </div>`;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancelar</button>
            <button class="btn btn-success" onclick="guardarCambiosComandaLider(${id}, '${tipoOrigen}')"><i class="fas fa-save"></i> Guardar Cambios</button>`;

        openModal(`Editar Pedido #${id}`, bodyHtml, footerHtml);
        
        actualizarModalLider();
        if(cats.length) cambiarCategoriaModalLider(cats[0]);
    } catch(e) {
        showToast('Error al cargar comanda para edición', 'error');
    }
}

/**
 * Función: actualizarModalLider
 * Propósito: Refresca la lista de items dentro del modal de edición del Líder.
 */
function actualizarModalLider() {
    const c = document.getElementById('modal-cart');
    if(c) c.innerHTML = window.CART.map((i,x)=>`
        <div class="cart-item" style="margin-bottom: 8px;">
            <div><strong>${i.cantidad}x</strong> ${i.nombre}</div>
            <div style="display:flex; gap:5px;">
                <button class="btn btn-sm" onclick="window.CART[${x}].cantidad--; if(window.CART[${x}].cantidad<=0) window.CART.splice(${x},1); actualizarModalLider()">-</button>
                <button class="btn btn-sm" onclick="window.CART[${x}].cantidad++; actualizarModalLider()">+</button>
                <button class="btn btn-danger btn-sm" onclick="window.CART.splice(${x},1);actualizarModalLider()"><i class="fas fa-times"></i></button>
            </div>
        </div>`).join('');
}

/**
 * Función: cambiarCategoriaModalLider
 * Propósito: Muestra el menú en el modal.
 */
function cambiarCategoriaModalLider(cat) {
    document.querySelectorAll('#modal-menu .category-btn').forEach(b => b.classList.toggle('active', b.textContent === cat));
    const c = document.getElementById('modal-menu');
    if(c) c.innerHTML = (window.MENU_DATA[cat]||[]).map(i=>`
        <div class="menu-item" onclick="window.CART.push({id_menu:${i.id}, nombre:'${i.nombre}', precio:${i.precio}, cantidad:1, observaciones:''});actualizarModalLider()">
            <div class="item-name">${i.nombre}</div>
            <div class="item-price">S/ ${i.precio.toFixed(2)}</div>
        </div>`).join('');
}

/**
 * Función Asíncrona: guardarCambiosComandaLider
 * Propósito: Envía los cambios de la comanda editada al servidor (PUT).
 */
async function guardarCambiosComandaLider(id, tipo) {
    if(window.CART.length===0) return showToast('El pedido no puede estar vacío', 'error');
    try {
        await fetchAPI(`/comandas/${id}`, { method: 'PUT', body: JSON.stringify({ items: window.CART }) });
        showToast('✅ Pedido actualizado', 'success');
        closeModal();
        // Recargar la vista de Modificar Comandas (Mozo/Admin)
        renderModificarComandaLider();
    } catch(e) { 
        showToast('Error al guardar', 'error'); 
    }
}

/**
 * Función: eliminarComandaDefinitivo (Admin Control)
 * Propósito: Anular una comanda de Mozo y liberar la mesa.
 */
function eliminarComandaDefinitivo(idComanda, mesaNum) {
    showConfirm(
        '🗑️ ANULAR COMANDA Y LIBERAR MESA',
        `¿Está SEGURO de anular la Comanda #${idComanda} de Mesa ${mesaNum} y liberar la mesa?\n\n¡Esta acción es IRREVERSIBLE!`,
        async () => {
            try {
                // DELETE /api/comandas/id borra el pedido y libera la mesa si no está ligada a reserva.
                await fetchAPI(`/comandas/${idComanda}`, { method: 'DELETE' });
                
                showToast(`✅ Comanda #${idComanda} anulada y Mesa ${mesaNum} liberada.`, 'success');
                renderModificarComandaLider(); // Recargar la vista
                
            } catch (e) {
                showToast('❌ Error al anular comanda', 'error');
            }
        },
        'fa-trash-alt',
        'var(--danger)'
    );
}

/**
 * Función: editarComandaLibre (Esta es la función usada por Cajera, pero debe mantenerse aquí
 * ya que está referenciada por renderCaja y otros)
 */
async function editarComandaLibre(idComanda) {
    showToast('Cargando interfaz de edición...', 'info');
    
    window.COMANDA_EDIT_ACTUAL_ID = idComanda;

    try {
        const comanda = await fetchAPI(`/comandas/${idComanda}`);
        const menuData = await fetchAPI('/menu');
        
        const mesas = await fetchAPI('/mesas');
        const mesaObj = mesas.find(m => m.id === comanda.id_mesa);
        comanda.mesa = mesaObj ? mesaObj.numero : 'Indefinida';
        
        window.MENU_DATA = menuData;
        window.CART = [];

        comanda.items.forEach(item => {
            window.CART.push({
                id_menu: item.id_menu,
                nombre: item.nombre,
                precio: parseFloat(item.precio),
                cantidad: parseInt(item.cantidad),
                observaciones: item.observaciones || ''
            });
        });
        
        if (typeof renderEdicionCaja === 'function') {
            renderEdicionCaja(idComanda, comanda);
        } else {
            showToast('Error: La función de edición de caja no está disponible.', 'error');
        }
        
    } catch (e) {
        showToast('❌ Error al cargar la comanda para edición', 'error');
    }
}


// =============================================================================
// III. CONTROL DE COMANDAS (COCINA PARA LÍDER)
// =============================================================================

async function renderPedidosMozoLider() {
    setPageTitle('🔥 Pedidos del Mozo (Cocina)', 'fa-fire-alt');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas');
        
        const comandasMozo = comandas.filter(c => 
            ['pendiente', 'completada'].includes(c.estado) &&
            (!c.id_reserva || c.id_reserva === null)
        );
        
        renderInterfazCocinaLider(content, comandasMozo, 'Mozo');
        
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar pedidos del mozo</div>';
    }
}

async function renderPedidosReservaLider() {
    setPageTitle('📅 Pedidos de Reservas (Cocina)', 'fa-calendar-check');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const [comandas, reservas] = await Promise.all([
            fetchAPI('/comandas'),
            fetchAPI('/reservas')
        ]);
        
        const pedidosReserva = comandas.filter(c => {
            if (!c.id_reserva) return false;
            const reservaAsociada = reservas.find(r => r.id_reserva === c.id_reserva);
            return reservaAsociada && ['confirmada', 'pendiente'].includes(reservaAsociada.estado);
        });
        
        const pedidosConDatos = pedidosReserva.map(c => {
            const reserva = reservas.find(r => r.id_reserva === c.id_reserva);
            return { 
                ...c, 
                cantidad_personas: reserva ? reserva.personas : '?',
                nombre_reserva: reserva ? reserva.cliente : 'Cliente Reserva'
            };
        });

        renderInterfazCocinaLider(content, pedidosConDatos, 'Reserva');
        
    } catch (e) {
        console.error(e);
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar pedidos de reserva</div>';
    }
}

function renderInterfazCocinaLider(container, listaComandas, tipoOrigen) {
    if (listaComandas.length === 0) {
        container.innerHTML = `
            <div class="card text-center" style="padding: 60px;">
                <i class="fas fa-check-double" style="font-size: 4em; color: var(--success);"></i>
                <h3 style="margin-top: 20px; color: var(--success);">¡Todo Listo!</h3>
                <p style="color: #666;">No hay pedidos de ${tipoOrigen} pendientes en este momento.</p>
                <button class="btn btn-primary mt-3" onclick="${tipoOrigen === 'Mozo' ? 'renderPedidosMozoLider()' : 'renderPedidosReservaLider()'}">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </div>`;
        return;
    }

    const pendientes = listaComandas.filter(c => c.estado === 'pendiente');
    const listos = listaComandas.filter(c => c.estado === 'completada');

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
            <div class="card" style="text-align: center; padding: 20px; background: #fff3cd; border-left: 5px solid #ffc107;">
                <h2 style="margin: 0; color: #856404; font-size: 2.5em;">${pendientes.length}</h2>
                <p style="margin: 5px 0 0; color: #856404; font-weight: bold;">🔥 EN PREPARACIÓN</p>
            </div>
            <div class="card" style="text-align: center; padding: 20px; background: #d4edda; border-left: 5px solid #28a745;">
                <h2 style="margin: 0; color: #155724; font-size: 2.5em;">${listos.length}</h2>
                <p style="margin: 5px 0 0; color: #155724; font-weight: bold;">✅ LISTOS PARA SERVIR</p>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            ${listaComandas.map(c => renderComandaCardLider(c, tipoOrigen)).join('')}
        </div>
    `;
}

function renderComandaCardLider(c, tipoOrigen) {
    const esPendiente = c.estado === 'pendiente';
    const colorEstado = esPendiente ? '#ffc107' : '#28a745';
    const textoEstado = esPendiente ? 'EN PROCESO' : 'TERMINADO';
    
    const infoExtra = c.cantidad_personas ?
        `<span style="background: #e3f2fd; color: #0d47a1; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; margin-left: 10px;">
            <i class="fas fa-users"></i> ${c.cantidad_personas} pers.
           </span>` : '';

    return `
        <div class="card" style="border-top: 5px solid ${colorEstado}; padding: 0; overflow: hidden;">
            <div style="padding: 15px; background: #f8f9fa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; color: var(--primary); font-size: 1.4em;">Mesa ${c.mesa}</h3>
                    <div style="display: flex; align-items: center; margin-top: 5px;">
                        <span style="font-size: 0.9em; color: #666;">#${c.id}</span>
                        ${infoExtra}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="background: ${colorEstado}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8em; font-weight: bold;">
                        ${textoEstado}
                    </span>
                    <div style="font-size: 0.85em; color: #888; margin-top: 5px;">${c.hora}</div>
                </div>
            </div>
            
            <div style="padding: 15px;">
                ${c.nombre_cliente ? `<p style="margin: 0 0 10px; font-weight: bold; color: #333;"><i class="fas fa-user"></i> ${c.nombre_cliente}</p>` : ''}
                
                <div style="background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 10px;">
                    ${c.items.map(i => `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 8px;">
                            <div style="flex: 1;">
                                <span style="font-weight: bold; font-size: 1.1em; color: var(--primary); margin-right: 5px;">${i.cantidad}x</span>
                                <span style="font-size: 1.05em;">${i.nombre}</span>
                                ${i.observaciones ? `
                                    <div style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; margin-top: 4px;">
                                        <i class="fas fa-exclamation-circle"></i> ${i.observaciones}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${c.observaciones_general ? `
                    <div style="margin-top: 10px; padding: 10px; background: #ffebee; color: #c62828; border-radius: 8px; font-size: 0.9em;">
                        <strong>Nota General:</strong> ${c.observaciones_general}
                    </div>
                ` : ''}
            </div>
            
            <div style="padding: 15px; background: #f8f9fa; border-top: 1px solid #eee; display: flex; gap: 8px; justify-content: space-between;">
                ${esPendiente ? `
                    <button class="btn btn-success btn-sm" onclick="marcarListoLider(${c.id}, '${tipoOrigen}')" style="font-weight: bold; padding: 12px 10px;">
                        <i class="fas fa-check-circle"></i> LISTO
                    </button>
                ` : '<button class="btn btn-secondary btn-sm" disabled>LISTO</button>'}
                <button class="btn btn-warning btn-sm" onclick="editarComandaLibre(${c.id})"><i class="fas fa-edit"></i> Modif</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarComandaDefinitivo(${c.id}, ${c.mesa})"><i class="fas fa-trash"></i> Elim</button>
            </div>
        </div>
    `;
}

function marcarListoLider(id, tipoOrigen) {
    showConfirm(
        'Confirmar Preparación',
        '¿Confirma que todos los platos de esta mesa están listos para servir?',
        async () => {
            try {
                await fetchAPI(`/comandas/${id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ estado: 'completada' }) 
                });
                showToast('✅ ¡Oído cocina! Pedido listo.', 'success');
                
                if (tipoOrigen === 'Mozo') renderPedidosMozoLider();
                else renderPedidosReservaLider();
                
            } catch (e) {
                showToast('Error al actualizar pedido', 'error');
            }
        },
        'fa-fire',
        'var(--success)'
    );
}


// =============================================================================
// IV. CAJA Y PAGOS (HUO12, HUO14)
// =============================================================================

async function renderCaja() {
    setPageTitle('Caja - Pagos y Comprobantes', 'fa-cash-register');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas');
        const porCobrar = comandas.filter(c => c.estado === 'completada');
        
        content.innerHTML = `
            <div class="caja-layout">
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-list"></i> Comandas por Cobrar</h3>
                            <span class="badge badge-completada">${porCobrar.length} pendientes</span>
                        </div>
                        <div id="lista-cobrar">
                            ${porCobrar.length === 0 ? 
                                '<p class="text-center" style="padding: 30px; color: #666;"><i class="fas fa-check-circle" style="font-size: 2em;"></i><br>No hay cuentas pendientes</p>' :
                                porCobrar.map(c => `
                                    <div class="cart-item" style="cursor: pointer;" onclick="seleccionarCuenta(${c.id})">
                                        <div class="cart-item-info">
                                            <div class="cart-item-name"><i class="fas fa-chair"></i> Mesa ${c.mesa}</div>
                                            <div class="cart-item-price">${c.nombre_cliente || 'Cliente General'} - ${c.hora}</div>
                                        </div>
                                        <div>
                                            <strong style="color: var(--primary);">S/ ${c.total.toFixed(2)}</strong>
                                        </div>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                </div>
                
                <div>
                    <div class="card" id="panel-pago">
                        <div class="card-header">
                            <h3><i class="fas fa-receipt"></i> Detalle de Cuenta</h3>
                        </div>
                        <div class="text-center" style="padding: 40px; color: #999;">
                            <i class="fas fa-hand-pointer" style="font-size: 3em;"></i>
                            <p style="margin-top: 15px;">Seleccione una cuenta de la izquierda para cobrar</p>
                        </div>
                    </div>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar caja</div>';
    }
}

async function seleccionarCuenta(idComanda) {
    const contentArea = document.getElementById('content-area');
    const isEditing = contentArea.querySelector('.caja-layout') === null;

    if (!isEditing) {
        const panel = document.getElementById('panel-pago');
        panel.innerHTML = `<div class="card-header"><h3><i class="fas fa-receipt"></i> Cargando...</h3></div>${showLoader()}`;
    } else {
         renderCaja();
         setTimeout(() => seleccionarCuenta(idComanda), 50);
         return;
    }
    
    try {
        const comandas = await fetchAPI('/comandas');
        const comandaActual = comandas.find(c => c.id === idComanda);
        if (!comandaActual || comandaActual.estado === 'pagada') { renderCaja(); return; }
        
        const cuenta = await fetchAPI(`/cuentas/previsualizar/${idComanda}`);
        const reservas = await fetchAPI('/reservas');
        const hoy = new Date().toISOString().split('T')[0];
        const reservaVinculada = reservas.find(r => 
            r.id_mesa === comandaActual.id_mesa && r.fecha === hoy &&
            ['pendiente', 'confirmada'].includes(r.estado)
        );
        
        if (reservaVinculada && reservaVinculada.estado === 'pendiente') {
            document.getElementById('panel-pago').innerHTML = `<div style="padding: 40px; text-align: center;"><h3 style="color: var(--warning);">⚠️ Reserva Pendiente</h3><p>La Reserva #${reservaVinculada.id_reserva} debe ser confirmada antes de cobrar.</p><button class="btn btn-primary" onclick="renderConfirmarReservas()">Ir a Confirmaciones</button></div>`;
            return;
        }
        
        const idReservaSafe = reservaVinculada ? reservaVinculada.id_reserva : 'null';

        window.COMANDA_TEMPORAL_DATA = { id: idComanda, comanda: comandaActual };
        const panel = document.getElementById('panel-pago');

        panel.innerHTML = `
            <div class="card-header">
                <h3><i class="fas fa-receipt"></i> Mesa ${cuenta.mesa}</h3>
                <span class="badge badge-completada">Comanda #${idComanda}</span>
            </div>
            
            <div style="padding: 20px;">
                <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                    <div id="cuenta-items" style="max-height: 150px; overflow-y: auto;">
                        ${cuenta.items.map(item => `
                            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ddd; padding:5px 0;">
                                <span>${item.cantidad}x ${item.nombre}</span>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <strong>S/ ${item.subtotal.toFixed(2)}</strong>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="cuenta-total"><span>TOTAL</span><span>S/ ${cuenta.total.toFixed(2)}</span></div>
                </div>
                
                <hr style="margin: 10px 0;">
                
                <h4><i class="fas fa-file-invoice-dollar"></i> Datos de Comprobante</h4>
                
                <div class="form-row" style="margin-top: 15px;">
                    <div class="form-group">
                        <label>Tipo</label>
                        <select id="pago-tipo" onchange="toggleCamposComprobante()">
                            <option value="boleta">🧾 Boleta</option>
                            <option value="factura">📄 Factura</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Pago</label>
                        <select id="pago-metodo">
                            <option value="Efectivo">💵 Efectivo</option>
                            <option value="Tarjeta">💳 Tarjeta</option>
                            <option value="Yape">📱 Yape</option>
                            <option value="Plin">📱 Plin</option>
                        </select>
                    </div>
                </div>

                <div id="campos-boleta">
                    <div class="form-group">
                        <label>DNI (8 dígitos)</label>
                        <div style="display: flex; gap: 5px;">
                            <input type="text" id="pago-dni" maxlength="8" placeholder="DNI (opcional)" onkeyup="if(this.value.length===8) buscarClienteDNI()">
                            <button class="btn btn-info btn-sm" onclick="buscarClienteDNI()"><i class="fas fa-search"></i></button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Nombre Cliente</label>
                        <input type="text" id="pago-nombre" value="${comandaActual.nombre_cliente || ''}" placeholder="Cliente General">
                    </div>
                </div>

                <div id="campos-factura" class="hidden">
                    <div class="form-group">
                        <label>RUC (11 dígitos)</label>
                        <div style="display: flex; gap: 5px;">
                            <input type="text" id="pago-ruc" maxlength="11" placeholder="Ingrese RUC" onkeyup="if(this.value.length===11) buscarClienteRUC()">
                            <button class="btn btn-info btn-sm" onclick="buscarClienteRUC()"><i class="fas fa-search"></i></button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Razón Social</label>
                        <input type="text" id="pago-razon" placeholder="Nombre de la Empresa">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-info" onclick="imprimirPrecuenta(${idComanda})"><i class="fas fa-print"></i> Pre-cuenta</button>
                    <button class="btn btn-warning" onclick="editarComandaPagoFinalLider(${idComanda})"><i class="fas fa-edit"></i> Editar Pedido</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                    <button class="btn btn-danger" onclick="anularComandaCompletamente(${idComanda})"><i class="fas fa-trash"></i> Anular</button>
                    <button class="btn btn-success" onclick="procesarPago(${idComanda}, ${cuenta.total}, ${idReservaSafe})"><i class="fas fa-check"></i> COBRAR</button>
                </div>
            </div>`;
        toggleCamposComprobante();
    } catch (e) {
        document.getElementById('panel-pago').innerHTML = '<div class="text-center" style="color: var(--danger); padding: 20px;">❌ Error al cargar datos de la cuenta</div>';
    }
}

async function editarComandaPagoFinalLider(idComanda) {
    showToast('Cargando items para edición...', 'info');
    
    window.COMANDA_EDIT_ACTUAL_ID = idComanda;

    try {
        const comanda = await fetchAPI(`/comandas/${idComanda}`);
        const menuData = await fetchAPI('/menu');
        
        const mesas = await fetchAPI('/mesas');
        const mesaObj = mesas.find(m => m.id === comanda.id_mesa);
        comanda.mesa = mesaObj ? mesaObj.numero : 'Indefinida';
        
        window.MENU_DATA = menuData;
        window.CART = [];

        comanda.items.forEach(item => {
            window.CART.push({
                id_menu: item.id_menu,
                nombre: item.nombre,
                precio: parseFloat(item.precio),
                cantidad: parseInt(item.cantidad),
                observaciones: item.observaciones || ''
            });
        });
        
        if (typeof renderEdicionCaja === 'function') {
            renderEdicionCaja(idComanda, comanda);
        } else {
            showToast('Error: La función de edición no está disponible. Verifique cajera.js', 'error');
        }
        
    } catch (e) {
        showToast('❌ Error al cargar la comanda para edición', 'error');
    }
}

function toggleCamposComprobante() {
    const tipo = document.getElementById('pago-tipo').value;
    document.getElementById('campos-boleta').classList.toggle('hidden', tipo !== 'boleta');
    document.getElementById('campos-factura').classList.toggle('hidden', tipo !== 'factura');
}

async function buscarClienteDNI() {
    const dni = document.getElementById('pago-dni').value;
    if (dni.length !== 8) return;
    
    const inputNombre = document.getElementById('pago-nombre');
    inputNombre.placeholder = "Buscando...";
    inputNombre.value = "Buscando...";
    
    try {
        const data = await fetchAPI(`/consulta-dni/${dni}`);
        if (data.success) {
            inputNombre.value = `${data.nombres || ''} ${data.apellido_paterno || ''} ${data.apellido_materno || ''}`.trim();
            showToast('✅ Datos de DNI encontrados', 'success');
        } else {
            inputNombre.value = "";
            inputNombre.placeholder = "DNI no encontrado";
            showToast('⚠️ DNI no encontrado. Ingrese nombre manual.', 'warning');
        }
    } catch (e) {
        inputNombre.value = "";
        inputNombre.placeholder = "Error de conexión";
        showToast('Error en la búsqueda DNI', 'error');
    }
}

async function buscarClienteRUC() {
    const ruc = document.getElementById('pago-ruc').value;
    if (ruc.length !== 11) return;
    
    const inputRazon = document.getElementById('pago-razon');
    inputRazon.value = "Buscando...";
    
    // Simulación: Respuesta Sunat
    setTimeout(() => {
        if (ruc.startsWith('20')) {
             inputRazon.value = `RAZÓN SOCIAL PRUEBA RUC ${ruc.substring(0, 4)} S.A.C.`;
             showToast('✅ Razón Social Autocompletada', 'success');
        } else {
            inputRazon.value = "";
            showToast('⚠️ RUC no encontrado o no disponible en demo', 'warning');
        }
    }, 500);
}

// =============================================================================
// V. INFORMES Y ESTADÍSTICAS (Admin) - MODIFICADO
// =============================================================================

/**
 * Función: renderInformesLider
 * Propósito: Muestra el dashboard de métricas clave (Ventas, Reservas, Promedio).
 * * NOTA: Asignamos los valores devueltos por el backend (total_ventas, ventas_hoy, promedio_gasto)
 * a las variables locales y a la UI, asegurando que se muestren los valores correctos.
 */
async function renderInformesLider() {
    setPageTitle('📊 Informes y Estadísticas', 'fa-chart-bar');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        // 1. OBTENER DATOS
        const data = await fetchAPI('/informes'); 
        
        // --- MÉTRICAS GENERALES ---
        const totalReservas = data.reservas_total || 0;
        const totalVentas = data.total_ventas || 0;
        const ventasHoy = data.ventas_hoy || 0;
        const promedioGasto = data.promedio_gasto || 0; 

        // --- MÉTRICAS DESAGREGADAS
        const totalPedidosPagados = data.comandas_pagadas || 0;
        const ventasMozo = data.ventas_mozo || 0;
        const ventasReserva = data.ventas_reserva || 0;
        
        // 2. RENDERIZADO DEL DASHBOARD Y GRÁFICAS (SIN BLOQUE DE FILTRO CONFUSO)
        content.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 25px;">
                
                <div class="card" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-align: center;">
                    <i class="fas fa-calendar-alt" style="font-size: 2.5em; margin-bottom: 10px;"></i>
                    <h2 style="font-size: 2.5em; margin: 0;">${totalReservas}</h2>
                    <p style="opacity: 0.9; margin: 5px 0 0;">Total Reservas</p>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #11998e, #38ef7d); color: white; text-align: center;">
                    <i class="fas fa-money-bill-wave" style="font-size: 2em; margin-bottom: 10px;"></i>
                    <h2 style="font-size: 2em; margin: 0;">S/ ${totalVentas.toFixed(2)}</h2>
                    <p style="opacity: 0.9; margin: 5px 0 0;">Ventas Totales (Hist.)</p>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #eb3349, #f45c43); color: white; text-align: center;">
                    <i class="fas fa-calendar-day" style="font-size: 2.5em; margin-bottom: 10px;"></i>
                    <h2 style="font-size: 2em; margin: 0;">S/ ${ventasHoy.toFixed(2)}</h2>
                    <p style="opacity: 0.9; margin: 5px 0 0;">Ventas de Hoy</p>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #FFA500, #FF6347); color: white; text-align: center;">
                    <i class="fas fa-shopping-cart" style="font-size: 2.5em; margin-bottom: 10px;"></i>
                    <h2 style="font-size: 2em; margin: 0;">S/ ${promedioGasto.toFixed(2)}</h2>
                    <p style="opacity: 0.9; margin: 5px 0 0;">Promedio Gasto/Cliente</p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div class="card" style="background: #3498db; color: white; text-align: center; border-radius: 8px;">
                    <i class="fas fa-file-invoice" style="font-size: 2.0em; margin-bottom: 10px;"></i>
                    <h2 style="font-size: 2.2em; margin: 0;">${totalPedidosPagados}</h2>
                    <p style="opacity: 0.9; margin: 5px 0 0;">Total Pedidos Pagados</p>
                </div>
                
                <div class="card" style="background: #e74c3c; color: white; text-align: center; border-radius: 8px;">
                    <i class="fas fa-chair" style="font-size: 2.0em; margin-bottom: 10px;"></i>
                    <h2 style="font-size: 2em; margin: 0;">S/ ${ventasMozo.toFixed(2)}</h2>
                    <p style="opacity: 0.9; margin: 5px 0 0;">Ventas Mozo (Mesa Directa)</p>
                </div>

                <div class="card" style="background: #f1c40f; color: #333; text-align: center; border-radius: 8px;">
                    <i class="fas fa-calendar-alt" style="font-size: 2.0em; margin-bottom: 10px;"></i>
                    <h2 style="font-size: 2em; margin: 0;">S/ ${ventasReserva.toFixed(2)}</h2>
                    <p style="opacity: 0.9; margin: 5px 0 0;">Ventas por Reserva</p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-chart-line"></i> Análisis de Tendencias y Canales</h3>
                    <button class="btn btn-primary btn-sm" onclick="renderInformesLider()">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>
                
                <div style="display: flex; gap: 20px; padding: 20px;">
                    
                    <div style="flex: 1;"> 
                        <h4>Tendencia Histórica (Ventas Mensuales)</h4>
                        <canvas id="chart-mensual"></canvas>
                    </div>
                    
                    <div style="flex: 1;"> 
                        <h4>Distribución de Ingresos (Canal)</h4>
                        <canvas id="chart-composicion"></canvas>
                    </div>
                </div>
                
            </div>
            
            <div style="margin-top: 30px; padding: 15px; background: #e7f3ff; border-radius: 8px; border-left: 4px solid var(--info);">
                <p style="margin: 0; color: #004085;">
                    <i class="fas fa-info-circle"></i> Los gráficos muestran la tendencia histórica del restaurante.
                </p>
            </div>`;
        
        // 3. DIBUJAR GRÁFICOS (Se ejecuta después de renderizar el HTML)
        setTimeout(() => {
            if (typeof renderGraficos === 'function') {
                renderGraficos(data); 
            } else {
                // Mensaje de error si Chart.js no fue cargado
                document.getElementById('chart-mensual').innerHTML = '<p style="color: red;">Error: Librería Chart.js no cargada.</p>';
            }
        }, 100);

        // 4. Autorefresh (se mantiene)
        setTimeout(() => {
            if (document.getElementById('page-title')?.textContent?.includes('Estadísticas')) {
                renderInformesLider();
            }
        }, 30000);
        
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">❌ Error al cargar informes. <button class="btn btn-primary mt-3" onclick="renderInformesLider()">Reintentar</button></div>';
    }
}

/**
 * Función: renderGraficos (Depende de Chart.js)
 * @param {Object} data - Datos del endpoint /api/informes
 */
function renderGraficos(data) {
    if (typeof Chart === 'undefined' || !document.getElementById('chart-mensual')) {
        return; 
    }

    // Nombres de meses en español (para hacer el gráfico más legible)
    const nombreMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // 1. Gráfico de Tendencia Mensual (Barras)
    const ventasPorMes = data.ventas_por_mes || {};
    const etiquetas = Object.keys(ventasPorMes).sort(); 
    const valores = etiquetas.map(mes => ventasPorMes[mes]); 
    
    new Chart(document.getElementById('chart-mensual'), {
        type: 'bar',
        data: {
            // Convertir 'YYYY-MM' a nombre del mes (ej. '09' -> 'Sep')
            labels: etiquetas.map(l => {
                const mesIndex = parseInt(l.substring(5)) - 1;
                return nombreMeses[mesIndex] || l.substring(5);
            }), 
            datasets: [{
                label: 'Ventas (S/)',
                data: valores,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: { 
            responsive: true, 
            aspectRatio: 1.5, // Hace que la gráfica de barras sea más ancha y menos alta.
            scales: { 
                y: { beginAtZero: true, title: { display: true, text: 'Monto (S/)' } },
                x: { title: { display: true, text: 'Mes' } }
            } 
        }
    });

    // 2. Gráfico de Composición (Anillo/Doughnut)
    const ventasMozo = data.ventas_mozo || 0;
    const ventasReserva = data.ventas_reserva || 0;

    new Chart(document.getElementById('chart-composicion'), {
        type: 'doughnut', 
        data: {
            labels: [`Mozo: S/ ${ventasMozo.toFixed(2)}`, `Reserva: S/ ${ventasReserva.toFixed(2)}`],
            datasets: [{
                data: [ventasMozo, ventasReserva],
                backgroundColor: ['#e74c3c', '#f1c40f'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            aspectRatio: 1.5, // Hace que la gráfica de dona se ajuste en tamaño.
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: `Total Canal: S/ ${(ventasMozo + ventasReserva).toFixed(2)}` }
            }
        }
    });
}

function actualizarFiltroVentas(tipo) {
    VENTA_FILTRO_TIPO = tipo;
    const input = document.getElementById('input-filtro-valor');
    if (input) {
        if (tipo === 'dia') {
            input.type = 'date';
            VENTA_FILTRO_VALOR = new Date().toISOString().split('T')[0];
        } else if (tipo === 'mes') {
            input.type = 'month'; // Tipo correcto para selector de mes
            VENTA_FILTRO_VALOR = new Date().toISOString().substring(0, 7);
        } else if (tipo === 'anual') {
            input.type = 'number';
            input.placeholder = 'Ej: 2024';
            VENTA_FILTRO_VALOR = new Date().getFullYear().toString();
        }
        input.value = VENTA_FILTRO_VALOR;
    }
}
function actualizarFiltroValor(valor) {
    VENTA_FILTRO_VALOR = valor;
}

async function renderConfirmarReservas() {
    setPageTitle('Confirmar Reservas', 'fa-clipboard-check');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const reservas = await fetchAPI('/reservas?estado=pendiente');
        
        if (reservas.length === 0) {
            content.innerHTML = `
                <div class="card text-center" style="padding: 60px;">
                    <i class="fas fa-check-circle" style="font-size: 4em; color: var(--success);"></i>
                    <h3 style="margin-top: 20px; color: var(--success);">¡Todo confirmado!</h3>
                    <p style="color: #666;">No hay reservas pendientes de confirmación</p>
                </div>`;
            return;
        }
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-clock"></i> Reservas Pendientes de Confirmación</h3>
                    <span class="badge badge-pendiente">${reservas.length} pendientes</span>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Fecha/Hora</th>
                                <th>Cliente</th>
                                <th>DNI</th>
                                <th>Teléfono</th>
                                <th>Mesa</th>
                                <th>Personas</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reservas.map(r => `
                                <tr>
                                    <td><strong>#${r.id_reserva}</strong></td>
                                    <td>${r.fecha}<br><strong>${r.hora}</strong></td>
                                    <td>${r.cliente}</td>
                                    <td>${r.dni}</td>
                                    <td>${r.telefono || '-'}</td>
                                    <td><span class="badge badge-confirmada">Mesa ${r.mesa}</span></td>
                                    <td>${r.personas}</td>
                                    <td>
                                        <button class="btn btn-success btn-sm" onclick="confirmarReservaCajera(${r.id_reserva})">
                                            <i class="fas fa-check"></i> Confirmar
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="rechazarReservaCajera(${r.id_reserva})">
                                            <i class="fas fa-times"></i> Rechazar
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">❌ Error al cargar reservas pendientes</div>';
    }
}

function confirmarReservaCajera(id) {
    showConfirm(
        'Confirmar Reserva',
        '¿Confirmar esta reserva? El cliente podrá proceder con su visita.',
        async () => {
            try {
                await fetchAPI(`/reservas/${id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ estado: 'confirmada' }) 
                });
                showToast('✅ Reserva confirmada. El cliente puede proceder.', 'success');
                renderConfirmarReservas();
            } catch (e) {
                showToast('❌ Error al confirmar reserva', 'error');
            }
        }, 
        'fa-check-circle',
        'var(--success)'
    );
}

function rechazarReservaCajera(id) {
    showConfirm(
        'Rechazar Reserva',
        '¿Está seguro de rechazar esta reserva? Esta acción notificará al cliente.',
        async () => {
            try {
                await fetchAPI(`/reservas/${id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ estado: 'rechazada' }) 
                });
                showToast('⚠️ Reserva rechazada correctamente', 'warning');
                renderConfirmarReservas();
            } catch (e) {
                showToast('❌ Error al rechazar reserva', 'error');
            }
        }, 
        'fa-times-circle',
        'var(--danger)'
    );
}

// =============================================================================
// VI. CONTROL DE MESAS Y DISPONIBILIDAD (MEJORADO)
// =============================================================================

/**
 * Función: renderMesasConPedidosLider (Ahora es Disponibilidad Total)
 * Propósito: Muestra el estado de las mesas en un rango de fecha y hora.
 */
async function renderMesasConPedidosLider() {
    setPageTitle('🪑 Disponibilidad de Mesas', 'fa-chair');
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
                    <button class="btn btn-primary" onclick="buscarMesasDisponiblesLider()">
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
    buscarMesasDisponiblesLider();
}

/**
 * Función: buscarMesasDisponiblesLider
 * Propósito: Consulta al backend qué mesas están libres en una fecha/hora específica.
 */
async function buscarMesasDisponiblesLider() {
    const fecha = document.getElementById('disp-fecha').value;
    const hora = document.getElementById('disp-hora').value;
    const grid = document.getElementById('mesas-grid');
    grid.innerHTML = showLoader();
    
    try {
        const [mesasTotal, mesasDisponibles] = await Promise.all([
            fetchAPI('/mesas'),
            fetchAPI(`/mesas/disponibles?fecha=${fecha}&hora=${hora}`)
        ]);
        
        // IDs de mesas disponibles
        const idsDisponibles = new Set(mesasDisponibles.map(m => m.id));
        
        document.getElementById('count-mesas').textContent = `${mesasDisponibles.length} mesas disponibles`;
        
        if (mesasTotal.length === 0) {
            grid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; padding: 40px; color: #666;"><i class="fas fa-exclamation-circle"></i> No hay mesas registradas</p>';
            return;
        }
        
        grid.innerHTML = mesasTotal.map(m => {
            const disponible = idsDisponibles.has(m.id);
            const color = disponible ? '#28a745' : '#dc3545';
            const bgColor = disponible ? '#e6f9e9' : '#f8d7da';
            const estadoKey = disponible ? 'libre' : 'ocupada';

            return `
                <div class="mesa-card ${disponible ? 'disponible' : 'ocupada'}" 
                     style="border-top: 5px solid ${color}; background: ${bgColor}; cursor: default;"
                     title="${disponible ? 'Disponible' : 'Ocupada por Reserva o Comanda'}">
                    
                    <div class="mesa-numero" style="color: ${color};">${m.numero}</div>
                    <div class="mesa-info">
                        <span class="badge" style="background: ${color}; color: white;">${m.tipo}</span>
                        <div style="margin-top: 8px; font-size: 0.85em; color: #666;">
                            <i class="fas fa-map-marker-alt"></i> ${m.ubicacion}
                        </div>
                    </div>
                    <div class="mesa-capacidad"><i class="fas fa-users"></i> ${m.capacidad} personas</div>
                    
                    <div style="margin-top: 15px; padding: 5px; border-radius: 4px; text-align: center; font-weight: bold; color: ${color}; border: 1px solid ${color}; font-size: 0.9em;">
                        ${disponible ? 'DISPONIBLE' : 'OCUPADA'}
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        grid.innerHTML = '<p class="text-center" style="color: var(--danger);">Error al cargar mesas</p>';
    }
}

// ==================== ADMINISTRACIÓN DEL SISTEMA ====================

/**
 * Función: renderAdmin
 * Propósito: Muestra opciones de configuración y reseteo de la BD.
 */
function renderAdmin() {
    setPageTitle('⚙️ Administración del Sistema', 'fa-cog');
    const content = document.getElementById('content-area');
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-database"></i> Base de Datos</h3>
            </div>
            <p style="margin-bottom: 20px; color: #666;">Esta acción **eliminará** todos los datos actuales y creará datos de prueba nuevos. Usar con extrema precaución.</p>
            <button class="btn btn-danger" onclick="resetearBD()">
                <i class="fas fa-sync-alt"></i> Resetear y Poblar Base de Datos
            </button>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-info-circle"></i> Información del Sistema</h3>
            </div>
            <table>
                <tr><td><strong>Sistema</strong></td><td>Pardos Chicken - Gestión Integral</td></tr>
                <tr><td><strong>Versión</strong></td><td>2.0.0</td></tr>
                <tr><td><strong>Usuario Actual</strong></td><td>${CURRENT_USER} (${CURRENT_ROLE})</td></tr>
            </table>
        </div>`;
}

/**
 * Función: resetearBD
 * Propósito: Muestra la confirmación para repoblar la base de datos.
 */
function resetearBD() {
    showConfirm('⚠️ Resetear Base de Datos', '¿Está seguro? Se eliminarán TODOS los datos de reservas, pedidos y pagos.', async () => {
        try {
            showToast('Procesando...', 'info');
            const res = await fetchAPI('/admin/seed', { method: 'POST' });
            showToast(res.message, 'success');
        } catch (e) {
            showToast('Error al resetear BD', 'error');
        }
    }, 'fa-exclamation-triangle', 'var(--danger)');
}