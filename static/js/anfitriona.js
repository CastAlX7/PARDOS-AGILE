// ==================== MÓDULO ANFITRIONA DE BIENVENIDA ====================
// HUO01, HUO02, HUO03, HUO04, HUO05, TOMAR PEDIDO

let CART = [];
let MENU_DATA = {};

// HUO01, HUO02: Consultar Disponibilidad
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

async function buscarMesasDisponibles() {
    const fecha = document.getElementById('disp-fecha').value;
    const hora = document.getElementById('disp-hora').value;
    const grid = document.getElementById('mesas-grid');
    grid.innerHTML = showLoader();
    
    try {
        const mesas = await fetchAPI(`/mesas/disponibles?fecha=${fecha}&hora=${hora}`);
        document.getElementById('count-mesas').textContent = `${mesas.length} mesas disponibles`;
        
        if (mesas.length === 0) {
            grid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; padding: 40px; color: #666;"><i class="fas fa-exclamation-circle"></i> No hay mesas disponibles para esta fecha y hora</p>';
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

// HUO03, HUO05: Nueva Reserva
async function renderNuevaReserva(mesaId = null, mesaNum = null) {
    setPageTitle('Registrar Nueva Reserva', 'fa-plus-circle');
    const content = document.getElementById('content-area');
    
    let mesasOptions = '<option value="">Seleccione una mesa...</option>';
    try {
        const mesas = await fetchAPI('/mesas/disponibles');
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
                <button class="btn btn-success" onclick="crearReserva()"><i class="fas fa-save"></i> Crear Reserva y Enviar a Cajera</button>
            </div>
        </div>`;
}

async function crearReserva() {
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
    
    if (!data.dni || data.dni.length !== 8) return showToast('El DNI debe tener 8 dígitos', 'error');
    if (!data.nombre) return showToast('El nombre es obligatorio', 'error');
    if (!data.fecha) return showToast('La fecha es obligatoria', 'error');
    if (!data.hora) return showToast('La hora es obligatoria', 'error');
    if (!data.id_mesa) return showToast('Debe seleccionar una mesa', 'error');
    
    showConfirm('Confirmar Reserva', '¿Desea crear esta reserva? Se enviará a Cajera para confirmación.', async () => {
        try {
            const res = await fetchAPI('/reservas', { method: 'POST', body: JSON.stringify(data) });
            showToast(res.message, 'success');
            renderDisponibilidad();
        } catch (e) {}
    }, 'fa-calendar-check', 'var(--success)');
}

// HUO04: Modificar Reserva
async function renderModificarReserva() {
    setPageTitle('Modificar Reserva', 'fa-edit');
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-search"></i> Buscar Reserva por DNI</h3>
            </div>
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
                                    <td><strong>#${r.id}</strong></td>
                                    <td>${r.fecha}</td>
                                    <td>${r.hora}</td>
                                    <td>Mesa ${r.mesa}</td>
                                    <td>${r.personas}</td>
                                    <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
                                    <td><button class="btn btn-info btn-sm" onclick="editarReserva(${r.id})"><i class="fas fa-edit"></i> Editar</button></td>
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

async function editarReserva(id) {
    try {
        const reserva = await fetchAPI(`/reservas/${id}`);
        const mesas = await fetchAPI('/mesas');
        
        const bodyHtml = `
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
                    ${mesas.map(m => `<option value="${m.id}" ${m.id == reserva.id_mesa ? 'selected' : ''}>Mesa ${m.numero} - ${m.tipo}</option>`).join('')}
                </select>
            </div>`;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cancelar</button>
            <button class="btn btn-success" onclick="guardarEdicionReserva(${id})"><i class="fas fa-save"></i> Guardar Cambios</button>`;
        
        openModal(`Editar Reserva #${id}`, bodyHtml, footerHtml);
    } catch (e) {}
}

async function guardarEdicionReserva(id) {
    const data = {
        fecha: document.getElementById('edit-fecha').value,
        hora: document.getElementById('edit-hora').value,
        cantidad: parseInt(document.getElementById('edit-cantidad').value),
        id_mesa: document.getElementById('edit-mesa').value
    };
    
    try {
        await fetchAPI(`/reservas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showToast('Reserva actualizada correctamente', 'success');
        closeModal();
        buscarReservaPorDNI();
    } catch (e) {}
}

// ===== NUEVA FUNCIÓN: ANFITRIONA TOMA PEDIDO =====
async function renderAnfitrionaTomaPedido() {
    setPageTitle('Anfitriona - Tomar Pedido', 'fa-utensils');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const [mesas, menuData] = await Promise.all([
            fetchAPI('/mesas'),
            fetchAPI('/menu')
        ]);
        
        MENU_DATA = menuData;
        CART = [];
        
        const mesasOptions = mesas.map(m => 
            `<option value="${m.id}">Mesa ${m.numero} - ${m.tipo} (${m.capacidad} pers.) - ${m.disponibilidad ? 'Disponible' : 'Ocupada'}</option>`
        ).join('');
        
        const categorias = Object.keys(menuData);
        
        content.innerHTML = `
            <div class="order-layout">
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-clipboard-list"></i> Datos del Pedido</h3>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label><i class="fas fa-chair"></i> Mesa</label>
                                <select id="pedido-mesa" required>
                                    <option value="">Seleccione mesa...</option>
                                    ${mesasOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label><i class="fas fa-user"></i> Nombre Cliente (opcional)</label>
                                <input type="text" id="pedido-nombre" placeholder="Nombre del cliente">
                            </div>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-comment"></i> Observaciones Generales</label>
                            <textarea id="pedido-obs" rows="2" placeholder="Observaciones del pedido..."></textarea>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-book-open"></i> Menú</h3>
                        </div>
                        <div class="menu-categories" id="menu-categories">
                            ${categorias.map((cat, idx) => 
                                `<button class="category-btn ${idx === 0 ? 'active' : ''}" onclick="cambiarCategoriaAnfitriona('${cat}')">${cat}</button>`
                            ).join('')}
                        </div>
                        <div class="menu-items" id="menu-items"></div>
                    </div>
                </div>
                
                <div class="cart-panel">
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-shopping-cart"></i> Pedido</h3>
                            <span class="badge badge-pendiente" id="cart-count">0 items</span>
                        </div>
                        <div class="cart-items" id="cart-items">
                            <p class="text-center" style="padding: 30px; color: #999;">
                                <i class="fas fa-cart-plus" style="font-size: 2.5em;"></i><br>
                                Agregue items del menú
                            </p>
                        </div>
                        <div class="cart-total" id="cart-total" style="display: none;">
                            <div class="cart-total-row">
                                <span>TOTAL</span>
                                <span id="total-amount">S/ 0.00</span>
                            </div>
                        </div>
                        <button class="btn btn-success btn-block mt-3" onclick="enviarComandaAnfitriona()" style="display: none;" id="btn-enviar">
                            <i class="fas fa-paper-plane"></i> Enviar a Cocina
                        </button>
                    </div>
                </div>
            </div>`;
        
        if (categorias.length > 0) {
            cambiarCategoriaAnfitriona(categorias[0]);
        }
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar datos</div>';
    }
}

function cambiarCategoriaAnfitriona(categoria) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === categoria);
    });
    
    const items = MENU_DATA[categoria] || [];
    const container = document.getElementById('menu-items');
    
    container.innerHTML = items.map(item => `
        <div class="menu-item" onclick="agregarAlCarritoAnfitriona(${item.id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.precio})">
            <div class="item-name">${item.nombre}</div>
            <div class="item-price">S/ ${item.precio.toFixed(2)}</div>
            ${item.descripcion ? `<small style="color: #888; font-size: 0.8em;">${item.descripcion}</small>` : ''}
        </div>
    `).join('');
}

function agregarAlCarritoAnfitriona(id, nombre, precio) {
    const existe = CART.find(item => item.id_menu === id);
    
    if (existe) {
        existe.cantidad++;
    } else {
        CART.push({
            id_menu: id,
            nombre: nombre,
            precio: precio,
            cantidad: 1,
            observaciones: ''
        });
    }
    
    actualizarCarritoAnfitriona();
    showToast(`${nombre} agregado al pedido`, 'success');
}

function actualizarCarritoAnfitriona() {
    const container = document.getElementById('cart-items');
    const countBadge = document.getElementById('cart-count');
    const totalEl = document.getElementById('total-amount');
    const cartTotalDiv = document.getElementById('cart-total');
    const btnEnviar = document.getElementById('btn-enviar');
    
    if (CART.length === 0) {
        container.innerHTML = `
            <p class="text-center" style="padding: 30px; color: #999;">
                <i class="fas fa-cart-plus" style="font-size: 2.5em;"></i><br>
                Agregue items del menú
            </p>`;
        cartTotalDiv.style.display = 'none';
        btnEnviar.style.display = 'none';
        countBadge.textContent = '0 items';
        return;
    }
    
    const total = CART.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    container.innerHTML = CART.map((item, idx) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.nombre}</div>
                <div class="cart-item-price">S/ ${item.precio.toFixed(2)} c/u</div>
                ${item.observaciones ? `<small style="color: #888;"><i class="fas fa-comment"></i> ${item.observaciones}</small>` : ''}
            </div>
            <div class="cart-item-actions">
                <button class="qty-btn-minus" onclick="cambiarCantidadAnfitriona(${idx}, -1)">-</button>
                <span class="cart-item-qty">${item.cantidad}</span>
                <button class="qty-btn-plus" onclick="cambiarCantidadAnfitriona(${idx}, 1)">+</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarDelCarritoAnfitriona(${idx})" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    
    countBadge.textContent = `${CART.length} items`;
    totalEl.textContent = `S/ ${total.toFixed(2)}`;
    cartTotalDiv.style.display = 'block';
    btnEnviar.style.display = 'block';
}

function cambiarCantidadAnfitriona(idx, delta) {
    CART[idx].cantidad += delta;
    if (CART[idx].cantidad <= 0) {
        CART.splice(idx, 1);
    }
    actualizarCarritoAnfitriona();
}

function eliminarDelCarritoAnfitriona(idx) {
    CART.splice(idx, 1);
    actualizarCarritoAnfitriona();
}

async function enviarComandaAnfitriona() {
    const mesa = document.getElementById('pedido-mesa').value;
    const nombre = document.getElementById('pedido-nombre').value;
    const obs = document.getElementById('pedido-obs').value;
    
    if (!mesa) return showToast('Debe seleccionar una mesa', 'error');
    if (CART.length === 0) return showToast('Debe agregar al menos un item', 'error');
    
    const data = {
        id_mesa: mesa,
        nombre_cliente: nombre,
        observaciones: obs,
        items: CART
    };
    
    showConfirm('Enviar Comanda', '¿Desea enviar esta comanda a cocina?', async () => {
        try {
            const res = await fetchAPI('/comandas', { method: 'POST', body: JSON.stringify(data) });
            showToast(res.message, 'success');
            renderAnfitrionaTomaPedido();
        } catch (e) {}
    }, 'fa-paper-plane', 'var(--success)');
}