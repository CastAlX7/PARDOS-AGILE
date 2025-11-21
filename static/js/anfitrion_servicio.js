// ==================== MÓDULO ANFITRIÓN DE SERVICIO (MOZO) ====================
// HUO09, HUO10

let CART = [];
let MENU_DATA = {};

// HUO09: Tomar Pedido
async function renderTomarPedido() {
    setPageTitle('Tomar Pedido', 'fa-utensils');
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
                                `<button class="category-btn ${idx === 0 ? 'active' : ''}" onclick="cambiarCategoria('${cat}')">${cat}</button>`
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
                        <button class="btn btn-success btn-block mt-3" onclick="enviarComanda()" style="display: none;" id="btn-enviar">
                            <i class="fas fa-paper-plane"></i> Enviar a Cocina
                        </button>
                    </div>
                </div>
            </div>`;
        
        if (categorias.length > 0) {
            cambiarCategoria(categorias[0]);
        }
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar datos</div>';
    }
}

function cambiarCategoria(categoria) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === categoria);
    });
    
    const items = MENU_DATA[categoria] || [];
    const container = document.getElementById('menu-items');
    
    container.innerHTML = items.map(item => `
        <div class="menu-item" onclick="agregarAlCarrito(${item.id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.precio})">
            <div class="item-name">${item.nombre}</div>
            <div class="item-price">S/ ${item.precio.toFixed(2)}</div>
            ${item.descripcion ? `<small style="color: #888; font-size: 0.8em;">${item.descripcion}</small>` : ''}
        </div>
    `).join('');
}

function agregarAlCarrito(id, nombre, precio) {
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
    
    actualizarCarrito();
    showToast(`${nombre} agregado al pedido`, 'success');
}

function actualizarCarrito() {
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
                <button class="qty-btn-minus" onclick="cambiarCantidad(${idx}, -1)">-</button>
                <span class="cart-item-qty">${item.cantidad}</span>
                <button class="qty-btn-plus" onclick="cambiarCantidad(${idx}, 1)">+</button>
                <button class="btn btn-sm" style="background: #fff3cd; color: #856404; margin-left: 5px;" onclick="agregarObservacion(${idx})" title="Observaciones"><i class="fas fa-comment"></i></button>
                <button class="btn btn-danger btn-sm" onclick="eliminarDelCarrito(${idx})" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    
    countBadge.textContent = `${CART.length} items`;
    totalEl.textContent = `S/ ${total.toFixed(2)}`;
    cartTotalDiv.style.display = 'block';
    btnEnviar.style.display = 'block';
}

function cambiarCantidad(idx, delta) {
    CART[idx].cantidad += delta;
    if (CART[idx].cantidad <= 0) {
        CART.splice(idx, 1);
    }
    actualizarCarrito();
}

function eliminarDelCarrito(idx) {
    CART.splice(idx, 1);
    actualizarCarrito();
}

function agregarObservacion(idx) {
    const item = CART[idx];
    const bodyHtml = `
        <div class="form-group">
            <label><i class="fas fa-comment"></i> Observaciones para: <strong>${item.nombre}</strong></label>
            <textarea id="obs-input" rows="3" placeholder="Ej: Sin sal, término medio, etc.">${item.observaciones}</textarea>
        </div>`;
    
    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="guardarObservacion(${idx})"><i class="fas fa-save"></i> Guardar</button>`;
    
    openModal('Agregar Observaciones', bodyHtml, footerHtml);
}

function guardarObservacion(idx) {
    CART[idx].observaciones = document.getElementById('obs-input').value;
    actualizarCarrito();
    closeModal();
}

async function enviarComanda() {
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
            renderTomarPedido(); // Resetear formulario
        } catch (e) {}
    }, 'fa-paper-plane', 'var(--success)');
}

// HUO10: Modificar Comanda
async function renderModificarComanda() {
    setPageTitle('Modificar Comanda', 'fa-edit');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas?estado=pendiente');
        
        if (comandas.length === 0) {
            content.innerHTML = `
                <div class="card text-center" style="padding: 60px;">
                    <i class="fas fa-check-circle" style="font-size: 4em; color: var(--success);"></i>
                    <h3 style="margin-top: 20px; color: var(--success);">¡No hay comandas pendientes!</h3>
                    <p style="color: #666;">Todas las comandas han sido procesadas</p>
                </div>`;
            return;
        }
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-list"></i> Comandas Pendientes</h3>
                    <span class="badge badge-pendiente">${comandas.length} comandas</span>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>ID</th><th>Mesa</th><th>Cliente</th><th>Hora</th><th>Items</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
                        <tbody>
                            ${comandas.map(c => `
                                <tr>
                                    <td><strong>#${c.id}</strong></td>
                                    <td>Mesa ${c.mesa}</td>
                                    <td>${c.nombre_cliente || '-'}</td>
                                    <td>${c.hora}</td>
                                    <td>${c.items.length} items</td>
                                    <td><strong>S/ ${c.total.toFixed(2)}</strong></td>
                                    <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
                                    <td>
                                        <button class="btn btn-info btn-sm" onclick="editarComanda(${c.id})"><i class="fas fa-edit"></i> Editar</button>
                                        <button class="btn btn-danger btn-sm" onclick="eliminarComanda(${c.id})"><i class="fas fa-trash"></i> Eliminar</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar comandas</div>';
    }
}

async function editarComanda(id) {
    try {
        const [comanda, menuData] = await Promise.all([
            fetchAPI(`/comandas/${id}`),
            fetchAPI('/menu')
        ]);
        
        MENU_DATA = menuData;
        CART = comanda.items.map(item => ({
            id_menu: item.id_menu,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad,
            observaciones: item.observaciones || ''
        }));
        
        const categorias = Object.keys(menuData);
        
        const bodyHtml = `
            <div style="max-height: 60vh; overflow-y: auto;">
                <h4><i class="fas fa-shopping-cart"></i> Items Actuales</h4>
                <div id="modal-cart-items"></div>
                
                <h4 style="margin-top: 20px;"><i class="fas fa-plus-circle"></i> Agregar más items</h4>
                <div class="menu-categories">
                    ${categorias.map((cat, idx) => 
                        `<button class="category-btn ${idx === 0 ? 'active' : ''}" onclick="cambiarCategoriaModal('${cat}')">${cat}</button>`
                    ).join('')}
                </div>
                <div class="menu-items" id="modal-menu-items" style="margin-top: 15px;"></div>
                
                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <strong>Total: <span id="modal-total">S/ 0.00</span></strong>
                </div>
            </div>`;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal(); CART = [];">Cancelar</button>
            <button class="btn btn-success" onclick="guardarEdicionComanda(${id})"><i class="fas fa-save"></i> Guardar Cambios</button>`;
        
        openModal(`Editar Comanda #${id}`, bodyHtml, footerHtml);
        
        actualizarCarritoModal();
        if (categorias.length > 0) {
            cambiarCategoriaModal(categorias[0]);
        }
    } catch (e) {}
}

function actualizarCarritoModal() {
    const container = document.getElementById('modal-cart-items');
    const totalEl = document.getElementById('modal-total');
    
    if (CART.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No hay items</p>';
        totalEl.textContent = 'S/ 0.00';
        return;
    }
    
    const total = CART.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    container.innerHTML = CART.map((item, idx) => `
        <div class="cart-item" style="margin-bottom: 10px;">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.nombre}</div>
                <div class="cart-item-price">S/ ${item.precio.toFixed(2)} c/u</div>
            </div>
            <div class="cart-item-actions">
                <button class="qty-btn-minus" onclick="cambiarCantidad(${idx}, -1); actualizarCarritoModal();">-</button>
                <span class="cart-item-qty">${item.cantidad}</span>
                <button class="qty-btn-plus" onclick="cambiarCantidad(${idx}, 1); actualizarCarritoModal();">+</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarDelCarrito(${idx}); actualizarCarritoModal();"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    
    totalEl.textContent = `S/ ${total.toFixed(2)}`;
}

function cambiarCategoriaModal(categoria) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === categoria);
    });
    
    const items = MENU_DATA[categoria] || [];
    const container = document.getElementById('modal-menu-items');
    
    container.innerHTML = items.map(item => `
        <div class="menu-item" onclick="agregarAlCarrito(${item.id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.precio}); actualizarCarritoModal();">
            <div class="item-name">${item.nombre}</div>
            <div class="item-price">S/ ${item.precio.toFixed(2)}</div>
        </div>
    `).join('');
}

async function guardarEdicionComanda(id) {
    if (CART.length === 0) return showToast('Debe tener al menos un item', 'error');
    
    const data = {
        items: CART
    };
    
    try {
        await fetchAPI(`/comandas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showToast('Comanda actualizada correctamente', 'success');
        closeModal();
        CART = [];
        renderModificarComanda();
    } catch (e) {}
}

function eliminarComanda(id) {
    showConfirm('Eliminar Comanda', '¿Está seguro de eliminar esta comanda?', async () => {
        try {
            await fetchAPI(`/comandas/${id}`, { method: 'DELETE' });
            showToast('Comanda eliminada', 'success');
            renderModificarComanda();
        } catch (e) {}
    }, 'fa-trash-alt', 'var(--danger)');
}

// Ver Cocina (para anfitrión)
async function renderCocina() {
    setPageTitle('Cocina - Comandas', 'fa-fire-alt');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas');
        const activas = comandas.filter(c => ['pendiente', 'completada'].includes(c.estado));
        
        if (activas.length === 0) {
            content.innerHTML = `
                <div class="card text-center" style="padding: 60px;">
                    <i class="fas fa-check-double" style="font-size: 4em; color: var(--success);"></i>
                    <h3 style="margin-top: 20px; color: var(--success);">¡Todo al día!</h3>
                    <p style="color: #666;">No hay comandas pendientes en este momento</p>
                </div>`;
            return;
        }
        
        const pendientes = activas.filter(c => c.estado === 'pendiente');
        const completadas = activas.filter(c => c.estado === 'completada');
        
        content.innerHTML = `
            <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                <div class="card" style="flex: 1; text-align: center; padding: 20px; background: linear-gradient(135deg, #fff3cd, #ffeeba);">
                    <h2 style="font-size: 2.5em; color: #856404;">${pendientes.length}</h2>
                    <p style="color: #856404; font-weight: 600;"><i class="fas fa-clock"></i> Pendientes</p>
                </div>
                <div class="card" style="flex: 1; text-align: center; padding: 20px; background: linear-gradient(135deg, #d4edda, #c3e6cb);">
                    <h2 style="font-size: 2.5em; color: #155724;">${completadas.length}</h2>
                    <p style="color: #155724; font-weight: 600;"><i class="fas fa-check"></i> Listas para Servir</p>
                </div>
            </div>
            
            <div class="cocina-grid">
                ${activas.map(c => `
                    <div class="comanda-card ${c.estado}">
                        <div class="comanda-header">
                            <div>
                                <span class="comanda-mesa"><i class="fas fa-chair"></i> Mesa ${c.mesa}</span>
                                ${c.nombre_cliente ? `<div style="font-size: 0.85em; color: #666;">${c.nombre_cliente}</div>` : ''}
                            </div>
                            <div style="text-align: right;">
                                <div class="comanda-time"><i class="fas fa-clock"></i> ${c.hora}</div>
                                <span class="badge badge-${c.estado}">${c.estado}</span>
                            </div>
                        </div>
                        <div class="comanda-items">
                            ${c.items.map(i => `
                                <div class="comanda-item">
                                    <div>
                                        <span class="comanda-item-qty">${i.cantidad}</span>
                                        <strong>${i.nombre}</strong>
                                        ${i.observaciones ? `<div class="comanda-obs"><i class="fas fa-comment"></i> ${i.observaciones}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="comanda-footer">
                            ${c.estado === 'completada' ? `
                                <div class="text-center" style="color: var(--success);">
                                    <i class="fas fa-check-circle"></i> <strong>Listo para Servir</strong>
                                </div>
                            ` : `
                                <div class="text-center" style="color: var(--warning);">
                                    <i class="fas fa-clock"></i> <strong>En Preparación</strong>
                                </div>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>`;
        
        setTimeout(() => {
            if (document.getElementById('page-title')?.textContent?.includes('Cocina')) {
                renderCocina();
            }
        }, 30000);
        
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar comandas</div>';
    }
}